/**
 * Rust-specific constructor call detection
 */

import { SyntaxNode } from 'tree-sitter';
import { Language } from '@ariadnejs/types';
import {
  ConstructorCallInfo,
  ConstructorCallContext,
  TypeAssignment,
  is_constructor_call_node,
  extract_constructor_name,
  find_assignment_target,
  count_constructor_arguments,
  is_factory_method_pattern,
  get_assignment_scope,
  create_type_assignment
} from './constructor_calls';

/**
 * Find all constructor calls in Rust code
 */
export function find_constructor_calls_rust(
  context: ConstructorCallContext
): ConstructorCallInfo[] {
  const calls: ConstructorCallInfo[] = [];
  const language: Language = 'rust';
  
  // Walk the AST to find constructor patterns
  walk_tree(context.ast_root, (node) => {
    // Check for Type::new() pattern
    if (is_constructor_call_node(node, language)) {
      const call_info = extract_rust_constructor_call(node, context, language);
      if (call_info) {
        calls.push(call_info);
      }
    }
    
    // Check for struct literal: StructName { field: value }
    if (node.type === 'struct_expression') {
      const call_info = extract_rust_struct_literal(node, context);
      if (call_info) {
        calls.push(call_info);
      }
    }
    
    // Check for enum variant construction
    if (is_enum_variant_construction(node, context.source_code)) {
      const call_info = extract_rust_enum_construction(node, context);
      if (call_info) {
        calls.push(call_info);
      }
    }
  });
  
  return calls;
}

/**
 * Extract Rust constructor call information (Type::new() pattern)
 */
function extract_rust_constructor_call(
  node: SyntaxNode,
  context: ConstructorCallContext,
  language: Language
): ConstructorCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'scoped_identifier') return null;
  
  const path = func.childForFieldName('path');
  const name = func.childForFieldName('name');
  
  if (!path || !name) return null;
  
  const method_name = context.source_code.substring(name.startIndex, name.endIndex);
  
  // Check if it's a factory method (new, create, from, etc.)
  if (!['new', 'create', 'from', 'build', 'default', 'with_capacity'].includes(method_name)) {
    return null;
  }
  
  const type_name = context.source_code.substring(path.startIndex, path.endIndex);
  const assigned_to = find_assignment_target(node, context.source_code, language);
  
  return {
    constructor_name: type_name,
    location: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    file_path: context.file_path,
    arguments_count: count_constructor_arguments(node, language),
    assigned_to: assigned_to || undefined,
    is_new_expression: false,
    is_factory_method: true
  };
}

/**
 * Extract struct literal construction
 */
function extract_rust_struct_literal(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const struct_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  const assigned_to = find_assignment_target(node, context.source_code, 'rust');
  
  // Count field initializers
  const body = node.childForFieldName('body');
  let field_count = 0;
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const child = body.child(i);
      if (child && (child.type === 'field_initializer' || child.type === 'shorthand_field_initializer')) {
        field_count++;
      }
    }
  }
  
  return {
    constructor_name: struct_name,
    location: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    file_path: context.file_path,
    arguments_count: field_count,
    assigned_to: assigned_to || undefined,
    is_new_expression: false,
    is_factory_method: false
  };
}

/**
 * Extract enum variant construction
 */
function extract_rust_enum_construction(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func) return null;
  
  let enum_variant_name: string | null = null;
  
  // Simple enum variant: Variant(...)
  if (func.type === 'identifier') {
    const name = context.source_code.substring(func.startIndex, func.endIndex);
    if (/^[A-Z]/.test(name)) {
      enum_variant_name = name;
    }
  }
  // Qualified enum variant: Enum::Variant(...)
  else if (func.type === 'scoped_identifier') {
    const name = func.childForFieldName('name');
    if (name) {
      const variant = context.source_code.substring(name.startIndex, name.endIndex);
      if (/^[A-Z]/.test(variant)) {
        const path = func.childForFieldName('path');
        if (path) {
          const enum_name = context.source_code.substring(path.startIndex, path.endIndex);
          enum_variant_name = `${enum_name}::${variant}`;
        }
      }
    }
  }
  
  if (!enum_variant_name) return null;
  
  const assigned_to = find_assignment_target(node, context.source_code, 'rust');
  
  return {
    constructor_name: enum_variant_name,
    location: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    file_path: context.file_path,
    arguments_count: count_constructor_arguments(node, 'rust'),
    assigned_to: assigned_to || undefined,
    is_new_expression: false,
    is_factory_method: false
  };
}

