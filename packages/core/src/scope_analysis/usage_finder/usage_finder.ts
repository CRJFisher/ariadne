/**
 * Core usage finder functionality
 * 
 * Finds all usages/references of a symbol including:
 * - Variable references
 * - Function calls
 * - Type references
 * - Import references
 * - Method calls
 * - Property accesses
 */

// TODO: Integration with Scope Tree
// - Find all refs in scope tree
// TODO: Integration with Symbol Resolution
// - Resolve all references to a definition
// TODO: Integration with Import Resolution
// - Track usage through imports

import { SyntaxNode } from 'tree-sitter';
import { Ref, Def, Position, Language } from '@ariadnejs/types';
import { ScopeTree, ScopeNode } from '../scope_tree';
import { ResolvedSymbol } from '../symbol_resolution';

/**
 * Usage information
 */
export interface Usage {
  reference: Ref;
  usage_type: 'read' | 'write' | 'call' | 'import' | 'export' | 'type';
  enclosing_scope: ScopeNode;
  confidence: 'exact' | 'likely' | 'possible';
}

/**
 * Context for usage finding
 */
export interface UsageFinderContext {
  scope_tree: ScopeTree;
  language: Language;
  file_path: string;
  root_node?: SyntaxNode;
  source_code?: string;
  imports?: Array<{ name: string; source: string }>;
  exports?: Array<{ name: string; }>;
}

/**
 * Find all usages of a definition
 */
export function find_usages(
  definition: Def,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  // Search all scopes for references
  for (const [scope_id, scope] of context.scope_tree.nodes) {
    const scope_usages = find_usages_in_scope(
      definition,
      scope,
      context
    );
    usages.push(...scope_usages);
  }
  
  // If we have the AST, do a more thorough search
  if (context.root_node && context.source_code) {
    const ast_usages = find_usages_in_ast(
      definition,
      context.root_node,
      context
    );
    
    // Merge with scope usages, avoiding duplicates
    for (const usage of ast_usages) {
      if (!usage_exists(usage, usages)) {
        usages.push(usage);
      }
    }
  }
  
  return usages;
}

/**
 * Find usages within a specific scope
 */
function find_usages_in_scope(
  definition: Def,
  scope: ScopeNode,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  // Check if this scope references the definition
  // This is a simplified check - real implementation would be more thorough
  for (const [symbol_name, symbol] of scope.symbols) {
    if (symbol_name === definition.name) {
      // Check if this is a reference or a redefinition
      if (!is_same_position(symbol.range, definition.range)) {
        usages.push({
          reference: {
            id: `ref_${scope.id}_${symbol_name}`,
            kind: 'reference',
            name: symbol_name,
            symbol_id: definition.symbol_id,
            range: symbol.range,
            file_path: context.file_path
          },
          usage_type: determine_usage_type(symbol, context),
          enclosing_scope: scope,
          confidence: 'likely'
        });
      }
    }
  }
  
  return usages;
}

/**
 * Find usages by traversing the AST
 */
function find_usages_in_ast(
  definition: Def,
  node: SyntaxNode,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  // Check if this node is a reference to the definition
  if (is_reference_node(node, definition, context)) {
    const scope = find_enclosing_scope(node, context.scope_tree);
    if (scope) {
      usages.push({
        reference: {
          id: `ref_ast_${node.startIndex}`,
          kind: 'reference',
          name: definition.name,
          symbol_id: definition.symbol_id,
          range: {
            start: {
              row: node.startPosition.row,
              column: node.startPosition.column
            },
            end: {
              row: node.endPosition.row,
              column: node.endPosition.column
            }
          },
          file_path: context.file_path
        },
        usage_type: determine_node_usage_type(node, context),
        enclosing_scope: scope,
        confidence: 'exact'
      });
    }
  }
  
  // Traverse children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const child_usages = find_usages_in_ast(definition, child, context);
      usages.push(...child_usages);
    }
  }
  
  return usages;
}

/**
 * Check if a node is a reference to the definition
 */
function is_reference_node(
  node: SyntaxNode,
  definition: Def,
  context: UsageFinderContext
): boolean {
  if (!context.source_code) return false;
  
  // Check identifiers
  if (node.type === 'identifier' || node.type === 'type_identifier') {
    const text = context.source_code.substring(node.startIndex, node.endIndex);
    return text === definition.name;
  }
  
  // Language-specific checks would go here
  
  return false;
}

/**
 * Determine the type of usage for a symbol
 */
function determine_usage_type(
  symbol: any,
  context: UsageFinderContext
): Usage['usage_type'] {
  // Simplified determination - real implementation would be more sophisticated
  if (symbol.kind === 'function' || symbol.kind === 'method') {
    return 'call';
  }
  if (symbol.is_imported) {
    return 'import';
  }
  if (symbol.is_exported) {
    return 'export';
  }
  if (symbol.kind === 'type' || symbol.kind === 'interface') {
    return 'type';
  }
  
  return 'read';
}

/**
 * Determine usage type from AST node
 */
