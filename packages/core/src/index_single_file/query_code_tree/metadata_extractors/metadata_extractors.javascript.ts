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
import type { MetadataExtractors, ReceiverInfo } from "./types";
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
   * The receiver location enables looking up the receiver's type to determine
   * which class defines the method.
   */
  extract_call_receiver(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined {
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");

      if (function_node && function_node.type === "member_expression") {
        const object_node = function_node.childForFieldName("object");
        if (object_node) {
          return node_to_location(object_node, file_path);
        }
      }
    }

    if (node.type === "member_expression") {
      const object_node = node.childForFieldName("object");
      if (object_node) {
        return node_to_location(object_node, file_path);
      }
    }

    return undefined;
  },

  /**
   * The ordered access chain (root object first) lets chained method calls
   * resolve against the full path rather than just the immediate receiver.
   */
  extract_property_chain(node: SyntaxNode): SymbolName[] | undefined {
    const chain: string[] = [];

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
            chain.push(object_node.text);
          }
        }

        if (property_node && property_node.type === "property_identifier") {
          chain.push(property_node.text);
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
            chain.push(object_node.text);
          }
        }

        // Only static string keys contribute a resolvable name; dynamic indices
        // are dropped from the chain.
        if (index_node && index_node.type === "string") {
          if (index_node.text.startsWith("\"") || index_node.text.startsWith("'")) {
            const prop = index_node.text.slice(1, -1);
            chain.push(prop);
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

    return chain.length > 0 ? chain.map(name => name as SymbolName) : undefined;
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

      const object_chain = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(target_node);

      const chain = object_chain || (property_name
        ? [object_node.text as SymbolName, property_name as SymbolName]
        : [object_node.text as SymbolName]);

      // A self keyword can sit at the root of a nested chain (this.data.items.push()).
      const SELF_KEYWORDS: Record<string, "this" | "super"> = {
        this: "this",
        super: "super",
      };
      const keyword = SELF_KEYWORDS[chain[0]];

      return {
        receiver_location: node_to_location(object_node, file_path),
        property_chain: chain,
        is_self_reference: keyword !== undefined,
        ...(keyword ? { self_keyword: keyword } : {}),
      };
    }

    return undefined;
  },

  extract_assignment_parts(
    node: SyntaxNode,
    file_path: FilePath
  ): { source: Location | undefined; target: Location | undefined } {
    if (node.type === "assignment_expression") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    if (node.type === "variable_declarator") {
      const name = node.childForFieldName("name");
      const value = node.childForFieldName("value");

      return {
        target: name ? node_to_location(name, file_path) : undefined,
        source: value ? node_to_location(value, file_path) : undefined,
      };
    }

    if (node.type === "augmented_assignment_expression") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    return { source: undefined, target: undefined };
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

  extract_type_arguments(node: SyntaxNode): string[] | undefined {
    const args: string[] = [];

    if (node.type === "generic_type" || node.type === "type_identifier") {
      const type_args = node.childForFieldName("type_arguments");
      if (type_args) {
        for (let i = 0; i < type_args.childCount; i++) {
          const child = type_args.child(i);
          if (child && child.type !== "," && child.type !== "<" && child.type !== ">") {
            args.push(child.text);
          }
        }
      }
    }

    // JSDoc encodes generics as Array.<Type> / Object.<Key, Value> in comment text.
    const text = node.text;
    const jsdoc_match = text.match(/[A-Z]\w*\.<([^>]+)>/);
    if (jsdoc_match) {
      const type_arg_string = jsdoc_match[1];
      const type_args = type_arg_string.split(",").map(arg => arg.trim());
      args.push(...type_args);
    }

    return args.length > 0 ? args : undefined;
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