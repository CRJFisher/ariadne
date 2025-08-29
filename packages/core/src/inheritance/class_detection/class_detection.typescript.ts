/**
 * TypeScript class detection
 * 
 * Extends JavaScript class detection with TypeScript-specific features:
 * - Abstract classes
 * - Interface implementations
 * - Generic parameters
 * - Access modifiers
 * - Decorators
 */

import { SyntaxNode } from 'tree-sitter';
import { 
  ClassDefinition,
  MethodDefinition,
  PropertyDefinition,
  ParameterDefinition,
  GenericParameter,
  Location
} from '@ariadnejs/types';
import { ClassDetectionContext } from './index';
import { find_class_definitions_javascript } from './class_detection.javascript';

/**
 * Find all class definitions in TypeScript code
 */
export function find_class_definitions_typescript(
  context: ClassDetectionContext
): ClassDefinition[] {
  // Start with JavaScript class detection
  const js_classes = find_class_definitions_javascript(context);
  
  // Enhance with TypeScript-specific features
  const ts_classes: ClassDefinition[] = [];
  
  walk_tree(context.ast_root, (node) => {
    if (node.type === 'class_declaration' || node.type === 'class') {
      const ts_class = extract_typescript_class(node, context);
      if (ts_class) {
        // Find corresponding JS class and merge
        const js_class = js_classes.find(c => 
          c.location.row === ts_class.location.row &&
          c.location.column === ts_class.location.column
        );
        
        if (js_class) {
          // Merge TypeScript features into JS class
          ts_classes.push({
            ...js_class,
            ...ts_class,
            methods: merge_methods(js_class.methods, ts_class.methods),
            properties: merge_properties(js_class.properties, ts_class.properties)
          });
        } else {
          ts_classes.push(ts_class);
        }
      }
    }
  });
  
  // Return TypeScript-enhanced classes or fallback to JS classes
  return ts_classes.length > 0 ? ts_classes : js_classes;
}

/**
 * Extract TypeScript-specific class features
 */
function extract_typescript_class(
  node: SyntaxNode,
  context: ClassDetectionContext
): ClassDefinition | null {
  const name_node = node.type === 'class_declaration' 
    ? node.childForFieldName('name')
    : find_class_name(node, context);
    
  if (!name_node) return null;
  
  const class_name = typeof name_node === 'string' 
    ? name_node 
    : context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check for abstract modifier
  const is_abstract = has_modifier(node, 'abstract');
  
  // Extract generic parameters
  const type_params_node = node.childForFieldName('type_parameters');
  const generics = extract_generic_parameters(type_params_node, context);
  
  // Extract extends clause
  const heritage_node = find_child_by_type(node, 'class_heritage');
  const { extends_list, implements_list } = extract_heritage(heritage_node, context);
  
  // Extract decorators
  const decorators = extract_decorators(node, context);
  
  // Extract body with TypeScript features
  const body_node = node.childForFieldName('body');
  const { methods, properties } = extract_typescript_body(body_node, context);
  
  return {
    name: class_name,
    location: node_to_location(node),
    extends: extends_list,
    implements: implements_list,
    is_abstract,
    generics,
    methods,
    properties,
    decorators,
    language: 'typescript',
    file_path: context.file_path
  };
}

/**
 * Extract class heritage (extends and implements)
 */
function extract_heritage(
  heritage_node: SyntaxNode | null,
  context: ClassDetectionContext
): { extends_list?: string[], implements_list?: string[] } {
  if (!heritage_node) return {};
  
  const extends_list: string[] = [];
  const implements_list: string[] = [];
  
  for (let i = 0; i < heritage_node.childCount; i++) {
    const child = heritage_node.child(i);
    if (!child) continue;
    
    if (child.type === 'extends_clause') {
      const type_node = find_child_by_type(child, 'type_identifier') ||
                       find_child_by_type(child, 'member_expression');
      if (type_node) {
        extends_list.push(context.source_code.substring(type_node.startIndex, type_node.endIndex));
      }
    }
    
    if (child.type === 'implements_clause') {
      // Can implement multiple interfaces
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
    extends: extends_list.length > 0 ? extends_list : undefined,
    implements: implements_list.length > 0 ? implements_list : undefined
  };
}

/**
 * Extract TypeScript class body
 */
function extract_typescript_body(
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
      const method = extract_typescript_method(child, context);
      if (method) {
        methods.push(method);
      }
    }
    
    // Property declaration (TypeScript style)
    if (child.type === 'public_field_definition' || 
        child.type === 'field_definition' ||
        child.type === 'property_signature') {
      const property = extract_typescript_property(child, context);
      if (property) {
        properties.push(property);
      }
    }
  }
  
  return { methods, properties };
}

/**
 * Extract TypeScript method with modifiers and types
 */
