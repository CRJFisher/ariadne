/**
 * Symbol resolution feature - Configuration-driven dispatcher
 * 
 * Routes symbol resolution requests using configuration patterns
 * and language-specific bespoke handlers when needed.
 */

import { Language, Def, Ref, Position, SymbolId, FunctionCallInfo, MethodCallInfo, ConstructorCallInfo } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import { ScopeTree } from '../scope_tree';

// Core generic processor and types
import {
  MODULE_CONTEXT,
  ResolvedSymbol,
  ResolutionContext,
  DefinitionResult,
  FileResolutionContext,
  ImportInfo,
  ExportInfo,
  create_resolution_context,
  resolve_symbol_at_position,
  resolve_symbol,
  find_symbol_references,
  find_symbol_definition,
  go_to_definition,
  is_symbol_exported,
  get_all_visible_symbols,
  resolve_all_symbols,
  resolve_function_call,
  resolve_method_call,
  resolve_constructor_call,
} from './symbol_resolution';

// Language configurations
import {
  get_symbol_resolution_config,
  requires_bespoke_handling,
  get_bespoke_handler,
} from './language_configs';

// Global symbol table
import {
  GlobalSymbolTable,
  build_symbol_table,
} from './global_symbol_table';

// JavaScript bespoke handlers
import {
  handle_javascript_hoisting,
  handle_prototype_chain,
  handle_this_binding,
  handle_super_binding,
  handle_var_hoisting,
} from './symbol_resolution.javascript.bespoke';

// TypeScript bespoke handlers (includes JavaScript handlers)
import {
  handle_type_only_imports,
  handle_interface_merging,
  handle_namespaces,
  handle_decorators as handle_typescript_decorators,
  handle_ambient_declarations,
  handle_generic_parameters,
  handle_enum_members,
  handle_type_aliases,
} from './symbol_resolution.typescript.bespoke';

// Python bespoke handlers
import {
  handle_python_legb,
  handle_global_nonlocal,
  handle_all_exports,
  handle_comprehension_scope,
  handle_python_decorators,
} from './symbol_resolution.python.bespoke';

// Rust bespoke handlers
import {
  handle_module_paths,
  handle_use_statements,
  handle_impl_blocks,
  handle_trait_impls,
  handle_rust_macros,
  check_rust_visibility,
  handle_lifetime_parameters,
} from './symbol_resolution.rust.bespoke';

// Re-export core types and functions
export {
  MODULE_CONTEXT,
  ResolvedSymbol,
  ResolutionContext,
  DefinitionResult,
  FileResolutionContext,
  ImportInfo,
  ExportInfo,
  create_resolution_context,
  resolve_symbol_at_position,
  find_symbol_references,
  find_symbol_definition,
  go_to_definition,
  is_symbol_exported,
  get_all_visible_symbols,
  resolve_all_symbols,
};

// Re-export global symbol table
export {
  GlobalSymbolTable,
  build_symbol_table,
};

/**
 * Main entry point for symbol resolution with language-specific dispatch
 */
export function resolve_symbol_with_language(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const { language } = context;
  const config = get_symbol_resolution_config(language);
  
  // Try generic resolution first
  let result = resolve_symbol(symbol_name, scope_id, context);
  
  // If not found and bespoke handling is configured, try language-specific resolution
  if (!result) {
    result = resolve_with_bespoke_handlers(symbol_name, scope_id, context, language);
  }
  
  return result;
}

/**
 * Resolve using language-specific bespoke handlers
 */
function resolve_with_bespoke_handlers(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext,
  language: Language
): ResolvedSymbol | undefined {
  // Create file resolution context for bespoke handlers
  const file_context: FileResolutionContext = {
    file_analysis: {
      file_path: context.file_path,
      language: context.language,
      scopes: context.scope_tree,
      definitions: [],
      references: [],
      function_calls: [],
      method_calls: [],
      constructor_calls: [],
      imports: [],
      exports: [],
      call_chain_heads: [],
    },
    global_symbols: new Map(),
    imports_by_file: new Map(),
    exports_by_file: new Map(),
    language,
    config: context.config,
  };
  
  switch (language) {
    case 'javascript':
    case 'jsx':
      return resolve_javascript_bespoke(symbol_name, scope_id, file_context);
    
    case 'typescript':
    case 'tsx':
      return resolve_typescript_bespoke(symbol_name, scope_id, file_context);
    
    case 'python':
      return resolve_python_bespoke(symbol_name, scope_id, file_context);
    
    case 'rust':
      return resolve_rust_bespoke(symbol_name, scope_id, file_context);
    
    default:
      return undefined;
  }
}

/**
 * JavaScript bespoke resolution
 */
function resolve_javascript_bespoke(
  symbol_name: string,
  scope_id: string,
  context: FileResolutionContext
): ResolvedSymbol | undefined {
  // Handle 'this' keyword
  if (symbol_name === 'this') {
    return handle_this_binding(scope_id, context);
  }
  
  // Handle 'super' keyword
  if (symbol_name === 'super') {
    return handle_super_binding(scope_id, context);
  }
  
  // Try hoisting resolution
  let symbol_id = handle_javascript_hoisting(symbol_name, scope_id, context);
  if (symbol_id) {
    return { symbol_id, kind: 'function' };
  }
  
  // Try var hoisting
  symbol_id = handle_var_hoisting(symbol_name, scope_id, context);
  if (symbol_id) {
    return { symbol_id, kind: 'variable' };
  }
  
  return undefined;
}

/**
 * TypeScript bespoke resolution
 */
