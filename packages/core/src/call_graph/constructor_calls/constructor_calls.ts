/**
 * Generic constructor call detection logic
 * 
 * Configuration-driven processor for detecting constructor calls across languages.
 * Handles 80% of constructor detection patterns through configuration.
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, ConstructorCall as ConstructorCallInfo, FilePath } from '@ariadnejs/types';
import { 
  get_language_config,
  is_constructor_node_type,
  is_potential_constructor_node_type,
  matches_constructor_naming,
  is_factory_method_name,
  get_arguments_field_name
} from './language_configs';
import { node_to_location } from '../../ast/node_utils';

export interface ConstructorCallContext {
  source_code: string;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Module context for error messages and debugging
 */
export const MODULE_CONTEXT = 'constructor_calls';

/**
 * Generic processor for finding constructor calls
 * 
 * Uses configuration to handle common patterns across all languages.
 * Returns basic constructor calls that can be enhanced with bespoke features.
 */
export function process_constructor_calls_generic(
  context: ConstructorCallContext
): ConstructorCallInfo[] {
  const calls: ConstructorCallInfo[] = [];
  const config = get_language_config(context.language);
  
  // Walk the AST to find constructor patterns
  walk_tree(context.ast_root, (node) => {
    // Check for definite constructor node types
    if (is_constructor_node_type(node.type, context.language)) {
      const call_info = extract_constructor_info(node, context);
      if (call_info) {
        calls.push(call_info);
      }
    }
    
    // Check for potential constructor node types (need additional validation)
    if (is_potential_constructor_node_type(node.type, context.language)) {
      const call_info = extract_potential_constructor_info(node, context);
      if (call_info) {
        calls.push(call_info);
      }
    }
  });
  
  return calls;
}

/**
 * Common logic for detecting if a node is a constructor call
 * 
 * This is kept for backwards compatibility but now uses configuration
 */
