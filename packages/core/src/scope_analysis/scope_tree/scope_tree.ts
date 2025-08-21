/**
 * Core scope tree functionality
 * 
 * Builds and manages hierarchical scope structures for:
 * - Symbol resolution boundaries
 * - Variable scoping rules
 * - Lexical scope chains
 * - Block and function scopes
 */

// TODO: Integration with Symbol Resolution
// - Symbols resolved within scope tree
// TODO: Integration with Type Tracking
// - Each scope has type context
// TODO: Integration with Definition Finder
// - Search scope tree for definitions

import { SyntaxNode } from 'tree-sitter';
import { Language, Def, Position } from '@ariadnejs/types';

/**
 * Type of scope (determines resolution rules)
 */
export type ScopeType = 
  | 'global'      // Top-level file scope
  | 'module'      // Module/namespace scope
  | 'class'       // Class/struct scope
  | 'function'    // Function/method scope
  | 'block'       // Block scope (if/for/while/etc)
  | 'parameter'   // Function parameter scope
  | 'local';      // Local/let/const scope

/**
 * A node in the scope tree
 */
export interface ScopeNode {
  id: string;
  type: ScopeType;
  range: {
    start: Position;
    end: Position;
  };
  parent_id?: string;
  child_ids: string[];
  symbols: Map<string, ScopeSymbol>;
  metadata?: {
    name?: string;          // Function/class/module name
    is_async?: boolean;     // For function scopes
    is_generator?: boolean; // For function scopes
    visibility?: string;    // public/private/protected
  };
}

/**
 * Symbol information within a scope
 */
export interface ScopeSymbol {
  name: string;
  kind: string;  // variable, function, class, etc.
  range: {
    start: Position;
    end: Position;
  };
  is_hoisted?: boolean;     // var in JS, function declarations
  is_imported?: boolean;    // Imported from another module
  is_exported?: boolean;    // Exported from this module
  type_info?: string;       // Type annotation if available
}

/**
 * Scope tree structure
 */
export interface ScopeTree {
  root_id: string;
  nodes: Map<string, ScopeNode>;
  language: Language;
  file_path?: string;
}

/**
 * Context for building scope tree
 */
export interface ScopeTreeContext {
  language: Language;
  source_code: string;
  file_path?: string;
  current_scope_id?: string;
  scope_id_counter: number;
}

/**
 * Create an empty scope tree
 */
export function create_scope_tree(
  language: Language,
  file_path?: string
): ScopeTree {
  const root_id = 'scope_0';
  const root_node: ScopeNode = {
    id: root_id,
    type: 'global',
    range: {
      start: { row: 0, column: 0 },
      end: { row: 0, column: 0 }
    },
    child_ids: [],
    symbols: new Map()
  };
  
  return {
    root_id,
    nodes: new Map([[root_id, root_node]]),
    language,
    file_path
  };
}

/**
 * Build scope tree from AST
 */
export function build_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string
): ScopeTree {
  const tree = create_scope_tree(language, file_path);
  
  // Update root node range
  const root_scope = tree.nodes.get(tree.root_id)!;
  root_scope.range = {
    start: {
      row: root_node.startPosition.row,
      column: root_node.startPosition.column
    },
    end: {
      row: root_node.endPosition.row,
      column: root_node.endPosition.column
    }
  };
  
  const context: ScopeTreeContext = {
    language,
    source_code,
    file_path,
    current_scope_id: tree.root_id,
    scope_id_counter: 1
  };
  
  // Traverse AST and build scope tree
  traverse_and_build(root_node, tree, context);
  
  return tree;
}

/**
 * Traverse AST and build scope nodes
 */
