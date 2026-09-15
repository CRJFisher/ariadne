/**
 * Function collection detection for JavaScript/TypeScript AST nodes.
 *
 * Detects Map/Set/Array/Object literals that store functions (or references to
 * them) so a call reached only through the collection — `handlers[key]()`,
 * `app.method()`, `Counter.prototype.method()` — still resolves to a real
 * definition instead of dangling.
 */

import type { SyntaxNode } from "tree-sitter";

import type {
  SymbolId,
  SymbolName,
  CollectionMember,
  FunctionCollectionInfo,
  FilePath,
} from "@ariadnejs/types";
import {
  anonymous_function_symbol,
  function_symbol,
  method_symbol,
} from "@ariadnejs/types";
import { node_to_location } from "../../node_to_location";

// ============================================================================
// Function Collection Detection
// ============================================================================

/**
 * Detect if a variable declaration contains a function collection (Map/Array/Object with functions).
 * Returns collection metadata if detected, null otherwise.
 *
 * Patterns detected:
 * - const CONFIG = new Map([["key", handler], ...])
 * - const handlers = [fn1, fn2, fn3]
 * - const config = { success: handler1, error: handler2 }
 */
export function detect_function_collection(
  node: SyntaxNode,
  file_path: FilePath
): FunctionCollectionInfo | null {
  // Get the variable declarator node (contains name and initializer)
  let declarator = node;
  if (node.type === "variable_declaration") {
    declarator = node.namedChildren?.[0] ?? node;
  }

  // Get the initializer (value being assigned)
  let initializer = declarator.childForFieldName?.("value") || declarator.childForFieldName?.("init");
  if (!initializer) return null;

  // Unwrap "as const" assertions (as_expression in tree-sitter TypeScript)
  // e.g., `const HANDLERS = { ... } as const;`
  if (initializer.type === "as_expression") {
    // The first child is the actual value, second is the type
    initializer = initializer.namedChildren?.[0] ?? initializer;
  }

  // Check for new Map([...]) or new Set([...])
  if (initializer.type === "new_expression") {
    const constructor_node = initializer.childForFieldName?.("constructor");
    if (
      constructor_node?.text === "Map" ||
      constructor_node?.text === "Set"
    ) {
      const args = initializer.childForFieldName?.("arguments");
      const { functions, references } = extract_functions_from_collection_args(args, file_path);
      if (functions.length > 0 || references.length > 0) {

        return {
          collection_type: constructor_node.text as "Map" | "Set",
          location: node_to_location(initializer, file_path),
          stored_functions: functions,
          stored_references: references,
        };
      }
    }
  }

  // Check for array literal: [fn1, fn2, ...]
  if (initializer.type === "array") {
    const { functions, references } = extract_functions_from_array(initializer, file_path);
    if (functions.length > 0 || references.length > 0) {
      return {
        collection_type: "Array",
        location: node_to_location(initializer, file_path),
        stored_functions: functions,
        stored_references: references,
        ...(every_element_is(initializer, "identifier") && { elements_are_references: true as const }),
      };
    }
  }

  // Check for object literal: { key: fn, ... }
  if (initializer.type === "object") {
    const { functions, references, named_members } = extract_functions_from_object(
      initializer,
      file_path
    );
    // A pure-nested object (`{ A: { prop: fn } }`) has empty flat lists but a
    // named member, so register on named_members too.
    if (functions.length > 0 || references.length > 0 || named_members.length > 0) {
      return {
        collection_type: "Object",
        location: node_to_location(initializer, file_path),
        stored_functions: functions,
        stored_references: references,
        named_members,
      };
    }
  }

  return null;
}

/**
 * Detect a member-assigned function value: `app.method = function () {}` or
 * `Counter.prototype.method = () => {}`. Returns the holder identifier and the
 * property-named member function, or null when the assignment is not a function
 * value on a simple (optionally `.prototype`) receiver.
 *
 * The member function's symbol matches the anonymous-function definition the
 * right-hand side is indexed as, so the collection points at a real node.
 */
