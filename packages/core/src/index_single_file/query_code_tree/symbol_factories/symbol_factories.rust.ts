// Helper functions for Rust builder pattern
import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  ExportMetadata,
  FunctionCollectionInfo,
  FilePath,
} from "@ariadnejs/types";
import {
  class_symbol,
  function_symbol,
  method_symbol,
  parameter_symbol,
  property_symbol,
  variable_symbol,
  interface_symbol,
  enum_symbol,
  constant_symbol,
  type_alias_symbol,
  module_symbol,
  anonymous_function_symbol,
} from "@ariadnejs/types";
import type { CaptureNode } from "../../index_single_file";
import { node_to_location } from "../../node_utils";
export { detect_callback_context } from "./callback.rust";
export {
  type ImportInfo,
  extract_imports_from_use_declaration,
  extract_import_from_extern_crate,
} from "./imports.rust";

//
// Symbol ID Creation
//

export function create_struct_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  // Use the parent struct_item node's location, not just the name's location
  // This ensures the ID matches what find_containing_impl generates
  const struct_node = capture.node.parent;
  if (!struct_node) {
    return class_symbol(name, capture.location);
  }

  const location = {
    file_path: capture.location.file_path,
    start_line: struct_node.startPosition.row + 1,
    start_column: struct_node.startPosition.column + 1,
    end_line: struct_node.endPosition.row + 1,
    end_column: struct_node.endPosition.column,
  };
  return class_symbol(name, location);
}

export function create_enum_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return enum_symbol(name, location);
}

export function create_trait_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  // Use the parent trait_item node's location, not just the name's location
  // This ensures the ID matches what find_containing_trait generates
  const trait_node = capture.node.parent;
  if (!trait_node) {
    return interface_symbol(name, capture.location);
  }

  const location = {
    file_path: capture.location.file_path,
    start_line: trait_node.startPosition.row + 1,
    start_column: trait_node.startPosition.column + 1,
    end_line: trait_node.endPosition.row + 1,
    end_column: trait_node.endPosition.column,
  };
  return interface_symbol(name, location);
}

export function create_function_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  // Use the parent function_item node's location, not just the name's location
  // This ensures the ID matches what find_containing_callable generates
  const function_node = capture.node.parent;
  if (!function_node) {
    return function_symbol(name, capture.location);
  }

  const location = {
    file_path: capture.location.file_path,
    start_line: function_node.startPosition.row + 1,
    start_column: function_node.startPosition.column + 1,
    end_line: function_node.endPosition.row + 1,
    end_column: function_node.endPosition.column,
  };
  return function_symbol(name, location);
}

export function create_method_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  // Use the parent function_item node's location, not just the name's location
  // This ensures the ID matches what find_containing_callable generates for methods
  const function_node = capture.node.parent;
  if (!function_node) {
    return method_symbol(name, capture.location);
  }

  const location = {
    file_path: capture.location.file_path,
    start_line: function_node.startPosition.row + 1,
    start_column: function_node.startPosition.column + 1,
    end_line: function_node.endPosition.row + 1,
    end_column: function_node.endPosition.column,
  };
  return method_symbol(name, location);
}

export function create_field_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return property_symbol(name, location);
}

export function create_variable_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return variable_symbol(name, location);
}

export function create_constant_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return constant_symbol(name, location);
}

export function create_parameter_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return parameter_symbol(name, location);
}

export function create_module_id(capture: CaptureNode): SymbolId {
  const location = capture.location;
  return module_symbol(location);
}

export function create_type_alias_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return type_alias_symbol(name, location);
}

//
// Rust-Specific Extractors
//

/**
 * Check if a Rust node has pub visibility modifier
 *
 * Matches the logic in extract_visibility() but returns a simple boolean.
 * Walks up the parent tree for items like fields in structs.
 */
export function has_pub_modifier(node: SyntaxNode): boolean {
  let test_node = node;

  while (test_node) {
    // Check if this node has a visibility_modifier child
    const visibility_node = test_node.children?.find(
      (child) => child.type === "visibility_modifier"
    );

    if (visibility_node) {
      // Any form of pub (pub, pub(crate), pub(super), pub(in path)) counts as exported
      return visibility_node.text.startsWith("pub");
    }

    // Walk up the parent chain for fields/methods that might inherit visibility context
    // Only walk up for specific item types to match extract_visibility behavior
    if (
      test_node.parent &&
      (test_node.parent.type === "struct_item" ||
        test_node.parent.type === "enum_item" ||
        test_node.parent.type === "function_item" ||
        test_node.parent.type === "const_item" ||
        test_node.parent.type === "static_item" ||
        test_node.parent.type === "trait_item" ||
        test_node.parent.type === "type_item" ||
        test_node.parent.type === "mod_item")
    ) {
      test_node = test_node.parent;
    } else {
      break;
    }
  }

  // Default: no pub modifier means not exported
  return false;
}

