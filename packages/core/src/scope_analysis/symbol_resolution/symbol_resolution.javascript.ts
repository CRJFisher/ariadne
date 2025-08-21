/**
 * JavaScript/TypeScript-specific symbol resolution
 * 
 * Handles JavaScript/TypeScript resolution patterns:
 * - Hoisted declarations
 * - Prototype chain resolution
 * - Module imports (CommonJS and ES6)
 * - This binding resolution
 */

// TODO: Namespace Resolution - Handle namespace.member patterns

import { SyntaxNode } from 'tree-sitter';
import { Position } from '@ariadnejs/types';
import {
  ResolvedSymbol,
  ResolutionContext,
  ImportInfo,
  ExportInfo,
  resolve_symbol,
  find_symbol_definition
} from './symbol_resolution';
import {
  ScopeTree,
  ScopeNode,
  get_scope_chain,
  find_scope_at_position
} from '../scope_tree';

/**
 * JavaScript-specific symbol resolution
 */
export function resolve_javascript_symbol(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  // Handle special JavaScript symbols
  if (is_javascript_global(symbol_name)) {
    return resolve_javascript_global(symbol_name, context);
  }
  
  // Handle 'this' keyword
  if (symbol_name === 'this') {
    return resolve_this_binding(scope_id, context);
  }
  
  // Handle 'super' keyword
  if (symbol_name === 'super') {
    return resolve_super_binding(scope_id, context);
  }
  
  // Handle prototype chain (e.g., Array.prototype.map)
  if (symbol_name.includes('.prototype.')) {
    return resolve_prototype_member(symbol_name, context);
  }
  
  // Use generic resolution
  return resolve_symbol(symbol_name, scope_id, context);
}

/**
 * Check if symbol is a JavaScript global
 */
function is_javascript_global(name: string): boolean {
  const globals = [
    // Global objects
    'window', 'document', 'console', 'process', 'global', 'self',
    // Built-in constructors
    'Array', 'Object', 'String', 'Number', 'Boolean', 'Symbol',
    'Function', 'RegExp', 'Date', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Promise', 'Proxy', 'Reflect',
    // Global functions
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'decodeURI', 'encodeURI',
    'decodeURIComponent', 'encodeURIComponent', 'eval',
    // Global values
    'undefined', 'null', 'NaN', 'Infinity',
    // Node.js globals
    'Buffer', 'require', 'module', 'exports', '__dirname', '__filename',
    // Timer functions
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'setImmediate', 'clearImmediate', 'requestAnimationFrame'
  ];
  
  return globals.includes(name);
}

/**
 * Resolve JavaScript global symbol
 */
function resolve_javascript_global(
  symbol_name: string,
  context: ResolutionContext
): ResolvedSymbol {
  const { scope_tree } = context;
  const root_scope = scope_tree.nodes.get(scope_tree.root_id)!;
  
  return {
    symbol: {
      name: symbol_name,
      kind: 'global',
      range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }
    },
    scope: root_scope,
    confidence: 'exact'
  };
}

/**
 * Resolve 'this' binding
 */
function resolve_this_binding(
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree } = context;
  const chain = get_scope_chain(scope_tree, scope_id);
  
  // Find the enclosing function or class
  for (const scope of chain) {
    if (scope.type === 'function') {
      // Check if it's a method (has class parent)
      const parent_scope = chain.find(s => s.type === 'class');
      if (parent_scope) {
        return {
          symbol: {
            name: 'this',
            kind: 'keyword',
            range: scope.range,
            type_info: parent_scope.metadata?.name
          },
          scope: scope,
          confidence: 'exact'
        };
      }
      
      // Regular function - 'this' depends on call site
      return {
        symbol: {
          name: 'this',
          kind: 'keyword',
          range: scope.range
        },
        scope: scope,
        confidence: 'likely'
      };
    }
    
    if (scope.type === 'class') {
      return {
        symbol: {
          name: 'this',
          kind: 'keyword',
          range: scope.range,
          type_info: scope.metadata?.name
        },
        scope: scope,
        confidence: 'exact'
      };
    }
  }
  
  // Global 'this'
  const root_scope = scope_tree.nodes.get(scope_tree.root_id)!;
  return {
    symbol: {
      name: 'this',
      kind: 'keyword',
      range: root_scope.range,
      type_info: 'global'
    },
    scope: root_scope,
    confidence: 'exact'
  };
}