function determine_node_usage_type(
  node: SyntaxNode,
  context: UsageFinderContext
): Usage['usage_type'] {
  const parent = node.parent;
  if (!parent) return 'read';
  
  // Check if it's a function call
  if (parent.type === 'call_expression' && 
      parent.childForFieldName('function') === node) {
    return 'call';
  }
  
  // Check if it's an assignment target
  if (parent.type === 'assignment_expression' &&
      parent.childForFieldName('left') === node) {
    return 'write';
  }
  
  // Check if it's in an import statement
  if (is_import_context(node)) {
    return 'import';
  }
  
  // Check if it's in an export statement
  if (is_export_context(node)) {
    return 'export';
  }
  
  // Check if it's a type reference
  if (is_type_context(node)) {
    return 'type';
  }
  
  return 'read';
}

/**
 * Check if node is in an import context
 */
function is_import_context(node: SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    if (current.type.includes('import')) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Check if node is in an export context
 */
function is_export_context(node: SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    if (current.type.includes('export')) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Check if node is in a type context
 */
function is_type_context(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (!parent) return false;
  
  // Check common type contexts
  return parent.type.includes('type') ||
         parent.type === 'type_annotation' ||
         parent.type === 'type_reference' ||
         parent.type === 'generic_type';
}

/**
 * Find the enclosing scope for a node
 */
function find_enclosing_scope(
  node: SyntaxNode,
  scope_tree: ScopeTree
): ScopeNode | undefined {
  const position = {
    row: node.startPosition.row,
    column: node.startPosition.column
  };
  
  // Find the deepest scope containing this position
  let best_scope: ScopeNode | undefined;
  let best_depth = -1;
  
  for (const [scope_id, scope] of scope_tree.nodes) {
    if (contains_position(scope.range, position)) {
      const depth = get_scope_depth(scope, scope_tree);
      if (depth > best_depth) {
        best_scope = scope;
        best_depth = depth;
      }
    }
  }
  
  return best_scope;
}

/**
 * Get the depth of a scope in the tree
 */
function get_scope_depth(scope: ScopeNode, tree: ScopeTree): number {
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

/**
 * Check if a position is contained in a range
 */
function contains_position(
  range: { start: Position; end: Position },
  position: Position
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
 * Check if two positions are the same
 */
function is_same_position(
  range1: { start: Position; end: Position },
  range2: { start: Position; end: Position }
): boolean {
  return range1.start.row === range2.start.row &&
         range1.start.column === range2.start.column &&
         range1.end.row === range2.end.row &&
         range1.end.column === range2.end.column;
}

/**
 * Check if a usage already exists in the list
 */
function usage_exists(usage: Usage, usages: Usage[]): boolean {
  return usages.some(u => 
    u.reference.range.start.row === usage.reference.range.start.row &&
    u.reference.range.start.column === usage.reference.range.start.column &&
    u.reference.range.end.row === usage.reference.range.end.row &&
    u.reference.range.end.column === usage.reference.range.end.column
  );
}

/**
 * Find all references to a symbol name
 */
export function find_references(
  symbol_name: string,
  context: UsageFinderContext
): Usage[] {
  const usages: Usage[] = [];
  
  // Search all scopes
  for (const [scope_id, scope] of context.scope_tree.nodes) {
    // Check if scope has this symbol
    const symbol = scope.symbols.get(symbol_name);
    if (symbol) {
      // Create a temporary definition
      const temp_def: Def = {
        id: `def_${scope_id}_${symbol_name}`,
        kind: 'definition',
        name: symbol_name,
        symbol_kind: symbol.kind,
        range: symbol.range,
        symbol_id: `${context.file_path}#${symbol_name}`
      };
      
      // Find usages of this definition
      const def_usages = find_usages(temp_def, context);
      usages.push(...def_usages);
    }
  }
  
  return usages;
}

/**
 * Find usages of multiple definitions
 */
export function find_usages_batch(
  definitions: Def[],
  context: UsageFinderContext
): Map<string, Usage[]> {
  const results = new Map<string, Usage[]>();
  
  for (const def of definitions) {
    const usages = find_usages(def, context);
    results.set(def.id, usages);
  }
  
  return results;
}

/**
 * Filter usages by type
 */
export function filter_usages_by_type(
  usages: Usage[],
  types: Usage['usage_type'][]
): Usage[] {
  return usages.filter(u => types.includes(u.usage_type));
}

/**
 * Group usages by scope
 */
export function group_usages_by_scope(
  usages: Usage[]
): Map<string, Usage[]> {
  const grouped = new Map<string, Usage[]>();
  
  for (const usage of usages) {
    const scope_id = usage.enclosing_scope.id;
    const group = grouped.get(scope_id) || [];
    group.push(usage);
    grouped.set(scope_id, group);
  }
  
  return grouped;
}

/**
 * Count usages by type
 */
export function count_usages_by_type(
  usages: Usage[]
): Record<Usage['usage_type'], number> {
  const counts: Record<Usage['usage_type'], number> = {
    read: 0,
    write: 0,
    call: 0,
    import: 0,
    export: 0,
    type: 0
  };
  
  for (const usage of usages) {
    counts[usage.usage_type]++;
  }
  
  return counts;
}