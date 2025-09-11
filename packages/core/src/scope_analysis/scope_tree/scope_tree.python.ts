/**
 * Python-specific bespoke scope tree handlers
 * 
 * Handles Python-specific features that cannot be expressed through configuration:
 * - LEGB scope resolution (Local, Enclosing, Global, Built-in)
 * - Global and nonlocal declarations
 * - Comprehension variable scoping
 * - Class scope special rules
 * - Decorator scope handling
 */

import { SyntaxNode } from "tree-sitter";
import {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  ScopeId,
} from "@ariadnejs/types";
import {
  BespokeHandlers,
  GenericScopeContext,
  get_scope_chain,
  find_symbol_in_scope_chain,
} from "./scope_tree";
import { is_builtin_symbol } from "./language_configs";

/**
 * Python-specific context
 */
interface PythonContext {
  global_declarations: Map<ScopeId, Set<string>>;
  nonlocal_declarations: Map<ScopeId, Map<string, ScopeId>>;
  class_scopes: Set<ScopeId>;
  comprehension_vars: Map<ScopeId, Set<string>>;
  decorators: Map<string, string[]>;
}

/**
 * Create Python bespoke handlers
 */
export function create_python_handlers(): BespokeHandlers {
  return {
    initialize_context,
    pre_process_node,
    extract_additional_symbols,
    post_process,
    extract_scope_metadata,
  };
}

/**
 * Initialize Python-specific context
 */
function initialize_context(): PythonContext {
  return {
    global_declarations: new Map(),
    nonlocal_declarations: new Map(),
    class_scopes: new Set(),
    comprehension_vars: new Map(),
    decorators: new Map(),
  };
}

/**
 * Pre-process Python-specific nodes
 */
function pre_process_node(
  node: SyntaxNode,
  tree: ScopeTree,
  context: GenericScopeContext
): boolean {
  const py_context = context.language_context as PythonContext;

  // Track global declarations
  if (node.type === "global_statement") {
    const scope_id = context.current_scope_id;
    if (!py_context.global_declarations.has(scope_id)) {
      py_context.global_declarations.set(scope_id, new Set());
    }
    
    // Extract variable names
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === "identifier") {
        py_context.global_declarations.get(scope_id)!.add(child.text);
      }
    }
  }

  // Track nonlocal declarations
  if (node.type === "nonlocal_statement") {
    const scope_id = context.current_scope_id;
    if (!py_context.nonlocal_declarations.has(scope_id)) {
      py_context.nonlocal_declarations.set(scope_id, new Map());
    }
    
    // Extract variable names and find their defining scope
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === "identifier") {
        const var_name = child.text;
        const defining_scope = find_enclosing_definition(tree, scope_id, var_name);
        if (defining_scope) {
          py_context.nonlocal_declarations.get(scope_id)!.set(var_name, defining_scope);
        }
      }
    }
  }

  // Track class scopes (they have special scoping rules)
  if (node.type === "class_definition") {
    // Will be updated when the scope is created
    py_context.class_scopes.add(`scope_${context.scope_id_counter}`);
  }

  // Track comprehension variables
  if (is_comprehension(node)) {
    const comp_scope_id = `scope_${context.scope_id_counter}`;
    const vars = extract_comprehension_vars(node);
    py_context.comprehension_vars.set(comp_scope_id, vars);
  }

  // Track decorators
  if (node.type === "decorated_definition") {
    const decorators = extract_decorators(node, context.source_code);
    const definition = node.lastChild;
    if (definition) {
      const name_node = definition.childForFieldName("name");
      if (name_node) {
        py_context.decorators.set(name_node.text, decorators);
      }
    }
  }

  return false;
}

/**
 * Check if node is a comprehension
 */
function is_comprehension(node: SyntaxNode): boolean {
  return node.type === "list_comprehension" ||
         node.type === "set_comprehension" ||
         node.type === "dictionary_comprehension" ||
         node.type === "generator_expression";
}

/**
 * Extract comprehension variables
 */
function extract_comprehension_vars(node: SyntaxNode): Set<string> {
  const vars = new Set<string>();
  
  // Look for the iteration variable(s)
  const find_vars = (n: SyntaxNode) => {
    if (n.type === "for_in_clause") {
      const left = n.childForFieldName("left");
      if (left) {
        extract_pattern_vars(left, vars);
      }
    }
    
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) find_vars(child);
    }
  };
  
  find_vars(node);
  return vars;
}

/**
 * Extract variables from a pattern
 */