/**
 * Check if it's an enum variant construction
 */
function is_enum_variant_construction(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'call_expression') return false;
  
  const func = node.childForFieldName('function');
  if (!func) return false;
  
  // Check for capitalized identifier (enum variant convention)
  if (func.type === 'identifier') {
    const name = source.substring(func.startIndex, func.endIndex);
    return /^[A-Z]/.test(name) && name !== name.toUpperCase(); // Not a constant
  }
  
  // Check for Enum::Variant pattern
  if (func.type === 'scoped_identifier') {
    const name = func.childForFieldName('name');
    if (name) {
      const variant = source.substring(name.startIndex, name.endIndex);
      return /^[A-Z]/.test(variant) && variant !== variant.toUpperCase();
    }
  }
  
  return false;
}

/**
 * Get type assignments from constructor calls
 */
export function get_type_assignments_rust(
  context: ConstructorCallContext
): TypeAssignment[] {
  const assignments: TypeAssignment[] = [];
  const calls = find_constructor_calls_rust(context);
  
  for (const call of calls) {
    if (call.assigned_to) {
      const scope = get_assignment_scope_rust(context.ast_root, call.location);
      const assignment = create_type_assignment(call, call.assigned_to, scope);
      assignments.push(assignment);
    }
  }
  
  return assignments;
}

/**
 * Get the scope of an assignment at a specific location
 */
function get_assignment_scope_rust(
  root: SyntaxNode,
  location: { row: number; column: number }
): 'local' | 'global' | 'member' {
  // Find the node at this location
  const node = root.descendantForPosition(
    { row: location.row, column: location.column },
    { row: location.row, column: location.column + 1 }
  );
  
  if (!node) return 'global';
  
  return get_assignment_scope(node, 'rust');
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

/**
 * Rust-specific: Check for Box::new() pattern
 */
export function is_box_new_pattern(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'call_expression') return false;
  
  const func = node.childForFieldName('function');
  if (func && func.type === 'scoped_identifier') {
    const path = func.childForFieldName('path');
    const name = func.childForFieldName('name');
    
    if (path && name) {
      const type_name = source.substring(path.startIndex, path.endIndex);
      const method_name = source.substring(name.startIndex, name.endIndex);
      return type_name === 'Box' && method_name === 'new';
    }
  }
  
  return false;
}

/**
 * Rust-specific: Check for Rc/Arc creation
 */
export function is_smart_pointer_creation(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'call_expression') return false;
  
  const func = node.childForFieldName('function');
  if (func && func.type === 'scoped_identifier') {
    const path = func.childForFieldName('path');
    const name = func.childForFieldName('name');
    
    if (path && name) {
      const type_name = source.substring(path.startIndex, path.endIndex);
      const method_name = source.substring(name.startIndex, name.endIndex);
      return ['Rc', 'Arc', 'RefCell', 'Mutex', 'RwLock'].includes(type_name) && 
             method_name === 'new';
    }
  }
  
  return false;
}

/**
 * Rust-specific: Check for derive macro usage
 */
export function has_derive_default(
  node: SyntaxNode
): boolean {
  if (node.type !== 'struct_item' && node.type !== 'enum_item') {
    return false;
  }
  
  // Look for #[derive(Default)] attribute
  let current = node.previousSibling;
  while (current && current.type === 'attribute_item') {
    const meta = current.childForFieldName('meta');
    if (meta && meta.text?.includes('derive') && meta.text.includes('Default')) {
      return true;
    }
    current = current.previousSibling;
  }
  
  return false;
}