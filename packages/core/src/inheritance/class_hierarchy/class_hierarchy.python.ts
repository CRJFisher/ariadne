/**
 * Python-specific bespoke handlers for class hierarchy
 * 
 * Handles Python-specific features that cannot be expressed through configuration:
 * - Metaclass detection and handling
 * - Abstract base class (ABC) detection
 * - Method resolution order (MRO) computation
 * - Special method inheritance patterns
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ClassNode,
  ClassDefinition
} from '@ariadnejs/types';
import {
  BespokeHandlers,
  ClassHierarchyContext
} from './class_hierarchy';
import { AnyLocationFormat, extractTargetPosition } from '../../ast/location_utils';

/**
 * Create Python bespoke handlers
 */
export function create_python_handlers(): BespokeHandlers {
  return {
    extract_metaclass,
    detect_abstract_base,
    post_process_node: post_process_python_node
  };
}

/**
 * Extract metaclass from class definition
 */
function extract_metaclass(
  def: ClassDefinition,
  context: ClassHierarchyContext
): string | undefined {
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return undefined;
  
  // Find class_definition
  let class_def = ast_node;
  while (class_def && class_def.type !== 'class_definition') {
    class_def = class_def.parent;
  }
  
  if (!class_def) return undefined;
  
  // Look for superclasses (argument_list)
  const superclasses = class_def.childForFieldName('superclasses');
  if (!superclasses || superclasses.type !== 'argument_list') {
    return undefined;
  }
  
  // Find metaclass keyword argument
  for (let i = 0; i < superclasses.childCount; i++) {
    const child = superclasses.child(i);
    if (!child) continue;
    
    if (child.type === 'keyword_argument') {
      const name = child.childForFieldName('name');
      const value = child.childForFieldName('value');
      
      if (name && name.text === 'metaclass' && value) {
        return extract_expression_name(value, context.source_code);
      }
    }
  }
  
  return undefined;
}

/**
 * Detect if class is an abstract base class
 */
function detect_abstract_base(
  def: ClassDefinition,
  context: ClassHierarchyContext
): boolean {
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return false;
  
  // Find class_definition
  let class_def = ast_node;
  while (class_def && class_def.type !== 'class_definition') {
    class_def = class_def.parent;
  }
  
  if (!class_def) return false;
  
  // Check if inherits from ABC or has ABC metaclass
  const superclasses = class_def.childForFieldName('superclasses');
  if (!superclasses || superclasses.type !== 'argument_list') {
    return false;
  }
  
  for (let i = 0; i < superclasses.childCount; i++) {
    const child = superclasses.child(i);
    if (!child) continue;
    
    // Skip punctuation
    if (child.type === '(' || child.type === ')' || child.type === ',') continue;
    
    // Check for ABC inheritance
    const name = extract_expression_name(child, context.source_code);
    if (name && is_abc_class(name)) {
      return true;
    }
    
    // Check for ABCMeta metaclass
    if (child.type === 'keyword_argument') {
      const arg_name = child.childForFieldName('name');
      const value = child.childForFieldName('value');
      
      if (arg_name && arg_name.text === 'metaclass' && value) {
        const metaclass = extract_expression_name(value, context.source_code);
        if (metaclass && metaclass.includes('ABCMeta')) {
          return true;
        }
      }
    }
  }
  
  // Check for @abstractmethod decorators in the class body
  const body = class_def.childForFieldName('body');
  if (body) {
    return has_abstract_methods(body);
  }
  
  return false;
}

/**
 * Post-process Python class node
 */
function post_process_python_node(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  // Extract metaclass from interfaces and set as property
  if (node.interfaces) {
    for (let i = 0; i < node.interfaces.length; i++) {
      const intf = node.interfaces[i];
      if (intf.startsWith('metaclass:')) {
        (node as any).metaclass = intf.substring('metaclass:'.length);
        // Remove from interfaces
        node.interfaces.splice(i, 1);
        break;
      }
    }
  }
  
  // Detect dataclass
  detect_dataclass(node, def, context);
  
  // Detect enum
  detect_enum(node, def, context);
  
  // Detect namedtuple
  detect_namedtuple(node, def, context);
  
  // Compute Python-specific MRO if multiple inheritance
  if (node.base_classes && node.base_classes.length > 1) {
    // Python uses C3 linearization for MRO
    // This is a simplified version - real Python MRO is more complex
    (node as any).python_mro = true;
  }
}

