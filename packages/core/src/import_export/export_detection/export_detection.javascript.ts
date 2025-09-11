/**
 * JavaScript-specific bespoke export detection
 * 
 * Handles truly unique JavaScript export patterns that cannot be
 * expressed through configuration (~15% of logic)
 */

import { SyntaxNode } from 'tree-sitter';
import { ExportInfo } from '@ariadnejs/types';
import {
  node_to_location,
  clean_source,
  extract_name,
  find_child_of_type,
  get_function_modifiers
} from './bespoke_utils';

/**
 * Handle CommonJS exports (module.exports and exports.x patterns)
 * 
 * This is bespoke because CommonJS patterns are too complex and varied
 * to be fully captured by configuration patterns.
 */
export function handle_commonjs_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = source_code.split('\n');
  
  const visit = (node: SyntaxNode) => {
    // module.exports = value
    if (node.type === 'assignment_expression') {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      
      if (left?.text === 'module.exports' && right) {
        // Check if it's an object literal
        if (right.type === 'object') {
          // module.exports = { foo, bar }
          for (const prop of right.children) {
            if (prop.type === 'pair' || prop.type === 'shorthand_property_identifier') {
              const name = extract_name(prop);
              if (name) {
                exports.push({
                  name,
                  source: 'local',
                  kind: 'named',
                  location: node_to_location(prop)
                });
              }
            }
          }
        } else {
          // module.exports = SomeClass (default export)
          exports.push({
            name: 'default',
            source: 'local',
            kind: 'default',
            location: node_to_location(node),
            original_name: right.text
          });
        }
      }
      
      // exports.name = value or module.exports.name = value pattern
      if (left?.type === 'member_expression') {
        const object = left.childForFieldName('object');
        const property = left.childForFieldName('property');
        
        if ((object?.text === 'exports' || object?.text === 'module.exports') && property) {
          exports.push({
            name: property.text,
            source: 'local',
            kind: 'named',
            location: node_to_location(node)
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
 * Handle complex re-export patterns
 * 
 * Bespoke because re-export syntax has many variations that are
 * difficult to capture with simple patterns.
 */
export function handle_complex_reexports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'export_statement') {
      const source = node.childForFieldName('source');
      
      // export { default } from './module'
      // export { default as MyName } from './module'
      if (source && node.text.includes('default')) {
        // Look for export_clause which contains the specifiers
        const export_clause = node.children.find(c => c.type === 'export_clause');
        if (export_clause) {
          for (const spec of export_clause.children) {
            if (spec.type === 'export_specifier') {
              const name = spec.childForFieldName('name');
              const alias = spec.childForFieldName('alias');
              
              if (name?.text === 'default') {
                exports.push({
                  name: alias?.text || 'default',
                  source: clean_source(source.text),
                  kind: 'default',
                  location: node_to_location(spec)
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
 * Handle dynamic exports (computed property names)
 * 
 * Bespoke because these patterns involve runtime evaluation
 */
export function handle_dynamic_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // exports[someVariable] = value
    if (node.type === 'assignment_expression') {
      const left = node.childForFieldName('left');
      
      if (left?.type === 'subscript_expression') {
        const object = left.childForFieldName('object');
        const index = left.childForFieldName('index');
        
        if ((object?.text === 'exports' || object?.text === 'module.exports') && index) {
          // Try to extract the index if it's a string literal
          let export_name = '<dynamic>';
          if (index.type === 'string') {
            export_name = clean_source(index.text);
          }
          
          exports.push({
            name: export_name,
            source: 'local',
            kind: 'named',
            location: node_to_location(node),
            is_dynamic: export_name === '<dynamic>'
          });
        }
      }
    }
    
    // Object.defineProperty(exports, ...) pattern
    if (node.type === 'call_expression') {
      const function_node = node.childForFieldName('function');
      const arguments_node = node.childForFieldName('arguments');
      
      if (function_node) {
        const func_text = function_node.text;
        if (func_text === 'Object.defineProperty' && arguments_node) {
          const args = arguments_node.children.filter(
            c => c.type !== ',' && c.type !== '(' && c.type !== ')'
          );
          
          if (args.length >= 2) {
            const target = args[0];
            const property = args[1];
            
            if (target && (target.text === 'exports' || target.text === 'module.exports')) {
              const prop_name = property.type === 'string' ? 
                clean_source(property.text) : '<dynamic>';
              
              exports.push({
                name: prop_name,
                source: 'local',
                kind: 'named',
                location: node_to_location(node),
                is_defineProperty: true,
                is_dynamic: prop_name === '<dynamic>'
              });
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