/**
 * Resolve 'super' binding
 */
function resolve_super_binding(
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree } = context;
  const chain = get_scope_chain(scope_tree, scope_id);
  
  // Find enclosing class
  const class_scope = chain.find(s => s.type === 'class');
  if (!class_scope) return undefined;
  
  // 'super' refers to parent class
  // This would require class hierarchy information
  return {
    symbol: {
      name: 'super',
      kind: 'keyword',
      range: class_scope.range
    },
    scope: class_scope,
    confidence: 'likely'
  };
}

/**
 * Resolve prototype member
 */
function resolve_prototype_member(
  qualified_name: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const parts = qualified_name.split('.');
  if (parts.length < 3) return undefined;
  
  const constructor_name = parts[0];
  const prototype_keyword = parts[1];
  const member_name = parts.slice(2).join('.');
  
  if (prototype_keyword !== 'prototype') return undefined;
  
  // Check if constructor is a known type
  if (is_javascript_global(constructor_name)) {
    return {
      symbol: {
        name: member_name,
        kind: 'method',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } },
        type_info: `${constructor_name}.prototype.${member_name}`
      },
      scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
      confidence: 'exact'
    };
  }
  
  return undefined;
}

/**
 * Extract JavaScript imports from source
 */
export function extract_javascript_imports(
  root_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  // Traverse AST looking for import statements
  function traverse(node: SyntaxNode) {
    if (node.type === 'import_statement') {
      const extracted = extract_es6_import(node, source_code);
      if (extracted) imports.push(...extracted);
    } else if (node.type === 'variable_declarator') {
      // Check for require() calls
      const extracted = extract_commonjs_import(node, source_code);
      if (extracted) imports.push(extracted);
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) traverse(child);
    }
  }
  
  traverse(root_node);
  return imports;
}

/**
 * Extract ES6 imports from AST
 */
export function extract_es6_imports(
  root_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'import_statement') {
      const import_info = extract_es6_import(node, source_code);
      if (import_info) imports.push(...import_info);
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return imports;
}

/**
 * Extract ES6 import
 */
function extract_es6_import(
  import_node: SyntaxNode,
  source_code: string
): ImportInfo[] | undefined {
  const imports: ImportInfo[] = [];
  
  // Find import clause and source
  let import_clause = null;
  let source = null;
  
  for (let i = 0; i < import_node.childCount; i++) {
    const child = import_node.child(i);
    if (!child) continue;
    
    if (child.type === 'import_clause') {
      import_clause = child;
    } else if (child.type === 'string') {
      source = source_code.substring(child.startIndex + 1, child.endIndex - 1);
    }
  }
  
  if (!source) return undefined;
  
  if (!import_clause) {
    // Side-effect import: import 'module'
    return undefined;
  }
  
  // Process import clause
  for (let i = 0; i < import_clause.childCount; i++) {
    const child = import_clause.child(i);
    if (!child) continue;
    
    if (child.type === 'identifier') {
      // Default import
      imports.push({
        name: source_code.substring(child.startIndex, child.endIndex),
        module_path: source,
        is_default: true,
        range: {
          start: {
            row: import_node.startPosition.row,
            column: import_node.startPosition.column
          },
          end: {
            row: import_node.endPosition.row,
            column: import_node.endPosition.column
          }
        }
      });
    } else if (child.type === 'named_imports') {
      // Named imports: { a, b as c }
      for (let j = 0; j < child.childCount; j++) {
        const import_spec = child.child(j);
        if (!import_spec || import_spec.type !== 'import_specifier') continue;
        
        const imported = extract_import_specifier(import_spec, source_code);
        if (imported) {
          imports.push({
            name: imported.local,
            source_name: imported.imported !== imported.local ? imported.imported : undefined,
            module_path: source,
            range: {
              start: {
                row: import_node.startPosition.row,
                column: import_node.startPosition.column
              },
              end: {
                row: import_node.endPosition.row,
                column: import_node.endPosition.column
              }
            }
          });
        }
      }
    } else if (child.type === 'namespace_import') {
      // Namespace import: * as name
      const alias = child.child(2); // Skip * and as
      if (alias && alias.type === 'identifier') {
        imports.push({
          name: source_code.substring(alias.startIndex, alias.endIndex),
          module_path: source,
          is_namespace: true,
          range: {
            start: {
              row: import_node.startPosition.row,
              column: import_node.startPosition.column
            },
            end: {
              row: import_node.endPosition.row,
              column: import_node.endPosition.column
            }
          }
        });
      }
    }
  }
  
  return imports.length > 0 ? imports : undefined;
}

