/**
 * Python-specific scope tree building
 *
 * Handles Python scoping rules:
 * - Function and class scopes
 * - No block scopes (except comprehensions)
 * - Global and nonlocal declarations
 * - Module-level scope
 */

// TODO: Usage Finder - Search scope tree for references

import { SyntaxNode } from "tree-sitter";
import {
  ScopeTreeContext,
  create_scope_tree,
  get_scope_chain,
} from "./scope_tree";
import { FilePath } from "@ariadnejs/types";
import { ScopeTree, ScopeNode, ScopeType, ScopeSymbol } from "@ariadnejs/types";

/**
 * Build Python-specific scope tree
 */
export function build_python_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  file_path: FilePath
): ScopeTree {
  const tree = create_scope_tree(file_path, root_node);

  // Update root node range
  const root_scope = tree.nodes.get(tree.root_id)!;
  root_scope.range = {
    start: {
      row: root_node.startPosition.row,
      column: root_node.startPosition.column,
    },
    end: {
      row: root_node.endPosition.row,
      column: root_node.endPosition.column,
    },
  };

  const context: PythonScopeContext = {
    language: "python",
    source_code,
    file_path,
    current_scope_id: tree.root_id,
    scope_id_counter: 1,
    global_vars: new Set(),
    nonlocal_vars: new Map(),
  };

  // Traverse and build
  traverse_python_ast(root_node, tree, context);

  // Handle global/nonlocal declarations
  process_global_nonlocal_declarations(tree, context);

  return tree;
}

interface PythonScopeContext extends ScopeTreeContext {
  global_vars: Set<string>;
  nonlocal_vars: Map<string, string>; // var -> scope_id
}

/**
 * Traverse Python AST and build scopes
 */
function traverse_python_ast(
  node: SyntaxNode,
  tree: ScopeTree,
  context: PythonScopeContext
) {
  // Check for global/nonlocal declarations
  if (node.type === "global_statement") {
    extract_global_vars(node, context);
  } else if (node.type === "nonlocal_statement") {
    extract_nonlocal_vars(node, context);
  }

  // Check if this node creates a new scope
  if (creates_python_scope(node)) {
    const scope_id = `scope_${context.scope_id_counter++}`;
    const scope_type = get_python_scope_type(node);

    const new_scope: ScopeNode = {
      id: scope_id,
      type: scope_type,
      range: {
        start: {
          row: node.startPosition.row,
          column: node.startPosition.column,
        },
        end: {
          row: node.endPosition.row,
          column: node.endPosition.column,
        },
      },
      parent_id: context.current_scope_id,
      child_ids: [],
      symbols: new Map(),
      metadata: extract_python_scope_metadata(node, context.source_code),
    };

    // Add to tree
    tree.nodes.set(scope_id, new_scope);

    // Link to parent
    const parent_scope = tree.nodes.get(context.current_scope_id!);
    if (parent_scope) {
      parent_scope.child_ids.push(scope_id);
    }

    // Process parameters for functions
    if (node.type === "function_definition" || node.type === "lambda") {
      extract_python_parameters(node, new_scope, context.source_code);
    }

    // Update context for children (clear global/nonlocal for nested scopes)
    const child_context: PythonScopeContext = {
      ...context,
      current_scope_id: scope_id,
      global_vars: new Set(),
      nonlocal_vars: new Map(),
    };

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_python_ast(child, tree, child_context);
      }
    }
  } else {
    // Check for symbol definitions
    const symbols = extract_python_symbols(node, context);
    for (const symbol of symbols) {
      const current_scope = tree.nodes.get(context.current_scope_id!);
      if (current_scope) {
        // Check if this is a global/nonlocal variable
        if (context.global_vars.has(symbol.name)) {
          // Add to global scope instead
          const global_scope = tree.nodes.get(tree.root_id);
          if (global_scope) {
            global_scope.symbols.set(symbol.name, symbol);
          }
        } else if (context.nonlocal_vars.has(symbol.name)) {
          // Add to specified nonlocal scope
          const target_scope_id = context.nonlocal_vars.get(symbol.name);
          if (target_scope_id) {
            const target_scope = tree.nodes.get(target_scope_id);
            if (target_scope) {
              target_scope.symbols.set(symbol.name, symbol);
            }
          }
        } else {
          // Add to current scope
          current_scope.symbols.set(symbol.name, symbol);
        }
      }
    }

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_python_ast(child, tree, context);
      }
    }
  }
}

