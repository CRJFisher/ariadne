/**
 * Export extraction from AST
 * 
 * Extracts export statements from the AST during Per-File Analysis (Layer 2).
 * This was moved from symbol_resolution to maintain proper layer dependencies.
 * 
 * Layer 2 (export_detection) extracts exports from AST
 * Layer 8 (symbol_resolution) consumes extracted exports
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, ExportInfo, Location } from '@ariadnejs/types';

/**
 * Extract all exports from AST
 * 
 * Main entry point that dispatches to language-specific extractors
 */
export function extract_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string
): ExportInfo[] {
  switch (language) {
    case 'javascript':
      return extract_javascript_exports(root_node, source_code);
    
    case 'typescript':
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
 * Extract JavaScript exports (ES6 and CommonJS)
 */
export function extract_javascript_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  exports.push(...extract_es6_exports(root_node, source_code));
  exports.push(...extract_commonjs_exports(root_node, source_code));
  return exports;
}

/**
 * Extract TypeScript exports (includes type-only exports)
 */
export function extract_typescript_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const processed_nodes = new Set<SyntaxNode>();
  
  const visit = (node: SyntaxNode) => {
    // Handle export statements
    if (node.type === 'export_statement' && !processed_nodes.has(node)) {
      processed_nodes.add(node);
      const ts_exports = extract_typescript_export(node, source_code);
      if (ts_exports) exports.push(...ts_exports);
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  
  // Also get JavaScript exports
  exports.push(...extract_es6_exports(root_node, source_code));
  exports.push(...extract_commonjs_exports(root_node, source_code));
  
  return exports;
}

/**
 * Extract Python exports
 */
export function extract_python_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // Python __all__ definition
    if (node.type === 'assignment') {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      
      if (left?.text === '__all__' && right) {
        const all_exports = extract_python_all_exports(right, source_code);
        for (const name of all_exports) {
          exports.push({
            name,
            source: 'local',
            kind: 'named',
            location: node_to_location(node)
          });
        }
      }
    }
    
    // Module-level function and class definitions
    if (node.parent?.type === 'module') {
      if (node.type === 'function_definition' || node.type === 'class_definition') {
        const name_node = node.childForFieldName('name');
        if (name_node && !name_node.text.startsWith('_')) {
          exports.push({
            name: name_node.text,
            source: 'local',
            kind: 'named',
            location: node_to_location(node)
          });
        }
      }
    }
    
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return exports;
}

/**
 * Extract Rust exports
 */
export function extract_rust_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // Public items with 'pub' visibility
    if (node.type === 'visibility_modifier' && node.text === 'pub') {
      const parent = node.parent;
      if (parent) {
        const name = extract_rust_item_name(parent);
        if (name) {
          exports.push({
            name,
            source: 'local',
            kind: 'named',
            location: node_to_location(parent)
          });
        }
      }
    }
    
    // Re-exports: pub use ...
    if (node.type === 'use_declaration') {
      const has_pub = node.children.some(c => 
        c.type === 'visibility_modifier' && c.text === 'pub'
      );
      if (has_pub) {
        const use_exports = extract_rust_use_exports(node, source_code);
        exports.push(...use_exports);
      }
    }
    
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return exports;
}

// --- Helper functions for TypeScript ---

