/**
 * Rust-specific symbol resolution
 * 
 * Handles Rust's unique symbol resolution features:
 * - Module paths and visibility
 * - use statements and re-exports
 * - impl blocks and associated items
 * - Trait implementations
 * - Pattern matching bindings
 * - Lifetime and generic parameters
 * - Macro invocations
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, Def, Ref, Position } from '@ariadnejs/types';
import {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  ScopeType,
  find_scope_at_position,
  find_symbol_in_scope_chain,
  get_scope_chain,
  get_visible_symbols
} from '../scope_tree';
import {
  ResolvedSymbol,
  ResolutionContext,
  ImportInfo,
  ExportInfo,
  resolve_symbol,
  find_symbol_references,
  find_symbol_definition,
  get_all_visible_symbols,
  is_symbol_exported,
  resolve_symbol_with_type
} from './symbol_resolution';

/**
 * Rust-specific resolution context
 */
export interface RustResolutionContext extends ResolutionContext {
  crate_name?: string;
  use_statements?: UseStatement[];
  impl_blocks?: ImplBlock[];
  trait_impls?: TraitImpl[];
  macro_definitions?: Map<string, MacroDefinition>;
  visibility_modifiers?: Map<string, Visibility>;
}

/**
 * Rust use statement
 */
export interface UseStatement {
  path: string[];
  alias?: string;
  is_glob?: boolean;
  is_group?: boolean;
  items?: UseItem[];
  visibility: Visibility;
  range: { start: Position; end: Position };
}

/**
 * Individual use item
 */
export interface UseItem {
  name: string;
  alias?: string;
}

/**
 * Rust visibility
 */
export type Visibility = 'pub' | 'pub(crate)' | 'pub(super)' | 'pub(self)' | 'private';

/**
 * Impl block information
 */
export interface ImplBlock {
  type_name: string;
  trait_name?: string;
  methods: Map<string, ScopeSymbol>;
  associated_types: Map<string, string>;
  associated_consts: Map<string, string>;
}

/**
 * Trait implementation
 */
export interface TraitImpl {
  trait_name: string;
  type_name: string;
  methods: Map<string, ScopeSymbol>;
}

/**
 * Macro definition
 */
export interface MacroDefinition {
  name: string;
  kind: 'declarative' | 'procedural' | 'derive';
  visibility: Visibility;
  range: { start: Position; end: Position };
}

/**
 * Resolve Rust symbol with module paths and visibility
 */
export function resolve_rust_symbol(
  symbol_name: string,
  scope_id: string,
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree, use_statements, impl_blocks } = context;
  
  // Check for path resolution (e.g., std::collections::HashMap)
  if (symbol_name.includes('::')) {
    return resolve_module_path(symbol_name, scope_id, context);
  }
  
  // Check for method call syntax (e.g., self.method)
  if (symbol_name.includes('.')) {
    return resolve_method_call(symbol_name, scope_id, context);
  }
  
  // Try local resolution first
  const local_result = find_symbol_in_scope_chain(scope_tree, scope_id, symbol_name);
  if (local_result) {
    return {
      symbol: local_result.symbol,
      scope: local_result.scope,
      definition_file: context.file_path,
      confidence: 'exact'
    };
  }
  
  // Check use statements
  if (use_statements) {
    const use_result = resolve_from_use_statements(symbol_name, use_statements, context);
    if (use_result) return use_result;
  }
  
  // Check for self/Self keywords
  if (symbol_name === 'self' || symbol_name === 'Self') {
    return resolve_self_keyword(symbol_name, scope_id, context);
  }
  
  // Check impl blocks for associated items
  if (impl_blocks) {
    const impl_result = resolve_from_impl_blocks(symbol_name, impl_blocks, scope_id, context);
    if (impl_result) return impl_result;
  }
  
  // Check standard library prelude
  const prelude_result = resolve_from_prelude(symbol_name, context);
  if (prelude_result) return prelude_result;
  
  // Fall back to standard resolution
  return resolve_symbol(symbol_name, scope_id, context);
}

/**
 * Resolve module path (e.g., std::collections::HashMap)
 */