/**
 * Check if class name indicates ABC
 */
function is_abc_class(name: string): boolean {
  return name === 'ABC' || 
         name === 'ABCMeta' ||
         name.endsWith('.ABC') ||
         name.endsWith('.ABCMeta') ||
         name.includes('abc.ABC');
}

/**
 * Check if body has abstract methods
 */
function has_abstract_methods(body: SyntaxNode): boolean {
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    if (child.type === 'function_definition' || child.type === 'decorated_definition') {
      // Check for @abstractmethod decorator
      if (has_abstract_decorator(child)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if function has @abstractmethod decorator
 */
function has_abstract_decorator(node: SyntaxNode): boolean {
  if (node.type === 'decorated_definition') {
    const decorators = node.childForFieldName('decorator');
    if (decorators) {
      // Check decorator text
      for (let i = 0; i < decorators.childCount; i++) {
        const dec = decorators.child(i);
        if (dec && dec.text && dec.text.includes('abstractmethod')) {
          return true;
        }
      }
    }
  }
  
  // Check previous siblings for decorators
  let prev = node.previousSibling;
  while (prev && prev.type === 'decorator') {
    if (prev.text && prev.text.includes('abstractmethod')) {
      return true;
    }
    prev = prev.previousSibling;
  }
  
  return false;
}

/**
 * Detect if class is a dataclass
 */
function detect_dataclass(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return;
  
  // Look for @dataclass decorator
  let current = ast_node;
  while (current && current.type !== 'class_definition') {
    current = current.parent;
  }
  
  if (!current) return;
  
  // Check for decorators
  if (current.parent && current.parent.type === 'decorated_definition') {
    // Check all decorator children
    for (let i = 0; i < current.parent.childCount; i++) {
      const child = current.parent.child(i);
      if (child && child.type === 'decorator') {
        if (child.text && child.text.includes('dataclass')) {
          (node as any).is_dataclass = true;
          break;
        }
      }
    }
  }
}

/**
 * Detect if class is an enum
 */
function detect_enum(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  // Check if inherits from Enum
  if (node.base_classes) {
    for (const base of node.base_classes) {
      if (base === 'Enum' || base.endsWith('.Enum') || base.includes('enum.Enum')) {
        (node as any).is_enum = true;
        break;
      }
    }
  }
}

/**
 * Detect if class is a namedtuple
 */
function detect_namedtuple(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  // Check if inherits from NamedTuple
  if (node.base_classes) {
    for (const base of node.base_classes) {
      if (base === 'NamedTuple' || base.endsWith('.NamedTuple') || base.includes('typing.NamedTuple')) {
        (node as any).is_namedtuple = true;
        break;
      }
    }
  }
}

/**
 * Extract name from expression node
 */
function extract_expression_name(
  node: SyntaxNode,
  source_code: string
): string | null {
  if (node.type === 'identifier') {
    return node.text;
  }
  
  if (node.type === 'attribute') {
    // For dotted names like abc.ABC
    return source_code.substring(node.startIndex, node.endIndex);
  }
  
  if (node.type === 'subscript') {
    // For generic types like List[int]
    const value = node.childForFieldName('value');
    if (value) {
      return extract_expression_name(value, source_code);
    }
  }
  
  // For other cases, return the full text
  return source_code.substring(node.startIndex, node.endIndex);
}

/**
 * Find node at location
 */
function find_node_at_location(
  root: SyntaxNode,
  location: AnyLocationFormat
): SyntaxNode | null {
  // Extract target position using shared utility
  const position = extractTargetPosition(location);
  if (!position) {
    return null;
  }
  
  const targetRow = position.row;
  
  function search(node: SyntaxNode): SyntaxNode | null {
    const start = node.startPosition;
    const end = node.endPosition;
    
    if (targetRow >= start.row && targetRow <= end.row) {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const found = search(child);
          if (found) return found;
        }
      }
      return node;
    }
    
    return null;
  }
  
  return search(root);
}