function extract_pattern_vars(node: SyntaxNode, vars: Set<string>): void {
  if (node.type === "identifier") {
    vars.add(node.text);
  } else if (node.type === "pattern_list" || node.type === "tuple_pattern") {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) extract_pattern_vars(child, vars);
    }
  }
}

/**
 * Extract decorator names
 */
function extract_decorators(node: SyntaxNode, source: string): string[] {
  const decorators: string[] = [];
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === "decorator") {
      const name = extract_decorator_name(child, source);
      decorators.push(name);
    }
  }
  
  return decorators;
}

/**
 * Extract decorator name
 */
function extract_decorator_name(node: SyntaxNode, source: string): string {
  // Skip the @ symbol
  const start = node.startIndex + 1;
  const text = source.substring(start, node.endIndex);
  
  // Get just the name (before parentheses if any)
  const parenIndex = text.indexOf("(");
  if (parenIndex !== -1) {
    return text.substring(0, parenIndex);
  }
  return text;
}

/**
 * Extract additional Python symbols
 */
function extract_additional_symbols(
  node: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];
  const py_context = context.language_context as PythonContext;
  
  // Handle assignment statements (all Python variables are mutable)
  if (node.type === "assignment") {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    
    // Extract variable names from the left side
    if (left && left.type === "identifier") {
      symbols.push({
        name: left.text,
        kind: "variable",
        location: {
          file_path: context.file_path,
          line: left.startPosition.row + 1,
          column: left.startPosition.column + 1,
          end_line: left.endPosition.row + 1,
          end_column: left.endPosition.column + 1,
        },
        metadata: {
          is_mutable: true,
          initial_value: right ? context.source_code.substring(right.startIndex, right.endIndex) : undefined,
        },
      });
    }
  }
  
  // Handle annotated assignments (e.g., x: int = 5)
  if (node.type === "annotated_assignment") {
    const target = node.childForFieldName("target");
    const value = node.childForFieldName("value");
    
    if (target && target.type === "identifier") {
      symbols.push({
        name: target.text,
        kind: "variable",
        location: {
          file_path: context.file_path,
          line: target.startPosition.row + 1,
          column: target.startPosition.column + 1,
          end_line: target.endPosition.row + 1,
          end_column: target.endPosition.column + 1,
        },
        metadata: {
          is_mutable: true,
          initial_value: value ? context.source_code.substring(value.startIndex, value.endIndex) : undefined,
        },
      });
    }
  }

  // Handle walrus operator (assignment expressions)
  if (node.type === "named_expression") {
    const name_node = node.childForFieldName("name");
    if (name_node) {
      symbols.push({
        name: name_node.text,
        kind: "variable",
        location: {
          file_path: context.file_path,
          line: name_node.startPosition.row + 1,
          column: name_node.startPosition.column + 1,
          end_line: name_node.endPosition.row + 1,
          end_column: name_node.endPosition.column + 1,
        },
        metadata: {
          is_walrus: true,
        },
      });
    }
  }

  // Handle import aliases
  if (node.type === "aliased_import") {
    const alias = node.childForFieldName("alias");
    const name = node.childForFieldName("name");
    if (alias) {
      symbols.push({
        name: alias.text,
        kind: "import",
        location: {
          file_path: context.file_path,
          line: alias.startPosition.row + 1,
          column: alias.startPosition.column + 1,
          end_line: alias.endPosition.row + 1,
          end_column: alias.endPosition.column + 1,
        },
        metadata: {
          imported_as: name?.text,
        },
      });
    }
  }

  // Handle multiple assignment targets
  if (node.type === "assignment") {
    const left = node.childForFieldName("left");
    if (left && (left.type === "pattern_list" || left.type === "tuple_pattern")) {
      const vars = new Set<string>();
      extract_pattern_vars(left, vars);
      for (const var_name of vars) {
        symbols.push({
          name: var_name,
          kind: "variable",
          location: {
            file_path: context.file_path,
            line: left.startPosition.row + 1,
            column: left.startPosition.column + 1,
            end_line: left.endPosition.row + 1,
            end_column: left.endPosition.column + 1,
          },
        });
      }
    }
  }

  // Handle with statement variables
  if (node.type === "with_item") {
    const alias = node.childForFieldName("alias");
    if (alias) {
      const vars = new Set<string>();
      extract_pattern_vars(alias, vars);
      for (const var_name of vars) {
        symbols.push({
          name: var_name,
          kind: "variable",
          location: {
            file_path: context.file_path,
            line: alias.startPosition.row + 1,
            column: alias.startPosition.column + 1,
            end_line: alias.endPosition.row + 1,
            end_column: alias.endPosition.column + 1,
          },
          metadata: {
            is_context_var: true,
          },
        });
      }
    }
  }

  return symbols;
}

