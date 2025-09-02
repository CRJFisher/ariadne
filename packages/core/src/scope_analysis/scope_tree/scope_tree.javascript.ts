/**
 * JavaScript-specific scope tree building
 * 
 * Handles JavaScript scoping rules:
 * - Function scope for var
 * - Block scope for let/const
 * - Hoisting of function declarations
 * - Closure scopes
 */

// TODO: Usage Finder - Search scope tree for references

import { SyntaxNode } from 'tree-sitter';
import {
  ScopeNode,
  ScopeSymbol,
  ScopeTree,
  ScopeTreeContext,
  ScopeType,
  create_scope_tree,
  find_scope_at_position,
  get_scope_chain
} from './scope_tree';

/**
 * Build JavaScript-specific scope tree
 */
export function build_javascript_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  file_path?: string
): ScopeTree {
  const tree = create_scope_tree(file_path || 'javascript', root_node);
  
  // Update root node range (already set by create_scope_tree)
  const root_scope = tree.nodes.get(tree.root_id)!;
  
  const context: JavaScriptScopeContext = {
    language: 'javascript',
    source_code,
    file_path,
    current_scope_id: tree.root_id,
    scope_id_counter: 1,
    in_strict_mode: false
  };
  
  // Check for strict mode
  context.in_strict_mode = check_strict_mode(root_node, source_code);
  
  // Traverse and build
  traverse_javascript_ast(root_node, tree, context);
  
  // Handle hoisting after initial build
  hoist_declarations(tree);
  
  return tree;
}

interface JavaScriptScopeContext extends ScopeTreeContext {
  in_strict_mode: boolean;
}

/**
 * Check if code is in strict mode
 */
