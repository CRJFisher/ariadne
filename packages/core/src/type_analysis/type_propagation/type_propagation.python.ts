/**
 * Python-specific type propagation
 * 
 * Handles Python type flow patterns including:
 * - Type hints and annotations
 * - Duck typing patterns
 * - Dynamic type assignment
 * - Type narrowing through isinstance/type checks
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
 * Propagate types through Python-specific constructs
 */
export function propagate_python_types(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  let flows: TypeFlow[] = [];
  
  // Handle different node types
  switch (node.type) {
    case 'assignment':
      flows = handle_python_assignment(node, context);
      break;
    
    case 'annotated_assignment':
      flows = handle_annotated_assignment(node, context);
      break;
    
    case 'augmented_assignment':
      flows = handle_augmented_assignment(node, context);
      break;
    
    case 'call':
      flows = handle_python_call(node, context);
      break;
    
    case 'attribute':
      flows = handle_attribute_access(node, context);
      break;
    
    case 'list':
    case 'list_comprehension':
      flows = handle_list_expression(node, context);
      break;
    
    case 'dictionary':
    case 'dictionary_comprehension':
      flows = handle_dict_expression(node, context);
      break;
    
    case 'set':
    case 'set_comprehension':
      flows = handle_set_expression(node, context);
      break;
    
    case 'tuple':
      flows = handle_tuple_expression(node, context);
      break;
    
    case 'lambda':
      flows = handle_lambda_expression(node, context);
      break;
    
    case 'conditional_expression':
      flows = handle_conditional_expression(node, context);
      break;
  }
  
  // Handle type narrowing in control flow
  const narrowing_flows = handle_python_type_narrowing(node, context);
  flows = merge_type_flows(flows, narrowing_flows);
  
  return flows;
}

/**
 * Handle Python assignment
 */
