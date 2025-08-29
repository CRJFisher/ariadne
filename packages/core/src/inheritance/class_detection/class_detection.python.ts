/**
 * Python class detection
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
 * Find all class definitions in Python code
 */
export function find_class_definitions_python(
  context: ClassDetectionContext
): ClassDefinition[] {
  const classes: ClassDefinition[] = [];
  
  walk_tree(context.ast_root, (node) => {
    if (node.type === 'class_definition') {
      const class_def = extract_python_class(node, context);
      if (class_def) {
        classes.push(class_def);
      }
    }
  });
  
  return classes;
}

/**
 * Extract Python class definition
 */
function extract_python_class(
  node: SyntaxNode,
  context: ClassDetectionContext
): ClassDefinition | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const class_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Extract base classes
  const superclasses_node = node.childForFieldName('superclasses');
  const extends_list = extract_base_classes(superclasses_node, context);
  
  // Extract decorators
  const decorators = extract_decorators(node, context);
  
  // Extract body
  const body_node = node.childForFieldName('body');
  const { methods, properties } = extract_class_body(body_node, context);
  
  // Check for abstract base class
  const is_abstract = decorators?.some(d => d.includes('abstractmethod')) || false;
  
  return {
    name: class_name,
    location: node_to_location(node),
    extends: extends_list,
    is_abstract,
    methods,
    properties,
    decorators,
    language: 'python',
    file_path: context.file_path
  };
}

/**
 * Extract base classes from inheritance list
 */
function extract_base_classes(
  superclasses_node: SyntaxNode | null,
  context: ClassDetectionContext
): string[] | undefined {
  if (!superclasses_node) return undefined;
  
  const bases: string[] = [];
  
  // In Python, superclasses is an argument_list
  for (let i = 0; i < superclasses_node.childCount; i++) {
    const child = superclasses_node.child(i);
    if (!child) continue;
    
    // Skip parentheses and commas
    if (child.type === '(' || child.type === ')' || child.type === ',') continue;
    
    // Handle simple identifiers and attribute access (e.g., abc.ABC)
    if (child.type === 'identifier' || child.type === 'attribute') {
      bases.push(context.source_code.substring(child.startIndex, child.endIndex));
    }
    // Handle keyword arguments (e.g., metaclass=ABCMeta)
    else if (child.type === 'keyword_argument') {
      const name = child.childForFieldName('name');
      const value = child.childForFieldName('value');
      if (name && value && 
          context.source_code.substring(name.startIndex, name.endIndex) === 'metaclass') {
        // Note: Could track metaclass separately if needed
      }
    }
  }
  
  return bases.length > 0 ? bases : undefined;
}

/**
 * Extract class body
 */
function extract_class_body(
  body_node: SyntaxNode | null,
  context: ClassDetectionContext
): { methods: MethodDefinition[], properties: PropertyDefinition[] } {
  const methods: MethodDefinition[] = [];
  const properties: PropertyDefinition[] = [];
  
  if (!body_node) return { methods, properties };
  
  // Python class body is a block
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    // Function definition (method)
    if (child.type === 'function_definition') {
      const method = extract_method(child, context);
      if (method) {
        methods.push(method);
      }
    }
    
    // Expression statement (could be property assignment)
    if (child.type === 'expression_statement') {
      const prop = extract_class_property(child, context);
      if (prop) {
        properties.push(prop);
      }
    }
    
    // Decorated definition (could be property or method)
    if (child.type === 'decorated_definition') {
      const definition = child.childForFieldName('definition');
      if (definition && definition.type === 'function_definition') {
        const method = extract_method(definition, context, child);
        if (method) {
          methods.push(method);
        }
      }
    }
  }
  
  // Also extract __init__ parameters as properties
  const init_method = methods.find(m => m.name === '__init__');
  if (init_method) {
    const init_properties = extract_init_properties(init_method);
    properties.push(...init_properties);
  }
  
  return { methods, properties };
}

/**
 * Extract method definition
 */
function extract_method(
  node: SyntaxNode,
  context: ClassDetectionContext,
  decorated_node?: SyntaxNode
): MethodDefinition | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const method_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Extract parameters
  const params_node = node.childForFieldName('parameters');
  const parameters = extract_parameters(params_node, context);
  
  // Extract decorators
  const decorators = decorated_node 
    ? extract_decorators(decorated_node, context)
    : extract_decorators(node, context);
  
  // Check for special decorators
  const is_static = decorators?.some(d => d.includes('staticmethod')) || false;
  const is_class_method = decorators?.some(d => d.includes('classmethod')) || false;
  const is_abstract = decorators?.some(d => d.includes('abstractmethod')) || false;
  const is_property_decorator = decorators?.some(d => d === 'property') || false;
  
  // Check if async
  const is_async = node.children.some(c => c.type === 'async');
  
  // Extract return type from annotation if present
  const return_annotation = node.childForFieldName('return_type');
  const return_type = return_annotation
    ? extract_type_annotation(return_annotation, context)
    : undefined;
  
  // Private methods start with _ or __
  const is_private = method_name.startsWith('_');
  const is_protected = method_name.startsWith('_') && !method_name.startsWith('__');
  
  return {
    name: method_name,
    location: node_to_location(node),
    is_static: is_static || is_class_method,
    is_abstract,
    is_private,
    is_protected,
    is_constructor: method_name === '__init__',
    is_async,
    parameters: parameters.filter(p => p.name !== 'self' && p.name !== 'cls'),
    return_type,
    decorators
  };
}

