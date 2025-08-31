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
  ImportInfo,
  ExportInfo,
  resolve_symbol_at_position,
  resolve_symbol,
  find_symbol_references,
  find_symbol_definition,
  get_all_visible_symbols,
  is_symbol_exported,
  resolve_symbol_with_type
} from './symbol_resolution';
import {
  resolve_javascript_symbol,
  JavaScriptResolutionContext
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

// Re-export core types and functions
export {
  ResolvedSymbol,
  ResolutionContext,
  ImportInfo,
  ExportInfo,
  resolve_symbol_at_position,
  find_symbol_references,
  find_symbol_definition,
  get_all_visible_symbols,
  is_symbol_exported,
  resolve_symbol_with_type
};

// Re-export language-specific types
export {
  JavaScriptResolutionContext,
  TypeScriptResolutionContext,
  PythonResolutionContext,
  RustResolutionContext
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

/**
 * Create language-specific resolution context
 */
export function create_resolution_context(
  scope_tree: ScopeTree,
  language: Language,
  file_path?: string,
  root_node?: SyntaxNode,
  source_code?: string,
  imports?: ImportInfo[], // From import_resolution - Layer 1
  exports?: ExportInfo[] // From export_detection - Layer 2
): ResolutionContext {
  const base_context: ResolutionContext = {
    scope_tree,
    file_path
  };
  
  // Add language-specific context
  switch (language) {
    case 'javascript':
    case 'jsx': {
      const js_context: JavaScriptResolutionContext = {
        ...base_context,
        hoisted_symbols: new Map(),
        closure_scopes: new Map(),
        prototype_chains: new Map(),
        this_bindings: new Map()
      };
      
      // Use imports/exports from Layer 1/2 instead of extracting
      if (imports) {
        js_context.imports = imports;
      }
      if (exports) {
        js_context.exports = exports;
      }
      
      return js_context;
    }
    
    case 'typescript':
    case 'tsx': {
      const ts_context: TypeScriptResolutionContext = {
        ...base_context,
        hoisted_symbols: new Map(),
        closure_scopes: new Map(),
        prototype_chains: new Map(),
        this_bindings: new Map(),
        type_parameters: new Map(),
        interfaces: new Map(),
        type_aliases: new Map(),
        namespaces: new Map()
      };
      
      // Use imports/exports from Layer 1/2 instead of extracting
      if (imports) {
        ts_context.imports = imports;
      }
      if (exports) {
        ts_context.exports = exports;
      }
      
      return ts_context;
    }
    
    case 'python': {
      const py_context: PythonResolutionContext = {
        ...base_context,
        builtins: undefined,  // Will use default PYTHON_BUILTINS
        global_declarations: new Map(),
        nonlocal_declarations: new Map()
      };
      
      // Use imports/exports from Layer 1/2 instead of extracting
      if (imports) {
        py_context.imports = imports;
      }
      if (exports) {
        py_context.exports = exports;
        
        // Extract global/nonlocal declarations if AST is provided
        if (root_node && source_code) {
          const declarations = extract_python_declarations(root_node, source_code, scope_tree);
          py_context.global_declarations = declarations.global_declarations;
          py_context.nonlocal_declarations = declarations.nonlocal_declarations;
        }
      }
      
      return py_context;
    }
    
    case 'rust': {
      const rust_context: RustResolutionContext = {
        ...base_context,
        use_statements: [],
        impl_blocks: [],
        trait_impls: [],
        visibility_modifiers: new Map()
      };
      
      // Use imports/exports from Layer 1/2 instead of extracting
      if (imports) {
        // Convert ImportInfo to use statements for Rust
        rust_context.use_statements = imports.map(imp => ({
          path: imp.module_path.split('::'),
          alias: imp.source_name,
          is_glob: imp.is_namespace || false,
          is_group: false,
          range: imp.range
        }));
      }
      if (exports) {
        rust_context.exports = exports;
      }
      
      return rust_context;
    }
    
    default:
      return base_context;
  }
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
  const context = create_resolution_context(
    scope_tree,
    language,
    file_path,
    root_node,
    source_code
  );
  
  return find_symbol_references(symbol_name, context);
}

/**
 * High-level API: Go to definition
 */
export function go_to_definition(
  symbol_name: string,
  scope_id: string,
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string,
  imports?: any[], // From import_resolution - Layer 1
  module_graph?: any // From module_graph - Layer 4
): Def | undefined {
  const context = create_resolution_context(
    scope_tree,
    language,
    file_path,
    root_node,
    source_code
  );
  
  return find_symbol_definition(symbol_name, scope_id, context);
}