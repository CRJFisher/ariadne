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
  ScopeTree,
  ScopeNode,
  Location,
  ImportInfo,
} from "@ariadnejs/types";
import { getLanguageConfig, LanguageCallConfig } from "./language_configs";
import { node_to_location } from "../../ast/node_utils";
import { handle_typescript_decorators } from "./function_calls.typescript";
import { handle_rust_macros } from "./function_calls.rust";
import { handle_python_comprehensions } from "./function_calls.python";
import {
  find_symbol_in_scope_chain,
} from "../../scope_analysis/scope_tree";
import { TypeInfo } from "../../type_analysis/type_tracking";

/**
 * Special constant for module-level calls (calls not within any function)
 */
export const MODULE_CONTEXT = "<module>";

/**
 * Check if a point is within a location range
 */
function point_in_range(point: Location, range: Location): boolean {
  // Check file path
  if (point.file_path !== range.file_path) return false;
  
  // Check if point is after range start
  if (point.line < range.line) return false;
  if (point.line === range.line && point.column < range.column) return false;
  
  // Check if point is before range end
  if (point.line > range.end_line) return false;
  if (point.line === range.end_line && point.column > range.end_column) return false;
  
  return true;
}

/**
 * Find the deepest scope containing a location
 */
function find_scope_for_location(
  tree: ScopeTree,
  location: Location
): ScopeNode | null {
  let deepestScope: ScopeNode | null = null;
  let deepestDepth = -1;
  
  // Check all scopes to find the deepest one containing the location
  for (const scope of tree.nodes.values()) {
    if (point_in_range(location, scope.location)) {
      // Count depth by counting parents
      let depth = 0;
      let currentId = scope.parent_id;
      while (currentId) {
        depth++;
        const parent = tree.nodes.get(currentId);
        currentId = parent?.parent_id;
      }
      
      if (depth > deepestDepth) {
        deepestDepth = depth;
        deepestScope = scope;
      }
    }
  }
  
  return deepestScope;
}

/**
 * Resolve method call using type information
 */
function resolve_method_with_types(
  node: SyntaxNode,
  type_map: Map<string, TypeInfo>,
  source_code: string,
  config: LanguageCallConfig
): { object_type: string; type_kind: TypeInfo['type_kind']; confidence: TypeInfo['confidence']; class_name?: string } | null {
  // Get the object being called on
  const object_node = node.childForFieldName(config.function_field);
  if (!object_node) return null;
  
  // For method calls, the object is usually the first child of the callee
  let object_name: string | null = null;
  
  if (object_node.type === "member_expression" || object_node.type === "member_access_expression") {
    const obj = object_node.childForFieldName("object");
    if (obj) {
      object_name = source_code.substring(obj.startIndex, obj.endIndex);
    }
  } else if (object_node.type === "field_expression") {
    // Rust style
    const obj = object_node.childForFieldName("value");
    if (obj) {
      object_name = source_code.substring(obj.startIndex, obj.endIndex);
    }
  } else if (object_node.type === "attribute") {
    // Python style
    const obj = object_node.childForFieldName("object");
    if (obj) {
      object_name = source_code.substring(obj.startIndex, obj.endIndex);
    }
  }
  
  if (!object_name) return null;
  
  // Look up the type in the type map
  // Create a location-based key for the lookup
  const location_key = `${object_name}@${node.startPosition.row}:${node.startPosition.column}`;
  const type_info = type_map.get(location_key) || type_map.get(object_name);
  
  if (type_info) {
    return {
      object_type: type_info.type_name,
      type_kind: type_info.type_kind,
      confidence: type_info.confidence,
      class_name: type_info.type_kind === 'class' ? type_info.type_name : undefined,
    };
  }
  
  return null;
}

/**
 * Enhance call with import information
 */