/**
 * Check if node creates a Python scope
 */
function creates_python_scope(node: SyntaxNode): boolean {
  return [
    "function_definition",
    "lambda",
    "class_definition",
    "list_comprehension",
    "set_comprehension",
    "dictionary_comprehension",
    "generator_expression",
  ].includes(node.type);
}

/**
 * Get Python scope type
 */
function get_python_scope_type(node: SyntaxNode): ScopeType {
  switch (node.type) {
    case "function_definition":
    case "lambda":
      return "function";

    case "class_definition":
      return "class";

    case "list_comprehension":
    case "set_comprehension":
    case "dictionary_comprehension":
    case "generator_expression":
      return "local";

    default:
      return "local";
  }
}

/**
 * Extract global variables from global statement
 */
function extract_global_vars(
  global_node: SyntaxNode,
  context: PythonScopeContext
) {
  const { source_code } = context;

  for (let i = 0; i < global_node.childCount; i++) {
    const child = global_node.child(i);
    if (child && child.type === "identifier") {
      const var_name = source_code.substring(child.startIndex, child.endIndex);
      context.global_vars.add(var_name);
    }
  }
}

/**
 * Extract nonlocal variables from nonlocal statement
 */
function extract_nonlocal_vars(
  nonlocal_node: SyntaxNode,
  context: PythonScopeContext
) {
  const { source_code } = context;

  for (let i = 0; i < nonlocal_node.childCount; i++) {
    const child = nonlocal_node.child(i);
    if (child && child.type === "identifier") {
      const var_name = source_code.substring(child.startIndex, child.endIndex);
      // Find the enclosing scope that has this variable
      // For now, just mark it as nonlocal
      context.nonlocal_vars.set(var_name, context.current_scope_id || "");
    }
  }
}

/**
 * Extract Python parameters
 */
function extract_python_parameters(
  func_node: SyntaxNode,
  scope: ScopeNode,
  source_code: string
) {
  const params = func_node.childForFieldName("parameters");
  if (!params) return;

  for (let i = 0; i < params.childCount; i++) {
    const param = params.child(i);
    if (
      !param ||
      param.type === "(" ||
      param.type === ")" ||
      param.type === ","
    ) {
      continue;
    }

    const param_symbol = extract_python_parameter_symbol(param, source_code);
    if (param_symbol) {
      scope.symbols.set(param_symbol.name, param_symbol);
    }
  }
}

/**
 * Extract Python parameter as symbol
 */
function extract_python_parameter_symbol(
  param_node: SyntaxNode,
  source_code: string
): ScopeSymbol | undefined {
  let name: string | undefined;
  let type_info: string | undefined;

  switch (param_node.type) {
    case "identifier":
      name = source_code.substring(param_node.startIndex, param_node.endIndex);
      break;

    case "typed_parameter":
      // name: type
      const name_node = param_node.child(0);
      const type_node = param_node.childForFieldName("type");

      if (name_node && name_node.type === "identifier") {
        name = source_code.substring(name_node.startIndex, name_node.endIndex);
      }

      if (type_node) {
        type_info = source_code.substring(
          type_node.startIndex,
          type_node.endIndex
        );
      }
      break;

    case "default_parameter":
      // name = default or name: type = default
      const left = param_node.childForFieldName("name");
      if (left) {
        if (left.type === "identifier") {
          name = source_code.substring(left.startIndex, left.endIndex);
        } else if (left.type === "typed_parameter") {
          return extract_python_parameter_symbol(left, source_code);
        }
      }
      break;

    case "list_splat_pattern":
      // *args
      const splat_name = param_node.child(1); // Skip *
      if (splat_name && splat_name.type === "identifier") {
        name = source_code.substring(
          splat_name.startIndex,
          splat_name.endIndex
        );
      }
      break;

    case "dictionary_splat_pattern":
      // **kwargs
      const kwarg_name = param_node.child(1); // Skip **
      if (kwarg_name && kwarg_name.type === "identifier") {
        name = source_code.substring(
          kwarg_name.startIndex,
          kwarg_name.endIndex
        );
      }
      break;
  }

  if (name) {
    return {
      name,
      kind: "parameter",
      range: {
        start: {
          row: param_node.startPosition.row,
          column: param_node.startPosition.column,
        },
        end: {
          row: param_node.endPosition.row,
          column: param_node.endPosition.column,
        },
      },
      type_info,
    };
  }

  return undefined;
}

/**
 * Extract Python symbols
 */
