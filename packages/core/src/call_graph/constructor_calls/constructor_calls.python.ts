/**
 * Python-specific constructor call detection
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
  get_assignment_scope,
  create_type_assignment
} from './constructor_calls';

/**
 * Find all constructor calls in Python code
 */
export function find_constructor_calls_python(
  context: ConstructorCallContext
): ConstructorCallInfo[] {
  const calls: ConstructorCallInfo[] = [];
  const language: Language = 'python';
  
  // Walk the AST to find all call nodes
  walk_tree(context.ast_root, (node) => {
    if (is_constructor_call_node(node, language)) {
      const call_info = extract_python_constructor_call(node, context, language);
      if (call_info) {
        calls.push(call_info);
      }
    }
    
    // Also check for dataclass instantiation patterns
    if (is_dataclass_instantiation(node, context.source_code)) {
      const call_info = extract_python_constructor_call(node, context, language);
      if (call_info) {
        calls.push(call_info);
      }
    }
  });
  
  return calls;
}

/**
 * Extract Python constructor call information
 */
function extract_python_constructor_call(
  node: SyntaxNode,
  context: ConstructorCallContext,
  language: Language
): ConstructorCallInfo | null {
  if (node.type !== 'call') return null;
  
  const constructor_name = extract_constructor_name(node, context.source_code, language);
  if (!constructor_name) return null;
  
  // Check if it's actually a class (capitalized by convention)
  if (!/^[A-Z]/.test(constructor_name)) {
    // Could be a factory function, but not a direct constructor
    return null;
  }
  
  const assigned_to = find_assignment_target(node, context.source_code, language);
  
  return {
    constructor_name,
    location: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    file_path: context.file_path,
    arguments_count: count_python_arguments(node),
    assigned_to: assigned_to || undefined,
    is_new_expression: false, // Python doesn't use 'new'
    is_factory_method: false
  };
}

/**
 * Count Python constructor arguments (excluding self)
 */
function count_python_arguments(node: SyntaxNode): number {
  const args_node = node.childForFieldName('arguments');
  if (!args_node) return 0;
  
  let count = 0;
  for (let i = 0; i < args_node.childCount; i++) {
    const child = args_node.child(i);
    if (child && 
        child.type !== '(' && 
        child.type !== ')' && 
        child.type !== ',' &&
        child.type !== 'comment') {
      // Count both positional and keyword arguments
      if (child.type === 'keyword_argument' || child.type !== 'keyword_argument') {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Get type assignments from constructor calls
 */
export function get_type_assignments_python(
  context: ConstructorCallContext
): TypeAssignment[] {
  const assignments: TypeAssignment[] = [];
  const calls = find_constructor_calls_python(context);
  
  for (const call of calls) {
    if (call.assigned_to) {
      const scope = get_assignment_scope_python(context.ast_root, call.location, context.source_code);
      const assignment = create_type_assignment(call, call.assigned_to, scope);
      assignments.push(assignment);
    }
  }
  
  return assignments;
}

/**
 * Get the scope of an assignment at a specific location
 */
function get_assignment_scope_python(
  root: SyntaxNode,
  location: { row: number; column: number },
  source: string
): 'local' | 'global' | 'member' {
  // Find the node at this location
  const node = root.descendantForPosition(
    { row: location.row, column: location.column },
    { row: location.row, column: location.column + 1 }
  );
  
  if (!node) return 'global';
  
  // Check for self.attribute assignment
  let current = node.parent;
  while (current) {
    if (current.type === 'assignment') {
      const left = current.child(0);
      if (left && left.type === 'attribute') {
        const object = left.childForFieldName('object');
        if (object && object.text === 'self') {
          return 'member';
        }
      }
    }
    current = current.parent;
  }
  
  return get_assignment_scope(node, 'python');
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
 * Python-specific: Check if it's a dataclass instantiation
 */
function is_dataclass_instantiation(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'call') return false;
  
  const func = node.childForFieldName('func');
  if (func && func.type === 'identifier') {
    const name = source.substring(func.startIndex, func.endIndex);
    // Dataclasses are typically capitalized
    // This is a heuristic - would need decorator analysis for certainty
    return /^[A-Z]/.test(name);
  }
  
  return false;
}

/**
 * Python-specific: Check for super().__init__() call
 */
export function is_super_init_call(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'call') return false;
  
  const func = node.childForFieldName('func');
  if (func && func.type === 'attribute') {
    const object = func.childForFieldName('object');
    const attr = func.childForFieldName('attr');
    
    if (object && object.type === 'call') {
      const super_func = object.childForFieldName('func');
      if (super_func && super_func.type === 'identifier') {
        const func_name = source.substring(super_func.startIndex, super_func.endIndex);
        if (func_name === 'super' && attr) {
          const method_name = source.substring(attr.startIndex, attr.endIndex);
          return method_name === '__init__';
        }
      }
    }
  }
  
  return false;
}

/**
 * Python-specific: Check for metaclass instantiation
 */
export function is_metaclass_instantiation(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'call') return false;
  
  const func = node.childForFieldName('func');
  if (func && func.type === 'identifier') {
    const name = source.substring(func.startIndex, func.endIndex);
    // Common metaclass names
    return ['type', 'ABCMeta', 'MetaClass'].includes(name);
  }
  
  return false;
}

/**
 * Python-specific: Check for namedtuple creation
 */
export function is_namedtuple_creation(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'call') return false;
  
  const func = node.childForFieldName('func');
  if (func) {
    if (func.type === 'identifier') {
      const name = source.substring(func.startIndex, func.endIndex);
      return name === 'namedtuple';
    }
    if (func.type === 'attribute') {
      const attr = func.childForFieldName('attr');
      if (attr) {
        const name = source.substring(attr.startIndex, attr.endIndex);
        return name === 'namedtuple';
      }
    }
  }
  
  return false;
}

/**
 * Python-specific: Extract __init__ parameters as class fields
 */
export function extract_init_parameters(
  node: SyntaxNode,
  source: string
): string[] {
  if (node.type !== 'function_definition') return [];
  
  const name = node.childForFieldName('name');
  if (!name || name.text !== '__init__') return [];
  
  const params = node.childForFieldName('parameters');
  if (!params) return [];
  
  const fields: string[] = [];
  
  for (let i = 0; i < params.childCount; i++) {
    const param = params.child(i);
    if (param && param.type === 'identifier' && param.text !== 'self') {
      fields.push(param.text);
    }
    if (param && param.type === 'default_parameter') {
      const name = param.childForFieldName('name');
      if (name && name.text !== 'self') {
        fields.push(name.text);
      }
    }
  }
  
  return fields;
}