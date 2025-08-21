/**
 * JavaScript-specific usage finder
 * 
 * Handles JavaScript-specific usage patterns:
 * - Property access chains (obj.prop.method)
 * - Destructuring assignments
 * - Spread operators
 * - Dynamic property access (obj[key])
 * - Constructor calls (new Class())
 * - Method calls
 * - this/super references
 */

// TODO: Call Graph - Include calls as usages

import { SyntaxNode } from 'tree-sitter';
import { Ref, Def } from '@ariadnejs/types';
import { Usage, UsageFinderContext } from './usage_finder';
import { ScopeNode } from '../scope_tree';

/**
 * Find JavaScript-specific usages
 */
export function find_javascript_usages(
  definition: Def,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  if (context.root_node && context.source_code) {
    // Find method calls
    const method_calls = find_method_calls(definition, context.root_node, context);
    usages.push(...method_calls);
    
    // Find property accesses
    const property_accesses = find_property_accesses(definition, context.root_node, context);
    usages.push(...property_accesses);
    
    // Find constructor calls
    const constructor_calls = find_constructor_calls(definition, context.root_node, context);
    usages.push(...constructor_calls);
    
    // Find destructuring usages
    const destructuring_usages = find_destructuring_usages(definition, context.root_node, context);
    usages.push(...destructuring_usages);
  }
  
  return usages;
}

/**
 * Find method calls on an object
 */
function find_method_calls(
  definition: Def,
  node: SyntaxNode,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  if (node.type === 'call_expression') {
    const function_node = node.childForFieldName('function');
    
    if (function_node && function_node.type === 'member_expression') {
      const object_node = function_node.childForFieldName('object');
      const property_node = function_node.childForFieldName('property');
      
      if (object_node && context.source_code) {
        const object_text = context.source_code.substring(
          object_node.startIndex,
          object_node.endIndex
        );
        
        if (object_text === definition.name && property_node) {
          const scope = find_enclosing_scope_for_node(node, context);
          if (scope) {
            usages.push({
              reference: {
                id: `ref_method_${node.startIndex}`,
                kind: 'reference',
                name: definition.name,
                symbol_id: definition.symbol_id,
                range: {
                  start: {
                    row: object_node.startPosition.row,
                    column: object_node.startPosition.column
                  },
                  end: {
                    row: object_node.endPosition.row,
                    column: object_node.endPosition.column
                  }
                },
                file_path: context.file_path
              },
              usage_type: 'call',
              enclosing_scope: scope,
              confidence: 'exact'
            });
          }
        }
      }
    }
  }
  
  // Traverse children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const child_usages = find_method_calls(definition, child, context);
      usages.push(...child_usages);
    }
  }
  
  return usages;
}

/**
 * Find property accesses
 */
function find_property_accesses(
  definition: Def,
  node: SyntaxNode,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  if (node.type === 'member_expression') {
    const object_node = node.childForFieldName('object');
    
    if (object_node && context.source_code) {
      const object_text = context.source_code.substring(
        object_node.startIndex,
        object_node.endIndex
      );
      
      if (object_text === definition.name) {
        const scope = find_enclosing_scope_for_node(node, context);
        if (scope) {
          // Check the usage type based on parent
          const parent = node.parent;
          let usage_type: 'read' | 'write' | 'call' = 'read';
          
          // Debug
          // console.log(`Member expression with object '${object_text}' at ${object_node.startPosition.row}:${object_node.startPosition.column}`);
          // console.log(`  Parent type: ${parent?.type}`);
          // if (parent) {
          //   console.log(`  Is left child: ${parent.childForFieldName('left') === node}`);
          // }
          
          if (parent?.type === 'assignment_expression' &&
              parent.childForFieldName('left') === node) {
            usage_type = 'write';
          } else if (parent?.type === 'call_expression') {
            usage_type = 'call';
          }
          
          usages.push({
            reference: {
              id: `ref_prop_${node.startIndex}`,
              kind: 'reference',
              name: definition.name,
              symbol_id: definition.symbol_id,
              range: {
                start: {
                  row: object_node.startPosition.row,
                  column: object_node.startPosition.column
                },
                end: {
                  row: object_node.endPosition.row,
                  column: object_node.endPosition.column
                }
              },
              file_path: context.file_path
            },
            usage_type,
            enclosing_scope: scope,
            confidence: 'exact'
          });
        }
      }
    }
  }
  
  // Check subscript expressions (obj[key])
  if (node.type === 'subscript_expression') {
    const object_node = node.childForFieldName('object');
    
    if (object_node && context.source_code) {
      const object_text = context.source_code.substring(
        object_node.startIndex,
        object_node.endIndex
      );
      
      if (object_text === definition.name) {
        const scope = find_enclosing_scope_for_node(node, context);
        if (scope) {
          usages.push({
            reference: {
              id: `ref_subscript_${node.startIndex}`,
              kind: 'reference',
              name: definition.name,
              symbol_id: definition.symbol_id,
              range: {
                start: {
                  row: object_node.startPosition.row,
                  column: object_node.startPosition.column
                },
                end: {
                  row: object_node.endPosition.row,
                  column: object_node.endPosition.column
                }
              },
              file_path: context.file_path
            },
            usage_type: 'read',
            enclosing_scope: scope,
            confidence: 'exact'
          });
        }
      }
    }
  }
  
  // Traverse children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const child_usages = find_property_accesses(definition, child, context);
      usages.push(...child_usages);
    }
  }
  
  return usages;
}

