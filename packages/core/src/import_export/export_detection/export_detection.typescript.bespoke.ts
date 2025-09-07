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
      
      // Check for export_clause which contains specifiers
      const export_clause = node.children.find(c => c.type === 'export_clause');
      
      if (export_clause) {
        // Process export_clause containing type exports
        for (const spec of export_clause.children) {
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
      } else if (specifiers) {
        // Handle direct specifiers
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
    // Simple check: if the node text starts with "export namespace" or "export module"
    if (!in_namespace && (node.text.startsWith('export namespace') || node.text.startsWith('export module'))) {
      // Extract the namespace name using simple parsing
      const match = node.text.match(/export\s+(namespace|module)\s+(\w+)/);
      if (match) {
        const namespaceName = match[2];
        exports.push({
          name: namespaceName,
          source: 'local',
          kind: 'namespace',
          location: node_to_location(node)
        });
        
        // Find and process the body - look for statement_block which contains the namespace body
        const processBody = (n: SyntaxNode) => {
          for (const child of n.children) {
            if (child.type === 'statement_block') {
              // Process namespace body members
              for (const member of child.children) {
                visit(member, true);
              }
              return;
            } else if (child.children.length > 0) {
              processBody(child);
            }
          }
        };
        processBody(node);
        return;
      }
    }
    
    // Handle exports within a namespace (including nested namespaces)
    if (in_namespace) {
      // Check for nested namespace first
      if (node.text.startsWith('export namespace') || node.text.startsWith('export module')) {
        const match = node.text.match(/export\s+(namespace|module)\s+(\w+)/);
        if (match) {
          const nestedNamespaceName = match[2];
          exports.push({
            name: nestedNamespaceName,
            source: 'local',
            kind: 'namespace',
            location: node_to_location(node)
          });
          
          // Process nested namespace body recursively
          const processBody = (n: SyntaxNode) => {
            for (const child of n.children) {
              if (child.type === 'statement_block') {
                for (const member of child.children) {
                  visit(member, true);
                }
                return;
              } else if (child.children.length > 0) {
                processBody(child);
              }
            }
          };
          processBody(node);
          return;
        }
      }
      
      // Handle regular exports within namespace
      if (node.type === 'export_statement' || node.text.startsWith('export ')) {
        // Extract exported member name
        const functionMatch = node.text.match(/export\s+function\s+(\w+)/);
        const classMatch = node.text.match(/export\s+class\s+(\w+)/);
        const interfaceMatch = node.text.match(/export\s+interface\s+(\w+)/);
        const typeMatch = node.text.match(/export\s+type\s+(\w+)/);
        const constMatch = node.text.match(/export\s+const\s+(\w+)/);
        
        let memberName: string | null = null;
        let memberKind = 'named';
        
        if (functionMatch) {
          memberName = functionMatch[1];
          memberKind = 'function';
        } else if (classMatch) {
          memberName = classMatch[1];
          memberKind = 'class';
        } else if (interfaceMatch) {
          memberName = interfaceMatch[1];
          memberKind = 'interface';
        } else if (typeMatch) {
          memberName = typeMatch[1];
          memberKind = 'type';
        } else if (constMatch) {
          memberName = constMatch[1];
          memberKind = 'named';
        }
        
        if (memberName) {
          exports.push({
            name: memberName,
            source: 'local',
            kind: memberKind,
            location: node_to_location(node),
            namespace_export: true
          });
        }
      }
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child, in_namespace);
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
    // Handle regular export statements
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
    
    // Also handle namespace exports for merging (simplified text-based approach)
    if (node.text.startsWith('export namespace') || node.text.startsWith('export module')) {
      const match = node.text.match(/export\s+(namespace|module)\s+(\w+)/);
      if (match) {
        const namespaceName = match[2];
        const export_info: ExportInfo = {
          name: namespaceName,
          source: 'local',
          kind: 'namespace',
          location: node_to_location(node)
        };
        
        if (!merged_declarations.has(namespaceName)) {
          merged_declarations.set(namespaceName, []);
        }
        merged_declarations.get(namespaceName)!.push(export_info);
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
    case 'namespace_declaration':
    case 'module_declaration': return 'namespace';
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