function check_strict_mode(node: SyntaxNode, source_code: string): boolean {
  // Look for "use strict" directive
  for (let i = 0; i < Math.min(5, node.childCount); i++) {
    const child = node.child(i);
    if (child && child.type === 'expression_statement') {
      const expr = child.firstChild;
      if (expr && expr.type === 'string') {
        const text = source_code.substring(expr.startIndex, expr.endIndex);
        if (text === '"use strict"' || text === "'use strict'") {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Traverse JavaScript AST and build scopes
 */
function traverse_javascript_ast(
  node: SyntaxNode,
  tree: ScopeTree,
  context: JavaScriptScopeContext
) {
  // Check if this node creates a new scope
  if (creates_javascript_scope(node)) {
    const scope_id = `scope_${context.scope_id_counter++}`;
    const scope_type = get_javascript_scope_type(node);
    
    const new_scope: ScopeNode = {
      id: scope_id,
      type: scope_type,
      range: {
        start: {
          row: node.startPosition.row,
          column: node.startPosition.column
        },
        end: {
          row: node.endPosition.row,
          column: node.endPosition.column
        }
      },
      parent_id: context.current_scope_id,
      child_ids: [],
      symbols: new Map(),
      metadata: extract_javascript_scope_metadata(node, context.source_code)
    };
    
    // Add to tree
    tree.nodes.set(scope_id, new_scope);
    
    // Link to parent
    const parent_scope = tree.nodes.get(context.current_scope_id!);
    if (parent_scope) {
      parent_scope.child_ids.push(scope_id);
      
      // If this is a named function or class, add it as a symbol to the parent scope
      if (node.type === 'function_declaration' || node.type === 'class_declaration') {
        const symbol = extract_javascript_symbol(node, context);
        if (symbol) {
          parent_scope.symbols.set(symbol.name, symbol);
        }
      }
    }
    
    // Process parameters first (they're in the function scope)
    if (is_function_like(node)) {
      extract_parameters(node, new_scope, context.source_code);
    }
    
    // Update context for children
    const child_context = { ...context, current_scope_id: scope_id };
    
    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_javascript_ast(child, tree, child_context);
      }
    }
  } else {
    // Check for symbol definitions
    const symbol = extract_javascript_symbol(node, context);
    if (symbol) {
      const current_scope = tree.nodes.get(context.current_scope_id!);
      if (current_scope) {
        current_scope.symbols.set(symbol.name, symbol);
      }
    }
    
    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_javascript_ast(child, tree, context);
      }
    }
  }
}

/**
 * Check if node creates a JavaScript scope
 */
function creates_javascript_scope(node: SyntaxNode): boolean {
  return [
    'function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition',
    'class_declaration',
    'class_expression',
    'statement_block',
    'for_statement',
    'for_in_statement',
    'for_of_statement',
    'catch_clause',
    'switch_statement'
  ].includes(node.type);
}

/**
 * Get JavaScript scope type
 */
function get_javascript_scope_type(node: SyntaxNode): ScopeType {
  switch (node.type) {
    case 'function_declaration':
    case 'function_expression':
    case 'arrow_function':
    case 'method_definition':
      return 'function';
    
    case 'class_declaration':
    case 'class_expression':
      return 'class';
    
    default:
      return 'block';
  }
}

/**
 * Check if node is function-like
 */
function is_function_like(node: SyntaxNode): boolean {
  return [
    'function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition'
  ].includes(node.type);
}

/**
 * Extract parameters from function
 */
function extract_parameters(
  func_node: SyntaxNode,
  scope: ScopeNode,
  source_code: string
) {
  const params = func_node.childForFieldName('parameters');
  if (!params) return;
  
  for (let i = 0; i < params.childCount; i++) {
    const param = params.child(i);
    if (!param || param.type === '(' || param.type === ')' || param.type === ',') {
      continue;
    }
    
    const param_symbol = extract_parameter_symbol(param, source_code);
    if (param_symbol) {
      scope.symbols.set(param_symbol.name, param_symbol);
    }
  }
}

/**
 * Extract parameter as symbol
 */
function extract_parameter_symbol(
  param_node: SyntaxNode,
  source_code: string
): ScopeSymbol | undefined {
  let name: string | undefined;
  
  if (param_node.type === 'identifier') {
    name = source_code.substring(param_node.startIndex, param_node.endIndex);
  } else if (param_node.type === 'rest_pattern') {
    const ident = param_node.child(1); // Skip ...
    if (ident && ident.type === 'identifier') {
      name = source_code.substring(ident.startIndex, ident.endIndex);
    }
  } else if (param_node.type === 'assignment_pattern') {
    const left = param_node.childForFieldName('left');
    if (left && left.type === 'identifier') {
      name = source_code.substring(left.startIndex, left.endIndex);
    }
  }
  
  if (name) {
    return {
      name,
      kind: 'parameter',
      range: {
        start: {
          row: param_node.startPosition.row,
          column: param_node.startPosition.column
        },
        end: {
          row: param_node.endPosition.row,
          column: param_node.endPosition.column
        }
      }
    };
  }
  
  return undefined;
}

/**
 * Extract JavaScript symbol
 */
function extract_javascript_symbol(
  node: SyntaxNode,
  context: JavaScriptScopeContext
): ScopeSymbol | undefined {
  const { source_code } = context;
  
  // Variable declarations
  if (node.type === 'variable_declarator') {
    const name_node = node.childForFieldName('name');
    if (name_node && name_node.type === 'identifier') {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      
      // Determine if it's hoisted (var)
      let is_hoisted = false;
      let parent = node.parent;
      while (parent && parent.type !== 'variable_declaration') {
        parent = parent.parent;
      }
      if (parent) {
        const keyword = parent.firstChild;
        is_hoisted = keyword?.text === 'var';
      }
      
      return {
        name,
        kind: 'variable',
        range: {
          start: {
            row: node.startPosition.row,
            column: node.startPosition.column
          },
          end: {
            row: node.endPosition.row,
            column: node.endPosition.column
          }
        },
        is_hoisted
      };
    }
  }
  
  // Function declarations (hoisted)
  if (node.type === 'function_declaration') {
    const name_node = node.childForFieldName('name');
    if (name_node) {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      return {
        name,
        kind: 'function',
        range: {
          start: {
            row: node.startPosition.row,
            column: node.startPosition.column
          },
          end: {
            row: node.endPosition.row,
            column: node.endPosition.column
          }
        },
        is_hoisted: true
      };
    }
  }
  
  // Class declarations
  if (node.type === 'class_declaration') {
    const name_node = node.childForFieldName('name');
    if (name_node) {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      return {
        name,
        kind: 'class',
        range: {
          start: {
            row: node.startPosition.row,
            column: node.startPosition.column
          },
          end: {
            row: node.endPosition.row,
            column: node.endPosition.column
          }
        }
      };
    }
  }
  
  return undefined;
}

/**
 * Extract JavaScript scope metadata
 */
function extract_javascript_scope_metadata(
  node: SyntaxNode,
  source_code: string
): Record<string, any> | undefined {
  const metadata: Record<string, any> = {};
  
  // Extract function/class name
  const name_node = node.childForFieldName('name');
  if (name_node) {
    metadata.name = source_code.substring(name_node.startIndex, name_node.endIndex);
  }
  
  // Check for async functions
  if (is_function_like(node)) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'async') {
        metadata.is_async = true;
      } else if (child && child.type === '*') {
        metadata.is_generator = true;
      }
    }
  }
  
  // Check for static methods
  if (node.type === 'method_definition') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'static') {
        metadata.is_static = true;
      }
    }
  }
  
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Hoist var declarations and function declarations
 */