function extract_python_symbols(
  node: SyntaxNode,
  context: PythonScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];
  const { source_code } = context;

  // Assignment statements
  if (node.type === "assignment") {
    const left = node.childForFieldName("left");
    const type_node = node.childForFieldName("type");

    if (left) {
      const names = extract_assignment_targets(left, source_code);
      const type_info = type_node
        ? source_code.substring(type_node.startIndex, type_node.endIndex)
        : undefined;

      for (const name of names) {
        symbols.push({
          name,
          kind: "variable",
          range: {
            start: {
              row: node.startPosition.row,
              column: node.startPosition.column,
            },
            end: {
              row: node.endPosition.row,
              column: node.endPosition.column,
            },
          },
          type_info,
        });
      }
    }
  }

  // Annotated assignment (with type hints)
  if (node.type === "annotated_assignment") {
    const left = node.childForFieldName("left");
    const type_node = node.childForFieldName("type");

    if (left && left.type === "identifier") {
      const name = source_code.substring(left.startIndex, left.endIndex);
      const type_info = type_node
        ? source_code.substring(type_node.startIndex, type_node.endIndex)
        : undefined;

      symbols.push({
        name,
        kind: "variable",
        range: {
          start: {
            row: node.startPosition.row,
            column: node.startPosition.column,
          },
          end: {
            row: node.endPosition.row,
            column: node.endPosition.column,
          },
        },
        type_info,
      });
    }
  }

  // Function definitions
  if (node.type === "function_definition") {
    const name_node = node.childForFieldName("name");
    const return_type = node.childForFieldName("return_type");

    if (name_node) {
      const name = source_code.substring(
        name_node.startIndex,
        name_node.endIndex
      );
      const type_info = return_type
        ? `-> ${source_code.substring(
            return_type.startIndex,
            return_type.endIndex
          )}`
        : undefined;

      symbols.push({
        name,
        kind: "function",
        range: {
          start: {
            row: node.startPosition.row,
            column: node.startPosition.column,
          },
          end: {
            row: node.endPosition.row,
            column: node.endPosition.column,
          },
        },
        type_info,
      });
    }
  }

  // Class definitions
  if (node.type === "class_definition") {
    const name_node = node.childForFieldName("name");

    if (name_node) {
      const name = source_code.substring(
        name_node.startIndex,
        name_node.endIndex
      );

      symbols.push({
        name,
        kind: "class",
        range: {
          start: {
            row: node.startPosition.row,
            column: node.startPosition.column,
          },
          end: {
            row: node.endPosition.row,
            column: node.endPosition.column,
          },
        },
      });
    }
  }

  // For loop targets
  if (node.type === "for_statement") {
    const left = node.childForFieldName("left");
    if (left) {
      const names = extract_assignment_targets(left, source_code);
      for (const name of names) {
        symbols.push({
          name,
          kind: "variable",
          range: {
            start: {
              row: left.startPosition.row,
              column: left.startPosition.column,
            },
            end: {
              row: left.endPosition.row,
              column: left.endPosition.column,
            },
          },
        });
      }
    }
  }

  // With statement targets
  if (node.type === "with_item") {
    const alias = node.childForFieldName("alias");
    if (alias) {
      const names = extract_assignment_targets(alias, source_code);
      for (const name of names) {
        symbols.push({
          name,
          kind: "variable",
          range: {
            start: {
              row: alias.startPosition.row,
              column: alias.startPosition.column,
            },
            end: {
              row: alias.endPosition.row,
              column: alias.endPosition.column,
            },
          },
        });
      }
    }
  }

  // Exception handlers
  if (node.type === "except_clause") {
    const alias = node.childForFieldName("alias");
    if (alias && alias.type === "as_pattern") {
      const alias_name = alias.childForFieldName("alias");
      if (alias_name && alias_name.type === "identifier") {
        const name = source_code.substring(
          alias_name.startIndex,
          alias_name.endIndex
        );
        symbols.push({
          name,
          kind: "variable",
          range: {
            start: {
              row: alias_name.startPosition.row,
              column: alias_name.startPosition.column,
            },
            end: {
              row: alias_name.endPosition.row,
              column: alias_name.endPosition.column,
            },
          },
        });
      }
    }
  }

  return symbols;
}

/**
 * Extract assignment targets (handles tuple unpacking)
 */
