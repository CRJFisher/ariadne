/**
 * Python metadata extractors for the 4-pass semantic indexer.
 *
 * All extraction is tree-sitter AST-based: no type inference or cross-file
 * resolution happens here.
 */

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath, SelfReferenceKeyword } from "@ariadnejs/types";
import { type_symbol } from "@ariadnejs/types";
import type { MetadataExtractors, ReceiverInfo } from "./types";
import { node_to_location } from "../../node_to_location";

function extract_python_type(node: SyntaxNode | null | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (node.type === "type") {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type !== ":") {
        return child.text;
      }
    }
    return node.text;
  }

  if (node.type === "identifier" || node.type === "type_identifier") {
    return node.text;
  }

  if (node.type === "generic_type" || node.type === "subscript") {
    return node.text;
  }

  // Python 3.10+ union syntax (`str | int`) parses as a binary_operator.
  if (node.type === "binary_operator" && node.text.includes("|")) {
    return node.text;
  }

  if (node.type === "typed_parameter" || node.type === "typed_default_parameter") {
    const type_node = node.childForFieldName("type");
    if (type_node) {
      return type_node.text;
    }
  }

  if (node.type === "function_definition") {
    const return_type_node = node.childForFieldName("return_type");
    if (return_type_node) {
      return return_type_node.text;
    }
  }

  // In Python's grammar, `x: int = 5` is an assignment node with a "type" field.
  if (node.type === "assignment" || node.type === "annotated_assignment") {
    const type_node = node.childForFieldName("type");
    if (type_node) {
      return type_node.text;
    }
  }

  return undefined;
}