function hoist_declarations(tree: ScopeTree) {
  for (const [scope_id, scope] of tree.nodes) {
    const hoisted_symbols: ScopeSymbol[] = [];
    
    // Find hoisted symbols
    for (const [name, symbol] of scope.symbols) {
      if (symbol.is_hoisted) {
        hoisted_symbols.push(symbol);
      }
    }
    
    // Move hoisted symbols to function scope
    for (const symbol of hoisted_symbols) {
      // Find the enclosing function scope
      const function_scope = find_enclosing_function_scope(tree, scope_id);
      if (function_scope && function_scope.id !== scope_id) {
        // Remove from current scope
        scope.symbols.delete(symbol.name);
        // Add to function scope
        function_scope.symbols.set(symbol.name, symbol);
      }
    }
  }
}

/**
 * Find enclosing function scope
 */
function find_enclosing_function_scope(
  tree: ScopeTree,
  scope_id: string
): ScopeNode | undefined {
  const chain = get_scope_chain(tree, scope_id);
  
  for (const scope of chain) {
    if (scope.type === 'function' || scope.type === 'global') {
      return scope;
    }
  }
  
  return undefined;
}

/**
 * Handle JavaScript-specific scope resolution
 */
export function resolve_javascript_symbol(
  tree: ScopeTree,
  scope_id: string,
  symbol_name: string
): { symbol: ScopeSymbol; scope: ScopeNode } | undefined {
  const chain = get_scope_chain(tree, scope_id);
  
  // Check each scope in the chain
  for (const scope of chain) {
    const symbol = scope.symbols.get(symbol_name);
    if (symbol) {
      return { symbol, scope };
    }
    
    // Stop at function boundary for certain symbols
    if (scope.type === 'function' && !is_global_object(symbol_name)) {
      // Check if symbol might be in closure
      const closure_symbol = check_closure_capture(tree, scope, symbol_name);
      if (closure_symbol) {
        return closure_symbol;
      }
    }
  }
  
  return undefined;
}

/**
 * Check if symbol is a global object
 */
function is_global_object(name: string): boolean {
  const globals = [
    'window', 'document', 'console', 'process', 'global',
    'Array', 'Object', 'String', 'Number', 'Boolean',
    'Promise', 'Map', 'Set', 'Symbol', 'Date', 'Math',
    'JSON', 'RegExp', 'Error', 'undefined', 'null'
  ];
  return globals.includes(name);
}

/**
 * Check for closure capture
 */
function check_closure_capture(
  tree: ScopeTree,
  function_scope: ScopeNode,
  symbol_name: string
): { symbol: ScopeSymbol; scope: ScopeNode } | undefined {
  // Continue searching in parent scopes (closure)
  if (function_scope.parent_id) {
    const parent_chain = get_scope_chain(tree, function_scope.parent_id);
    for (const scope of parent_chain) {
      const symbol = scope.symbols.get(symbol_name);
      if (symbol) {
        return { symbol, scope };
      }
    }
  }
  
  return undefined;
}