function extract_typescript_export(
  export_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  // Check if this is a type-only export at the statement level
  // Pattern: export type { ... } from '...'
  let statement_level_type = false;
  // The 'type' keyword appears as a direct child of export_statement after 'export'
  const children = export_node.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].type === 'export' && 
        i + 1 < children.length && 
        children[i + 1].type === 'type') {
      statement_level_type = true;
      break;
    }
  }
  
  // Check for export declaration
  const declaration = export_node.childForFieldName('declaration');
  if (declaration) {
    // export const/let/var/function/class
    const exported = extract_declaration_exports(declaration, source_code);
    for (const exp of exported) {
      exports.push({
        ...exp,
        is_type_only: statement_level_type
      });
    }
  }
  
  // Check for export clause (named exports)
  // When there's a 'type' keyword, export_clause might be a child but not a field
  let export_clause = export_node.childForFieldName('export_clause');
  if (!export_clause) {
    export_clause = export_node.children.find(c => c.type === 'export_clause');
  }
  if (export_clause) {
    const source_node = export_node.childForFieldName('source');
    const source = source_node ? extract_string_literal(source_node, source_code) : 'local';
    
    for (const child of export_clause.children) {
      if (child.type === 'export_specifier') {
        // Check for inline type modifier
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
          // Normal export specifier
          actual_name_node = child.childForFieldName('name');
        }
        
        actual_alias_node = child.childForFieldName('alias');
        
        if (actual_name_node) {
          exports.push({
            name: actual_alias_node?.text || actual_name_node.text,
            source,
            alias: actual_alias_node ? actual_name_node.text : undefined,
            kind: 'named',
            is_type_only: statement_level_type || inline_type,
            location: node_to_location(child)
          });
        }
      }
    }
  }
  
  // Check for export * from or export type * from
  // The * might be in the export_clause or as a direct child
  const has_star = export_node.children.some(c => c.type === '*') ||
                   (export_clause && export_clause.children.some(c => c.type === '*'));
  
  if (has_star) {
    const source_node = export_node.childForFieldName('source');
    if (source_node) {
      exports.push({
        name: '*',
        source: extract_string_literal(source_node, source_code),
        kind: 'namespace',
        is_type_only: statement_level_type,
        location: node_to_location(export_node)
      });
    }
  }
  
  return exports;
}

// --- Helper functions for ES6/JavaScript ---

export function extract_es6_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'export_statement') {
      // Check for export default
      const default_keyword = node.children.find(c => c.type === 'default');
      if (default_keyword) {
        const value_node = default_keyword.nextSibling;
        let name = 'default';
        
        // Try to extract a meaningful name
        if (value_node) {
          if (value_node.type === 'identifier') {
            name = value_node.text;
          } else if (value_node.type === 'function_declaration' || 
                     value_node.type === 'class_declaration') {
            const name_node = value_node.childForFieldName('name');
            if (name_node) name = name_node.text;
          }
        }
        
        exports.push({
          name,
          source: 'local',
          kind: 'default',
          is_default: true,
          location: node_to_location(node)
        });
      }
      
      // Check for named exports
      const declaration = node.childForFieldName('declaration');
      if (declaration && !default_keyword) {
        const exported = extract_declaration_exports(declaration, source_code);
        exports.push(...exported);
      }
      
      // Check for export clause
      const export_clause = node.childForFieldName('export_clause');
      if (export_clause) {
        const source_node = node.childForFieldName('source');
        const source = source_node ? extract_string_literal(source_node, source_code) : 'local';
        
        for (const child of export_clause.children) {
          if (child.type === 'export_specifier') {
            const name = child.childForFieldName('name');
            const alias = child.childForFieldName('alias');
            
            if (name) {
              exports.push({
                name: alias?.text || name.text,
                source,
                alias: alias ? name.text : undefined,
                kind: 'named',
                location: node_to_location(child)
              });
            }
          }
        }
      }
      
      // Check for export * from
      if (node.children.some(c => c.type === '*')) {
        const source_node = node.childForFieldName('source');
        if (source_node) {
          exports.push({
            name: '*',
            source: extract_string_literal(source_node, source_code),
            kind: 'namespace',
            location: node_to_location(node)
          });
        }
      }
    }
    
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return exports;
}

export function extract_commonjs_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // module.exports = ...
    if (node.type === 'assignment_expression') {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      
      if (left?.text === 'module.exports' && right) {
        // module.exports = { a, b, c }
        if (right.type === 'object') {
          const obj_exports = extract_object_exports(right, source_code);
          exports.push(...obj_exports);
        } else {
          // module.exports = something
          let name = 'default';
          if (right.type === 'identifier') {
            name = right.text;
          }
          exports.push({
            name,
            source: 'local',
            kind: 'default',
            is_default: true,
            location: node_to_location(node)
          });
        }
      }
      
      // exports.name = ...
      if (left && left.type === 'member_expression') {
        const object = left.childForFieldName('object');
        const property = left.childForFieldName('property');
        
        if (object?.text === 'exports' && property) {
          exports.push({
            name: property.text,
            source: 'local',
            kind: 'named',
            location: node_to_location(node)
          });
        }
      }
    }
    
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return exports;
}

