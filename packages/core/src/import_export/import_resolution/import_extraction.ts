/**
 * Import extraction from AST
 * 
 * Extracts import statements from the AST during Per-File Analysis (Layer 2).
 * This was moved from symbol_resolution to maintain proper layer dependencies.
 * 
 * Layer 2 (import_resolution) extracts imports from AST
 * Layer 8 (symbol_resolution) consumes extracted imports
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, ImportInfo, Location } from '@ariadnejs/types';

/**
 * Extract all imports from AST
 * 
 * Main entry point that dispatches to language-specific extractors
 */
export function extract_imports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string
): ImportInfo[] {
  switch (language) {
    case 'javascript':
      return extract_javascript_imports(root_node, source_code);
    
    case 'typescript':
      return extract_typescript_imports(root_node, source_code);
    
    case 'python':
      return extract_python_imports(root_node, source_code);
    
    case 'rust':
      return extract_rust_imports(root_node, source_code);
    
    default:
      return [];
  }
}

/**
 * Extract JavaScript imports (ES6 and CommonJS)
 */
export function extract_javascript_imports(
  root_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // ES6 imports
    if (node.type === 'import_statement') {
      const es6_imports = extract_es6_import(node, source_code);
      if (es6_imports) imports.push(...es6_imports);
    }
    
    // CommonJS require
    if (node.type === 'call_expression') {
      const commonjs = extract_commonjs_require(node, source_code);
      if (commonjs) imports.push(commonjs);
    }
    
    // Dynamic import()
    if (node.type === 'import' && node.parent?.type === 'call_expression') {
      const dynamic = extract_dynamic_import(node.parent, source_code);
      if (dynamic) imports.push(dynamic);
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return imports;
}

/**
 * Extract TypeScript imports (includes type-only imports)
 */
export function extract_typescript_imports(
  root_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const processed_nodes = new Set<SyntaxNode>();
  
  const visit = (node: SyntaxNode) => {
    // Handle import statements
    if (node.type === 'import_statement' && !processed_nodes.has(node)) {
      processed_nodes.add(node);
      const ts_imports = extract_typescript_import(node, source_code);
      if (ts_imports) imports.push(...ts_imports);
    }
    
    // Handle CommonJS require (same as JavaScript)
    if (node.type === 'call_expression') {
      const commonjs = extract_commonjs_require(node, source_code);
      if (commonjs) imports.push(commonjs);
    }
    
    // Handle dynamic import()
    if (node.type === 'import' && node.parent?.type === 'call_expression') {
      const dynamic = extract_dynamic_import(node.parent, source_code);
      if (dynamic) imports.push(dynamic);
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return imports;
}

/**
 * Extract Python imports
 */
export function extract_python_imports(
  root_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // import foo, bar
    if (node.type === 'import_statement') {
      const module_imports = extract_python_import(node, source_code);
      if (module_imports) imports.push(...module_imports);
    }
    
    // from foo import bar
    if (node.type === 'import_from_statement') {
      const from_imports = extract_python_from_import(node, source_code);
      if (from_imports) imports.push(...from_imports);
    }
    
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return imports;
}

/**
 * Extract Rust imports (use statements)
 */
export function extract_rust_imports(
  root_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // use statements
    if (node.type === 'use_declaration') {
      const use_imports = extract_rust_use(node, source_code);
      if (use_imports) imports.push(...use_imports);
    }
    
    // extern crate
    if (node.type === 'extern_crate_declaration') {
      const extern_import = extract_rust_extern_crate(node, source_code);
      if (extern_import) imports.push(extern_import);
    }
    
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return imports;
}

// --- Helper functions for TypeScript ---

function extract_typescript_import(
  import_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const source_node = import_node.childForFieldName('source');
  if (!source_node) return imports;
  
  const module_source = extract_string_literal(source_node, source_code);
  
  // Check if this is a type-only import at the statement level
  // Pattern: import type { ... } from '...' or import type * as ... from '...'
  let statement_level_type = false;
  // The 'type' keyword appears as a direct child of import_statement after 'import'
  const children = import_node.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].type === 'import' && 
        i + 1 < children.length && 
        children[i + 1].type === 'type') {
      statement_level_type = true;
      break;
    }
  }
  
  // Find import_clause - it might be a field or just a child when 'type' keyword is present
  let import_clause = import_node.childForFieldName('import_clause');
  if (!import_clause) {
    // When there's a 'type' keyword, import_clause is a child but not a field
    import_clause = import_node.children.find(c => c.type === 'import_clause') || null;
  }
  
  if (!import_clause) {
    // Side-effect import: import './styles.css'
    return [{
      name: '<side-effect>',
      source: module_source,
      kind: 'dynamic',
      location: node_to_location(import_node)
    }];
  }
  
  // Process import clause
  for (const child of import_clause.children) {
    if (child.type === 'identifier') {
      // Default import: import foo from './foo' or import type Foo from './foo'
      imports.push({
        name: child.text,
        source: module_source,
        kind: 'default',
        is_type_only: statement_level_type,
        location: node_to_location(child)
      });
    } else if (child.type === 'namespace_import') {
      // Namespace import: import * as foo from './foo' or import type * as foo from './foo'
      // The identifier is a child, not a field
      const identifier_node = child.children.find(c => c.type === 'identifier');
      if (identifier_node) {
        imports.push({
          name: identifier_node.text,
          source: module_source,
          kind: 'namespace',
          namespace_name: identifier_node.text,
          is_type_only: statement_level_type,
          location: node_to_location(child)
        });
      }
    } else if (child.type === 'named_imports') {
      // Named imports with potential inline type modifiers
      const specs = extract_typescript_import_specifiers(child, source_code, statement_level_type);
      for (const spec of specs) {
        imports.push({
          name: spec.name,
          source: module_source,
          alias: spec.alias,
          kind: 'named',
          is_type_only: spec.is_type_only,
          location: node_to_location(child)
        });
      }
    }
  }
  
  return imports;
}

