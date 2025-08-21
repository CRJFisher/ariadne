/**
 * Rust-specific type propagation
 * 
 * Handles Rust type flow patterns including:
 * - Static typing with inference
 * - Ownership and borrowing
 * - Pattern matching type refinement
 * - Generic type propagation
 */

// TODO: Module Graph - Propagate types across module boundaries

import { SyntaxNode } from 'tree-sitter';
import {
  TypeFlow,
  PropagationPath,
  TypePropagationContext,
  propagate_assignment_types,
  propagate_return_types,
  propagate_parameter_types,
  propagate_property_types,
  infer_expression_type,
  merge_type_flows
} from './type_propagation';

/**
 * Propagate types through Rust-specific constructs
 */
export function propagate_rust_types(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  let flows: TypeFlow[] = [];
  
  // Handle different node types
  switch (node.type) {
    case 'let_declaration':
      flows = handle_let_declaration(node, context);
      break;
    
    case 'assignment_expression':
      flows = propagate_assignment_types(node, context);
      break;
    
    case 'call_expression':
      flows = handle_rust_call(node, context);
      break;
    
    case 'field_expression':
      flows = handle_field_access(node, context);
      break;
    
    case 'match_expression':
      flows = handle_match_expression(node, context);
      break;
    
    case 'if_let_expression':
      flows = handle_if_let_expression(node, context);
      break;
    
    case 'while_let_expression':
      flows = handle_while_let_expression(node, context);
      break;
    
    case 'reference_expression':
    case 'dereference_expression':
      flows = handle_reference_operations(node, context);
      break;
    
    case 'try_expression':
      flows = handle_try_expression(node, context);
      break;
    
    case 'array_expression':
    case 'vec_macro':
      flows = handle_collection_expressions(node, context);
      break;
    
    case 'struct_expression':
      flows = handle_struct_expression(node, context);
      break;
    
    case 'tuple_expression':
      flows = handle_tuple_expression(node, context);
      break;
    
    case 'closure_expression':
      flows = handle_closure_expression(node, context);
      break;
  }
  
  // Handle type narrowing through pattern matching
  const narrowing_flows = handle_pattern_type_narrowing(node, context);
  flows = merge_type_flows(flows, narrowing_flows);
  
  return flows;
}

/**
 * Handle let declaration with type annotation or inference
 */
