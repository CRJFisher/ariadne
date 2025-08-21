/**
 * Core symbol resolution functionality
 * 
 * Resolves symbol references to their definitions:
 * - Local variable resolution
 * - Import resolution
 * - Qualified name resolution
 * - Cross-file symbol tracking
 */

// TODO: Integration with Scope Tree
// - Walk scope tree for resolution
// TODO: Integration with Import Resolution
// - Check imports for external symbols
// TODO: Integration with Type Tracking
// - Use type info for disambiguation

import { SyntaxNode } from 'tree-sitter';
import { Language, Def, Ref, Position } from '@ariadnejs/types';
import {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  find_scope_at_position,
  find_symbol_in_scope_chain,
  get_scope_chain,
  get_visible_symbols
} from '../scope_tree';

/**
 * Symbol resolution result
 */
export interface ResolvedSymbol {
  symbol: ScopeSymbol;
  scope: ScopeNode;
  definition_file?: string;
  is_imported?: boolean;
  is_exported?: boolean;
  confidence: 'exact' | 'likely' | 'possible';
}

/**
 * Symbol resolution context
 */
export interface ResolutionContext {
  scope_tree: ScopeTree;
  file_path?: string;
  imports?: ImportInfo[];
  exports?: ExportInfo[];
  type_context?: Map<string, string>;
  cross_file_graphs?: Map<string, ScopeTree>;
}

/**
 * Import information
 */
export interface ImportInfo {
  name: string;
  source_name?: string;  // Original name if renamed
  module_path: string;
  is_default?: boolean;
  is_namespace?: boolean;
  is_type_only?: boolean;
  range: {
    start: Position;
    end: Position;
  };
}

/**
 * Export information
 */
export interface ExportInfo {
  name: string;
  local_name?: string;  // Local name if renamed
  is_default?: boolean;
  is_type_only?: boolean;
  range: {
    start: Position;
    end: Position;
  };
}

/**
 * Resolve a symbol at a given position
 */
export function resolve_symbol_at_position(
  position: Position,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree } = context;
  
  // Find the scope at this position
  const scope = find_scope_at_position(scope_tree, position);
  if (!scope) return undefined;
  
  // Get the symbol name at this position (would need AST access)
  // For now, this is a placeholder - real implementation would extract from AST
  const symbol_name = extract_symbol_at_position(position, context);
  if (!symbol_name) return undefined;
  
  return resolve_symbol(symbol_name, scope.id, context);
}

/**
 * Resolve a symbol by name from a given scope
 */
export function resolve_symbol(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree, imports, cross_file_graphs } = context;
  
  // First, try to resolve locally within the scope chain
  const local_resolution = find_symbol_in_scope_chain(scope_tree, scope_id, symbol_name);
  if (local_resolution) {
    return {
      symbol: local_resolution.symbol,
      scope: local_resolution.scope,
      definition_file: context.file_path,
      confidence: 'exact'
    };
  }
  
  // Next, check imports
  if (imports) {
    const import_resolution = resolve_from_imports(symbol_name, imports, context);
    if (import_resolution) {
      return import_resolution;
    }
  }
  
  // Check for qualified names (e.g., namespace.member)
  if (symbol_name.includes('.')) {
    const qualified_resolution = resolve_qualified_name(symbol_name, scope_id, context);
    if (qualified_resolution) {
      return qualified_resolution;
    }
  }
  
  // Try fuzzy matching for possible typos
  const fuzzy_resolution = resolve_with_fuzzy_matching(symbol_name, scope_id, context);
  if (fuzzy_resolution) {
    return fuzzy_resolution;
  }
  
  return undefined;
}

/**
 * Resolve symbol from imports
 */
function resolve_from_imports(
  symbol_name: string,
  imports: ImportInfo[],
  context: ResolutionContext
): ResolvedSymbol | undefined {
  // Find matching import
  const matching_import = imports.find(imp => {
    if (imp.is_namespace) {
      // Namespace imports don't directly provide the symbol
      return false;
    }
    return imp.name === symbol_name;
  });
  
  if (!matching_import) {
    // Check namespace imports
    return resolve_from_namespace_imports(symbol_name, imports, context);
  }
  
  // If we have cross-file graphs, try to resolve in the imported module
  if (context.cross_file_graphs && matching_import.module_path) {
    const module_tree = find_module_scope_tree(matching_import.module_path, context.cross_file_graphs);
    if (module_tree) {
      // Look for exported symbol in the module
      const export_name = matching_import.source_name || matching_import.name;
      const exported_symbol = find_exported_symbol(export_name, module_tree);
      
      if (exported_symbol) {
        return {
          symbol: exported_symbol.symbol,
          scope: exported_symbol.scope,
          definition_file: matching_import.module_path,
          is_imported: true,
          confidence: 'exact'
        };
      }
    }
  }
  
  // Return the import itself as a resolved symbol
  return {
    symbol: {
      name: matching_import.name,
      kind: 'import',
      range: matching_import.range,
      is_imported: true
    },
    scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
    is_imported: true,
    confidence: 'exact'
  };
}

