/**
 * Python-specific symbol resolution
 * 
 * Handles Python's unique symbol resolution features:
 * - LEGB rule (Local, Enclosing, Global, Built-in)
 * - global and nonlocal declarations
 * - Module-level imports
 * - from...import statements
 * - __all__ exports
 * - Attribute access resolution
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, Def, Ref, Position } from '@ariadnejs/types';
import {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  ScopeType,
  find_scope_at_position,
  find_symbol_in_scope_chain,
  get_scope_chain,
  get_visible_symbols
} from '../scope_tree';
import {
  ResolvedSymbol,
  ResolutionContext,
  ImportInfo,
  ExportInfo,
  resolve_symbol,
  find_symbol_references,
  find_symbol_definition,
  get_all_visible_symbols,
  is_symbol_exported,
  resolve_symbol_with_type
} from './symbol_resolution';

/**
 * Python-specific resolution context
 */
export interface PythonResolutionContext extends ResolutionContext {
  builtins?: Set<string>;
  global_declarations?: Map<string, Set<string>>;  // scope_id -> global names
  nonlocal_declarations?: Map<string, Set<string>>;  // scope_id -> nonlocal names
  all_exports?: string[];  // __all__ list
}

/**
 * Common Python built-in names
 */
const PYTHON_BUILTINS = new Set([
  // Types
  'int', 'float', 'str', 'bool', 'list', 'tuple', 'dict', 'set', 'frozenset',
  'bytes', 'bytearray', 'memoryview', 'complex',
  // Functions
  'print', 'input', 'len', 'range', 'enumerate', 'zip', 'map', 'filter',
  'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'round', 'all', 'any',
  'isinstance', 'issubclass', 'hasattr', 'getattr', 'setattr', 'delattr',
  'dir', 'help', 'id', 'type', 'repr', 'str', 'format', 'chr', 'ord',
  'bin', 'hex', 'oct', 'hash', 'eval', 'exec', 'compile', 'globals', 'locals',
  // Objects
  'None', 'True', 'False', 'Ellipsis', 'NotImplemented',
  '__name__', '__file__', '__doc__', '__package__', '__loader__',
  // Exceptions
  'Exception', 'BaseException', 'SystemExit', 'KeyboardInterrupt',
  'GeneratorExit', 'StopIteration', 'StopAsyncIteration',
  'ArithmeticError', 'AssertionError', 'AttributeError', 'BufferError',
  'EOFError', 'ImportError', 'LookupError', 'MemoryError', 'NameError',
  'OSError', 'ReferenceError', 'RuntimeError', 'SyntaxError', 'SystemError',
  'TypeError', 'ValueError', 'Warning', 'UserWarning', 'DeprecationWarning',
  // Others
  'open', 'super', 'property', 'staticmethod', 'classmethod',
  'object', 'slice', 'callable', 'iter', 'next', '__import__'
]);

/**
 * Resolve Python symbol with LEGB rule
 */