export function is_constructor_call_node(node: SyntaxNode, language: Language): boolean {
  // Check definite constructor types
  if (is_constructor_node_type(node.type, language)) {
    return true;
  }
  
  // Check potential constructor types with additional validation
  if (is_potential_constructor_node_type(node.type, language)) {
    const config = get_language_config(language);
    
    // Extract the function/class name to check naming conventions
    const name = extract_name_from_node(node, language);
    if (name && matches_constructor_naming(name, language)) {
      return true;
    }
    
    // Check for factory methods
    if (config.check_factory_methods && is_factory_call(node, language)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a node is a factory method call
 */
function is_factory_call(node: SyntaxNode, language: Language): boolean {
  if (language === 'rust' && node.type === 'call_expression') {
    const func = node.childForFieldName('function');
    if (func && func.type === 'scoped_identifier') {
      const name = func.childForFieldName('name');
      if (name && is_factory_method_name(name.text, language)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extract name from a node based on language configuration
 */
function extract_name_from_node(node: SyntaxNode, language: Language): string | null {
  const config = get_language_config(language);
  const extraction = config.name_extraction_fields[node.type];
  
  if (!extraction) return null;
  
  const field = node.childForFieldName(extraction.primary_field);
  if (!field) return null;
  
  // Handle simple identifier case
  if (field.type === 'identifier') {
    return field.text;
  }
  
  // Handle nested paths (e.g., member expressions, attributes)
  if (extraction.nested_path) {
    for (const path of extraction.nested_path) {
      if (path.includes('.')) {
        // Handle nested field access like 'member_expression.property'
        const [nodeType, fieldName] = path.split('.');
        if (field.type === nodeType) {
          const nested = field.childForFieldName(fieldName);
          if (nested) return nested.text;
        }
      } else if (field.type === path) {
        // Special handling for Python attribute nodes (module.Class pattern)
        if (path === 'attribute' && language === 'python') {
          // Get the last child which is the class name
          const last_child = field.child(field.childCount - 1);
          if (last_child && last_child.type === 'identifier') {
            return last_child.text;
          }
        }
        return field.text;
      }
    }
  }
  
  return null;
}

/**
 * Extract constructor information from a definite constructor node
 */
function extract_constructor_info(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  const constructor_name = extract_constructor_name(node, context.source_code, context.language);
  if (!constructor_name) return null;
  
  const assigned_to = find_assignment_target(node, context.source_code, context.language);
  const is_new = uses_new_keyword(node, context.language);
  
  // Special handling for Rust struct literals
  let arguments_count = count_constructor_arguments(node, context.language);
  if (context.language === 'rust' && node.type === 'struct_expression') {
    // For struct literals, count fields in the body
    const body = node.childForFieldName('body');
    if (body) {
      arguments_count = 0;
      for (let i = 0; i < body.childCount; i++) {
        const child = body.child(i);
        if (child && 
            (child.type === 'field_initializer' || 
             child.type === 'shorthand_field_initializer')) {
          arguments_count++;
        }
      }
    }
  }
  
  return {
    constructor_name,
    location: node_to_location(node, context.file_path),
    arguments_count,
    assigned_to: assigned_to || (`anonymous_${Date.now()}` as any),
    is_new_expression: is_new,
    is_factory_method: !is_new && is_factory_call(node, context.language)
  };
}

/**
 * Extract constructor information from a potential constructor node
 */
function extract_potential_constructor_info(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  const config = get_language_config(context.language);
  
  // For potential constructor types, extract the name first
  const extraction = config.name_extraction_fields[node.type];
  if (!extraction) return null;
  
  const field = node.childForFieldName(extraction.primary_field);
  if (!field) return null;
  
  let name: string | null = null;
  
  // Handle simple identifier case
  if (field.type === 'identifier') {
    name = context.source_code.substring(field.startIndex, field.endIndex);
  } else if (extraction.nested_path) {
    // Handle nested paths (e.g., member expressions, attributes)
    for (const path of extraction.nested_path) {
      if (path.includes('.')) {
        // Handle nested field access like 'attribute.attr'
        const [nodeType, fieldName] = path.split('.');
        if (field.type === nodeType) {
          const nested = field.childForFieldName(fieldName);
          if (nested) {
            name = context.source_code.substring(nested.startIndex, nested.endIndex);
            break;
          }
        }
      } else if (field.type === path) {
        // Special handling for Python attribute nodes (module.Class pattern)
        if (path === 'attribute' && context.language === 'python') {
          // Get the last child which is the class name
          const last_child = field.child(field.childCount - 1);
          if (last_child && last_child.type === 'identifier') {
            name = context.source_code.substring(last_child.startIndex, last_child.endIndex);
            break;
          }
        } else {
          name = context.source_code.substring(field.startIndex, field.endIndex);
        }
        break;
      }
    }
  }
  
  if (!name) return null;
  
  // Check if it matches constructor naming conventions
  const matches_naming = matches_constructor_naming(name, context.language);
  const is_factory = is_factory_call(node, context.language);
  
  if (!matches_naming && !is_factory) {
    return null;
  }
  
  const assigned_to = find_assignment_target(node, context.source_code, context.language);
  
  // For JavaScript/TypeScript, capitalized function calls without 'new' are factory methods
  const is_factory_method = (context.language === 'javascript' || context.language === 'typescript') 
    ? matches_naming && node.type === 'call_expression'
    : is_factory;
  
  return {
    constructor_name: name,
    location: node_to_location(node, context.file_path),
    arguments_count: count_constructor_arguments(node, context.language),
    assigned_to: assigned_to || (`anonymous_${Date.now()}` as any),
    is_new_expression: false,
    is_factory_method
  };
}

/**
 * Walk the AST tree recursively
 */
export function walk_tree(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}

/**
 * Extract the constructor/class name from a constructor call
 * 
 * This function is kept for backwards compatibility and uses the new
 * configuration-driven approach internally.
 */
export function extract_constructor_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const config = get_language_config(language);
  const extraction = config.name_extraction_fields[node.type];
  
  if (!extraction) return null;
  
  const field = node.childForFieldName(extraction.primary_field);
  if (!field) return null;
  
  // Handle simple identifier case
  if (field.type === 'identifier') {
    return source.substring(field.startIndex, field.endIndex);
  }
  
  // Handle nested paths (e.g., member expressions, attributes)
  if (extraction.nested_path) {
    for (const path of extraction.nested_path) {
      if (path.includes('.')) {
        // Handle nested field access like 'member_expression.property'
        const [nodeType, fieldName] = path.split('.');
        if (field.type === nodeType) {
          const nested = field.childForFieldName(fieldName);
          if (nested) {
            return source.substring(nested.startIndex, nested.endIndex);
          }
        }
      } else if (field.type === path) {
        // Special handling for Python attribute nodes (module.Class pattern)
        if (path === 'attribute' && language === 'python') {
          // Get the last child which is the class name
          const last_child = field.child(field.childCount - 1);
          if (last_child && last_child.type === 'identifier') {
            return source.substring(last_child.startIndex, last_child.endIndex);
          }
        }
        return source.substring(field.startIndex, field.endIndex);
      }
    }
  }
  
  // Special handling for scoped identifiers in Rust
  if (language === 'rust' && field.type === 'scoped_identifier') {
    const path = field.childForFieldName('path');
    if (path) {
      return source.substring(path.startIndex, path.endIndex);
    }
  }
  
  return null;
}

/**
 * Find the variable that a constructor result is assigned to
 * 
 * Uses configuration to handle language-specific assignment patterns.
 */
export function find_assignment_target(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const config = get_language_config(language);
  let current = node.parent;
  
  while (current) {
    // Check language-specific declaration types
    if (config.assignment_patterns.declaration_types.includes(current.type)) {
      const field_name = config.assignment_patterns.assignment_field;
      const field = current.childForFieldName(field_name);
      
      if (field) {
        if (field.type === 'identifier') {
          return source.substring(field.startIndex, field.endIndex);
        }
        
        // Handle Rust's pattern matching
        if (language === 'rust' && config.assignment_patterns.pattern_field) {
          if (field.type === 'mutable_specifier') {
            const ident = field.nextSibling;
            if (ident && ident.type === 'identifier') {
              return source.substring(ident.startIndex, ident.endIndex);
            }
          }
        }
      }
    }
    
    // Universal assignment expression handling
    if (current.type === 'assignment_expression' || current.type === 'assignment') {
      const left = current.childForFieldName('left') || current.child(0);
      if (left) {
        // Handle simple identifier
        if (left.type === 'identifier') {
          return source.substring(left.startIndex, left.endIndex);
        }
        // Handle member expressions (this.prop, self.prop)
        if (left.type === 'member_expression' || left.type === 'attribute') {
          return source.substring(left.startIndex, left.endIndex);
        }
      }
    }
    
    // Stop at statement boundaries
    if (is_statement_node(current)) {
      break;
    }
    
    current = current.parent;
  }
  
  return null;
}

/**
 * Check if a node is a statement (boundary for assignment search)
 */
function is_statement_node(node: SyntaxNode): boolean {
  const statement_types = [
    'expression_statement',
    'return_statement',
    'if_statement',
    'while_statement',
    'for_statement',
    'block',
    'function_declaration',
    'class_declaration',
    'function_definition',
    'class_definition'
  ];
  
  return statement_types.includes(node.type);
}

/**
 * Count arguments in a constructor call
 * 
 * Uses configuration to find the arguments field.
 */
export function count_constructor_arguments(
  node: SyntaxNode,
  language: Language
): number {
  const config = get_language_config(language);
  const args_node = node.childForFieldName(config.arguments_field_name);
  
  if (!args_node) {
    // Special case for Rust struct literals - count fields instead
    if (language === 'rust' && node.type === 'struct_expression') {
      return count_struct_fields(node);
    }
    return 0;
  }
  
  let count = 0;
  for (let i = 0; i < args_node.childCount; i++) {
    const child = args_node.child(i);
    if (child && 
        child.type !== '(' && 
        child.type !== ')' && 
        child.type !== ',' &&
        child.type !== 'comment') {
      // Count both positional and keyword arguments
      if (child.type === 'keyword_argument' || 
          child.type === 'field_initializer' ||
          child.type === 'shorthand_field_initializer' ||
          (!child.type.includes('_') || child.type.includes('expression'))) {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Count fields in a Rust struct literal
 */
function count_struct_fields(node: SyntaxNode): number {
  const body = node.childForFieldName('body');
  if (!body) return 0;
  
  let count = 0;
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (child && 
        (child.type === 'field_initializer' || 
         child.type === 'shorthand_field_initializer')) {
      count++;
    }
  }
  
  return count;
}

/**
 * Check if constructor call uses 'new' keyword
 * 
 * Configuration-driven check for new keyword usage.
 */
export function uses_new_keyword(
  node: SyntaxNode,
  language: Language
): boolean {
  // For JavaScript/TypeScript, check if it's a new expression
  if ((language === 'javascript' || language === 'typescript') && 
      node.type === 'new_expression') {
    return true;
  }
  
  return false;
}

/**
 * Check if it's a factory method pattern (e.g., Type::new())
 * 
 * This function is kept for backwards compatibility but now uses
 * configuration-driven factory method detection.
 */
export function is_factory_method_pattern(
  node: SyntaxNode,
  source: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  
  if (!config.check_factory_methods) {
    return false;
  }
  
  // Check Rust factory methods
  if (language === 'rust' && node.type === 'call_expression') {
    const func = node.childForFieldName('function');
    if (func && func.type === 'scoped_identifier') {
      const name = func.childForFieldName('name');
      if (name) {
        const method_name = source.substring(name.startIndex, name.endIndex);
        return is_factory_method_name(method_name, language);
      }
    }
  }
  
  // Check Python factory methods (class methods)
  if (language === 'python' && node.type === 'call') {
    const func = node.childForFieldName('func');
    if (func && func.type === 'attribute') {
      const attr = func.childForFieldName('attr');
      if (attr) {
        const method_name = source.substring(attr.startIndex, attr.endIndex);
        // Python doesn't have factory methods in config but these are common patterns
        return ['create', 'from_dict', 'from_json', 'build'].includes(method_name);
      }
    }
  }
  
  return false;
}