/**
 * Find constructor calls (new Class())
 */
function find_constructor_calls(
  definition: Def,
  node: SyntaxNode,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  if (node.type === 'new_expression') {
    const constructor_node = node.childForFieldName('constructor');
    
    if (constructor_node && context.source_code) {
      // Handle direct constructor calls
      if (constructor_node.type === 'identifier') {
        const constructor_text = context.source_code.substring(
          constructor_node.startIndex,
          constructor_node.endIndex
        );
        
        if (constructor_text === definition.name) {
          const scope = find_enclosing_scope_for_node(node, context);
          if (scope) {
            usages.push({
              reference: {
                id: `ref_new_${node.startIndex}`,
                kind: 'reference',
                name: definition.name,
                symbol_id: definition.symbol_id,
                range: {
                  start: {
                    row: constructor_node.startPosition.row,
                    column: constructor_node.startPosition.column
                  },
                  end: {
                    row: constructor_node.endPosition.row,
                    column: constructor_node.endPosition.column
                  }
                },
                file_path: context.file_path
              },
              usage_type: 'call',
              enclosing_scope: scope,
              confidence: 'exact'
            });
          }
        }
      }
    }
  }
  
  // Traverse children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const child_usages = find_constructor_calls(definition, child, context);
      usages.push(...child_usages);
    }
  }
  
  return usages;
}

/**
 * Find destructuring usages
 */
function find_destructuring_usages(
  definition: Def,
  node: SyntaxNode,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  // Object destructuring
  if (node.type === 'object_pattern') {
    const parent = node.parent;
    
    // Check if it's destructuring from our definition
    if (parent && parent.type === 'variable_declarator') {
      const init_node = parent.childForFieldName('value');
      
      if (init_node && context.source_code) {
        const init_text = context.source_code.substring(
          init_node.startIndex,
          init_node.endIndex
        );
        
        if (init_text === definition.name) {
          const scope = find_enclosing_scope_for_node(node, context);
          if (scope) {
            usages.push({
              reference: {
                id: `ref_destruct_${node.startIndex}`,
                kind: 'reference',
                name: definition.name,
                symbol_id: definition.symbol_id,
                range: {
                  start: {
                    row: init_node.startPosition.row,
                    column: init_node.startPosition.column
                  },
                  end: {
                    row: init_node.endPosition.row,
                    column: init_node.endPosition.column
                  }
                },
                file_path: context.file_path
              },
              usage_type: 'read',
              enclosing_scope: scope,
              confidence: 'exact'
            });
          }
        }
      }
    }
  }
  
  // Array destructuring
  if (node.type === 'array_pattern') {
    const parent = node.parent;
    
    if (parent && parent.type === 'variable_declarator') {
      const init_node = parent.childForFieldName('value');
      
      if (init_node && context.source_code) {
        const init_text = context.source_code.substring(
          init_node.startIndex,
          init_node.endIndex
        );
        
        if (init_text === definition.name) {
          const scope = find_enclosing_scope_for_node(node, context);
          if (scope) {
            usages.push({
              reference: {
                id: `ref_array_destruct_${node.startIndex}`,
                kind: 'reference',
                name: definition.name,
                symbol_id: definition.symbol_id,
                range: {
                  start: {
                    row: init_node.startPosition.row,
                    column: init_node.startPosition.column
                  },
                  end: {
                    row: init_node.endPosition.row,
                    column: init_node.endPosition.column
                  }
                },
                file_path: context.file_path
              },
              usage_type: 'read',
              enclosing_scope: scope,
              confidence: 'exact'
            });
          }
        }
      }
    }
  }
  
  // Traverse children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const child_usages = find_destructuring_usages(definition, child, context);
      usages.push(...child_usages);
    }
  }
  
  return usages;
}

/**
 * Find enclosing scope for a node
 */
function find_enclosing_scope_for_node(
  node: SyntaxNode,
  context: UsageFinderContext
): ScopeNode | undefined {
  const position = {
    row: node.startPosition.row,
    column: node.startPosition.column
  };
  
  // Find the deepest scope containing this position
  let best_scope: ScopeNode | undefined;
  let best_depth = -1;
  
  for (const [scope_id, scope] of context.scope_tree.nodes) {
    if (contains_position(scope.range, position)) {
      const depth = get_scope_depth(scope, context.scope_tree);
      if (depth > best_depth) {
        best_scope = scope;
        best_depth = depth;
      }
    }
  }
  
  return best_scope;
}

/**
 * Check if a position is contained in a range
 */
function contains_position(
  range: { start: { row: number; column: number }; end: { row: number; column: number } },
  position: { row: number; column: number }
): boolean {
  if (position.row < range.start.row || position.row > range.end.row) {
    return false;
  }
  
  if (position.row === range.start.row && position.column < range.start.column) {
    return false;
  }
  
  if (position.row === range.end.row && position.column > range.end.column) {
    return false;
  }
  
  return true;
}

/**
 * Get the depth of a scope in the tree
 */
function get_scope_depth(scope: ScopeNode, tree: any): number {
  let depth = 0;
  let current = scope;
  
  while (current.parent_id) {
    depth++;
    const parent = tree.nodes.get(current.parent_id);
    if (!parent) break;
    current = parent;
  }
  
  return depth;
}