function extract_typescript_import_specifiers(
  named_imports: SyntaxNode,
  source_code: string,
  statement_level_type: boolean
): Array<{ name: string; alias?: string; is_type_only: boolean }> {
  const specifiers: Array<{ name: string; alias?: string; is_type_only: boolean }> = [];
  
  for (const child of named_imports.children) {
    if (child.type === 'import_specifier') {
      // Check for inline type modifier (TS 4.5+)
      // Pattern: import { type Foo, Bar } from '...'
      let inline_type = false;
      let actual_name_node: SyntaxNode | null = null;
      let actual_alias_node: SyntaxNode | null = null;
      
      // Check if first child is 'type' keyword
      const first_child = child.children[0];
      if (first_child && first_child.type === 'type') {
        inline_type = true;
        // The identifier comes after the type keyword
        actual_name_node = child.children.find(c => c.type === 'identifier') || null;
      } else {
        // Normal import specifier
        actual_name_node = child.childForFieldName('name');
      }
      
      actual_alias_node = child.childForFieldName('alias');
      
      if (actual_name_node) {
        specifiers.push({
          name: actual_alias_node?.text || actual_name_node.text,
          alias: actual_alias_node ? actual_name_node.text : undefined,
          is_type_only: statement_level_type || inline_type
        });
      }
    } else if (child.type === 'identifier') {
      // Simple identifier without specifier wrapper
      specifiers.push({ 
        name: child.text,
        is_type_only: statement_level_type
      });
    }
  }
  
  return specifiers;
}

// --- Helper functions for ES6/JavaScript ---

function extract_es6_import(
  import_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const source_node = import_node.childForFieldName('source');
  if (!source_node) return imports;
  
  const module_source = extract_string_literal(source_node, source_code);
  const import_clause = import_node.childForFieldName('import_clause');
  
  if (!import_clause) {
    // Side-effect import: import './styles.css'
    return [{
      name: '<side-effect>',
      source: module_source,
      kind: 'dynamic',
      location: node_to_location(import_node)
    }];
  }
  
  // Process import clause
  for (const child of import_clause.children) {
    if (child.type === 'identifier') {
      // Default import: import foo from './foo'
      imports.push({
        name: child.text,
        source: module_source,
        kind: 'default',
        location: node_to_location(child)
      });
    } else if (child.type === 'namespace_import') {
      // Namespace import: import * as foo from './foo'
      const alias_node = child.childForFieldName('alias');
      if (alias_node) {
        imports.push({
          name: alias_node.text,
          source: module_source,
          kind: 'namespace',
          namespace_name: alias_node.text,
          location: node_to_location(child)
        });
      }
    } else if (child.type === 'named_imports') {
      // Named imports: import { foo, bar as baz } from './foo'
      const specs = extract_import_specifiers(child, source_code);
      for (const spec of specs) {
        imports.push({
          name: spec.name,
          source: module_source,
          alias: spec.alias,
          kind: 'named',
          location: node_to_location(child)
        });
      }
    }
  }
  
  return imports;
}

