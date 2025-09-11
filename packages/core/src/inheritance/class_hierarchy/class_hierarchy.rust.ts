/**
 * Rust-specific bespoke handlers for class hierarchy
 * 
 * Handles Rust-specific features that cannot be expressed through configuration:
 * - Trait implementations via impl blocks
 * - Associated types and trait bounds
 * - Super traits extraction
 * - Lifetime parameters
 * - Unsafe trait implementations
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

/**
 * Create Rust bespoke handlers
 */
export function create_rust_handlers(): BespokeHandlers {
  return {
    extract_trait_implementations,
    extract_super_traits,
    post_process_node: post_process_rust_node
  };
}

/**
 * Extract trait implementations for a type
 */
function extract_trait_implementations(
  def: ClassDefinition,
  context: ClassHierarchyContext
): string[] {
  const traits: string[] = [];
  
  // Search for impl blocks in the entire file
  find_impl_blocks(
    def.name,
    context.tree.rootNode,
    traits,
    context.source_code
  );
  
  return traits;
}

/**
 * Find impl blocks for a type
 */
function find_impl_blocks(
  type_name: string,
  root: SyntaxNode,
  traits: string[],
  source_code: string
): void {
  // Recursively search for impl_item nodes
  function search(node: SyntaxNode): void {
    if (node.type === 'impl_item') {
      process_impl_block(node, type_name, traits, source_code);
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) search(child);
    }
  }
  
  search(root);
}

/**
 * Process an impl block
 */
function process_impl_block(
  impl_node: SyntaxNode,
  type_name: string,
  traits: string[],
  source_code: string
): void {
  // Get the type being implemented for
  const type_node = impl_node.childForFieldName('type');
  if (!type_node) return;
  
  const impl_type = extract_type_name(type_node, source_code);
  
  // Check if this impl is for our type
  if (impl_type !== type_name) return;
  
  // Check if this is a trait implementation
  const trait_node = impl_node.childForFieldName('trait');
  if (trait_node) {
    const trait_name = extract_type_name(trait_node, source_code);
    if (trait_name && !traits.includes(trait_name)) {
      traits.push(trait_name);
    }
  }
}

/**
 * Extract super traits from a trait definition
 */
function extract_super_traits(
  def: ClassDefinition,
  context: ClassHierarchyContext
): string[] {
  const super_traits: string[] = [];
  
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return super_traits;
  
  // Find trait_item
  let trait_node = ast_node;
  while (trait_node && trait_node.type !== 'trait_item') {
    trait_node = trait_node.parent;
  }
  
  if (!trait_node) return super_traits;
  
  // Look for trait bounds
  const bounds = trait_node.childForFieldName('bounds');
  if (bounds && bounds.type === 'trait_bounds') {
    extract_trait_bounds(bounds, super_traits, context.source_code);
  }
  
  // Also check type_parameters for bounds
  const type_params = trait_node.childForFieldName('type_parameters');
  if (type_params) {
    extract_bounds_from_params(type_params, super_traits, context.source_code);
  }
  
  return super_traits;
}

/**
 * Extract trait bounds
 */
function extract_trait_bounds(
  bounds_node: SyntaxNode,
  traits: string[],
  source_code: string
): void {
  for (let i = 0; i < bounds_node.childCount; i++) {
    const child = bounds_node.child(i);
    if (!child) continue;
    
    // Skip punctuation
    if (child.type === ':' || child.type === '+') continue;
    
    // Extract trait name
    if (is_type_reference(child)) {
      const trait_name = extract_type_name(child, source_code);
      if (trait_name && !traits.includes(trait_name)) {
        traits.push(trait_name);
      }
    }
  }
}

/**
 * Extract bounds from type parameters
 */
function extract_bounds_from_params(
  params_node: SyntaxNode,
  traits: string[],
  source_code: string
): void {
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    if (child.type === 'type_parameter' || child.type === 'constrained_type_parameter') {
      const bounds = child.childForFieldName('bounds');
      if (bounds) {
        extract_trait_bounds(bounds, traits, source_code);
      }
    }
  }
}

/**
 * Post-process Rust type node
 */
function post_process_rust_node(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  // Detect unsafe traits
  detect_unsafe_trait(node, def, context);
  
  // Detect auto traits
  detect_auto_trait(node, def, context);
  
  // Detect generic constraints
  detect_generic_constraints(node, def, context);
  
  // Mark Copy/Clone types
  detect_copy_clone(node);
}

/**
 * Detect if trait or impl is unsafe
 */
function detect_unsafe_trait(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return;
  
  // Check for unsafe keyword
  let current = ast_node;
  while (current && !is_type_definition(current)) {
    current = current.parent;
  }
  
  if (!current) return;
  
  // Check if there's an unsafe modifier
  for (let i = 0; i < current.childCount; i++) {
    const child = current.child(i);
    if (child && child.type === 'unsafe') {
      (node as any).is_unsafe = true;
      break;
    }
  }
}