/**
 * Extract export info for Rust definitions
 */
export function extract_export_info(node: SyntaxNode): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  const has_pub = has_pub_modifier(node);

  return {
    is_exported: has_pub,
    export: undefined, // Rust doesn't have export aliases like JS
  };
}

export function extract_generic_parameters(node: SyntaxNode): SymbolName[] {
  const generics: SymbolName[] = [];
  const type_params = node.childForFieldName?.("type_parameters");

  if (type_params) {
    for (const child of type_params.children || []) {
      if (child.type === "type_identifier" || child.type === "lifetime") {
        generics.push(child.text as SymbolName);
      } else if (child.type === "constrained_type_parameter") {
        const name = child.childForFieldName?.("left");
        if (name) {
          generics.push(name.text as SymbolName);
        }
      } else if (child.type === "optional_type_parameter") {
        const name = child.childForFieldName?.("name");
        if (name) {
          generics.push(name.text as SymbolName);
        }
      }
    }
  }

  return generics;
}

export function extract_impl_trait(node: SyntaxNode): SymbolName | undefined {
  // For impl blocks, extract the trait being implemented
  if (node.type === "impl_item") {
    const trait = node.childForFieldName?.("trait");
    if (trait) {
      return trait.text as SymbolName;
    }
  }
  return undefined;
}

export function extract_impl_type(node: SyntaxNode): SymbolName | undefined {
  // For impl blocks, extract the type being implemented for
  if (node.type === "impl_item") {
    const type = node.childForFieldName?.("type");
    if (type) {
      // For generic types like "Container<T>", extract just the base name "Container"
      // The type field might be a generic_type with a type_identifier child
      if (type.type === "generic_type") {
        const type_identifier = type.childForFieldName?.("type");
        if (type_identifier) {
          return type_identifier.text as SymbolName;
        }
      }
      // For non-generic types, check if it's a type_identifier
      if (type.type === "type_identifier") {
        return type.text as SymbolName;
      }
      // Fallback: return the full text
      return type.text as SymbolName;
    }
  }
  return undefined;
}

export function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const return_type = node.childForFieldName?.("return_type");
  if (return_type) {
    // Return the full return type text, cleaned up
    return return_type.text?.replace(/^->\s*/, "").trim() as SymbolName;
  }
  return undefined;
}

export function extract_parameter_type(
  node: SyntaxNode
): SymbolName | undefined {
  const type_node = node.childForFieldName?.("type");
  if (type_node) {
    return type_node.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract type expression from type alias declaration
 *
 * @param node - The type alias name node
 * @returns The type expression text or undefined
 *
 * @example
 * type Kilometers = i32;  // Returns "i32"
 * type Result<T> = std::result::Result<T, Error>;  // Returns "std::result::Result<T, Error>"
 */
export function extract_type_expression(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (!parent || parent.type !== "type_item") {
    return undefined;
  }

  const type_node = parent.childForFieldName?.("type");
  return type_node?.text;
}

export function is_self_parameter(node: SyntaxNode): boolean {
  const pattern = node.childForFieldName?.("pattern");
  if (pattern) {
    return (
      pattern.type === "self" ||
      pattern.text === "self" ||
      pattern.text === "&self" ||
      pattern.text === "&mut self"
    );
  }
  return false;
}

export function find_containing_impl(
  capture: CaptureNode
): { struct_name?: SymbolName; trait_name?: SymbolName } | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "impl_item") {
      const impl_type = extract_impl_type(node);
      const impl_trait = extract_impl_trait(node);

      if (impl_type) {
        const result: { struct_name?: SymbolName; trait_name?: SymbolName } =
          {};

        // Return struct name for lookup (not ID with location)
        result.struct_name = impl_type as SymbolName;

        // If implementing a trait, return trait name
        if (impl_trait) {
          result.trait_name = impl_trait as SymbolName;
        }

        return result;
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }

  return undefined;
}

export function find_containing_struct(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "struct_item") {
      const name_node = node.childForFieldName?.("name");
      if (name_node) {
        // Use the struct_item node's location, not the name's location
        // This matches how create_struct_id generates IDs
        const location = {
          file_path: capture.location.file_path,
          start_line: node.startPosition.row + 1,
          start_column: node.startPosition.column + 1,
          end_line: node.endPosition.row + 1,
          end_column: node.endPosition.column,
        };
        return class_symbol(name_node.text as SymbolName, location);
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }

  return undefined;
}

export function find_containing_trait(
  capture: CaptureNode
): SymbolName | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "trait_item") {
      const name_node = node.childForFieldName?.("name");
      if (name_node) {
        // Return trait name for lookup (not ID with location)
        return name_node.text as SymbolName;
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }

  return undefined;
}