function resolve_module_path(
  path: string,
  scope_id: string,
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  const segments = path.split('::');
  
  // Special handling for crate root
  if (segments[0] === 'crate') {
    return resolve_crate_path(segments.slice(1), context);
  }
  
  // Special handling for super
  if (segments[0] === 'super') {
    return resolve_super_path(segments.slice(1), scope_id, context);
  }
  
  // Special handling for self (module self)
  if (segments[0] === 'self') {
    return resolve_self_path(segments.slice(1), scope_id, context);
  }
  
  // Try to resolve as absolute path or from use statements
  return resolve_absolute_path(segments, context);
}

/**
 * Resolve crate-relative path
 */
function resolve_crate_path(
  segments: string[],
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  // This would require crate-level symbol table
  // For now, return a likely match
  const name = segments[segments.length - 1];
  return {
    symbol: {
      name,
      kind: 'module_item',
      range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }
    },
    scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
    confidence: 'likely'
  };
}

/**
 * Resolve super-relative path
 */
function resolve_super_path(
  segments: string[],
  scope_id: string,
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree } = context;
  const scope_chain = get_scope_chain(scope_tree, scope_id);
  
  // Find parent module
  let parent_module: ScopeNode | undefined;
  for (let i = 0; i < scope_chain.length; i++) {
    if (scope_chain[i].type === 'module' && i + 1 < scope_chain.length) {
      parent_module = scope_chain[i + 1];
      break;
    }
  }
  
  if (!parent_module) return undefined;
  
  // Try to resolve remaining path from parent module
  if (segments.length === 0) {
    return {
      symbol: {
        name: 'super',
        kind: 'module',
        range: parent_module.range
      },
      scope: parent_module,
      confidence: 'exact'
    };
  }
  
  return resolve_rust_symbol(segments.join('::'), parent_module.id, context);
}

/**
 * Resolve self-relative path (module self)
 */
function resolve_self_path(
  segments: string[],
  scope_id: string,
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  if (segments.length === 0) {
    // Just 'self' - refers to current module
    const { scope_tree } = context;
    const scope_chain = get_scope_chain(scope_tree, scope_id);
    const module_scope = scope_chain.find(s => s.type === 'module');
    
    if (module_scope) {
      return {
        symbol: {
          name: 'self',
          kind: 'module',
          range: module_scope.range
        },
        scope: module_scope,
        confidence: 'exact'
      };
    }
  }
  
  // Continue with remaining path
  return resolve_rust_symbol(segments.join('::'), scope_id, context);
}

/**
 * Resolve absolute path
 */
function resolve_absolute_path(
  segments: string[],
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  // Check if it's a known crate
  const crate_name = segments[0];
  if (is_known_crate(crate_name)) {
    // This would require external crate resolution
    const name = segments[segments.length - 1];
    return {
      symbol: {
        name,
        kind: 'external',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }
      },
      scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
      confidence: 'likely'
    };
  }
  
  return undefined;
}

/**
 * Resolve from use statements
 */
