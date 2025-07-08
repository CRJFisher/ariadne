# Graph Structure and Algorithms

This document describes the underlying graph data structure used for scope resolution and the algorithms that operate on it.

## Table of Contents

1. [Graph Overview](#graph-overview)
2. [Node Types](#node-types)
3. [Edge Types](#edge-types)
4. [Core Algorithms](#core-algorithms)
5. [Implementation Details](#implementation-details)
6. [Performance Characteristics](#performance-characteristics)

## Graph Overview

The `ScopeGraph` is a directed graph that represents the scope structure and symbol relationships within a source file. It consists of:

- **Nodes**: Represent scopes, definitions, references, and imports
- **Edges**: Represent relationships between nodes (e.g., "definition belongs to scope")
- **Metadata**: Additional information like source ranges and symbol kinds

### Visual Representation

```text
┌─────────────────┐
│   Root Scope    │
│   (Node ID: 0)  │
└────────┬────────┘
         │ ScopeToScope
         ▼
┌─────────────────┐       DefToScope      ┌─────────────────┐
│ Function Scope  │ ◄─────────────────────│  Def: "myFunc"  │
│   (Node ID: 1)  │                       │   (Node ID: 2)  │
└────────┬────────┘                       └─────────────────┘
         │                                          ▲
         │ ScopeToScope                             │ RefToDef
         ▼                                          │
┌─────────────────┐                       ┌─────────────────┐
│  Block Scope    │                       │  Ref: "myFunc"  │
│   (Node ID: 3)  │                       │   (Node ID: 4)  │
└─────────────────┘                       └─────────────────┘
```

## Node Types

### Base Node Structure

All nodes share a common base structure:

```typescript
interface BaseNode {
  id: number;           // Unique identifier
  kind: NodeKind;       // Type discriminator
  range: Range;         // Source location
}

interface Range {
  start: Point;
  end: Point;
}

interface Point {
  row: number;          // 0-indexed
  column: number;       // 0-indexed
}
```

### Scope Node

Represents a lexical scope (function body, block statement, etc.):

```typescript
interface Scope extends BaseNode {
  kind: 'scope';
  // No additional fields - relationships are stored in edges
}
```

### Definition Node

Represents a symbol definition:

```typescript
interface Def extends BaseNode {
  kind: 'definition';
  name: string;              // Symbol name
  symbol_kind: string;       // 'function', 'variable', 'class', etc.
}
```

### Reference Node

Represents a use of a symbol:

```typescript
interface Ref extends BaseNode {
  kind: 'reference';
  name: string;              // Symbol being referenced
  symbol_kind?: string;      // Optional hint about expected type
}
```

### Import Node

Represents an imported symbol:

```typescript
interface Import extends BaseNode {
  kind: 'import';
  name: string;              // Local name in this file
  source_name?: string;      // Original name if renamed
  source_module?: string;    // Module path
}
```

## Edge Types

Edges connect nodes and define their relationships:

```typescript
enum EdgeKind {
  ScopeToScope = 'ScopeToScope',      // Parent-child scope relationship
  DefToScope = 'DefToScope',          // Definition belongs to scope
  RefToDef = 'RefToDef',              // Reference resolves to definition
  ImportToScope = 'ImportToScope',    // Import belongs to scope
  RefToImport = 'RefToImport'         // Reference resolves to import
}

interface Edge {
  kind: EdgeKind;
  source: number;     // Source node ID
  target: number;     // Target node ID
}
```

### Edge Semantics

- **ScopeToScope**: Creates the scope hierarchy. Source is parent, target is child.
- **DefToScope**: Places a definition in a scope. Source is def, target is scope.
- **RefToDef**: Links a reference to its definition. Source is ref, target is def.
- **ImportToScope**: Places an import in a scope. Source is import, target is scope.
- **RefToImport**: Links a reference to an import. Source is ref, target is import.

## Core Algorithms

### 1. Scope Stack Management

The graph maintains a stack of scopes during construction:

```typescript
class ScopeGraph {
  private scope_stack: number[] = [0]; // Start with root scope
  
  insert_local_scope(scope: Scope): number {
    const parent_id = this.current_scope_id();
    const scope_id = this.add_node(scope);
    
    // Create parent-child edge
    this.add_edge({
      kind: EdgeKind.ScopeToScope,
      source: parent_id,
      target: scope_id
    });
    
    // Push new scope onto stack
    this.scope_stack.push(scope_id);
    
    return scope_id;
  }
  
  exit_local_scope(): void {
    this.scope_stack.pop();
  }
}
```

### 2. Definition Insertion

Definitions are added to the current scope with different scoping rules:

```typescript
insert_local_def(def: Def): number {
  const def_id = this.add_node(def);
  const scope_id = this.current_scope_id();
  
  this.add_edge({
    kind: EdgeKind.DefToScope,
    source: def_id,
    target: scope_id
  });
  
  return def_id;
}

insert_hoisted_def(def: Def): number {
  const def_id = this.add_node(def);
  
  // Find the nearest function/module scope
  let scope_id = this.current_scope_id();
  for (let i = this.scope_stack.length - 1; i >= 0; i--) {
    const node = this.nodes.get(this.scope_stack[i]);
    if (this.is_hoistable_scope(node)) {
      scope_id = this.scope_stack[i];
      break;
    }
  }
  
  this.add_edge({
    kind: EdgeKind.DefToScope,
    source: def_id,
    target: scope_id
  });
  
  return def_id;
}
```

### 3. Reference Resolution

The most complex algorithm - resolves references by walking up the scope chain:

```typescript
insert_ref(ref: Ref): number {
  const ref_id = this.add_node(ref);
  
  // Try to resolve the reference
  const resolution = this.resolve_ref(ref);
  
  if (resolution) {
    if (resolution.kind === 'definition') {
      this.add_edge({
        kind: EdgeKind.RefToDef,
        source: ref_id,
        target: resolution.id
      });
    } else if (resolution.kind === 'import') {
      this.add_edge({
        kind: EdgeKind.RefToImport,
        source: ref_id,
        target: resolution.id
      });
    }
  }
  
  return ref_id;
}

private resolve_ref(ref: Ref): Def | Import | null {
  // Start from current scope
  let current_scope = this.current_scope_id();
  const visited = new Set<number>();
  
  while (current_scope !== null && !visited.has(current_scope)) {
    visited.add(current_scope);
    
    // Check definitions in this scope
    const defs = this.get_defs_in_scope(current_scope);
    for (const def of defs) {
      if (def.name === ref.name && this.symbol_matches(def, ref)) {
        return def;
      }
    }
    
    // Check imports in this scope
    const imports = this.get_imports_in_scope(current_scope);
    for (const imp of imports) {
      if (imp.name === ref.name) {
        return imp;
      }
    }
    
    // Move to parent scope
    current_scope = this.get_parent_scope(current_scope);
  }
  
  return null;
}
```

### 4. Finding Nodes at Position

Used for go-to-definition and find-references:

```typescript
findNodeAtPosition(position: Point): Node | null {
  // Check all node types in order of likelihood
  const checks = [
    () => this.getNodes<Ref>('reference'),
    () => this.getNodes<Def>('definition'),
    () => this.getNodes<Import>('import')
  ];
  
  for (const getNodes of checks) {
    for (const node of getNodes()) {
      if (this.contains_position(node.range, position)) {
        return node;
      }
    }
  }
  
  return null;
}

private contains_position(range: Range, pos: Point): boolean {
  if (pos.row < range.start.row || pos.row > range.end.row) {
    return false;
  }
  
  if (pos.row === range.start.row && pos.column < range.start.column) {
    return false;
  }
  
  if (pos.row === range.end.row && pos.column > range.end.column) {
    return false;
  }
  
  return true;
}
```

### 5. Export Detection

Finds definitions that are exported (in root scope):

```typescript
findExportedDef(name: string): Def | null {
  // Exports are definitions in the root scope (ID: 0)
  const root_defs = this.get_defs_in_scope(0);
  
  for (const def of root_defs) {
    if (def.name === name) {
      return def;
    }
  }
  
  return null;
}
```

## Implementation Details

### Data Storage

The graph uses Maps for efficient lookups:

```typescript
class ScopeGraph {
  private nodes: Map<number, Node> = new Map();
  private edges: Edge[] = [];
  private node_id_counter: number = 0;
  
  // Indexes for performance
  private edges_by_source: Map<number, Edge[]> = new Map();
  private edges_by_target: Map<number, Edge[]> = new Map();
  private nodes_by_kind: Map<NodeKind, Set<number>> = new Map();
}
```

### Edge Indexing

Edges are indexed by both source and target for bidirectional traversal:

```typescript
add_edge(edge: Edge): void {
  this.edges.push(edge);
  
  // Index by source
  if (!this.edges_by_source.has(edge.source)) {
    this.edges_by_source.set(edge.source, []);
  }
  this.edges_by_source.get(edge.source)!.push(edge);
  
  // Index by target
  if (!this.edges_by_target.has(edge.target)) {
    this.edges_by_target.set(edge.target, []);
  }
  this.edges_by_target.get(edge.target)!.push(edge);
}
```

### Helper Methods

Common graph operations:

```typescript
// Get all nodes of a specific kind
getNodes<T extends Node>(kind: NodeKind): T[] {
  const node_ids = this.nodes_by_kind.get(kind) || new Set();
  return Array.from(node_ids)
    .map(id => this.nodes.get(id) as T)
    .filter(Boolean);
}

// Get edges from a node
getOutgoingEdges(node_id: number): Edge[] {
  return this.edges_by_source.get(node_id) || [];
}

// Get edges to a node
getIncomingEdges(node_id: number): Edge[] {
  return this.edges_by_target.get(node_id) || [];
}

// Get parent scope
get_parent_scope(scope_id: number): number | null {
  const incoming = this.getIncomingEdges(scope_id);
  const parent_edge = incoming.find(e => e.kind === EdgeKind.ScopeToScope);
  return parent_edge ? parent_edge.source : null;
}
```

## Performance Characteristics

### Time Complexity

- **Node insertion**: O(1)
- **Edge insertion**: O(1)
- **Finding node at position**: O(n) where n is number of nodes
- **Reference resolution**: O(s × d) where s is scope depth, d is definitions per scope
- **Finding references**: O(r) where r is number of references

### Space Complexity

- **Nodes**: O(n) where n is number of symbols
- **Edges**: O(e) where e is number of relationships
- **Indexes**: O(n + e) for fast lookups

### Optimization Strategies

1. **Early termination**: Stop searching once a match is found
2. **Scope caching**: Cache parent-child relationships
3. **Position indexing**: Consider spatial indexing for large files
4. **Incremental updates**: Reuse existing graph structure when possible

## Usage Examples

### Building a Graph

```typescript
const config = languageConfigs.typescript;
const parser = new Parser();
parser.setLanguage(config.parser);

const tree = parser.parse(sourceCode);
const graph = build_scope_graph(tree, config);
```

### Finding Definition

```typescript
const position = { row: 10, column: 15 };
const node = graph.findNodeAtPosition(position);

if (node?.kind === 'reference') {
  const defs = graph.getDefsForRef(node.id);
  if (defs.length > 0) {
    console.log(`Found definition: ${defs[0].name} at ${defs[0].range.start}`);
  }
}
```

### Walking Scope Tree

```typescript
function printScopeTree(graph: ScopeGraph, scope_id: number = 0, indent = 0) {
  const prefix = ' '.repeat(indent);
  console.log(`${prefix}Scope ${scope_id}`);
  
  // Print definitions in this scope
  const defs = graph.get_defs_in_scope(scope_id);
  for (const def of defs) {
    console.log(`${prefix}  - ${def.symbol_kind} ${def.name}`);
  }
  
  // Recurse to child scopes
  const children = graph.getOutgoingEdges(scope_id)
    .filter(e => e.kind === EdgeKind.ScopeToScope)
    .map(e => e.target);
  
  for (const child of children) {
    printScopeTree(graph, child, indent + 2);
  }
}
```

## Further Reading

- [Scope Mechanism Documentation](scope-mechanism.md)
- [Symbol Resolution Documentation](symbol-resolution.md)
- [Tree-sitter Query Documentation](tree-sitter-queries.md)