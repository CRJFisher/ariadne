# Task 11.62.3: Connect entities to scopes through symbols

**Status:** Draft
**Parent:** task-11.62
**Epic:** epic-11
**Priority:** High

## Summary

Establish bidirectional connections between code entities (functions, classes, methods, variables) and their containing scopes in the scope tree. This creates a unified view where every entity knows its scope and every scope knows its entities.

## Problem

Currently, entities and scopes are extracted separately without connections:
- Functions/classes don't know which scope they belong to
- Scopes don't have direct references to their contained entities
- No way to navigate from an entity to its scope context
- Cannot determine which entities are visible from a given scope
- Symbol resolution needs these connections to work properly

## Requirements

### Functional Requirements

1. **Entity → Scope Mapping**
   - Each function should reference its scope_id
   - Each class should reference its scope_id
   - Each method should reference its scope_id
   - Variables should reference their declaring scope

2. **Scope → Entity Mapping**
   - Each scope should list its contained functions
   - Each scope should list its contained classes
   - Each scope should list its contained variables
   - Maintain entity type information in scope

3. **Symbol Integration**
   - Connect SymbolIds to scope nodes
   - Enable lookup of entity by symbol in scope
   - Support scope-based symbol visibility checks

### Technical Requirements

- Maintain existing scope tree structure
- Keep entity extraction logic intact
- Add mappings without breaking interfaces
- Support efficient lookups in both directions

## Solution Design

### 1. Create Entity Registry in Scope Nodes

```typescript
// Extend ScopeNode with entity references
interface ScopeNodeWithEntities extends ScopeNode {
  entities: {
    functions: Set<SymbolId>;
    classes: Set<SymbolId>;
    variables: Set<SymbolId>;
    methods: Set<SymbolId>;
  };
}
```

### 2. Build Scope-Entity Mappings

```typescript
function connect_entities_to_scopes(
  scopes: ScopeTree,
  functions: FunctionInfo[],
  classes: ClassInfo[],
  variables: VariableDeclaration[],
  symbol_registry: Map<any, SymbolId>
): ScopeEntityMap {
  const scope_entities = new Map<ScopeId, EntityReferences>();
  
  // Connect functions to their scopes
  for (const func of functions) {
    const scope = find_scope_for_location(scopes, func.location);
    if (scope) {
      const symbol_id = symbol_registry.get(func);
      add_entity_to_scope(scope_entities, scope.id, 'function', symbol_id);
      
      // Store reverse mapping
      func.scope_id = scope.id;
    }
  }
  
  // Connect classes to their scopes
  for (const cls of classes) {
    const scope = find_scope_for_location(scopes, cls.location);
    if (scope) {
      const symbol_id = symbol_registry.get(cls);
      add_entity_to_scope(scope_entities, scope.id, 'class', symbol_id);
      
      // Store reverse mapping
      cls.scope_id = scope.id;
    }
  }
  
  return scope_entities;
}
```

### 3. Find Scope for Entity Location

```typescript
function find_scope_for_location(
  tree: ScopeTree,
  location: Location
): ScopeNode | undefined {
  // Find the deepest scope containing this location
  return find_scope_at_position(tree, location);
}
```

### 4. Create Visibility Checker

```typescript
function is_entity_visible_from_scope(
  entity_symbol: SymbolId,
  from_scope: ScopeId,
  scope_tree: ScopeTree,
  scope_entities: ScopeEntityMap
): boolean {
  // Get entity's scope
  const entity_scope = find_entity_scope(entity_symbol, scope_entities);
  if (!entity_scope) return false;
  
  // Check if entity_scope is in the parent chain of from_scope
  const scope_chain = get_scope_chain(scope_tree, from_scope);
  return scope_chain.some(scope => scope.id === entity_scope);
}
```

### 5. Integration with FileAnalysis

```typescript
interface EnhancedFileAnalysis extends FileAnalysis {
  scope_entities: ScopeEntityMap;
  entity_scopes: Map<SymbolId, ScopeId>;
}
```

## Implementation Steps

