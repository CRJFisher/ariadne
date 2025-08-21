/**
 * JavaScript/TypeScript-specific class hierarchy extraction
 * 
 * Handles JavaScript and TypeScript class inheritance patterns:
 * - ES6 class extends
 * - TypeScript implements
 * - Interface extends
 * - Abstract classes
 */

// TODO: Method Override - Build override chains

import { SyntaxNode } from 'tree-sitter';
import {
  ClassInfo,
  ClassHierarchyContext,
  extract_class_relationships,
  find_node_at_position
} from './class_hierarchy';

/**
 * Extract JavaScript/TypeScript class relationships
 */
export function extract_javascript_class_relationships(
  info: ClassInfo,
  context: ClassHierarchyContext
): void {
  const class_node = find_node_at_position(
    context.tree.rootNode,
    info.definition.range.start,
    info.definition.range.end
  );
  
  if (!class_node) {
    return;
  }
  
  // Find the actual class/interface declaration node
  const decl_node = find_declaration_node(class_node);
  if (!decl_node) {
    return;
  }
  
  const { source_code } = context;
  
  // Handle based on declaration type
  switch (decl_node.type) {
    case 'class_declaration':
      extract_class_inheritance(decl_node, info, source_code);
      break;
    
    case 'interface_declaration':
      extract_interface_extends(decl_node, info, source_code);
      break;
    
    case 'abstract_class_declaration':
      extract_class_inheritance(decl_node, info, source_code);
      break;
  }
}

/**
 * Find the declaration node from a position node
 */
function find_declaration_node(node: SyntaxNode): SyntaxNode | null {
  // If we're at an identifier, check parent
  if (node.type === 'identifier' || node.type === 'type_identifier') {
    const parent = node.parent;
    if (parent && is_declaration_node(parent)) {
      return parent;
    }
  }
  
  // If we're already at a declaration node
  if (is_declaration_node(node)) {
    return node;
  }
  
  // Search up the tree
  let current = node.parent;
  while (current) {
    if (is_declaration_node(current)) {
      return current;
    }
    current = current.parent;
  }
  
  return null;
}

/**
 * Check if node is a declaration node
 */
function is_declaration_node(node: SyntaxNode): boolean {
  return node.type === 'class_declaration' ||
         node.type === 'interface_declaration' ||
         node.type === 'abstract_class_declaration';
}

/**
 * Extract class extends and implements
 */
function extract_class_inheritance(
  class_node: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Look for class_heritage node
  const heritage = find_child_by_type(class_node, 'class_heritage');
  if (!heritage) {
    return;
  }
  
  // Process extends and implements clauses
  for (let i = 0; i < heritage.childCount; i++) {
    const child = heritage.child(i);
    if (!child) continue;
    
    if (child.type === 'extends_clause') {
      extract_extends_clause(child, info, source_code);
    } else if (child.type === 'implements_clause') {
      extract_implements_clause(child, info, source_code);
    } else if (child.type === 'extends' && i + 1 < heritage.childCount) {
      // JavaScript style: direct "extends" keyword
      const parent_node = heritage.child(i + 1);
      if (parent_node && is_type_reference(parent_node)) {
        info.parent_class = extract_type_name(parent_node, source_code);
      }
    }
  }
}

/**
 * Extract extends clause
 */
function extract_extends_clause(
  extends_node: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // TypeScript style: extends_clause node
  // Look for the type reference after 'extends' keyword
  for (let i = 0; i < extends_node.childCount; i++) {
    const child = extends_node.child(i);
    if (child && is_type_reference(child)) {
      info.parent_class = extract_type_name(child, source_code);
      break;
    }
  }
}

/**
 * Extract implements clause
 */
function extract_implements_clause(
  implements_node: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Extract all implemented interfaces
  for (let i = 0; i < implements_node.childCount; i++) {
    const child = implements_node.child(i);
    if (child && is_type_reference(child)) {
      const interface_name = extract_type_name(child, source_code);
      if (!info.implemented_interfaces.includes(interface_name)) {
        info.implemented_interfaces.push(interface_name);
      }
    }
  }
}

/**
 * Extract interface extends
 */
