# Task: Build Call Graph Construction System

**Task ID**: task-epic-11.91.4
**Parent**: task-epic-11.91
**Status**: Created
**Priority**: Critical
**Created**: 2025-01-20
**Estimated Effort**: 2-3 days

## Problem Statement

With Phases 1-4 of symbol resolution implemented, we have complete call resolution data but no system to construct and manage call graphs. A call graph construction system is needed to transform resolved symbol mappings into queryable graph structures.

### Current State

After Phases 1-4, we have:
- ✅ Import resolution mappings
- ✅ Function call resolution mappings
- ✅ Method call resolution mappings
- ✅ Constructor call resolution mappings

Missing:
- ❌ Call graph data structures
- ❌ Graph construction algorithms
- ❌ Graph serialization and caching
- ❌ Efficient graph query interfaces

## Solution Overview

Create a comprehensive call graph construction system that builds multiple types of call graphs from resolved symbol data and provides efficient query interfaces.

### Architecture

```
symbol_resolution/
├── call_graph/
│   ├── index.ts              # Public API
│   ├── call_graph_builder.ts # Main construction logic
│   ├── graph_types.ts        # Call graph data structures
│   ├── graph_serializer.ts   # Serialization and caching
│   ├── graph_merger.ts       # Combine different call types
│   ├── graph_optimizer.ts    # Performance optimizations
│   └── analyzers/            # Specialized graph analysis
│       ├── call_chains.ts    # Call chain analysis
│       ├── cycles.ts         # Cycle detection
│       └── metrics.ts        # Graph metrics
```

## Implementation Plan

### 1. Core Graph Data Structures

**Module**: `call_graph/graph_types.ts`

Define efficient call graph representations:

```typescript
interface CallGraph {
  // Core call relationships
  readonly call_edges: ReadonlyMap<SymbolId, ReadonlySet<SymbolId>>;
  readonly called_by: ReadonlyMap<SymbolId, ReadonlySet<SymbolId>>;

  // Call site details for precise analysis
  readonly call_sites: ReadonlyMap<SymbolId, ReadonlyMap<SymbolId, readonly Location[]>>;

  // Graph metadata
  readonly graph_type: CallGraphType;
  readonly symbols: ReadonlyMap<SymbolId, SymbolDefinition>;
  readonly statistics: CallGraphStatistics;
}

type CallGraphType = "function_calls" | "method_calls" | "constructor_calls" | "combined";

interface CallGraphStatistics {
  readonly total_symbols: number;
  readonly total_call_edges: number;
  readonly total_call_sites: number;
  readonly max_fan_out: number;
  readonly max_fan_in: number;
  readonly cycles_detected: number;
}

interface CallEdge {
  readonly caller: SymbolId;
  readonly callee: SymbolId;
  readonly call_sites: readonly Location[];
  readonly call_type: "function" | "method" | "constructor";
}
```

### 2. Call Graph Builder

**Module**: `call_graph/call_graph_builder.ts`

Main construction logic for different call graph types:

```typescript
function build_call_graph(
  resolved_symbols: ResolvedSymbols,
  graph_type: CallGraphType
): CallGraph {
  switch (graph_type) {
    case "function_calls":
      return build_function_call_graph(resolved_symbols);
    case "method_calls":
      return build_method_call_graph(resolved_symbols);
    case "constructor_calls":
      return build_constructor_call_graph(resolved_symbols);
    case "combined":
      return build_combined_call_graph(resolved_symbols);
  }
}

function build_function_call_graph(resolved_symbols: ResolvedSymbols): CallGraph {
  const call_edges = new Map<SymbolId, Set<SymbolId>>();
  const called_by = new Map<SymbolId, Set<SymbolId>>();
  const call_sites = new Map<SymbolId, Map<SymbolId, Location[]>>();

  // Process function call resolutions
  for (const [location, callee_id] of resolved_symbols.phases.functions.function_calls) {
    const caller_id = find_containing_function(location, resolved_symbols);

    if (caller_id) {
      // Add edge: caller -> callee
      add_call_edge(caller_id, callee_id, location, call_edges, called_by, call_sites);
    }
  }

  return create_call_graph("function_calls", call_edges, called_by, call_sites, resolved_symbols);
}

function add_call_edge(
  caller_id: SymbolId,
  callee_id: SymbolId,
  location: Location,
  call_edges: Map<SymbolId, Set<SymbolId>>,
  called_by: Map<SymbolId, Set<SymbolId>>,
  call_sites: Map<SymbolId, Map<SymbolId, Location[]>>
): void {
  // Update call_edges
  if (!call_edges.has(caller_id)) {
    call_edges.set(caller_id, new Set());
  }
  call_edges.get(caller_id)!.add(callee_id);

  // Update called_by (reverse mapping)
  if (!called_by.has(callee_id)) {
    called_by.set(callee_id, new Set());
  }
  called_by.get(callee_id)!.add(caller_id);

  // Update call_sites
  if (!call_sites.has(caller_id)) {
    call_sites.set(caller_id, new Map());
  }
  if (!call_sites.get(caller_id)!.has(callee_id)) {
    call_sites.get(caller_id)!.set(callee_id, []);
  }
  call_sites.get(caller_id)!.get(callee_id)!.push(location);
}
```

