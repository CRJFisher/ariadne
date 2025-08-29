/**
 * JavaScript class detection
 */

import { SyntaxNode } from 'tree-sitter';
import { 
  ClassDefinition, 
  MethodDefinition, 
  PropertyDefinition,
  ParameterDefinition,
  Location 
} from '@ariadnejs/types';
import { ClassDetectionContext } from './index';

/**
 * Find all class definitions in JavaScript code
 */
export function find_class_definitions_javascript(
  context: ClassDetectionContext
): ClassDefinition[] {
  const classes: ClassDefinition[] = [];
  
  walk_tree(context.ast_root, (node) => {
    // ES6 class declarations: class Foo { }
    if (node.type === 'class_declaration') {
      const class_def = extract_class_declaration(node, context);
      if (class_def) {
        classes.push(class_def);
      }
    }
    
    // Class expressions: const Foo = class { }
    if (node.type === 'class') {
      const class_def = extract_class_expression(node, context);
      if (class_def) {
        classes.push(class_def);
      }
    }
  });
  
  return classes;
}

/**
 * Extract class declaration
 */
function extract_class_declaration(
  node: SyntaxNode,
  context: ClassDetectionContext
): ClassDefinition | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const class_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check for extends clause
  const superclass_node = node.childForFieldName('superclass');
  const extends_list = superclass_node 
    ? [context.source_code.substring(superclass_node.startIndex, superclass_node.endIndex)]
    : undefined;
  
  // Extract body
  const body_node = node.childForFieldName('body');
  const { methods, properties } = extract_class_body(body_node, context);
  
  return {
    name: class_name,
    location: node_to_location(node),
    extends: extends_list,
    methods,
    properties,
    language: 'javascript',
    file_path: context.file_path
  };
}

/**
 * Extract class expression
 */
function extract_class_expression(
  node: SyntaxNode,
  context: ClassDetectionContext
): ClassDefinition | null {
  // Try to find the variable it's assigned to
  let class_name = 'AnonymousClass';
  const parent = node.parent;
  
  if (parent && parent.type === 'variable_declarator') {
    const id_node = parent.childForFieldName('name');
    if (id_node) {
      class_name = context.source_code.substring(id_node.startIndex, id_node.endIndex);
    }
  } else if (parent && parent.type === 'assignment_expression') {
    const left_node = parent.childForFieldName('left');
    if (left_node) {
      class_name = context.source_code.substring(left_node.startIndex, left_node.endIndex);
    }
  }
  
  // Check for extends
  const superclass_node = node.childForFieldName('superclass');
  const extends_list = superclass_node
    ? [context.source_code.substring(superclass_node.startIndex, superclass_node.endIndex)]
    : undefined;
  
  // Extract body
  const body_node = node.childForFieldName('body');
  const { methods, properties } = extract_class_body(body_node, context);
  
  return {
    name: class_name,
    location: node_to_location(node),
    extends: extends_list,
    methods,
    properties,
    language: 'javascript',
    file_path: context.file_path
  };
}

/**
 * Extract class body (methods and properties)
 */
function extract_class_body(
  body_node: SyntaxNode | null,
  context: ClassDetectionContext
): { methods: MethodDefinition[], properties: PropertyDefinition[] } {
  const methods: MethodDefinition[] = [];
  const properties: PropertyDefinition[] = [];
  
  if (!body_node) return { methods, properties };
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    // Method definition
    if (child.type === 'method_definition') {
      const method = extract_method(child, context);
      if (method) {
        methods.push(method);
      }
    }
    
    // Field definition (ES2022 class fields)
    if (child.type === 'field_definition') {
      const property = extract_property(child, context);
      if (property) {
        properties.push(property);
      }
    }
  }
  
  return { methods, properties };
}

/**
 * Extract method definition
 */
function extract_method(
  node: SyntaxNode,
  context: ClassDetectionContext
): MethodDefinition | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const method_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check modifiers
  let is_static = false;
  let is_async = false;
  let is_private = false;
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === 'static') {
      is_static = true;
    }
    if (child && child.type === 'async') {
      is_async = true;
    }
  }
  
  // Check if it's a private method (starts with #)
  if (method_name.startsWith('#')) {
    is_private = true;
  }
  
  // Extract parameters
  const params_node = node.childForFieldName('parameters');
  const parameters = extract_parameters(params_node, context);
  
  return {
    name: method_name,
    location: node_to_location(node),
    is_static,
    is_abstract: false, // JavaScript doesn't have abstract
    is_private,
    is_protected: false, // JavaScript doesn't have protected
    is_constructor: method_name === 'constructor',
    is_async,
    parameters
  };
}

/**
 * Extract property/field definition
 */
function extract_property(
  node: SyntaxNode,
  context: ClassDetectionContext
): PropertyDefinition | null {
  const property_node = node.childForFieldName('property');
  if (!property_node) return null;
  
  const property_name = context.source_code.substring(property_node.startIndex, property_node.endIndex);
  
  // Check modifiers
  let is_static = false;
  let is_private = false;
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === 'static') {
      is_static = true;
    }
  }
  
  // Check if it's a private field (starts with #)
  if (property_name.startsWith('#')) {
    is_private = true;
  }
  
  // Get initial value if present
  const value_node = node.childForFieldName('value');
  const initial_value = value_node
    ? context.source_code.substring(value_node.startIndex, value_node.endIndex)
    : undefined;
  
  return {
    name: property_name,
    location: node_to_location(node),
    is_static,
    is_private,
    is_protected: false, // JavaScript doesn't have protected
    is_readonly: false, // No readonly in JS (use TypeScript for that)
    initial_value
  };
}

/**
 * Extract function parameters
 */
function extract_parameters(
  params_node: SyntaxNode | null,
  context: ClassDetectionContext
): ParameterDefinition[] {
  const parameters: ParameterDefinition[] = [];
  
  if (!params_node) return parameters;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    // Skip parentheses and commas
    if (child.type === '(' || child.type === ')' || child.type === ',') continue;
    
    if (child.type === 'identifier') {
      parameters.push({
        name: context.source_code.substring(child.startIndex, child.endIndex),
        is_optional: false,
        is_rest: false
      });
    } else if (child.type === 'assignment_pattern') {
      // Parameter with default value
      const left = child.childForFieldName('left');
      const right = child.childForFieldName('right');
      
      if (left) {
        parameters.push({
          name: context.source_code.substring(left.startIndex, left.endIndex),
          is_optional: true,
          is_rest: false,
          default_value: right 
            ? context.source_code.substring(right.startIndex, right.endIndex)
            : undefined
        });
      }
    } else if (child.type === 'rest_pattern') {
      // Rest parameter (...args)
      const pattern = child.child(1); // Skip the ...
      if (pattern) {
        parameters.push({
          name: context.source_code.substring(pattern.startIndex, pattern.endIndex),
          is_optional: false,
          is_rest: true
        });
      }
    } else if (child.type === 'object_pattern' || child.type === 'array_pattern') {
      // Destructured parameter
      parameters.push({
        name: context.source_code.substring(child.startIndex, child.endIndex),
        is_optional: false,
        is_rest: false
      });
    }
  }
  
  return parameters;
}

/**
 * Convert node position to Location
 */
function node_to_location(node: SyntaxNode): Location {
  return {
    row: node.startPosition.row,
    column: node.startPosition.column
  };
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