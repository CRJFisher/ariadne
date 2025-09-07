/**
 * Rust-specific bespoke scope tree handlers
 * 
 * Handles Rust-specific features that cannot be expressed through configuration:
 * - Ownership and borrowing scopes
 * - Lifetime parameters and bounds
 * - Pattern matching and destructuring
 * - Unsafe blocks and contexts
 * - Macro scopes and hygiene
 * - Module path resolution
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
} from "./scope_tree.generic";
import { is_builtin_symbol } from "./language_configs";

/**
 * Rust-specific context
 */
interface RustContext {
  unsafe_blocks: Set<ScopeId>;
  impl_types: Map<ScopeId, string>;
  lifetime_params: Map<ScopeId, Set<string>>;
  pattern_bindings: Map<ScopeId, ScopeSymbol[]>;
  macro_definitions: Map<string, ScopeId>;
  use_statements: Map<ScopeId, Map<string, string>>; // alias -> path
}

/**
 * Create Rust bespoke handlers
 */
export function create_rust_handlers(): BespokeHandlers {
  return {
    initialize_context,
    pre_process_node,
    extract_additional_symbols,
    post_process,
    extract_scope_metadata,
  };
}

/**
 * Initialize Rust-specific context
 */
function initialize_context(): RustContext {
  return {
    unsafe_blocks: new Set(),
    impl_types: new Map(),
    lifetime_params: new Map(),
    pattern_bindings: new Map(),
    macro_definitions: new Map(),
    use_statements: new Map(),
  };
}

/**
 * Pre-process Rust-specific nodes
 */
function pre_process_node(
  node: SyntaxNode,
  tree: ScopeTree,
  context: GenericScopeContext
): boolean {
  const rust_context = context.language_context as RustContext;

  // Track unsafe blocks
  if (node.type === "unsafe_block") {
    const scope_id = `scope_${context.scope_id_counter}`;
    rust_context.unsafe_blocks.add(scope_id);
  }

  // Track impl blocks and their types
  if (node.type === "impl_item") {
    const scope_id = `scope_${context.scope_id_counter}`;
    const type_node = node.childForFieldName("type");
    if (type_node) {
      const type_text = context.source_code.substring(
        type_node.startIndex,
        type_node.endIndex
      );
      rust_context.impl_types.set(scope_id, type_text);
    }
  }

  // Track lifetime parameters
  if (node.type === "type_parameters" || node.type === "generic_parameters") {
    const lifetimes = extract_lifetime_params(node);
    if (lifetimes.size > 0) {
      // Will be added to the next scope created
      const scope_id = `scope_${context.scope_id_counter}`;
      rust_context.lifetime_params.set(scope_id, lifetimes);
    }
  }

  // Track pattern bindings in match arms only (let_declaration is handled in extract_additional_symbols)
  if (node.type === "match_arm") {
    const pattern = node.childForFieldName("pattern");
    if (pattern) {
      const bindings = extract_pattern_bindings(pattern, context);
      if (bindings.length > 0) {
        const scope_id = `scope_${context.scope_id_counter}`;
        rust_context.pattern_bindings.set(scope_id, bindings);
      }
    }
  }

  // Track macro definitions
  if (node.type === "macro_definition") {
    const name_node = node.childForFieldName("name");
    if (name_node) {
      rust_context.macro_definitions.set(
        name_node.text,
        context.current_scope_id
      );
    }
  }

  // Track use statements
  if (node.type === "use_declaration") {
    process_use_statement(node, context, rust_context);
  }

  return false;
}

/**
 * Extract lifetime parameters
 */
function extract_lifetime_params(node: SyntaxNode): Set<string> {
  const lifetimes = new Set<string>();
  
  const find_lifetimes = (n: SyntaxNode) => {
    if (n.type === "lifetime") {
      lifetimes.add(n.text);
    } else if (n.type === "lifetime_parameter") {
      const lifetime = n.childForFieldName("lifetime");
      if (lifetime) {
        lifetimes.add(lifetime.text);
      }
    }
    
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) find_lifetimes(child);
    }
  };
  
  find_lifetimes(node);
  return lifetimes;
}

/**
 * Extract pattern bindings
 */
