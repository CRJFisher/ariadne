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
  find_symbol_references,
  find_symbol_definition,
  go_to_definition,
  is_symbol_exported,
  get_all_visible_symbols,
  resolve_all_symbols,
  SymbolRegistry,
  build_symbol_registry,
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
} from './symbol_resolution.javascript';

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
} from './symbol_resolution.typescript';

// Python bespoke handlers
import {
  handle_python_legb,
  handle_global_nonlocal,
  handle_all_exports,
  handle_comprehension_scope,
  handle_python_decorators,
} from './symbol_resolution.python';

// Rust bespoke handlers
import {
  handle_module_paths,
  handle_use_statements,
  handle_impl_blocks,
  handle_trait_impls,
  handle_rust_macros,
  check_rust_visibility,
  handle_lifetime_parameters,
} from './symbol_resolution.rust';

// Symbol extraction
import { extract_symbols } from './symbol_extraction';

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
  SymbolRegistry,
  build_symbol_registry,
  build_symbol_index,
};

// Re-export global symbol table
export {
  GlobalSymbolTable,
  build_symbol_table,
};

// Re-export symbol extraction
export { extract_symbols };



