/**
 * Symbol resolution feature - Dispatcher
 * 
 * Routes symbol resolution requests to language-specific implementations
 */

import { Language, Def, Ref, Position } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import { ScopeTree } from '../scope_tree';
import {
  ResolvedSymbol,
  ResolutionContext,
  DefinitionResult,
  create_resolution_context,
  resolve_symbol_at_position,
  resolve_symbol,
  find_symbol_references,
  find_symbol_definition,
  get_all_visible_symbols,
  is_symbol_exported,
  resolve_symbol_with_type,
  go_to_definition,
  find_definition_at_position,
  find_all_definitions,
  find_definitions_by_kind,
  find_exported_definitions,
  is_definition_visible,
  go_to_definition_from_ref,
  find_definition_candidates,
  resolve_all_symbols
} from './symbol_resolution';
import {
  resolve_javascript_symbol,
  JavaScriptResolutionContext,
  find_constructor_definition,
  find_prototype_method,
  find_object_property,
  find_arrow_function,
  find_all_functions,
  find_all_classes,
  is_hoisted_definition,
  find_module_exports
} from './symbol_resolution.javascript';
import {
  resolve_typescript_symbol,
  TypeScriptResolutionContext
} from './symbol_resolution.typescript';
import {
  resolve_python_symbol,
  extract_python_declarations,
  PythonResolutionContext
} from './symbol_resolution.python';
import {
  resolve_rust_symbol,
  RustResolutionContext
} from './symbol_resolution.rust';
import {
  build_symbol_table,
  GlobalSymbolTable
} from './global_symbol_table';

// Re-export core types and functions
export {
  ResolvedSymbol,
  ResolutionContext,
  DefinitionResult,
  create_resolution_context,
  resolve_symbol_at_position,
  find_symbol_references,
  find_symbol_definition,
  get_all_visible_symbols,
  is_symbol_exported,
  resolve_symbol_with_type,
  go_to_definition,
  find_definition_at_position,
  find_all_definitions,
  find_definitions_by_kind,
  find_exported_definitions,
  is_definition_visible,
  go_to_definition_from_ref,
  find_definition_candidates,
  resolve_all_symbols
};

// Re-export global symbol table
export {
  GlobalSymbolTable,
  build_symbol_table
};

// Re-export language-specific types
export {
  JavaScriptResolutionContext,
  TypeScriptResolutionContext,
  PythonResolutionContext,
  RustResolutionContext
};

// Re-export JavaScript-specific functions (from definition_finder)
export {
  find_constructor_definition,
  find_prototype_method,
  find_object_property,
  find_arrow_function,
  find_all_functions,
  find_all_classes,
  is_hoisted_definition,
  find_module_exports
};

/**
 * Resolve symbol with language-specific handling
 */
export function resolve_symbol_with_language(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext,
  language: Language,
  imports?: any[], // From import_resolution - Layer 1
  module_graph?: any // From module_graph - Layer 4
): ResolvedSymbol | undefined {
  switch (language) {
    case 'javascript':
    case 'jsx':
      return resolve_javascript_symbol(symbol_name, scope_id, context as JavaScriptResolutionContext);
    
    case 'typescript':
    case 'tsx':
      return resolve_typescript_symbol(symbol_name, scope_id, context as TypeScriptResolutionContext);
    
    case 'python':
      return resolve_python_symbol(symbol_name, scope_id, context as PythonResolutionContext);
    
    case 'rust':
      return resolve_rust_symbol(symbol_name, scope_id, context as RustResolutionContext);
    
    default:
      // Fall back to generic resolution
      return resolve_symbol(symbol_name, scope_id, context);
  }
}

// Import/export extraction is now handled by import_resolution and export_detection modules
// This maintains proper architectural layering - extraction happens in Per-File Analysis (Layers 1-2)

// Removed duplicate create_resolution_context - it's defined in symbol_resolution.ts

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
  imports?: ImportInfo[], // From import_resolution - Layer 1
  exports?: ExportInfo[], // From export_detection - Layer 2
  module_graph?: any // From module_graph - Layer 4
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
  imports?: any[], // From import_resolution - Layer 1
  module_graph?: any // From module_graph - Layer 4
): Ref[] {
  // For now, return empty array since we don't have FileAnalysis[] 
  // This would need proper implementation with actual file analysis
  // The old find_symbol_references expects FileAnalysis[] which we don't have here
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

// Removed duplicate go_to_definition - it's defined in symbol_resolution.ts