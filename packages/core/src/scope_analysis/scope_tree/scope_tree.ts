/**
 * Generic scope tree processor
 * 
 * Configuration-driven scope tree building that handles ~80% of logic
 * across all languages. Language-specific bespoke handlers handle the
 * remaining ~20% of unique features.
 */

import { SyntaxNode } from "tree-sitter";
import {
  Language,
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  ScopeType,
  ScopeId,
  FilePath,
  SymbolKind,
  VariableDeclaration,
  VariableName,
  TypeString,
  SymbolId,
  variable_symbol,
} from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
import {
  get_language_config,
  creates_scope,
  get_scope_type,
  ScopeConfiguration,
} from "./language_configs";

/**
 * Get a scope node that must exist in the tree, throwing an error if not found
 */
function get_required_scope(tree: ScopeTree, scope_id: ScopeId): ScopeNode {
  const scope = tree.nodes.get(scope_id);
  if (!scope) {
    throw new Error(`Scope ${scope_id} not found in tree`);
  }
  return scope;
}

/**
 * Module context for scope tree operations
 */
export const SCOPE_TREE_CONTEXT = {
  module: "scope_tree",
  version: "2.0.0",
  refactored: true,
} as const;

/**
 * Context for building scope tree
 */
export interface GenericScopeContext {
  language: Language;
  source_code: string;
  file_path: FilePath;
  current_scope_id: ScopeId;
  scope_id_counter: number;
  config: ScopeConfiguration;
  /** Language-specific context data */
  language_context?: Record<string, any>;
}

/**
 * Create an empty scope tree
 */
export function create_scope_tree(
  file_path: FilePath,
  root_syntax_node: SyntaxNode
): ScopeTree {
  const root_id = "scope_0";
  const root_node: ScopeNode = {
    id: root_id,
    type: "global",
    location: node_to_location(root_syntax_node, file_path),
    child_ids: [],
    symbols: new Map(),
  };

  return {
    root_id,
    nodes: new Map([[root_id, root_node]]),
    file_path,
  };
}

/**
 * Build scope tree using generic processor
 */
export function build_generic_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: FilePath,
  bespoke_handlers?: BespokeHandlers
): ScopeTree {
  const tree = create_scope_tree(file_path, root_node);
  const config = get_language_config(language);

  // For Rust, the root is a module
  if (language === "rust") {
    tree.nodes.get(tree.root_id)!.type = "module";
  }

  const context: GenericScopeContext = {
    language,
    source_code,
    file_path,
    current_scope_id: tree.root_id,
    scope_id_counter: 1,
    config,
    language_context: bespoke_handlers?.initialize_context?.(root_node, source_code),
  };

  // Traverse AST and build scope tree
  traverse_and_build(root_node, tree, context, bespoke_handlers);

  // Apply post-processing
  if (bespoke_handlers?.post_process) {
    bespoke_handlers.post_process(tree, context);
  }

  return tree;
}

/**
 * Bespoke handlers for language-specific features
 */
export interface BespokeHandlers {
  /** Initialize language-specific context */
  initialize_context?: (root: SyntaxNode, source: string) => Record<string, any>;
  
  /** Pre-process node before generic handling */
  pre_process_node?: (
    node: SyntaxNode,
    tree: ScopeTree,
    context: GenericScopeContext
  ) => boolean; // Return true to skip generic processing
  
  /** Check if a node should create a scope (overrides configuration) */
  should_create_scope?: (
    node: SyntaxNode,
    context: GenericScopeContext
  ) => boolean | undefined; // undefined means use default config
  
  /** Extract additional symbols from a node */
  extract_additional_symbols?: (
    node: SyntaxNode,
    context: GenericScopeContext
  ) => ScopeSymbol[];
  
  /** Post-process the entire tree */
  post_process?: (tree: ScopeTree, context: GenericScopeContext) => void;
  
  /** Custom parameter extraction */
  extract_custom_parameters?: (
    node: SyntaxNode,
    scope: ScopeNode,
    context: GenericScopeContext
  ) => void;
  
