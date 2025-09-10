/**
 * Call-based type propagation - INTERNAL MODULE
 * 
 * Propagates types through function calls, method calls, and constructors
 * This module is only used in tests and not exported for external use
 */

import {
  FunctionCallInfo,
  MethodCallInfo,
  ConstructorCallInfo,
  Language,
  TypeFlow
} from '@ariadnejs/types';
import { 
  TypePropagationContext
} from './type_propagation';

/**
 * @internal @testonly
 * Propagate types through function calls
 */
export function propagate_function_call_types(
  function_calls: FunctionCallInfo[],
  context: TypePropagationContext,
  type_map: Map<string, string>
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  for (const call of function_calls) {
    // Note: FunctionCallInfo doesn't have arguments array, only arguments_count
    // We can't propagate parameter types without actual argument values
    // This would require enhancing FunctionCallInfo to include argument info
    
    // Flow return type to call site (if assigned)
    // This would need return type inference integration
    const return_type = get_function_return_type(call.callee_name, context);
    if (return_type) {
      flows.push({
        source_type: return_type,
        target_identifier: `${call.callee_name}#return`,
        flow_kind: 'return',
        confidence: 'inferred',
        position: {
          row: call.location.line,
          column: call.location.column
        }
      });
    }
    
    // Look up return type from type conversion functions
    const conversion_funcs = type_conversions[call.callee_name];
    if (conversion_funcs) {
      const result_type = conversion_funcs[context.language];
      if (result_type) {
        flows.push({
          source_type: result_type,
          target_identifier: call.callee_name,
          flow_kind: 'return',
          confidence: 'explicit',
          position: {
            row: call.location.line,
            column: call.location.column
          }
        });
      }
    }
    
    // Handle constructor calls (e.g., new Array(), list() in Python)
    if (call.is_constructor_call) {
      flows.push({
        source_type: call.callee_name,
        target_identifier: call.callee_name,
        flow_kind: 'return',
        confidence: 'explicit',
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
 * @internal @testonly
 * Propagate types through method calls
 */
export function propagate_method_call_types(
  method_calls: MethodCallInfo[],
  context: TypePropagationContext,
  type_map: Map<string, string>
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  for (const call of method_calls) {
    // MethodCallInfo doesn't have receiver_type, only receiver_name
    const receiver_name = call.receiver_name || 'this';
    // We would need type inference to determine receiver_type
    const receiver_type = type_map.get(receiver_name) || 'unknown';
    
    // Look up method return type based on receiver type
    const method_return_type = get_method_return_type(
      receiver_type,
      call.method_name,
      context
    );
    
    if (method_return_type) {
      flows.push({
        source_type: method_return_type,
        target_identifier: `${receiver_name}.${call.method_name}#return`,
        flow_kind: 'return',
        confidence: 'inferred',
        position: {
          row: call.location.line,
          column: call.location.column
        }
      });
    }
    
    // Note: MethodCallInfo doesn't have arguments array, only arguments_count
    // Would need actual argument nodes to propagate parameter types
    
    // Handle method chaining
    if (call.is_chained_call) {
      // The return type becomes the receiver type for the next call
      if (method_return_type) {
        flows.push({
          source_type: method_return_type,
          target_identifier: receiver_name,
          flow_kind: 'return',
          confidence: 'inferred',
          position: {
            row: call.location.line,
            column: call.location.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * @internal @testonly
 * Propagate types through constructor calls
 */
export function propagate_constructor_call_types(
  constructor_calls: ConstructorCallInfo[],
  context: TypePropagationContext,
  type_map: Map<string, string>
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  for (const call of constructor_calls) {
    // The constructor creates an instance of the class
    flows.push({
      source_type: call.constructor_name,
      target_identifier: call.assigned_to || '_temp',
      flow_kind: 'assignment',
      confidence: 'explicit',
      position: {
        row: call.location.line,
        column: call.location.column
      }
    });
    
    // If assigned to a variable, update the type map
    if (call.assigned_to && type_map) {
      type_map.set(call.assigned_to, call.constructor_name);
    }
    
    // Note: ConstructorCallInfo doesn't have arguments array, only arguments_count
    // Would need actual argument nodes to propagate parameter types
  }
  
  return flows;
}

/**
 * Helper: Get function return type
 */
function get_function_return_type(
  function_name: string,
  context: TypePropagationContext
): string | undefined {
  // This would integrate with return type inference
  // For now, check if it's a known type conversion function
  const converters = type_conversions[function_name];
  if (converters) {
    return converters[context.language];
  }
  
  // Check known types map
  if (context.known_types?.has(function_name)) {
    return context.known_types.get(function_name);
  }
  
  return undefined;
}

/**
 * Helper: Get method return type
 */
function get_method_return_type(
  receiver_type: string,
  method_name: string,
  context: TypePropagationContext
): string | undefined {
  // Language-specific method return types
  const method_returns: Record<string, Record<string, Record<string, string>>> = {
    javascript: {
      'Array': {
        'map': 'Array',
        'filter': 'Array',
        'reduce': 'any',
        'join': 'string',
        'slice': 'Array',
        'concat': 'Array',
        'push': 'number',
        'pop': 'any',
        'shift': 'any',
        'unshift': 'number'
      },
      'String': {
        'split': 'Array',
        'trim': 'string',
        'toLowerCase': 'string',
        'toUpperCase': 'string',
        'substring': 'string',
        'slice': 'string',
        'replace': 'string'
      }
    },
    typescript: {
      // Same as JavaScript
      'Array': {
        'map': 'Array',
        'filter': 'Array',
        'reduce': 'any',
        'join': 'string',
        'slice': 'Array',
        'concat': 'Array'
      },
      'String': {
        'split': 'Array',
        'trim': 'string',
        'toLowerCase': 'string',
        'toUpperCase': 'string'
      }
    },
    python: {
      'list': {
        'append': 'None',
        'extend': 'None',
        'pop': 'any',
        'sort': 'None',
        'reverse': 'None',
        'copy': 'list'
      },
      'str': {
        'split': 'list',
        'strip': 'str',
        'lower': 'str',
        'upper': 'str',
        'replace': 'str',
        'join': 'str'
      },
      'dict': {
        'keys': 'dict_keys',
        'values': 'dict_values',
        'items': 'dict_items',
        'get': 'any',
        'pop': 'any'
      }
    },
    rust: {
      'Vec': {
        'push': '()',
        'pop': 'Option',
        'len': 'usize',
        'is_empty': 'bool',
        'clear': '()',
        'clone': 'Vec'
      },
      'String': {
        'len': 'usize',
        'is_empty': 'bool',
        'push_str': '()',
        'trim': '&str',
        'to_lowercase': 'String',
        'to_uppercase': 'String'
      }
    }
  };
  
  const lang_methods = method_returns[context.language];
  if (lang_methods && lang_methods[receiver_type]) {
    return lang_methods[receiver_type][method_name];
  }
  
  return undefined;
}

// Type conversion functions by language
const type_conversions: Record<string, Record<string, string>> = {
  // JavaScript/TypeScript
  'String': { javascript: 'string', typescript: 'string' },
  'Number': { javascript: 'number', typescript: 'number' },
  'Boolean': { javascript: 'boolean', typescript: 'boolean' },
  'Array': { javascript: 'Array', typescript: 'Array' },
  'Object': { javascript: 'Object', typescript: 'Object' },
  
  // Python
  'str': { python: 'str' },
  'int': { python: 'int' },
  'float': { python: 'float' },
  'bool': { python: 'bool' },
  'list': { python: 'list' },
  'dict': { python: 'dict' },
  'set': { python: 'set' },
  'tuple': { python: 'tuple' },
  
  // Rust
  'String::new': { rust: 'String' },
  'Vec::new': { rust: 'Vec' },
  'HashMap::new': { rust: 'HashMap' },
  'HashSet::new': { rust: 'HashSet' }
};