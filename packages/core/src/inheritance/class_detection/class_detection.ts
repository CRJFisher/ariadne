/**
 * Generic class detection processor
 * 
 * This module provides configuration-driven class detection that handles
 * ~85% of the logic across all languages. Language-specific features are
 * handled by bespoke modules.
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
import { node_to_location } from '../../ast/node_utils';
import { get_language_config, ClassDetectionConfig } from './language_configs';

/**
 * Generic class detection using configuration
 * 
 * This handles the common patterns across all languages:
 * - Walking the AST tree
 * - Extracting class names and inheritance
 * - Extracting methods and properties
 * - Handling modifiers
 */
export function find_classes_generic(
  context: ClassDetectionContext
): ClassDefinition[] {
  const config = get_language_config(context.language);
  const classes: ClassDefinition[] = [];
  const processed_nodes = new Set<any>();
  
  // Walk tree looking for class nodes
  walk_tree(context.ast_root, (node) => {
    if (config.class_node_types.includes(node.type)) {
      // Skip if already processed (to avoid duplicates)
      if (processed_nodes.has(node)) return;
      
      // For 'class' nodes, only process if they're class expressions (not inside declarations or other classes)
      if (node.type === 'class') {
        const parent = node.parent;
        // Skip if this is inside a class_declaration (it will be handled by the declaration)
        if (parent && parent.type === 'class_declaration') {
          return;
        }
        // Skip if this is inside an abstract_class_declaration (TypeScript)
        if (parent && parent.type === 'abstract_class_declaration') {
          return;
        }
        // Skip if this is nested inside another class (JavaScript doesn't support nested classes at this level)
        if (parent && parent.type === 'class') {
          return;
        }
      }
      
      const class_def = extract_class_generic(node, context, config);
      if (class_def) {
        classes.push(class_def);
        processed_nodes.add(node);
      }
    }
  });
  
  return classes;
}

/**
 * Extract class definition using configuration
 */
export function extract_class_generic(
  node: SyntaxNode,
  context: ClassDetectionContext,
  config: ClassDetectionConfig
): ClassDefinition | null {
  // Extract name
  const name = extract_class_name(node, context, config);
  if (!name) return null;
  
  // Extract inheritance
  const { extends_list, implements_list } = extract_inheritance(node, context, config);
  
  // Extract body
  const body_node = node.childForFieldName(config.fields.body);
  const { methods, properties } = extract_class_body(body_node, context, config);
  
  // Check modifiers
  // For TypeScript, abstract_class_declaration nodes are inherently abstract
  const is_abstract = node.type === 'abstract_class_declaration' || 
                     check_modifier(node, config.method_config.modifiers.abstract);
  
  // Build class definition
  const class_def: ClassDefinition = {
    name,
    location: node_to_location(node, context.file_path),
    extends: extends_list, // Non-nullable array guaranteed by extract_inheritance
    implements: implements_list, // Non-nullable array guaranteed by extract_inheritance
    generics: [], // No generics support yet, default to empty array
    decorators: [], // No decorators extracted yet, default to empty array
    methods,
    properties,
    is_abstract: is_abstract || false,
    is_final: false, // Set appropriate defaults
    is_interface: false,
    is_trait: false,
    is_mixin: false,
    is_exported: false // This would need to be determined from context
  };
  
  return class_def;
}

/**
 * Extract class name
 */
function extract_class_name(
  node: SyntaxNode,
  context: ClassDetectionContext,
  config: ClassDetectionConfig
): string | null {
  // For class expressions, always try to get the variable name first
  if (node.type === 'class' && config.patterns.class_expression) {
    const var_name = extract_class_expression_name(node, context);
    if (var_name && var_name !== 'AnonymousClass') {
      return var_name;
    }
  }
  
  const name_node = node.childForFieldName(config.fields.name);
  if (!name_node) {
    // Handle anonymous class expressions
    if (config.patterns.class_expression) {
      return extract_class_expression_name(node, context);
    }
    return null;
  }
  
  return context.source_code.substring(name_node.startIndex, name_node.endIndex);
}

/**
 * Extract class expression name
 */
function extract_class_expression_name(
  node: SyntaxNode,
  context: ClassDetectionContext
): string {
  const parent = node.parent;
  
  if (parent?.type === 'variable_declarator') {
    const id_node = parent.childForFieldName('name');
    if (id_node) {
      return context.source_code.substring(id_node.startIndex, id_node.endIndex);
    }
  } else if (parent?.type === 'assignment_expression') {
    const left_node = parent.childForFieldName('left');
    if (left_node) {
      return context.source_code.substring(left_node.startIndex, left_node.endIndex);
    }
  }
  
  return 'AnonymousClass';
}