// --- Utility functions ---

function extract_declaration_exports(
  declaration: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  if (declaration.type === 'variable_declaration' || 
      declaration.type === 'lexical_declaration') {
    // export const/let/var
    for (const child of declaration.children) {
      if (child.type === 'variable_declarator') {
        const name = child.childForFieldName('name');
        if (name) {
          if (name.type === 'identifier') {
            exports.push({
              name: name.text,
              source: 'local',
              kind: 'named',
              location: node_to_location(name)
            });
          } else if (name.type === 'object_pattern' || name.type === 'array_pattern') {
            // Destructuring
            const names = extract_destructured_names(name, source_code);
            for (const n of names) {
              exports.push({
                name: n,
                source: 'local',
                kind: 'named',
                location: node_to_location(name)
              });
            }
          }
        }
      }
    }
  } else if (declaration.type === 'function_declaration' || 
             declaration.type === 'class_declaration') {
    const name = declaration.childForFieldName('name');
    if (name) {
      exports.push({
        name: name.text,
        source: 'local',
        kind: 'named',
        location: node_to_location(declaration)
      });
    }
  }
  
  return exports;
}

function extract_object_exports(
  object_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  for (const child of object_node.children) {
    if (child.type === 'pair') {
      const key = child.childForFieldName('key');
      if (key) {
        exports.push({
          name: key.text.replace(/['"]/g, ''),
          source: 'local',
          kind: 'named',
          location: node_to_location(child)
        });
      }
    } else if (child.type === 'shorthand_property_identifier') {
      exports.push({
        name: child.text,
        source: 'local',
        kind: 'named',
        location: node_to_location(child)
      });
    }
  }
  
  return exports;
}

function extract_python_all_exports(
  list_node: SyntaxNode,
  source_code: string
): string[] {
  const names: string[] = [];
  
  if (list_node.type === 'list') {
    for (const child of list_node.children) {
      if (child.type === 'string') {
        const text = child.text;
        // Remove quotes
        names.push(text.slice(1, -1));
      }
    }
  }
  
  return names;
}

function extract_rust_item_name(item_node: SyntaxNode): string | null {
  const type_to_field: Record<string, string> = {
    'function_item': 'name',
    'struct_item': 'name',
    'enum_item': 'name',
    'type_item': 'name',
    'trait_item': 'name',
    'mod_item': 'name',
    'const_item': 'name',
    'static_item': 'name'
  };
  
  const field = type_to_field[item_node.type];
  if (field) {
    const name_node = item_node.childForFieldName(field);
    return name_node?.text || null;
  }
  
  return null;
}

function extract_rust_use_exports(
  use_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const use_tree = use_node.childForFieldName('use_tree');
  if (!use_tree) return exports;
  
  const extract_from_tree = (tree: SyntaxNode): void => {
    if (tree.type === 'scoped_identifier') {
      const name = tree.childForFieldName('name');
      if (name) {
        exports.push({
          name: name.text,
          source: tree.text,
          kind: 'named',
          is_reexport: true,
          location: node_to_location(tree)
        });
      }
    } else if (tree.type === 'use_list') {
      for (const child of tree.children) {
        if (child.type === 'use' || child.type === 'scoped_identifier') {
          extract_from_tree(child);
        }
      }
    } else if (tree.type === 'use_as_clause') {
      const alias = tree.childForFieldName('alias');
      if (alias) {
        exports.push({
          name: alias.text,
          source: tree.text,
          kind: 'named',
          is_reexport: true,
          location: node_to_location(tree)
        });
      }
    }
  };
  
  extract_from_tree(use_tree);
  return exports;
}

function extract_destructured_names(
  pattern: SyntaxNode,
  source_code: string
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

function node_to_location(node: SyntaxNode): Location {
  return {
    line: node.startPosition.row,
    column: node.startPosition.column
  };
}