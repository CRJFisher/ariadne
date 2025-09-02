/**
 * Rust-specific scope tree building
 *
 * Handles Rust scoping rules:
 * - Block scopes with ownership
 * - Module and crate scopes
 * - Impl blocks and trait scopes
 * - Lifetime scopes
 */

// TODO: Usage Finder - Search scope tree for references

import { SyntaxNode } from "tree-sitter";
import {
  ScopeTreeContext,
  create_scope_tree,
  get_scope_chain,
} from "./scope_tree";
import { node_to_location } from "../../ast/node_utils";
import {
  FilePath,
  ScopeNode,
  ScopeSymbol,
  ScopeTree,
  ScopeType,
} from "@ariadnejs/types";

/**
 * Build Rust-specific scope tree
 */
export function build_rust_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  file_path: FilePath
): ScopeTree {
  const tree = create_scope_tree(file_path, root_node);

  // Update root node range
  const root_scope = tree.nodes.get(tree.root_id)!;

  // Rust files are implicitly modules
  root_scope.type = "module";

  const context: RustScopeContext = {
    language: "rust",
    source_code,
    file_path,
    current_scope_id: tree.root_id,
    scope_id_counter: 1,
    in_unsafe_block: false,
    current_impl_type: undefined,
  };

  // Traverse and build
  traverse_rust_ast(root_node, tree, context);

  return tree;
}

interface RustScopeContext extends ScopeTreeContext {
  in_unsafe_block: boolean;
  current_impl_type?: string;
}

/**
 * Traverse Rust AST and build scopes
 */
function traverse_rust_ast(
  node: SyntaxNode,
  tree: ScopeTree,
  context: RustScopeContext
) {
  // Check for unsafe blocks
  if (node.type === "unsafe_block") {
    context = { ...context, in_unsafe_block: true };
  }

  // Check for impl blocks (track the type being implemented)
  if (node.type === "impl_item") {
    const type_node = node.childForFieldName("type");
    if (type_node) {
      context = {
        ...context,
        current_impl_type: context.source_code.substring(
          type_node.startIndex,
          type_node.endIndex
        ),
      };
    }
  }

  // Check if this node creates a new scope
  if (creates_rust_scope(node)) {
    const scope_id = `scope_${context.scope_id_counter++}`;
    const scope_type = get_rust_scope_type(node);

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
      metadata: extract_rust_scope_metadata(node, context),
    };

    // Add to tree
    tree.nodes.set(scope_id, new_scope);

    // Link to parent
    const parent_scope = tree.nodes.get(context.current_scope_id!);
    if (parent_scope) {
      parent_scope.child_ids.push(scope_id);
    }

    // Process function parameters and generics
    if (node.type === "function_item" || node.type === "closure_expression") {
      extract_rust_parameters(node, new_scope, context.source_code);
      extract_rust_generics(node, new_scope, context.source_code);
    }

    // Update context for children
    const child_context = { ...context, current_scope_id: scope_id };

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_rust_ast(child, tree, child_context);
      }
    }
  } else {
    // Check for symbol definitions
    const symbols = extract_rust_symbols(node, context);
    for (const symbol of symbols) {
      const current_scope = tree.nodes.get(context.current_scope_id!);
      if (current_scope) {
        current_scope.symbols.set(symbol.name, symbol);
      }
    }

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_rust_ast(child, tree, context);
      }
    }
  }
}

/**
 * Check if node creates a Rust scope
 */
function creates_rust_scope(node: SyntaxNode): boolean {
  return [
    "function_item",
    "closure_expression",
    "block",
    "if_expression",
    "match_expression",
    "while_expression",
    "loop_expression",
    "for_expression",
    "impl_item",
    "trait_item",
    "mod_item",
    "unsafe_block",
  ].includes(node.type);
}

/**
 * Get Rust scope type
 */
function get_rust_scope_type(node: SyntaxNode): ScopeType {
  switch (node.type) {
    case "function_item":
    case "closure_expression":
      return "function";

    case "impl_item":
    case "trait_item":
      return "class";

    case "mod_item":
      return "module";

    default:
      return "block";
  }
}

/**
 * Extract Rust parameters
 */
