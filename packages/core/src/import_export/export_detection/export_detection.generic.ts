/**
 * Generic export detection processor
 * 
 * Configuration-driven export detection that handles ~85% of export
 * detection logic across all languages using language configurations.
 */

import { Language, Location, ExportInfo } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import {
  get_export_config,
  is_export_node,
  is_exportable_definition,
  matches_export_pattern,
  is_private_symbol,
  get_export_list_identifier,
  has_implicit_exports,
  ExportLanguageConfig
} from './language_configs';

/**
 * Module context shared across detection
 */
export const MODULE_CONTEXT = {
  name: 'export_detection',
  version: '2.0.0',
  layer: 2
} as const;

/**
 * Export detection result
 */
export interface ExportDetectionResult {
  exports: ExportInfo[];
  requires_bespoke: boolean;
  bespoke_hints?: {
    has_commonjs?: boolean;
    has_type_exports?: boolean;
    has_visibility_modifiers?: boolean;
    has_export_list?: boolean;
  };
}

/**
 * Generic export detector using configuration
 */
export function detect_exports_generic(
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): ExportDetectionResult {
  const config = get_export_config(language);
  const exports: ExportInfo[] = [];
  const bespoke_hints: ExportDetectionResult['bespoke_hints'] = {};
  let requires_bespoke = false;
  
  // Track processed nodes to avoid duplicates
  const processed_nodes = new Set<SyntaxNode>();
  
  // Visit all nodes in the AST
  const visit = (node: SyntaxNode, depth: number = 0) => {
    if (processed_nodes.has(node)) return;
    
    // Check if this is an export node (for languages with explicit export statements)
    if (is_export_node(node.type, language)) {
      processed_nodes.add(node);
      const node_exports = process_export_node(node, source_code, config, language);
      exports.push(...node_exports);
    }
    
    // Check for implicit exports (Python)
    if (config.features.implicit_exports && depth === 1) {
      if (is_exportable_definition(node.type, language)) {
        const implicit_export = process_implicit_export(node, source_code, language);
        if (implicit_export) {
          exports.push(implicit_export);
        }
      }
    }
    
    // For Rust, check for pub keyword on items (Rust uses visibility modifiers, not export statements)
    if (language === 'rust' && is_exportable_definition(node.type, language) && !processed_nodes.has(node)) {
      // Check for visibility modifier as first child or previous sibling
      let has_pub = false;
      
      // Check first child for visibility_modifier
      const first_child = node.children[0];
      if (first_child && first_child.type === 'visibility_modifier') {
        const vis_text = first_child.text;
        if (vis_text === 'pub' || vis_text.startsWith('pub ')) {
          has_pub = true;
        }
      }
      
      // Also check the node text itself
      const node_text = node.text;
      if (!has_pub && node_text.startsWith('pub ') && !node_text.startsWith('pub(')) {
        has_pub = true;
      }
      
      if (has_pub) {
        const name_node = node.childForFieldName('name');
        if (name_node && !processed_nodes.has(node)) {
          processed_nodes.add(node);
          exports.push({
            name: name_node.text,
            source: 'local',
            kind: 'named',
            location: node_to_location(node)
          });
        }
      }
    }
    
    // Check for special patterns that need bespoke handling
    const node_text = node.text.substring(0, 100); // Check first 100 chars
    
    if (config.features.commonjs_support && node_text.includes('module.exports')) {
      bespoke_hints.has_commonjs = true;
      requires_bespoke = true;
    }
    
    if (config.features.type_exports && node_text.includes('export type')) {
      bespoke_hints.has_type_exports = true;
      requires_bespoke = true;
    }
    
    if (config.features.visibility_modifiers && node_text.includes('pub(')) {
      bespoke_hints.has_visibility_modifiers = true;
      requires_bespoke = true;
    }
    
    if (config.features.export_list_identifier && 
        node_text.includes(config.features.export_list_identifier)) {
      bespoke_hints.has_export_list = true;
      requires_bespoke = true;
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child, depth + 1);
    }
  };
  
  visit(root_node);
  
  return {
    exports,
    requires_bespoke,
    bespoke_hints: requires_bespoke ? bespoke_hints : undefined
  };
}

/**
 * Process an export node using configuration
 */