export function resolve_python_symbol(
  symbol_name: string,
  scope_id: string,
  context: PythonResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree, global_declarations, nonlocal_declarations, builtins } = context;
  
  // Check for attribute access (e.g., object.attribute)
  if (symbol_name.includes('.')) {
    return resolve_attribute_access(symbol_name, scope_id, context);
  }
  
  // Get the current scope
  const current_scope = scope_tree.nodes.get(scope_id);
  if (!current_scope) return undefined;
  
  // Check if this is a global declaration
  const globals = global_declarations?.get(scope_id);
  if (globals?.has(symbol_name)) {
    // Skip to global scope
    return resolve_in_global_scope(symbol_name, context);
  }
  
  // Check if this is a nonlocal declaration
  const nonlocals = nonlocal_declarations?.get(scope_id);
  if (nonlocals?.has(symbol_name)) {
    // Skip local, search enclosing scopes
    return resolve_in_enclosing_scopes(symbol_name, scope_id, context);
  }
  
  // LEGB rule: Local -> Enclosing -> Global -> Built-in
  
  // 1. Local scope
  if (current_scope.symbols.has(symbol_name)) {
    const symbol = current_scope.symbols.get(symbol_name)!;
    return {
      symbol,
      scope: current_scope,
      definition_file: context.file_path,
      confidence: 'exact'
    };
  }
  
  // 2. Enclosing scopes
  const enclosing_result = resolve_in_enclosing_scopes(symbol_name, scope_id, context);
  if (enclosing_result) return enclosing_result;
  
  // 3. Global scope
  const global_result = resolve_in_global_scope(symbol_name, context);
  if (global_result) return global_result;
  
  // 4. Built-in scope
  const actual_builtins = builtins || PYTHON_BUILTINS;
  if (actual_builtins.has(symbol_name)) {
    return {
      symbol: {
        name: symbol_name,
        kind: 'builtin',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }
      },
      scope: current_scope,  // Use current scope as context
      confidence: 'exact'
    };
  }
  
  // Try standard resolution (imports, etc.)
  return resolve_symbol(symbol_name, scope_id, context);
}

/**
 * Resolve in enclosing scopes only
 */
function resolve_in_enclosing_scopes(
  symbol_name: string,
  scope_id: string,
  context: PythonResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree } = context;
  const scope_chain = get_scope_chain(scope_tree, scope_id);
  
  // Skip the current scope (index 0) and global scope (last)
  for (let i = 1; i < scope_chain.length - 1; i++) {
    const scope = scope_chain[i];
    if (scope.symbols.has(symbol_name)) {
      const symbol = scope.symbols.get(symbol_name)!;
      return {
        symbol,
        scope,
        definition_file: context.file_path,
        confidence: 'exact'
      };
    }
  }
  
  return undefined;
}

/**
 * Resolve in global scope only
 */
