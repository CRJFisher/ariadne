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

// ============================================================================
// JavaScript-specific Definition Finding (merged from definition_finder)
// ============================================================================

import { Def, SymbolKind } from '@ariadnejs/types';
import { DefinitionResult } from './symbol_resolution';

/**
 * Find JavaScript constructor definition
 */
export function find_constructor_definition(
  class_name: string,
  context: ResolutionContext
): DefinitionResult | undefined {
  const { scope_tree, file_path } = context;
  
  // Look for class declaration
  const class_def = find_symbol_definition(class_name, scope_tree.root_id, context);
  if (class_def && class_def.definition.symbol_kind === 'class') {
    return class_def;
  }
  
  // Look for constructor function
  const func_def = find_symbol_definition(class_name, scope_tree.root_id, context);
  if (func_def && func_def.definition.symbol_kind === 'function') {
    // Check if it looks like a constructor (capital first letter)
    if (class_name[0] === class_name[0].toUpperCase()) {
      return {
        ...func_def,
        definition: {
          ...func_def.definition,
          symbol_kind: 'class' as SymbolKind // Treat as constructor
        }
      };
    }
  }
  
  return undefined;
}

/**
 * Find prototype method definition
 */
export function find_prototype_method(
  class_name: string,
  method_name: string,
  context: ResolutionContext
): DefinitionResult | undefined {
  const { scope_tree, file_path } = context;
  
  // Find the class definition first
  const class_def = find_constructor_definition(class_name, context);
  if (!class_def) return undefined;
  
  // Find the class scope
  for (const [scope_id, scope] of scope_tree.nodes) {
    if (scope.type === 'class' && scope.metadata?.name === class_name) {
      // Look for method in class scope
      const method_symbol = scope.symbols.get(method_name);
      if (method_symbol) {
        const def: Def = {
          id: `def_${scope_id}_${method_name}`,
          kind: 'definition',
          name: method_name,
          symbol_kind: 'function' as SymbolKind,
          range: method_symbol.range,
          file_path
        };
        
        return {
          definition: def,
          confidence: 'exact',
          source: 'local'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Find object property definition
 */
export function find_object_property(
  object_name: string,
  property_name: string,
  context: ResolutionContext
): DefinitionResult | undefined {
  const { scope_tree, file_path } = context;
  
  // Look for object definition
  const object_def = find_symbol_definition(object_name, scope_tree.root_id, context);
  if (!object_def) return undefined;
  
  // Try to find the property in the object's scope
  // This would require more sophisticated object literal tracking
  // For now, return undefined
  return undefined;
}

/**
 * Find arrow function definition
 */
export function find_arrow_function(
  function_name: string,
  context: ResolutionContext
): DefinitionResult | undefined {
  // Arrow functions are stored as variables, so use regular symbol resolution
  return find_symbol_definition(function_name, context.scope_tree.root_id, context);
}

/**
 * Find all functions in the file
 */
export function find_all_functions(
  context: ResolutionContext
): Def[] {
  const functions: Def[] = [];
  const { scope_tree, file_path } = context;
  
  for (const [scope_id, scope] of scope_tree.nodes) {
    for (const [symbol_name, symbol] of scope.symbols) {
      if (symbol.kind === 'function') {
        const def: Def = {
          id: `def_${scope_id}_${symbol_name}`,
          kind: 'definition',
          name: symbol_name,
          symbol_kind: 'function' as SymbolKind,
          range: symbol.range,
          file_path
        };
        functions.push(def);
      }
    }
  }
  
  return functions;
}

/**
 * Find all classes in the file
 */
export function find_all_classes(
  context: ResolutionContext
): Def[] {
  const classes: Def[] = [];
  const { scope_tree, file_path } = context;
  
  for (const [scope_id, scope] of scope_tree.nodes) {
    for (const [symbol_name, symbol] of scope.symbols) {
      if (symbol.kind === 'class') {
        const def: Def = {
          id: `def_${scope_id}_${symbol_name}`,
          kind: 'definition',
          name: symbol_name,
          symbol_kind: 'class' as SymbolKind,
          range: symbol.range,
          file_path
        };
        classes.push(def);
      }
    }
  }
  
  return classes;
}

/**
 * Check if definition is hoisted (function declarations and var)
 */
export function is_hoisted_definition(
  def: Def,
  scope_tree: ScopeTree
): boolean {
  // Function declarations are hoisted
  if (def.symbol_kind === 'function') {
    return true;
  }
  
  // var declarations are hoisted (but not their initialization)
  // This would require checking the declaration type
  // For now, we can't differentiate between var/let/const without more context
  
  return false;
}

/**
 * Find module exports
 */
export function find_module_exports(
  context: ResolutionContext
): Def[] {
  const exports: Def[] = [];
  const { scope_tree, file_path } = context;
  
  // Look for exported symbols in root scope
  const root_scope = scope_tree.nodes.get(scope_tree.root_id);
  if (!root_scope) return exports;
  
  for (const [symbol_name, symbol] of root_scope.symbols) {
    if (symbol.is_exported) {
      const def: Def = {
        id: `def_${scope_tree.root_id}_${symbol_name}`,
        kind: 'definition',
        name: symbol_name,
        symbol_kind: symbol.kind as SymbolKind,
        range: symbol.range,
        file_path
      };
      exports.push(def);
    }
  }
  
  return exports;
}

/**
 * Extended JavaScript resolution context
 */
export interface JavaScriptResolutionContext extends ResolutionContext {
  // Add any JavaScript-specific context if needed
}