### 3. Combined Call Graph

Create unified graphs combining all call types:

```typescript
function build_combined_call_graph(resolved_symbols: ResolvedSymbols): CallGraph {
  const call_edges = new Map<SymbolId, Set<SymbolId>>();
  const called_by = new Map<SymbolId, Set<SymbolId>>();
  const call_sites = new Map<SymbolId, Map<SymbolId, Location[]>>();

  // Merge function calls
  merge_function_calls(resolved_symbols, call_edges, called_by, call_sites);

  // Merge method calls
  merge_method_calls(resolved_symbols, call_edges, called_by, call_sites);

  // Merge constructor calls
  merge_constructor_calls(resolved_symbols, call_edges, called_by, call_sites);

  return create_call_graph("combined", call_edges, called_by, call_sites, resolved_symbols);
}

function merge_function_calls(
  resolved_symbols: ResolvedSymbols,
  call_edges: Map<SymbolId, Set<SymbolId>>,
  called_by: Map<SymbolId, Set<SymbolId>>,
  call_sites: Map<SymbolId, Map<SymbolId, Location[]>>
): void {
  for (const [location, callee_id] of resolved_symbols.phases.functions.function_calls) {
    const caller_id = find_containing_function(location, resolved_symbols);
    if (caller_id) {
      add_call_edge(caller_id, callee_id, location, call_edges, called_by, call_sites);
    }
  }
}
```

### 4. Containing Function Resolution

Find the function that contains a given call location:

```typescript
function find_containing_function(
  location: Location,
  resolved_symbols: ResolvedSymbols
): SymbolId | null {
  // This requires access to the original semantic indices to find containing scopes
  // Implementation depends on maintaining reference to original indices

  // Strategy 1: Use scope information if available
  // Strategy 2: Use location-based lookup in symbol definitions
  // Strategy 3: Pre-build location -> containing function mapping
}
```

### 5. Graph Statistics and Optimization

**Module**: `call_graph/graph_optimizer.ts`

Optimize graphs for query performance:

```typescript
function optimize_call_graph(graph: CallGraph): CallGraph {
  return {
    ...graph,
    // Add optimized data structures
    // - Pre-computed transitive closures for common queries
    // - Indexed lookups for fast symbol searches
    // - Compressed representations for large graphs
  };
}

function compute_graph_statistics(
  call_edges: Map<SymbolId, Set<SymbolId>>,
  called_by: Map<SymbolId, Set<SymbolId>>,
  call_sites: Map<SymbolId, Map<SymbolId, Location[]>>
): CallGraphStatistics {
  const total_symbols = new Set([...call_edges.keys(), ...called_by.keys()]).size;
  const total_call_edges = Array.from(call_edges.values())
    .reduce((sum, callees) => sum + callees.size, 0);

  const total_call_sites = Array.from(call_sites.values())
    .reduce((sum, callees) => {
      return sum + Array.from(callees.values())
        .reduce((inner_sum, locations) => inner_sum + locations.length, 0);
    }, 0);

  const max_fan_out = Math.max(
    0,
    ...Array.from(call_edges.values()).map(callees => callees.size)
  );

  const max_fan_in = Math.max(
    0,
    ...Array.from(called_by.values()).map(callers => callers.size)
  );

  return {
    total_symbols,
    total_call_edges,
    total_call_sites,
    max_fan_out,
    max_fan_in,
    cycles_detected: 0 // Will be computed by cycle detector
  };
}
```

### 6. Graph Serialization and Caching

**Module**: `call_graph/graph_serializer.ts`

Enable persistence and caching of call graphs:

```typescript
interface SerializedCallGraph {
  readonly version: string;
  readonly graph_type: CallGraphType;
  readonly timestamp: number;
  readonly call_edges: [string, string[]][]; // SymbolId -> SymbolId[]
  readonly call_sites: [string, [string, Location[]][]][]; // caller -> [callee, locations][]
  readonly statistics: CallGraphStatistics;
}

function serialize_call_graph(graph: CallGraph): SerializedCallGraph {
  const call_edges: [string, string[]][] = Array.from(graph.call_edges.entries())
    .map(([caller, callees]) => [caller, Array.from(callees)]);

  const call_sites: [string, [string, Location[]][]][] = Array.from(graph.call_sites.entries())
    .map(([caller, callees]) => [
      caller,
      Array.from(callees.entries()).map(([callee, locations]) => [callee, locations])
    ]);

  return {
    version: "1.0",
    graph_type: graph.graph_type,
    timestamp: Date.now(),
    call_edges,
    call_sites,
    statistics: graph.statistics
  };
}

function deserialize_call_graph(
  serialized: SerializedCallGraph,
  symbols: Map<SymbolId, SymbolDefinition>
): CallGraph {
  // Reconstruct call graph from serialized data
}
```

## Integration with Symbol Resolution

### Main Integration Point

Update `symbol_resolution.ts` to build call graphs:

```typescript
export function resolve_symbols_with_call_graph(
  input: ResolutionInput,
  graph_types: CallGraphType[] = ["combined"]
): ResolvedSymbolsWithCallGraph {
  const resolved_symbols = resolve_symbols(input);

  const call_graphs = new Map<CallGraphType, CallGraph>();
  for (const graph_type of graph_types) {
    call_graphs.set(graph_type, build_call_graph(resolved_symbols, graph_type));
  }

  return {
    ...resolved_symbols,
    call_graphs
  };
}

interface ResolvedSymbolsWithCallGraph extends ResolvedSymbols {
  readonly call_graphs: ReadonlyMap<CallGraphType, CallGraph>;
}
```

## Performance Considerations

### Memory Optimization

1. **Sparse Representations**: Use sets only for nodes with outgoing edges
2. **String Interning**: Intern SymbolId strings to reduce memory usage
3. **Lazy Loading**: Load call site details on demand
4. **Compression**: Compress serialized graphs for storage

### Query Performance

1. **Index Structures**: Pre-build common query indices
2. **Caching**: Cache frequently accessed subgraphs
3. **Incremental Updates**: Support incremental graph updates
4. **Parallel Construction**: Parallelize graph building for large projects

## Testing Strategy

### Unit Tests

- Call graph construction for each call type
- Graph merging and combination
- Statistics computation
- Serialization/deserialization
- Performance benchmarks

### Integration Tests

- End-to-end call graph construction
- Large codebase performance
- Cross-language call graphs
- Incremental update scenarios

### Test Fixtures

```
fixtures/
├── simple_call_graphs/
│   ├── function_calls_only/
│   ├── method_calls_only/
│   └── mixed_calls/
├── complex_scenarios/
│   ├── recursive_calls/
│   ├── mutual_recursion/
│   └── large_hierarchies/
└── performance/
    ├── 1000_functions/
    ├── 10000_methods/
    └── deep_call_chains/
```

## Success Criteria

1. **Accurate Graphs**: Call graphs correctly represent all resolved call relationships
2. **Multiple Types**: Support for function, method, constructor, and combined graphs
3. **Performance**: Handle large codebases (10,000+ symbols) efficiently
4. **Serialization**: Fast serialization and deserialization for caching
5. **Statistics**: Comprehensive graph statistics for analysis
6. **Memory Efficiency**: Reasonable memory usage for large graphs

## Dependencies

- **Prerequisite**: task-epic-11.91.1 (Import resolution)
- **Prerequisite**: task-epic-11.91.2 (Function resolution)
- **Prerequisite**: task-epic-11.91.3 (Method resolution)
- **Enables**: task-epic-11.91.5 (Call graph query API)
- **Enables**: Advanced call graph analysis features

## Risks and Mitigations

### Risk 1: Memory Usage for Large Graphs

Call graphs can consume significant memory for large codebases.

**Mitigation**: Implement sparse representations, compression, and lazy loading.

### Risk 2: Construction Performance

Building graphs from scratch can be slow for large projects.

**Mitigation**: Implement incremental updates and parallel construction.

### Risk 3: Graph Complexity

Complex inheritance and call patterns may create confusing graphs.

**Mitigation**: Provide filtering and simplification options.

## Implementation Notes

- Use immutable data structures where possible
- Follow functional programming patterns
- Include comprehensive error handling
- Optimize for common query patterns
- Support incremental graph updates

## References

- Graph theory algorithms and data structures
- Call graph construction in static analysis tools
- Performance optimization techniques for large graphs
- Existing symbol resolution pipeline implementation