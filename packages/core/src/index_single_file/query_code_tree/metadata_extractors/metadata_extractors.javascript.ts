/**
 * JavaScript/TypeScript metadata extraction functions
 *
 * Language-specific implementation of metadata extractors for method call resolution.
 * Extracts reference context and TypeInfo from JavaScript/TypeScript AST nodes.
 *
 * Supports:
 * - Type annotations: TypeScript type_annotation and JSDoc comments
 * - Method calls: Extracts receiver location from member_expression patterns
 * - Property chains: Recursive traversal of member_expression and optional_chain
 * - Constructor tracking: Finds target variables in new_expression patterns
 * - Optional chaining: Detects ?. syntax in method and property access
 *
 * All extraction is purely tree-sitter AST-based - no type inference or
 * cross-file resolution happens here.
 */

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath } from "@ariadnejs/types";
import { type_symbol } from "@ariadnejs/types";
import type { MetadataExtractors, ReceiverInfo } from "./types";
import { node_to_location } from "../../node_utils";


/**
 * Extract JSDoc type annotation from comment
 *
 * Handles patterns like:
 * - `@type {string}`
 * - `@param {number} x`
 * - `@returns {boolean}`
 */
function extract_jsdoc_type(node: SyntaxNode): string | undefined {
  // Look for JSDoc comment in multiple locations
  let statement_node: SyntaxNode | null = null;

  // For variable_declarator, get the parent statement
  if (node.type === "variable_declarator") {
    // variable_declarator -> lexical_declaration
    statement_node = node.parent;
  } else if (node.type === "function_declaration") {
    statement_node = node;
  } else {
    statement_node = node;
  }

  // Check for preceding comment
  if (statement_node) {
    // Get index of statement in parent
    const parent = statement_node.parent;
    if (parent) {
      for (let i = 0; i < parent.childCount; i++) {
        const child = parent.child(i);
        if (child === statement_node && i > 0) {
          // Check previous sibling
          const prev_child = parent.child(i - 1);
          if (prev_child && prev_child.type === "comment") {
            const text = prev_child.text;

            // Match @type {TypeName}
            const type_match = text.match(/@type\s*\{([^}]+)\}/);
            if (type_match) {
              return type_match[1].trim();
            }

            // Match @returns {TypeName}
            const returns_match = text.match(/@returns?\s*\{([^}]+)\}/);
            if (returns_match) {
              return returns_match[1].trim();
            }
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Extract type from TypeScript type annotation
 */
function extract_typescript_type(node: SyntaxNode): string | undefined {
  // For TypeScript, look for type_annotation child
  const type_annotation = node.childForFieldName("type");
  if (type_annotation) {
    // TypeScript type_annotation nodes include the ':' character
    // We need to extract the actual type part after the ':'
    if (type_annotation.type === "type_annotation") {
      // Skip the ':' and get the actual type node
      for (let i = 0; i < type_annotation.childCount; i++) {
        const child = type_annotation.child(i);
        if (child && child.type !== ":") {
          return child.text;
        }
      }
      // Fallback: remove leading ':' and whitespace
      return type_annotation.text.replace(/^:\s*/, "");
    }

    // Handle simple type identifiers
    if (type_annotation.type === "type_identifier") {
      return type_annotation.text;
    }

    // Handle predefined types (string, number, boolean, etc.)
    if (type_annotation.type === "predefined_type") {
      return type_annotation.text;
    }

    // Handle generic types like Array<T>
    if (type_annotation.type === "generic_type") {
      return type_annotation.text;
    }

    // Handle union types, intersection types, etc.
    return type_annotation.text;
  }

  return undefined;
}

/**
 * JavaScript metadata extractors implementation
 */
export const JAVASCRIPT_METADATA_EXTRACTORS: MetadataExtractors = {
  /**
   * Extract type information from JSDoc or TypeScript annotations
   */
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined {
    let type_name: string | undefined;

    // Try TypeScript type annotation first
    type_name = extract_typescript_type(node);

    // Fall back to JSDoc
    if (!type_name) {
      type_name = extract_jsdoc_type(node);
    }

    if (!type_name) {
      return undefined;
    }

    // Create TypeInfo
    const location = node_to_location(node, file_path);
    const type_id = type_symbol(type_name, location);

    // Check if this is a declared TypeScript type (has type_annotation child)
    const has_type_annotation = node.childForFieldName("type")?.type === "type_annotation";

    return {
      type_id,
      type_name: type_name as SymbolName,
      certainty: has_type_annotation ? "declared" : "inferred",
      is_nullable: type_name.includes("null") || type_name.includes("undefined"),
    };
  },

  /**
   * Extract receiver location from method call
   *
   * Essential for method resolution - identifies the object a method is called on.
   * Navigates the AST to find the receiver (object) portion of a method call.
   *
   * Tree-sitter pattern:
   * ```
   * (call_expression
   *   function: (member_expression
   *     object: (_) @receiver    ← Extract this location
   *     property: (property_identifier)))
   * ```
   *
   * Handles:
   * - `obj.method()` → location of `obj`
   * - `this.method()` → location of `this`
   * - `super.method()` → location of `super`
   * - `a.b.c.method()` → location of `a.b.c` (entire chain except method name)
   *
   * The receiver location enables looking up the receiver's type to determine
   * which class defines the method.
   */
  extract_call_receiver(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined {
    // Handle call_expression
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");

      if (function_node && function_node.type === "member_expression") {
        const object_node = function_node.childForFieldName("object");
        if (object_node) {
          return node_to_location(object_node, file_path);
        }
      }
    }

    // Handle member_expression directly
    if (node.type === "member_expression") {
      const object_node = node.childForFieldName("object");
      if (object_node) {
        return node_to_location(object_node, file_path);
      }
    }

    return undefined;
  },

  /**
   * Extract property access chain
   *
   * Critical for chained method calls - builds complete sequence of accessed properties.
   * Recursively traverses member_expression, optional_chain, and subscript_expression nodes.
   *
   * Algorithm:
   * 1. Start with leftmost identifier (root object)
   * 2. Traverse each member access from left to right
   * 3. Build array of all property/method names in order
   *
   * Tree-sitter pattern (recursive):
   * ```
   * (member_expression
   *   object: (member_expression      ← Recurse here
   *     object: (identifier) @chain.0
   *     property: (property_identifier) @chain.1)
   *   property: (property_identifier) @chain.2)
   * ```
   *
   * Handles:
   * - `a.b.c.d` → ["a", "b", "c", "d"]
   * - `this.data.items` → ["this", "data", "items"]
   * - `obj?.prop?.method` → ["obj", "prop", "method"]
   * - `obj["computed"].method` → ["obj", "computed", "method"]
   *
   * Used for both method calls and property access to track the complete chain.
   */
  extract_property_chain(node: SyntaxNode): SymbolName[] | undefined {
    const chain: string[] = [];

    function traverse(current: SyntaxNode): void {
      if (current.type === "member_expression" || current.type === "optional_chain") {
        const object_node = current.childForFieldName("object");
        const property_node = current.childForFieldName("property");

        // Recursively traverse nested member expressions
        if (object_node) {
          if (object_node.type === "member_expression" ||
              object_node.type === "optional_chain" ||
              object_node.type === "subscript_expression") {
            traverse(object_node);
          } else if (object_node.type === "identifier" || object_node.type === "this" || object_node.type === "super") {
            chain.push(object_node.text);
          }
        }

        // Add the property
        if (property_node && property_node.type === "property_identifier") {
          chain.push(property_node.text);
        }
      } else if (current.type === "subscript_expression") {
        // Handle bracket notation like obj["prop"]
        const object_node = current.childForFieldName("object");
        const index_node = current.childForFieldName("index");

        if (object_node) {
          if (object_node.type === "member_expression" ||
              object_node.type === "subscript_expression" ||
              object_node.type === "optional_chain") {
            traverse(object_node);
          } else if (object_node.type === "identifier" || object_node.type === "this" || object_node.type === "super") {
            chain.push(object_node.text);
          }
        }

        // For computed properties, try to extract string literals
        if (index_node && index_node.type === "string") {
          // Extract string content without quotes (handle both single and double quotes)
          if (index_node.text.startsWith("\"") || index_node.text.startsWith("'")) {
            const prop = index_node.text.slice(1, -1);
            chain.push(prop);
          }
        }
      } else if (current.type === "call_expression") {
        // For method calls, extract the chain from the function part
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
   * Extract receiver information with self-reference keyword detection
   *
   * Detects `this` and `super` keywords in JavaScript/TypeScript and returns
   * enriched information about the receiver, including whether it's a self-reference.
   *
   * Examples:
   * - `this.method()` → is_self_reference: true, keyword: 'this'
   * - `user.getName()` → is_self_reference: false
   * - `super.process()` → is_self_reference: true, keyword: 'super'
   */
  extract_receiver_info(
    node: SyntaxNode,
    file_path: FilePath
  ): ReceiverInfo | undefined {
    // Handle call_expression: extract from function field
    let target_node = node;
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");
      if (function_node) {
        target_node = function_node;
      }
    }

    // Handle member_expression or optional_chain
    if (target_node.type === "member_expression" || target_node.type === "optional_chain") {
      const object_node = target_node.childForFieldName("object");
      const property_node = target_node.childForFieldName("property");

      if (!object_node) return undefined;

      const property_name = property_node?.text;

      // Detect self-reference keywords
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

      // Regular object receiver (not a keyword)
      // Use extract_property_chain for nested receivers like obj.prop.method()
      const object_chain = JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain(target_node);

      // Fallback: if chain extraction failed, use simple receiver + property
      const chain = object_chain || (property_name
        ? [object_node.text as SymbolName, property_name as SymbolName]
        : [object_node.text as SymbolName]);

      return {
        receiver_location: node_to_location(object_node, file_path),
        property_chain: chain,
        is_self_reference: false,
      };
    }

    return undefined;
  },

  /**
   * Extract assignment source and target locations
   *
   * Handles:
   * - `x = y` → target: x, source: y
   * - `const x = getValue()` → target: x, source: getValue()
   * - `obj.prop = value` → target: obj.prop, source: value
   * - Destructuring: `const {a, b} = obj` → target: {a, b}, source: obj
   */
  extract_assignment_parts(
    node: SyntaxNode,
    file_path: FilePath
  ): { source: Location | undefined; target: Location | undefined } {
    // Handle assignment_expression
    if (node.type === "assignment_expression") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    // Handle variable_declarator (const x = ...)
    if (node.type === "variable_declarator") {
      const name = node.childForFieldName("name");
      const value = node.childForFieldName("value");

      return {
        target: name ? node_to_location(name, file_path) : undefined,
        source: value ? node_to_location(value, file_path) : undefined,
      };
    }

    // Handle augmented_assignment_expression (x += y)
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
   * Extract constructor call target variable
   *
   * Essential for type tracking - most reliable way to determine object types.
   * Navigates from new_expression to the variable being assigned to.
   *
   * Tree-sitter pattern:
   * ```
   * (variable_declarator
   *   name: (identifier) @construct.target    ← Extract this location
   *   value: (new_expression
   *     constructor: (identifier) @construct.class))
   * ```
   *
   * Also handles assignment expressions:
   * ```
   * (assignment_expression
   *   left: (_) @construct.target    ← Extract this location
   *   right: (new_expression))
   * ```
   *
   * Handles:
   * - `const obj = new Class()` → location of `obj`
   * - `let x = new Map()` → location of `x`
   * - `this.prop = new Thing()` → location of `this.prop`
   *
   * This enables immediate type determination: when we see `const x = new Y()`,
   * we know `x` has type `Y` without complex inference.
   */
  extract_construct_target(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined {
    // Look for parent variable_declarator
    let parent = node.parent;
    while (parent) {
      if (parent.type === "variable_declarator") {
        const name = parent.childForFieldName("name");
        if (name) {
          return node_to_location(name, file_path);
        }
        break;
      }

      // Handle assignment to property
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
   * Extract generic type arguments from JSDoc or TypeScript
   *
   * Handles:
   * - `Array<string>` → ["string"]
   * - `Map<string, number>` → ["string", "number"]
   * - JSDoc: `@type {Array.<string>}` → ["string"]
   * - JSDoc: `@type {Object.<string, number>}` → ["string", "number"]
   */
  extract_type_arguments(node: SyntaxNode): string[] | undefined {
    const args: string[] = [];

    // Handle TypeScript generic types
    if (node.type === "generic_type" || node.type === "type_identifier") {
      const type_args = node.childForFieldName("type_arguments");
      if (type_args) {
        // Iterate through type argument children
        for (let i = 0; i < type_args.childCount; i++) {
          const child = type_args.child(i);
          if (child && child.type !== "," && child.type !== "<" && child.type !== ">") {
            args.push(child.text);
          }
        }
      }
    }

    // Handle JSDoc generics (Array.<Type> or Object.<Key, Value>)
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
   * Check if a node represents optional chaining
   *
   * Detects optional chaining syntax (`?.`) in JavaScript/TypeScript.
   * Important for understanding null-safety semantics in method calls.
   *
   * Tree-sitter pattern:
   * ```
   * (optional_chain              ← Look for this node type
   *   object: (_)
   *   property: (_))
   * ```
   *
   * Algorithm:
   * 1. Check if node itself is `optional_chain` type
   * 2. For call_expression, check if function field is `optional_chain`
   * 3. For member_expression, recursively check children
   *
   * Detects optional chaining syntax (`?.`) in JavaScript/TypeScript:
   * - `obj?.method()` → true
   * - `obj.method()` → false
   * - `obj?.prop?.method()` → true
   * - `a.b?.c.d` → true (any part uses ?.)
   *
   * Returns true if any part of the access chain uses optional chaining.
   */
  extract_is_optional_chain(node: SyntaxNode): boolean {
    // Debug logging
    const debug = false; // Set to true to enable debug logging
    if (debug) {
      console.log(`[extract_is_optional_chain] node.type=${node.type}, text=${node.text.substring(0, 50)}`);
    }

    // Check if the node itself is an optional_chain
    if (node.type === "optional_chain") {
      if (debug) console.log("  -> Found optional_chain node directly");
      return true;
    }

    // For call_expression, check if the function part is optional_chain
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");
      if (debug && function_node) {
        console.log(`  -> call_expression function node type: ${function_node.type}`);
        // Debug: Check if there's an optional_chaining_operator or similar
        for (let i = 0; i < function_node.childCount; i++) {
          const child = function_node.child(i);
          if (child) {
            console.log(`    -> child ${i}: type=${child.type}, text="${child.text}"`);
          }
        }
      }
      if (function_node && function_node.type === "optional_chain") {
        if (debug) console.log("  -> Found optional_chain in function field");
        return true;
      }
      // Also recursively check if function_node has optional chaining
      if (function_node) {
        return JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(function_node);
      }
    }

    // For member_expression, check if it has an optional_chain child
    if (node.type === "member_expression") {
      // Check children for optional_chain token
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === "optional_chain") {
          if (debug) console.log("  -> Found optional_chain child in member_expression");
          return true;
        }
      }

      // Also check if nested member_expression has optional chaining
      const object_node = node.childForFieldName("object");
      if (object_node && object_node.type === "member_expression") {
        return JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain(object_node);
      }
    }

    if (debug) console.log("  -> No optional chaining found");
    return false;
  },

  /**
   * Check if a call node represents a method call
   *
   * JavaScript/TypeScript: call_expression with member_expression function
   *
   * @param node - The SyntaxNode representing a call
   * @returns true if it's a method call, false if it's a function call
   */
  is_method_call(node: SyntaxNode): boolean {
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");
      if (function_node && function_node.type === "member_expression") {
        return true;
      }
    }
    return false;
  },

  /**
   * Extract the method or function name from a call node
   *
   * For method calls, extracts the property name.
   * For function calls, extracts the function identifier.
   *
   * @param node - The SyntaxNode representing a call
   * @returns The name of the method or function, or undefined
   */
  extract_call_name(node: SyntaxNode): SymbolName | undefined {
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");

      if (function_node) {
        // Method call: extract property name from member_expression
        if (function_node.type === "member_expression") {
          const property_node = function_node.childForFieldName("property");
          if (property_node) {
            return property_node.text as SymbolName;
          }
        }
        // Function call: extract identifier
        else if (function_node.type === "identifier") {
          return function_node.text as SymbolName;
        }
      }
    }

    return undefined;
  },
};