/**
 * Detect auto traits
 */
function detect_auto_trait(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return;
  
  // Only relevant for traits
  if (!def.is_trait) return;
  
  let trait_node = ast_node;
  while (trait_node && trait_node.type !== 'trait_item') {
    trait_node = trait_node.parent;
  }
  
  if (!trait_node) return;
  
  // Check for auto keyword
  // In Rust, 'auto' might be a visibility modifier or part of the trait modifiers
  // Check the text directly
  if (trait_node.text && trait_node.text.startsWith('auto trait')) {
    (node as any).is_auto_trait = true;
  } else {
    // Also check children for auto keyword
    for (let i = 0; i < trait_node.childCount; i++) {
      const child = trait_node.child(i);
      if (child && (child.type === 'auto' || (child.text && child.text === 'auto'))) {
        (node as any).is_auto_trait = true;
        break;
      }
    }
  }
}

/**
 * Detect generic constraints
 */
function detect_generic_constraints(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return;
  
  let type_node = ast_node;
  while (type_node && !is_type_definition(type_node)) {
    type_node = type_node.parent;
  }
  
  if (!type_node) return;
  
  // Look for type_parameters
  const type_params = type_node.childForFieldName('type_parameters');
  if (type_params) {
    const constraints = extract_generic_constraints(type_params, context.source_code);
    if (constraints.length > 0) {
      (node as any).generic_constraints = constraints;
    }
  }
  
  // Look for where clause
  const where_clause = type_node.childForFieldName('where_clause');
  if (where_clause) {
    const where_constraints = extract_where_constraints(where_clause, context.source_code);
    if (where_constraints.length > 0) {
      (node as any).where_constraints = where_constraints;
    }
  }
}

/**
 * Extract generic constraints
 */
function extract_generic_constraints(
  params_node: SyntaxNode,
  source_code: string
): string[] {
  const constraints: string[] = [];
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    if (child.type === 'constrained_type_parameter') {
      // Extract the full constraint
      const text = source_code.substring(child.startIndex, child.endIndex);
      constraints.push(text);
    }
  }
  
  return constraints;
}

/**
 * Extract where clause constraints
 */
function extract_where_constraints(
  where_node: SyntaxNode,
  source_code: string
): string[] {
  const constraints: string[] = [];
  
  for (let i = 0; i < where_node.childCount; i++) {
    const child = where_node.child(i);
    if (!child) continue;
    
    if (child.type === 'where_predicate') {
      const text = source_code.substring(child.startIndex, child.endIndex);
      constraints.push(text);
    }
  }
  
  return constraints;
}

/**
 * Detect if type implements Copy/Clone
 */
function detect_copy_clone(node: ClassNode): void {
  if (node.interfaces) {
    for (const trait_name of node.interfaces) {
      if (trait_name === 'Copy' || trait_name === 'std::marker::Copy') {
        (node as any).is_copy = true;
      }
      if (trait_name === 'Clone' || trait_name === 'std::clone::Clone') {
        (node as any).is_clone = true;
      }
    }
  }
}

/**
 * Check if node is a type definition
 */
function is_type_definition(node: SyntaxNode): boolean {
  return (
    node.type === 'struct_item' ||
    node.type === 'enum_item' ||
    node.type === 'trait_item' ||
    node.type === 'type_item' ||
    node.type === 'union_item'
  );
}

/**
 * Check if node is a type reference
 */
function is_type_reference(node: SyntaxNode): boolean {
  return (
    node.type === 'identifier' ||
    node.type === 'type_identifier' ||
    node.type === 'scoped_identifier' ||
    node.type === 'generic_type'
  );
}

/**
 * Extract type name from node
 */
function extract_type_name(node: SyntaxNode, source_code: string): string | null {
  if (node.type === 'generic_type') {
    const type_node = node.childForFieldName('type');
    if (type_node) {
      return extract_type_name(type_node, source_code);
    }
  }
  
  if (node.type === 'scoped_identifier') {
    // Return the full scoped path
    return source_code.substring(node.startIndex, node.endIndex);
  }
  
  // For simple identifiers
  return source_code.substring(node.startIndex, node.endIndex);
}

/**
 * Find node at location
 */
function find_node_at_location(
  root: SyntaxNode,
  location: any
): SyntaxNode | null {
  // Handle both location formats
  let targetRow: number;
  
  if (location.line !== undefined) {
    targetRow = location.line - 1;
  } else if (location.start !== undefined) {
    targetRow = location.start.row;
  } else if (location.row !== undefined) {
    targetRow = location.row;
  } else {
    return null;
  }
  
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