function extract_rust_parameters(
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

    const param_symbols = extract_rust_parameter_symbols(param, source_code);
    for (const symbol of param_symbols) {
      scope.symbols.set(symbol.name, symbol);
    }
  }
}

/**
 * Extract Rust generics
 */
function extract_rust_generics(
  node: SyntaxNode,
  scope: ScopeNode,
  source_code: string
) {
  const type_params = node.childForFieldName("type_parameters");
  if (!type_params) return;

  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (
      param &&
      (param.type === "type_identifier" || param.type === "lifetime")
    ) {
      const name = source_code.substring(param.startIndex, param.endIndex);
      scope.symbols.set(name, {
        name,
        kind: param.type === "lifetime" ? "lifetime" : "type_parameter",
        range: {
          start: {
            row: param.startPosition.row,
            column: param.startPosition.column,
          },
          end: {
            row: param.endPosition.row,
            column: param.endPosition.column,
          },
        },
      });
    } else if (param && param.type === "generic_type") {
      const name_node = param.child(0);
      if (name_node) {
        const name = source_code.substring(
          name_node.startIndex,
          name_node.endIndex
        );
        scope.symbols.set(name, {
          name,
          kind: "type_parameter",
          range: {
            start: {
              row: param.startPosition.row,
              column: param.startPosition.column,
            },
            end: {
              row: param.endPosition.row,
              column: param.endPosition.column,
            },
          },
        });
      }
    }
  }
}

/**
 * Extract Rust parameter symbols
 */
function extract_rust_parameter_symbols(
  param_node: SyntaxNode,
  source_code: string
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];

  if (param_node.type === "parameter") {
    const pattern = param_node.childForFieldName("pattern");
    const type_node = param_node.childForFieldName("type");

    if (pattern) {
      const names = extract_pattern_bindings(pattern, source_code);
      const type_info = type_node
        ? source_code.substring(type_node.startIndex, type_node.endIndex)
        : undefined;

      for (const name of names) {
        symbols.push({
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
        });
      }
    }
  } else if (param_node.type === "self_parameter") {
    // Handle self, &self, &mut self, etc.
    symbols.push({
      name: "self",
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
      type_info: source_code.substring(
        param_node.startIndex,
        param_node.endIndex
      ),
    });
  } else if (param_node.type === "closure_parameters") {
    // Handle closure parameters
    for (let i = 0; i < param_node.childCount; i++) {
      const child = param_node.child(i);
      if (child && child.type !== "|" && child.type !== ",") {
        const child_symbols = extract_rust_parameter_symbols(
          child,
          source_code
        );
        symbols.push(...child_symbols);
      }
    }
  } else if (param_node.type === "identifier") {
    // Simple parameter in closure
    symbols.push({
      name: source_code.substring(param_node.startIndex, param_node.endIndex),
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
    });
  }

  return symbols;
}

/**
 * Extract pattern bindings
 */
function extract_pattern_bindings(
  pattern: SyntaxNode,
  source_code: string
): string[] {
  const names: string[] = [];

  switch (pattern.type) {
    case "identifier":
      names.push(source_code.substring(pattern.startIndex, pattern.endIndex));
      break;

    case "mutable_specifier":
      // mut pattern
      const ident = pattern.child(1); // Skip 'mut'
      if (ident && ident.type === "identifier") {
        names.push(source_code.substring(ident.startIndex, ident.endIndex));
      }
      break;

    case "tuple_pattern":
      // (a, b, c)
      for (let i = 0; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        if (
          child &&
          child.type !== "," &&
          child.type !== "(" &&
          child.type !== ")"
        ) {
          names.push(...extract_pattern_bindings(child, source_code));
        }
      }
      break;

    case "struct_pattern":
      // Struct { field1, field2 }
      const fields = pattern.childForFieldName("fields");
      if (fields) {
        for (let i = 0; i < fields.childCount; i++) {
          const field = fields.child(i);
          if (field && field.type === "field_pattern") {
            const field_name = field.childForFieldName("name");
            if (field_name) {
              names.push(
                source_code.substring(
                  field_name.startIndex,
                  field_name.endIndex
                )
              );
            }
          } else if (field && field.type === "identifier") {
            names.push(source_code.substring(field.startIndex, field.endIndex));
          }
        }
      }
      break;

    case "ref_pattern":
      // ref pattern or ref mut pattern
      const ref_ident = pattern.child(pattern.childCount - 1);
      if (ref_ident && ref_ident.type === "identifier") {
        names.push(
          source_code.substring(ref_ident.startIndex, ref_ident.endIndex)
        );
      }
      break;

    case "slice_pattern":
      // [head, tail @ ..]
      for (let i = 0; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        if (
          child &&
          child.type !== "," &&
          child.type !== "[" &&
          child.type !== "]"
        ) {
          names.push(...extract_pattern_bindings(child, source_code));
        }
      }
      break;
  }

  return names;
}