  /** Custom scope metadata */
  extract_scope_metadata?: (
    node: SyntaxNode,
    context: GenericScopeContext
  ) => Record<string, any>;
}

/**
 * Traverse AST and build scope nodes
 */
function traverse_and_build(
  node: SyntaxNode,
  tree: ScopeTree,
  context: GenericScopeContext,
  bespoke_handlers?: BespokeHandlers
) {
  // Allow bespoke pre-processing
  if (bespoke_handlers?.pre_process_node) {
    if (bespoke_handlers.pre_process_node(node, tree, context)) {
      return; // Skip generic processing if handler returns true
    }
  }

  // Check if this node creates a new scope
  let should_create = creates_scope(node.type, context.language);
  
  // Allow bespoke handler to override
  if (bespoke_handlers?.should_create_scope) {
    const override = bespoke_handlers.should_create_scope(node, context);
    if (override !== undefined) {
      should_create = override;
    }
  }
  
  if (should_create) {
    const scope_id = `scope_${context.scope_id_counter++}`;
    const scope_type = get_scope_type(node.type, context.language);
    const scope_config = context.config.scope_creating_nodes[node.type];

    const new_scope: ScopeNode = {
      id: scope_id,
      type: scope_type,
      location: node_to_location(node, context.file_path),
      parent_id: context.current_scope_id,
      child_ids: [],
      symbols: new Map(),
      metadata: bespoke_handlers?.extract_scope_metadata?.(node, context),
    };

    // Add to tree
    tree.nodes.set(scope_id, new_scope);

    // Link to parent
    const parent_scope = get_required_scope(tree, context.current_scope_id);
    parent_scope.child_ids.push(scope_id);

      // If this node adds its name to parent scope
      if (scope_config.adds_to_parent && scope_config.name_field) {
        const name_node = node.childForFieldName(scope_config.name_field);
        if (name_node) {
          const symbol = create_symbol(
            name_node.text,
            get_symbol_kind_for_scope(scope_type),
            node,
            context
          );
          parent_scope.symbols.set(symbol.name, symbol);
        }
      }
    }

    // Extract parameters
    if (scope_config.parameter_fields) {
      for (const field of scope_config.parameter_fields) {
        const param_node = node.childForFieldName(field);
        if (param_node) {
          extract_parameters(param_node, new_scope, context);
        }
      }
    }

    // Extract generic/type parameters
    if (scope_config.generic_fields) {
      for (const field of scope_config.generic_fields) {
        const generic_node = node.childForFieldName(field);
        if (generic_node) {
          extract_generic_parameters(generic_node, new_scope, context);
        }
      }
    }

    // Allow bespoke parameter extraction
    if (bespoke_handlers?.extract_custom_parameters) {
      bespoke_handlers.extract_custom_parameters(node, new_scope, context);
    }

    // Save parent scope before changing
    const parent_scope_id = context.current_scope_id;
    context.current_scope_id = scope_id;

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_and_build(child, tree, context, bespoke_handlers);
      }
    }
    
    // Restore parent scope after processing children
    context.current_scope_id = parent_scope_id;
  } else {
    // Check for symbol definitions
    const symbols = extract_symbols(node, context);
    
    // Add bespoke symbols
    if (bespoke_handlers?.extract_additional_symbols) {
      symbols.push(...bespoke_handlers.extract_additional_symbols(node, context));
    }

    // Add symbols to current scope
    const current_scope = tree.nodes.get(context.current_scope_id);
    if (current_scope) {
      for (const symbol of symbols) {
        current_scope.symbols.set(symbol.name, symbol);
      }
    }

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_and_build(child, tree, context, bespoke_handlers);
      }
    }
  }
}

/**
 * Extract symbols from a node
 */
