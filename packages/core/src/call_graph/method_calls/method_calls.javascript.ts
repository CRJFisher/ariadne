/**
 * JavaScript bespoke method call features
 * 
 * Handles JavaScript-specific patterns that can't be expressed through configuration:
 * - Prototype method calls (ClassName.prototype.methodName)
 * - Indirect method calls (call, apply, bind)
 * - Optional chaining (obj?.method())
 */

import { SyntaxNode } from 'tree-sitter';
import { MethodCallInfo } from '@ariadnejs/types';

/**
 * Detect prototype method calls (ClassName.prototype.methodName)
 */
export function detect_prototype_method_call(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'member_expression') {
    return null;
  }
  
  // Handle ClassName.prototype.methodName.call/apply pattern
  const property = func.childForFieldName('property');
  if (property) {
    const prop_text = source.substring(property.startIndex, property.endIndex);
    if (prop_text === 'call' || prop_text === 'apply') {
      // Check if object is ClassName.prototype.methodName
      const object = func.childForFieldName('object');
      if (object && object.type === 'member_expression') {
        const obj_obj = object.childForFieldName('object');
        if (obj_obj && obj_obj.type === 'member_expression') {
          // Check for prototype pattern
          const proto_prop = obj_obj.childForFieldName('property');
          if (proto_prop) {
            const proto_text = source.substring(proto_prop.startIndex, proto_prop.endIndex);
            if (proto_text === 'prototype') {
              const class_obj = obj_obj.childForFieldName('object');
              const method_prop = object.childForFieldName('property');
              
              if (class_obj && method_prop) {
                const class_name = source.substring(class_obj.startIndex, class_obj.endIndex);
                const method_name = source.substring(method_prop.startIndex, method_prop.endIndex);
                
                return {
                  caller_name: '<module>',
                  method_name,
                  receiver_name: `${class_name}.prototype`,
                  location: {
                    line: node.startPosition.row,
                    column: node.startPosition.column
                  },
                  is_static_method: true,
                  is_chained_call: false,
                  arguments_count: count_arguments(node)
                };
              }
            }
          }
        }
      }
    }
  }
  
  // Handle direct ClassName.prototype.methodName() pattern
  const object = func.childForFieldName('object');
  if (!object || object.type !== 'member_expression') {
    return null;
  }
  
  // Check if it's ClassName.prototype.methodName pattern
  const obj_property = object.childForFieldName('property');
  if (obj_property) {
    const prop_text = source.substring(obj_property.startIndex, obj_property.endIndex);
    if (prop_text === 'prototype') {
      // Extract the class name (object of the prototype access)
      const class_obj = object.childForFieldName('object');
      const method = func.childForFieldName('property');
      
      if (class_obj && method) {
        const class_name = source.substring(class_obj.startIndex, class_obj.endIndex);
        const method_name = source.substring(method.startIndex, method.endIndex);
        
        return {
          caller_name: '<module>',
          method_name,
          receiver_name: `${class_name}.prototype`,
          location: {
            line: node.startPosition.row,
            column: node.startPosition.column
          },
          is_static_method: true,
          is_chained_call: false,
          arguments_count: count_arguments(node)
        };
      }
    }
  }
  
  return null;
}

/**
 * Detect indirect method calls (call, apply, bind)
 * These are methods that manipulate the 'this' context
 */
export function detect_indirect_method_call(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'member_expression') {
    return null;
  }
  
  const property = func.childForFieldName('property');
  const object = func.childForFieldName('object');
  
  if (property && object) {
    const method_name = source.substring(property.startIndex, property.endIndex);
    
    if (['call', 'apply', 'bind'].includes(method_name)) {
      // This is calling a method indirectly
      // The actual method being called is the object part
      let actual_method = '<unknown>';
      let receiver = '<unknown>';
      
      if (object.type === 'member_expression') {
        const obj_property = object.childForFieldName('property');
        const obj_object = object.childForFieldName('object');
        if (obj_property) {
          actual_method = source.substring(obj_property.startIndex, obj_property.endIndex);
        }
        if (obj_object) {
          receiver = source.substring(obj_object.startIndex, obj_object.endIndex);
        }
      } else {
        actual_method = source.substring(object.startIndex, object.endIndex);
      }
      
      return {
        caller_name: '<module>',
        method_name: `${actual_method}.${method_name}`,  // e.g., "someMethod.call"
        receiver_name: receiver,
        location: {
          line: node.startPosition.row,
          column: node.startPosition.column
        },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: count_arguments(node)
      };
    }
  }
  
  return null;
}

/**
 * Detect optional chaining method calls (obj?.method())
 */
export function detect_optional_chaining_call(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'member_expression') {
    return null;
  }
  
  // Check if it contains optional chaining token
  let hasOptionalChain = false;
  for (let i = 0; i < func.childCount; i++) {
    const child = func.child(i);
    if (child && child.type === 'optional_chain') {
      hasOptionalChain = true;
      break;
    }
  }
  
  if (!hasOptionalChain) {
    return null;
  }
  
  // Extract method call details from member expression with optional chain
  const object = func.childForFieldName('object');
  const property = func.childForFieldName('property');
  
  if (object && property) {
    const method_name = source.substring(property.startIndex, property.endIndex);
    
    // For chained calls, extract just the previous method name
    let receiver_name = source.substring(object.startIndex, object.endIndex);
    if (object.type === 'call_expression') {
      // It's a chained call - extract the method name from the previous call
      const prevFunc = object.childForFieldName('function');
      if (prevFunc && prevFunc.type === 'member_expression') {
        const prevProp = prevFunc.childForFieldName('property');
        if (prevProp) {
          receiver_name = source.substring(prevProp.startIndex, prevProp.endIndex) + '()';
        }
      }
    }
    
    return {
      caller_name: '<module>',
      method_name,
      receiver_name,
      location: {
        line: node.startPosition.row,
        column: node.startPosition.column
      },
      is_static_method: false,
      is_chained_call: object.type === 'call_expression',
      arguments_count: count_arguments(node),
      is_optional: true  // Mark as optional chaining
    };
  }
  
  return null;
}

/**
 * Helper to count arguments
 */
function count_arguments(node: SyntaxNode): number {
  const args = node.childForFieldName('arguments');
  if (!args) return 0;
  
  let count = 0;
  for (let i = 0; i < args.childCount; i++) {
    const child = args.child(i);
    if (child && 
        child.type !== '(' && 
        child.type !== ')' && 
        child.type !== ',' && 
        child.type !== 'comment') {
      count++;
    }
  }
  
  return count;
}

/**
 * Find JavaScript bespoke method calls
 */
export function find_javascript_bespoke_method_calls(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  // Try each bespoke pattern
  return detect_prototype_method_call(node, source) ||
         detect_indirect_method_call(node, source) ||
         detect_optional_chaining_call(node, source);
}