export function extract_enum_variants(node: SyntaxNode): SymbolName[] {
  const variants: SymbolName[] = [];

  // Find the enum_item node if we're at a child
  let enum_node: SyntaxNode | null = node;
  while (enum_node && enum_node.type !== "enum_item") {
    enum_node = enum_node.parent;
  }

  if (!enum_node) {
    return variants;
  }

  // Look for the body field
  for (const child of enum_node.children || []) {
    if (child.type === "enum_variant_list") {
      for (const variant of child.children || []) {
        if (variant.type === "enum_variant") {
          // Get the variant name - it might be a direct child or in a name field
          const name_node = variant.children?.find(
            (c) => c.type === "identifier"
          );
          if (name_node) {
            variants.push(name_node.text as SymbolName);
          }
        }
      }
      break;
    }
  }

  return variants;
}

export function is_associated_function(node: SyntaxNode): boolean {
  // Check if function has self parameter
  const params = node.childForFieldName?.("parameters");

  if (params) {
    for (const child of params.children || []) {
      if (child.type === "self_parameter" || is_self_parameter(child)) {
        return false; // Has self, so it's a method not an associated function
      }
    }
  }

  // No self parameter means it's an associated function (static)
  return true;
}

export function find_containing_callable(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node.parent;
  const file_path = capture.location.file_path;

  while (node) {
    // Function items
    if (node.type === "function_item") {
      const name_node = node.childForFieldName?.("name");
      if (!name_node) return undefined;

      // Check if this function is inside an impl block or trait
      let ancestor = node.parent;
      while (ancestor) {
        if (ancestor.type === "impl_item" || ancestor.type === "trait_item") {
          // This is a method, not a standalone function
          return method_symbol(name_node.text as SymbolName, {
            file_path,
            start_line: node.startPosition.row + 1,
            start_column: node.startPosition.column + 1,
            end_line: node.endPosition.row + 1,
            end_column: node.endPosition.column,
          });
        }
        ancestor = ancestor.parent;
      }

      // It's a standalone function
      return function_symbol(name_node.text as SymbolName, {
        file_path,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column,
      });
    }

    // Check if this is a method in impl block or trait
    if (node.type === "impl_item" || node.type === "trait_item") {
      // The parameter is directly in a method, look for the function_item sibling
      let function_node: SyntaxNode | null = node;
      while (function_node && function_node.type !== "function_item") {
        // Look in children for function_item
        const func_child = function_node.children?.find(
          (c) => c.type === "function_item"
        );
        if (func_child) {
          function_node = func_child;
          break;
        }
        // Move to parent
        function_node = function_node.parent || null;
      }

      if (function_node?.type === "function_item") {
        const name_node = function_node.childForFieldName?.("name");
        if (!name_node) return undefined;

        return method_symbol(name_node.text as SymbolName, {
          file_path,
          start_line: function_node.startPosition.row + 1,
          start_column: function_node.startPosition.column + 1,
          end_line: function_node.endPosition.row + 1,
          end_column: function_node.endPosition.column,
        });
      }
    }

    // Trait method signatures (function_signature_item in traits)
    if (node.type === "function_signature_item") {
      const name_node = node.childForFieldName?.("name");
      if (!name_node) return undefined;

      // Use full function_signature_item node location to match create_method_id
      return method_symbol(name_node.text as SymbolName, {
        file_path,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column,
      });
    }

    // Closure expressions - use location-based anonymous symbol
    if (node.type === "closure_expression") {
      return anonymous_function_symbol({
        file_path,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column,
      });
    }

    node = node.parent;
  }

  return undefined;
}

/**
 * Detect if a variable/constant declaration contains a function collection.
 * Returns collection metadata if detected, null otherwise.
 *
 * Patterns detected:
 * - const CONFIG: Vec<fn()> = vec![handler1, handler2];
 * - let handlers = [fn1, fn2, fn3];
 * - const map: HashMap<&str, fn()> = HashMap::from([("key", handler)]);
 *
 * Note: Rust's function collections are more complex due to strong typing.
 * We focus on detecting:
 * - Array expressions with closures/function pointers
 * - Vec/HashMap macro invocations with functions
 */
