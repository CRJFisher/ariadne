/**
 * Scope-Entity Connections
 *
 * Establishes bidirectional connections between code entities and their scopes.
 * This bridges the structural view (scope tree) with the semantic view (entities),
 * enabling scope-aware navigation and visibility checking.
 */

import {
  ScopeId,
  SymbolId,
  ScopeTree,
  ScopeNode,
  FileAnalysis,
  FunctionDefinition,
  ClassDefinition,
  MethodDefinition,
  VariableDeclaration,
  Location,
  Language,
} from "@ariadnejs/types";
import { find_scope_at_position, get_scope_chain } from "./scope_tree";

/**
 * Entities contained within a scope
 */
export interface ScopeContents {
  functions: Set<SymbolId>;
  classes: Set<SymbolId>;
  variables: Set<SymbolId>;
  methods: Set<SymbolId>;
  imports: Set<SymbolId>;
  exports: Set<SymbolId>;
}

/**
 * Bidirectional connections between scopes and entities
 */
export interface ScopeEntityConnections {
  // For entities that ARE scopes (functions/classes)
  scope_to_symbol: Map<ScopeId, SymbolId>; // scope_id → symbol_id
  symbol_to_scope: Map<SymbolId, ScopeId>; // symbol_id → scope_id

  // Entities defined WITHIN each scope
  scope_contents: Map<ScopeId, ScopeContents>; // scope_id → entities in it

  // Which scope each entity is defined in
  entity_defining_scope: Map<SymbolId, ScopeId>; // symbol_id → defining scope

  // Metadata
  language: Language;
  file_path: string;
}

/**
 * Create empty scope contents
 */
function create_empty_contents(): ScopeContents {
  return {
    functions: new Set(),
    classes: new Set(),
    variables: new Set(),
    methods: new Set(),
    imports: new Set(),
    exports: new Set(),
  };
}

/**
 * Build scope-entity connections from file analysis
 *
 * This establishes all the bidirectional mappings between scopes and entities,
 * enabling navigation and visibility checking.
 */
export function build_scope_entity_connections(
  scope_tree: ScopeTree,
  functions: readonly FunctionDefinition[],
  classes: readonly ClassDefinition[],
  variables: readonly VariableDeclaration[],
  symbol_registry: Map<any, SymbolId>,
  language: Language,
  file_path: string
): ScopeEntityConnections {
  const connections: ScopeEntityConnections = {
    scope_to_symbol: new Map(),
    symbol_to_scope: new Map(),
    scope_contents: new Map(),
    entity_defining_scope: new Map(),
    language,
    file_path,
  };

  // Initialize scope contents for all scopes
  for (const [scope_id, _] of scope_tree.nodes) {
    connections.scope_contents.set(scope_id, create_empty_contents());
  }

  // Process functions - they ARE scopes and are IN parent scopes
  process_functions(functions, scope_tree, symbol_registry, connections);

  // Process classes - they ARE scopes and are IN parent scopes
  process_classes(classes, scope_tree, symbol_registry, connections);

  // Process variables - they are only IN scopes
  process_variables(variables, scope_tree, symbol_registry, connections);

  return connections;
}

/**
 * Process function entities and their scope connections
 */
function process_functions(
  functions: readonly FunctionDefinition[],
  scope_tree: ScopeTree,
  symbol_registry: Map<any, SymbolId>,
  connections: ScopeEntityConnections
): void {
  for (const func of functions) {
    const symbol_id = symbol_registry.get(func);
    if (!symbol_id) continue;

    // Find the function scope that corresponds to this function entity
    const func_scope = find_scope_at_position(scope_tree, func.location);
    if (!func_scope || func_scope.type !== "function") continue;

    // Map the function scope to its symbol (the function IS the scope)
    connections.scope_to_symbol.set(func_scope.id, symbol_id);
    connections.symbol_to_scope.set(symbol_id, func_scope.id);

    // Add function to its PARENT scope's contents
    if (func_scope.parent_id) {
      const parent_contents = connections.scope_contents.get(
        func_scope.parent_id
      );
      if (parent_contents) {
        // Check if it's a method (parent is a class)
        const parent_scope = scope_tree.nodes.get(func_scope.parent_id);
        if (parent_scope?.type === "class") {
          parent_contents.methods.add(symbol_id);
        } else {
          parent_contents.functions.add(symbol_id);
        }
      }

      // Record which scope defines this entity
      connections.entity_defining_scope.set(symbol_id, func_scope.parent_id);
    }
  }
}

/**
 * Process class entities and their scope connections
 */
function process_classes(
  classes: readonly ClassDefinition[],
  scope_tree: ScopeTree,
  symbol_registry: Map<any, SymbolId>,
  connections: ScopeEntityConnections
): void {
  for (const cls of classes) {
    const symbol_id = symbol_registry.get(cls);
    if (!symbol_id) continue;

    // Find the class scope that corresponds to this class entity
    const class_scope = find_scope_at_position(scope_tree, cls.location);
    if (!class_scope || class_scope.type !== "class") continue;

    // Map the class scope to its symbol (the class IS the scope)
    connections.scope_to_symbol.set(class_scope.id, symbol_id);
    connections.symbol_to_scope.set(symbol_id, class_scope.id);

    // Add class to its PARENT scope's contents
    if (class_scope.parent_id) {
      const parent_contents = connections.scope_contents.get(
        class_scope.parent_id
      );
      if (parent_contents) {
        parent_contents.classes.add(symbol_id);
      }

      // Record which scope defines this entity
      connections.entity_defining_scope.set(symbol_id, class_scope.parent_id);
    }

    // Process methods within the class
    for (const method of cls.methods) {
      const method_symbol = symbol_registry.get(method);
      if (method_symbol) {
        // Methods are already added to class contents by process_functions
        // Just ensure the defining scope is set
        connections.entity_defining_scope.set(method_symbol, class_scope.id);
      }
    }
  }
}

