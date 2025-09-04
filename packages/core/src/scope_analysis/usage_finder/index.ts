/**
 * Usage finder dispatcher
 * 
 * Routes usage finding operations to language-specific implementations
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, ScopeTree } from '@ariadnejs/types';
import { 
  Usage,
  UsageFinderContext,
  find_usages as find_usages_core,
  find_references as find_references_core,
  find_usages_batch,
  filter_usages_by_type,
  group_usages_by_scope,
  count_usages_by_type
} from './usage_finder';
import { find_javascript_usages } from './usage_finder.javascript';

// Re-export core types
export {
  Usage,
  UsageFinderContext,
  filter_usages_by_type,
  group_usages_by_scope,
  count_usages_by_type
};

/**
 * Find all usages of a definition
 */
export function find_usages(
  definition: Def,
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string
): Usage[] {
  const context: UsageFinderContext = {
    scope_tree,
    language,
    file_path,
    root_node,
    source_code
  };
  
  // Get core usages
  const core_usages = find_usages_core(definition, context);
  
  // Get language-specific usages
  const lang_usages = find_language_specific_usages(definition, context, language);
  
  // Merge usages - language-specific takes precedence for same position
  const usages = [...core_usages];
  
  for (const lang_usage of lang_usages) {
    // Check if there's already a usage at this position
    const existing_index = usages.findIndex(u => 
      u.reference.range.start.row === lang_usage.reference.range.start.row &&
      u.reference.range.start.column === lang_usage.reference.range.start.column
    );
    
    if (existing_index >= 0) {
      // Replace with language-specific usage (it has more accurate type)
      usages[existing_index] = lang_usage;
    } else {
      // Add new usage
      usages.push(lang_usage);
    }
  }
  
  return usages;
}

/**
 * Find language-specific usages
 */
function find_language_specific_usages(
  definition: Def,
  context: UsageFinderContext,
  language: Language
): Usage[] {
  switch (language) {
    case 'javascript':
    case 'jsx':
    case 'typescript':
    case 'tsx':
      return find_javascript_usages(definition, context);
    
    case 'python':
      // TODO: Implement Python-specific usage finding
      return [];
    
    case 'rust':
      // TODO: Implement Rust-specific usage finding
      return [];
    
    default:
      return [];
  }
}

/**
 * Find all references to a symbol
 */
export function find_all_references(
  symbol_name: string,
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string
): Ref[] {
  const context: UsageFinderContext = {
    scope_tree,
    language,
    file_path,
    root_node,
    source_code
  };
  
  const usages = find_references_core(symbol_name, context);
  
  // Convert usages to references
  return usages.map(u => u.reference);
}

/**
 * Find usages at a specific position
 */
export function find_usages_at_position(
  position: Position,
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string
): Usage[] {
  // First, find what symbol is at this position
  const symbol = find_symbol_at_position(position, scope_tree, root_node, source_code);
  
  if (!symbol) {
    return [];
  }
  
  // Create a temporary definition for the symbol
  const temp_def: Def = {
    id: `def_at_${position.row}_${position.column}`,
    kind: 'definition',
    name: symbol.name,
    symbol_kind: symbol.kind,
    range: symbol.range,
    symbol_id: `${file_path}#${symbol.name}`
  };
  
  return find_usages(temp_def, scope_tree, language, file_path, root_node, source_code);
}

/**
 * Find symbol at position
 */
function find_symbol_at_position(
  position: Position,
  scope_tree: ScopeTree,
  root_node?: SyntaxNode,
  source_code?: string
): { name: string; kind: string; range: any } | undefined {
  // First, try to find in AST (more precise)
  if (root_node && source_code) {
    const node = find_node_at_position(root_node, position);
    if (node && (node.type === 'identifier' || node.type === 'type_identifier')) {
      const name = source_code.substring(node.startIndex, node.endIndex);
      
      // Try to find the symbol definition in scope tree
      for (const [scope_id, scope] of scope_tree.nodes) {
        const symbol = scope.symbols.get(name);
        if (symbol) {
          return {
            name,
            kind: symbol.kind,
            range: {
              start: {
                row: node.startPosition.row,
                column: node.startPosition.column
              },
              end: {
                row: node.endPosition.row,
                column: node.endPosition.column
              }
            }
          };
        }
      }
      
      // If not found in scope tree, return with unknown kind
      return {
        name,
        kind: 'unknown',
        range: {
          start: {
            row: node.startPosition.row,
            column: node.startPosition.column
          },
          end: {
            row: node.endPosition.row,
            column: node.endPosition.column
          }
        }
      };
    }
  }
  
  // Fall back to searching scopes for a symbol at this position
  for (const [scope_id, scope] of scope_tree.nodes) {
    for (const [symbol_name, symbol] of scope.symbols) {
      if (contains_position(symbol.range, position)) {
        return {
          name: symbol_name,
          kind: symbol.kind,
          range: symbol.range
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Find node at position in AST
 */
function find_node_at_position(
  node: SyntaxNode,
  position: Position
): SyntaxNode | undefined {
  const node_range = {
    start: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    end: {
      row: node.endPosition.row,
      column: node.endPosition.column
    }
  };
  
  if (!contains_position(node_range, position)) {
    return undefined;
  }
  
  // Check children for a more specific match
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const child_match = find_node_at_position(child, position);
      if (child_match) {
        return child_match;
      }
    }
  }
  
  // This node is the best match
  return node;
}
/**
 * Find all function/method calls
 */
export function find_function_calls(
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string
): Usage[] {
  const context: UsageFinderContext = {
    scope_tree,
    language,
    file_path,
    root_node,
    source_code
  };
  
  const all_usages: Usage[] = [];
  
  // Find all function definitions
  for (const [scope_id, scope] of scope_tree.nodes) {
    for (const [symbol_name, symbol] of scope.symbols) {
      if (symbol.kind === 'function' || symbol.kind === 'method') {
        const temp_def: Def = {
          id: `def_${scope_id}_${symbol_name}`,
          kind: 'definition',
          name: symbol_name,
          symbol_kind: symbol.kind,
          range: symbol.range,
          symbol_id: `${file_path}#${symbol_name}`
        };
        
        const usages = find_usages_core(temp_def, context);
        const call_usages = filter_usages_by_type(usages, ['call']);
        all_usages.push(...call_usages);
      }
    }
  }
  
  return all_usages;
}

/**
 * Find all variable writes
 */
export function find_variable_writes(
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string
): Usage[] {
  const context: UsageFinderContext = {
    scope_tree,
    language,
    file_path,
    root_node,
    source_code
  };
  
  const all_usages: Usage[] = [];
  
  // Find all variable definitions
  for (const [scope_id, scope] of scope_tree.nodes) {
    for (const [symbol_name, symbol] of scope.symbols) {
      if (symbol.kind === 'variable' || symbol.kind === 'parameter') {
        const temp_def: Def = {
          id: `def_${scope_id}_${symbol_name}`,
          kind: 'definition',
          name: symbol_name,
          symbol_kind: symbol.kind,
          range: symbol.range,
          symbol_id: `${file_path}#${symbol_name}`
        };
        
        const usages = find_usages_core(temp_def, context);
        const write_usages = filter_usages_by_type(usages, ['write']);
        all_usages.push(...write_usages);
      }
    }
  }
  
  return all_usages;
}