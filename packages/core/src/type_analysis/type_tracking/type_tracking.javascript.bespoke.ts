/**
 * JavaScript-specific bespoke type tracking features
 * 
 * Handles JavaScript features that cannot be expressed through configuration:
 * - Prototype-based inheritance
 * - Constructor functions
 * - Dynamic property assignments
 * - CommonJS require() patterns
 * - this binding context
 */

import { SyntaxNode } from 'tree-sitter';
import {
  TypeInfo,
  FileTypeTracker,
  TypeTrackingContext,
  set_variable_type,
  set_imported_class
} from './type_tracking';
import { node_to_location } from '../../ast/node_utils';

/**
 * Track JavaScript constructor functions
 * function Person(name) { this.name = name; }
 */
export function track_javascript_constructor_function(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'function_declaration' && node.type !== 'function_expression') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  if (!name_node) return tracker;
  
  const func_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Heuristic: Capitalized function names are likely constructors
  if (func_name[0] !== func_name[0].toUpperCase()) {
    return tracker;
  }
  
  // Look for this.property assignments in the body
  const body = node.childForFieldName('body');
  if (body && contains_this_assignments(body, context)) {
    const type_info: TypeInfo = {
      type_name: func_name,
      type_kind: 'class',
      location: node_to_location(node, context.file_path),
      confidence: 'inferred',
      source: 'constructor'
    };
    
    return set_variable_type(tracker, func_name, type_info);
  }
  
  return tracker;
}

/**
 * Track prototype-based type assignments
 * Person.prototype.greet = function() { ... }
 */
export function track_javascript_prototype_assignment(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'assignment_expression') {
    return tracker;
  }
  
  const left = node.childForFieldName('left');
  if (!left || left.type !== 'member_expression') {
    return tracker;
  }
  
  // Check for ClassName.prototype.methodName pattern
  const object_node = left.childForFieldName('object');
  const property_node = left.childForFieldName('property');
  
  if (!object_node || !property_node) return tracker;
  
  if (object_node.type === 'member_expression') {
    const proto_object = object_node.childForFieldName('object');
    const proto_property = object_node.childForFieldName('property');
    
    if (proto_object && proto_property && 
        proto_property.type === 'property_identifier') {
      const property_text = context.source_code.substring(
        proto_property.startIndex, 
        proto_property.endIndex
      );
      
      if (property_text === 'prototype') {
        const class_name = context.source_code.substring(
          proto_object.startIndex,
          proto_object.endIndex
        );
        
        // Track that this class has prototype methods
        const type_info: TypeInfo = {
          type_name: class_name,
          type_kind: 'class',
          location: node_to_location(node, context.file_path),
          confidence: 'inferred',
          source: 'assignment'
        };
        
        return set_variable_type(tracker, `prototype:${class_name}`, type_info);
      }
    }
  }
  
  return tracker;
}

/**
 * Track CommonJS require() imports
 * const fs = require('fs');
 */
export function track_javascript_require(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'variable_declarator') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  const value_node = node.childForFieldName('value');
  
  if (!name_node || !value_node || value_node.type !== 'call_expression') {
    return tracker;
  }
  
  const function_node = value_node.childForFieldName('function');
  if (!function_node || function_node.type !== 'identifier') {
    return tracker;
  }
  
  const func_name = context.source_code.substring(function_node.startIndex, function_node.endIndex);
  if (func_name !== 'require') {
    return tracker;
  }
  
  // Get the module name from the argument
  const arguments_node = value_node.childForFieldName('arguments');
  if (!arguments_node || arguments_node.childCount < 2) {
    return tracker;
  }
  
  const module_arg = arguments_node.child(1); // Skip opening paren
  if (!module_arg || module_arg.type !== 'string') {
    return tracker;
  }
  
  const module_name = context.source_code.substring(
    module_arg.startIndex + 1, // Skip opening quote
    module_arg.endIndex - 1     // Skip closing quote
  );
  
  const local_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Handle destructuring: const { readFile } = require('fs')
  if (name_node.type === 'object_pattern') {
    // Extract destructured names
    for (let i = 0; i < name_node.childCount; i++) {
      const child = name_node.child(i);
      if (child && child.type === 'shorthand_property_identifier_pattern') {
        const prop_name = context.source_code.substring(child.startIndex, child.endIndex);
        tracker = set_imported_class(tracker, prop_name, {
          class_name: prop_name,
          source_module: module_name,
          local_name: prop_name
        });
      }
    }
    return tracker;
  }
  
  // Regular require
  return set_imported_class(tracker, local_name, {
    class_name: local_name,
    source_module: module_name,
    local_name: local_name
  });
}