/**
 * Extract inheritance information
 */
function extract_inheritance(
  node: SyntaxNode,
  context: ClassDetectionContext,
  config: ClassDetectionConfig
): { extends_list: string[], implements_list: string[] } {
  const extends_list: string[] = [];
  const implements_list: string[] = [];

  // Single inheritance
  if (config.fields.superclass) {
    const superclass_node = node.childForFieldName(config.fields.superclass);
    if (superclass_node) {
      extends_list.push(context.source_code.substring(
        superclass_node.startIndex,
        superclass_node.endIndex
      ));
    }
  }

  // Multiple inheritance (Python)
  if (config.fields.superclasses) {
    const superclasses_node = node.childForFieldName(config.fields.superclasses);
    if (superclasses_node) {
      extract_base_classes(superclasses_node, context, extends_list);
    }
  }

  return {
    extends_list, // Always return non-null arrays
    implements_list // Always return non-null arrays
  };
}

/**
 * Extract base classes from inheritance list
 */
function extract_base_classes(
  node: SyntaxNode,
  context: ClassDetectionContext,
  bases: string[]
): void {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    
    // Skip syntax elements
    if (child.type === '(' || child.type === ')' || child.type === ',') continue;
    
    // Handle identifiers and attribute access
    if (child.type === 'identifier' || child.type === 'attribute') {
      bases.push(context.source_code.substring(child.startIndex, child.endIndex));
    }
  }
}

/**
 * Extract class body (methods and properties)
 */
function extract_class_body(
  body_node: SyntaxNode | null,
  context: ClassDetectionContext,
  config: ClassDetectionConfig
): { methods: MethodDefinition[], properties: PropertyDefinition[] } {
  const methods: MethodDefinition[] = [];
  const properties: PropertyDefinition[] = [];
  
  if (!body_node) return { methods, properties };
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    // Skip function_definition if it's inside a decorated_definition (Python)
    // These will be handled by the bespoke handler
    if (context.language === 'python' && child.type === 'decorated_definition') {
      continue; // Skip - will be handled by bespoke handler
    }
    
    // Check for methods
    if (config.member_types.method.includes(child.type)) {
      const method = extract_method_generic(child, context, config);
      if (method) {
        methods.push(method);
      }
    }
    
    // Check for properties
    if (config.member_types.property.includes(child.type)) {
      const property = extract_property_generic(child, context, config);
      if (property) {
        properties.push(property);
      }
    }
  }
  
  return { methods, properties };
}

/**
 * Extract method using configuration
 */
export function extract_method_generic(
  node: SyntaxNode,
  context: ClassDetectionContext,
  config: ClassDetectionConfig
): MethodDefinition | null {
  // Handle abstract_method_signature which has name as a direct child
  let name_node = node.childForFieldName(config.method_config.name_field);
  if (!name_node && node.type === 'abstract_method_signature') {
    // For abstract methods, the name is typically the second child (after 'abstract')
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'property_identifier') {
        name_node = child;
        break;
      }
    }
  }
  if (!name_node) return null;
  
  const method_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check modifiers
  const is_static = check_modifier(node, config.method_config.modifiers.static);
  const is_async = check_modifier(node, config.method_config.modifiers.async);
  // For abstract_method_signature, it's inherently abstract
  const is_abstract = node.type === 'abstract_method_signature' || 
                     check_modifier(node, config.method_config.modifiers.abstract);
  
  // Check access modifiers
  const { is_private, is_protected } = check_access_modifiers(method_name, node, config);
  
  // Extract parameters
  let params_node = node.childForFieldName(config.method_config.params_field);
  if (!params_node && node.type === 'abstract_method_signature') {
    // For abstract methods, look for formal_parameters child
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'formal_parameters') {
        params_node = child;
        break;
      }
    }
  }
  const parameters = extract_parameters_generic(params_node, context, config);
  
  // Check if constructor
  const is_constructor = method_name === config.patterns.constructor_name;
  
  return {
    name: method_name,
    location: node_to_location(node, context.file_path),
    is_static,
    is_abstract,
    is_private,
    is_protected,
    is_constructor,
    is_async,
    parameters: filter_self_parameter(parameters),
    is_override: false,
    overridden_by: []
  };
}

/**
 * Extract property using configuration
 */
