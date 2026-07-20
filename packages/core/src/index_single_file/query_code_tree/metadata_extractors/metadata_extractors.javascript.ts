/**
 * JavaScript/TypeScript definition metadata extraction for the 4-pass semantic
 * indexer.
 *
 * All extraction is tree-sitter AST-based: no type inference or cross-file
 * resolution happens here.
 */

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath } from "@ariadnejs/types";
import { type_symbol } from "@ariadnejs/types";
import type { MetadataExtractors, ReceiverInfo } from "./metadata_extractor_types";
import { node_to_location } from "../../node_to_location";

/**
 * JSDoc carries types in a preceding comment rather than the AST, so the type
 * lives on the sibling immediately before the declaration statement.
 */
function extract_jsdoc_type(node: SyntaxNode): string | undefined {
  const statement_node = node.type === "variable_declarator" ? node.parent : node;
  if (!statement_node) return undefined;

  const parent = statement_node.parent;
  if (!parent) return undefined;

  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child === statement_node && i > 0) {
      const prev_child = parent.child(i - 1);
      if (prev_child && prev_child.type === "comment") {
        const text = prev_child.text;

        const type_match = text.match(/@type\s*\{([^}]+)\}/);
        if (type_match) {
          return type_match[1].trim();
        }

        const returns_match = text.match(/@returns?\s*\{([^}]+)\}/);
        if (returns_match) {
          return returns_match[1].trim();
        }
      }
    }
  }

  return undefined;
}

function extract_typescript_type(node: SyntaxNode): string | undefined {
  const type_annotation = node.childForFieldName("type");
  if (!type_annotation) return undefined;

  // A type_annotation node includes the leading ':'; the type is the first
  // non-':' child.
  if (type_annotation.type === "type_annotation") {
    for (let i = 0; i < type_annotation.childCount; i++) {
      const child = type_annotation.child(i);
      if (child && child.type !== ":") {
        return child.text;
      }
    }
    return type_annotation.text.replace(/^:\s*/, "");
  }

  return type_annotation.text;
}

/**
 * Positional identifier arguments of a call expression: each argument that is a
 * bare identifier becomes its name; anything else (literal, expression, spread)
 * becomes `null` so a later argument keeps its positional index.
 */
function extract_identifier_arguments(
  call_node: SyntaxNode
): (SymbolName | null)[] {
  const arguments_node = call_node.childForFieldName("arguments");
  if (!arguments_node) return [];
  return arguments_node.namedChildren.map((arg) =>
    arg.type === "identifier" ? (arg.text as SymbolName) : null
  );
}

/**
 * When `member_node` is the callee of a call expression (`obj.get(x)` — the
 * `obj.get` member is the call's `function`), the call's identifier arguments;
 * `null` for a plain property access. This pairs a chain step's method name
 * with the arguments passed where it is invoked.
 */
function call_arguments_of_callee(
  member_node: SyntaxNode
): (SymbolName | null)[] | null {
  const parent = member_node.parent;
  if (
    parent &&
    parent.type === "call_expression" &&
    parent.childForFieldName("function") === member_node
  ) {
    return extract_identifier_arguments(parent);
  }
  return null;
}

/**
 * The ordered access chain (root object first) plus, aligned index-for-index,
 * the call arguments at each chain position. Chained method calls resolve
 * against the full path, and an intermediate call's arguments (e.g. the `Token`
 * in `injector.get(Token).method()`) survive for generic-return inference.
 * Both arrays grow in lockstep — one `call_arguments` entry per pushed name.
 */
function build_property_chain(
  node: SyntaxNode
): { chain: SymbolName[]; call_arguments: (readonly (SymbolName | null)[] | null)[] } | undefined {
  const chain: SymbolName[] = [];
  const call_arguments: (readonly (SymbolName | null)[] | null)[] = [];

  function push(name: string, args: (SymbolName | null)[] | null): void {
    chain.push(name as SymbolName);
    call_arguments.push(args);
  }

  function traverse(current: SyntaxNode): void {
    if (current.type === "member_expression" || current.type === "optional_chain") {
      const object_node = current.childForFieldName("object");
      const property_node = current.childForFieldName("property");

      if (object_node) {
        if (object_node.type === "member_expression" ||
            object_node.type === "optional_chain" ||
            object_node.type === "subscript_expression" ||
            object_node.type === "call_expression") {
          traverse(object_node);
        } else if (object_node.type === "identifier" || object_node.type === "this" || object_node.type === "super") {
          push(object_node.text, null);
        }
      }

      if (property_node && property_node.type === "property_identifier") {
        push(property_node.text, call_arguments_of_callee(current));
      }
    } else if (current.type === "subscript_expression") {
      const object_node = current.childForFieldName("object");
      const index_node = current.childForFieldName("index");

      if (object_node) {
        if (object_node.type === "member_expression" ||
            object_node.type === "subscript_expression" ||
            object_node.type === "optional_chain" ||
            object_node.type === "call_expression") {
          traverse(object_node);
        } else if (object_node.type === "identifier" || object_node.type === "this" || object_node.type === "super") {
          push(object_node.text, null);
        }
      }

      // Only static string keys contribute a resolvable name; dynamic indices
      // are dropped from the chain.
      if (index_node && index_node.type === "string") {
        if (index_node.text.startsWith("\"") || index_node.text.startsWith("'")) {
          push(index_node.text.slice(1, -1), null);
        }
      }
    } else if (current.type === "call_expression") {
      const function_node = current.childForFieldName("function");
      if (function_node && (function_node.type === "member_expression" ||
                           function_node.type === "optional_chain" ||
                           function_node.type === "subscript_expression")) {
        traverse(function_node);
      }
    }
  }

  traverse(node);

  return chain.length > 0 ? { chain, call_arguments } : undefined;
}