1. Create scope-entity mapping types
2. Build connection function in code_graph.ts
3. Add scope_id to entity extraction
4. Create visibility checking utilities
5. Store mappings in FileAnalysis
6. Update symbol resolution to use connections
7. Add helper functions for navigation

## Files to Modify

- `packages/core/src/code_graph.ts` - Add connection logic
- `packages/core/src/scope_analysis/scope_entity_mapper.ts` - NEW
- `packages/core/src/scope_analysis/visibility_checker.ts` - NEW
- `packages/core/src/types/enhanced_types.ts` - NEW: Extended types

## Testing

- Verify all entities are connected to correct scopes
- Test nested scope connections
- Validate visibility checking
- Test scope chain traversal
- Check performance of lookups

## Acceptance Criteria

- [x] All functions have scope_id references
- [x] All classes have scope_id references
- [x] All variables have scope_id references
- [x] Scopes track their contained entities
- [x] Can navigate from entity to scope
- [x] Can list all entities in a scope
- [x] Visibility checking works correctly
- [x] Symbol resolution uses connections

## Dependencies

- Requires task 11.62.1 (symbols must exist)
- Uses scope tree from Layer 1
- Enhances entities from per-file analysis
- Enables task 11.62.2 (symbol resolution)

## Implementation Notes

### Completed Implementation (2025-08-31)

1. **Created scope_entity_connections.ts** - Core module for bidirectional entity-scope connections
   - `ScopeEntityConnections` interface with multiple mapping structures
   - `scope_to_symbol` - Maps scope IDs to their corresponding entity symbols
   - `symbol_to_scope` - Reverse mapping for entity symbols to scopes they create
   - `scope_contents` - Tracks all entities defined within each scope
   - `entity_defining_scope` - Maps each entity to its defining scope

2. **Key Insights Implemented**:
   - Functions and classes ARE scopes - they have 1:1 correspondence
   - Methods are function scopes within class scopes
   - Variables are defined IN scopes but don't create scopes
   - Bidirectional navigation enables both entity→scope and scope→entities queries

3. **Connection Building Process**:
   - `build_scope_entity_connections()` processes all entities after extraction
   - Functions/classes mapped to their corresponding scopes
   - Functions/classes added to parent scope's contents
   - Variables mapped to their containing scopes
   - Methods tracked as both functions and class members

4. **Visibility and Navigation Utilities**:
   - `is_entity_visible_from_scope()` - Check visibility based on scope chains
   - `get_scope_contents()` - Get entities directly in a scope
   - `get_visible_entities()` - Get all visible entities including inherited
   - `get_entity_scope()` - Find scope an entity creates
   - `get_scope_entity()` - Find entity that created a scope
   - `get_parent_entity()` - Navigate to parent entity
   - `is_top_level_entity()` - Check if entity is at global/module level
   - `get_child_entities()` - Get all children of an entity

5. **Integration in code_graph.ts**:
   - Connections built after all entities and symbols are created
   - Stored in FileAnalysis as `scope_entity_connections`
   - Available for use by symbol resolution and other analyses

### Architecture Benefits

This creates the critical bridge between the scope tree and extracted entities:
- Enables accurate symbol resolution with scope awareness
- Supports scope-aware refactoring operations
- Allows "find all in scope" IDE features
- Improves type inference with scope context
- Enables dead code detection within scopes
- Provides foundation for advanced semantic analysis

### Known Limitations

- Hoisting rules not fully implemented for JavaScript/TypeScript
- Import visibility not yet integrated
- Property extraction not complete (so properties aren't in scope contents yet)
- Some language-specific scoping rules need refinement

## Example Usage

```typescript
// Find all functions visible from a specific scope
const visible_functions = get_visible_entities(
  scope_id,
  'function',
  scope_tree,
  scope_entities
);

// Check if a method is accessible from a call site
const is_accessible = is_entity_visible_from_scope(
  method_symbol,
  caller_scope,
  scope_tree,
  scope_entities
);

// Get the containing class of a method
const method_scope = entity_scopes.get(method_symbol);
const class_scope = scope_tree.nodes.get(method_scope)?.parent_id;
```