import { Def, Point, SimpleRange } from '../graph';
import { Tree } from 'tree-sitter';

/**
 * Check if a position is within a range
 */
export function is_position_within_range(pos: Point, range: { start: Point; end: Point }): boolean {
  // Check if position is after or at start
  if (pos.row < range.start.row) return false;
  if (pos.row === range.start.row && pos.column < range.start.column) return false;
  
  // Check if position is before or at end
  if (pos.row > range.end.row) return false;
  if (pos.row === range.end.row && pos.column > range.end.column) return false;
  
  return true;
}

/**
 * Compute the enclosing range for a class definition by finding its full AST node
 */
export function compute_class_enclosing_range(classDef: Def, tree: Tree): SimpleRange | undefined {
  if (classDef.symbol_kind !== 'class' && classDef.symbol_kind !== 'struct') return undefined;
  
  // Find the AST node for this class definition
  const classNode = tree.rootNode.descendantForPosition(
    { row: classDef.range.start.row, column: classDef.range.start.column },
    { row: classDef.range.end.row, column: classDef.range.end.column }
  );
  
  if (classNode) {
    // Walk up to find the class declaration node
    let current = classNode.parent;
    while (current) {
      if (current.type === 'class_declaration' ||  // JS/TS
          current.type === 'class_definition' ||   // Python
          current.type === 'struct_item' ||         // Rust
          current.type === 'impl_item') {           // Rust
        return {
          start: { row: current.startPosition.row, column: current.startPosition.column },
          end: { row: current.endPosition.row, column: current.endPosition.column }
        };
      }
      current = current.parent;
    }
  }
  
  return undefined;
}