/**
 * Python-specific bespoke export detection
 * 
 * Handles truly unique Python export patterns that cannot be
 * expressed through configuration (~10% of logic)
 */

import { SyntaxNode } from 'tree-sitter';
import { ExportInfo } from '@ariadnejs/types';

/**
 * Handle __all__ list exports
 * 
 * Bespoke because __all__ can have complex list comprehensions,
 * concatenations, and dynamic modifications that require special parsing.
 */
export function handle_all_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // __all__ = [...]
    if (node.type === 'assignment') {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      
      if (left?.text === '__all__' && right) {
        const all_exports = parse_all_list(right);
        for (const name of all_exports) {
          exports.push({
            name,
            source: 'local',
            kind: 'named',
            location: node_to_location(node),
            from_all: true
          });
        }
      }
    }
    
    // __all__.append('name') or __all__.extend([...])
    if (node.type === 'call') {
      const function_node = node.childForFieldName('function');
      if (function_node?.type === 'attribute') {
        const object = function_node.childForFieldName('object');
        const attribute = function_node.childForFieldName('attribute');
        
        if (object?.text === '__all__') {
          const arguments_node = node.childForFieldName('arguments');
          
          if (attribute?.text === 'append' && arguments_node) {
            // Extract single name from append
            const arg = arguments_node.children.find(c => c.type === 'string');
            if (arg) {
              const name = clean_string(arg.text);
              exports.push({
                name,
                source: 'local',
                kind: 'named',
                location: node_to_location(node),
                from_all: true,
                dynamic_append: true
              });
            }
          } else if (attribute?.text === 'extend' && arguments_node) {
            // Extract multiple names from extend
            const list_arg = arguments_node.children.find(c => c.type === 'list');
            if (list_arg) {
              const names = parse_all_list(list_arg);
              for (const name of names) {
                exports.push({
                  name,
                  source: 'local',
                  kind: 'named',
                  location: node_to_location(node),
                  from_all: true,
                  dynamic_extend: true
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
 * Handle conditional exports
 * 
 * Python can have exports inside if statements based on conditions
 */
export function handle_conditional_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode, in_conditional: boolean = false) => {
    // Track if we're inside an if statement
    if (node.type === 'if_statement') {
      const condition = node.childForFieldName('condition');
      
      // Common patterns like if __name__ == '__main__' exclude exports
      if (condition?.text.includes('__name__') && condition.text.includes('__main__')) {
        // Skip this branch - not exported
        return;
      }
      
      // Visit children with conditional context
      for (const child of node.children) {
        visit(child, true);
      }
      return;
    }
    
    // Function or class definition inside conditional
    if (in_conditional && (node.type === 'function_definition' || node.type === 'class_definition')) {
      const name = node.childForFieldName('name');
      if (name && !name.text.startsWith('_')) {
        exports.push({
          name: name.text,
          source: 'local',
          kind: 'named',
          location: node_to_location(node),
          conditional: true
        });
      }
    }
    
    // Continue traversal
    if (!in_conditional) {
      for (const child of node.children) {
        visit(child, in_conditional);
      }
    }
  };
  
  visit(root_node);
  return exports;
}

/**
 * Handle star imports that become exports
 * 
 * from module import * makes all imported names available for export
 */
export function handle_star_import_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    // from module import *
    if (node.type === 'import_from_statement') {
      const module_name = node.childForFieldName('module_name');
      const import_list = node.children.find(c => c.type === 'wildcard_import');
      
      if (import_list) {
        exports.push({
          name: '*',
          source: module_name?.text || '<unknown>',
          kind: 'namespace',
          location: node_to_location(node),
          star_import: true
        });
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
 * Handle decorated exports
 * 
 * Python decorators can affect export behavior
 */
export function handle_decorated_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'decorated_definition') {
      const decorators = node.children.filter(c => c.type === 'decorator');
      const definition = node.children.find(c => 
        c.type === 'function_definition' || c.type === 'class_definition'
      );
      
      if (definition) {
        const name = definition.childForFieldName('name');
        if (name && !name.text.startsWith('_')) {
          // Check for export-related decorators
          const has_export_decorator = decorators.some(d => {
            const decorator_text = d.text;
            return decorator_text.includes('export') || 
                   decorator_text.includes('public') ||
                   decorator_text.includes('api');
          });
          
          exports.push({
            name: name.text,
            source: 'local',
            kind: 'named',
            location: node_to_location(node),
            decorated: true,
            explicit_export: has_export_decorator
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
 * Parse __all__ list including complex patterns
 */
function parse_all_list(list_node: SyntaxNode): string[] {
  const names: string[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'string') {
      names.push(clean_string(node.text));
    } else if (node.type === 'concatenated_string') {
      // Handle string concatenation in __all__
      for (const child of node.children) {
        if (child.type === 'string') {
          names.push(clean_string(child.text));
        }
      }
    } else if (node.type === 'list_comprehension') {
      // __all__ = [name for name in dir() if not name.startswith('_')]
      // Mark as dynamic - can't determine statically
      names.push('<dynamic>');
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(list_node);
  return names;
}

function clean_string(str: string): string {
  return str.replace(/^['"`]|['"`]$/g, '');
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