function extract_assignment_targets(
  node: SyntaxNode,
  source_code: string
): string[] {
  const names: string[] = [];

  if (node.type === "identifier") {
    names.push(source_code.substring(node.startIndex, node.endIndex));
  } else if (node.type === "pattern_list" || node.type === "tuple_pattern") {
    // Tuple unpacking
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (
        child &&
        child.type !== "," &&
        child.type !== "(" &&
        child.type !== ")"
      ) {
        names.push(...extract_assignment_targets(child, source_code));
      }
    }
  } else if (node.type === "list_pattern") {
    // List unpacking
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (
        child &&
        child.type !== "," &&
        child.type !== "[" &&
        child.type !== "]"
      ) {
        names.push(...extract_assignment_targets(child, source_code));
      }
    }
  } else if (node.type === "subscript") {
    // Ignore subscript assignments for now
  } else if (node.type === "attribute") {
    // Ignore attribute assignments for now
  }

  return names;
}

/**
 * Extract Python scope metadata
 */
function extract_python_scope_metadata(
  node: SyntaxNode,
  source_code: string
): Record<string, any> | undefined {
  const metadata: Record<string, any> = {};

  // Extract function/class name
  const name_node = node.childForFieldName("name");
  if (name_node) {
    metadata.name = source_code.substring(
      name_node.startIndex,
      name_node.endIndex
    );
  }

  // Check for decorators
  const decorators = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === "decorator") {
      const decorator_name = extract_decorator_name(child, source_code);
      if (decorator_name) {
        decorators.push(decorator_name);
      }
    }
  }

  if (decorators.length > 0) {
    metadata.decorators = decorators;

    // Check for common decorators
    if (decorators.includes("staticmethod")) {
      metadata.is_static = true;
    }
    if (decorators.includes("classmethod")) {
      metadata.is_classmethod = true;
    }
    if (decorators.includes("property")) {
      metadata.is_property = true;
    }
    if (decorators.some((d) => d.includes("async"))) {
      metadata.is_async = true;
    }
  }

  // Check for async functions
  if (node.type === "function_definition") {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === "async") {
        metadata.is_async = true;
        break;
      }
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Extract decorator name
 */
function extract_decorator_name(
  decorator_node: SyntaxNode,
  source_code: string
): string | undefined {
  // Skip @ symbol
  const expr = decorator_node.child(1);
  if (expr) {
    if (expr.type === "identifier") {
      return source_code.substring(expr.startIndex, expr.endIndex);
    } else if (expr.type === "call") {
      const func = expr.childForFieldName("function");
      if (func && func.type === "identifier") {
        return source_code.substring(func.startIndex, func.endIndex);
      }
    }
  }
  return undefined;
}

/**
 * Process global/nonlocal declarations
 */
function process_global_nonlocal_declarations(
  tree: ScopeTree,
  context: PythonScopeContext
) {
  // This would need more complex processing to properly handle
  // nonlocal declarations that reference outer scopes
  // For now, the basic implementation handles them during traversal
}

/**
 * Resolve Python symbol with LEGB rule
 */
export function resolve_python_symbol(
  tree: ScopeTree,
  scope_id: string,
  symbol_name: string
): { symbol: ScopeSymbol; scope: ScopeNode } | undefined {
  const chain = get_scope_chain(tree, scope_id);

  // LEGB: Local, Enclosing, Global, Built-in
  for (const scope of chain) {
    const symbol = scope.symbols.get(symbol_name);
    if (symbol) {
      return { symbol, scope };
    }
  }

  // Check built-ins (would need a built-in symbol table)
  if (is_python_builtin(symbol_name)) {
    return {
      symbol: {
        name: symbol_name,
        kind: "builtin",
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } },
      },
      scope: tree.nodes.get(tree.root_id)!,
    };
  }

  return undefined;
}

/**
 * Check if symbol is a Python built-in
 */
function is_python_builtin(name: string): boolean {
  const builtins = [
    "print",
    "len",
    "range",
    "str",
    "int",
    "float",
    "bool",
    "list",
    "dict",
    "set",
    "tuple",
    "type",
    "isinstance",
    "hasattr",
    "getattr",
    "setattr",
    "delattr",
    "dir",
    "id",
    "hex",
    "bin",
    "oct",
    "abs",
    "round",
    "sum",
    "min",
    "max",
    "sorted",
    "reversed",
    "enumerate",
    "zip",
    "map",
    "filter",
    "any",
    "all",
    "open",
    "input",
    "True",
    "False",
    "None",
    "__name__",
    "__file__",
  ];
  return builtins.includes(name);
}