function extract_symbols(
  node: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];
  const symbol_config = context.config.symbol_defining_nodes[node.type];

  if (!symbol_config) {
    return symbols;
  }

  let name: string | undefined;

  switch (symbol_config.name_extraction) {
    case "field":
      if (symbol_config.name_field) {
        const name_node = node.childForFieldName(symbol_config.name_field);
        if (name_node) {
          name = name_node.text;
        }
      }
      break;
    case "text":
      name = node.text;
      break;
    case "pattern":
      // Pattern extraction is language-specific, handled by bespoke
      return symbols;
  }

  if (name) {
    symbols.push(create_symbol(name, symbol_config.kind, node, context));
  }

  // Check for assignments
  const assignment_config = context.config.assignment_nodes[node.type];
  if (assignment_config) {
    const target_node = node.childForFieldName(assignment_config.target_field);
    if (target_node) {
      const targets = extract_assignment_targets(target_node, context);
      symbols.push(...targets);
    }
  }

  return symbols;
}

/**
 * Extract assignment targets
 */
function extract_assignment_targets(
  node: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];

  if (node.type === "identifier") {
    symbols.push(create_symbol(node.text, "variable", node, context));
  } else if (node.type === "destructuring_pattern" || 
             node.type === "object_pattern" || 
             node.type === "array_pattern" ||
             node.type === "tuple_pattern" ||
             node.type === "list_pattern") {
    // Recursively extract from patterns
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === "identifier") {
        symbols.push(create_symbol(child.text, "variable", child, context));
      } else if (child) {
        symbols.push(...extract_assignment_targets(child, context));
      }
    }
  }

  return symbols;
}

/**
 * Extract parameters from a parameter list
 */
function extract_parameters(
  node: SyntaxNode,
  scope: ScopeNode,
  context: GenericScopeContext
) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && context.config.parameter_nodes.includes(child.type)) {
      const param_symbols = extract_parameter_symbol(child, context);
      for (const symbol of param_symbols) {
        scope.symbols.set(symbol.name, symbol);
      }
    } else if (child && child.type === "identifier") {
      const symbol = create_symbol(child.text, "parameter", child, context);
      scope.symbols.set(symbol.name, symbol);
    } else if (child) {
      // Recursively extract from nested structures
      extract_parameters(child, scope, context);
    }
  }
}

/**
 * Extract a parameter symbol
 */
function extract_parameter_symbol(
  node: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];

  // Look for identifier in the parameter node
  const find_identifiers = (n: SyntaxNode) => {
    if (n.type === "identifier") {
      symbols.push(create_symbol(n.text, "parameter", n, context));
    } else {
      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) find_identifiers(child);
      }
    }
  };

  find_identifiers(node);
  return symbols;
}

/**
 * Extract generic/type parameters
 */
function extract_generic_parameters(
  node: SyntaxNode,
  scope: ScopeNode,
  context: GenericScopeContext
) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      if (child.type === "type_parameter") {
        // Look for the name field in type_parameter
        const name_node = child.childForFieldName("name");
        if (name_node) {
          const symbol = create_symbol(name_node.text, "type", name_node, context);
          scope.symbols.set(symbol.name, symbol);
        }
      } else if (child.type === "type_identifier" || child.type === "identifier") {
        const symbol = create_symbol(child.text, "type", child, context);
        scope.symbols.set(symbol.name, symbol);
      } else {
        // Recursively extract from nested structures
        extract_generic_parameters(child, scope, context);
      }
    }
  }
}

/**
 * Create a scope symbol
 */