function resolve_in_global_scope(
  symbol_name: string,
  context: PythonResolutionContext
): ResolvedSymbol | undefined {
  const { scope_tree } = context;
  const global_scope = scope_tree.nodes.get(scope_tree.root_id);
  if (!global_scope) return undefined;
  
  if (global_scope.symbols.has(symbol_name)) {
    const symbol = global_scope.symbols.get(symbol_name)!;
    return {
      symbol,
      scope: global_scope,
      definition_file: context.file_path,
      confidence: 'exact'
    };
  }
  
  // Check imports in global scope
  if (context.imports) {
    for (const imp of context.imports) {
      if (imp.name === symbol_name) {
        return {
          symbol: {
            name: imp.name,
            kind: 'import',
            range: imp.range,
            is_imported: true
          },
          scope: global_scope,
          is_imported: true,
          confidence: 'exact'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Resolve attribute access (object.attribute)
 */
function resolve_attribute_access(
  qualified_name: string,
  scope_id: string,
  context: PythonResolutionContext
): ResolvedSymbol | undefined {
  const parts = qualified_name.split('.');
  if (parts.length < 2) return undefined;
  
  // Resolve the base object
  const base_resolution = resolve_python_symbol(parts[0], scope_id, context);
  if (!base_resolution) return undefined;
  
  // For imports, check if it's a module attribute
  if (base_resolution.symbol.is_imported && context.cross_file_graphs) {
    // This would require cross-file resolution
    // For now, return a likely match
    return {
      symbol: {
        name: parts[parts.length - 1],
        kind: 'attribute',
        range: base_resolution.symbol.range
      },
      scope: base_resolution.scope,
      confidence: 'likely'
    };
  }
  
  // For classes/objects, we'd need type information
  // Return a possible match
  return {
    symbol: {
      name: parts[parts.length - 1],
      kind: 'attribute',
      range: base_resolution.symbol.range
    },
    scope: base_resolution.scope,
    confidence: 'possible'
  };
}

/**
 * Extract global and nonlocal declarations
 */
export function extract_python_declarations(
  root_node: SyntaxNode,
  source_code: string,
  scope_tree: ScopeTree
): {
  global_declarations: Map<string, Set<string>>;
  nonlocal_declarations: Map<string, Set<string>>;
} {
  const global_declarations = new Map<string, Set<string>>();
  const nonlocal_declarations = new Map<string, Set<string>>();
  
  const visit = (node: SyntaxNode, scope_id: string) => {
    // Update scope if entering a new one
    const node_scope = find_scope_at_position(scope_tree, {
      row: node.startPosition.row,
      column: node.startPosition.column
    });
    if (node_scope && node_scope.id !== scope_id) {
      scope_id = node_scope.id;
    }
    
    if (node.type === 'global_statement') {
      const names = new Set<string>();
      for (const child of node.children) {
        if (child.type === 'identifier') {
          names.add(source_code.substring(child.startIndex, child.endIndex));
        }
      }
      if (names.size > 0) {
        const existing = global_declarations.get(scope_id) || new Set();
        names.forEach(name => existing.add(name));
        global_declarations.set(scope_id, existing);
      }
    } else if (node.type === 'nonlocal_statement') {
      const names = new Set<string>();
      for (const child of node.children) {
        if (child.type === 'identifier') {
          names.add(source_code.substring(child.startIndex, child.endIndex));
        }
      }
      if (names.size > 0) {
        const existing = nonlocal_declarations.get(scope_id) || new Set();
        names.forEach(name => existing.add(name));
        nonlocal_declarations.set(scope_id, existing);
      }
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child, scope_id);
    }
  };
  
  visit(root_node, scope_tree.root_id);
  return { global_declarations, nonlocal_declarations };
}

/**
 * Resolve Python self/cls references
 */
export function resolve_self_reference(
  symbol_name: string,
  scope_id: string,
  context: PythonResolutionContext
): ResolvedSymbol | undefined {
  if (symbol_name !== 'self' && symbol_name !== 'cls') {
    return undefined;
  }
  
  const { scope_tree } = context;
  const scope_chain = get_scope_chain(scope_tree, scope_id);
  
  // Look for enclosing class method
  for (const scope of scope_chain) {
    if (scope.type === 'function' && scope.metadata?.is_method) {
      // Find the class scope
      const class_scope = scope_chain.find(s => s.type === 'class');
      if (class_scope) {
        return {
          symbol: {
            name: symbol_name,
            kind: 'parameter',
            range: scope.range
          },
          scope: class_scope,
          confidence: 'exact'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Find Python decorators for a symbol
 */
export function find_python_decorators(
  symbol_name: string,
  scope_id: string,
  context: PythonResolutionContext,
  ast_node: SyntaxNode,
  source_code: string
): string[] {
  const decorators: string[] = [];
  
  // Look for decorator nodes above the definition
  if (ast_node.previousSibling?.type === 'decorator') {
    let decorator = ast_node.previousSibling;
    while (decorator && decorator.type === 'decorator') {
      const name_node = decorator.childForFieldName('name');
      if (name_node) {
        const decorator_name = source_code.substring(name_node.startIndex, name_node.endIndex);
        decorators.push(decorator_name);
      }
      decorator = decorator.previousSibling;
    }
  }
  
  return decorators;
}

/**
 * Check if symbol is a Python magic method
 */
export function is_magic_method(symbol_name: string): boolean {
  return symbol_name.startsWith('__') && symbol_name.endsWith('__');
}

/**
 * Get Python symbol kind from AST node
 */
export function get_python_symbol_kind(node: SyntaxNode): string {
  switch (node.type) {
    case 'class_definition':
      return 'class';
    case 'function_definition':
      return 'function';
    case 'assignment':
      return 'variable';
    case 'parameter':
      return 'parameter';
    case 'import_statement':
    case 'import_from_statement':
      return 'import';
    case 'with_statement':
      return 'context_manager';
    case 'for_statement':
      return 'iterator';
    case 'except_clause':
      return 'exception';
    default:
      return 'unknown';
  }
}