function extract_typescript_method(
  node: SyntaxNode,
  context: ClassDetectionContext
): MethodDefinition | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const method_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check accessibility modifiers
  const is_private = has_modifier(node, 'private') || method_name.startsWith('#');
  const is_protected = has_modifier(node, 'protected');
  const is_static = has_modifier(node, 'static');
  const is_abstract = has_modifier(node, 'abstract');
  const is_async = has_modifier(node, 'async');
  
  // Extract parameters with types
  const params_node = node.childForFieldName('parameters');
  const parameters = extract_typed_parameters(params_node, context);
  
  // Extract return type
  const return_type_node = node.childForFieldName('return_type');
  const return_type = return_type_node
    ? extract_type_annotation(return_type_node, context)
    : undefined;
  
  // Extract generic parameters
  const type_params_node = node.childForFieldName('type_parameters');
  const generics = extract_generic_parameters(type_params_node, context);
  
  // Extract decorators
  const decorators = extract_decorators(node, context);
  
  return {
    name: method_name,
    location: node_to_location(node),
    is_static,
    is_abstract,
    is_private,
    is_protected,
    is_constructor: method_name === 'constructor',
    is_async,
    parameters,
    return_type,
    generics,
    decorators
  };
}

/**
 * Extract TypeScript property with type and modifiers
 */
function extract_typescript_property(
  node: SyntaxNode,
  context: ClassDetectionContext
): PropertyDefinition | null {
  const name_node = node.childForFieldName('name') || node.childForFieldName('property');
  if (!name_node) return null;
  
  const property_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check modifiers
  const is_private = has_modifier(node, 'private') || property_name.startsWith('#');
  const is_protected = has_modifier(node, 'protected');
  const is_static = has_modifier(node, 'static');
  const is_readonly = has_modifier(node, 'readonly');
  
  // Extract type annotation
  const type_node = node.childForFieldName('type');
  const type = type_node ? extract_type_annotation(type_node, context) : undefined;
  
  // Extract initial value
  const value_node = node.childForFieldName('value');
  const initial_value = value_node
    ? context.source_code.substring(value_node.startIndex, value_node.endIndex)
    : undefined;
  
  // Extract decorators
  const decorators = extract_decorators(node, context);
  
  return {
    name: property_name,
    location: node_to_location(node),
    type,
    is_static,
    is_private,
    is_protected,
    is_readonly,
    initial_value,
    decorators
  };
}

/**
 * Extract typed parameters
 */
function extract_typed_parameters(
  params_node: SyntaxNode | null,
  context: ClassDetectionContext
): ParameterDefinition[] {
  const parameters: ParameterDefinition[] = [];
  
  if (!params_node) return parameters;
  
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
  
  return parameters;
}

/**
 * Extract generic parameters
 */
function extract_generic_parameters(
  type_params_node: SyntaxNode | null,
  context: ClassDetectionContext
): GenericParameter[] | undefined {
  if (!type_params_node) return undefined;
  
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
  
  // Look for preceding decorator nodes
  let sibling = node.previousSibling;
  while (sibling && sibling.type === 'decorator') {
    const name = context.source_code.substring(sibling.startIndex + 1, sibling.endIndex); // Skip @
    decorators.unshift(name); // Add to front to maintain order
    sibling = sibling.previousSibling;
  }
  
  return decorators.length > 0 ? decorators : undefined;
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

/**
 * Find class name for class expression
 */
function find_class_name(node: SyntaxNode, context: ClassDetectionContext): string {
  const parent = node.parent;
  
  if (parent && parent.type === 'variable_declarator') {
    const id_node = parent.childForFieldName('name');
    if (id_node) {
      return context.source_code.substring(id_node.startIndex, id_node.endIndex);
    }
  }
  
  return 'AnonymousClass';
}

/**
 * Merge methods from JS and TS extraction
 */
function merge_methods(js_methods: readonly MethodDefinition[], ts_methods: readonly MethodDefinition[]): MethodDefinition[] {
  const merged = new Map<string, MethodDefinition>();
  
  // Add JS methods
  for (const method of js_methods) {
    merged.set(method.name, method);
  }
  
  // Override/enhance with TS methods
  for (const method of ts_methods) {
    merged.set(method.name, method);
  }
  
  return Array.from(merged.values());
}

/**
 * Merge properties from JS and TS extraction
 */
function merge_properties(js_props: readonly PropertyDefinition[], ts_props: readonly PropertyDefinition[]): PropertyDefinition[] {
  const merged = new Map<string, PropertyDefinition>();
  
  // Add JS properties
  for (const prop of js_props) {
    merged.set(prop.name, prop);
  }
  
  // Override/enhance with TS properties
  for (const prop of ts_props) {
    merged.set(prop.name, prop);
  }
  
  return Array.from(merged.values());
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