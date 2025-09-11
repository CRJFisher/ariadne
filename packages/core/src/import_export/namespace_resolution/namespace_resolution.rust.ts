/**
 * Rust-specific bespoke namespace resolution
 * 
 * Handles truly unique Rust patterns that cannot be
 * expressed through configuration (~15% of logic)
 */

import { SyntaxNode } from 'tree-sitter';
import { NamespaceImportInfo, NamespaceExport } from './namespace_resolution';

/**
 * Handle complex visibility modifiers
 * 
 * Bespoke because Rust's visibility system with pub(crate),
 * pub(super), etc. creates scoped namespace visibility.
 */
export function handle_visibility_modifiers(
  item_node: SyntaxNode,
  source_code: string
): { visibility: 'private' | 'public' | 'crate' | 'super' | 'in_path'; path?: string } {
  const item_text = source_code.substring(item_node.startIndex, item_node.endIndex);
  
  // Check for various visibility patterns
  if (item_text.startsWith('pub(crate)')) {
    return { visibility: 'crate' };
  }
  
  if (item_text.startsWith('pub(super)')) {
    return { visibility: 'super' };
  }
  
  // Pattern: pub(in path::to::module)
  const in_path_match = item_text.match(/^pub\(in\s+([^)]+)\)/);
  if (in_path_match) {
    return { visibility: 'in_path', path: in_path_match[1] };
  }
  
  if (item_text.startsWith('pub ')) {
    return { visibility: 'public' };
  }
  
  return { visibility: 'private' };
}

/**
 * Handle complex use statements with nested paths and aliases
 * 
 * Bespoke because Rust's use syntax supports complex nested
 * patterns like use a::{b::{c, d}, e as f}.
 */
export function handle_complex_use_statements(
  use_text: string
): NamespaceImportInfo[] {
  const imports: NamespaceImportInfo[] = [];
  
  // Handle nested braces recursively
  function parse_use_tree(path_prefix: string, tree_text: string): void {
    // Handle path::{item1, item2} pattern
    const path_brace_match = tree_text.match(/^(.+?)::\{([^}]+)\}$/);
    if (path_brace_match) {
      const [, path, items_text] = path_brace_match;
      const full_prefix = path_prefix ? `${path_prefix}::${path}` : path;
      const items = split_respecting_braces(items_text);
      
      for (const item of items) {
        parse_use_tree(full_prefix, item);
      }
      return;
    }
    
    // Pattern: {item1, item2, ...} (no prefix)
    const brace_match = tree_text.match(/^\{([^}]+)\}$/);
    if (brace_match) {
      const items = split_respecting_braces(brace_match[1]);
      
      for (const item of items) {
        parse_use_tree(path_prefix, item);
      }
      return;
    }
    
    // Check for alias: item as alias
    const alias_match = tree_text.match(/^(.+)\s+as\s+(\w+)$/);
    if (alias_match) {
      const [, source, alias] = alias_match;
      const full_path = path_prefix ? `${path_prefix}::${source}` : source;
      
      imports.push({
        namespace_name: alias,
        source_module: full_path,
        is_namespace: true,
        members: undefined
      });
      return;
    }
    
    // Simple item
    const full_path = path_prefix ? `${path_prefix}::${tree_text}` : tree_text;
    imports.push({
      namespace_name: tree_text.split('::').pop() || tree_text,
      source_module: full_path,
      is_namespace: true,
      members: undefined
    });
  }
  
  // Extract the main use pattern
  const use_match = use_text.match(/use\s+(.+?)(?:;|$)/);
  if (use_match) {
    parse_use_tree('', use_match[1].trim());
  }
  
  return imports;
}

/**
 * Helper to split by commas while respecting nested braces
 */
function split_respecting_braces(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of text) {
    if (char === '{') {
      depth++;
      current += char;
    }
    else if (char === '}') {
      depth--;
      current += char;
    }
    else if (char === ',' && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    }
    else {
      current += char;
    }
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  return parts;
}

/**
 * Handle extern crate declarations
 * 
 * Bespoke because extern crate creates special crate-level
 * namespaces with different resolution rules.
 */
export function handle_extern_crate(
  source_code: string
): NamespaceImportInfo[] {
  const imports: NamespaceImportInfo[] = [];
  
  // Pattern: extern crate name;
  // Pattern: extern crate name as alias;
  // Use [\p{L}\p{N}_] to match Unicode letters, numbers, and underscore
  const extern_pattern = /extern\s+crate\s+([\p{L}\p{N}_]+)(?:\s+as\s+([\p{L}\p{N}_]+))?;/gu;
  let match;
  
  while ((match = extern_pattern.exec(source_code)) !== null) {
    const [, crate_name, alias] = match;
    
    imports.push({
      namespace_name: alias || crate_name,
      source_module: `crate::${crate_name}`,
      is_namespace: true,
      is_extern_crate: true,
      members: undefined
    });
  }
  
  return imports;
}