function create_symbol(
  name: string,
  kind: SymbolKind | string,
  node: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol {
  return {
    name,
    kind: kind as SymbolKind,
    location: node_to_location(node, context.file_path),
    type: undefined,
  };
}

/**
 * Get symbol kind for a scope type
 */
function get_symbol_kind_for_scope(scope_type: ScopeType): SymbolKind {
  switch (scope_type) {
    case "function":
      return "function";
    case "class":
      return "class";
    case "module":
      return "module";
    default:
      return "variable";
  }
}

/**
 * Find scope at position
 */
export function find_scope_at_position(
  tree: ScopeTree,
  position: { row: number; column: number }
): ScopeNode | undefined {
  let most_specific: ScopeNode | undefined = undefined;
  
  // Find all scopes that contain the position
  for (const [_, scope] of tree.nodes) {
    if (location_contains_position(scope.location, position)) {
      // Check if this is more specific than what we have
      if (!most_specific || is_descendant_of(scope, most_specific, tree)) {
        most_specific = scope;
      }
    }
  }
  
  return most_specific;
}

/**
 * Check if a scope is a descendant of another
 */
function is_descendant_of(
  scope: ScopeNode,
  potential_ancestor: ScopeNode,
  tree: ScopeTree
): boolean {
  let current = scope;
  while (current.parent_id) {
    if (current.parent_id === potential_ancestor.id) {
      return true;
    }
    const parent = tree.nodes.get(current.parent_id);
    if (!parent) break;
    current = parent;
  }
  return false;
}

/**
 * Check if a location contains a position
 */
function location_contains_position(
  location: any,
  position: { row: number; column: number }
): boolean {
  if (!location) return false;
  
  const start_row = location.line - 1 || location.start?.row || 0;
  const start_col = location.column - 1 || location.start?.column || 0;
  const end_row = location.end_line - 1 || location.end?.row || Infinity;
  const end_col = location.end_column - 1 || location.end?.column || Infinity;

  if (position.row < start_row || position.row > end_row) {
    return false;
  }
  
  if (position.row === start_row && position.column < start_col) {
    return false;
  }
  
  if (position.row === end_row && position.column > end_col) {
    return false;
  }
  
  return true;
}

/**
 * Get scope chain from a scope to root
 */
export function get_scope_chain(
  tree: ScopeTree,
  scope_id: ScopeId
): ScopeNode[] {
  const chain: ScopeNode[] = [];
  let current_id: ScopeId | undefined = scope_id;

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
  scope_id: ScopeId,
  symbol_name: string
): ScopeSymbol | undefined {
  const chain = get_scope_chain(tree, scope_id);
  
  for (const scope of chain) {
    const symbol = scope.symbols.get(symbol_name);
    if (symbol) {
      return symbol;
    }
  }
  
  return undefined;
}

/**
 * Get all visible symbols from a scope
 */
export function get_visible_symbols(
  tree: ScopeTree,
  scope_id: ScopeId
): Map<SymbolId, ScopeSymbol> {
  const visible = new Map<SymbolId, ScopeSymbol>();
  const chain = get_scope_chain(tree, scope_id);
  
  // Add symbols from scope chain (reverse order so closer scopes override)
  for (let i = chain.length - 1; i >= 0; i--) {
    const scope = chain[i];
    for (const [name, symbol] of scope.symbols) {
      // Create SymbolId from the symbol name and location
      const symbol_id = variable_symbol(name, scope.location.file_path, symbol.location);
      visible.set(symbol_id, symbol);
    }
  }
  
  return visible;
}

/**
 * Extract variable declarations from scope tree
 */
export function extract_variables_from_scopes(
  scopes: ScopeTree
): VariableDeclaration[] {
  const variables: VariableDeclaration[] = [];

  // Iterate through all scopes and extract variable symbols
  for (const [_, scope] of scopes.nodes) {
    // Check if scope is a parameter scope - parameters are variables in parameter scopes
    const is_parameter_scope = scope.type === "parameter";

    for (const [name, symbol] of scope.symbols) {
      // Variables can be marked as 'variable' kind or found in parameter scopes
      if (
        symbol.kind === "variable" ||
        (is_parameter_scope && symbol.kind === "local")
      ) {
        // Enhanced symbol type for accessing variable-specific fields
        interface EnhancedScopeSymbol extends ScopeSymbol {
          declaration_type?: "const" | "let" | "var";
          is_exported?: boolean;
          type_info?: string;
        }
        
        // Cast to EnhancedScopeSymbol to access variable-specific fields
        const enhanced_symbol = symbol as EnhancedScopeSymbol;

        // Convert scope symbol to VariableDeclaration
        const variable: VariableDeclaration = {
          name: name as VariableName,
          location: symbol.location,
          type: symbol.type_info as TypeString | undefined,
          is_const: enhanced_symbol.declaration_type === "const",
          is_exported: symbol.is_exported,
        };
        variables.push(variable);
      }
    }
  }

  return variables;
}