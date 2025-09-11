/**
 * TypeScript-specific class detection features
 * 
 * This module handles TypeScript features that cannot be expressed
 * through configuration alone (~15% of the logic).
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ClassDefinition,
  MethodDefinition,
  PropertyDefinition,
  ParameterDefinition,
  GenericParameter
} from '@ariadnejs/types';
import { ClassDetectionContext } from './index';
import { node_to_location } from '../../ast/node_utils';

/**
 * Enhance class with TypeScript-specific features
 */
export function enhance_typescript_class(
  class_def: ClassDefinition,
  node: SyntaxNode,
  context: ClassDetectionContext
): ClassDefinition {
  // Check for abstract modifier
  const is_abstract = has_modifier(node, 'abstract');
  if (is_abstract) {
    class_def.is_abstract = true;
  }
  
  // Extract generics
  const type_params_node = node.childForFieldName('type_parameters');
  if (type_params_node) {
    class_def.generics = extract_generic_parameters(type_params_node, context);
  }
  
  // Extract heritage (extends and implements)
  const heritage_node = find_child_by_type(node, 'class_heritage');
  if (heritage_node) {
    const { extends_list, implements_list } = extract_heritage(heritage_node, context);
    if (extends_list?.length) class_def.extends = extends_list;
    if (implements_list?.length) class_def.implements = implements_list;
  }
  
  // Extract decorators
  const decorators = extract_decorators(node, context);
  if (decorators?.length) class_def.decorators = decorators;
  
  return class_def;
}

/**
 * Check if node has a specific modifier
 */
function has_modifier(node: SyntaxNode, modifier: string): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === modifier) {
      return true;
    }
  }
  return false;
}

/**
 * Enhance method with TypeScript-specific features
 */
export function enhance_typescript_method(
  method: MethodDefinition,
  node: SyntaxNode,
  context: ClassDetectionContext
): MethodDefinition {
  // Check for abstract modifier
  const is_abstract = has_modifier(node, 'abstract');
  if (is_abstract) {
    method.is_abstract = true;
  }
  
  // Extract return type
  const return_type_node = node.childForFieldName('return_type');
  if (return_type_node) {
    method.return_type = extract_type_annotation(return_type_node, context);
  }
  
  // Extract generic parameters
  const type_params_node = node.childForFieldName('type_parameters');
  if (type_params_node) {
    method.generics = extract_generic_parameters(type_params_node, context);
  }
  
  // Extract decorators
  const decorators = extract_decorators(node, context);
  if (decorators?.length) method.decorators = decorators;
  
  // Enhance parameters with types
  const params_node = node.childForFieldName('parameters');
  if (params_node) {
    method.parameters = extract_typed_parameters(params_node, context);
  }
  
  return method;
}

/**
 * Enhance property with TypeScript-specific features
 */
export function enhance_typescript_property(
  property: PropertyDefinition,
  node: SyntaxNode,
  context: ClassDetectionContext
): PropertyDefinition {
  // Extract type annotation
  const type_node = node.childForFieldName('type');
  if (type_node) {
    property.type = extract_type_annotation(type_node, context);
  }
  
  // Extract decorators
  const decorators = extract_decorators(node, context);
  if (decorators?.length) property.decorators = decorators;
  
  return property;
}

/**
 * Extract class heritage (extends and implements)
 */