function extract_interface_extends(
  interface_node: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Look for extends_type_clause
  const extends_clause = find_child_by_type(interface_node, 'extends_type_clause');
  if (!extends_clause) {
    return;
  }
  
  // In TypeScript, interface can extend multiple interfaces
  let first = true;
  for (let i = 0; i < extends_clause.childCount; i++) {
    const child = extends_clause.child(i);
    if (child && is_type_reference(child)) {
      const type_name = extract_type_name(child, source_code);
      if (first) {
        // First extended interface is treated as parent
        info.parent_class = type_name;
        first = false;
      } else {
        // Additional extended interfaces
        if (!info.implemented_interfaces.includes(type_name)) {
          info.implemented_interfaces.push(type_name);
        }
      }
    }
  }
}

/**
 * Check if node is a type reference
 */
function is_type_reference(node: SyntaxNode): boolean {
  return node.type === 'identifier' ||
         node.type === 'type_identifier' ||
         node.type === 'member_expression' ||
         node.type === 'generic_type' ||
         node.type === 'qualified_name';
}

/**
 * Extract type name from reference node
 */
function extract_type_name(node: SyntaxNode, source_code: string): string {
  if (node.type === 'generic_type') {
    // For generic types, extract just the base name
    const name_node = node.childForFieldName('name');
    if (name_node) {
      return extract_type_name(name_node, source_code);
    }
  }
  
  if (node.type === 'member_expression' || node.type === 'qualified_name') {
    // For qualified names (e.g., A.B.C), return the full path
    return source_code.substring(node.startIndex, node.endIndex);
  }
  
  // For simple identifiers
  return source_code.substring(node.startIndex, node.endIndex);
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
 * Extract method overrides in class
 */
export function extract_javascript_method_overrides(
  class_node: SyntaxNode,
  parent_methods: string[],
  source_code: string
): string[] {
  const overrides: string[] = [];
  
  // Find class body
  const body = class_node.childForFieldName('body');
  if (!body) {
    return overrides;
  }
  
  // Check each method in the class
  for (let i = 0; i < body.childCount; i++) {
    const member = body.child(i);
    if (!member) continue;
    
    if (member.type === 'method_definition' || 
        member.type === 'public_field_definition') {
      const name = member.childForFieldName('name');
      if (name) {
        const method_name = source_code.substring(name.startIndex, name.endIndex);
        if (parent_methods.includes(method_name)) {
          overrides.push(method_name);
        }
      }
    }
  }
  
  return overrides;
}

/**
 * Check if a class is abstract
 */
export function is_abstract_class(
  class_node: SyntaxNode,
  source_code: string
): boolean {
  // Check for abstract keyword
  for (let i = 0; i < class_node.childCount; i++) {
    const child = class_node.child(i);
    if (child && child.type === 'abstract' && child.text === 'abstract') {
      return true;
    }
  }
  
  return class_node.type === 'abstract_class_declaration';
}

/**
 * Extract abstract methods from a class
 */
export function extract_abstract_methods(
  class_node: SyntaxNode,
  source_code: string
): string[] {
  const abstract_methods: string[] = [];
  
  const body = class_node.childForFieldName('body');
  if (!body) {
    return abstract_methods;
  }
  
  for (let i = 0; i < body.childCount; i++) {
    const member = body.child(i);
    if (!member) continue;
    
    if (member.type === 'abstract_method_signature') {
      const name = member.childForFieldName('name');
      if (name) {
        const method_name = source_code.substring(name.startIndex, name.endIndex);
        abstract_methods.push(method_name);
      }
    }
  }
  
  return abstract_methods;
}

/**
 * Check if implements an interface
 */
export function implements_interface_javascript(
  class_node: SyntaxNode,
  interface_name: string,
  source_code: string
): boolean {
  const heritage = find_child_by_type(class_node, 'class_heritage');
  if (!heritage) {
    return false;
  }
  
  const implements_clause = find_child_by_type(heritage, 'implements_clause');
  if (!implements_clause) {
    return false;
  }
  
  for (let i = 0; i < implements_clause.childCount; i++) {
    const child = implements_clause.child(i);
    if (child && is_type_reference(child)) {
      const type_name = extract_type_name(child, source_code);
      if (type_name === interface_name) {
        return true;
      }
    }
  }
  
  return false;
}