export function detect_member_assignment(
  assignment_node: SyntaxNode,
  file_path: FilePath
): { holder_name: SymbolName; member: CollectionMember } | null {
  const left = assignment_node.childForFieldName?.("left");
  const right = assignment_node.childForFieldName?.("right");
  if (!left || left.type !== "member_expression" || !right) {
    return null;
  }

  if (
    right.type !== "arrow_function" &&
    right.type !== "function_expression" &&
    right.type !== "function"
  ) {
    return null;
  }

  const property = left.childForFieldName("property");
  if (!property || property.type !== "property_identifier") {
    return null;
  }

  const object = left.childForFieldName("object");
  if (!object) {
    return null;
  }

  let holder_name: string | undefined;
  if (object.type === "identifier") {
    holder_name = object.text; // app.method = fn
  } else if (object.type === "member_expression") {
    const inner_property = object.childForFieldName("property");
    const inner_object = object.childForFieldName("object");
    if (inner_property?.text === "prototype" && inner_object?.type === "identifier") {
      holder_name = inner_object.text; // Counter.prototype.method = fn
    }
  }
  if (!holder_name) {
    return null;
  }

  // A named function expression already has its own function definition at the
  // name node; the member must carry that identity, or reachability through the
  // collection lands on the location-keyed anonymous twin and the named
  // definition dangles as a false entry point.
  const name_node = right.childForFieldName?.("name");
  const member_location = node_to_location(right, file_path);
  const member_id = name_node
    ? function_symbol(
        name_node.text as SymbolName,
        node_to_location(name_node, file_path)
      )
    : anonymous_function_symbol(member_location);
  return {
    holder_name: holder_name as SymbolName,
    member: {
      name: property.text as SymbolName,
      symbol_id: member_id,
      location: member_location,
    },
  };
}

/**
 * Extract function SymbolIds from Map/Set constructor arguments.
 * For Map: new Map([["key", fn], ...])
 * For Set: new Set([fn1, fn2, ...])
 */
function extract_functions_from_collection_args(
  args: SyntaxNode | null | undefined,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[] } {
  if (!args) return { functions: [], references: [] };

  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];

  // Traverse all descendants looking for arrow_function or function_expression nodes
  function visit(node: SyntaxNode) {

    if (
      node.type === "arrow_function" ||
      node.type === "function_expression" ||
      node.type === "function"
    ) {
      const location = node_to_location(node, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (node.type === "identifier") {
      // Capture variable references (potential functions)
      // Check if parent is array (Map entry) or arguments
      if (node.parent?.type === "array" || node.parent?.type === "arguments") {
         references.push(node.text as SymbolName);
      }
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) visit(child);
    }
  }

  visit(args);
  return { functions: function_ids, references };
}

/**
 * Extract function SymbolIds from array literal: [fn1, fn2, fn3]
 */