function extract_pattern_bindings(
  pattern: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol[] {
  const bindings: ScopeSymbol[] = [];
  
  const extract = (node: SyntaxNode) => {
    switch (node.type) {
      case "identifier":
        // Skip wildcards and special identifiers
        if (node.text !== "_" && node.text !== "self") {
          bindings.push({
            name: node.text,
            kind: "variable",
            location: {
              file_path: context.file_path,
              line: node.startPosition.row + 1,
              column: node.startPosition.column + 1,
              end_line: node.endPosition.row + 1,
              end_column: node.endPosition.column + 1,
            },
            metadata: {
              is_pattern_binding: true,
            },
          });
        }
        break;
        
      case "tuple_pattern":
      case "struct_pattern":
      case "slice_pattern":
      case "tuple_struct_pattern":
        // Recursively extract from nested patterns
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) extract(child);
        }
        break;
        
      case "ref_pattern":
      case "mut_pattern":
        // Extract from the inner pattern
        const inner = node.childForFieldName("pattern") || node.lastChild;
        if (inner) extract(inner);
        break;
        
      case "or_pattern":
        // For or patterns, we need all alternatives
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child && child.type !== "|") {
            extract(child);
          }
        }
        break;
        
      case "field_pattern":
        const pattern_field = node.childForFieldName("pattern");
        if (pattern_field) {
          extract(pattern_field);
        } else {
          // Shorthand field pattern
          const name = node.childForFieldName("name");
          if (name) extract(name);
        }
        break;
    }
  };
  
  extract(pattern);
  return bindings;
}

/**
 * Process use statements
 */
function process_use_statement(
  node: SyntaxNode,
  context: GenericScopeContext,
  rust_context: RustContext
): void {
  if (!rust_context.use_statements.has(context.current_scope_id)) {
    rust_context.use_statements.set(context.current_scope_id, new Map());
  }
  
  const uses = rust_context.use_statements.get(context.current_scope_id)!;
  
  const extract_uses = (n: SyntaxNode, path: string = "") => {
    switch (n.type) {
      case "use_as_clause":
        const name = n.childForFieldName("name");
        const alias = n.childForFieldName("alias");
        if (name && alias) {
          const full_path = path ? `${path}::${name.text}` : name.text;
          uses.set(alias.text, full_path);
        }
        break;
        
      case "use_list":
        for (let i = 0; i < n.childCount; i++) {
          const child = n.child(i);
          if (child && child.type !== "{" && child.type !== "}" && child.type !== ",") {
            extract_uses(child, path);
          }
        }
        break;
        
      case "scoped_use_list":
        const scope_path = n.childForFieldName("path");
        const list = n.childForFieldName("list");
        if (scope_path && list) {
          const new_path = path ? `${path}::${scope_path.text}` : scope_path.text;
          extract_uses(list, new_path);
        }
        break;
        
      case "use_wildcard":
        // Handle glob imports
        uses.set("*", `${path}::*`);
        break;
        
      case "identifier":
      case "scoped_identifier":
        const name_text = n.text;
        const last_part = name_text.split("::").pop();
        if (last_part) {
          uses.set(last_part, name_text);
        }
        break;
    }
  };
  
  const argument = node.childForFieldName("argument");
  if (argument) {
    extract_uses(argument);
  }
}

/**
 * Extract additional Rust symbols
 */
function extract_additional_symbols(
  node: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];
  const rust_context = context.language_context as RustContext;

  // Handle let declarations with mutability
  if (node.type === "let_declaration") {
    const value = node.childForFieldName("value");
    
    // Check if it's mutable and find the identifier
    let is_mutable = false;
    let name_node = null;
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        if (child.type === "mutable_specifier") {
          is_mutable = true;
        } else if (child.type === "identifier") {
          name_node = child;
          break; // Found the identifier
        }
      }
    }
    
    // Extract the variable name
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
          is_mutable,
          initial_value: value ? context.source_code.substring(value.startIndex, value.endIndex) : undefined,
        },
      });
    }
  }

  // Handle field definitions in structs
  if (node.type === "field_declaration") {
    const name_node = node.childForFieldName("name");
    if (name_node) {
      symbols.push({
        name: name_node.text,
        kind: "field",
        location: {
          file_path: context.file_path,
          line: name_node.startPosition.row + 1,
          column: name_node.startPosition.column + 1,
          end_line: name_node.endPosition.row + 1,
          end_column: name_node.endPosition.column + 1,
        },
      });
    }
  }

  // Handle enum variants
  if (node.type === "enum_variant") {
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
          is_enum_variant: true,
        },
      });
    }
  }

  // Handle associated types and constants in traits
  if (node.type === "associated_type" || node.type === "const_item") {
    const name_node = node.childForFieldName("name");
    if (name_node) {
      symbols.push({
        name: name_node.text,
        kind: node.type === "associated_type" ? "type" : "variable",
        location: {
          file_path: context.file_path,
          line: name_node.startPosition.row + 1,
          column: name_node.startPosition.column + 1,
          end_line: name_node.endPosition.row + 1,
          end_column: name_node.endPosition.column + 1,
        },
        metadata: {
          is_associated: true,
        },
      });
    }
  }

  // Handle self parameter specially
  if (node.type === "self_parameter") {
    symbols.push({
      name: "self",
      kind: "parameter",
      location: {
        file_path: context.file_path,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column + 1,
      },
      metadata: {
        is_self: true,
        is_mut: node.text.includes("mut"),
        is_ref: node.text.includes("&"),
      },
    });
  }

  return symbols;
}

