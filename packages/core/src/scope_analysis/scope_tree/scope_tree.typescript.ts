/**
 * TypeScript-specific scope tree building
 * 
 * Handles TypeScript scoping rules:
 * - All JavaScript scoping rules
 * - Type-only scopes (interfaces, type aliases)
 * - Module/namespace scopes
 * - Enum scopes
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
  get_scope_chain
} from './scope_tree';

/**
 * Build TypeScript-specific scope tree
 */
export function build_typescript_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  file_path?: string
): ScopeTree {
  const tree = create_scope_tree('typescript', file_path);
  
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
  
  const context: TypeScriptScopeContext = {
    language: 'typescript',
    source_code,
    file_path,
    current_scope_id: tree.root_id,
    scope_id_counter: 1,
    in_type_scope: false,
    in_ambient_context: false
  };
  
  // Check for ambient context
  context.in_ambient_context = check_ambient_context(root_node);
  
  // Traverse and build
  traverse_typescript_ast(root_node, tree, context);
  
  // Handle hoisting
  hoist_typescript_declarations(tree);
  
  return tree;
}

interface TypeScriptScopeContext extends ScopeTreeContext {
  in_type_scope: boolean;
  in_ambient_context: boolean;
}

/**
 * Check if in ambient context (d.ts file or declare)
 */
function check_ambient_context(node: SyntaxNode): boolean {
  // Check for declare keyword in children
  for (let i = 0; i < Math.min(10, node.childCount); i++) {
    const child = node.child(i);
    if (child && child.type === 'declare') {
      return true;
    }
  }
  return false;
}

/**
 * Traverse TypeScript AST and build scopes
 */
function traverse_typescript_ast(
  node: SyntaxNode,
  tree: ScopeTree,
  context: TypeScriptScopeContext
) {
  // Check for type-only constructs
  if (is_type_only_construct(node)) {
    context = { ...context, in_type_scope: true };
  }
  
  // Check if this node creates a new scope
  if (creates_typescript_scope(node)) {
    const scope_id = `scope_${context.scope_id_counter++}`;
    const scope_type = get_typescript_scope_type(node);
    
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
      metadata: extract_typescript_scope_metadata(node, context)
    };
    
    // Add to tree
    tree.nodes.set(scope_id, new_scope);
    
    // Link to parent
    const parent_scope = tree.nodes.get(context.current_scope_id!);
    if (parent_scope) {
      parent_scope.child_ids.push(scope_id);
    }
    
    // Process parameters/generics
    if (is_function_like(node)) {
      extract_function_parameters(node, new_scope, context.source_code);
      extract_type_parameters(node, new_scope, context.source_code);
    }
    
    // Update context for children
    const child_context = { ...context, current_scope_id: scope_id };
    
    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_typescript_ast(child, tree, child_context);
      }
    }
  } else {
    // Check for symbol definitions
    const symbol = extract_typescript_symbol(node, context);
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
        traverse_typescript_ast(child, tree, context);
      }
    }
  }
}

/**
 * Check if node is type-only construct
 */
function is_type_only_construct(node: SyntaxNode): boolean {
  return [
    'interface_declaration',
    'type_alias_declaration',
    'type_parameter',
    'type_arguments'
  ].includes(node.type);
}

/**
 * Check if node creates a TypeScript scope
 */
function creates_typescript_scope(node: SyntaxNode): boolean {
  return [
    // JavaScript scopes
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
    'switch_statement',
    // TypeScript-specific scopes
    'module',
    'namespace_declaration',
    'enum_declaration',
    'interface_declaration'
  ].includes(node.type);
}

/**
 * Get TypeScript scope type
 */
function get_typescript_scope_type(node: SyntaxNode): ScopeType {
  switch (node.type) {
    case 'function_declaration':
    case 'function_expression':
    case 'arrow_function':
    case 'method_definition':
      return 'function';
    
    case 'class_declaration':
    case 'class_expression':
    case 'interface_declaration':
      return 'class';
    
    case 'module':
    case 'namespace_declaration':
      return 'module';
    
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
    'method_definition',
    'constructor_definition'
  ].includes(node.type);
}

/**
 * Extract function parameters
 */
function extract_function_parameters(
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
 * Extract type parameters (generics)
 */
function extract_type_parameters(
  node: SyntaxNode,
  scope: ScopeNode,
  source_code: string
) {
  const type_params = node.childForFieldName('type_parameters');
  if (!type_params) return;
  
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (param && param.type === 'type_parameter') {
      const name_node = param.childForFieldName('name');
      if (name_node) {
        const name = source_code.substring(name_node.startIndex, name_node.endIndex);
        scope.symbols.set(name, {
          name,
          kind: 'type_parameter',
          range: {
            start: {
              row: param.startPosition.row,
              column: param.startPosition.column
            },
            end: {
              row: param.endPosition.row,
              column: param.endPosition.column
            }
          }
        });
      }
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
  let type_info: string | undefined;
  
  if (param_node.type === 'required_parameter' || param_node.type === 'optional_parameter') {
    const pattern = param_node.childForFieldName('pattern');
    const type_node = param_node.childForFieldName('type');
    
    if (pattern && pattern.type === 'identifier') {
      name = source_code.substring(pattern.startIndex, pattern.endIndex);
    }
    
    if (type_node) {
      type_info = source_code.substring(type_node.startIndex, type_node.endIndex);
    }
  } else if (param_node.type === 'identifier') {
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
      },
      type_info
    };
  }
  
  return undefined;
}

/**
 * Extract TypeScript symbol
 */