export function detect_function_collection(
  node: SyntaxNode,
  file_path: FilePath
): FunctionCollectionInfo | null {
  // Get the let_declaration node which contains name and value
  let declaration = node;
  if (node.type === "let_declaration" || node.type === "const_item") {
    // node is already the declaration
  } else {
    // Try to find declaration from identifier
    declaration = node.parent || node;
  }

  // Get the initializer/value
  const value_node = declaration.childForFieldName?.("value");
  if (!value_node) return null;

  // Check for array expression: [fn1, fn2, fn3]
  if (value_node.type === "array_expression") {
    const { functions, references } = extract_functions_from_array(value_node, file_path);
    if (functions.length > 0 || references.length > 0) {
      return {
        collection_type: "Array",
        location: node_to_location(value_node, file_path),
        stored_functions: functions,
        stored_references: references,
      };
    }
  }

  // Check for macro invocation: vec![...], hashmap!{...}, etc.
  if (value_node.type === "macro_invocation") {
    const macro_name_node = value_node.childForFieldName?.("macro");
    const macro_name = macro_name_node?.text;

    if (macro_name === "vec" || macro_name === "Vec") {
      // Use the token tree (arguments) to avoid capturing the macro name
      const token_tree = value_node.children.find(c => c.type === "token_tree") || value_node;
      const { functions, references } = extract_functions_from_macro(token_tree, file_path);
      if (functions.length > 0 || references.length > 0) {
        return {
          collection_type: "Array",
          location: node_to_location(value_node, file_path),
          stored_functions: functions,
          stored_references: references,
        };
      }
    }

    if (macro_name === "hashmap" || macro_name === "HashMap") {
      const { functions, references } = extract_functions_from_macro(value_node, file_path);
      if (functions.length > 0 || references.length > 0) {
        return {
          collection_type: "Map",
          location: node_to_location(value_node, file_path),
          stored_functions: functions,
          stored_references: references,
        };
      }
    }
  }

  return null;
}

/**
 * Extract function SymbolIds from Rust array expression: [fn1, fn2, fn3]
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

    if (element.type === "closure_expression") {
      const location = node_to_location(element, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (element.type === "identifier") {
      references.push(element.text as SymbolName);
    }
  }

  return { functions: function_ids, references };
}

/**
 * Extract function SymbolIds from Rust macro invocation.
 * Searches for closure_expression nodes within the macro.
 */
function extract_functions_from_macro(
  macro_node: SyntaxNode,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[] } {
  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];

  // Traverse all descendants looking for closure_expression nodes
  function visit(node: SyntaxNode) {
    if (node.type === "closure_expression") {
      const location = node_to_location(node, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (node.type === "identifier") {
      // Check if parent is part of the collection structure (arg list, etc.)
      // This is a heuristic; might capture too much but safe for resolution candidates
      references.push(node.text as SymbolName);
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) visit(child);
    }
  }

  visit(macro_node);
  return { functions: function_ids, references };
}

/**
 * Extract the name of the collection variable this definition was looked up from.
 * Used for collection dispatch - when a variable is assigned from a Map/HashMap lookup.
 *
 * Patterns detected:
 * 1. let handler = config.get("key");  -> returns "config"
 * 2. let handler = config["key"];      -> returns "config"
 */
export function extract_collection_source(node: SyntaxNode): SymbolName | undefined {
  // Get initial value node (right side of assignment)
  let assignment = node;
  if (node.type === "identifier") {
    assignment = node.parent || node;
  }

  // Handle let_declaration: let x = ...
  if (assignment.type === "let_declaration" || assignment.type === "const_item") {
    const value_node = assignment.childForFieldName?.("value");
    if (!value_node) return undefined;

    // Case 1: Method call (config.get(...))
    if (value_node.type === "call_expression") {
      const function_node = value_node.childForFieldName?.("function");
      if (function_node?.type === "field_expression") {
        const value = function_node.childForFieldName?.("value");
        const field = function_node.childForFieldName?.("field");
        
        if (value?.type === "identifier" && field?.text === "get") {
          return value.text as SymbolName;
        }
      }
    }

    // Case 2: Index access (config["key"])
    if (value_node.type === "index_expression") {
      let operand = value_node.childForFieldName?.("operand");
      if (!operand) {
        // Fallback to first child if field name is not available
        operand = value_node.child(0) || null;
      }
      
      if (operand?.type === "identifier") {
        return operand.text as SymbolName;
      }
    }
  }

  return undefined;
}
