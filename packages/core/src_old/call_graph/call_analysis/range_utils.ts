/**
 * Range utility functions for call analysis
 * 
 * This module contains pure functions for working with code ranges and positions.
 * All functions are immutable and have no side effects.
 */

import { Def } from '../../graph';
import { Tree } from 'tree-sitter';
import { SimpleRange } from '@ariadnejs/types';

// Re-export SimpleRange for convenience
export type { SimpleRange } from '@ariadnejs/types';

/**
 * File cache interface needed for range calculations
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: any; // ScopeGraph - we don't need the full type here
}

/**
 * Find the full range of a definition including its entire body
 * 
 * This function walks up the AST to find the complete definition node,
 * which may be larger than just the identifier range stored in the Def.
 */
export function find_definition_range(def: Def, fileCache: FileCache): SimpleRange {
  // If the definition already has an enclosing_range, use it
  if ((def as any).enclosing_range) {
    return (def as any).enclosing_range;
  }
  
  let definitionRange = def.range;
  
  // Find the AST node for this definition
  const defNode = fileCache.tree.rootNode.descendantForPosition(
    { row: def.range.start.row, column: def.range.start.column },
    { row: def.range.end.row, column: def.range.end.column }
  );
  
  if (defNode) {
    // Walk up the tree to find the full definition node
    let current = defNode.parent;
    while (current) {
      const nodeType = current.type;
      let foundDefinitionNode = false;
      
      // Check for function/method nodes
      if (['function', 'method', 'generator'].includes(def.symbol_kind)) {
        if (nodeType === 'function_declaration' ||
            nodeType === 'method_definition' ||
            nodeType === 'generator_function_declaration' ||
            nodeType === 'function_expression' ||
            nodeType === 'arrow_function' ||
            nodeType === 'function_definition' || // Python
            nodeType === 'decorated_definition' || // Python with decorators
            nodeType === 'function_item') { // Rust
          foundDefinitionNode = true;
        }
      }
      // Check for class nodes
      else if (def.symbol_kind === 'class') {
        if (nodeType === 'class_declaration' ||
            nodeType === 'class_definition' || // Python
            nodeType === 'struct_item' || // Rust
            nodeType === 'impl_item') { // Rust
          foundDefinitionNode = true;
        }
      }
      // Check for variable/const nodes
      else if (['variable', 'const', 'let', 'constant'].includes(def.symbol_kind)) {
        if (nodeType === 'variable_declarator' ||
            nodeType === 'variable_declaration' ||
            nodeType === 'lexical_declaration' ||
            nodeType === 'assignment' || // Python
            nodeType === 'let_declaration' || // Rust
            nodeType === 'const_item') { // Rust
          foundDefinitionNode = true;
        }
      }
      
      if (foundDefinitionNode) {
        definitionRange = {
          start: { row: current.startPosition.row, column: current.startPosition.column },
          end: { row: current.endPosition.row, column: current.endPosition.column }
        };
        break;
      }
      current = current.parent;
    }
  }
  
  return definitionRange;
}

/**
 * Check if a position is within a range
 * 
 * Returns true if the position is inside the range boundaries (inclusive).
 */
export function is_position_within_range(
  pos: { row: number; column: number },
  range: SimpleRange
): boolean {
  if (pos.row < range.start.row || pos.row > range.end.row) {
    return false;
  }
  if (pos.row === range.start.row && pos.column < range.start.column) {
    return false;
  }
  if (pos.row === range.end.row && pos.column > range.end.column) {
    return false;
  }
  return true;
}

/**
 * Compute the enclosing range for a class definition
 * 
 * This function finds the complete range of a class including all its methods
 * and properties by walking up the AST.
 */
export function compute_class_enclosing_range(
  classDef: Def,
  tree: Tree
): SimpleRange | undefined {
  if (!classDef || !classDef.range) {
    return undefined;
  }
  
  // Find the AST node for this class definition
  const classNode = tree.rootNode.descendantForPosition(
    { row: classDef.range.start.row, column: classDef.range.start.column },
    { row: classDef.range.end.row, column: classDef.range.end.column }
  );
  
  if (!classNode) {
    return classDef.range;
  }
  
  // Walk up to find the full class/struct definition node
  let current = classNode;
  while (current.parent) {
    const nodeType = current.parent.type;
    
    // Check for class-like definition nodes
    if (
      // JavaScript/TypeScript
      nodeType === 'class_declaration' ||
      nodeType === 'class' ||
      nodeType === 'interface_declaration' ||
      // Python
      nodeType === 'class_definition' ||
      // Rust
      nodeType === 'struct_item' ||
      nodeType === 'impl_item' ||
      nodeType === 'enum_item' ||
      nodeType === 'trait_item'
    ) {
      // Return the range of the full class node
      return {
        start: { 
          row: current.parent.startPosition.row, 
          column: current.parent.startPosition.column 
        },
        end: { 
          row: current.parent.endPosition.row, 
          column: current.parent.endPosition.column 
        }
      };
    }
    
    current = current.parent;
  }
  
  // Fallback to the definition range if we couldn't find a parent class node
  return classDef.range;
}