function enhance_with_import_info(
  callee_name: string,
  imports: ImportInfo[]
): { is_imported: boolean; source_module?: string; import_alias?: string; original_name?: string } | null {
  // Check for direct import (named or default)
  const direct_import = imports.find(imp => {
    if (imp.alias) {
      return imp.alias === callee_name;
    }
    return imp.name === callee_name;
  });

  if (direct_import) {
    return {
      is_imported: true,
      source_module: direct_import.source,
      import_alias: direct_import.alias,
      original_name: direct_import.alias ? direct_import.name : undefined,
    };
  }

  // Check for namespace imports (e.g., ns.function where ns is imported)
  const namespaceParts = callee_name.split('.');
  if (namespaceParts.length > 1) {
    const namespace = namespaceParts[0];
    const namespace_import = imports.find(imp => 
      imp.kind === 'namespace' && imp.namespace_name === namespace
    );
    if (namespace_import) {
      return {
        is_imported: true,
        source_module: namespace_import.source,
        import_alias: callee_name,
        original_name: namespaceParts.slice(1).join('.'),
      };
    }
  }

  return null;
}

/**
 * Resolve a local function using the scope tree
 */
function resolve_local_function(
  callee_name: string,
  call_location: Location,
  scope_tree: ScopeTree
): { symbol_id: string; definition_location: Location; is_local: boolean } | null {
  // Find the scope containing the call
  const scope = find_scope_for_location(scope_tree, call_location);
  if (!scope) return null;

  // Walk up scope chain looking for function definition
  const result = find_symbol_in_scope_chain(scope_tree, scope.id, callee_name);
  
  if (result && result.symbol.kind === "function") {
    return {
      symbol_id: `${result.scope.id}:${callee_name}`,
      definition_location: result.symbol.location,
      is_local: true,
    };
  }

  return null;
}

/**
 * Context passed to all function call detection functions
 */
export interface FunctionCallContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
  // Integration points for cross-feature functionality
  scope_tree?: ScopeTree;  // For symbol resolution
  imports?: ImportInfo[];  // Already-resolved imports for this file
  // exports?: ExportInfo[];  // Already-detected exports for this file
  type_map?: Map<string, TypeInfo>;  // Pre-computed type information
}

/**
 * Enhanced function call info with resolved target
 */
export interface EnhancedFunctionCallInfo extends FunctionCallInfo {
  resolved_target?: {
    symbol_id: string;
    definition_location: Location;
    is_local: boolean;
  };
  // Import tracking
  is_imported?: boolean;
  source_module?: string;
  import_alias?: string;
  original_name?: string;
  // Type-based resolution for method calls
  resolved_type?: {
    object_type: string;
    type_kind: TypeInfo['type_kind'];
    confidence: TypeInfo['confidence'];
    class_name?: string;
  };
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

  const call_info: EnhancedFunctionCallInfo = {
    caller_name,
    callee_name,
    location: node_to_location(node, context.file_path),
    is_method_call: is_method,
    is_constructor_call: is_constructor,
    arguments_count: args_count,
  };

  // If scope tree is available, try to resolve the local function
  if (context.scope_tree && !is_method && !is_constructor) {
    const resolved = resolve_local_function(
      callee_name,
      call_info.location,
      context.scope_tree
    );
    if (resolved) {
      call_info.resolved_target = resolved;
    }
  }

  // If imports are available and the call wasn't resolved locally, check imports
  if (context.imports && !call_info.resolved_target && !is_constructor) {
    const import_info = enhance_with_import_info(callee_name, context.imports);
    if (import_info) {
      call_info.is_imported = import_info.is_imported;
      call_info.source_module = import_info.source_module;
      call_info.import_alias = import_info.import_alias;
      call_info.original_name = import_info.original_name;
    }
  }

  // If type map is available and this is a method call, try to resolve the type
  if (context.type_map && is_method) {
    const type_resolution = resolve_method_with_types(
      node, 
      context.type_map, 
      context.source_code, 
      config
    );
    if (type_resolution) {
      call_info.resolved_type = type_resolution;
    }
  }

  return call_info;
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
