/**
 * TypeScript-specific bespoke export detection
 * 
 * Handles truly unique TypeScript export patterns that cannot be
 * expressed through configuration (~10% of logic)
 */

import { SyntaxNode } from 'tree-sitter';
import { ExportInfo } from '@ariadnejs/types';
import {
  handle_commonjs_exports,
  handle_complex_reexports,
  handle_dynamic_exports
} from './export_detection.javascript.bespoke';

/**
 * Handle TypeScript type-only exports
 * 
 * Bespoke because type exports require special handling to distinguish
 * from value exports and have complex syntax variations.
 */
export function handle_type_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // export type { Foo, Bar } from './types'
    if (node.type === 'export_statement' && node.text.startsWith('export type')) {
      const specifiers = node.childForFieldName('specifiers');
      const source = node.childForFieldName('source');
      
      if (specifiers) {
        for (const spec of specifiers.children) {
          if (spec.type === 'export_specifier' || spec.type === 'import_specifier') {
            const name = spec.childForFieldName('name');
            const alias = spec.childForFieldName('alias');
            
            if (name) {
              exports.push({
                name: alias?.text || name.text,
                source: source ? clean_source(source.text) : 'local',
                kind: 'type',
                location: node_to_location(spec),
                original_name: alias ? name.text : undefined
              });
            }
          }
        }
      } else {
        // export type Foo = ...
        const declaration = node.childForFieldName('declaration');
        if (declaration) {
          const name = declaration.childForFieldName('name');
          if (name) {
            exports.push({
              name: name.text,
              source: 'local',
              kind: 'type',
              location: node_to_location(node)
            });
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
 * Handle namespace exports with type checking
 * 
 * Bespoke because TypeScript namespaces have complex nested structures
 */
export function handle_namespace_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode, in_namespace: boolean = false) => {
    // export namespace MyNamespace { ... }
    if (node.type === 'module_declaration' || node.type === 'namespace_declaration') {
      const is_exported = node.previousSibling?.text === 'export' ||
                          node.parent?.type === 'export_statement';
      
      if (is_exported) {
        const name = node.childForFieldName('name');
        if (name) {
          exports.push({
            name: name.text,
            source: 'local',
            kind: 'namespace',
            location: node_to_location(node)
          });
        }
        
        // Visit children with namespace context
        for (const child of node.children) {
          visit(child, true);
        }
      }
    }
    
    // Export items within namespace
    if (in_namespace && node.type === 'export_statement') {
      const declaration = node.childForFieldName('declaration');
      if (declaration) {
        const name = declaration.childForFieldName('name');
        if (name) {
          exports.push({
            name: name.text,
            source: 'local',
            kind: 'named',
            location: node_to_location(node),
            namespace_export: true
          });
        }
      }
    }
    
    // Continue traversal
    if (!in_namespace) {
      for (const child of node.children) {
        visit(child, in_namespace);
      }
    }
  };
  
  visit(root_node);
  return exports;
}

/**
 * Handle declaration merging exports
 * 
 * TypeScript allows multiple declarations with the same name to be merged
 */
export function handle_declaration_merging(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const merged_declarations = new Map<string, ExportInfo[]>();
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'export_statement') {
      const declaration = node.childForFieldName('declaration');
      if (declaration) {
        const name = declaration.childForFieldName('name');
        if (name) {
          const export_info: ExportInfo = {
            name: name.text,
            source: 'local',
            kind: get_declaration_kind(declaration),
            location: node_to_location(node)
          };
          
          // Track for merging
          if (!merged_declarations.has(name.text)) {
            merged_declarations.set(name.text, []);
          }
          merged_declarations.get(name.text)!.push(export_info);
        }
      }
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  
  // Process merged declarations
  for (const [name, declarations] of merged_declarations) {
    if (declarations.length > 1) {
      // Mark as merged declaration
      exports.push({
        name,
        source: 'local',
        kind: 'merged',
        location: declarations[0].location,
        merged_kinds: declarations.map(d => d.kind)
      });
    } else {
      exports.push(declarations[0]);
    }
  }
  
  return exports;
}

/**
 * Get all TypeScript bespoke exports
 */
export function get_typescript_bespoke_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  // Include JavaScript bespoke patterns
  exports.push(...handle_commonjs_exports(root_node, source_code));
  exports.push(...handle_complex_reexports(root_node, source_code));
  exports.push(...handle_dynamic_exports(root_node, source_code));
  
  // Add TypeScript-specific patterns
  exports.push(...handle_type_exports(root_node, source_code));
  exports.push(...handle_namespace_exports(root_node, source_code));
  exports.push(...handle_declaration_merging(root_node, source_code));
  
  return exports;
}

function get_declaration_kind(declaration: SyntaxNode): string {
  switch (declaration.type) {
    case 'interface_declaration': return 'interface';
    case 'type_alias_declaration': return 'type';
    case 'class_declaration': return 'class';
    case 'function_declaration': return 'function';
    case 'enum_declaration': return 'enum';
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

function clean_source(source: string): string {
  return source.replace(/^['"`]|['"`]$/g, '');
}