function process_export_node(
  node: SyntaxNode,
  source_code: string,
  config: ExportLanguageConfig,
  language: Language
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const node_text = node.text;
  
  // Determine export type from patterns
  const is_default = matches_export_pattern(node_text, 'default_export', language);
  const is_reexport = matches_export_pattern(node_text, 'reexport', language);
  const is_namespace = matches_export_pattern(node_text, 'namespace_export', language);
  
  // Extract declaration or specifiers
  const declaration = node.childForFieldName(config.field_names.declaration || 'declaration');
  let specifiers = node.childForFieldName(config.field_names.specifiers || 'specifiers');
  const source = node.childForFieldName(config.field_names.source || 'source');
  
  // Also check for export_clause as a direct child (common in re-exports)
  if (!specifiers) {
    specifiers = node.children.find(c => c.type === 'export_clause');
  }
  
  if (declaration) {
    // Export with declaration (e.g., export function foo())
    if (declaration.type === 'lexical_declaration' || declaration.type === 'variable_declaration') {
      // For const/let/var declarations, look for variable_declarator
      for (const child of declaration.children) {
        if (child.type === 'variable_declarator') {
          const name_node = child.childForFieldName('name');
          if (name_node) {
            exports.push({
              name: name_node.text,
              source: 'local',
              kind: 'named',
              location: node_to_location(node)
            });
          }
        }
      }
    } else {
      // For function/class declarations, get name directly
      const name_node = declaration.childForFieldName(config.field_names.name || 'name');
      if (name_node) {
        exports.push({
          name: name_node.text,
          source: 'local',
          kind: is_default ? 'default' : 'named',
          location: node_to_location(node)
        });
      } else if (is_default) {
        // Default export with anonymous declaration
        exports.push({
          name: 'default',
          source: 'local',
          kind: 'default',
          location: node_to_location(node)
        });
      }
    }
  } else if (specifiers) {
    // Export with specifiers (e.g., export { foo, bar })
    const specifier_exports = process_export_specifiers(
      specifiers,
      source?.text,
      node
    );
    exports.push(...specifier_exports);
  } else if (is_namespace && source) {
    // Namespace export (e.g., export * from 'module')
    exports.push({
      name: '*',
      source: clean_module_source(source.text),
      kind: 'namespace',
      location: node_to_location(node)
    });
  } else if (is_default) {
    // Default export without declaration
    exports.push({
      name: 'default',
      source: 'local',
      kind: 'default',
      location: node_to_location(node)
    });
  } else {
    // Simple export statement - check for named exports in children
    for (const child of node.children) {
      if (child.type === 'lexical_declaration' || child.type === 'variable_declaration') {
        // export const/let/var
        for (const declarator_child of child.children) {
          if (declarator_child.type === 'variable_declarator') {
            const name = declarator_child.childForFieldName('name');
            if (name) {
              exports.push({
                name: name.text,
                source: 'local',
                kind: 'named',
                location: node_to_location(node)
              });
            }
          }
        }
      } else if (child.type === 'function_declaration' || child.type === 'class_declaration') {
        const name = child.childForFieldName('name');
        if (name) {
          exports.push({
            name: name.text,
            source: 'local',
            kind: 'named',
            location: node_to_location(node)
          });
        }
      }
    }
  }
  
  return exports;
}

/**
 * Process export specifiers
 */
function process_export_specifiers(
  specifiers_node: SyntaxNode,
  source_module: string | undefined,
  parent_node: SyntaxNode
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  // Handle export_clause directly (export { foo, bar })
  if (specifiers_node.type === 'export_clause') {
    for (const child of specifiers_node.children) {
      if (child.type === 'export_specifier') {
        const name = child.childForFieldName('name');
        const alias = child.childForFieldName('alias');
        
        if (name) {
          exports.push({
            name: alias?.text || name.text,
            source: source_module ? clean_module_source(source_module) : 'local',
            kind: 'named',
            location: node_to_location(child),
            original_name: alias ? name.text : undefined
          });
        }
      }
    }
  } else {
    // Handle other specifier types
    for (const child of specifiers_node.children) {
      if (child.type === 'export_specifier' || child.type === 'import_specifier') {
        const name = child.childForFieldName('name')?.text;
        const alias = child.childForFieldName('alias')?.text;
        
        if (name) {
          exports.push({
            name: alias || name,
            source: source_module ? clean_module_source(source_module) : 'local',
            kind: 'named',
            location: node_to_location(child),
            original_name: alias ? name : undefined
          });
        }
      }
    }
  }
  
  return exports;
}

/**
 * Process implicit export (Python)
 */
function process_implicit_export(
  node: SyntaxNode,
  source_code: string,
  language: Language
): ExportInfo | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const name = name_node.text;
  
  // Skip private symbols
  if (is_private_symbol(name, language)) {
    return null;
  }
  
  return {
    name,
    source: 'local',
    kind: 'named',
    location: node_to_location(node)
  };
}

/**
 * Convert tree-sitter node to location
 */
function node_to_location(node: SyntaxNode): Location {
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

/**
 * Clean module source string (remove quotes)
 */
function clean_module_source(source: string): string {
  return source.replace(/^['"`]|['"`]$/g, '');
}

/**
 * Merge generic and bespoke exports, removing duplicates
 */
export function merge_exports(
  generic_exports: ExportInfo[],
  bespoke_exports: ExportInfo[]
): ExportInfo[] {
  const merged: ExportInfo[] = [...generic_exports];
  const seen = new Set<string>();
  
  // Track existing exports by name and location
  for (const exp of generic_exports) {
    const key = `${exp.name}:${exp.location.start.line}:${exp.location.start.column}`;
    seen.add(key);
  }
  
  // Add bespoke exports that aren't duplicates
  for (const exp of bespoke_exports) {
    const key = `${exp.name}:${exp.location.start.line}:${exp.location.start.column}`;
    if (!seen.has(key)) {
      merged.push(exp);
      seen.add(key);
    }
  }
  
  return merged;
}

/**
 * Helper to check if processing needs bespoke handler
 */
export function needs_bespoke_processing(
  source_code: string,
  language: Language
): boolean {
  const config = get_export_config(language);
  
  // Quick checks for patterns that need bespoke handling
  if (config.features.commonjs_support && source_code.includes('module.exports')) {
    return true;
  }
  
  if (config.features.type_exports && source_code.includes('export type')) {
    return true;
  }
  
  if (config.features.visibility_modifiers && /pub\s*\(/.test(source_code)) {
    return true;
  }
  
  if (config.features.export_list_identifier) {
    const identifier = config.features.export_list_identifier;
    if (source_code.includes(identifier)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get export statistics for debugging
 */
export function get_export_stats(exports: ExportInfo[]): {
  total: number;
  by_kind: Record<string, number>;
  by_source: Record<string, number>;
} {
  const stats = {
    total: exports.length,
    by_kind: {} as Record<string, number>,
    by_source: {} as Record<string, number>
  };
  
  for (const exp of exports) {
    // Count by kind
    stats.by_kind[exp.kind] = (stats.by_kind[exp.kind] || 0) + 1;
    
    // Count by source
    const source_type = exp.source === 'local' ? 'local' : 'external';
    stats.by_source[source_type] = (stats.by_source[source_type] || 0) + 1;
  }
  
  return stats;
}