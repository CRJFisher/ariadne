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
          // Extract simplified visibility level for the export
          let visibilityLevel = visibility;
          if (visibility === 'pub(crate)') visibilityLevel = 'crate';
          else if (visibility === 'pub(super)') visibilityLevel = 'super';
          else if (visibility === 'pub(self)') visibilityLevel = 'self';
          else if (visibility.startsWith('pub(in ')) visibilityLevel = visibility.substring(4);
          
          exports.push({
            name: name.text,
            source: 'local',
            kind: get_item_kind(item),
            location: node_to_location(item),
            visibility: visibilityLevel,
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
          // Extract simplified visibility level
          let visibilityLevel = visibility;
          if (visibility === 'pub(crate)') visibilityLevel = 'crate';
          else if (visibility === 'pub(super)') visibilityLevel = 'super';
          else if (visibility === 'pub(self)') visibilityLevel = 'self';
          else if (visibility.startsWith('pub(in ')) visibilityLevel = visibility.substring(4);
          
          exports.push({
            name: use_item.alias || use_item.name,
            source: use_item.path,
            kind: use_item.is_glob ? 'namespace' : 'named',
            location: node_to_location(node),
            original_name: use_item.alias ? use_item.name : undefined,
            visibility: visibilityLevel,
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
  } else if (visibility_text === 'pub(self)') {
    return 'pub(self)';
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
  
  // Try different node types that can appear in use declarations
  const use_tree = use_node.childForFieldName('argument');
  const scoped_use_list = use_node.children.find(c => c.type === 'scoped_use_list');
  const use_tree_child = use_node.children.find(c => c.type === 'use_tree');
  
  if (scoped_use_list) {
    // Handle scoped use list like "crate::module::{Item1, Item2}"
    const scope = scoped_use_list.children.find(c => c.type === 'scoped_identifier');
    const list = scoped_use_list.children.find(c => c.type === 'use_list');
    const wildcard = scoped_use_list.children.find(c => c.type === 'use_wildcard');
    
    const base_path = scope ? scope.text + '::' : '';
    
    if (list) {
      // Process each item in the list
      for (const child of list.children) {
        if (child.type === 'identifier') {
          items.push({
            name: child.text,
            path: base_path + child.text,
            is_glob: false
          });
        } else if (child.type === 'use_as_clause') {
          const sub_items = parse_use_tree_recursive(child, base_path);
          items.push(...sub_items);
        }
      }
    } else if (wildcard) {
      items.push({
        name: '*',
        path: base_path.replace(/::$/, ''),
        is_glob: true
      });
    }
  } else if (use_tree) {
    return parse_use_tree_recursive(use_tree);
  } else if (use_tree_child) {
    return parse_use_tree_recursive(use_tree_child);
  }
  
  return items;
}

function parse_use_tree_recursive(tree: SyntaxNode, path_prefix: string = ''): Array<{
  name: string;
  path: string;
  alias?: string;
  is_glob: boolean;
}> {
  const items: Array<{ name: string; path: string; alias?: string; is_glob: boolean }> = [];
  
  if (tree.type === 'use_as_clause') {
    // Handle "item as alias" pattern
    const path = tree.childForFieldName('path');
    const alias = tree.childForFieldName('alias');
    
    if (!path && !alias) {
      // Try alternative parsing for "item as alias" without field names
      const children = tree.children.filter(c => c.type === 'identifier' || c.type === 'scoped_identifier');
      if (children.length >= 2) {
        // First child is the original name, last is the alias (after 'as' keyword)
        const original_path = children[0].text;
        const original_parts = original_path.split('::');
        const original_name = original_parts[original_parts.length - 1];
        const alias_name = children[children.length - 1].text;
        items.push({
          name: original_name,
          path: path_prefix + original_path,
          alias: alias_name,
          is_glob: false
        });
      }
    } else if (path && alias) {
      const path_text = path.text;
      const path_parts = path_text.split('::');
      const original_name = path_parts[path_parts.length - 1];
      items.push({
        name: original_name,  // Original name (just the identifier)
        path: path_prefix + path_text,
        alias: alias.text,  // Alias name
        is_glob: false
      });
    }
  } else if (tree.type === 'scoped_identifier' || tree.type === 'identifier') {
    // Simple identifier or scoped path
    const text = tree.text;
    const parts = text.split('::');
    items.push({
      name: parts[parts.length - 1],
      path: path_prefix + text,
      is_glob: false
    });
  } else if (tree.type === 'use_wildcard') {
    // Glob import
    items.push({
      name: '*',
      path: path_prefix.replace(/::$/, ''),
      is_glob: true
    });
  } else if (tree.type === 'use_list') {
    // List of imports { item1, item2, ... }
    for (const child of tree.children) {
      if (child.type !== ',' && child.type !== '{' && child.type !== '}') {
        const subItems = parse_use_tree_recursive(child, path_prefix);
        items.push(...subItems);
      }
    }
  } else if (tree.type === 'use_tree') {
    // Nested use tree
    for (const child of tree.children) {
      if (child.type === 'scoped_identifier') {
        // Update path prefix
        const newPrefix = child.text + '::';
        const nextChild = tree.children[tree.children.indexOf(child) + 1];
        if (nextChild && (nextChild.type === 'use_list' || nextChild.type === 'use_wildcard')) {
          const subItems = parse_use_tree_recursive(nextChild, newPrefix);
          items.push(...subItems);
          break;
        } else {
          const subItems = parse_use_tree_recursive(child, path_prefix);
          items.push(...subItems);
        }
      } else if (child.type === 'use_as_clause' || child.type === 'use_list' || child.type === 'use_wildcard') {
        const subItems = parse_use_tree_recursive(child, path_prefix);
        items.push(...subItems);
      }
    }
  }
  
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