/**
 * Track dynamic property assignments
 * obj.newProp = value;
 */
export function track_javascript_dynamic_property(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'assignment_expression') {
    return tracker;
  }
  
  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');
  
  if (!left || !right || left.type !== 'member_expression') {
    return tracker;
  }
  
  const object_node = left.childForFieldName('object');
  const property_node = left.childForFieldName('property');
  
  if (!object_node || !property_node) return tracker;
  
  // Track this.property assignments
  if (object_node.type === 'this') {
    const property_name = context.source_code.substring(
      property_node.startIndex,
      property_node.endIndex
    );
    
    const type_info: TypeInfo = {
      type_name: 'unknown', // Type will be inferred from the value
      type_kind: 'unknown',
      location: node_to_location(node, context.file_path),
      confidence: 'inferred',
      source: 'assignment',
      is_property_assignment: true
    };
    
    return set_variable_type(tracker, `this.${property_name}`, type_info);
  }
  
  return tracker;
}

/**
 * Infer type from instanceof checks
 * if (x instanceof Array) { ... }
 */
export function infer_javascript_instanceof(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type !== 'binary_expression') {
    return undefined;
  }
  
  const operator_node = node.childForFieldName('operator');
  if (!operator_node) return undefined;
  
  const operator = context.source_code.substring(operator_node.startIndex, operator_node.endIndex);
  if (operator !== 'instanceof') {
    return undefined;
  }
  
  const right_node = node.childForFieldName('right');
  if (!right_node) return undefined;
  
  const type_name = context.source_code.substring(right_node.startIndex, right_node.endIndex);
  
  return {
    type_name,
    type_kind: 'class',
    location: node_to_location(node, context.file_path),
    confidence: 'inferred',
    source: 'assignment'
  };
}

/**
 * Track Object.create() for prototype chains
 * const dog = Object.create(animal);
 */
export function track_javascript_object_create(
  node: SyntaxNode, 
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type !== 'call_expression') {
    return undefined;
  }
  
  const function_node = node.childForFieldName('function');
  if (!function_node || function_node.type !== 'member_expression') {
    return undefined;
  }
  
  const object_node = function_node.childForFieldName('object');
  const property_node = function_node.childForFieldName('property');
  
  if (!object_node || !property_node) return undefined;
  
  const object_name = context.source_code.substring(object_node.startIndex, object_node.endIndex);
  const method_name = context.source_code.substring(property_node.startIndex, property_node.endIndex);
  
  if (object_name === 'Object' && method_name === 'create') {
    // Get the prototype argument
    const arguments_node = node.childForFieldName('arguments');
    if (arguments_node && arguments_node.childCount >= 2) {
      const proto_arg = arguments_node.child(1); // Skip opening paren
      if (proto_arg) {
        const proto_name = context.source_code.substring(proto_arg.startIndex, proto_arg.endIndex);
        return {
          type_name: `Object<${proto_name}>`,
          type_kind: 'object',
          location: node_to_location(node, context.file_path),
          confidence: 'inferred',
          source: 'constructor'
        };
      }
    }
  }
  
  return undefined;
}

// Helper functions

function contains_this_assignments(node: SyntaxNode, context: TypeTrackingContext): boolean {
  if (node.type === 'assignment_expression') {
    const left = node.childForFieldName('left');
    if (left && left.type === 'member_expression') {
      const object_node = left.childForFieldName('object');
      if (object_node && object_node.type === 'this') {
        return true;
      }
    }
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && contains_this_assignments(child, context)) {
      return true;
    }
  }
  
  return false;
}