function traverse_and_build(
  node: SyntaxNode,
  tree: ScopeTree,
  context: ScopeTreeContext
) {
  // Check if this node creates a new scope
  const scope_type = get_scope_type(node, context.language);
  
  if (scope_type && scope_type !== 'global') {
    // Create new scope
    const scope_id = `scope_${context.scope_id_counter++}`;
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
      metadata: extract_scope_metadata(node, context)
    };
    
    // Add to tree
    tree.nodes.set(scope_id, new_scope);
    
    // Link to parent
    const parent_scope = tree.nodes.get(context.current_scope_id!);
    if (parent_scope) {
      parent_scope.child_ids.push(scope_id);
      
      // Some nodes both create a scope AND are symbols in the parent scope
      // (e.g., function declarations, class declarations)
      const symbol = extract_symbol(node, context);
      if (symbol) {
        // Handle hoisting for certain symbols
        const target_scope = should_hoist(symbol, node, context) 
          ? find_hoisting_target(tree, context.current_scope_id!)
          : parent_scope;
        
        target_scope.symbols.set(symbol.name, symbol);
      }
    }
    
    // Extract parameters for function scopes
    if (scope_type === 'function') {
      extract_function_parameters(node, new_scope, context);
    }
    
    // Update context for children
    const child_context = { ...context, current_scope_id: scope_id };
    
    // Traverse children in new scope
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_and_build(child, tree, child_context);
      }
    }
  } else {
    // Check if this node defines a symbol
    const symbol = extract_symbol(node, context);
    if (symbol) {
      // Add symbol to current scope
      const current_scope = tree.nodes.get(context.current_scope_id!);
      if (current_scope) {
        // Handle hoisting for certain symbols
        const target_scope = should_hoist(symbol, node, context) 
          ? find_hoisting_target(tree, context.current_scope_id!)
          : current_scope;
        
        target_scope.symbols.set(symbol.name, symbol);
      }
    }
    
    // Traverse children in same scope
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_and_build(child, tree, context);
      }
    }
  }
}

/**
 * Determine if a node creates a new scope
 */
function get_scope_type(node: SyntaxNode, language: Language): ScopeType | undefined {
  switch (language) {
    case 'javascript':
    case 'typescript':
      switch (node.type) {
        case 'function_declaration':
        case 'function_expression':
        case 'arrow_function':
        case 'method_definition':
          return 'function';
        case 'class_declaration':
        case 'class_expression':
          return 'class';
        case 'statement_block':
          // Block scope for let/const
          return 'block';
        case 'for_statement':
        case 'for_in_statement':
        case 'for_of_statement':
        case 'while_statement':
        case 'do_statement':
        case 'if_statement':
        case 'switch_statement':
        case 'try_statement':
        case 'catch_clause':
          return 'block';
        default:
          return undefined;
      }
    
    case 'python':
      switch (node.type) {
        case 'function_definition':
        case 'lambda':
          return 'function';
        case 'class_definition':
          return 'class';
        case 'for_statement':
        case 'while_statement':
        case 'with_statement':
          // Python doesn't have block scope, but we track for comprehensions
          return 'local';
        default:
          return undefined;
      }
    
    case 'rust':
      switch (node.type) {
        case 'function_item':
        case 'closure_expression':
          return 'function';
        case 'impl_item':
        case 'trait_item':
          return 'class';
        case 'block':
        case 'if_expression':
        case 'match_expression':
        case 'while_expression':
        case 'for_expression':
        case 'loop_expression':
          return 'block';
        case 'mod_item':
          return 'module';
        default:
          return undefined;
      }
    
    default:
      return undefined;
  }
}

/**
 * Extract function parameters
 */
function extract_function_parameters(
  node: SyntaxNode,
  scope: ScopeNode,
  context: ScopeTreeContext
) {
  const { language, source_code } = context;
  const params_node = node.childForFieldName('parameters');
  if (!params_node) return;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const param = params_node.child(i);
    if (!param) continue;
    
    // Skip syntax tokens
    if (param.type === '(' || param.type === ')' || param.type === ',' || 
        param.type === '|' || param.type === ':') {
      continue;
    }
    
    // Extract parameter as symbol
    const symbol = extract_symbol(param, context);
    if (symbol) {
      scope.symbols.set(symbol.name, symbol);
    }
  }
}

/**
 * Extract symbol from a definition node
 */
function extract_symbol(
  node: SyntaxNode,
  context: ScopeTreeContext
): ScopeSymbol | undefined {
  const { language, source_code } = context;
  
  // Check if this is a definition node
  if (!is_definition_node(node, language)) {
    return undefined;
  }
  
  const name = extract_symbol_name(node, source_code, language);
  if (!name) return undefined;
  
  return {
    name,
    kind: get_symbol_kind(node, language),
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
    is_hoisted: is_hoisted_symbol(node, language),
    type_info: extract_type_annotation(node, source_code, language)
  };
}

/**
 * Check if node is a definition
 */