/**
 * Process variable entities and their scope connections
 */
function process_variables(
  variables: readonly VariableDeclaration[],
  scope_tree: ScopeTree,
  symbol_registry: Map<any, SymbolId>,
  connections: ScopeEntityConnections
): void {
  for (const variable of variables) {
    const symbol_id = symbol_registry.get(variable);
    if (!symbol_id) continue;

    // Find the scope containing this variable
    const containing_scope = find_scope_at_position(
      scope_tree,
      variable.location
    );
    if (!containing_scope) continue;

    // Add variable to the scope's contents
    const scope_contents = connections.scope_contents.get(containing_scope.id);
    if (scope_contents) {
      scope_contents.variables.add(symbol_id);
    }

    // Record which scope defines this entity
    connections.entity_defining_scope.set(symbol_id, containing_scope.id);
  }
}

/**
 * Check if an entity is visible from a given scope
 *
 * An entity is visible if:
 * 1. It's defined in the current scope or any parent scope
 * 2. It's hoisted (for JavaScript/TypeScript)
 * 3. It's imported into the scope
 */
export function is_entity_visible_from_scope(
  entity_symbol: SymbolId,
  from_scope: ScopeId,
  connections: ScopeEntityConnections,
  scope_tree: ScopeTree
): boolean {
  // Get the scope where the entity is defined
  const defining_scope_id =
    connections.entity_defining_scope.get(entity_symbol);
  if (!defining_scope_id) return false;

  // Get the scope chain from the query scope to root
  const from_scope_node = scope_tree.nodes.get(from_scope);
  if (!from_scope_node) return false;

  const scope_chain = get_scope_chain(scope_tree, from_scope);

  // Check if the defining scope is in the parent chain
  for (const scope of scope_chain) {
    if (scope.id === defining_scope_id) {
      return true;
    }
  }

  // TODO: Handle hoisting for JavaScript/TypeScript
  // TODO: Handle imports

  return false;
}

/**
 * Get all entities defined directly within a scope
 */
export function get_scope_contents(
  scope_id: ScopeId,
  connections: ScopeEntityConnections
): ScopeContents {
  return connections.scope_contents.get(scope_id) || create_empty_contents();
}

/**
 * Get all entities visible from a scope (including inherited from parents)
 */
export function get_visible_entities(
  scope_id: ScopeId,
  connections: ScopeEntityConnections,
  scope_tree: ScopeTree
): ScopeContents {
  const visible = create_empty_contents();
  const scope_chain = get_scope_chain(scope_tree, scope_id);

  // Walk from root to current scope, accumulating visible entities
  for (let i = scope_chain.length - 1; i >= 0; i--) {
    const scope = scope_chain[i];
    const contents = connections.scope_contents.get(scope.id);

    if (contents) {
      // Add all entities from this scope
      contents.functions.forEach((f) => visible.functions.add(f));
      contents.classes.forEach((c) => visible.classes.add(c));
      contents.variables.forEach((v) => visible.variables.add(v));
      contents.methods.forEach((m) => visible.methods.add(m));
      contents.imports.forEach((i) => visible.imports.add(i));
      contents.exports.forEach((e) => visible.exports.add(e));
    }
  }

  return visible;
}

/**
 * Find the scope that an entity creates (for functions/classes)
 */
export function get_entity_scope(
  entity_symbol: SymbolId,
  connections: ScopeEntityConnections
): ScopeId | undefined {
  return connections.symbol_to_scope.get(entity_symbol);
}

/**
 * Find the entity that created a scope (for function/class scopes)
 */
export function get_scope_entity(
  scope_id: ScopeId,
  connections: ScopeEntityConnections
): SymbolId | undefined {
  return connections.scope_to_symbol.get(scope_id);
}

/**
 * Get the defining scope of an entity
 */
export function get_entity_defining_scope(
  entity_symbol: SymbolId,
  connections: ScopeEntityConnections
): ScopeId | undefined {
  return connections.entity_defining_scope.get(entity_symbol);
}

/**
 * Navigate from an entity to its parent entity (if any)
 */
export function get_parent_entity(
  entity_symbol: SymbolId,
  connections: ScopeEntityConnections,
  scope_tree: ScopeTree
): SymbolId | undefined {
  // Get the scope where this entity is defined
  const defining_scope = connections.entity_defining_scope.get(entity_symbol);
  if (!defining_scope) return undefined;

  // Check if the defining scope corresponds to an entity
  return connections.scope_to_symbol.get(defining_scope);
}

/**
 * Check if an entity is a top-level entity (defined in global/module scope)
 */
export function is_top_level_entity(
  entity_symbol: SymbolId,
  connections: ScopeEntityConnections,
  scope_tree: ScopeTree
): boolean {
  const defining_scope_id =
    connections.entity_defining_scope.get(entity_symbol);
  if (!defining_scope_id) return false;

  const defining_scope = scope_tree.nodes.get(defining_scope_id);
  return defining_scope?.type === "global" || defining_scope?.type === "module";
}

/**
 * Get all child entities of an entity (for classes with methods, etc.)
 */
export function get_child_entities(
  entity_symbol: SymbolId,
  connections: ScopeEntityConnections
): ScopeContents {
  // Get the scope that this entity creates
  const entity_scope = connections.symbol_to_scope.get(entity_symbol);
  if (!entity_scope) return create_empty_contents();

  // Return the contents of that scope
  return get_scope_contents(entity_scope, connections);
}
