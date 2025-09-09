/**
 * Python-specific bespoke type tracking features
 * 
 * Handles Python features that cannot be expressed through configuration:
 * - Complex type hints (Union, Optional, Literal)
 * - Duck typing patterns
 * - Metaclasses
 * - Decorators that affect types
 * - Context managers
 * - Multiple inheritance
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
 * Track Python Union type hints
 * x: Union[str, int]
 */
export function extract_python_union_type(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type !== 'subscript') {
    return undefined;
  }
  
  const value_node = node.childForFieldName('value');
  const subscript_node = node.childForFieldName('subscript');
  
  if (!value_node || !subscript_node) return undefined;
  
  const type_name = context.source_code.substring(value_node.startIndex, value_node.endIndex);
  
  if (type_name === 'Union' || type_name === 'Optional') {
    // Extract union members
    const union_types: string[] = [];
    extract_union_members(subscript_node, context.source_code, union_types);
    
    return {
      type_name: type_name === 'Optional' 
        ? `Optional[${union_types.join(' | ')}]`
        : `Union[${union_types.join(' | ')}]`,
      type_kind: 'unknown',
      location: node_to_location(node, context.file_path),
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Handle other generic types like List[str], Dict[str, int]
  if (type_name === 'List' || type_name === 'Dict' || type_name === 'Set' || type_name === 'Tuple') {
    return {
      type_name,
      type_kind: type_name === 'Dict' ? 'object' : 'array',
      location: node_to_location(node, context.file_path),
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  return undefined;
}

/**
 * Track Python dataclass decorators
 * @dataclass creates a class with automatic __init__, __repr__, etc.
 */
export function track_python_dataclass(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'decorated_definition') {
    return tracker;
  }
  
  const decorators = node.childrenForFieldName('decorator');
  const definition = node.childForFieldName('definition');
  
  if (!definition || definition.type !== 'class_definition') {
    return tracker;
  }
  
  let is_dataclass = false;
  for (const decorator of decorators) {
    const decorator_text = context.source_code.substring(decorator.startIndex, decorator.endIndex);
    if (decorator_text.includes('dataclass')) {
      is_dataclass = true;
      break;
    }
  }
  
  if (is_dataclass) {
    const name_node = definition.childForFieldName('name');
    if (name_node) {
      const class_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
      
      const type_info: TypeInfo = {
        type_name: class_name,
        type_kind: 'class',
        location: node_to_location(node, context.file_path),
        confidence: 'explicit',
        source: 'annotation'
      };
      
      return set_variable_type(tracker, `dataclass:${class_name}`, type_info);
    }
  }
  
  return tracker;
}

/**
 * Track Python property decorators
 * @property makes a method behave like an attribute
 */
export function track_python_property(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type !== 'decorated_definition') {
    return undefined;
  }
  
  const decorators = node.childrenForFieldName('decorator');
  const definition = node.childForFieldName('definition');
  
  if (!definition || definition.type !== 'function_definition') {
    return undefined;
  }
  
  for (const decorator of decorators) {
    const decorator_text = context.source_code.substring(decorator.startIndex, decorator.endIndex);
    if (decorator_text === '@property' || decorator_text === 'property') {
      // Extract return type if available
      const return_type = definition.childForFieldName('return_type');
      if (return_type) {
        const type_annotation = return_type.childForFieldName('type');
        if (type_annotation) {
          const type_name = context.source_code.substring(
            type_annotation.startIndex,
            type_annotation.endIndex
          );
          
          return {
            type_name,
            type_kind: 'unknown',
            location: node_to_location(node, context.file_path),
            confidence: 'explicit',
            source: 'annotation'
          };
        }
      }
      
      // Property without type hint
      return {
        type_name: 'property',
        type_kind: 'unknown',
        location: node_to_location(node, context.file_path),
        confidence: 'inferred',
        source: 'annotation'
      };
    }
  }
  
  return undefined;
}

/**
 * Track Python context managers (with statements)
 * with open('file') as f: ...
 */
export function track_python_context_manager(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'with_statement') {
    return tracker;
  }
  
  const with_clause = node.childForFieldName('with_clause');
  if (!with_clause) return tracker;
  
  // Look for 'as' clauses
  for (let i = 0; i < with_clause.childCount; i++) {
    const child = with_clause.child(i);
    if (child && child.type === 'with_item') {
      const value_node = child.childForFieldName('value');
      const alias_node = child.childForFieldName('alias');
      
      if (value_node && alias_node) {
        const var_name = context.source_code.substring(alias_node.startIndex, alias_node.endIndex);
        
        // Infer type from the context manager
        let type_name = 'ContextManager';
        if (value_node.type === 'call') {
          const function_node = value_node.childForFieldName('function');
          if (function_node) {
            const func_name = context.source_code.substring(
              function_node.startIndex,
              function_node.endIndex
            );
            
            // Common context managers
            const context_types: Record<string, string> = {
              'open': 'TextIOWrapper',
              'urlopen': 'HTTPResponse',
              'lock': 'Lock',
              'connection': 'Connection'
            };
            
            type_name = context_types[func_name] || type_name;
          }
        }
        
        const type_info: TypeInfo = {
          type_name,
          type_kind: 'object',
          location: node_to_location(node, context.file_path),
          confidence: 'inferred',
          source: 'assignment'
        };
        
        tracker = set_variable_type(tracker, var_name, type_info);
      }
    }
  }
  
  return tracker;
}