function is_definition_node(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return ['variable_declarator', 'function_declaration', 'class_declaration',
              'parameter', 'rest_parameter'].includes(node.type);
    
    case 'python':
      return ['assignment', 'function_definition', 'class_definition',
              'parameter', 'typed_parameter', 'default_parameter'].includes(node.type);
    
    case 'rust':
      return ['let_declaration', 'const_item', 'static_item', 'function_item',
              'struct_item', 'enum_item', 'parameter', 'self_parameter'].includes(node.type);
    
    default:
      return false;
  }
}

/**
 * Extract symbol name from definition node
 */
function extract_symbol_name(
  node: SyntaxNode,
  source_code: string,
  language: Language
): string | undefined {
  let name_node: SyntaxNode | null = null;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      if (node.type === 'variable_declarator') {
        name_node = node.childForFieldName('name');
      } else if (['function_declaration', 'class_declaration'].includes(node.type)) {
        name_node = node.childForFieldName('name');
      } else if (['parameter', 'rest_parameter'].includes(node.type)) {
        // Parameters might have patterns
        name_node = node.childForFieldName('pattern') || node;
      }
      break;
    
    case 'python':
      if (node.type === 'assignment') {
        name_node = node.childForFieldName('left');
      } else if (['function_definition', 'class_definition'].includes(node.type)) {
        name_node = node.childForFieldName('name');
      } else if (['parameter', 'typed_parameter', 'default_parameter'].includes(node.type)) {
        name_node = node.childForFieldName('name') || node.firstChild;
      }
      break;
    
    case 'rust':
      if (node.type === 'let_declaration') {
        const pattern = node.childForFieldName('pattern');
        if (pattern && pattern.type === 'identifier') {
          name_node = pattern;
        }
      } else if (['const_item', 'static_item', 'function_item', 'struct_item', 'enum_item'].includes(node.type)) {
        name_node = node.childForFieldName('name');
      } else if (node.type === 'parameter') {
        const pattern = node.childForFieldName('pattern');
        if (pattern && pattern.type === 'identifier') {
          name_node = pattern;
        }
      } else if (node.type === 'self_parameter') {
        // self_parameter always has the name 'self'
        return 'self';
      }
      break;
  }
  
  if (name_node) {
    // Handle both identifier and type_identifier (used in Rust for struct/enum names)
    if (name_node.type === 'identifier' || name_node.type === 'type_identifier') {
      return source_code.substring(name_node.startIndex, name_node.endIndex);
    }
  }
  
  return undefined;
}

/**
 * Get symbol kind from node type
 */
function get_symbol_kind(node: SyntaxNode, language: Language): string {
  switch (node.type) {
    case 'variable_declarator':
    case 'let_declaration':
    case 'assignment':
      return 'variable';
    
    case 'function_declaration':
    case 'function_definition':
    case 'function_item':
      return 'function';
    
    case 'class_declaration':
    case 'class_definition':
      return 'class';
    
    case 'parameter':
    case 'rest_parameter':
    case 'typed_parameter':
    case 'default_parameter':
    case 'self_parameter':
      return 'parameter';
    
    case 'const_item':
      return 'constant';
    
    case 'static_item':
      return 'static';
    
    case 'struct_item':
      return 'struct';
    
    case 'enum_item':
      return 'enum';
    
    default:
      return 'unknown';
  }
}

/**
 * Check if symbol should be hoisted
 */
function is_hoisted_symbol(node: SyntaxNode, language: Language): boolean {
  if (language === 'javascript' || language === 'typescript') {
    // Function declarations are hoisted
    if (node.type === 'function_declaration') {
      return true;
    }
    
    // Check for var declarations
    if (node.type === 'variable_declarator') {
      let parent = node.parent;
      while (parent && parent.type !== 'variable_declaration') {
        parent = parent.parent;
      }
      if (parent) {
        const first_child = parent.firstChild;
        return first_child?.text === 'var';
      }
    }
  }
  
  return false;
}

/**
 * Check if symbol should be hoisted to a parent scope
 */
function should_hoist(
  symbol: ScopeSymbol,
  node: SyntaxNode,
  context: ScopeTreeContext
): boolean {
  return symbol.is_hoisted === true && context.language === 'javascript';
}

/**
 * Find the target scope for hoisted symbols
 */