function extract_commonjs_require(
  call_node: SyntaxNode,
  source_code: string
): ImportInfo | null {
  const func = call_node.childForFieldName('function');
  if (!func || func.text !== 'require') return null;
  
  const args = call_node.childForFieldName('arguments');
  if (!args) return null;
  
  const first_arg = args.children.find(child => 
    child.type === 'string' || child.type === 'template_string'
  );
  if (!first_arg) return null;
  
  const module_source = extract_string_literal(first_arg, source_code);
  
  // Check for assignment: const foo = require('./foo')
  const parent = call_node.parent;
  if (parent?.type === 'variable_declarator') {
    const name_node = parent.childForFieldName('name');
    if (name_node) {
      if (name_node.type === 'identifier') {
        return {
          name: name_node.text,
          source: module_source,
          kind: 'named',
          location: node_to_location(call_node)
        };
      } else if (name_node.type === 'object_pattern') {
        // Destructuring: const { foo, bar } = require('./module')
        const names = extract_destructured_names(name_node, source_code);
        return {
          name: `{${names.join(',')}}`,
          source: module_source,
          kind: 'named',
          location: node_to_location(call_node)
        };
      }
    }
  }
  
  return {
    name: '<require>',
    source: module_source,
    kind: 'dynamic',
    location: node_to_location(call_node)
  };
}

function extract_dynamic_import(
  call_node: SyntaxNode,
  source_code: string
): ImportInfo | null {
  const args = call_node.childForFieldName('arguments');
  if (!args) return null;
  
  const first_arg = args.children.find(child => 
    child.type === 'string' || child.type === 'template_string'
  );
  if (!first_arg) return null;
  
  return {
    name: '<dynamic>',
    source: extract_string_literal(first_arg, source_code),
    kind: 'dynamic',
    location: node_to_location(call_node)
  };
}

// --- Helper functions for Python ---

function extract_python_import(
  import_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  // Find aliased_import or dotted_name nodes
  for (const child of import_node.children) {
    if (child.type === 'aliased_import') {
      const name = child.childForFieldName('name');
      const alias = child.childForFieldName('alias');
      if (name) {
        // import module as alias - the alias becomes a namespace binding
        imports.push({
          name: alias?.text || name.text,
          alias: alias ? name.text : undefined,
          source: name.text,
          kind: 'namespace',  // Python module imports are namespaces
          namespace_name: alias?.text || name.text,
          location: node_to_location(child)
        });
      }
    } else if (child.type === 'dotted_name' || child.type === 'identifier') {
      // import module - creates a namespace binding
      imports.push({
        name: child.text,
        source: child.text,
        kind: 'namespace',  // Python treats module imports as namespaces
        namespace_name: child.text,
        location: node_to_location(child)
      });
    }
  }
  
  return imports;
}

function extract_python_from_import(
  import_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const module = import_node.childForFieldName('module');
  if (!module) return imports;
  
  const source = module.text;
  
  // Find what's being imported
  for (const child of import_node.children) {
    if (child.type === 'import_from_as_names') {
      // from foo import bar, baz as qux
      for (const spec of child.children) {
        if (spec.type === 'import_from_as_name') {
          const name = spec.childForFieldName('name');
          const alias = spec.childForFieldName('alias');
          if (name) {
            imports.push({
              name: alias?.text || name.text,
              alias: alias ? name.text : undefined,
              source,
              kind: 'named',
              location: node_to_location(spec)
            });
          }
        } else if (spec.type === 'identifier') {
          imports.push({
            name: spec.text,
            source,
            kind: 'named',
            location: node_to_location(spec)
          });
        }
      }
    } else if (child.type === 'wildcard_import') {
      // from foo import *
      imports.push({
        name: '*',
        source,
        kind: 'namespace',
        namespace_name: '*',
        location: node_to_location(child)
      });
    }
  }
  
  return imports;
}