/**
 * Post-process Rust tree
 */
function post_process(tree: ScopeTree, context: GenericScopeContext): void {
  const rust_context = context.language_context as RustContext;

  // Add pattern bindings to their scopes
  for (const [scope_id, bindings] of rust_context.pattern_bindings) {
    const scope = tree.nodes.get(scope_id);
    if (scope) {
      for (const binding of bindings) {
        scope.symbols.set(binding.name, binding);
      }
    }
  }

  // Mark unsafe scopes
  for (const scope_id of rust_context.unsafe_blocks) {
    const scope = tree.nodes.get(scope_id);
    if (scope) {
      scope.metadata = {
        ...scope.metadata,
        is_unsafe: true,
      };
    }
  }

  // Add impl type information
  for (const [scope_id, impl_type] of rust_context.impl_types) {
    const scope = tree.nodes.get(scope_id);
    if (scope) {
      scope.metadata = {
        ...scope.metadata,
        impl_type,
      };
    }
  }

  // Add lifetime parameters to scopes
  for (const [scope_id, lifetimes] of rust_context.lifetime_params) {
    const scope = tree.nodes.get(scope_id);
    if (scope) {
      for (const lifetime of lifetimes) {
        scope.symbols.set(lifetime, {
          name: lifetime,
          kind: "type",
          location: scope.location,
          metadata: {
            is_lifetime: true,
          },
        });
      }
    }
  }

  // Add use statement imports to scopes
  for (const [scope_id, uses] of rust_context.use_statements) {
    const scope = tree.nodes.get(scope_id);
    if (scope) {
      for (const [alias, path] of uses) {
        scope.symbols.set(alias, {
          name: alias,
          kind: "import",
          location: scope.location,
          metadata: {
            import_path: path,
          },
        });
      }
    }
  }
}

/**
 * Extract Rust-specific scope metadata
 */
function extract_scope_metadata(
  node: SyntaxNode,
  context: GenericScopeContext
): Record<string, any> {
  const rust_context = context.language_context as RustContext;
  const metadata: Record<string, any> = {};

  // Mark async functions
  if (node.type === "function_item") {
    const qualifiers = node.childForFieldName("qualifiers");
    if (qualifiers && qualifiers.text.includes("async")) {
      metadata.is_async = true;
    }
    if (qualifiers && qualifiers.text.includes("const")) {
      metadata.is_const = true;
    }
    if (qualifiers && qualifiers.text.includes("unsafe")) {
      metadata.is_unsafe = true;
    }
  }

  // Mark pub visibility
  const visibility = node.childForFieldName("visibility");
  if (visibility) {
    metadata.visibility = visibility.text;
  }

  // Mark generic items
  if (node.childForFieldName("type_parameters") || 
      node.childForFieldName("generic_parameters")) {
    metadata.is_generic = true;
  }

  // Mark trait implementations
  if (node.type === "impl_item") {
    const trait_node = node.childForFieldName("trait");
    if (trait_node) {
      metadata.implements_trait = context.source_code.substring(
        trait_node.startIndex,
        trait_node.endIndex
      );
    }
  }

  return metadata;
}

/**
 * Resolve Rust symbol with prelude
 */
export function resolve_rust_symbol(
  tree: ScopeTree,
  scope_id: ScopeId,
  symbol_name: string
): ScopeSymbol | undefined {
  // First check normal scope chain
  const chain = get_scope_chain(tree, scope_id);
  
  for (const scope of chain) {
    const symbol = scope.symbols.get(symbol_name);
    if (symbol) {
      return symbol;
    }
  }
  
  // Check if it's a prelude item
  if (is_builtin_symbol(symbol_name, "rust")) {
    return {
      name: symbol_name,
      kind: "builtin",
      location: {
        file_path: tree.file_path,
        line: 0,
        column: 0,
      },
      metadata: {
        is_prelude: true,
      },
    };
  }
  
  return undefined;
}