/**
 * Handle trait imports affecting method resolution
 * 
 * Bespoke because importing traits brings their methods into
 * scope, affecting namespace member resolution.
 */
export function handle_trait_imports(
  use_text: string,
  source_code: string
): { trait_name?: string; methods: string[] } {
  // Check if this is a trait import
  const trait_match = use_text.match(/use\s+.*::(\w+);/);
  if (!trait_match) {
    return { methods: [] };
  }
  
  const trait_name = trait_match[1];
  const methods: string[] = [];
  
  // Look for trait implementation
  // Handle generic parameters and complex type names
  // Use a more sophisticated pattern to handle nested braces
  const impl_pattern = new RegExp(
    `impl(?:<[^>]+>)?\\s+${trait_name}(?:<[^>]+>)?\\s+for\\s+[^{]+\\{`,
    's'
  );
  const impl_start = impl_pattern.exec(source_code);
  
  let impl_match = null;
  if (impl_start) {
    // Find the matching closing brace by counting braces
    const start_index = impl_start.index! + impl_start[0].length;
    let brace_count = 1;
    let end_index = start_index;
    
    while (brace_count > 0 && end_index < source_code.length) {
      if (source_code[end_index] === '{') {
        brace_count++;
      } else if (source_code[end_index] === '}') {
        brace_count--;
      }
      end_index++;
    }
    
    if (brace_count === 0) {
      impl_match = [impl_start[0], source_code.substring(start_index, end_index - 1)];
    }
  }
  
  if (impl_match) {
    // Extract method names from trait implementation
    const method_pattern = /fn\s+(\w+)/g;
    let method_match;
    
    while ((method_match = method_pattern.exec(impl_match[1])) !== null) {
      methods.push(method_match[1]);
    }
  }
  
  return { trait_name, methods };
}

/**
 * Handle macro exports and imports
 * 
 * Bespoke because Rust macros have special visibility rules
 * and are imported differently from regular items.
 */
export function handle_macro_namespace(
  source_code: string
): { exported_macros: string[]; imported_macros: string[] } {
  const exported_macros: string[] = [];
  const imported_macros: string[] = [];
  
  // Pattern: #[macro_export] macro_rules! name
  const export_pattern = /#\[macro_export\]\s*macro_rules!\s+([\p{L}\p{N}_]+)/gu;
  let match;
  
  while ((match = export_pattern.exec(source_code)) !== null) {
    exported_macros.push(match[1]);
  }
  
  // Pattern: use some_crate::macro_name;
  // Pattern: #[macro_use] extern crate
  const macro_use_pattern = /#\[macro_use\]\s+extern\s+crate\s+(\w+)/g;
  
  while ((match = macro_use_pattern.exec(source_code)) !== null) {
    // This imports all macros from the crate
    imported_macros.push(`${match[1]}::*`);
  }
  
  // Pattern: use some_crate::macros::*;
  const use_macro_pattern = /use\s+[\w:]+::macros::\*;/g;
  
  while ((match = use_macro_pattern.exec(source_code)) !== null) {
    imported_macros.push(match[0]);
  }
  
  return { exported_macros, imported_macros };
}

/**
 * Handle module path resolution with self, super, crate
 * 
 * Bespoke because Rust's path keywords create special
 * resolution contexts relative to the current module.
 */
export function handle_path_keywords(
  path: string,
  current_module: string
): string {
  // Handle self:: - refers to current module
  if (path.startsWith('self::')) {
    return path.replace('self::', `${current_module}::`);
  }
  
  // Handle multiple super:: levels (super::super::)
  let super_count = 0;
  let remaining_path = path;
  while (remaining_path.startsWith('super::')) {
    super_count++;
    remaining_path = remaining_path.substring(7); // Remove 'super::'
  }
  
  if (super_count > 0) {
    const module_parts = current_module.split('::').filter(p => p);
    // Go up super_count levels
    for (let i = 0; i < super_count && module_parts.length > 0; i++) {
      module_parts.pop();
    }
    
    if (module_parts.length > 0) {
      const parent = module_parts.join('::');
      return remaining_path ? `${parent}::${remaining_path}` : parent;
    } else {
      // At crate root
      return remaining_path;
    }
  }
  
  // Handle crate:: - refers to crate root
  if (path.startsWith('crate::')) {
    // Already absolute from crate root
    return path;
  }
  
  // Relative path - resolve from current module
  if (!path.includes('::')) {
    return `${current_module}::${path}`;
  }
  
  return path;
}