export const JAVASCRIPT_METADATA_EXTRACTORS: MetadataExtractors = {
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined {
    const type_name = extract_typescript_type(node) ?? extract_jsdoc_type(node);

    if (!type_name) {
      return undefined;
    }

    const location = node_to_location(node, file_path);
    const type_id = type_symbol(type_name, location);

    // A declared TS annotation carries a type_annotation child; a JSDoc-inferred
    // type does not, which drives the certainty distinction.
    const has_type_annotation = node.childForFieldName("type")?.type === "type_annotation";

    return {
      type_id,
      type_name: type_name as SymbolName,
      certainty: has_type_annotation ? "declared" : "inferred",
      is_nullable: type_name.includes("null") || type_name.includes("undefined"),
    };
  },

  /**
   * The ordered access chain (root object first) lets chained method calls
   * resolve against the full path rather than just the immediate receiver.
   */
  extract_property_chain(node: SyntaxNode): SymbolName[] | undefined {
    return build_property_chain(node)?.chain;
  },

  /**
   * A `this`/`super` receiver resolves to the enclosing class rather than an
   * external symbol, so the receiver is tagged as a self-reference.
   */
  extract_receiver_info(
    node: SyntaxNode,
    file_path: FilePath
  ): ReceiverInfo | undefined {
    let target_node = node;
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");
      if (function_node) {
        target_node = function_node;
      }
    }

    if (target_node.type === "member_expression" || target_node.type === "optional_chain") {
      const object_node = target_node.childForFieldName("object");
      const property_node = target_node.childForFieldName("property");

      if (!object_node) return undefined;

      const property_name = property_node?.text;

      if (object_node.type === "this") {
        return {
          receiver_location: node_to_location(object_node, file_path),
          property_chain: property_name
            ? ["this" as SymbolName, property_name as SymbolName]
            : ["this" as SymbolName],
          is_self_reference: true,
          self_keyword: "this",
        };
      }

      if (object_node.type === "super") {
        return {
          receiver_location: node_to_location(object_node, file_path),
          property_chain: property_name
            ? ["super" as SymbolName, property_name as SymbolName]
            : ["super" as SymbolName],
          is_self_reference: true,
          self_keyword: "super",
        };
      }

      const built = build_property_chain(target_node);
      const object_chain = built?.chain;

      const chain = object_chain || (property_name
        ? [object_node.text as SymbolName, property_name as SymbolName]
        : [object_node.text as SymbolName]);

      // A self keyword can sit at the root of a nested chain (this.data.items.push()).
      const SELF_KEYWORDS: Record<string, "this" | "super"> = {
        this: "this",
        super: "super",
      };
      const keyword = SELF_KEYWORDS[chain[0]];

      // Carry chain arguments only when an intermediate position is a call with
      // an identifier argument — the raw material for generic-return inference.
      // Literal-only intermediate calls (add(5)) stay omitted so unrelated
      // method-call references keep their existing shape.
      const property_chain_arguments = built?.call_arguments;
      const has_inference_argument =
        property_chain_arguments !== undefined &&
        property_chain_arguments
          .slice(1, -1)
          .some((entry) => entry !== null && entry.some((arg) => arg !== null));

      return {
        receiver_location: node_to_location(object_node, file_path),
        property_chain: chain,
        is_self_reference: keyword !== undefined,
        ...(keyword ? { self_keyword: keyword } : {}),
        ...(has_inference_argument ? { property_chain_arguments } : {}),
      };
    }

    return undefined;
  },

  /**
   * `const x = new Y()` fixes x's type to Y without inference, so the assigned
   * target is the most reliable type signal. Walks up to the enclosing declarator
   * or assignment.
   */
  extract_construct_target(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined {
    let parent = node.parent;
    while (parent) {
      if (parent.type === "variable_declarator") {
        const name = parent.childForFieldName("name");
        if (name) {
          return node_to_location(name, file_path);
        }
        break;
      }

      if (parent.type === "assignment_expression") {
        const left = parent.childForFieldName("left");
        if (left) {
          return node_to_location(left, file_path);
        }
        break;
      }

      parent = parent.parent;
    }

    return undefined;
  },

  /**
   * True if any part of the access chain uses `?.`; optional chaining changes
   * the null-safety semantics of the call.
   */
  extract_is_optional_chain(node: SyntaxNode): boolean {
    if (node.type === "optional_chain") {
      return true;
    }

    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");
      if (function_node && function_node.type === "optional_chain") {
        return true;
      }
      if (function_node) {
        return JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(function_node);
      }
    }

    if (node.type === "member_expression") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === "optional_chain") {
          return true;
        }
      }

      const object_node = node.childForFieldName("object");
      if (object_node && object_node.type === "member_expression") {
        return JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(object_node);
      }
    }

    return false;
  },

  is_method_call(node: SyntaxNode): boolean {
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");
      if (function_node && function_node.type === "member_expression") {
        return true;
      }
    }
    return false;
  },

  extract_call_name(node: SyntaxNode): SymbolName | undefined {
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");

      if (function_node) {
        if (function_node.type === "member_expression") {
          const property_node = function_node.childForFieldName("property");
          if (property_node) {
            return property_node.text as SymbolName;
          }
        }
        else if (function_node.type === "identifier") {
          return function_node.text as SymbolName;
        }
      }
    }

    return undefined;
  },
};