function extract_typescript_symbol(
  node: SyntaxNode,
  context: TypeScriptScopeContext
): ScopeSymbol | undefined {
  const { source_code } = context;
  
  // All JavaScript symbols
  const js_symbol = extract_javascript_symbol_internal(node, context);
  if (js_symbol) return js_symbol;
  
  // TypeScript-specific symbols
  
  // Interface declaration
  if (node.type === 'interface_declaration') {
    const name_node = node.childForFieldName('name');
    if (name_node) {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      return {
        name,
        kind: 'interface',
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
  
  // Type alias
  if (node.type === 'type_alias_declaration') {
    const name_node = node.childForFieldName('name');
    if (name_node) {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      return {
        name,
        kind: 'type_alias',
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
  
  // Enum declaration
  if (node.type === 'enum_declaration') {
    const name_node = node.childForFieldName('name');
    if (name_node) {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      return {
        name,
        kind: 'enum',
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
  
  // Namespace/module
  if (node.type === 'namespace_declaration' || node.type === 'module') {
    const name_node = node.childForFieldName('name');
    if (name_node) {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      return {
        name,
        kind: 'namespace',
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
 * Extract JavaScript symbols (internal helper)
 */
function extract_javascript_symbol_internal(
  node: SyntaxNode,
  context: TypeScriptScopeContext
): ScopeSymbol | undefined {
  const { source_code } = context;
  
  // Variable declarations
  if (node.type === 'variable_declarator') {
    const name_node = node.childForFieldName('name');
    if (name_node && name_node.type === 'identifier') {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      
      // Get type annotation if present
      const type_node = node.childForFieldName('type');
      const type_info = type_node 
        ? source_code.substring(type_node.startIndex, type_node.endIndex)
        : undefined;
      
      // Determine if it's hoisted (var)
      let is_hoisted = false;
      let parent = node.parent;
      while (parent && parent.type !== 'variable_declaration' && parent.type !== 'lexical_declaration') {
        parent = parent.parent;
      }
      if (parent && parent.type === 'variable_declaration') {
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
        is_hoisted,
        type_info
      };
    }
  }
  
  // Function declarations
  if (node.type === 'function_declaration') {
    const name_node = node.childForFieldName('name');
    if (name_node) {
      const name = source_code.substring(name_node.startIndex, name_node.endIndex);
      
      // Get return type if present
      const return_type = node.childForFieldName('return_type');
      const type_info = return_type
        ? source_code.substring(return_type.startIndex, return_type.endIndex)
        : undefined;
      
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
        is_hoisted: true,
        type_info
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
 * Extract TypeScript scope metadata
 */
function extract_typescript_scope_metadata(
  node: SyntaxNode,
  context: TypeScriptScopeContext
): Record<string, any> | undefined {
  const { source_code } = context;
  const metadata: Record<string, any> = {};
  
  // Extract name
  const name_node = node.childForFieldName('name');
  if (name_node) {
    metadata.name = source_code.substring(name_node.startIndex, name_node.endIndex);
  }
  
  // Check for modifiers
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    
    switch (child.type) {
      case 'async':
        metadata.is_async = true;
        break;
      case 'export':
        metadata.is_exported = true;
        break;
      case 'declare':
        metadata.is_ambient = true;
        break;
      case 'abstract':
        metadata.is_abstract = true;
        break;
      case 'static':
        metadata.is_static = true;
        break;
      case 'readonly':
        metadata.is_readonly = true;
        break;
      case 'public':
        metadata.visibility = 'public';
        break;
      case 'private':
        metadata.visibility = 'private';
        break;
      case 'protected':
        metadata.visibility = 'protected';
        break;
    }
  }
  
  // Check if it's a generator
  if (is_function_like(node)) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === '*') {
        metadata.is_generator = true;
        break;
      }
    }
  }
  
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Hoist TypeScript declarations
 */
function hoist_typescript_declarations(tree: ScopeTree) {
  // Similar to JavaScript but also handles type declarations
  for (const [scope_id, scope] of tree.nodes) {
    const hoisted_symbols: ScopeSymbol[] = [];
    
    // Find hoisted symbols
    for (const [name, symbol] of scope.symbols) {
      if (symbol.is_hoisted || 
          symbol.kind === 'interface' || 
          symbol.kind === 'type_alias' ||
          symbol.kind === 'enum') {
        hoisted_symbols.push(symbol);
      }
    }
    
    // Move hoisted symbols to appropriate scope
    for (const symbol of hoisted_symbols) {
      // Types are hoisted to module/global scope
      if (symbol.kind === 'interface' || symbol.kind === 'type_alias' || symbol.kind === 'enum') {
        const module_scope = find_enclosing_module_scope(tree, scope_id);
        if (module_scope && module_scope.id !== scope_id) {
          scope.symbols.delete(symbol.name);
          module_scope.symbols.set(symbol.name, symbol);
        }
      } else if (symbol.is_hoisted) {
        // Regular JavaScript hoisting
        const function_scope = find_enclosing_function_scope(tree, scope_id);
        if (function_scope && function_scope.id !== scope_id) {
          scope.symbols.delete(symbol.name);
          function_scope.symbols.set(symbol.name, symbol);
        }
      }
    }
  }
}

/**
 * Find enclosing module scope
 */
function find_enclosing_module_scope(
  tree: ScopeTree,
  scope_id: string
): ScopeNode | undefined {
  const chain = get_scope_chain(tree, scope_id);
  
  for (const scope of chain) {
    if (scope.type === 'module' || scope.type === 'global') {
      return scope;
    }
  }
  
  return undefined;
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