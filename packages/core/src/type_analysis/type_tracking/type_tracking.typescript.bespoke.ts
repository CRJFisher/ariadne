/**
 * TypeScript-specific bespoke type tracking features
 * 
 * Handles TypeScript features that cannot be expressed through configuration:
 * - Complex generic type parameters
 * - Interface declaration tracking
 * - Type alias definitions
 * - Decorator metadata
 * - Conditional types
 * - Mapped types
 */

import { SyntaxNode } from 'tree-sitter';
import {
  TypeInfo,
  FileTypeTracker,
  TypeTrackingContext,
  set_variable_type,
  mark_as_exported
} from './type_tracking';
import { node_to_location } from '../../ast/node_utils';

/**
 * Track TypeScript interface declarations
 */
export function track_typescript_interface(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'interface_declaration') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  if (!name_node) return tracker;
  
  const interface_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Track as a type definition
  const type_info: TypeInfo = {
    type_name: interface_name,
    type_kind: 'interface',
    location: node_to_location(node, context.file_path),
    confidence: 'explicit',
    source: 'annotation'
  };
  
  // Add to tracker
  let updated_tracker = set_variable_type(tracker, `interface:${interface_name}`, type_info);
  
  // Check if exported
  const parent = node.parent;
  if (parent && parent.type === 'export_statement') {
    updated_tracker = mark_as_exported(updated_tracker, interface_name);
  }
  
  return updated_tracker;
}

/**
 * Track TypeScript type alias definitions
 */
export function track_typescript_type_alias(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'type_alias_declaration') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  const value_node = node.childForFieldName('value');
  
  if (!name_node) return tracker;
  
  const alias_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Track the type alias
  const type_info: TypeInfo = {
    type_name: alias_name,
    type_kind: 'unknown', // Type aliases can be anything
    location: node_to_location(node, context.file_path),
    confidence: 'explicit',
    source: 'annotation'
  };
  
  return set_variable_type(tracker, `type:${alias_name}`, type_info);
}

/**
 * Extract complex generic type parameters
 * e.g., Map<string, Array<User>>, Promise<Response<Data>>
 */
export function extract_typescript_complex_generics(
  node: SyntaxNode,
  context: TypeTrackingContext
): string {
  if (node.type !== 'generic_type') {
    return context.source_code.substring(node.startIndex, node.endIndex);
  }
  
  const name_node = node.childForFieldName('name');
  const type_arguments = node.childForFieldName('type_arguments');
  
  if (!name_node) {
    return context.source_code.substring(node.startIndex, node.endIndex);
  }
  
  const base_type = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  if (!type_arguments) {
    return base_type;
  }
  
  // Build the full generic type string
  const args: string[] = [];
  for (let i = 0; i < type_arguments.childCount; i++) {
    const arg = type_arguments.child(i);
    if (arg && arg.type !== ',' && arg.type !== '<' && arg.type !== '>') {
      // Recursively handle nested generics
      args.push(extract_typescript_complex_generics(arg, context));
    }
  }
  
  return `${base_type}<${args.join(', ')}>`;
}

/**
 * Track TypeScript enum declarations
 */
export function track_typescript_enum(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'enum_declaration') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  if (!name_node) return tracker;
  
  const enum_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Track enum as a type
  const type_info: TypeInfo = {
    type_name: enum_name,
    type_kind: 'class', // Enums behave like classes in some ways
    location: node_to_location(node, context.file_path),
    confidence: 'explicit',
    source: 'annotation'
  };
  
  return set_variable_type(tracker, `enum:${enum_name}`, type_info);
}

/**
 * Handle TypeScript decorators for type metadata
 */
export function extract_decorator_type_metadata(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type !== 'decorator') {
    return undefined;
  }
  
  // Decorators can provide type information in frameworks like Angular, NestJS
  // Find the decorator name - it's usually in a call_expression child
  let decorator_name: string | undefined;
  
  // Look for call_expression child
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === 'call_expression') {
      const func = child.childForFieldName('function');
      if (func) {
        decorator_name = context.source_code.substring(func.startIndex, func.endIndex);
        break;
      }
    }
  }
  
  // If no call_expression, look for identifier directly
  if (!decorator_name) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'identifier') {
        decorator_name = context.source_code.substring(child.startIndex, child.endIndex);
        break;
      }
    }
  }
  
  if (!decorator_name) return undefined;
  
  // Common decorators that imply types
  const type_decorators: Record<string, string> = {
    'Injectable': 'Service',
    'Component': 'Component',
    'Controller': 'Controller',
    'Entity': 'Entity',
    'Module': 'Module'
  };
  
  const implied_type = type_decorators[decorator_name];
  if (implied_type) {
    return {
      type_name: implied_type,
      type_kind: 'class',
      location: node_to_location(node, context.file_path),
      confidence: 'inferred',
      source: 'annotation'
    };
  }
  
  return undefined;
}

/**
 * Handle TypeScript conditional types
 * e.g., T extends string ? string[] : number[]
 */
export function extract_typescript_conditional_type(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type !== 'conditional_type') {
    return undefined;
  }
  
  // For now, we just mark it as a complex type
  // Full resolution would require type parameter context
  return {
    type_name: 'ConditionalType',
    type_kind: 'unknown',
    location: node_to_location(node, context.file_path),
    confidence: 'inferred',
    source: 'annotation'
  };
}

/**
 * Handle TypeScript mapped types
 * e.g., { [K in keyof T]: T[K] }
 */
export function extract_typescript_mapped_type(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type !== 'mapped_type') {
    return undefined;
  }
  
  // Mapped types are complex and would require full type resolution
  return {
    type_name: 'MappedType',
    type_kind: 'object',
    location: node_to_location(node, context.file_path),
    confidence: 'inferred',
    source: 'annotation'
  };
}

/**
 * Track TypeScript namespace declarations
 */
export function track_typescript_namespace(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'module' && node.type !== 'namespace_declaration') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  if (!name_node) return tracker;
  
  const namespace_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Track namespace as a container type
  const type_info: TypeInfo = {
    type_name: namespace_name,
    type_kind: 'object', // Namespaces are object-like
    location: node_to_location(node, context.file_path),
    confidence: 'explicit',
    source: 'annotation'
  };
  
  return set_variable_type(tracker, `namespace:${namespace_name}`, type_info);
}