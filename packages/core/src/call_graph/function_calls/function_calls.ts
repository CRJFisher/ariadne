/**
 * Function call detection using configuration-driven approach
 *
 * This module provides a single implementation that works for all languages
 * by using the configuration definitions from language_configs.ts
 */

import { SyntaxNode } from "tree-sitter";
import {
  FilePath,
  Language,
  SourceCode,
  FunctionCallInfo,
} from "@ariadnejs/types";
import { getLanguageConfig, LanguageCallConfig } from "./language_configs";
import { node_to_location } from "../../ast/node_utils";
import { handle_typescript_decorators } from "./function_calls.typescript";
import { handle_rust_macros } from "./function_calls.rust";
import { handle_python_comprehensions } from "./function_calls.python";

/**
 * Special constant for module-level calls (calls not within any function)
 */
export const MODULE_CONTEXT = "<module>";

/**
 * Context passed to all function call detection functions
 */
export interface FunctionCallContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
  // TODO: Integration points for cross-feature functionality
  // scope_tree?: ScopeTree;  // For symbol resolution
  // imports?: ImportInfo[];  // Already-resolved imports for this file
  // exports?: ExportInfo[];  // Already-detected exports for this file
  // type_map?: Map<string, TypeInfo>;  // Pre-computed type information
}

/**
 * Find all function calls in code
 *
 * Uses generic processor with configuration-driven approach for 86% of functionality.
 * Language-specific handlers are called for truly unique features that can't be
 * expressed through configuration.
 *
 * @param context The context containing source code, AST, and metadata
 * @returns Array of function call information
 */
export function find_function_calls(
  context: FunctionCallContext
): FunctionCallInfo[] {
  // Use generic processor for all languages
  const calls = find_function_calls_generic(context);

  // Apply language-specific enhancements for bespoke features
  switch (context.language) {
    case "typescript":
      // TypeScript decorators require special handling
      return enhance_with_typescript_features(calls, context);

    case "rust":
      // Rust macros are already handled in generic processor
      // but may need additional enhancement
      return enhance_with_rust_features(calls, context);

    case "python":
      // Python comprehensions may contain function calls
      return enhance_with_python_features(calls, context);

    case "javascript":
      // JavaScript is fully handled by generic processor
      return calls;

    default:
      // For any unsupported language, return what we found
      return calls;
  }
}

/**
 * Find all function calls using language configuration
 */
export function find_function_calls_generic(
  context: FunctionCallContext
): FunctionCallInfo[] {
  const config = getLanguageConfig(context.language);
  const calls: FunctionCallInfo[] = [];

  // Walk the AST to find all call expressions
  walk_tree(context.ast_root, (node) => {
    // Check if this is a call expression for this language
    if (config.call_expression_types.includes(node.type)) {
      // Skip call expressions that are direct children of decorators (TypeScript)
      // These will be handled by the bespoke decorator handler
      if (
        context.language === "typescript" &&
        node.parent?.type === "decorator"
      ) {
        return;
      }

      const call_info = extract_call_generic(node, context, config);
      if (call_info) {
        calls.push(call_info);
      }
    }
  });

  return calls;
}

/**
 * Generic call extraction using configuration
 */
function extract_call_generic(
  node: SyntaxNode,
  context: FunctionCallContext,
  config: LanguageCallConfig
): FunctionCallInfo | null {
  const callee_name = extract_callee_name_generic(
    node,
    context.source_code,
    config
  );
  if (!callee_name) return null;

  const caller_name =
    get_enclosing_function_generic(node, context.source_code, config) ||
    MODULE_CONTEXT;
  const is_method = is_method_call_generic(node, config);
  const is_constructor = is_constructor_call_generic(
    node,
    context.source_code,
    config
  );
  const args_count = count_arguments_generic(node, config);

  return {
    caller_name,
    callee_name,
    location: node_to_location(node, context.file_path),
    is_method_call: is_method,
    is_constructor_call: is_constructor,
    arguments_count: args_count,
  };
}

/**
 * Generic callee name extraction
 */