function resolve_typescript_bespoke(
  symbol_name: string,
  scope_id: string,
  context: FileResolutionContext
): ResolvedSymbol | undefined {
  // First try JavaScript resolution (TypeScript is a superset)
  let result = resolve_javascript_bespoke(symbol_name, scope_id, context);
  if (result) return result;
  
  // Try type-only imports
  let symbol_id = handle_type_only_imports(symbol_name, context);
  if (symbol_id) {
    return { symbol_id, kind: 'type' };
  }
  
  // Try type aliases
  symbol_id = handle_type_aliases(symbol_name, context);
  if (symbol_id) {
    return { symbol_id, kind: 'type' };
  }
  
  // Handle interface merging
  const merged = handle_interface_merging(symbol_name, context);
  if (merged.length > 0) {
    return merged[0]; // Return first merged interface
  }
  
  return undefined;
}

/**
 * Python bespoke resolution
 */
function resolve_python_bespoke(
  symbol_name: string,
  scope_id: string,
  context: FileResolutionContext
): ResolvedSymbol | undefined {
  // Use LEGB rule for Python
  const symbol_id = handle_python_legb(symbol_name, scope_id, context);
  if (symbol_id) {
    return { symbol_id, kind: 'variable' };
  }
  
  return undefined;
}

/**
 * Rust bespoke resolution
 */
function resolve_rust_bespoke(
  symbol_name: string,
  scope_id: string,
  context: FileResolutionContext
): ResolvedSymbol | undefined {
  // Try use statement resolution
  let symbol_id = handle_use_statements(symbol_name, scope_id, context);
  if (symbol_id) {
    return { symbol_id, kind: 'variable' };
  }
  
  // Try macro resolution
  symbol_id = handle_rust_macros(symbol_name, context);
  if (symbol_id) {
    return { symbol_id, kind: 'macro' };
  }
  
  // Parse module paths if symbol contains ::
  if (symbol_name.includes('::')) {
    const path = symbol_name.split('::');
    symbol_id = handle_module_paths(path, context);
    if (symbol_id) {
      return { symbol_id, kind: 'module' };
    }
  }
  
  return undefined;
}

/**
 * Enhanced function call resolution with bespoke handling
 */
export function resolve_function_call_enhanced(
  call: FunctionCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  // Try generic resolution
  let result = resolve_function_call(call, context);
  if (result) return result;
  
  // Try bespoke handling based on language
  const { language } = context;
  
  if (language === 'javascript' || language === 'jsx' || 
      language === 'typescript' || language === 'tsx') {
    // Check for hoisted functions
    result = handle_javascript_hoisting(call.callee_name, 'module', context);
    if (result) return result;
  }
  
  if (language === 'python') {
    // Use LEGB rule
    result = handle_python_legb(call.callee_name, 'module', context);
    if (result) return result;
  }
  
  if (language === 'rust') {
    // Check for macro calls
    if (call.callee_name.endsWith('!')) {
      result = handle_rust_macros(call.callee_name, context);
      if (result) return result;
    }
  }
  
  return undefined;
}

/**
 * Enhanced method call resolution with bespoke handling
 */
export function resolve_method_call_enhanced(
  call: MethodCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  // Try generic resolution
  let result = resolve_method_call(call, context);
  if (result) return result;
  
  // Try bespoke handling based on language
  const { language } = context;
  
  if (language === 'javascript' || language === 'jsx' || 
      language === 'typescript' || language === 'tsx') {
    // Check prototype chain
    if (call.object_name) {
      result = handle_prototype_chain(call.object_name, call.method_name, 'module', context);
      if (result) return result;
    }
  }
  
  if (language === 'rust') {
    // Check impl blocks
    if (call.object_name) {
      result = handle_impl_blocks(call.object_name, call.method_name, context);
      if (result) return result;
    }
  }
  
  return undefined;
}

/**
 * High-level API: Resolve symbol at cursor position
 */
export function resolve_at_cursor(
  position: Position,
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string,
  imports?: ImportInfo[],
  exports?: ExportInfo[],
  module_graph?: any
): ResolvedSymbol | undefined {
  const context = create_resolution_context(
    scope_tree,
    language,
    file_path,
    root_node,
    source_code,
    imports,
    exports,
    module_graph
  );
  
  return resolve_symbol_at_position(position, context);
}

/**
 * High-level API: Find all references to a symbol
 */
export function find_all_references(
  symbol_name: string,
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string,
  imports?: ImportInfo[],
  module_graph?: any
): Ref[] {
  const refs: Ref[] = [];
  
  // Search through all scopes for references to this symbol
  for (const [scope_id, scope] of scope_tree.nodes) {
    // Check if this scope references the symbol
    if (scope.symbols.has(symbol_name)) {
      const symbol = scope.symbols.get(symbol_name)!;
      // Create a Ref for each occurrence
      const ref: Ref = {
        id: `ref_${scope_id}_${symbol_name}`,
        kind: 'reference',
        name: symbol_name,
        range: symbol.range || { 
          start: { row: 0, column: 0 }, 
          end: { row: 0, column: 0 } 
        },
        file_path
      };
      refs.push(ref);
    }
  }
  
  return refs;
}

/**
 * Check if a feature requires bespoke handling
 */
export function needs_bespoke_handler(feature: string, language: Language): boolean {
  return requires_bespoke_handling(feature, language);
}

/**
 * Get the appropriate bespoke handler for a feature
 */
export function get_handler_for_feature(feature: string, language: Language): string | undefined {
  return get_bespoke_handler(feature, language);
}