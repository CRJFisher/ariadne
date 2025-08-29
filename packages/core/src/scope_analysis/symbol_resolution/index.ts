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
  extract_es6_imports,
  extract_commonjs_imports,
  extract_es6_exports,
  extract_commonjs_exports,
  JavaScriptResolutionContext
} from './symbol_resolution.javascript';
import {
  resolve_typescript_symbol,
  extract_typescript_imports,
  extract_typescript_exports,
  TypeScriptResolutionContext
} from './symbol_resolution.typescript';
import {
  resolve_python_symbol,
  extract_python_imports,
  extract_python_exports,
  extract_python_declarations,
  PythonResolutionContext
} from './symbol_resolution.python';
import {
  resolve_rust_symbol,
  extract_rust_use_statements,
  extract_rust_exports,
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

/**
 * Extract imports with language-specific handling
 */
export function extract_imports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string // For relative import resolution
): ImportInfo[] {
  switch (language) {
    case 'javascript':
    case 'jsx': {
      const imports: ImportInfo[] = [];
      imports.push(...extract_es6_imports(root_node, source_code));
      imports.push(...extract_commonjs_imports(root_node, source_code));
      return imports;
    }
    
    case 'typescript':
    case 'tsx':
      return extract_typescript_imports(root_node, source_code);
    
    case 'python':
      return extract_python_imports(root_node, source_code);
    
    case 'rust': {
      // Convert use statements to ImportInfo
      const use_statements = extract_rust_use_statements(root_node, source_code);
      const imports: ImportInfo[] = [];
      
      for (const stmt of use_statements) {
        if (stmt.is_group && stmt.items) {
          // Expand grouped imports (e.g., use std::io::{Read, Write})
          for (const item of stmt.items) {
            imports.push({
              name: item.alias || item.name,
              module_path: stmt.path.join('::'),
              is_namespace: false,
              range: stmt.range
            });
          }
        } else {
          // Single import
          imports.push({
            name: stmt.alias || stmt.path[stmt.path.length - 1],
            module_path: stmt.path.join('::'),
            is_namespace: stmt.is_glob,
            range: stmt.range
          });
        }
      }
      
      return imports;
    }
    
    default:
      return [];
  }
}

/**
 * Extract exports with language-specific handling
 */
export function extract_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string // For export tracking
): ExportInfo[] {
  switch (language) {
    case 'javascript':
    case 'jsx': {
      const exports: ExportInfo[] = [];
      exports.push(...extract_es6_exports(root_node, source_code));
      exports.push(...extract_commonjs_exports(root_node, source_code));
      return exports;
    }
    
    case 'typescript':
    case 'tsx':
      return extract_typescript_exports(root_node, source_code);
    
    case 'python':
      return extract_python_exports(root_node, source_code);
    
    case 'rust':
      return extract_rust_exports(root_node, source_code);
    
    default:
      return [];
  }
}

/**
 * Create language-specific resolution context
 */
export function create_resolution_context(
  scope_tree: ScopeTree,
  language: Language,
  file_path?: string,
  root_node?: SyntaxNode,
  source_code?: string,
  imports?: any[], // From import_resolution - Layer 1
  module_graph?: any // From module_graph - Layer 4
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
      
      // Extract imports/exports if AST is provided
      if (root_node && source_code) {
        js_context.imports = extract_imports(root_node, source_code, language);
        js_context.exports = extract_exports(root_node, source_code, language);
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
      
      // Extract imports/exports if AST is provided
      if (root_node && source_code) {
        ts_context.imports = extract_imports(root_node, source_code, language);
        ts_context.exports = extract_exports(root_node, source_code, language);
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
      
      // Extract imports/exports and declarations if AST is provided
      if (root_node && source_code) {
        py_context.imports = extract_imports(root_node, source_code, language);
        py_context.exports = extract_exports(root_node, source_code, language);
        
        // Extract global/nonlocal declarations
        const declarations = extract_python_declarations(root_node, source_code, scope_tree);
        py_context.global_declarations = declarations.global_declarations;
        py_context.nonlocal_declarations = declarations.nonlocal_declarations;
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
      
      // Extract use statements and exports if AST is provided
      if (root_node && source_code) {
        rust_context.use_statements = extract_rust_use_statements(root_node, source_code);
        rust_context.exports = extract_exports(root_node, source_code, language);
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
  imports?: any[], // From import_resolution - Layer 1
  module_graph?: any // From module_graph - Layer 4
): ResolvedSymbol | undefined {
  const context = create_resolution_context(
    scope_tree,
    language,
    file_path,
    root_node,
    source_code
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