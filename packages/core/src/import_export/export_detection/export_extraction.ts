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
import { 
  Language, 
  Location,
  UnifiedExport,
  NamedExport,
  DefaultExport,
  NamespaceExport,
  ReExport,
  NamedExportItem,
  ReExportItem,
  SymbolName,
  ModulePath,
  NamespaceName,
  toSymbolName,
  buildModulePath
} from '@ariadnejs/types';

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
): UnifiedExport[] {
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
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
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
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
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
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
  
  const visit = (node: SyntaxNode) => {
    // Python __all__ definition
    if (node.type === 'assignment') {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      
      if (left?.text === '__all__' && right) {
        const all_exports = extract_python_all_exports(right, source_code);
        if (all_exports.length > 0) {
          const named_export: NamedExport = {
            kind: 'named',
            exports: all_exports.map(name => ({
              local_name: toSymbolName(name)
            })),
            location: node_to_location(node),
            language: 'python',
            node_type: 'assignment'
          };
          exports.push(named_export);
        }
      }
    }
    
    // Module-level function and class definitions
    if (node.parent?.type === 'module') {
      if (node.type === 'function_definition' || node.type === 'class_definition') {
        const name_node = node.childForFieldName('name');
        if (name_node && !name_node.text.startsWith('_')) {
          const named_export: NamedExport = {
            kind: 'named',
            exports: [{
              local_name: toSymbolName(name_node.text)
            }],
            location: node_to_location(node),
            language: 'python',
            node_type: node.type
          };
          exports.push(named_export);
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
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
  
  const visit = (node: SyntaxNode) => {
    // Public items with 'pub' visibility
    if (node.type === 'visibility_modifier' && node.text === 'pub') {
      const parent = node.parent;
      if (parent) {
        const name = extract_rust_item_name(parent);
        if (name) {
          const named_export: NamedExport = {
            kind: 'named',
            exports: [{
              local_name: toSymbolName(name)
            }],
            location: node_to_location(parent),
            language: 'rust',
            node_type: parent.type
          };
          exports.push(named_export);
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
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
  
  // Check if this is a type-only export at the statement level
  // Pattern: export type { ... } from '...' or export type * from '...'
  let statement_level_type = false;
  // The 'type' keyword appears as a direct child of export_statement after 'export'
  // Note: TypeScript parser may put 'type' in an ERROR node for export type *
  const children = export_node.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].type === 'export' && i + 1 < children.length) {
      const next = children[i + 1];
      if (next.type === 'type') {
        statement_level_type = true;
        break;
      }
      // Check if 'type' is inside an ERROR node (happens with export type *)
      if (next.type === 'ERROR' && next.children.length > 0) {
        if (next.children[0].type === 'type') {
          statement_level_type = true;
          break;
        }
      }
    }
  }
  
  // Check for export declaration
  const declaration = export_node.childForFieldName('declaration');
  if (declaration) {
    // export const/let/var/function/class
    const exported = extract_declaration_exports(declaration, source_code);
    exports.push(...exported);
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
          if (source === 'local') {
            // Local named export
            const named_export: NamedExport = {
              kind: 'named',
              exports: [{
                local_name: toSymbolName(actual_name_node.text),
                export_name: actual_alias_node ? toSymbolName(actual_alias_node.text) : undefined,
                is_type_only: statement_level_type || inline_type
              }],
              location: node_to_location(child),
              language: 'typescript',
              node_type: 'export_specifier'
            };
            exports.push(named_export);
          } else {
            // Re-export from another module
            const re_export: ReExport = {
              kind: 'reexport',
              source: buildModulePath(source),
              exports: [{
                source_name: toSymbolName(actual_name_node.text),
                export_name: actual_alias_node ? toSymbolName(actual_alias_node.text) : undefined,
                is_type_only: statement_level_type || inline_type
              }],
              location: node_to_location(child),
              language: 'typescript',
              node_type: 'export_specifier'
            };
            exports.push(re_export);
          }
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
      const namespace_export: NamespaceExport = {
        kind: 'namespace',
        source: buildModulePath(extract_string_literal(source_node, source_code)),
        location: node_to_location(export_node),
        language: 'typescript',
        node_type: 'export_statement'
      };
      exports.push(namespace_export);
    }
  }
  
  return exports;
}

// --- Helper functions for ES6/JavaScript ---

export function extract_es6_exports(
  root_node: SyntaxNode,
  source_code: string
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
  
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
        
        const default_export: DefaultExport = {
          kind: 'default',
          symbol: name !== 'default' ? toSymbolName(name) : undefined,
          is_declaration: value_node?.type === 'function_declaration' || 
                          value_node?.type === 'class_declaration',
          location: node_to_location(node),
          language: 'javascript',
          node_type: 'export_statement'
        };
        exports.push(default_export);
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
              if (source === 'local') {
                // Local named export
                const named_export: NamedExport = {
                  kind: 'named',
                  exports: [{
                    local_name: toSymbolName(name.text),
                    export_name: alias ? toSymbolName(alias.text) : undefined
                  }],
                  location: node_to_location(child),
                  language: 'javascript',
                  node_type: 'export_specifier'
                };
                exports.push(named_export);
              } else {
                // Re-export from another module
                const re_export: ReExport = {
                  kind: 'reexport',
                  source: buildModulePath(source),
                  exports: [{
                    source_name: toSymbolName(name.text),
                    export_name: alias ? toSymbolName(alias.text) : undefined
                  }],
                  location: node_to_location(child),
                  language: 'javascript',
                  node_type: 'export_specifier'
                };
                exports.push(re_export);
              }
            }
          }
        }
      }
      
      // Check for export * from
      if (node.children.some(c => c.type === '*')) {
        const source_node = node.childForFieldName('source');
        if (source_node) {
          const namespace_export: NamespaceExport = {
            kind: 'namespace',
            source: buildModulePath(extract_string_literal(source_node, source_code)),
            location: node_to_location(node),
            language: 'javascript',
            node_type: 'export_statement'
          };
          exports.push(namespace_export);
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
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
  
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
          const default_export: DefaultExport = {
            kind: 'default',
            symbol: right.type === 'identifier' ? toSymbolName(right.text) : undefined,
            location: node_to_location(node),
            language: 'javascript',
            node_type: 'assignment_expression'
          };
          exports.push(default_export);
        }
      }
      
      // exports.name = ...
      if (left && left.type === 'member_expression') {
        const object = left.childForFieldName('object');
        const property = left.childForFieldName('property');
        
        if (object?.text === 'exports' && property) {
          const named_export: NamedExport = {
            kind: 'named',
            exports: [{
              local_name: toSymbolName(property.text)
            }],
            location: node_to_location(node),
            language: 'javascript',
            node_type: 'assignment_expression'
          };
          exports.push(named_export);
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
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
  
  if (declaration.type === 'variable_declaration' || 
      declaration.type === 'lexical_declaration') {
    // export const/let/var
    for (const child of declaration.children) {
      if (child.type === 'variable_declarator') {
        const name = child.childForFieldName('name');
        if (name) {
          if (name.type === 'identifier') {
            const named_export: NamedExport = {
              kind: 'named',
              exports: [{
                local_name: toSymbolName(name.text)
              }],
              location: node_to_location(name),
              language: 'javascript',
              node_type: declaration.type
            };
            exports.push(named_export);
          } else if (name.type === 'object_pattern' || name.type === 'array_pattern') {
            // Destructuring
            const names = extract_destructured_names(name, source_code);
            if (names.length > 0) {
              const named_export: NamedExport = {
                kind: 'named',
                exports: names.map(n => ({
                  local_name: toSymbolName(n)
                })),
                location: node_to_location(name),
                language: 'javascript',
                node_type: declaration.type
              };
              exports.push(named_export);
            }
          }
        }
      }
    }
  } else if (declaration.type === 'function_declaration' || 
             declaration.type === 'class_declaration') {
    const name = declaration.childForFieldName('name');
    if (name) {
      const named_export: NamedExport = {
        kind: 'named',
        exports: [{
          local_name: toSymbolName(name.text)
        }],
        location: node_to_location(declaration),
        language: 'javascript',
        node_type: declaration.type
      };
      exports.push(named_export);
    }
  }
  
  return exports;
}

function extract_object_exports(
  object_node: SyntaxNode,
  source_code: string
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
  const named_exports: NamedExportItem[] = [];
  
  for (const child of object_node.children) {
    if (child.type === 'pair') {
      const key = child.childForFieldName('key');
      if (key) {
        named_exports.push({
          local_name: toSymbolName(key.text.replace(/['"]/g, ''))
        });
      }
    } else if (child.type === 'shorthand_property_identifier') {
      named_exports.push({
        local_name: toSymbolName(child.text)
      });
    }
  }
  
  if (named_exports.length > 0) {
    const named_export: NamedExport = {
      kind: 'named',
      exports: named_exports,
      location: node_to_location(object_node),
      language: 'javascript',
      node_type: 'object'
    };
    exports.push(named_export);
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
): UnifiedExport[] {
  const exports: UnifiedExport[] = [];
  const re_exportItems: ReExportItem[] = [];
  let module_path: string | null = null;
  
  // Find the main identifier or use_list
  let use_target: SyntaxNode | null = null;
  for (const child of use_node.children) {
    if (child.type === 'scoped_identifier' || 
        child.type === 'identifier' || 
        child.type === 'use_list' ||
        child.type === 'use_as_clause' ||
        child.type === 'use_wildcard') {
      use_target = child;
      break;
    }
  }
  
  if (!use_target) return exports;
  
  const extract_from_node = (node: SyntaxNode): void => {
    if (node.type === 'scoped_identifier') {
      // For nested scoped_identifiers like crate::module::Item,
      // we want the last identifier
      let last_identifier: SyntaxNode | null = null;
      for (const child of node.children) {
        if (child.type === 'identifier') {
          last_identifier = child;
        }
      }
      
      if (last_identifier) {
        module_path = module_path || node.text;
        re_exportItems.push({
          source_name: toSymbolName(last_identifier.text),
          export_name: toSymbolName(last_identifier.text)
        });
      }
    } else if (node.type === 'identifier') {
      // Simple identifier
      module_path = module_path || node.text;
      re_exportItems.push({
        source_name: toSymbolName(node.text),
        export_name: toSymbolName(node.text)
      });
    } else if (node.type === 'use_list') {
      // Multiple imports: use module::{Item1, Item2}
      for (const child of node.children) {
        if (child.type === 'scoped_identifier' || child.type === 'identifier') {
          extract_from_node(child);
        }
      }
    } else if (node.type === 'use_as_clause') {
      // Aliased import: use module::Item as Alias
      const name = node.childForFieldName('name');
      const alias = node.childForFieldName('alias');
      if (name && alias) {
        module_path = module_path || node.text;
        re_exportItems.push({
          source_name: toSymbolName(name.text),
          export_name: toSymbolName(alias.text)
        });
      }
    } else if (node.type === 'use_wildcard') {
      // Wildcard import: use module::*
      const namespace_export: NamespaceExport = {
        kind: 'namespace',
        source: buildModulePath(node.parent?.text || ''),
        location: node_to_location(node),
        language: 'rust',
        node_type: 'use_wildcard'
      };
      exports.push(namespace_export);
    }
  };
  
  extract_from_node(use_target);
  
  // Create ReExport for collected items
  if (re_exportItems.length > 0 && module_path) {
    const re_export: ReExport = {
      kind: 'reexport',
      source: buildModulePath(module_path),
      exports: re_exportItems,
      location: node_to_location(use_node),
      language: 'rust',
      node_type: 'use_declaration'
    };
    exports.push(re_export);
  }
  
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