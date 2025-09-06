/**
 * Generic method call detection processor
 *
 * Configuration-driven method call detection that handles 85% of common patterns
 * across all languages. Language-specific bespoke features are handled separately.
 */

import { SyntaxNode } from "tree-sitter";
import { Language, MethodCallInfo } from "@ariadnejs/types";
import { TypeInfo } from "../../type_analysis/type_tracking";
import {
  get_method_call_config,
  get_function_field_name,
  get_member_field_names,
  is_call_node_type,
  is_member_access_type,
  is_static_receiver
} from "./language_configs";
import {
  resolve_receiver_type,
  MethodCallWithType,
  infer_defining_class
} from "./receiver_type_resolver";

export interface MethodCallContext {
  source_code: string;
  file_path: string;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Module context identifier for method calls
 */
export const METHOD_CALLS_CONTEXT = 'method_calls' as const;

/**
 * Generic method call processor using configuration
 */
export function find_method_calls_generic(
  context: MethodCallContext,
  type_map?: Map<string, TypeInfo[]>
): MethodCallInfo[] {
  const calls: MethodCallInfo[] = [];
  const config = get_method_call_config(context.language);
  
  walk_tree(context.ast_root, (node) => {
    if (is_method_call_node(node, context.language)) {
      const method_info = extract_generic_method_call(
        node,
        context,
        type_map
      );
      if (method_info) {
        calls.push(method_info as MethodCallInfo);
      }
    }
  });
  
  return calls;
}

/**
 * Check if a node is a method call using configuration
 */
export function is_method_call_node(
  node: SyntaxNode,
  language: Language
): boolean {
  if (!is_call_node_type(node.type, language)) {
    return false;
  }
  
  const func_field = get_function_field_name(language);
  const func = node.childForFieldName(func_field);
  
  if (!func) return false;
  
  return is_member_access_type(func.type, language);
}

/**
 * Extract method call information using generic configuration
 */
function extract_generic_method_call(
  node: SyntaxNode,
  context: MethodCallContext,
  type_map?: Map<string, TypeInfo[]>
): MethodCallWithType | null {
  const receiver_name = extract_receiver_name(node, context.source_code, context.language);
  const method_name = extract_method_name(node, context.source_code, context.language);
  
  if (!receiver_name || !method_name) {
    return null;
  }
  
  const caller_name = get_caller_context(node, context.source_code, context.language) || '<module>';
  
  // Try to resolve receiver type
  let receiver_type: string | undefined;
  let defining_class: string | undefined;
  
  const func_field = get_function_field_name(context.language);
  const func = node.childForFieldName(func_field);
  
  // Special handling for Rust associated functions (Type::method)
  if (context.language === 'rust' && func && func.type === 'scoped_identifier') {
    // For associated functions like String::from, the receiver is the type itself
    receiver_type = receiver_name;
    defining_class = receiver_name;
  }
  else if (func && is_member_access_type(func.type, context.language)) {
    const field_names = get_member_field_names(func.type, context.language);
    if (field_names) {
      const receiver_node = func.childForFieldName(field_names.receiver);
      if (receiver_node) {
        receiver_type = resolve_receiver_type(
          receiver_node,
          type_map,
          context.source_code,
          context.language
        );
        if (receiver_type) {
          defining_class = infer_defining_class(method_name, receiver_type);
        }
      }
    }
  }
  
  return {
    caller_name,
    method_name,
    receiver_name,
    receiver_type,
    defining_class,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    is_static_method: is_static_receiver(receiver_name, context.language) ||
                      is_static_method_special(node, context.source_code, context.language),
    is_chained_call: is_chained_method_call(node, context.language),
    arguments_count: count_method_arguments(node, context.language)
  };
}

/**
 * Extract receiver name using configuration
 */
export function extract_receiver_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const func_field = get_function_field_name(language);
  const func = node.childForFieldName(func_field);
  
  if (!func || !is_member_access_type(func.type, language)) {
    return null;
  }
  
  // Special handling for Rust generic_function (turbofish)
  if (language === 'rust' && func.type === 'generic_function') {
    // Extract receiver from pattern like iter.collect::<Vec<_>>
    // The receiver is everything before the last .method_name::
    const func_text = source.substring(func.startIndex, func.endIndex);
    const match = func_text.match(/(.+)\.([^.:\s]+)::</);
    if (match) {
      return match[1];  // Return the receiver part
    }
    return null;
  }
  
  const field_names = get_member_field_names(func.type, language);
  if (!field_names) return null;
  