/**
 * Post-process Python tree for LEGB resolution
 */
function post_process(tree: ScopeTree, context: GenericScopeContext): void {
  const py_context = context.language_context as PythonContext;

  // Process global declarations
  for (const [scope_id, var_names] of py_context.global_declarations) {
    const scope = tree.nodes.get(scope_id);
    if (!scope) continue;

    for (const var_name of var_names) {
      // Remove from current scope and add to global
      const symbol = scope.symbols.get(var_name);
      if (symbol) {
        scope.symbols.delete(var_name);
        const global_scope = tree.nodes.get(tree.root_id);
        if (global_scope) {
          global_scope.symbols.set(var_name, {
            ...symbol,
            metadata: {
              ...symbol.metadata,
              declared_global: true,
            },
          });
        }
      }
    }
  }

  // Process nonlocal declarations
  for (const [scope_id, nonlocals] of py_context.nonlocal_declarations) {
    const scope = tree.nodes.get(scope_id);
    if (!scope) continue;

    for (const [var_name, target_scope_id] of nonlocals) {
      // Remove from current scope and ensure it's in target scope
      const symbol = scope.symbols.get(var_name);
      if (symbol) {
        scope.symbols.delete(var_name);
        const target_scope = tree.nodes.get(target_scope_id);
        if (target_scope) {
          target_scope.symbols.set(var_name, {
            ...symbol,
            metadata: {
              ...symbol.metadata,
              declared_nonlocal: true,
            },
          });
        }
      }
    }
  }

  // Mark class scopes (they don't participate in closure)
  for (const scope_id of py_context.class_scopes) {
    const scope = tree.nodes.get(scope_id);
    if (scope && scope.metadata) {
      scope.metadata.is_class_scope = true;
    }
  }

  // Add decorator metadata
  for (const [name, decorators] of py_context.decorators) {
    for (const [_, scope] of tree.nodes) {
      const symbol = scope.symbols.get(name);
      if (symbol) {
        symbol.metadata = {
          ...symbol.metadata,
          decorators,
        };
      }
    }
  }
}

/**
 * Extract Python-specific scope metadata
 */
function extract_scope_metadata(
  node: SyntaxNode,
  context: GenericScopeContext
): Record<string, any> {
  const metadata: Record<string, any> = {};

  // Mark async functions
  if (node.type === "function_definition") {
    const async_keyword = node.child(0);
    if (async_keyword && async_keyword.text === "async") {
      metadata.is_async = true;
    }
  }

  // Mark generator functions
  if (node.type === "function_definition") {
    // Check if body contains yield
    const body = node.childForFieldName("body");
    if (body && contains_yield(body)) {
      metadata.is_generator = true;
    }
  }

  // Mark comprehension scopes
  if (is_comprehension(node)) {
    metadata.is_comprehension = true;
  }

  return metadata;
}

/**
 * Check if a node contains yield
 */
function contains_yield(node: SyntaxNode): boolean {
  if (node.type === "yield" || node.type === "yield_expression") {
    return true;
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && contains_yield(child)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find enclosing definition for nonlocal
 */
function find_enclosing_definition(
  tree: ScopeTree,
  scope_id: ScopeId,
  var_name: string
): ScopeId | undefined {
  const chain = get_scope_chain(tree, scope_id);
  
  // Skip current scope and class scopes
  for (let i = 1; i < chain.length; i++) {
    const scope = chain[i];
    
    // Skip class scopes for nonlocal
    if (scope.metadata?.is_class_scope) {
      continue;
    }
    
    if (scope.symbols.has(var_name)) {
      return scope.id;
    }
  }
  
  return undefined;
}

/**
 * Apply LEGB resolution for Python
 */
export function resolve_python_symbol(
  tree: ScopeTree,
  scope_id: ScopeId,
  symbol_name: string
): ScopeSymbol | undefined {
  // Check if it's a built-in
  if (is_builtin_symbol(symbol_name, "python")) {
    return {
      name: symbol_name,
      kind: "builtin",
      location: {
        file_path: tree.file_path,
        line: 0,
        column: 0,
      },
      metadata: {
        is_builtin: true,
      },
    };
  }

  // Regular scope chain resolution
  return find_symbol_in_scope_chain(tree, scope_id, symbol_name);
}