/**
 * Extract import specifier
 */
function extract_import_specifier(
  spec_node: SyntaxNode,
  source_code: string
): { imported: string; local: string } | undefined {
  let imported = '';
  let local = '';
  let has_as = false;
  
  for (let i = 0; i < spec_node.childCount; i++) {
    const child = spec_node.child(i);
    if (!child) continue;
    
    if (child.type === 'identifier') {
      const name = source_code.substring(child.startIndex, child.endIndex);
      if (!has_as) {
        imported = name;
        local = name;  // Default to same name
      } else {
        local = name;  // Name after 'as'
      }
    } else if (child.text === 'as') {
      has_as = true;
    }
  }
  
  return imported ? { imported, local } : undefined;
}

/**
 * Extract CommonJS imports from AST
 */
export function extract_commonjs_imports(
  root_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'variable_declaration' || node.type === 'lexical_declaration') {
      const import_info = extract_commonjs_import(node, source_code);
      if (import_info) imports.push(...import_info);
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return imports;
}

/**
 * Extract CommonJS import
 */
function extract_commonjs_import(
  declarator_node: SyntaxNode,
  source_code: string
): ImportInfo | undefined {
  const name_node = declarator_node.childForFieldName('name');
  const value_node = declarator_node.childForFieldName('value');
  
  if (!name_node || !value_node) return undefined;
  
  // Check if value is a require() call
  if (value_node.type === 'call_expression') {
    const func = value_node.childForFieldName('function');
    const args = value_node.childForFieldName('arguments');
    
    if (func && func.text === 'require' && args) {
      // Get module path from first argument
      for (let i = 0; i < args.childCount; i++) {
        const arg = args.child(i);
        if (arg && arg.type === 'string') {
          const module_path = source_code.substring(arg.startIndex + 1, arg.endIndex - 1);
          const var_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          
          return {
            name: var_name,
            module_path: module_path,
            range: {
              start: {
                row: declarator_node.startPosition.row,
                column: declarator_node.startPosition.column
              },
              end: {
                row: declarator_node.endPosition.row,
                column: declarator_node.endPosition.column
              }
            }
          };
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract JavaScript exports
 */
export function extract_javascript_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  function traverse(node: SyntaxNode) {
    if (node.type === 'export_statement') {
      const extracted = extract_es6_export(node, source_code);
      if (extracted) exports.push(...extracted);
    } else if (node.type === 'assignment_expression') {
      // Check for module.exports or exports.x
      const extracted = extract_commonjs_export(node, source_code);
      if (extracted) exports.push(extracted);
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) traverse(child);
    }
  }
  
  traverse(root_node);
  return exports;
}

/**
 * Extract ES6 exports from AST
 */
export function extract_es6_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'export_statement') {
      const export_info = extract_es6_export(node, source_code);
      if (export_info) exports.push(...export_info);
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
 * Extract ES6 export
 */
function extract_es6_export(
  export_node: SyntaxNode,
  source_code: string
): ExportInfo[] | undefined {
  const exports: ExportInfo[] = [];
  
  // Check for default export
  for (let i = 0; i < export_node.childCount; i++) {
    const child = export_node.child(i);
    if (child && child.type === 'default') {
      // Default export
      exports.push({
        name: 'default',
        is_default: true,
        range: {
          start: {
            row: export_node.startPosition.row,
            column: export_node.startPosition.column
          },
          end: {
            row: export_node.endPosition.row,
            column: export_node.endPosition.column
          }
        }
      });
      return exports;
    }
  }
  
  // Check for named exports
  for (let i = 0; i < export_node.childCount; i++) {
    const child = export_node.child(i);
    if (!child) continue;
    
    if (child.type === 'export_clause') {
      // export { a, b as c }
      for (let j = 0; j < child.childCount; j++) {
        const spec = child.child(j);
        if (spec && spec.type === 'export_specifier') {
          const exported = extract_export_specifier(spec, source_code);
          if (exported) {
            exports.push({
              name: exported.exported,
              local_name: exported.local !== exported.exported ? exported.local : undefined,
              range: {
                start: {
                  row: export_node.startPosition.row,
                  column: export_node.startPosition.column
                },
                end: {
                  row: export_node.endPosition.row,
                  column: export_node.endPosition.column
                }
              }
            });
          }
        }
      }
    } else if (child.type === 'declaration' || 
               child.type === 'lexical_declaration' || 
               child.type === 'variable_declaration' ||
               child.type === 'function_declaration' ||
               child.type === 'class_declaration') {
      // export const/let/function/class
      const name = extract_declaration_name(child, source_code);
      if (name) {
        exports.push({
          name: name,
          range: {
            start: {
              row: export_node.startPosition.row,
              column: export_node.startPosition.column
            },
            end: {
              row: export_node.endPosition.row,
              column: export_node.endPosition.column
            }
          }
        });
      }
    }
  }
  
  return exports.length > 0 ? exports : undefined;
}

/**
 * Extract export specifier
 */
function extract_export_specifier(
  spec_node: SyntaxNode,
  source_code: string
): { local: string; exported: string } | undefined {
  let local = '';
  let exported = '';
  let has_as = false;
  
  for (let i = 0; i < spec_node.childCount; i++) {
    const child = spec_node.child(i);
    if (!child) continue;
    
    if (child.type === 'identifier') {
      const name = source_code.substring(child.startIndex, child.endIndex);
      if (!has_as) {
        local = name;
        exported = name;  // Default to same name
      } else {
        exported = name;  // Name after 'as'
      }
    } else if (child.text === 'as') {
      has_as = true;
    }
  }
  
  return local ? { local, exported } : undefined;
}

/**
 * Extract declaration name
 */
function extract_declaration_name(
  decl_node: SyntaxNode,
  source_code: string
): string | undefined {
  const name_node = decl_node.childForFieldName('name');
  if (name_node) {
    return source_code.substring(name_node.startIndex, name_node.endIndex);
  }
  
  // For variable declarations, get first declarator
  if (decl_node.type === 'variable_declaration' || decl_node.type === 'lexical_declaration') {
    for (let i = 0; i < decl_node.childCount; i++) {
      const child = decl_node.child(i);
      if (child && child.type === 'variable_declarator') {
        const name = child.childForFieldName('name');
        if (name && name.type === 'identifier') {
          return source_code.substring(name.startIndex, name.endIndex);
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract CommonJS exports from AST
 */
export function extract_commonjs_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  const visit = (node: SyntaxNode) => {
    if (node.type === 'assignment_expression' || node.type === 'member_expression') {
      const export_info = extract_commonjs_export(node, source_code);
      if (export_info) exports.push(...export_info);
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
 * Extract CommonJS export
 */
function extract_commonjs_export(
  assign_node: SyntaxNode,
  source_code: string
): ExportInfo | undefined {
  const left = assign_node.childForFieldName('left');
  const right = assign_node.childForFieldName('right');
  
  if (!left || !right) return undefined;
  
  const left_text = source_code.substring(left.startIndex, left.endIndex);
  
  // module.exports = ...
  if (left_text === 'module.exports') {
    return {
      name: 'default',
      is_default: true,
      range: {
        start: {
          row: assign_node.startPosition.row,
          column: assign_node.startPosition.column
        },
        end: {
          row: assign_node.endPosition.row,
          column: assign_node.endPosition.column
        }
      }
    };
  }
  
  // exports.name = ...
  if (left_text.startsWith('exports.')) {
    const export_name = left_text.substring('exports.'.length);
    return {
      name: export_name,
      range: {
        start: {
          row: assign_node.startPosition.row,
          column: assign_node.startPosition.column
        },
        end: {
          row: assign_node.endPosition.row,
          column: assign_node.endPosition.column
        }
      }
    };
  }
  
  return undefined;
}