// --- Helper functions for Rust ---

function extract_rust_use(
  use_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const use_tree = use_node.childForFieldName('use_tree');
  if (!use_tree) return imports;
  
  const extract_from_tree = (tree: SyntaxNode, prefix: string = ''): void => {
    if (tree.type === 'scoped_identifier') {
      const path = tree.childForFieldName('path');
      const name = tree.childForFieldName('name');
      if (path && name) {
        const full_path = prefix ? `${prefix}::${path.text}` : path.text;
        imports.push({
          name: name.text,
          source: full_path,
          kind: 'named',
          location: node_to_location(tree)
        });
      }
    } else if (tree.type === 'use_list') {
      // use std::{io, fs}
      const parent_path = tree.parent?.childForFieldName('path');
      const base = parent_path ? parent_path.text : prefix;
      
      for (const child of tree.children) {
        if (child.type === 'use' || child.type === 'scoped_identifier' || child.type === 'identifier') {
          extract_from_tree(child, base);
        }
      }
    } else if (tree.type === 'use_as_clause') {
      // use foo as bar
      const name = tree.childForFieldName('name');
      const alias = tree.childForFieldName('alias');
      if (name) {
        imports.push({
          name: alias?.text || name.text,
          alias: alias ? name.text : undefined,
          source: prefix || name.text,
          kind: 'named',
          location: node_to_location(tree)
        });
      }
    } else if (tree.type === 'use_wildcard') {
      // use foo::*
      imports.push({
        name: '*',
        source: prefix,
        kind: 'namespace',
        namespace_name: '*',
        location: node_to_location(tree)
      });
    } else if (tree.type === 'identifier') {
      imports.push({
        name: tree.text,
        source: prefix || tree.text,
        kind: 'named',
        location: node_to_location(tree)
      });
    }
  };
  
  extract_from_tree(use_tree);
  return imports;
}

function extract_rust_extern_crate(
  extern_node: SyntaxNode,
  source_code: string
): ImportInfo | null {
  const name = extern_node.childForFieldName('name');
  const alias = extern_node.childForFieldName('alias');
  
  if (!name) return null;
  
  return {
    name: alias?.text || name.text,
    alias: alias ? name.text : undefined,
    source: name.text,
    kind: 'named',
    location: node_to_location(extern_node)
  };
}

// --- Utility functions ---

function extract_string_literal(node: SyntaxNode, source: string): string {
  let text = source.substring(node.startIndex, node.endIndex);
  // Remove quotes
  if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }
  // Handle template literals
  if (text.startsWith('`') && text.endsWith('`')) {
    text = text.slice(1, -1);
  }
  return text;
}

function extract_import_specifiers(
  named_imports: SyntaxNode,
  source: string
): Array<{ name: string; alias?: string }> {
  const specifiers: Array<{ name: string; alias?: string }> = [];
  
  for (const child of named_imports.children) {
    if (child.type === 'import_specifier') {
      const imported = child.childForFieldName('name');
      const local = child.childForFieldName('alias');
      if (imported) {
        // In import { foo as bar }, 'foo' is the imported name, 'bar' is the local alias
        specifiers.push({
          name: local?.text || imported.text,
          alias: local ? imported.text : undefined
        });
      }
    } else if (child.type === 'identifier') {
      specifiers.push({ name: child.text });
    }
  }
  
  return specifiers;
}

function extract_destructured_names(
  pattern: SyntaxNode,
  source: string
): string[] {
  const names: string[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'shorthand_property_identifier_pattern' ||
        node.type === 'identifier') {
      names.push(node.text);
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(pattern);
  return names;
}

function node_to_location(node: SyntaxNode): Location {
  return {
    line: node.startPosition.row,
    column: node.startPosition.column
  };
}