/**
 * Resolve from namespace imports
 */
function resolve_from_namespace_imports(
  symbol_name: string,
  imports: ImportInfo[],
  context: ResolutionContext
): ResolvedSymbol | undefined {
  // Check if symbol_name is namespace.member pattern
  const parts = symbol_name.split('.');
  if (parts.length < 2) return undefined;
  
  const namespace = parts[0];
  const member = parts.slice(1).join('.');
  
  // Find namespace import
  const namespace_import = imports.find(imp => 
    imp.is_namespace && imp.name === namespace
  );
  
  if (!namespace_import) return undefined;
  
  // Try to resolve member in the namespace module
  if (context.cross_file_graphs && namespace_import.module_path) {
    const module_tree = find_module_scope_tree(namespace_import.module_path, context.cross_file_graphs);
    if (module_tree) {
      const exported_symbol = find_exported_symbol(member, module_tree);
      if (exported_symbol) {
        return {
          symbol: exported_symbol.symbol,
          scope: exported_symbol.scope,
          definition_file: namespace_import.module_path,
          is_imported: true,
          confidence: 'exact'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Resolve qualified name (namespace.member)
 */
function resolve_qualified_name(
  qualified_name: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const parts = qualified_name.split('.');
  if (parts.length < 2) return undefined;
  
  const { scope_tree } = context;
  
  // Start by resolving the first part
  let current_resolution = find_symbol_in_scope_chain(scope_tree, scope_id, parts[0]);
  if (!current_resolution) return undefined;
  
  // For each subsequent part, look for it as a property/member
  for (let i = 1; i < parts.length; i++) {
    const member_name = parts[i];
    
    // This would require type information to properly resolve
    // For now, return a partial resolution
    if (i === parts.length - 1) {
      return {
        symbol: {
          name: member_name,
          kind: 'property',
          range: current_resolution.symbol.range
        },
        scope: current_resolution.scope,
        confidence: 'likely'
      };
    }
  }
  
  return undefined;
}

/**
 * Resolve with fuzzy matching for typos
 */
function resolve_with_fuzzy_matching(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree } = context;
  
  // Get all visible symbols
  const visible = get_visible_symbols(scope_tree, scope_id);
  
  // Find symbols with similar names
  let best_match: { symbol: ScopeSymbol; scope: ScopeNode; score: number } | undefined;
  
  for (const [name, symbol] of visible) {
    const score = calculate_similarity(symbol_name, name);
    if (score > 0.8) {  // 80% similarity threshold
      if (!best_match || score > best_match.score) {
        // Find which scope contains this symbol
        const containing_scope = find_scope_containing_symbol(scope_tree, scope_id, name);
        if (containing_scope) {
          best_match = { symbol, scope: containing_scope, score };
        }
      }
    }
  }
  
  if (best_match) {
    return {
      symbol: best_match.symbol,
      scope: best_match.scope,
      confidence: 'possible'
    };
  }
  
  return undefined;
}

/**
 * Find scope containing a symbol
 */
function find_scope_containing_symbol(
  tree: ScopeTree,
  start_scope_id: string,
  symbol_name: string
): ScopeNode | undefined {
  const chain = get_scope_chain(tree, start_scope_id);
  
  for (const scope of chain) {
    if (scope.symbols.has(symbol_name)) {
      return scope;
    }
  }
  
  return undefined;
}

/**
 * Calculate string similarity (Levenshtein distance based)
 */
function calculate_similarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  // Create distance matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  // Calculate distances
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // substitution
          matrix[i][j - 1] + 1,       // insertion
          matrix[i - 1][j] + 1        // deletion
        );
      }
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

/**
 * Find module scope tree
 */
function find_module_scope_tree(
  module_path: string,
  cross_file_graphs: Map<string, ScopeTree>
): ScopeTree | undefined {
  // Try direct path
  let tree = cross_file_graphs.get(module_path);
  if (tree) return tree;
  
  // Try with common extensions
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.rs'];
  for (const ext of extensions) {
    tree = cross_file_graphs.get(module_path + ext);
    if (tree) return tree;
  }
  
  // Try resolving as node_modules package
  if (!module_path.startsWith('.') && !module_path.startsWith('/')) {
    // This would require package.json resolution
    // For now, just try common patterns
    tree = cross_file_graphs.get(`node_modules/${module_path}/index.js`);
    if (tree) return tree;
  }
  
  return undefined;
}

/**
 * Find exported symbol in a module
 */
function find_exported_symbol(
  symbol_name: string,
  module_tree: ScopeTree
): { symbol: ScopeSymbol; scope: ScopeNode } | undefined {
  // Look in root scope for exported symbols
  const root_scope = module_tree.nodes.get(module_tree.root_id);
  if (!root_scope) return undefined;
  
  const symbol = root_scope.symbols.get(symbol_name);
  if (symbol && symbol.is_exported) {
    return { symbol, scope: root_scope };
  }
  
  // Check all scopes for exported symbols (for nested exports)
  for (const [scope_id, scope] of module_tree.nodes) {
    const symbol = scope.symbols.get(symbol_name);
    if (symbol && symbol.is_exported) {
      return { symbol, scope };
    }
  }
  
  return undefined;
}

/**
 * Extract symbol name at position (placeholder)
 */
function extract_symbol_at_position(
  position: Position,
  context: ResolutionContext
): string | undefined {
  // This would require AST access to extract the actual symbol
  // For now, return undefined - real implementation would parse the source
  return undefined;
}

/**
 * Find all references to a symbol
 */
export function find_symbol_references(
  symbol_name: string,
  context: ResolutionContext
): Ref[] {
  const references: Ref[] = [];
  const { scope_tree } = context;
  
  // Walk through all scopes looking for references
  for (const [scope_id, scope] of scope_tree.nodes) {
    // Check if this scope references the symbol
    const resolution = resolve_symbol(symbol_name, scope_id, context);
    if (resolution) {
      // This would need AST traversal to find actual reference positions
      // For now, add a reference for the scope that can see the symbol
      references.push({
        id: `ref_${scope_id}_${symbol_name}`,
        kind: 'reference',
        name: symbol_name,
        range: scope.range,
        file_path: context.file_path || ''
      });
    }
  }
  
  return references;
}

/**
 * Find definition of a symbol
 */
export function find_symbol_definition(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): Def | undefined {
  const resolution = resolve_symbol(symbol_name, scope_id, context);
  if (!resolution) return undefined;
  
  return {
    id: `def_${resolution.scope.id}_${symbol_name}`,
    kind: 'definition',
    name: symbol_name,
    symbol_kind: resolution.symbol.kind,
    range: resolution.symbol.range,
    file_path: resolution.definition_file || context.file_path || ''
  };
}

/**
 * Get all symbols visible from a scope
 */
export function get_all_visible_symbols(
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol[] {
  const { scope_tree, imports } = context;
  const resolved: ResolvedSymbol[] = [];
  
  // Get local symbols
  const visible = get_visible_symbols(scope_tree, scope_id);
  for (const [name, symbol] of visible) {
    const scope = find_scope_containing_symbol(scope_tree, scope_id, name);
    if (scope) {
      resolved.push({
        symbol,
        scope,
        definition_file: context.file_path,
        confidence: 'exact'
      });
    }
  }
  
  // Add imported symbols
  if (imports) {
    for (const imp of imports) {
      if (!imp.is_namespace) {
        resolved.push({
          symbol: {
            name: imp.name,
            kind: 'import',
            range: imp.range,
            is_imported: true
          },
          scope: scope_tree.nodes.get(scope_tree.root_id)!,
          is_imported: true,
          confidence: 'exact'
        });
      }
    }
  }
  
  return resolved;
}

/**
 * Check if a symbol is exported
 */
export function is_symbol_exported(
  symbol_name: string,
  context: ResolutionContext
): boolean {
  const { scope_tree, exports } = context;
  
  // Check export list
  if (exports) {
    return exports.some(exp => exp.name === symbol_name);
  }
  
  // Check root scope for exported symbols
  const root_scope = scope_tree.nodes.get(scope_tree.root_id);
  if (root_scope) {
    const symbol = root_scope.symbols.get(symbol_name);
    return symbol?.is_exported === true;
  }
  
  return false;
}

/**
 * Resolve symbol with type disambiguation
 */
export function resolve_symbol_with_type(
  symbol_name: string,
  expected_type: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree, type_context } = context;
  
  // Get all possible resolutions
  const all_visible = get_visible_symbols(scope_tree, scope_id);
  const candidates: ResolvedSymbol[] = [];
  
  for (const [name, symbol] of all_visible) {
    if (name === symbol_name) {
      const scope = find_scope_containing_symbol(scope_tree, scope_id, name);
      if (scope) {
        candidates.push({
          symbol,
          scope,
          confidence: 'possible'
        });
      }
    }
  }
  
  // Filter by type if available
  if (type_context && candidates.length > 1) {
    for (const candidate of candidates) {
      const symbol_type = type_context.get(candidate.symbol.name);
      if (symbol_type === expected_type) {
        return { ...candidate, confidence: 'exact' };
      }
    }
  }
  
  // Return first candidate if no type match
  return candidates[0];
}