function extract_heritage(
  heritage_node: SyntaxNode,
  context: ClassDetectionContext
): { extends_list?: string[], implements_list?: string[] } {
  const extends_list: string[] = [];
  const implements_list: string[] = [];
  
  for (let i = 0; i < heritage_node.childCount; i++) {
    const child = heritage_node.child(i);
    if (!child) continue;
    
    if (child.type === 'extends_clause') {
      // Look for the extended type (could be type_identifier, member_expression, or generic_type)
      for (let j = 0; j < child.childCount; j++) {
        const type_child = child.child(j);
        if (type_child && type_child.type !== 'extends' && type_child.type !== 'type_arguments') {
          // Extract the base type name (ignore type arguments like <string>)
          if (type_child.type === 'generic_type') {
            const base_type = type_child.childForFieldName('name') || type_child.child(0);
            if (base_type) {
              extends_list.push(context.source_code.substring(base_type.startIndex, base_type.endIndex));
            }
          } else if (type_child.type === 'identifier' || type_child.type === 'type_identifier' || type_child.type === 'member_expression') {
            extends_list.push(context.source_code.substring(type_child.startIndex, type_child.endIndex));
          }
        }
      }
    }
    
    if (child.type === 'implements_clause') {
      for (let j = 0; j < child.childCount; j++) {
        const impl_child = child.child(j);
        if (impl_child && (impl_child.type === 'type_identifier' || impl_child.type === 'generic_type')) {
          const name = impl_child.type === 'generic_type'
            ? impl_child.childForFieldName('name')
            : impl_child;
          if (name) {
            implements_list.push(context.source_code.substring(name.startIndex, name.endIndex));
          }
        }
      }
    }
  }
  
  return {
    extends_list: extends_list.length > 0 ? extends_list : undefined,
    implements_list: implements_list.length > 0 ? implements_list : undefined
  };
}

/**
 * Extract typed parameters with TypeScript type annotations
 */
function extract_typed_parameters(
  params_node: SyntaxNode,
  context: ClassDetectionContext
): ParameterDefinition[] {
  const parameters: ParameterDefinition[] = [];
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
      const pattern = child.childForFieldName('pattern');
      const type_node = child.childForFieldName('type');
      
      if (pattern) {
        const name = pattern.type === 'identifier'
          ? context.source_code.substring(pattern.startIndex, pattern.endIndex)
          : context.source_code.substring(pattern.startIndex, pattern.endIndex);
        
        parameters.push({
          name,
          type: type_node ? extract_type_annotation(type_node, context) : undefined,
          is_optional: child.type === 'optional_parameter',
          is_rest: false
        });
      }
    } else if (child.type === 'rest_parameter') {
      const pattern = child.child(1); // Skip ...
      const type_node = child.childForFieldName('type');
      
      if (pattern) {
        parameters.push({
          name: context.source_code.substring(pattern.startIndex, pattern.endIndex),
          type: type_node ? extract_type_annotation(type_node, context) : undefined,
          is_optional: false,
          is_rest: true
        });
      }
    }
  }
  
  return parameters.filter(p => p.name !== 'self' && p.name !== 'cls');
}

/**
 * Extract generic parameters
 */
function extract_generic_parameters(
  type_params_node: SyntaxNode,
  context: ClassDetectionContext
): GenericParameter[] | undefined {
  const generics: GenericParameter[] = [];
  
  for (let i = 0; i < type_params_node.childCount; i++) {
    const child = type_params_node.child(i);
    if (!child) continue;
    
    if (child.type === 'type_parameter') {
      const name_node = child.childForFieldName('name');
      const constraint_node = child.childForFieldName('constraint');
      const default_node = child.childForFieldName('value');
      
      if (name_node) {
        generics.push({
          name: context.source_code.substring(name_node.startIndex, name_node.endIndex),
          constraint: constraint_node 
            ? extract_type_annotation(constraint_node, context)
            : undefined,
          default: default_node
            ? extract_type_annotation(default_node, context)
            : undefined
        });
      }
    }
  }
  
  return generics.length > 0 ? generics : undefined;
}

/**
 * Extract type annotation
 */
function extract_type_annotation(
  type_node: SyntaxNode,
  context: ClassDetectionContext
): string {
  // Skip the : if present
  if (type_node.type === 'type_annotation') {
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
  
  // For TypeScript, decorators are children of the class_declaration node
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === 'decorator') {
      const name = context.source_code.substring(child.startIndex + 1, child.endIndex); // Skip @
      decorators.push(name);
    }
    // Stop when we hit the class keyword or body
    if (child && (child.type === 'class' || child.type === 'class_body')) {
      break;
    }
  }
  
  return decorators.length > 0 ? decorators : undefined;
}

/**
 * Find child node by type
 */
function find_child_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === type) {
      return child;
    }
  }
  return null;
}