function find_hoisting_target(tree: ScopeTree, current_scope_id: string): ScopeNode {
  let scope = tree.nodes.get(current_scope_id)!;
  
  // Hoist to the nearest function scope or global scope
  while (scope.parent_id && scope.type !== 'function' && scope.type !== 'global') {
    const parent = tree.nodes.get(scope.parent_id);
    if (!parent) break;
    scope = parent;
  }
  
  return scope;
}

/**
 * Extract type annotation from node
 */
function extract_type_annotation(
  node: SyntaxNode,
  source_code: string,
  language: Language
): string | undefined {
  let type_node: SyntaxNode | null = null;
  
  switch (language) {
    case 'typescript':
      type_node = node.childForFieldName('type');
      break;
    
    case 'python':
      if (node.type === 'typed_parameter') {
        type_node = node.childForFieldName('type');
      }
      break;
    
    case 'rust':
      type_node = node.childForFieldName('type');
      break;
  }
  
  if (type_node) {
    return source_code.substring(type_node.startIndex, type_node.endIndex);
  }
  
  return undefined;
}

/**
 * Extract metadata for scope node
 */
function extract_scope_metadata(
  node: SyntaxNode,
  context: ScopeTreeContext
): Record<string, any> | undefined {
  const { source_code, language } = context;
  const metadata: Record<string, any> = {};
  
  // Extract name if available
  const name_node = node.childForFieldName('name');
  if (name_node) {
    metadata.name = source_code.substring(name_node.startIndex, name_node.endIndex);
  }
  
  // Language-specific metadata
  if (language === 'javascript' || language === 'typescript') {
    if (node.type === 'function_declaration' || node.type === 'arrow_function') {
      // Check for async
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === 'async') {
          metadata.is_async = true;
          break;
        }
      }
    }
  }
  
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Find scope containing a position
 */
export function find_scope_at_position(
  tree: ScopeTree,
  position: Position
): ScopeNode | undefined {
  return find_deepest_scope_containing(tree, tree.root_id, position);
}

/**
 * Recursively find deepest scope containing position
 */
function find_deepest_scope_containing(
  tree: ScopeTree,
  scope_id: string,
  position: Position
): ScopeNode | undefined {
  const scope = tree.nodes.get(scope_id);
  if (!scope) return undefined;
  
  // Check if position is within this scope
  if (!is_position_within_range(position, scope.range)) {
    return undefined;
  }
  
  // Check children for a deeper match
  for (const child_id of scope.child_ids) {
    const child_match = find_deepest_scope_containing(tree, child_id, position);
    if (child_match) {
      return child_match;
    }
  }
  
  // This scope contains the position and no child does
  return scope;
}

/**
 * Check if position is within range
 */
function is_position_within_range(
  position: Position,
  range: { start: Position; end: Position }
): boolean {
  if (position.row < range.start.row || position.row > range.end.row) {
    return false;
  }
  
  if (position.row === range.start.row && position.column < range.start.column) {
    return false;
  }
  
  if (position.row === range.end.row && position.column > range.end.column) {
    return false;
  }
  
  return true;
}

/**
 * Get scope chain from a scope to root
 */
export function get_scope_chain(
  tree: ScopeTree,
  scope_id: string
): ScopeNode[] {
  const chain: ScopeNode[] = [];
  let current_id: string | undefined = scope_id;
  
  while (current_id) {
    const scope = tree.nodes.get(current_id);
    if (!scope) break;
    
    chain.push(scope);
    current_id = scope.parent_id;
  }
  
  return chain;
}

/**
 * Find symbol in scope chain
 */
export function find_symbol_in_scope_chain(
  tree: ScopeTree,
  scope_id: string,
  symbol_name: string
): { symbol: ScopeSymbol; scope: ScopeNode } | undefined {
  const chain = get_scope_chain(tree, scope_id);
  
  for (const scope of chain) {
    const symbol = scope.symbols.get(symbol_name);
    if (symbol) {
      return { symbol, scope };
    }
  }
  
  return undefined;
}

/**
 * Get all symbols visible from a scope
 */
export function get_visible_symbols(
  tree: ScopeTree,
  scope_id: string
): Map<string, ScopeSymbol> {
  const visible = new Map<string, ScopeSymbol>();
  const chain = get_scope_chain(tree, scope_id);
  
  // Walk from root to current scope (so closer symbols override)
  for (let i = chain.length - 1; i >= 0; i--) {
    const scope = chain[i];
    for (const [name, symbol] of scope.symbols) {
      visible.set(name, symbol);
    }
  }
  
  return visible;
}