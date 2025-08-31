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

