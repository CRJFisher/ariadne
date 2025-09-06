/**
 * Rust-specific bespoke export detection
 * 
 * Handles truly unique Rust export patterns that cannot be
 * expressed through configuration (~15% of logic)
 */

import { SyntaxNode } from 'tree-sitter';
import { ExportInfo } from '@ariadnejs/types';

/**
 * Rust visibility levels
 */
export type RustVisibility = 'pub' | 'pub(crate)' | 'pub(super)' | 'pub(in path)' | 'private';

/**
 * Handle complex visibility modifiers
 * 
 * Bespoke because Rust visibility has complex scoping rules with
 * pub(crate), pub(super), pub(in path) that need special parsing.
 */
export function handle_visibility_modifiers(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // Check for visibility modifier
    const visibility = extract_visibility(node);
    
    if (visibility && visibility !== 'private') {
      const item = get_exportable_item(node);
      if (item) {
        const name = item.childForFieldName('name');
        if (name) {
          exports.push({
            name: name.text,
            source: 'local',
            kind: get_item_kind(item),
            location: node_to_location(item),
            visibility,
            restricted: visibility !== 'pub'
          });
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
 * Handle pub use re-exports with complex paths
 * 
 * Bespoke because Rust re-exports can have complex path expressions
 * and glob patterns that need special handling.
 */
export function handle_pub_use_reexports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'use_declaration') {
      const visibility = extract_visibility(node);
      
      if (visibility && visibility !== 'private') {
        const use_list = parse_use_declaration(node);
        
        for (const use_item of use_list) {
          exports.push({
            name: use_item.alias || use_item.name,
            source: use_item.path,
            kind: use_item.is_glob ? 'namespace' : 'named',
            location: node_to_location(node),
            original_name: use_item.alias ? use_item.name : undefined,
            visibility,
            is_reexport: true
          });
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
 * Handle macro exports
 * 
 * Rust macros have special export rules with #[macro_export]
 */
export function handle_macro_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'macro_definition') {
      // Check for #[macro_export] attribute
      const has_macro_export = check_for_attribute(node, 'macro_export');
      
      if (has_macro_export) {
        const name = node.childForFieldName('name');
        if (name) {
          exports.push({
            name: name.text,
            source: 'local',
            kind: 'macro',
            location: node_to_location(node),
            macro_export: true
          });
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
 * Handle trait and impl exports
 * 
 * Traits and implementations have special visibility rules
 */
export function handle_trait_impl_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // pub trait TraitName
    if (node.type === 'trait_item') {
      const visibility = extract_visibility(node);
      if (visibility && visibility !== 'private') {
        const name = node.childForFieldName('name');
        if (name) {
          exports.push({
            name: name.text,
            source: 'local',
            kind: 'trait',
            location: node_to_location(node),
            visibility
          });
        }
      }
    }
    
    // impl blocks with pub methods
    if (node.type === 'impl_item') {
      const type_node = node.childForFieldName('type');
      const trait_node = node.childForFieldName('trait');
      
      // Visit methods within impl block
      const body = node.childForFieldName('body');
      if (body) {
        for (const item of body.children) {
          if (item.type === 'function_item') {
            const visibility = extract_visibility(item);
            if (visibility && visibility !== 'private') {
              const method_name = item.childForFieldName('name');
              if (method_name) {
                exports.push({
                  name: method_name.text,
                  source: 'local',
                  kind: 'method',
                  location: node_to_location(item),
                  visibility,
                  impl_for: type_node?.text,
                  trait_impl: trait_node?.text
                });
              }
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
 * Handle module exports
 * 
 * Rust modules can be inline or in separate files
 */
export function handle_module_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode, module_path: string[] = []) => {
    if (node.type === 'mod_item') {
      const visibility = extract_visibility(node);
      const name = node.childForFieldName('name');
      
      if (name && visibility && visibility !== 'private') {
        const current_path = [...module_path, name.text];
        
        exports.push({
          name: name.text,
          source: 'local',
          kind: 'module',
          location: node_to_location(node),
          visibility,
          module_path: current_path.join('::')
        });
        
        // Visit module body for nested exports
        const body = node.childForFieldName('body');
        if (body) {
          for (const child of body.children) {
            visit(child, current_path);
          }
        }
      }
    } else {
      // Continue traversal
      for (const child of node.children) {
        visit(child, module_path);
      }
    }
  };
  
  visit(root_node);
  return exports;
}

/**
 * Extract visibility modifier from a node
 */
function extract_visibility(node: SyntaxNode): RustVisibility | null {
  // Look for visibility_modifier as first child or previous sibling
  let visibility_node = node.children.find(c => c.type === 'visibility_modifier');
  
  if (!visibility_node && node.previousSibling?.type === 'visibility_modifier') {
    visibility_node = node.previousSibling;
  }
  
  if (!visibility_node) {
    return 'private';
  }
  
  const visibility_text = visibility_node.text;
  
  if (visibility_text === 'pub') {
    return 'pub';
  } else if (visibility_text === 'pub(crate)') {
    return 'pub(crate)';
  } else if (visibility_text === 'pub(super)') {
    return 'pub(super)';
  } else if (visibility_text.startsWith('pub(in ')) {
    return 'pub(in path)';
  }
  
  return 'private';
}

/**
 * Get the exportable item from a node
 */
function get_exportable_item(node: SyntaxNode): SyntaxNode | null {
  const exportable_types = [
    'function_item',
    'struct_item',
    'enum_item',
    'trait_item',
    'type_item',
    'const_item',
    'static_item',
    'mod_item'
  ];
  
  if (exportable_types.includes(node.type)) {
    return node;
  }
  
  // Check if next sibling is exportable
  if (node.type === 'visibility_modifier' && node.nextSibling) {
    if (exportable_types.includes(node.nextSibling.type)) {
      return node.nextSibling;
    }
  }
  
  return null;
}

/**
 * Parse use declaration into individual items
 */
function parse_use_declaration(use_node: SyntaxNode): Array<{
  name: string;
  path: string;
  alias?: string;
  is_glob: boolean;
}> {
  const items: Array<{ name: string; path: string; alias?: string; is_glob: boolean }> = [];
  const use_tree = use_node.childForFieldName('argument');
  
  if (!use_tree) return items;
  
  const parse_use_tree = (tree: SyntaxNode, path_prefix: string = '') => {
    if (tree.type === 'scoped_identifier') {
      const parts: string[] = [];
      let current = tree;
      
      while (current.type === 'scoped_identifier') {
        const name = current.childForFieldName('name');
        if (name) parts.unshift(name.text);
        current = current.childForFieldName('path')!;
      }
      
      if (current.type === 'identifier') {
        parts.unshift(current.text);
      }
      
      const full_path = path_prefix + parts.join('::');
      items.push({
        name: parts[parts.length - 1],
        path: full_path,
        is_glob: false
      });
    } else if (tree.type === 'use_wildcard') {
      items.push({
        name: '*',
        path: path_prefix.slice(0, -2), // Remove trailing ::
        is_glob: true
      });
    } else if (tree.type === 'use_list') {
      for (const child of tree.children) {
        if (child.type === 'use_as_clause') {
          const path = child.childForFieldName('path');
          const alias = child.childForFieldName('alias');
          if (path && alias) {
            items.push({
              name: path.text,
              path: path_prefix + path.text,
              alias: alias.text,
              is_glob: false
            });
          }
        } else if (child.type !== ',' && child.type !== '{' && child.type !== '}') {
          parse_use_tree(child, path_prefix);
        }
      }
    }
  };
  
  parse_use_tree(use_tree);
  return items;
}

/**
 * Check if a node has a specific attribute
 */
function check_for_attribute(node: SyntaxNode, attribute_name: string): boolean {
  // Look for attribute_item as previous sibling
  let current = node.previousSibling;
  
  while (current) {
    if (current.type === 'attribute_item') {
      if (current.text.includes(attribute_name)) {
        return true;
      }
    } else if (current.type !== 'line_comment' && current.type !== 'block_comment') {
      // Stop if we hit something that's not an attribute or comment
      break;
    }
    current = current.previousSibling;
  }
  
  return false;
}

/**
 * Get the kind of an item
 */
function get_item_kind(item: SyntaxNode): string {
  switch (item.type) {
    case 'function_item': return 'function';
    case 'struct_item': return 'struct';
    case 'enum_item': return 'enum';
    case 'trait_item': return 'trait';
    case 'type_item': return 'type';
    case 'const_item': return 'const';
    case 'static_item': return 'static';
    case 'mod_item': return 'module';
    default: return 'named';
  }
}

function node_to_location(node: SyntaxNode): any {
  return {
    start: {
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1
    },
    end: {
      line: node.endPosition.row + 1,
      column: node.endPosition.column + 1
    }
  };
}