function handle_python_assignment(
  assign_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const left = assign_node.childForFieldName('left');
  const right = assign_node.childForFieldName('right');
  
  if (left && right) {
    // Handle multiple assignment targets
    if (left.type === 'pattern_list' || left.type === 'tuple_pattern') {
      // Handle tuple unpacking
      flows.push(...handle_tuple_unpacking(left, right, context));
    } else if (left.type === 'identifier') {
      const target = source_code.substring(left.startIndex, left.endIndex);
      const inferred_type = infer_expression_type(right, context);
      
      if (inferred_type) {
        flows.push({
          source_type: inferred_type,
          target_identifier: target,
          flow_kind: 'assignment',
          confidence: 'inferred',
          position: {
            row: assign_node.startPosition.row,
            column: assign_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle annotated assignment (with type hints)
 */
function handle_annotated_assignment(
  assign_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const left = assign_node.childForFieldName('left');
  const type = assign_node.childForFieldName('type');
  const right = assign_node.childForFieldName('right');
  
  if (left && left.type === 'identifier') {
    const target = source_code.substring(left.startIndex, left.endIndex);
    
    if (type) {
      // Explicit type annotation
      const type_text = extract_python_type(type, source_code);
      flows.push({
        source_type: type_text,
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: assign_node.startPosition.row,
          column: assign_node.startPosition.column
        }
      });
    } else if (right) {
      // Infer from value
      const inferred_type = infer_expression_type(right, context);
      if (inferred_type) {
        flows.push({
          source_type: inferred_type,
          target_identifier: target,
          flow_kind: 'assignment',
          confidence: 'inferred',
          position: {
            row: assign_node.startPosition.row,
            column: assign_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle augmented assignment (+=, -=, etc.)
 */
function handle_augmented_assignment(
  assign_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const left = assign_node.childForFieldName('left');
  const operator = assign_node.childForFieldName('operator');
  
  if (left && left.type === 'identifier' && operator) {
    const target = source_code.substring(left.startIndex, left.endIndex);
    const op = operator.text;
    
    // Numeric operations preserve numeric types
    if (['+', '-', '*', '/', '//', '%', '**'].some(o => op.startsWith(o))) {
      // Type remains numeric (int or float)
      flows.push({
        source_type: 'int | float',
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'inferred',
        position: {
          row: assign_node.startPosition.row,
          column: assign_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle Python function calls
 */
function handle_python_call(
  call_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const func = call_node.childForFieldName('function');
  if (func) {
    const func_name = source_code.substring(func.startIndex, func.endIndex);
    
    // Handle built-in type constructors
    if (is_python_type_constructor(func_name)) {
      const type = get_python_type_from_constructor(func_name);
      if (type) {
        const parent = call_node.parent;
        if (parent && is_assignment_target(parent)) {
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
    
    // Handle dataclass/namedtuple constructors
    if (func.type === 'identifier') {
      const parent = call_node.parent;
      if (parent && is_assignment_target(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target && is_class_constructor_pattern(func_name)) {
          flows.push({
            source_type: func_name,
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
  }
  
  return flows;
}

/**
 * Handle attribute access
 */
function handle_attribute_access(
  attr_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const object = attr_node.childForFieldName('object');
  const attribute = attr_node.childForFieldName('attribute');
  
  if (object && attribute) {
    const attr_name = source_code.substring(attribute.startIndex, attribute.endIndex);
    
    // Handle known attribute patterns
    if (['__class__', '__name__', '__module__'].includes(attr_name)) {
      const type = attr_name === '__class__' ? 'type' : 'str';
      const parent = attr_node.parent;
      if (parent && is_assignment_target(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target) {
          flows.push({
            source_type: type,
            target_identifier: target,
            flow_kind: 'property',
            confidence: 'explicit',
            position: {
              row: attr_node.startPosition.row,
              column: attr_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle list expressions and comprehensions
 */
function handle_list_expression(
  list_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = list_node.parent;
  if (parent && is_assignment_target(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: 'list',
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: list_node.startPosition.row,
          column: list_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle dictionary expressions and comprehensions
 */
function handle_dict_expression(
  dict_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = dict_node.parent;
  if (parent && is_assignment_target(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: 'dict',
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: dict_node.startPosition.row,
          column: dict_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle set expressions and comprehensions
 */
function handle_set_expression(
  set_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = set_node.parent;
  if (parent && is_assignment_target(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: 'set',
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: set_node.startPosition.row,
          column: set_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle tuple expressions
 */
function handle_tuple_expression(
  tuple_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = tuple_node.parent;
  if (parent && is_assignment_target(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: 'tuple',
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
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
 * Handle lambda expressions
 */
function handle_lambda_expression(
  lambda_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = lambda_node.parent;
  if (parent && is_assignment_target(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: 'Callable',
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: lambda_node.startPosition.row,
          column: lambda_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle conditional expressions (ternary)
 */
function handle_conditional_expression(
  cond_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const consequence = cond_node.childForFieldName('consequence');
  const alternative = cond_node.childForFieldName('alternative');
  
  if (consequence && alternative) {
    const cons_type = infer_expression_type(consequence, context);
    const alt_type = infer_expression_type(alternative, context);
    
    if (cons_type && cons_type === alt_type) {
      const parent = cond_node.parent;
      if (parent && is_assignment_target(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target) {
          flows.push({
            source_type: cons_type,
            target_identifier: target,
            flow_kind: 'assignment',
            confidence: 'inferred',
            position: {
              row: cond_node.startPosition.row,
              column: cond_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle tuple unpacking
 */
function handle_tuple_unpacking(
  pattern: SyntaxNode,
  value: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Extract target variables from pattern
  const targets: string[] = [];
  function extract_targets(node: SyntaxNode) {
    if (node.type === 'identifier') {
      targets.push(source_code.substring(node.startIndex, node.endIndex));
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) extract_targets(child);
    }
  }
  extract_targets(pattern);
  
  // If unpacking from a tuple/list, all targets get the element type
  const value_type = infer_expression_type(value, context);
  if (value_type && (value_type === 'tuple' || value_type === 'list')) {
    for (const target of targets) {
      flows.push({
        source_type: 'Any',  // Conservative: we don't know element types
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'assumed',
        position: {
          row: pattern.startPosition.row,
          column: pattern.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle Python type narrowing
 */
function handle_python_type_narrowing(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  if (node.type === 'if_statement') {
    const condition = node.childForFieldName('condition');
    if (condition) {
      // Check for isinstance checks
      const isinstance_check = extract_isinstance_check(condition, context);
      if (isinstance_check) {
        flows.push({
          source_type: isinstance_check.type,
          target_identifier: isinstance_check.variable,
          flow_kind: 'narrowing',
          confidence: 'explicit',
          position: {
            row: condition.startPosition.row,
            column: condition.startPosition.column
          }
        });
      }
      
      // Check for type() checks
      const type_check = extract_type_check(condition, context);
      if (type_check) {
        flows.push({
          source_type: type_check.type,
          target_identifier: type_check.variable,
          flow_kind: 'narrowing',
          confidence: 'explicit',
          position: {
            row: condition.startPosition.row,
            column: condition.startPosition.column
          }
        });
      }
      
      // Check for hasattr checks
      const hasattr_check = extract_hasattr_check(condition, context);
      if (hasattr_check) {
        flows.push({
          source_type: `HasAttr[${hasattr_check.attribute}]`,
          target_identifier: hasattr_check.variable,
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
 * Extract isinstance check
 */
function extract_isinstance_check(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; type: string } | undefined {
  const { source_code } = context;
  
  if (condition.type === 'call') {
    const func = condition.childForFieldName('function');
    const args = condition.childForFieldName('arguments');
    
    if (func && func.type === 'identifier' && args) {
      const func_name = source_code.substring(func.startIndex, func.endIndex);
      if (func_name === 'isinstance') {
        // Extract variable and type from arguments
        let variable: string | undefined;
        let type_arg: string | undefined;
        let arg_count = 0;
        
        for (let i = 0; i < args.childCount; i++) {
          const arg = args.child(i);
          if (arg && arg.type !== ',' && arg.type !== '(' && arg.type !== ')') {
            if (arg_count === 0 && arg.type === 'identifier') {
              variable = source_code.substring(arg.startIndex, arg.endIndex);
            } else if (arg_count === 1) {
              type_arg = source_code.substring(arg.startIndex, arg.endIndex);
            }
            arg_count++;
          }
        }
        
        if (variable && type_arg) {
          return { variable, type: type_arg };
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract type() check
 */
function extract_type_check(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; type: string } | undefined {
  const { source_code } = context;
  
  if (condition.type === 'comparison_operator') {
    const left = condition.childForFieldName('left');
    const right = condition.childForFieldName('right');
    
    if (left && right) {
      // Check for type(x) == SomeType
      if (left.type === 'call') {
        const func = left.childForFieldName('function');
        const args = left.childForFieldName('arguments');
        
        if (func && func.type === 'identifier' && args) {
          const func_name = source_code.substring(func.startIndex, func.endIndex);
          if (func_name === 'type') {
            // Extract variable from arguments
            for (let i = 0; i < args.childCount; i++) {
              const arg = args.child(i);
              if (arg && arg.type === 'identifier') {
                const variable = source_code.substring(arg.startIndex, arg.endIndex);
                const type = source_code.substring(right.startIndex, right.endIndex);
                return { variable, type };
              }
            }
          }
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract hasattr check
 */
function extract_hasattr_check(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; attribute: string } | undefined {
  const { source_code } = context;
  
  if (condition.type === 'call') {
    const func = condition.childForFieldName('function');
    const args = condition.childForFieldName('arguments');
    
    if (func && func.type === 'identifier' && args) {
      const func_name = source_code.substring(func.startIndex, func.endIndex);
      if (func_name === 'hasattr') {
        let variable: string | undefined;
        let attribute: string | undefined;
        let arg_count = 0;
        
        for (let i = 0; i < args.childCount; i++) {
          const arg = args.child(i);
          if (arg && arg.type !== ',' && arg.type !== '(' && arg.type !== ')') {
            if (arg_count === 0 && arg.type === 'identifier') {
              variable = source_code.substring(arg.startIndex, arg.endIndex);
            } else if (arg_count === 1 && arg.type === 'string') {
              attribute = source_code.substring(arg.startIndex + 1, arg.endIndex - 1);
            }
            arg_count++;
          }
        }
        
        if (variable && attribute) {
          return { variable, attribute };
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract Python type from type annotation
 */
function extract_python_type(type_node: SyntaxNode, source_code: string): string {
  return source_code.substring(type_node.startIndex, type_node.endIndex);
}

/**
 * Check if node is assignment target
 */
function is_assignment_target(node: SyntaxNode): boolean {
  return node.type === 'assignment' ||
         node.type === 'annotated_assignment' ||
         node.type === 'augmented_assignment' ||
         (node.parent !== null && is_assignment_target(node.parent));
}

/**
 * Extract assignment target
 */
function extract_assignment_target(
  node: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { source_code } = context;
  
  if (node.type === 'assignment' || node.type === 'annotated_assignment') {
    const left = node.childForFieldName('left');
    if (left && left.type === 'identifier') {
      return source_code.substring(left.startIndex, left.endIndex);
    }
  } else if (node.type === 'augmented_assignment') {
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
 * Check if name is a Python type constructor
 */
function is_python_type_constructor(name: string): boolean {
  return ['int', 'float', 'str', 'bool', 'list', 'dict', 'set', 
          'tuple', 'bytes', 'bytearray', 'complex', 'frozenset'].includes(name);
}

/**
 * Get type from Python constructor
 */
function get_python_type_from_constructor(name: string): string | undefined {
  const type_map: Record<string, string> = {
    'int': 'int',
    'float': 'float',
    'str': 'str',
    'bool': 'bool',
    'list': 'list',
    'dict': 'dict',
    'set': 'set',
    'tuple': 'tuple',
    'bytes': 'bytes',
    'bytearray': 'bytearray',
    'complex': 'complex',
    'frozenset': 'frozenset'
  };
  return type_map[name];
}

/**
 * Check if name follows class constructor pattern
 */
function is_class_constructor_pattern(name: string): boolean {
  // Capitalized names are likely classes
  return /^[A-Z]/.test(name);
}

/**
 * Handle Python context managers (with statements)
 */
export function handle_with_statement(
  with_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const item = with_node.childForFieldName('item');
  if (item) {
    // Look for 'as' clause
    const as_pattern = item.childForFieldName('as_pattern');
    if (as_pattern && as_pattern.type === 'as_pattern') {
      const alias = as_pattern.childForFieldName('alias');
      const value = item.childForFieldName('value');
      
      if (alias && alias.type === 'identifier' && value) {
        const target = source_code.substring(alias.startIndex, alias.endIndex);
        
        // Common context managers
        if (value.type === 'call') {
          const func = value.childForFieldName('function');
          if (func) {
            const func_name = source_code.substring(func.startIndex, func.endIndex);
            let inferred_type: string | undefined;
            
            if (func_name === 'open') {
              inferred_type = 'TextIOWrapper';
            } else if (func_name.endsWith('Lock') || func_name.endsWith('Semaphore')) {
              inferred_type = 'Lock';
            }
            
            if (inferred_type) {
              flows.push({
                source_type: inferred_type,
                target_identifier: target,
                flow_kind: 'assignment',
                confidence: 'inferred',
                position: {
                  row: with_node.startPosition.row,
                  column: with_node.startPosition.column
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