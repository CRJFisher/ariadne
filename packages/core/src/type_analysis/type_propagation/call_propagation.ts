/**
 * Type propagation through call graphs
 * 
 * Propagates type information through function, method, and constructor calls
 */

import { 
  FunctionCallInfo, 
  MethodCallInfo, 
  ConstructorCallInfo,
  TypeInfo
} from '@ariadnejs/types';
import { TypeFlow, TypePropagationContext } from './type_propagation';

/**
 * Propagate types through function calls
 * 
 * Handles:
 * - Parameter type flow from arguments to parameters
 * - Return type flow from function to call site
 * - Callback type propagation
 */
export function propagate_function_call_types(
  function_calls: FunctionCallInfo[],
  context: TypePropagationContext,
  type_map?: Map<string, TypeInfo[]>
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  for (const call of function_calls) {
    // Flow types from arguments to parameters
    if (call.arguments) {
      call.arguments.forEach((arg, index) => {
        // If we know the argument type, it flows to the parameter
        const arg_type = infer_argument_type(arg, context, type_map);
        if (arg_type) {
          flows.push({
            source_type: arg_type,
            target_identifier: `${call.function_name}#param${index}`,
            flow_kind: 'parameter',
            confidence: 'inferred',
            position: {
              row: call.location.line,
              column: call.location.column
            }
          });
        }
      });
    }
    
    // Flow return type to call site (if assigned)
    // This would need return type inference integration
    const return_type = get_function_return_type(call.function_name, context);
    if (return_type) {
      flows.push({
        source_type: return_type,
        target_identifier: `${call.function_name}#return`,
        flow_kind: 'return',
        confidence: 'inferred',
        position: {
          row: call.location.line,
          column: call.location.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Propagate types through method calls
 * 
 * Handles:
 * - Receiver type validation
 * - Method parameter type flow
 * - Return type based on receiver type
 * - Chained method calls
 */
export function propagate_method_call_types(
  method_calls: MethodCallInfo[],
  context: TypePropagationContext,
  type_map?: Map<string, TypeInfo[]>,
  class_hierarchy?: any
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  for (const call of method_calls) {
    // Flow receiver type
    if (call.receiver_type) {
      flows.push({
        source_type: call.receiver_type,
        target_identifier: `${call.receiver}.${call.method_name}#this`,
        flow_kind: 'parameter',
        confidence: 'explicit',
        position: {
          row: call.location.line,
          column: call.location.column
        }
      });
    }
    
    // Flow argument types to method parameters
    if (call.arguments) {
      call.arguments.forEach((arg, index) => {
        const arg_type = infer_argument_type(arg, context, type_map);
        if (arg_type) {
          flows.push({
            source_type: arg_type,
            target_identifier: `${call.method_name}#param${index}`,
            flow_kind: 'parameter',
            confidence: 'inferred',
            position: {
              row: call.location.line,
              column: call.location.column
            }
          });
        }
      });
    }
    
    // Flow return type for chained calls
    const method_return_type = get_method_return_type(
      call.receiver_type || 'unknown',
      call.method_name,
      context,
      class_hierarchy
    );
    
    if (method_return_type) {
      flows.push({
        source_type: method_return_type,
        target_identifier: `${call.receiver}.${call.method_name}#return`,
        flow_kind: 'return',
        confidence: 'inferred',
        position: {
          row: call.location.line,
          column: call.location.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Propagate types through constructor calls
 * 
 * Handles:
 * - Instance type creation
 * - Constructor parameter type flow
 * - Type assignment to variables
 */
export function propagate_constructor_call_types(
  constructor_calls: ConstructorCallInfo[],
  context: TypePropagationContext,
  type_registry?: any
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  for (const call of constructor_calls) {
    // The constructed type flows to the assignment target
    const instance_type = call.class_name;
    
    // If this constructor is assigned to a variable, track that flow
    // This would need integration with assignment tracking
    flows.push({
      source_type: instance_type,
      target_identifier: `new_${instance_type}`,
      flow_kind: 'assignment',
      confidence: 'explicit',
      position: {
        row: call.location.line,
        column: call.location.column
      }
    });
    
    // Flow argument types to constructor parameters
    if (call.arguments) {
      call.arguments.forEach((arg, index) => {
        const arg_type = infer_argument_type(arg, context);
        if (arg_type) {
          flows.push({
            source_type: arg_type,
            target_identifier: `${instance_type}#constructor#param${index}`,
            flow_kind: 'parameter',
            confidence: 'inferred',
            position: {
              row: call.location.line,
              column: call.location.column
            }
          });
        }
      });
    }
  }
  
  return flows;
}

/**
 * Infer the type of a function argument
 */
function infer_argument_type(
  arg: string,
  context: TypePropagationContext,
  type_map?: Map<string, TypeInfo[]>
): string | undefined {
  // Check if it's a literal
  if (/^['"`]/.test(arg)) return 'string';
  if (/^\d+$/.test(arg)) return 'number';
  if (arg === 'true' || arg === 'false') return 'boolean';
  if (arg === 'null') return 'null';
  if (arg === 'undefined') return 'undefined';
  
  // Check if it's a known variable
  if (type_map && type_map.has(arg)) {
    const types = type_map.get(arg)!;
    if (types.length > 0) {
      // Prefer explicit types
      const explicit = types.find(t => t.confidence === 'explicit');
      return explicit ? explicit.type_name : types[0].type_name;
    }
  }
  
  // Check context known types
  if (context.known_types?.has(arg)) {
    return context.known_types.get(arg);
  }
  
  return undefined;
}

/**
 * Get the return type of a function
 */
function get_function_return_type(
  function_name: string,
  context: TypePropagationContext
): string | undefined {
  // This would integrate with return type inference
  // For now, return undefined
  return undefined;
}

/**
 * Get the return type of a method
 */
function get_method_return_type(
  receiver_type: string,
  method_name: string,
  context: TypePropagationContext,
  class_hierarchy?: any
): string | undefined {
  // Common patterns
  const common_returns: Record<string, Record<string, string>> = {
    'Array': {
      'push': 'number',
      'pop': 'any',
      'shift': 'any',
      'unshift': 'number',
      'slice': 'Array',
      'splice': 'Array',
      'concat': 'Array',
      'join': 'string',
      'reverse': 'Array',
      'sort': 'Array',
      'filter': 'Array',
      'map': 'Array',
      'reduce': 'any',
      'find': 'any',
      'findIndex': 'number',
      'includes': 'boolean',
      'indexOf': 'number'
    },
    'String': {
      'charAt': 'string',
      'charCodeAt': 'number',
      'concat': 'string',
      'includes': 'boolean',
      'indexOf': 'number',
      'lastIndexOf': 'number',
      'match': 'Array',
      'replace': 'string',
      'slice': 'string',
      'split': 'Array',
      'substring': 'string',
      'toLowerCase': 'string',
      'toUpperCase': 'string',
      'trim': 'string',
      'length': 'number'
    },
    'Object': {
      'toString': 'string',
      'valueOf': 'any',
      'hasOwnProperty': 'boolean'
    }
  };
  
  // Check common patterns
  const base_type = receiver_type.split('#').pop() || receiver_type;
  if (common_returns[base_type]?.[method_name]) {
    return common_returns[base_type][method_name];
  }
  
  // This would integrate with class hierarchy and return type inference
  return undefined;
}

/**
 * Merge type flows from different call types
 */
export function merge_call_type_flows(
  function_flows: TypeFlow[],
  method_flows: TypeFlow[],
  constructor_flows: TypeFlow[]
): TypeFlow[] {
  const all_flows = [...function_flows, ...method_flows, ...constructor_flows];
  
  // Remove duplicates based on position and target
  const unique_flows = new Map<string, TypeFlow>();
  for (const flow of all_flows) {
    const key = `${flow.target_identifier}:${flow.position.row}:${flow.position.column}`;
    if (!unique_flows.has(key) || flow.confidence === 'explicit') {
      unique_flows.set(key, flow);
    }
  }
  
  return Array.from(unique_flows.values());
}