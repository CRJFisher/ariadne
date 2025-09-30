/**
 * JavaScript/TypeScript metadata extraction functions
 *
 * Implements language-specific metadata extraction from tree-sitter AST nodes
 * for JavaScript, handling JSDoc annotations, property chains, method calls,
 * and various JavaScript-specific patterns.
 */

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath, SymbolId } from "@ariadnejs/types";
import { type_symbol } from "@ariadnejs/types";
import type { MetadataExtractors } from "./metadata_types";

/**
 * Extract location from a tree-sitter node
 */
function node_to_location(node: SyntaxNode, file_path: FilePath): Location {
  return {
    file_path,
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column,
  };
}

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
  let statementNode: SyntaxNode | null = null;

  // For variable_declarator, get the parent statement
  if (node.type === "variable_declarator") {
    // variable_declarator -> lexical_declaration
    statementNode = node.parent;
  } else if (node.type === "function_declaration") {
    statementNode = node;
  } else {
    statementNode = node;
  }

  // Check for preceding comment
  if (statementNode) {
    // Get index of statement in parent
    const parent = statementNode.parent;
    if (parent) {
      for (let i = 0; i < parent.childCount; i++) {
        const child = parent.child(i);
        if (child === statementNode && i > 0) {
          // Check previous sibling
          const prevChild = parent.child(i - 1);
          if (prevChild && prevChild.type === "comment") {
            const text = prevChild.text;

            // Match @type {TypeName}
            const typeMatch = text.match(/@type\s*\{([^}]+)\}/);
            if (typeMatch) {
              return typeMatch[1].trim();
            }

            // Match @returns {TypeName}
            const returnsMatch = text.match(/@returns?\s*\{([^}]+)\}/);
            if (returnsMatch) {
              return returnsMatch[1].trim();
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
  const typeAnnotation = node.childForFieldName("type");
  if (typeAnnotation) {
    // Handle simple type identifiers
    if (typeAnnotation.type === "type_identifier") {
      return typeAnnotation.text;
    }

    // Handle predefined types (string, number, boolean, etc.)
    if (typeAnnotation.type === "predefined_type") {
      return typeAnnotation.text;
    }

    // Handle generic types like Array<T>
    if (typeAnnotation.type === "generic_type") {
      return typeAnnotation.text;
    }

    // Handle union types, intersection types, etc.
    return typeAnnotation.text;
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

    return {
      type_id,
      type_name: type_name as SymbolName,
      certainty: node.type.includes("type_annotation") ? "declared" : "inferred",
      is_nullable: type_name.includes("null") || type_name.includes("undefined"),
    };
  },

  /**
   * Extract receiver location from method call
   *
   * Handles:
   * - `obj.method()` → location of `obj`
   * - `this.method()` → location of `this`
   * - `super.method()` → location of `super`
   * - `a.b.c.method()` → location of `a.b.c`
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
   * Handles:
   * - `a.b.c.d` → ["a", "b", "c", "d"]
   * - `this.data.items` → ["this", "data", "items"]
   * - `obj?.prop?.method` → ["obj", "prop", "method"]
   */
  extract_property_chain(node: SyntaxNode): SymbolName[] | undefined {
    const chain: string[] = [];

    function traverse(current: SyntaxNode): void {
      if (current.type === "member_expression" || current.type === "optional_chain") {
        const object_node = current.childForFieldName("object");
        const property_node = current.childForFieldName("property");

        // Recursively traverse nested member expressions
        if (object_node) {
          if (object_node.type === "member_expression" || object_node.type === "optional_chain") {
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
          if (object_node.type === "member_expression" || object_node.type === "subscript_expression") {
            traverse(object_node);
          } else if (object_node.type === "identifier") {
            chain.push(object_node.text);
          }
        }

        // For computed properties, try to extract string literals
        if (index_node && index_node.type === "string" && index_node.text.startsWith('"')) {
          // Extract string content without quotes
          const prop = index_node.text.slice(1, -1);
          chain.push(prop);
        }
      } else if (current.type === "call_expression") {
        // For method calls, extract the chain from the function part
        const function_node = current.childForFieldName("function");
        if (function_node && (function_node.type === "member_expression" || function_node.type === "optional_chain")) {
          traverse(function_node);
        }
      }
    }

    traverse(node);

    return chain.length > 0 ? chain.map(name => name as SymbolName) : undefined;
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
   * Handles:
   * - `const obj = new Class()` → location of `obj`
   * - `let x = new Map()` → location of `x`
   * - `this.prop = new Thing()` → location of `this.prop`
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
      const typeArgs = node.childForFieldName("type_arguments");
      if (typeArgs) {
        // Iterate through type argument children
        for (let i = 0; i < typeArgs.childCount; i++) {
          const child = typeArgs.child(i);
          if (child && child.type !== "," && child.type !== "<" && child.type !== ">") {
            args.push(child.text);
          }
        }
      }
    }

    // Handle JSDoc generics (Array.<Type> or Object.<Key, Value>)
    const text = node.text;
    const jsdocMatch = text.match(/[A-Z]\w*\.<([^>]+)>/);
    if (jsdocMatch) {
      const typeArgString = jsdocMatch[1];
      const typeArgs = typeArgString.split(",").map(arg => arg.trim());
      args.push(...typeArgs);
    }

    return args.length > 0 ? args : undefined;
  },
};