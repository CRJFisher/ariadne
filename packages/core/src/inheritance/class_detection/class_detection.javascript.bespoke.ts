/**
 * JavaScript-specific class detection features
 * 
 * This module handles JavaScript features that cannot be expressed
 * through configuration alone (~15% of the logic for JavaScript).
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ClassDefinition,
  MethodDefinition,
  PropertyDefinition
} from '@ariadnejs/types';
import { ClassDetectionContext } from './index';

/**
 * Process JavaScript-specific class features
 * 
 * JavaScript requires special handling for:
 * - Class heritage (extends clause) extraction from child nodes
 * - Class expressions with complex naming patterns
 */
export function process_javascript_classes(
  classes: ClassDefinition[],
  context: ClassDetectionContext
): ClassDefinition[] {
  return classes.map(cls => {
    // Find the original node to extract heritage
    const node = find_class_node_by_location(context.ast_root, cls.location);
    if (!node) return cls;
    
    // Extract heritage information
    const heritage = extract_javascript_heritage(node, context);
    if (heritage.extends_list?.length) {
      cls.extends = heritage.extends_list;
    }
    
    return cls;
  });
}

/**
 * Find class node by location
 */
function find_class_node_by_location(
  node: SyntaxNode,
  location: any
): SyntaxNode | null {
  if ((node.type === 'class_declaration' || node.type === 'class') &&
      node.startPosition.row + 1 === location.row &&
      node.startPosition.column === location.column) {
    return node;
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const result = find_class_node_by_location(child, location);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Extract JavaScript class heritage from child nodes
 * 
 * JavaScript doesn't have a 'superclass' field - instead it has
 * a 'class_heritage' child node containing the extends information.
 */
function extract_javascript_heritage(
  node: SyntaxNode,
  context: ClassDetectionContext
): { extends_list?: string[] } {
  const extends_list: string[] = [];
  
  // Look for class_heritage child node
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    
    if (child.type === 'class_heritage') {
      // Extract extends information
      for (let j = 0; j < child.childCount; j++) {
        const heritageChild = child.child(j);
        if (!heritageChild) continue;
        
        // Skip 'extends' keyword
        if (heritageChild.type === 'extends') continue;
        
        // Extract parent class name
        if (heritageChild.type === 'identifier' || 
            heritageChild.type === 'member_expression') {
          extends_list.push(context.source_code.substring(
            heritageChild.startIndex,
            heritageChild.endIndex
          ));
        }
      }
    }
  }
  
  return {
    extends_list: extends_list.length > 0 ? extends_list : undefined
  };
}

/**
 * Enhance class with JavaScript-specific features
 * 
 * JavaScript has very few unique features since most are handled
 * by the generic processor.
 */
export function enhance_javascript_class(
  class_def: ClassDefinition,
  node: SyntaxNode,
  context: ClassDetectionContext
): ClassDefinition {
  // Class expressions are already handled in generic processor
  // Private fields with # are handled by prefix checking in generic
  
  // Nothing unique to add for basic JavaScript
  return class_def;
}

/**
 * Enhance method with JavaScript-specific features
 */
export function enhance_javascript_method(
  method: MethodDefinition,
  node: SyntaxNode,
  context: ClassDetectionContext
): MethodDefinition {
  // Check for getter/setter (not in original but could be useful)
  const parent = node.parent;
  if (parent && parent.type === 'class_body') {
    const prev = node.previousSibling;
    if (prev && (prev.type === 'get' || prev.type === 'set')) {
      (method as any).accessor_type = prev.type;
    }
  }
  
  return method;
}

/**
 * Enhance property with JavaScript-specific features
 */
export function enhance_javascript_property(
  property: PropertyDefinition,
  node: SyntaxNode,
  context: ClassDetectionContext
): PropertyDefinition {
  // Private fields with # are already handled by prefix checking
  // Nothing additional needed
  return property;
}

/**
 * Handle destructured parameters (JavaScript-specific pattern)
 */
export function handle_destructured_parameter(
  node: SyntaxNode,
  context: ClassDetectionContext
): string {
  // For object/array destructuring, return the full pattern as the name
  return context.source_code.substring(node.startIndex, node.endIndex);
}