/**
 * Track Python comprehension variables
 * [x for x in items] - x has the element type of items
 */
export function track_python_comprehension(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type !== 'list_comprehension' && 
      node.type !== 'set_comprehension' &&
      node.type !== 'dictionary_comprehension' &&
      node.type !== 'generator_expression') {
    return undefined;
  }
  
  // Comprehensions create a local scope with iterator variables
  // This is a simplified implementation
  return {
    type_name: node.type === 'dictionary_comprehension' ? 'dict' : 'list',
    type_kind: node.type === 'dictionary_comprehension' ? 'object' : 'array',
    location: node_to_location(node, context.file_path),
    confidence: 'inferred',
    source: 'assignment'
  };
}

/**
 * Track Python multiple inheritance
 * class C(A, B): ...
 */
export function track_python_multiple_inheritance(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'class_definition') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  const superclasses = node.childForFieldName('superclasses');
  
  if (!name_node) return tracker;
  
  const class_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  if (superclasses && superclasses.childCount > 0) {
    const base_classes: string[] = [];
    
    for (let i = 0; i < superclasses.childCount; i++) {
      const child = superclasses.child(i);
      if (child && child.type === 'identifier') {
        base_classes.push(context.source_code.substring(child.startIndex, child.endIndex));
      }
    }
    
    if (base_classes.length > 1) {
      // Multiple inheritance
      const type_info: TypeInfo = {
        type_name: `${class_name}(${base_classes.join(', ')})`,
        type_kind: 'class',
        location: node_to_location(node, context.file_path),
        confidence: 'explicit',
        source: 'annotation'
      };
      
      return set_variable_type(tracker, class_name, type_info);
    }
  }
  
  return tracker;
}

/**
 * Track Python import with type stubs
 * from typing import ... imports
 */
export function track_python_typing_imports(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'import_from_statement') {
    return tracker;
  }
  
  const module_node = node.childForFieldName('module_name');
  if (!module_node) return tracker;
  
  const module_name = context.source_code.substring(module_node.startIndex, module_node.endIndex);
  
  if (module_name === 'typing' || module_name === 'typing_extensions') {
    // Track typing module imports specially
    const imports = [];
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'dotted_name') {
        const import_name = context.source_code.substring(child.startIndex, child.endIndex);
        imports.push(import_name);
        
        tracker = set_imported_class(tracker, import_name, {
          class_name: import_name,
          source_module: module_name,
          local_name: import_name,
          is_type_only: true
        });
      }
    }
  }
  
  return tracker;
}

// Helper functions

function extract_union_members(
  node: SyntaxNode,
  source_code: string,
  members: string[]
): void {
  if (node.type === 'identifier' || node.type === 'attribute') {
    members.push(source_code.substring(node.startIndex, node.endIndex));
    return;
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type !== ',' && child.type !== '[' && child.type !== ']') {
      extract_union_members(child, source_code, members);
    }
  }
}