export function extract_property_generic(
  node: SyntaxNode,
  context: ClassDetectionContext,
  config: ClassDetectionConfig
): PropertyDefinition | null {
  // Try both name fields
  const name_node = node.childForFieldName(config.property_config.name_field || '') ||
                   node.childForFieldName(config.property_config.property_field || '');
  
  if (!name_node) return null;
  
  const property_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check modifiers
  const is_static = check_modifier(node, config.property_config.modifiers.static);
  const is_readonly = check_modifier(node, config.property_config.modifiers.readonly);
  
  // Check access modifiers
  const { is_private, is_protected } = check_access_modifiers(property_name, node, config);
  
  // Extract initial value
  const value_node = node.childForFieldName(config.property_config.value_field || '');
  const initial_value = value_node
    ? context.source_code.substring(value_node.startIndex, value_node.endIndex)
    : undefined;
  
  return {
    name: property_name,
    location: node_to_location(node, context.file_path),
    is_static,
    is_private,
    is_protected,
    is_readonly,
    initial_value
  };
}

/**
 * Extract parameters using configuration
 */
export function extract_parameters_generic(
  params_node: SyntaxNode | null,
  context: ClassDetectionContext,
  config: ClassDetectionConfig
): ParameterDefinition[] {
  const parameters: ParameterDefinition[] = [];
  
  if (!params_node) return parameters;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    // Skip syntax elements
    if (child.type === '(' || child.type === ')' || child.type === ',') continue;
    
    // Regular parameters
    if (config.parameter_types.regular.includes(child.type)) {
      parameters.push({
        name: context.source_code.substring(child.startIndex, child.endIndex),
        is_optional: false,
        is_rest: false
      });
    }
    // Optional parameters
    else if (config.parameter_types.optional?.includes(child.type)) {
      const param = extract_optional_parameter(child, context);
      if (param) parameters.push(param);
    }
    // Rest parameters
    else if (config.parameter_types.rest?.includes(child.type)) {
      const param = extract_rest_parameter(child, context);
      if (param) parameters.push(param);
    }
  }
  
  return parameters;
}

/**
 * Extract optional parameter
 */
function extract_optional_parameter(
  node: SyntaxNode,
  context: ClassDetectionContext
): ParameterDefinition | null {
  const name_node = node.childForFieldName('name') || 
                    node.childForFieldName('left') ||
                    node.child(0);
  
  if (!name_node) return null;
  
  const value_node = node.childForFieldName('value') ||
                    node.childForFieldName('right');
  
  return {
    name: context.source_code.substring(name_node.startIndex, name_node.endIndex),
    is_optional: true,
    is_rest: false,
    default_value: value_node
      ? context.source_code.substring(value_node.startIndex, value_node.endIndex)
      : undefined
  };
}

/**
 * Extract rest parameter
 */
function extract_rest_parameter(
  node: SyntaxNode,
  context: ClassDetectionContext
): ParameterDefinition | null {
  // Skip the rest operator (..., *, **)
  const name_node = node.child(1);
  if (!name_node) return null;
  
  return {
    name: context.source_code.substring(name_node.startIndex, name_node.endIndex),
    is_optional: false,
    is_rest: true
  };
}

/**
 * Check if node has modifiers
 */
function check_modifier(
  node: SyntaxNode,
  modifiers?: string[]
): boolean {
  if (!modifiers) return false;
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && modifiers.includes(child.type)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check access modifiers
 */
function check_access_modifiers(
  name: string,
  node: SyntaxNode,
  config: ClassDetectionConfig
): { is_private: boolean, is_protected: boolean } {
  let is_private = false;
  let is_protected = false;
  
  // Check prefix-based privacy
  if (config.access_modifiers.private_prefix) {
    // Python uses _ as the prefix
    if (config.access_modifiers.private_prefix === '_') {
      is_private = name.startsWith('__');
      is_protected = name.startsWith('_') && !name.startsWith('__');
    } 
    // JavaScript uses # as the prefix
    else if (name.startsWith(config.access_modifiers.private_prefix)) {
      is_private = true;
    }
  }
  
  // Check keyword-based modifiers
  if (config.access_modifiers.private_keyword) {
    is_private = is_private || check_modifier(node, config.access_modifiers.private_keyword);
  }
  
  if (config.access_modifiers.protected_keyword) {
    is_protected = is_protected || check_modifier(node, config.access_modifiers.protected_keyword);
  }
  
  return { is_private, is_protected };
}

/**
 * Filter out self/cls parameters
 */
function filter_self_parameter(parameters: ParameterDefinition[]): ParameterDefinition[] {
  return parameters.filter(p => 
    p.name !== 'self' && 
    p.name !== 'cls' && 
    !p.name.includes('self')
  );
}

/**
 * Walk the AST tree
 */
export function walk_tree(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}