/**
 * Extract class-level property
 */
function extract_class_property(
  node: SyntaxNode,
  context: ClassDetectionContext
): PropertyDefinition | null {
  // Look for assignments like: x = 5 or x: int = 5
  const assignment = node.child(0);
  if (!assignment) return null;
  
  if (assignment.type === 'assignment') {
    const left = assignment.childForFieldName('left');
    const right = assignment.childForFieldName('right');
    
    if (left && left.type === 'identifier') {
      const name = context.source_code.substring(left.startIndex, left.endIndex);
      
      // Skip methods assigned as variables
      if (right && right.type === 'lambda') return null;
      
      return {
        name,
        location: node_to_location(node),
        is_static: true, // Class-level attributes are static
        is_private: name.startsWith('_'),
        is_protected: name.startsWith('_') && !name.startsWith('__'),
        is_readonly: false,
        initial_value: right 
          ? context.source_code.substring(right.startIndex, right.endIndex)
          : undefined
      };
    }
  }
  
  // Type annotated assignment: x: int = 5
  if (assignment.type === 'annotated_assignment') {
    const left = assignment.child(0);
    const annotation = assignment.child(2); // After ':'
    const right = assignment.childForFieldName('right');
    
    if (left && left.type === 'identifier') {
      const name = context.source_code.substring(left.startIndex, left.endIndex);
      
      return {
        name,
        location: node_to_location(node),
        type: annotation ? extract_type_annotation(annotation, context) : undefined,
        is_static: true,
        is_private: name.startsWith('_'),
        is_protected: name.startsWith('_') && !name.startsWith('__'),
        is_readonly: false,
        initial_value: right
          ? context.source_code.substring(right.startIndex, right.endIndex)
          : undefined
      };
    }
  }
  
  return null;
}

/**
 * Extract properties from __init__ method
 */
function extract_init_properties(init_method: MethodDefinition): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  
  // Look for parameters that likely become instance variables
  for (const param of init_method.parameters) {
    // Skip self parameter (already filtered)
    // Common pattern: def __init__(self, name, age): self.name = name
    properties.push({
      name: param.name,
      location: init_method.location,
      type: param.type,
      is_static: false,
      is_private: param.name.startsWith('_'),
      is_protected: param.name.startsWith('_') && !param.name.startsWith('__'),
      is_readonly: false
    });
  }
  
  return properties;
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
    
    if (child.type === 'identifier') {
      parameters.push({
        name: context.source_code.substring(child.startIndex, child.endIndex),
        is_optional: false,
        is_rest: false
      });
    } else if (child.type === 'default_parameter') {
      const name = child.childForFieldName('name');
      const value = child.childForFieldName('value');
      
      if (name) {
        parameters.push({
          name: context.source_code.substring(name.startIndex, name.endIndex),
          is_optional: true,
          is_rest: false,
          default_value: value
            ? context.source_code.substring(value.startIndex, value.endIndex)
            : undefined
        });
      }
    } else if (child.type === 'typed_parameter' || child.type === 'typed_default_parameter') {
      const ident = child.child(0);
      const type_node = child.childForFieldName('type');
      const value = child.childForFieldName('value');
      
      if (ident) {
        parameters.push({
          name: context.source_code.substring(ident.startIndex, ident.endIndex),
          type: type_node ? extract_type_annotation(type_node, context) : undefined,
          is_optional: child.type === 'typed_default_parameter',
          is_rest: false,
          default_value: value
            ? context.source_code.substring(value.startIndex, value.endIndex)
            : undefined
        });
      }
    } else if (child.type === 'list_splat_pattern') {
      // *args
      const name = child.child(1); // Skip *
      if (name) {
        parameters.push({
          name: context.source_code.substring(name.startIndex, name.endIndex),
          is_optional: false,
          is_rest: true
        });
      }
    } else if (child.type === 'dictionary_splat_pattern') {
      // **kwargs
      const name = child.child(1); // Skip **
      if (name) {
        parameters.push({
          name: context.source_code.substring(name.startIndex, name.endIndex),
          is_optional: false,
          is_rest: true
        });
      }
    }
  }
  
  return parameters;
}

/**
 * Extract type annotation
 */
function extract_type_annotation(
  type_node: SyntaxNode,
  context: ClassDetectionContext
): string {
  // Skip the : if present
  if (type_node.type === 'type') {
    const actual_type = type_node.child(1); // Skip ':'
    if (actual_type) {
      return context.source_code.substring(actual_type.startIndex, actual_type.endIndex);
    }
  }
  
  return context.source_code.substring(type_node.startIndex, type_node.endIndex);
}

/**
 * Extract decorators
 */
function extract_decorators(
  node: SyntaxNode,
  context: ClassDetectionContext
): string[] | undefined {
  const decorators: string[] = [];
  
  // For decorated_definition, look at decorators field
  if (node.type === 'decorated_definition') {
    const decorators_node = node.childForFieldName('decorator');
    if (decorators_node) {
      // Extract decorator name (after @)
      const name = context.source_code.substring(
        decorators_node.startIndex + 1, 
        decorators_node.endIndex
      );
      decorators.push(name);
    }
  }
  
  // Look for preceding decorator nodes
  let sibling = node.previousSibling;
  while (sibling && sibling.type === 'decorator') {
    const name = context.source_code.substring(sibling.startIndex + 1, sibling.endIndex);
    decorators.unshift(name);
    sibling = sibling.previousSibling;
  }
  
  return decorators.length > 0 ? decorators : undefined;
}

/**
 * Convert node to location
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