function extract_functions_from_array(
  array_node: SyntaxNode,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[] } {
  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];

  for (let i = 0; i < array_node.namedChildCount; i++) {
    const element = array_node.namedChild(i);
    if (!element) continue;

    // Handle spread elements: [...OTHER_ARRAY]
    if (element.type === "spread_element") {
      const spread_arg = element.namedChildren[0];
      if (spread_arg?.type === "identifier") {
        references.push(spread_arg.text as SymbolName);
      }
      continue;
    }

    if (
      element.type === "arrow_function" ||
      element.type === "function_expression" ||
      element.type === "function"
    ) {
      const location = node_to_location(element, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (element.type === "identifier") {
      references.push(element.text as SymbolName);
    }
  }

  return { functions: function_ids, references };
}

/** Whether every element of a sequence literal is a node of `type`, comments aside. */
function every_element_is(literal: SyntaxNode, type: string): boolean {
  return literal.namedChildren.every((element) => element.type === type || element.type === "comment");
}

/**
 * The static property name of an object-literal key node, or undefined for a
 * computed key. A string key contributes its unquoted text; a shorthand or
 * `property_identifier` its identifier.
 */
function object_property_key(key_node: SyntaxNode | null | undefined): SymbolName | undefined {
  if (!key_node) return undefined;
  if (key_node.type === "property_identifier" || key_node.type === "identifier") {
    return key_node.text as SymbolName;
  }
  if (key_node.type === "string") {
    return key_node.text.slice(1, -1) as SymbolName;
  }
  return undefined;
}

/**
 * The shorthand-method key shapes `@definition.method` captures. A key of any
 * other shape — `{ 'my-key'() {} }`, `{ 1() {} }` — reaches no definition
 * builder, so recording a member for it would name a function that does not
 * exist.
 */
const METHOD_KEY_TYPES = new Set([
  "property_identifier",
  "private_property_identifier",
  "computed_property_name",
]);

/** `@definition.method` excludes this name, and an object literal has no class to give it to. */
const NON_METHOD_KEY = "constructor";

/**
 * Extract function SymbolIds from object literal: { key: fn, ... }
 *
 * `named_members` records the property name → member function — an inline function,
 * a value identifier, or a nested object literal — for `obj.method()` /
 * `this.method()` resolution and for following a local object-property alias one
 * property deeper. `functions`/`references` feed keyless dispatch and
 * indirect-reachability. A nested object-literal value contributes a `nested`
 * member only; its functions never enter the flat lists, so the keyless union
 * path cannot reach them. Duplicate keys are resolved last-wins at lookup.
 */
function extract_functions_from_object(
  obj_node: SyntaxNode,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[]; named_members: CollectionMember[] } {
  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];
  const named_members: CollectionMember[] = [];

  for (let i = 0; i < obj_node.namedChildCount; i++) {
    const child = obj_node.namedChild(i);
    if (!child) continue;

    // Handle spread elements: { ...OTHER_HANDLERS }. A spread has no key, so it
    // flattens into the union view only.
    if (child.type === "spread_element") {
      const spread_arg = child.namedChildren[0];
      if (spread_arg?.type === "identifier") {
        references.push(spread_arg.text as SymbolName);
      }
      continue;
    }

    // Handle shorthand method definitions: { method() { ... } }. The
    // definition side keys a method's id on its name node, so the member
    // carries that same key or the collection names a function that does not
    // exist and every call through it dangles.
    if (child.type === "method_definition") {
      const name_node = child.childForFieldName("name");
      if (
        name_node &&
        METHOD_KEY_TYPES.has(name_node.type) &&
        name_node.text !== NON_METHOD_KEY
      ) {
        const location = node_to_location(child, file_path);
        const method_id = method_symbol(
          name_node.text,
          node_to_location(name_node, file_path)
        );
        function_ids.push(method_id);
        named_members.push({ name: name_node.text as SymbolName, symbol_id: method_id, location });
      }
      continue;
    }

    // Handle pair nodes: { key: value }
    if (child.type !== "pair") continue;

    const value = child.childForFieldName?.("value");
    if (!value) continue;

    const name = object_property_key(child.childForFieldName?.("key"));

    if (
      value.type === "arrow_function" ||
      value.type === "function_expression" ||
      value.type === "function"
    ) {
      const location = node_to_location(value, file_path);
      const fn_id = anonymous_function_symbol(location);
      function_ids.push(fn_id);
      if (name) named_members.push({ name, symbol_id: fn_id, location });
    } else if (value.type === "identifier") {
      references.push(value.text as SymbolName);
      if (name) named_members.push({ name, reference_name: value.text as SymbolName });
    } else if (value.type === "object" && name) {
      const nested = extract_functions_from_object(value, file_path);
      if (nested.named_members.length > 0) {
        named_members.push({ name, nested: nested.named_members });
      }
    }
  }

  return { functions: function_ids, references, named_members };
}