function extract_callee_name_generic(
  node: SyntaxNode,
  source: string,
  config: LanguageCallConfig
): string | null {
  // Special handling for new_expression (JavaScript/TypeScript)
  if (node.type === "new_expression") {
    // new_expression has the identifier as a direct child, not under 'function' field
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === "identifier") {
        return source.substring(child.startIndex, child.endIndex);
      } else if (child && child.type === "member_expression") {
        // Handle new obj.Constructor()
        const property = child.childForFieldName("property");
        if (property) {
          return source.substring(property.startIndex, property.endIndex);
        }
      }
    }
    return null;
  }

  // Get the function/callee part of the call
  const function_node = node.childForFieldName(config.function_field);
  if (!function_node) return null;

  // Simple identifier
  if (function_node.type === "identifier") {
    return source.substring(function_node.startIndex, function_node.endIndex);
  }

  // Method call - check all configured method expression types
  if (config.method_expression_types.includes(function_node.type)) {
    const property = function_node.childForFieldName(
      config.method_property_field
    );
    if (property) {
      return source.substring(property.startIndex, property.endIndex);
    }
  }

  // Scoped identifier (Rust specific pattern)
  if (function_node.type === "scoped_identifier") {
    const name = function_node.childForFieldName("name");
    if (name) {
      return source.substring(name.startIndex, name.endIndex);
    }
  }

  return null;
}

/**
 * Generic method call detection
 */
function is_method_call_generic(
  node: SyntaxNode,
  config: LanguageCallConfig
): boolean {
  // new_expression is never a method call
  if (node.type === "new_expression") {
    return false;
  }

  const function_node = node.childForFieldName(config.function_field);
  if (!function_node) return false;

  return config.method_expression_types.includes(function_node.type);
}

/**
 * Generic constructor call detection
 */
function is_constructor_call_generic(
  node: SyntaxNode,
  source: string,
  config: LanguageCallConfig
): boolean {
  // If the node itself is a new_expression, it's a constructor call
  if (node.type === "new_expression") {
    return true;
  }

  // Check for 'new' expression (JavaScript/TypeScript) - for call_expression inside new_expression
  if (config.constructor_patterns.new_expression_type) {
    const parent = node.parent;
    if (
      parent &&
      parent.type === config.constructor_patterns.new_expression_type
    ) {
      return true;
    }
  }

  // Check capitalization convention
  if (config.constructor_patterns.capitalized_convention) {
    const callee_name = extract_callee_name_generic(node, source, config);
    if (callee_name && /^[A-Z]/.test(callee_name)) {
      return true;
    }
  }

  // Check for struct literals (Rust)
  if (config.constructor_patterns.struct_literal_type) {
    const parent = node.parent;
    if (
      parent &&
      parent.type === config.constructor_patterns.struct_literal_type
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Generic argument counting
 */
function count_arguments_generic(
  node: SyntaxNode,
  config: LanguageCallConfig
): number {
  const args = node.childForFieldName(config.arguments_field);
  if (!args) return 0;

  // Count direct children that are arguments (not commas or parentheses)
  let count = 0;
  for (let i = 0; i < args.childCount; i++) {
    const child = args.child(i);
    if (
      child &&
      child.type !== "," &&
      child.type !== "(" &&
      child.type !== ")"
    ) {
      count++;
    }
  }

  return count;
}

/**
 * Generic enclosing function finder
 */
function get_enclosing_function_generic(
  node: SyntaxNode,
  source: string,
  config: LanguageCallConfig
): string | null {
  let current = node.parent;

  while (current) {
    if (config.function_definition_types.includes(current.type)) {
      // Try to find the function name from configured fields
      for (const field of config.function_name_fields) {
        const name_node = current.childForFieldName(field);
        if (name_node && name_node.type === "identifier") {
          return source.substring(name_node.startIndex, name_node.endIndex);
        }
      }

      // For anonymous functions
      return `<anonymous@${current.startPosition.row}:${current.startPosition.column}>`;
    }
    current = current.parent;
  }

  return null;
}

/**
 * Walk the AST tree and call callback for each node
 */
function walk_tree(
  node: SyntaxNode,
  callback: (node: SyntaxNode) => void
): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}

/**
 * Enhance with TypeScript-specific features
 */
export function enhance_with_typescript_features(
  calls: FunctionCallInfo[],
  context: FunctionCallContext
): FunctionCallInfo[] {
  const decorator_calls = handle_typescript_decorators(context);
  return [...calls, ...decorator_calls];
}
/**
 * Enhance with Rust-specific features
 */

export function enhance_with_rust_features(
  calls: FunctionCallInfo[],
  context: FunctionCallContext
): FunctionCallInfo[] {
  const macro_calls = handle_rust_macros(context);
  return [...calls, ...macro_calls];
}
/**
 * Enhance with Python-specific features
 */

export function enhance_with_python_features(
  calls: FunctionCallInfo[],
  context: FunctionCallContext
): FunctionCallInfo[] {
  const comprehension_calls = handle_python_comprehensions(context);
  return [...calls, ...comprehension_calls];
}
