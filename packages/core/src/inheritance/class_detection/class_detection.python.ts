/**
 * Python-specific class detection features
 * 
 * This module handles Python features that cannot be expressed
 * through configuration alone (~15% of the logic).
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ClassDefinition,
  MethodDefinition,
  PropertyDefinition,
  ParameterDefinition
} from '@ariadnejs/types';
import { ClassDetectionContext } from './index';
import { node_to_location } from '../../ast/node_utils';

/**
 * Enhance class with Python-specific features
 */
export function enhance_python_class(
  class_def: ClassDefinition,
  node: SyntaxNode,
  context: ClassDetectionContext
): ClassDefinition {
  // Extract decorators
  const decorators = extract_decorators(node, context);
  class_def.decorators = decorators;

  // Check for abstract class via decorator
  if (decorators.some(d => d.includes('abstractmethod'))) {
    class_def.is_abstract = true;
  }
  
  // Handle metaclass from superclasses
  const superclasses_node = node.childForFieldName('superclasses');
  if (superclasses_node) {
    const metaclass = extract_metaclass(superclasses_node, context);
    if (metaclass) {
      // Store metaclass as a special property or in metadata
      (class_def as any).metaclass = metaclass;
    }
  }
  
  // Extract properties from __init__ method
  const init_properties = extract_init_properties(class_def, context);
  if (init_properties.length > 0) {
    class_def.properties = [...class_def.properties, ...init_properties];
  }
  
  return class_def;
}

/**
 * Enhance method with Python-specific features
 */
export function enhance_python_method(
  method: MethodDefinition,
  node: SyntaxNode,
  context: ClassDetectionContext,
  decorated_node?: SyntaxNode
): MethodDefinition {
  // Extract decorators
  const decorators = decorated_node 
    ? extract_decorators(decorated_node, context)
    : extract_decorators(node, context);
  
  method.decorators = decorators;

  // Check for special decorators
  if (decorators.some(d => d.includes('staticmethod'))) {
    method.is_static = true;
  }
  if (decorators.some(d => d.includes('classmethod'))) {
    method.is_static = true; // Treat classmethod as static for simplicity
  }
  if (decorators.some(d => d.includes('abstractmethod'))) {
    method.is_abstract = true;
  }
  if (decorators.some(d => d === 'property')) {
    // Mark as property getter
    (method as any).is_property = true;
  }
  
  // Extract return type annotation
  const return_annotation = node.childForFieldName('return_type');
  if (return_annotation) {
    method.return_type = extract_type_annotation(return_annotation, context);
  }
  
  // Enhance parameters with type annotations
  const params_node = node.childForFieldName('parameters');
  if (params_node) {
    method.parameters = extract_typed_parameters(params_node, context);
  }
  
  return method;
}

/**
 * Enhance property with Python-specific features
 */
export function enhance_python_property(
  node: SyntaxNode,
  context: ClassDetectionContext
): PropertyDefinition | null {
  // Handle assignments: x: int = 5 or x = 5
  const assignment = node.child(0);
  if (!assignment || assignment.type !== 'assignment') return null;
  
  const left = assignment.childForFieldName('left');
  const type_node = assignment.childForFieldName('type');
  const right = assignment.childForFieldName('right');
  
  if (left && left.type === 'identifier') {
    const name = context.source_code.substring(left.startIndex, left.endIndex);
    
    return {
      name,
      location: node_to_location(node, context.file_path),
      type: type_node ? extract_type_annotation(type_node, context) : undefined,
      is_static: true, // Class-level attributes are static
      is_private: name.startsWith('__') && !name.endsWith('__'),
      is_protected: name.startsWith('_') && !name.startsWith('__'),
      is_readonly: false,
      initial_value: right
        ? context.source_code.substring(right.startIndex, right.endIndex)
        : undefined
    };
  }
  
  return null;
}

/**
 * Extract properties from __init__ method
 */
function extract_init_properties(
  class_def: ClassDefinition,
  context: ClassDetectionContext
): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  
  const init_method = class_def.methods?.find(m => m.name === '__init__');
  if (!init_method) return properties;
  
  // Common pattern: def __init__(self, name, age): self.name = name
  for (const param of init_method.parameters) {
    // Skip self parameter (already filtered)
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
 * Extract metaclass from superclasses
 */
function extract_metaclass(
  superclasses_node: SyntaxNode,
  context: ClassDetectionContext
): string | null {
  for (let i = 0; i < superclasses_node.childCount; i++) {
    const child = superclasses_node.child(i);
    if (!child) continue;
    
    // Handle keyword arguments (e.g., metaclass=ABCMeta)
    if (child.type === 'keyword_argument') {
      const name = child.childForFieldName('name');
      const value = child.childForFieldName('value');
      if (name && value && 
          context.source_code.substring(name.startIndex, name.endIndex) === 'metaclass') {
        return context.source_code.substring(value.startIndex, value.endIndex);
      }
    }
  }
  
  return null;
}

/**
 * Extract typed parameters with Python type hints
 */
function extract_typed_parameters(
  params_node: SyntaxNode,
  context: ClassDetectionContext
): ParameterDefinition[] {
  const parameters: ParameterDefinition[] = [];
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    if (child.type === 'typed_parameter' || child.type === 'typed_default_parameter') {
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
  
  return parameters.filter(p => p.name !== 'self' && p.name !== 'cls');
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
): string[] {
  const decorators: string[] = [];
  
  // For decorated_definition, look for all decorator children
  if (node.type === 'decorated_definition') {
    // Iterate through all children to find decorator nodes
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'decorator') {
        // Extract decorator name (after @)
        const name = context.source_code.substring(
          child.startIndex + 1, 
          child.endIndex
        );
        decorators.push(name);
      }
    }
  }
  
  // Look for preceding decorator nodes
  let sibling = node.previousSibling;
  while (sibling && sibling.type === 'decorator') {
    const name = context.source_code.substring(sibling.startIndex + 1, sibling.endIndex);
    decorators.unshift(name);
    sibling = sibling.previousSibling;
  }
  
  return decorators;
}

/**
 * Handle decorated definitions (methods with decorators)
 */
export function handle_decorated_definition(
  node: SyntaxNode,
  context: ClassDetectionContext
): MethodDefinition | null {
  const definition = node.childForFieldName('definition');
  if (definition && definition.type === 'function_definition') {
    // Extract method and enhance with decorators from parent node
    const method = extract_method_python(definition, context);
    if (method) {
      return enhance_python_method(method, definition, context, node);
    }
  }
  return null;
}

/**
 * Basic Python method extraction (before enhancement)
 */
function extract_method_python(
  node: SyntaxNode,
  context: ClassDetectionContext
): MethodDefinition | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const method_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check if async
  const is_async = node.children.some(c => c.type === 'async');
  
  // Private methods start with _ or __
  const is_private = method_name.startsWith('_');
  const is_protected = method_name.startsWith('_') && !method_name.startsWith('__');
  
  return {
    name: method_name,
    location: node_to_location(node, context.file_path),
    is_static: false, // Will be updated by decorators
    is_abstract: false, // Will be updated by decorators
    is_private,
    is_protected,
    is_constructor: method_name === '__init__',
    is_async,
    parameters: [],
    is_override: false,
    overridden_by: []
  };
}