function handle_let_declaration(
  let_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const pattern = let_node.childForFieldName('pattern');
  const type = let_node.childForFieldName('type');
  const value = let_node.childForFieldName('value');
  
  if (pattern) {
    const targets = extract_pattern_bindings(pattern, context);
    
    for (const target of targets) {
      if (type) {
        // Explicit type annotation
        const type_text = extract_rust_type(type, source_code);
        flows.push({
          source_type: type_text,
          target_identifier: target,
          flow_kind: 'assignment',
          confidence: 'explicit',
          position: {
            row: let_node.startPosition.row,
            column: let_node.startPosition.column
          }
        });
      } else if (value) {
        // Type inference from value
        const inferred_type = infer_rust_expression_type(value, context);
        if (inferred_type) {
          flows.push({
            source_type: inferred_type,
            target_identifier: target,
            flow_kind: 'assignment',
            confidence: 'inferred',
            position: {
              row: let_node.startPosition.row,
              column: let_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle Rust function calls
 */
function handle_rust_call(
  call_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const func = call_node.childForFieldName('function');
  const type_arguments = call_node.childForFieldName('type_arguments');
  
  if (func) {
    const func_name = source_code.substring(func.startIndex, func.endIndex);
    
    // Handle standard library type constructors
    if (is_rust_type_constructor(func_name)) {
      const type = get_rust_type_from_constructor(func_name, type_arguments, context);
      if (type) {
        const parent = call_node.parent;
        if (parent && is_assignment_context(parent)) {
          const target = extract_assignment_target(parent, context);
          if (target) {
            flows.push({
              source_type: type,
              target_identifier: target,
              flow_kind: 'return',
              confidence: 'explicit',
              position: {
                row: call_node.startPosition.row,
                column: call_node.startPosition.column
              }
            });
          }
        }
      }
    }
    
    // Handle method calls on known types
    if (func.type === 'field_expression') {
      const field = func.childForFieldName('field');
      if (field) {
        const method_name = source_code.substring(field.startIndex, field.endIndex);
        flows.push(...handle_method_return_type(call_node, method_name, context));
      }
    }
  }
  
  return flows;
}

/**
 * Handle field access
 */
function handle_field_access(
  field_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const value = field_node.childForFieldName('value');
  const field = field_node.childForFieldName('field');
  
  if (value && field) {
    const field_name = source_code.substring(field.startIndex, field.endIndex);
    
    // Handle tuple field access (0, 1, 2, etc.)
    if (/^\d+$/.test(field_name)) {
      const parent = field_node.parent;
      if (parent && is_assignment_context(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target) {
          // We don't know the exact type of tuple elements
          flows.push({
            source_type: 'T',  // Generic type
            target_identifier: target,
            flow_kind: 'property',
            confidence: 'assumed',
            position: {
              row: field_node.startPosition.row,
              column: field_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle match expression
 */
function handle_match_expression(
  match_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const body = match_node.childForFieldName('body');
  if (body) {
    // Analyze each match arm
    for (let i = 0; i < body.childCount; i++) {
      const child = body.child(i);
      if (child && child.type === 'match_arm') {
        const pattern = child.childForFieldName('pattern');
        const value = child.childForFieldName('value');
        
        if (pattern && value) {
          // Extract bindings from pattern
          const bindings = extract_pattern_bindings(pattern, context);
          
          // Infer types from pattern matching
          for (const binding of bindings) {
            const pattern_type = infer_pattern_type(pattern, context);
            if (pattern_type) {
              flows.push({
                source_type: pattern_type,
                target_identifier: binding,
                flow_kind: 'narrowing',
                confidence: 'inferred',
                position: {
                  row: pattern.startPosition.row,
                  column: pattern.startPosition.column
                }
              });
            }
          }
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle if let expression
 */
function handle_if_let_expression(
  if_let_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const pattern = if_let_node.childForFieldName('pattern');
  const value = if_let_node.childForFieldName('value');
  
  if (pattern && value) {
    const bindings = extract_pattern_bindings(pattern, context);
    const value_type = infer_rust_expression_type(value, context);
    
    for (const binding of bindings) {
      if (value_type) {
        flows.push({
          source_type: value_type,
          target_identifier: binding,
          flow_kind: 'narrowing',
          confidence: 'inferred',
          position: {
            row: pattern.startPosition.row,
            column: pattern.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle while let expression
 */
function handle_while_let_expression(
  while_let_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  // Similar to if_let
  return handle_if_let_expression(while_let_node, context);
}

/**
 * Handle reference and dereference operations
 */
function handle_reference_operations(
  ref_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = ref_node.parent;
  if (parent && is_assignment_context(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      const value = ref_node.childForFieldName('value');
      if (value) {
        const value_type = infer_rust_expression_type(value, context);
        if (value_type) {
          const type = ref_node.type === 'reference_expression' 
            ? `&${value_type}` 
            : value_type.replace(/^&/, '');  // Remove reference
            
          flows.push({
            source_type: type,
            target_identifier: target,
            flow_kind: 'assignment',
            confidence: 'inferred',
            position: {
              row: ref_node.startPosition.row,
              column: ref_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle try expression (? operator)
 */
function handle_try_expression(
  try_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = try_node.parent;
  if (parent && is_assignment_context(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      const expr = try_node.child(0);  // The expression before ?
      if (expr) {
        const expr_type = infer_rust_expression_type(expr, context);
        if (expr_type) {
          // Try expression unwraps Result<T, E> or Option<T> to T
          let unwrapped_type = expr_type;
          if (expr_type.startsWith('Result<')) {
            unwrapped_type = extract_generic_arg(expr_type, 0);
          } else if (expr_type.startsWith('Option<')) {
            unwrapped_type = extract_generic_arg(expr_type, 0);
          }
          
          flows.push({
            source_type: unwrapped_type,
            target_identifier: target,
            flow_kind: 'assignment',
            confidence: 'inferred',
            position: {
              row: try_node.startPosition.row,
              column: try_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle collection expressions (arrays, vecs)
 */
function handle_collection_expressions(
  coll_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = coll_node.parent;
  if (parent && is_assignment_context(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      const type = coll_node.type === 'array_expression' ? '[T]' : 'Vec<T>';
      flows.push({
        source_type: type,
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'inferred',
        position: {
          row: coll_node.startPosition.row,
          column: coll_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle struct expression
 */
function handle_struct_expression(
  struct_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const name = struct_node.childForFieldName('name');
  if (name) {
    const struct_name = source_code.substring(name.startIndex, name.endIndex);
    
    const parent = struct_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: struct_name,
          target_identifier: target,
          flow_kind: 'assignment',
          confidence: 'explicit',
          position: {
            row: struct_node.startPosition.row,
            column: struct_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle tuple expression
 */
function handle_tuple_expression(
  tuple_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = tuple_node.parent;
  if (parent && is_assignment_context(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      // Count tuple elements to determine arity
      let element_count = 0;
      for (let i = 0; i < tuple_node.childCount; i++) {
        const child = tuple_node.child(i);
        if (child && child.type !== ',' && child.type !== '(' && child.type !== ')') {
          element_count++;
        }
      }
      
      const type = element_count === 0 ? '()' : `(${Array(element_count).fill('T').join(', ')})`;
      flows.push({
        source_type: type,
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'inferred',
        position: {
          row: tuple_node.startPosition.row,
          column: tuple_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle closure expression
 */
function handle_closure_expression(
  closure_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = closure_node.parent;
  if (parent && is_assignment_context(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: 'Fn',  // Generic closure type
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'inferred',
        position: {
          row: closure_node.startPosition.row,
          column: closure_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle pattern type narrowing
 */
function handle_pattern_type_narrowing(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  if (node.type === 'if_expression') {
    const condition = node.childForFieldName('condition');
    if (condition) {
      // Check for pattern matching in conditions
      const pattern_check = extract_pattern_check(condition, context);
      if (pattern_check) {
        flows.push({
          source_type: pattern_check.type,
          target_identifier: pattern_check.variable,
          flow_kind: 'narrowing',
          confidence: 'inferred',
          position: {
            row: condition.startPosition.row,
            column: condition.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Extract pattern bindings
 */
function extract_pattern_bindings(
  pattern: SyntaxNode,
  context: TypePropagationContext
): string[] {
  const bindings: string[] = [];
  const { source_code } = context;
  
  function traverse(node: SyntaxNode) {
    if (node.type === 'identifier' || node.type === 'shorthand_field_identifier') {
      bindings.push(source_code.substring(node.startIndex, node.endIndex));
    } else if (node.type === 'tuple_pattern' || node.type === 'struct_pattern') {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) traverse(child);
      }
    }
  }
  
  traverse(pattern);
  return bindings;
}

/**
 * Infer type from pattern
 */
function infer_pattern_type(
  pattern: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { source_code } = context;
  
  if (pattern.type === 'tuple_struct_pattern') {
    const type = pattern.childForFieldName('type');
    if (type) {
      return source_code.substring(type.startIndex, type.endIndex);
    }
  } else if (pattern.type === 'struct_pattern') {
    const type = pattern.childForFieldName('type');
    if (type) {
      return source_code.substring(type.startIndex, type.endIndex);
    }
  }
  
  return undefined;
}

/**
 * Infer Rust expression type
 */
function infer_rust_expression_type(
  expr: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { source_code } = context;
  
  switch (expr.type) {
    case 'string_literal':
      return '&str';
    case 'char_literal':
      return 'char';
    case 'integer_literal':
      return 'i32';  // Default integer type
    case 'float_literal':
      return 'f64';  // Default float type
    case 'boolean_literal':
      return 'bool';
    case 'unit_expression':
      return '()';
    case 'array_expression':
      return '[T]';
    case 'tuple_expression':
      return '()';  // Would need more analysis for exact tuple type
    case 'struct_expression':
      const name = expr.childForFieldName('name');
      if (name) {
        return source_code.substring(name.startIndex, name.endIndex);
      }
      break;
  }
  
  return infer_expression_type(expr, context);
}

/**
 * Extract pattern check from condition
 */
function extract_pattern_check(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; type: string } | undefined {
  const { source_code } = context;
  
  // Check for matches! macro
  if (condition.type === 'macro_invocation') {
    const macro = condition.childForFieldName('macro');
    if (macro) {
      const macro_name = source_code.substring(macro.startIndex, macro.endIndex);
      if (macro_name === 'matches') {
        // Parse matches!(expr, pattern)
        // This would require more complex parsing
        return undefined;
      }
    }
  }
  
  return undefined;
}

/**
 * Extract Rust type text
 */
function extract_rust_type(type_node: SyntaxNode, source_code: string): string {
  return source_code.substring(type_node.startIndex, type_node.endIndex);
}

/**
 * Check if node is assignment context
 */
function is_assignment_context(node: SyntaxNode): boolean {
  return node.type === 'let_declaration' ||
         node.type === 'assignment_expression' ||
         (node.parent !== null && is_assignment_context(node.parent));
}

/**
 * Extract assignment target
 */
function extract_assignment_target(
  node: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { source_code } = context;
  
  if (node.type === 'let_declaration') {
    const pattern = node.childForFieldName('pattern');
    if (pattern && pattern.type === 'identifier') {
      return source_code.substring(pattern.startIndex, pattern.endIndex);
    }
  } else if (node.type === 'assignment_expression') {
    const left = node.childForFieldName('left');
    if (left && left.type === 'identifier') {
      return source_code.substring(left.startIndex, left.endIndex);
    }
  } else if (node.parent) {
    return extract_assignment_target(node.parent, context);
  }
  
  return undefined;
}

/**
 * Check if name is Rust type constructor
 */
function is_rust_type_constructor(name: string): boolean {
  return ['Vec::new', 'HashMap::new', 'HashSet::new', 'String::new',
          'Box::new', 'Rc::new', 'Arc::new', 'RefCell::new',
          'Some', 'None', 'Ok', 'Err'].includes(name);
}

/**
 * Get type from Rust constructor
 */
function get_rust_type_from_constructor(
  name: string,
  type_args: SyntaxNode | null,
  context: TypePropagationContext
): string | undefined {
  const { source_code } = context;
  
  const base_types: Record<string, string> = {
    'Vec::new': 'Vec',
    'HashMap::new': 'HashMap',
    'HashSet::new': 'HashSet',
    'String::new': 'String',
    'Box::new': 'Box',
    'Rc::new': 'Rc',
    'Arc::new': 'Arc',
    'RefCell::new': 'RefCell',
    'Some': 'Option',
    'None': 'Option',
    'Ok': 'Result',
    'Err': 'Result'
  };
  
  const base = base_types[name];
  if (base) {
    if (type_args) {
      const args_text = source_code.substring(type_args.startIndex, type_args.endIndex);
      return `${base}${args_text}`;
    }
    return base;
  }
  
  return undefined;
}

/**
 * Handle method return types
 */
function handle_method_return_type(
  call_node: SyntaxNode,
  method_name: string,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  // Common iterator methods
  const iterator_methods: Record<string, string> = {
    'collect': 'Vec<T>',
    'map': 'impl Iterator',
    'filter': 'impl Iterator',
    'fold': 'T',
    'reduce': 'Option<T>',
    'sum': 'T',
    'product': 'T',
    'count': 'usize',
    'any': 'bool',
    'all': 'bool',
    'find': 'Option<T>',
    'position': 'Option<usize>',
    'max': 'Option<T>',
    'min': 'Option<T>'
  };
  
  const return_type = iterator_methods[method_name];
  if (return_type) {
    const parent = call_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: return_type,
          target_identifier: target,
          flow_kind: 'return',
          confidence: 'inferred',
          position: {
            row: call_node.startPosition.row,
            column: call_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Extract generic argument at index
 */
function extract_generic_arg(type_str: string, index: number): string {
  const match = type_str.match(/<(.+)>/);
  if (match) {
    const args = match[1].split(',').map(s => s.trim());
    return args[index] || 'T';
  }
  return 'T';
}