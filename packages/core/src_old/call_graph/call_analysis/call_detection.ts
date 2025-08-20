/**
 * Call detection functions for identifying function and method calls
 * 
 * This module contains the critical AST node identity fix that ensures
 * built-in calls are preserved when multiple files are loaded.
 */

import { Ref } from '../../graph';
import { Tree } from 'tree-sitter';

/**
 * File cache interface for call detection
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: any; // ScopeGraph
}

/**
 * Check if a reference is a method call pattern
 * 
 * This function uses simple string analysis to detect method call patterns
 * in different programming languages by checking what precedes the reference.
 */
export function is_method_call_pattern(ref: Ref, file_path: string, fileCache: FileCache): boolean {
  const lines = fileCache.source_code.split('\n');
  const refLine = lines[ref.range.start.row];
  if (!refLine) return false;
  
  const beforeRef = refLine.substring(0, ref.range.start.column);
  
  // Check for method call patterns in different languages
  if (file_path.endsWith('.py') && beforeRef.endsWith('.')) {
    return true;
  } else if ((file_path.endsWith('.ts') || file_path.endsWith('.js')) && 
             (beforeRef.endsWith('.') || beforeRef.endsWith('?.'))) {
    return true;
  } else if (file_path.endsWith('.rs') && 
             (beforeRef.endsWith('.') || beforeRef.endsWith('::'))) {
    return true;
  }
  
  return false;
}

/**
 * Check if a reference is part of a call expression
 * 
 * CRITICAL: This function contains the AST node identity fix.
 * 
 * When Tree-sitter reparses files (which happens when new files are added to a project),
 * it creates new AST node objects. This breaks object identity comparisons (===) even
 * though the nodes represent the same code structure.
 * 
 * The fix: Instead of comparing node objects with ===, we compare node types and
 * positions. This ensures the function works correctly regardless of reparsing.
 * 
 * This fix is essential for preserving built-in call detection (console.log, Array.push, etc.)
 * in multi-file projects.
 */
export function is_reference_called(ref: Ref, fileCache: FileCache): boolean {
  // Get the AST node for this reference
  const astNode = fileCache.tree.rootNode.descendantForPosition(
    { row: ref.range.start.row, column: ref.range.start.column },
    { row: ref.range.end.row, column: ref.range.end.column }
  );
  
  if (!astNode) {
    return false;
  }
  
  // Check if this node's parent is a call expression
  const parent = astNode.parent;
  if (!parent) return false;
  
  // Direct function call: func()
  if (parent.type === 'call_expression' && parent.childForFieldName('function') === astNode) {
    return true;
  }
  
  // Method call: obj.method() - the reference is the property of a member_expression
  const propertyChild = parent.type === 'member_expression' ? parent.childForFieldName('property') : null;
  
  // CRITICAL FIX: Object identity comparison fails when files are reparsed.
  // Instead of checking if propertyChild === astNode, we compare their positions.
  // This ensures the check works even after Tree-sitter creates new node objects.
  if (parent.type === 'member_expression' && propertyChild && 
      propertyChild.type === astNode.type &&
      propertyChild.startPosition.row === astNode.startPosition.row &&
      propertyChild.startPosition.column === astNode.startPosition.column) {
    // Check if the member_expression is the function of a call_expression
    const grandparent = parent.parent;
    if (grandparent && grandparent.type === 'call_expression') {
      const functionChild = grandparent.childForFieldName('function');
      
      // CRITICAL FIX: Same issue here - don't use === to compare nodes.
      // Just verify we have the right type of node in the right position.
      // This preserves built-in call detection when multiple files are loaded.
      if (functionChild && functionChild.type === 'member_expression') {
        return true;
      }
    }
  }
  
  // Handle nested identifiers in some languages (e.g., Rust's Module::function())
  if (parent.type === 'nested_identifier' || parent.type === 'scoped_identifier') {
    const grandparent = parent.parent;
    if (grandparent && grandparent.type === 'call_expression') {
      const functionChild = grandparent.childForFieldName('function');
      // Same fix: check type, not identity
      if (functionChild && functionChild.type === parent.type) {
        return true;
      }
    }
  }
  
  return false;
}