/**
 * Extract Rust symbols
 */
function extract_rust_symbols(
  node: SyntaxNode,
  context: RustScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];
  const { source_code } = context;

  // Let declarations
  if (node.type === "let_declaration") {
    const pattern = node.childForFieldName("pattern");
    const type_node = node.childForFieldName("type");

    if (pattern) {
      const names = extract_pattern_bindings(pattern, source_code);
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

  // Const and static items
  if (node.type === "const_item" || node.type === "static_item") {
    const name_node = node.childForFieldName("name");
    const type_node = node.childForFieldName("type");

    if (name_node) {
      const name = source_code.substring(
        name_node.startIndex,
        name_node.endIndex
      );
      const type_info = type_node
        ? source_code.substring(type_node.startIndex, type_node.endIndex)
        : undefined;

      symbols.push({
        name,
        kind: node.type === "const_item" ? "constant" : "static",
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

  // Function items
  if (node.type === "function_item") {
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

  // Struct items
  if (node.type === "struct_item") {
    const name_node = node.childForFieldName("name");

    if (name_node) {
      const name = source_code.substring(
        name_node.startIndex,
        name_node.endIndex
      );

      symbols.push({
        name,
        kind: "struct",
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

  // Enum items
  if (node.type === "enum_item") {
    const name_node = node.childForFieldName("name");

    if (name_node) {
      const name = source_code.substring(
        name_node.startIndex,
        name_node.endIndex
      );

      symbols.push({
        name,
        kind: "enum",
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

  // Type aliases
  if (node.type === "type_item") {
    const name_node = node.childForFieldName("name");
    const type_node = node.childForFieldName("type");

    if (name_node) {
      const name = source_code.substring(
        name_node.startIndex,
        name_node.endIndex
      );
      const type_info = type_node
        ? source_code.substring(type_node.startIndex, type_node.endIndex)
        : undefined;

      symbols.push({
        name,
        kind: "type_alias",
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

  // Use declarations (imports)
  if (node.type === "use_declaration") {
    const use_list = node.childForFieldName("argument");
    if (use_list) {
      const imported_names = extract_use_names(use_list, source_code);
      for (const name of imported_names) {
        symbols.push({
          name,
          kind: "import",
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
          is_imported: true,
        });
      }
    }
  }

  // Match arms with bindings
  if (node.type === "match_arm") {
    const pattern = node.childForFieldName("pattern");
    if (pattern) {
      const names = extract_pattern_bindings(pattern, source_code);
      for (const name of names) {
        symbols.push({
          name,
          kind: "variable",
          range: {
            start: {
              row: pattern.startPosition.row,
              column: pattern.startPosition.column,
            },
            end: {
              row: pattern.endPosition.row,
              column: pattern.endPosition.column,
            },
          },
        });
      }
    }
  }

  // For loop bindings
  if (node.type === "for_expression") {
    const pattern = node.childForFieldName("pattern");
    if (pattern) {
      const names = extract_pattern_bindings(pattern, source_code);
      for (const name of names) {
        symbols.push({
          name,
          kind: "variable",
          range: {
            start: {
              row: pattern.startPosition.row,
              column: pattern.startPosition.column,
            },
            end: {
              row: pattern.endPosition.row,
              column: pattern.endPosition.column,
            },
          },
        });
      }
    }
  }

  // If let and while let bindings
  if (
    node.type === "if_let_expression" ||
    node.type === "while_let_expression"
  ) {
    const pattern = node.childForFieldName("pattern");
    if (pattern) {
      const names = extract_pattern_bindings(pattern, source_code);
      for (const name of names) {
        symbols.push({
          name,
          kind: "variable",
          range: {
            start: {
              row: pattern.startPosition.row,
              column: pattern.startPosition.column,
            },
            end: {
              row: pattern.endPosition.row,
              column: pattern.endPosition.column,
            },
          },
        });
      }
    }
  }

  return symbols;
}

/**
 * Extract names from use declaration
 */
function extract_use_names(
  use_node: SyntaxNode,
  source_code: string
): string[] {
  const names: string[] = [];

  if (use_node.type === "identifier") {
    names.push(source_code.substring(use_node.startIndex, use_node.endIndex));
  } else if (use_node.type === "scoped_identifier") {
    // Get the last part of the path
    const name_part = use_node.childForFieldName("name");
    if (name_part) {
      names.push(
        source_code.substring(name_part.startIndex, name_part.endIndex)
      );
    }
  } else if (use_node.type === "use_list") {
    // use module::{A, B, C}
    for (let i = 0; i < use_node.childCount; i++) {
      const child = use_node.child(i);
      if (
        child &&
        child.type !== "{" &&
        child.type !== "}" &&
        child.type !== ","
      ) {
        names.push(...extract_use_names(child, source_code));
      }
    }
  } else if (use_node.type === "use_as_clause") {
    // use module::Type as Alias
    const alias = use_node.childForFieldName("alias");
    if (alias) {
      names.push(source_code.substring(alias.startIndex, alias.endIndex));
    }
  } else if (use_node.type === "use_wildcard") {
    // use module::*
    // Can't extract specific names from wildcard
  }

  return names;
}

/**
 * Extract Rust scope metadata
 */
function extract_rust_scope_metadata(
  node: SyntaxNode,
  context: RustScopeContext
): Record<string, any> | undefined {
  const { source_code } = context;
  const metadata: Record<string, any> = {};

  // Extract name
  const name_node = node.childForFieldName("name");
  if (name_node) {
    metadata.name = source_code.substring(
      name_node.startIndex,
      name_node.endIndex
    );
  }

  // Check if in unsafe context
  if (context.in_unsafe_block || node.type === "unsafe_block") {
    metadata.is_unsafe = true;
  }

  // For impl blocks, track the type
  if (node.type === "impl_item" && context.current_impl_type) {
    metadata.impl_type = context.current_impl_type;
  }

  // Check for visibility modifiers
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === "visibility_modifier") {
      metadata.visibility = source_code.substring(
        child.startIndex,
        child.endIndex
      );
      break;
    }
  }

  // Check for async functions
  if (node.type === "function_item") {
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
 * Resolve Rust symbol
 */
export function resolve_rust_symbol(
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
  }

  // Check for prelude items
  if (is_rust_prelude_item(symbol_name)) {
    return {
      symbol: {
        name: symbol_name,
        kind: "prelude",
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } },
      },
      scope: tree.nodes.get(tree.root_id)!,
    };
  }

  return undefined;
}

/**
 * Check if symbol is from Rust prelude
 */
function is_rust_prelude_item(name: string): boolean {
  const prelude = [
    "Option",
    "Some",
    "None",
    "Result",
    "Ok",
    "Err",
    "Vec",
    "String",
    "Box",
    "Rc",
    "Arc",
    "Copy",
    "Clone",
    "Debug",
    "Default",
    "Eq",
    "PartialEq",
    "Ord",
    "PartialOrd",
    "Hash",
    "Iterator",
    "IntoIterator",
    "From",
    "Into",
    "AsRef",
    "AsMut",
    "Drop",
    "Fn",
    "FnMut",
    "FnOnce",
    "std",
    "core",
    "alloc",
    "collections",
    "fmt",
    "io",
    "fs",
    "println",
    "print",
    "eprintln",
    "eprint",
    "format",
    "vec",
    "assert",
    "assert_eq",
    "assert_ne",
    "debug_assert",
    "panic",
    "unreachable",
    "unimplemented",
    "todo",
  ];
  return prelude.includes(name);
}