  const receiver_node = func.childForFieldName(field_names.receiver);
  if (!receiver_node) return null;
  
  return source.substring(receiver_node.startIndex, receiver_node.endIndex);
}

/**
 * Extract method name using configuration
 */
export function extract_method_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const func_field = get_function_field_name(language);
  const func = node.childForFieldName(func_field);
  
  if (!func || !is_member_access_type(func.type, language)) {
    return null;
  }
  
  // Special handling for Rust generic_function (turbofish)
  if (language === 'rust' && func.type === 'generic_function') {
    // Extract from pattern like iter.collect::<Vec<_>>
    const func_text = source.substring(func.startIndex, func.endIndex);
    // Match the last method name before the turbofish `::`
    const match = func_text.match(/\.([^.:\s]+)::</);
    if (match) {
      return match[1];
    }
    return null;
  }
  
  const field_names = get_member_field_names(func.type, language);
  if (!field_names) return null;
  
  const method_node = func.childForFieldName(field_names.method);
  if (!method_node) return null;
  
  return source.substring(method_node.startIndex, method_node.endIndex);
}

/**
 * Check for language-specific static method patterns
 */
function is_static_method_special(
  node: SyntaxNode,
  source: string,
  language: Language
): boolean {
  // Rust-specific: :: indicates associated functions
  if (language === "rust") {
    const func_field = get_function_field_name(language);
    const func = node.childForFieldName(func_field);
    return func?.type === "scoped_identifier";
  }
  
  return false;
}

/**
 * Check if a method call is part of a chain
 */
export function is_chained_method_call(
  node: SyntaxNode,
  language: Language
): boolean {
  const func_field = get_function_field_name(language);
  const func = node.childForFieldName(func_field);
  
  if (!func || !is_member_access_type(func.type, language)) {
    return false;
  }
  
  const field_names = get_member_field_names(func.type, language);
  if (!field_names) return false;
  
  const receiver_node = func.childForFieldName(field_names.receiver);
  if (!receiver_node) return false;
  
  return is_call_node_type(receiver_node.type, language);
}

/**
 * Count arguments in a method call using configuration
 */
export function count_method_arguments(
  node: SyntaxNode,
  language: Language
): number {
  const config = get_method_call_config(language);
  const args_node = node.childForFieldName(config.arguments_field);
  if (!args_node) return 0;
  
  let count = 0;
  for (let i = 0; i < args_node.childCount; i++) {
    const child = args_node.child(i);
    if (child && !config.argument_skip_tokens.includes(child.type)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Get caller context (enclosing function/method)
 */
function get_caller_context(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const config = get_method_call_config(language);
  let current = node.parent;
  
  while (current) {
    // Check for function/method definitions
    if (config.function_definition_types.includes(current.type)) {
      const name_node = current.childForFieldName(config.function_name_field);
      if (name_node) {
        const func_name = source.substring(name_node.startIndex, name_node.endIndex);
        
        // Check if it's a method in a class
        const class_name = get_enclosing_class(current, source, language);
        if (class_name) {
          return `${class_name}.${func_name}`;
        }
        return func_name;
      }
      return '<anonymous>';
    }
    
    // Check for method definitions (if different from functions)
    if (config.method_definition_type && current.type === config.method_definition_type) {
      const key_field = config.method_key_field || 'key';
      const key = current.childForFieldName(key_field);
      if (key) {
        const method_name = source.substring(key.startIndex, key.endIndex);
        const class_name = get_enclosing_class(current, source, language);
        if (class_name) {
          return `${class_name}.${method_name}`;
        }
        return method_name;
      }
    }
    
    // Rust-specific: Check for impl blocks
    if (language === 'rust' && current.type === 'impl_item') {
      // Continue up to find the function within the impl
      current = current.parent;
      continue;
    }
    
    current = current.parent;
  }
  
  return null;
}

/**
 * Get enclosing class/struct using configuration
 */
export function get_enclosing_class(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const config = get_method_call_config(language);
  let current = node.parent;
  
  while (current) {
    if (config.class_definition_types.includes(current.type)) {
      // Rust-specific handling for impl blocks
      if (language === 'rust' && current.type === 'impl_item') {
        const type_node = current.childForFieldName('type');
        if (type_node) {
          return source.substring(type_node.startIndex, type_node.endIndex);
        }
      } else {
        const name_node = current.childForFieldName(config.class_name_field);
        if (name_node) {
          return source.substring(name_node.startIndex, name_node.endIndex);
        }
      }
    }
    current = current.parent;
  }
  
  return null;
}

/**
 * Walk the AST tree
 */
function walk_tree(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}
