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
  const imports = extract_javascript_imports(root_node, source_code);
  
  // Add TypeScript-specific handling
  const visit = (node: SyntaxNode) => {
    // Type-only imports: import type { Foo } from './foo'
    if (node.type === 'import_statement') {
      const import_clause = node.childForFieldName('import_clause');
      if (import_clause) {
        const type_keyword = import_clause.children.find(
          child => child.type === 'type' && child.text === 'type'
        );
        if (type_keyword) {
          // Mark these imports as type-only
          const source_node = node.childForFieldName('source');
          if (source_node) {
            const module_source = extract_string_literal(source_node, source_code);
            const type_imports = extract_import_specifiers(import_clause, source_code);
            for (const imp of type_imports) {
              imports.push({
                name: imp.name,
                source: module_source,
                alias: imp.alias,
                kind: 'named',
                is_type_only: true,
                location: node_to_location(node)
              });
            }
          }
        }
      }
    }
    
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
        imports.push({
          name: alias?.text || name.text,
          alias: alias ? name.text : undefined,
          source: name.text,
          kind: 'named',
          location: node_to_location(child)
        });
      }
    } else if (child.type === 'dotted_name' || child.type === 'identifier') {
      imports.push({
        name: child.text,
        source: child.text,
        kind: 'named',
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