export const PYTHON_METADATA_EXTRACTORS: MetadataExtractors = {
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined {
    const type_name = extract_python_type(node);

    if (!type_name) {
      return undefined;
    }

    const location = node_to_location(node, file_path);
    const type_id = type_symbol(type_name as SymbolName, location);

    const is_nullable =
      type_name.includes("None") ||
      type_name.includes("Optional") ||
      type_name.includes("| None");

    return {
      type_id,
      type_name: type_name as SymbolName,
      certainty: "declared",
      is_nullable,
    };
  },

  /**
   * Extract receiver location from a method call, i.e. the object a method is
   * called on. For `a.b.c.method()` the receiver is the whole `a.b.c` chain.
   */
  extract_call_receiver(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): Location | undefined {
    if (!node) {
      return undefined;
    }

    if (node.type === "call") {
      const function_node = node.childForFieldName("function");

      if (function_node && function_node.type === "attribute") {
        const object_node = function_node.childForFieldName("object");
        if (object_node) {
          return node_to_location(object_node, file_path);
        }
      }
    }

    if (node.type === "attribute") {
      const object_node = node.childForFieldName("object");
      if (object_node) {
        return node_to_location(object_node, file_path);
      }
    }

    return undefined;
  },

  /**
   * Extract the left-to-right property access chain from an attribute/subscript/call node.
   * `a.b.c.d` → ["a", "b", "c", "d"]; string subscript keys are included
   * (`obj['key'].prop` → ["obj", "key", "prop"]) while numeric/variable keys are dropped.
   */
  extract_property_chain(node: SyntaxNode | null | undefined): SymbolName[] | undefined {
    if (!node) {
      return undefined;
    }

    const chain: string[] = [];

    function traverse(current: SyntaxNode): void {
      if (current.type === "attribute") {
        const object_node = current.childForFieldName("object");
        const attr_node = current.childForFieldName("attribute");

        if (object_node) {
          if (object_node.type === "attribute" || object_node.type === "subscript") {
            traverse(object_node);
          } else if (object_node.type === "identifier") {
            chain.push(object_node.text);
          } else if (object_node.type === "call" && object_node.text.startsWith("super()")) {
            chain.push("super");
          }
        }

        if (attr_node && attr_node.type === "identifier") {
          chain.push(attr_node.text);
        }
      } else if (current.type === "subscript") {
        const value_node = current.childForFieldName("value");
        const subscript_node = current.childForFieldName("subscript");

        if (value_node) {
          if (value_node.type === "attribute" || value_node.type === "subscript") {
            traverse(value_node);
          } else if (value_node.type === "identifier") {
            chain.push(value_node.text);
          }
        }

        // Only string keys are meaningful chain segments; strip the surrounding quotes.
        if (subscript_node && subscript_node.type === "string") {
          const text = subscript_node.text;
          if (text.startsWith("\"") || text.startsWith("'")) {
            const key = text.slice(1, -1);
            chain.push(key);
          }
        }
      } else if (current.type === "call") {
        const function_node = current.childForFieldName("function");
        if (function_node && (function_node.type === "attribute" || function_node.type === "subscript")) {
          traverse(function_node);
        }
      }
    }

    traverse(node);

    return chain.length > 0 ? chain.map(name => name as SymbolName) : undefined;
  },

  /**
   * Extract receiver information, flagging `self`/`cls`/`super()` as self-references.
   * `self.method()` → is_self_reference true, self_keyword "self";
   * `user.get_name()` → is_self_reference false.
   */
  extract_receiver_info(
    node: SyntaxNode,
    file_path: FilePath
  ): ReceiverInfo | undefined {
    let target_node = node;
    if (node.type === "call") {
      const function_node = node.childForFieldName("function");
      if (function_node) {
        target_node = function_node;
      }
    }

    if (target_node.type === "attribute") {
      const object_node = target_node.childForFieldName("object");
      const attr_node = target_node.childForFieldName("attribute");

      if (!object_node) return undefined;

      const attr_name = attr_node?.text;
      const object_text = object_node.text;

      if (object_node.type === "identifier") {
        if (object_text === "self") {
          return {
            receiver_location: node_to_location(object_node, file_path),
            property_chain: attr_name
              ? ["self" as SymbolName, attr_name as SymbolName]
              : ["self" as SymbolName],
            is_self_reference: true,
            self_keyword: "self",
          };
        }

        if (object_text === "cls") {
          return {
            receiver_location: node_to_location(object_node, file_path),
            property_chain: attr_name
              ? ["cls" as SymbolName, attr_name as SymbolName]
              : ["cls" as SymbolName],
            is_self_reference: true,
            self_keyword: "cls",
          };
        }
      }

      if (object_node.type === "call" && object_node.text.startsWith("super()")) {
        return {
          receiver_location: node_to_location(object_node, file_path),
          property_chain: attr_name
            ? ["super" as SymbolName, attr_name as SymbolName]
            : ["super" as SymbolName],
          is_self_reference: true,
          self_keyword: "super",
        };
      }

      // Nested receivers like self.db.query() need the full parsed chain.
      const chain = PYTHON_METADATA_EXTRACTORS.extract_property_chain(target_node);

      if (chain && chain.length > 0) {
        const SELF_KEYWORDS: Record<string, SelfReferenceKeyword> = {
          self: "self",
          cls: "cls",
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

      return {
        receiver_location: node_to_location(object_node, file_path),
        property_chain: attr_name
          ? [object_text as SymbolName, attr_name as SymbolName]
          : [object_text as SymbolName],
        is_self_reference: false,
      };
    }

    return undefined;
  },

  /**
   * Extract assignment source and target locations. In Python's grammar an
   * annotated assignment (`x: int = 5`) is an `assignment` node with a "type"
   * field, so the `annotated_assignment` branch below covers only grammars that
   * emit a distinct node.
   */
  extract_assignment_parts(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): { source: Location | undefined; target: Location | undefined } {
    if (!node) {
      return { source: undefined, target: undefined };
    }

    if (node.type === "assignment") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    if (node.type === "annotated_assignment") {
      const target_node = node.childForFieldName("target");
      const value_node = node.childForFieldName("value");

      return {
        target: target_node ? node_to_location(target_node, file_path) : undefined,
        source: value_node ? node_to_location(value_node, file_path) : undefined,
      };
    }

    if (node.type === "augmented_assignment") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    // Walrus operator (`x := value`).
    if (node.type === "named_expression") {
      const name = node.childForFieldName("name");
      const value = node.childForFieldName("value");

      return {
        target: name ? node_to_location(name, file_path) : undefined,
        source: value ? node_to_location(value, file_path) : undefined,
      };
    }

    return { source: undefined, target: undefined };
  },

  /**
   * Extract the assignment target that receives a constructor call. Python
   * constructors are ordinary calls, so this walks up from the call node to the
   * enclosing assignment/annotated-assignment/walrus and returns its target,
   * yielding the variable's type without inference (`x = Y()` → `x` is a `Y`).
   */
  extract_construct_target(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): Location | undefined {
    if (!node) {
      return undefined;
    }

    let parent = node.parent;
    while (parent) {
      if (parent.type === "assignment") {
        const left = parent.childForFieldName("left");
        if (left) {
          return node_to_location(left, file_path);
        }
        break;
      }

      if (parent.type === "annotated_assignment") {
        const target_node = parent.childForFieldName("target");
        if (target_node) {
          return node_to_location(target_node, file_path);
        }
        break;
      }

      if (parent.type === "named_expression") {
        const name = parent.childForFieldName("name");
        if (name) {
          return node_to_location(name, file_path);
        }
        break;
      }

      parent = parent.parent;
    }

    return undefined;
  },

  /**
   * Extract the top-level generic type arguments, keeping nested generics whole.
   * `Dict[str, int]` → ["str", "int"]; `List[Dict[str, int]]` → ["Dict[str, int]"];
   * `Callable[[int, str], bool]` → ["[int, str]", "bool"].
   */
  extract_type_arguments(node: SyntaxNode | null | undefined): string[] | undefined {
    if (!node) {
      return undefined;
    }

    const args: string[] = [];

    if (node.type === "generic_type") {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child && child.type === "type_parameter") {
          for (let j = 0; j < child.namedChildCount; j++) {
            const type_child = child.namedChild(j);
            if (type_child && type_child.type === "type") {
              args.push(type_child.text);
            }
          }
        }
      }
    }

    if (node.type === "subscript") {
      const subscript_node = node.childForFieldName("subscript");
      if (subscript_node) {
        if (subscript_node.type === "tuple") {
          for (let i = 0; i < subscript_node.childCount; i++) {
            const child = subscript_node.child(i);
            if (child && child.type !== "," && child.type !== "(" && child.type !== ")") {
              args.push(child.text);
            }
          }
        } else {
          args.push(subscript_node.text);
        }
      }
    }

    // Text fallback for shapes the node walks above miss; depth tracking keeps
    // Callable's inner `[int, str]` from splitting at its inner comma.
    if (args.length === 0) {
      const text = node.text;
      const match = text.match(/\w+\[([^\]]+)\]/);
      if (match) {
        const type_arg_string = match[1];
        if (type_arg_string.includes("[") && type_arg_string.includes("]")) {
          const parts: string[] = [];
          let current = "";
          let depth = 0;
          for (const char of type_arg_string) {
            if (char === "[") depth++;
            else if (char === "]") depth--;
            else if (char === "," && depth === 0) {
              parts.push(current.trim());
              current = "";
              continue;
            }
            current += char;
          }
          if (current.trim()) {
            parts.push(current.trim());
          }
          args.push(...parts);
        } else {
          const type_args = type_arg_string.split(",").map(arg => arg.trim());
          args.push(...type_args);
        }
      }
    }

    return args.length > 0 ? args : undefined;
  },

  // Python has no optional chaining syntax.
  extract_is_optional_chain(_node: SyntaxNode): boolean {
    return false;
  },

  // A method call is a call whose function is an attribute access (`obj.m()`).
  is_method_call(node: SyntaxNode): boolean {
    if (node.type === "call") {
      const function_node = node.childForFieldName("function");
      if (function_node && function_node.type === "attribute") {
        return true;
      }
    }
    return false;
  },

  extract_call_name(node: SyntaxNode): SymbolName | undefined {
    if (node.type === "call") {
      const function_node = node.childForFieldName("function");

      if (function_node) {
        if (function_node.type === "attribute") {
          const attribute_node = function_node.childForFieldName("attribute");
          if (attribute_node) {
            return attribute_node.text as SymbolName;
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