function resolve_from_use_statements(
  symbol_name: string,
  use_statements: UseStatement[],
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  for (const use_stmt of use_statements) {
    // Check direct import
    if (use_stmt.alias === symbol_name) {
      return {
        symbol: {
          name: symbol_name,
          kind: 'import',
          range: use_stmt.range,
          is_imported: true
        },
        scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
        is_imported: true,
        confidence: 'exact'
      };
    }
    
    // Check if last segment matches
    const last_segment = use_stmt.path[use_stmt.path.length - 1];
    if (last_segment === symbol_name && !use_stmt.alias) {
      return {
        symbol: {
          name: symbol_name,
          kind: 'import',
          range: use_stmt.range,
          is_imported: true
        },
        scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
        is_imported: true,
        confidence: 'exact'
      };
    }
    
    // Check glob imports
    if (use_stmt.is_glob) {
      // Would need to resolve the module to know what's imported
      return {
        symbol: {
          name: symbol_name,
          kind: 'import',
          range: use_stmt.range,
          is_imported: true
        },
        scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
        is_imported: true,
        confidence: 'possible'
      };
    }
    
    // Check group imports
    if (use_stmt.is_group && use_stmt.items) {
      for (const item of use_stmt.items) {
        if ((item.alias || item.name) === symbol_name) {
          return {
            symbol: {
              name: symbol_name,
              kind: 'import',
              range: use_stmt.range,
              is_imported: true
            },
            scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
            is_imported: true,
            confidence: 'exact'
          };
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Resolve self/Self keywords
 */
function resolve_self_keyword(
  symbol_name: string,
  scope_id: string,
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree } = context;
  const scope_chain = get_scope_chain(scope_tree, scope_id);
  
  if (symbol_name === 'self') {
    // Look for enclosing method
    for (const scope of scope_chain) {
      if (scope.type === 'function' && scope.metadata?.is_method) {
        return {
          symbol: {
            name: 'self',
            kind: 'parameter',
            range: scope.range
          },
          scope,
          confidence: 'exact'
        };
      }
    }
  } else if (symbol_name === 'Self') {
    // Look for enclosing impl block (represented as 'class' in scope tree for Rust)
    for (const scope of scope_chain) {
      if (scope.type === 'class' || scope.type === 'impl') {
        return {
          symbol: {
            name: 'Self',
            kind: 'type',
            range: scope.range
          },
          scope,
          confidence: 'exact'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Resolve from impl blocks
 */
function resolve_from_impl_blocks(
  symbol_name: string,
  impl_blocks: ImplBlock[],
  scope_id: string,
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  // This would require type information to know which impl block applies
  // For now, check if symbol exists in any impl block
  for (const impl_block of impl_blocks) {
    if (impl_block.methods.has(symbol_name)) {
      const method = impl_block.methods.get(symbol_name)!;
      return {
        symbol: method,
        scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
        confidence: 'possible'
      };
    }
    
    if (impl_block.associated_types.has(symbol_name)) {
      return {
        symbol: {
          name: symbol_name,
          kind: 'type',
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }
        },
        scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
        confidence: 'possible'
      };
    }
    
    if (impl_block.associated_consts.has(symbol_name)) {
      return {
        symbol: {
          name: symbol_name,
          kind: 'const',
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }
        },
        scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
        confidence: 'possible'
      };
    }
  }
  
  return undefined;
}

/**
 * Resolve method call (e.g., value.method())
 */
function resolve_method_call(
  qualified_name: string,
  scope_id: string,
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  const parts = qualified_name.split('.');
  if (parts.length < 2) return undefined;
  
  const receiver = parts[0];
  const method = parts[parts.length - 1];
  
  // Resolve the receiver
  const receiver_resolution = resolve_rust_symbol(receiver, scope_id, context);
  if (!receiver_resolution) return undefined;
  
  // Would need type information to resolve the method
  // For now, return a possible match
  return {
    symbol: {
      name: method,
      kind: 'method',
      range: receiver_resolution.symbol.range
    },
    scope: receiver_resolution.scope,
    confidence: 'possible'
  };
}

/**
 * Resolve from Rust prelude
 */
function resolve_from_prelude(
  symbol_name: string,
  context: RustResolutionContext
): ResolvedSymbol | undefined {
  // Common prelude items
  const PRELUDE_ITEMS = new Set([
    // Types
    'Option', 'Result', 'Vec', 'String', 'Box', 'Rc', 'Arc',
    'Cell', 'RefCell', 'Mutex', 'RwLock',
    // Traits
    'Clone', 'Copy', 'Debug', 'Default', 'Eq', 'PartialEq',
    'Ord', 'PartialOrd', 'Hash', 'Iterator', 'IntoIterator',
    'From', 'Into', 'TryFrom', 'TryInto', 'AsRef', 'AsMut',
    'Drop', 'Fn', 'FnMut', 'FnOnce', 'Send', 'Sync',
    // Macros
    'println', 'print', 'eprintln', 'eprint', 'format',
    'vec', 'assert', 'assert_eq', 'assert_ne', 'debug_assert',
    'panic', 'unreachable', 'unimplemented', 'todo',
    // Values
    'Some', 'None', 'Ok', 'Err'
  ]);
  
  if (PRELUDE_ITEMS.has(symbol_name)) {
    return {
      symbol: {
        name: symbol_name,
        kind: 'prelude',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }
      },
      scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
      confidence: 'exact'
    };
  }
  
  return undefined;
}

/**
 * Check if a crate name is known
 */
function is_known_crate(name: string): boolean {
  const KNOWN_CRATES = new Set([
    'std', 'core', 'alloc', 'proc_macro',
    'serde', 'tokio', 'async_trait', 'futures',
    'rand', 'regex', 'chrono', 'log'
  ]);
  return KNOWN_CRATES.has(name);
}

/**
 * Extract Rust use statements from AST
 */
export function extract_rust_use_statements(
  root_node: SyntaxNode,
  source_code: string
): UseStatement[] {
  const use_statements: UseStatement[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'use_declaration') {
      const use_stmt = extract_use_declaration(node, source_code);
      if (use_stmt) use_statements.push(use_stmt);
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return use_statements;
}

/**
 * Extract a single use declaration
 */
function extract_use_declaration(
  node: SyntaxNode,
  source_code: string
): UseStatement | undefined {
  const visibility = extract_visibility(node, source_code);
  const use_clause = node.childForFieldName('argument') || node.childForFieldName('clause');
  if (!use_clause) return undefined;
  
  return extract_use_clause(use_clause, source_code, visibility, {
    start: { row: node.startPosition.row, column: node.startPosition.column },
    end: { row: node.endPosition.row, column: node.endPosition.column }
  });
}

/**
 * Extract use clause (handles various forms)
 */
function extract_use_clause(
  node: SyntaxNode,
  source_code: string,
  visibility: Visibility,
  range: { start: Position; end: Position }
): UseStatement | undefined {
  if (node.type === 'use_as_clause') {
    // use path as alias
    const path_node = node.childForFieldName('path');
    const alias_node = node.childForFieldName('alias');
    if (path_node && alias_node) {
      const path = extract_path(path_node, source_code);
      const alias = source_code.substring(alias_node.startIndex, alias_node.endIndex);
      return { path, alias, visibility, range };
    }
  } else if (node.type === 'use_list') {
    // use path::{item1, item2}
    const path_node = node.childForFieldName('path');
    if (path_node) {
      const path = extract_path(path_node, source_code);
      const items: UseItem[] = [];
      
      for (const child of node.children) {
        if (child.type === 'use_list') {
          // Nested list
          const nested_items = extract_use_list_items(child, source_code);
          items.push(...nested_items);
        }
      }
      
      return { path, is_group: true, items, visibility, range };
    }
  } else if (node.type === 'use_wildcard') {
    // use path::*
    const path_node = node.childForFieldName('path');
    if (path_node) {
      const path = extract_path(path_node, source_code);
      return { path, is_glob: true, visibility, range };
    }
  } else if (node.type === 'scoped_use_list') {
    // use path::{self, other}
    const path_node = node.childForFieldName('path');
    const list_node = node.childForFieldName('list');
    if (path_node && list_node) {
      const path = extract_path(path_node, source_code);
      const items = extract_use_list_items(list_node, source_code);
      return { path, is_group: true, items, visibility, range };
    }
  } else if (node.type === 'scoped_identifier' || node.type === 'identifier') {
    // Simple use path (e.g., std::collections::HashMap or just HashMap)
    const path = extract_path(node, source_code);
    if (path.length > 0) {
      return { path, visibility, range };
    }
  } else {
    // Try to extract path from any other node type
    const path = extract_path(node, source_code);
    if (path.length > 0) {
      return { path, visibility, range };
    }
  }
  
  return undefined;
}

/**
 * Extract path segments
 */
function extract_path(node: SyntaxNode, source_code: string): string[] {
  const segments: string[] = [];
  
  if (node.type === 'scoped_identifier') {
    // Recursive path like a::b::c
    const path_node = node.childForFieldName('path');
    const name_node = node.childForFieldName('name');
    
    if (path_node) {
      segments.push(...extract_path(path_node, source_code));
    }
    if (name_node) {
      segments.push(source_code.substring(name_node.startIndex, name_node.endIndex));
    }
  } else if (node.type === 'identifier') {
    segments.push(source_code.substring(node.startIndex, node.endIndex));
  } else if (node.type === 'self' || node.type === 'super' || node.type === 'crate') {
    segments.push(node.type);
  }
  
  return segments;
}

/**
 * Extract items from use list
 */
function extract_use_list_items(node: SyntaxNode, source_code: string): UseItem[] {
  const items: UseItem[] = [];
  
  for (const child of node.children) {
    if (child.type === 'use_as_clause') {
      const name_node = child.childForFieldName('name');
      const alias_node = child.childForFieldName('alias');
      if (name_node) {
        const name = source_code.substring(name_node.startIndex, name_node.endIndex);
        const alias = alias_node ? 
          source_code.substring(alias_node.startIndex, alias_node.endIndex) : 
          undefined;
        items.push({ name, alias });
      }
    } else if (child.type === 'identifier' || child.type === 'self') {
      const name = source_code.substring(child.startIndex, child.endIndex);
      items.push({ name });
    }
  }
  
  return items;
}

/**
 * Extract visibility modifier
 */
function extract_visibility(node: SyntaxNode, source_code: string): Visibility {
  const vis_node = node.childForFieldName('visibility');
  if (!vis_node) return 'private';
  
  const vis_text = source_code.substring(vis_node.startIndex, vis_node.endIndex);
  if (vis_text === 'pub') return 'pub';
  if (vis_text === 'pub(crate)') return 'pub(crate)';
  if (vis_text === 'pub(super)') return 'pub(super)';
  if (vis_text === 'pub(self)') return 'pub(self)';
  
  return 'private';
}

/**
 * Extract Rust exports (pub items)
 */
export function extract_rust_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // Check for pub items
    const vis_node = node.childForFieldName('visibility');
    if (vis_node && vis_node.type === 'visibility_modifier') {
      const vis_text = source_code.substring(vis_node.startIndex, vis_node.endIndex);
      if (vis_text.startsWith('pub')) {
        // Get the item name
        const name_node = node.childForFieldName('name');
        if (name_node) {
          const name = source_code.substring(name_node.startIndex, name_node.endIndex);
          exports.push({
            name,
            range: {
              start: { row: node.startPosition.row, column: node.startPosition.column },
              end: { row: node.endPosition.row, column: node.endPosition.column }
            }
          });
        }
      }
    }
    
    // Check for pub use (re-exports)
    if (node.type === 'use_declaration') {
      const vis_node = node.childForFieldName('visibility');
      if (vis_node) {
        const vis_text = source_code.substring(vis_node.startIndex, vis_node.endIndex);
        if (vis_text.startsWith('pub')) {
          // Extract re-exported items
          const use_clause = node.childForFieldName('clause');
          if (use_clause) {
            const re_exports = extract_re_exports(use_clause, source_code);
            for (const name of re_exports) {
              exports.push({
                name,
                range: {
                  start: { row: node.startPosition.row, column: node.startPosition.column },
                  end: { row: node.endPosition.row, column: node.endPosition.column }
                }
              });
            }
          }
        }
      }
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return exports;
}

/**
 * Extract re-exported names from use clause
 */
function extract_re_exports(node: SyntaxNode, source_code: string): string[] {
  const names: string[] = [];
  
  if (node.type === 'use_as_clause') {
    const alias_node = node.childForFieldName('alias');
    if (alias_node) {
      names.push(source_code.substring(alias_node.startIndex, alias_node.endIndex));
    } else {
      // Use the last segment of the path
      const path_node = node.childForFieldName('path');
      if (path_node) {
        const path = extract_path(path_node, source_code);
        if (path.length > 0) {
          names.push(path[path.length - 1]);
        }
      }
    }
  } else if (node.type === 'use_list' || node.type === 'scoped_use_list') {
    // Extract all items from the list
    const items = extract_use_list_items(node, source_code);
    for (const item of items) {
      names.push(item.alias || item.name);
    }
  } else {
    // Simple path - use last segment
    const path = extract_path(node, source_code);
    if (path.length > 0) {
      names.push(path[path.length - 1]);
    }
  }
  
  return names;
}

/**
 * Get Rust symbol kind from AST node
 */
export function get_rust_symbol_kind(node: SyntaxNode): string {
  switch (node.type) {
    case 'struct_item':
      return 'struct';
    case 'enum_item':
      return 'enum';
    case 'function_item':
      return 'function';
    case 'impl_item':
      return 'impl';
    case 'trait_item':
      return 'trait';
    case 'type_alias':
      return 'type';
    case 'const_item':
      return 'const';
    case 'static_item':
      return 'static';
    case 'mod_item':
      return 'module';
    case 'use_declaration':
      return 'import';
    case 'macro_definition':
      return 'macro';
    case 'let_declaration':
      return 'variable';
    case 'parameter':
      return 'parameter';
    case 'match_arm':
      return 'pattern';
    case 'closure_expression':
      return 'closure';
    default:
      return 'unknown';
  }
}