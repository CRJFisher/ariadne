# Graph Builder Integration Research

## Executive Summary

The graph_builder feature will serve as the **orchestration layer** that connects all the modular analysis features in packages/core/src into a unified code graph. This document outlines how the existing features integrate and how graph_builder will coordinate them.

## Feature Integration Map

### Data Flow Architecture

```
                    ┌─────────────────┐
                    │  Graph Builder  │
                    │  (Orchestrator) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐     ┌────────▼────────┐   ┌──────▼──────┐
   │  Storage │     │ Feature Modules │   │    Graph    │
   │  Layer   │────▶│   (Analysis)    │──▶│   Output    │
   └──────────┘     └─────────────────┘   └─────────────┘
        ▲                    │                    │
        └────────────────────┴────────────────────┘
                      (Feedback Loop)
```

## How Features Connect

### 1. **Storage Foundation**
All features read from and write to the storage layer:
- **Input**: `StoredFile` with source code and AST tree
- **Output**: Analysis results stored in `ProjectState`
- **Integration**: Graph builder manages storage transactions

### 2. **Call Graph → Symbol Resolution Chain**

```typescript
// Step 1: Find function calls
const calls = find_function_calls(ast, metadata);

// Step 2: Resolve call targets using scope and import resolution
for (const call of calls) {
  // Use scope_tree to find local definitions
  const local_def = scope_tree.resolve_symbol(call.function_name);
  
  // If not local, use import_resolution
  if (!local_def) {
    const import_info = import_resolver.resolve_import(call.function_name);
    const target_def = export_detector.get_export(import_info);
  }
}

// Step 3: Build call edges in graph
graph.add_edge({
  type: 'calls',
  source: current_function,
  target: resolved_definition
});
```

### 3. **Type Analysis → Method Resolution**

```typescript
// Step 1: Track variable types
const receiver_type = type_tracker.get_type_at(method_call.receiver);

// Step 2: Find class definition
const class_def = class_hierarchy.get_class(receiver_type);

// Step 3: Resolve method in class hierarchy
const method_def = method_override.resolve_method(class_def, method_name);

// Step 4: Add method call edge
graph.add_edge({
  type: 'method_call',
  source: current_context,
  target: method_def,
  receiver_type: receiver_type
});
```

### 4. **Module Graph Construction**

```typescript
// Step 1: Detect exports in each file
const exports = export_detector.get_exports(file);

// Step 2: Track imports
const imports = import_resolver.get_imports(file);

// Step 3: Build module dependency graph
for (const import of imports) {
  const source_module = module_graph.resolve_module(import.path);
  graph.add_edge({
    type: 'imports',
    source: current_file,
    target: source_module,
    symbols: import.symbols
  });
}
```

### 5. **Incremental Updates**

```typescript
// Step 1: File change detected
const change_event = file_tracker.on_change(file_path);

// Step 2: Determine impact scope
const affected_files = module_graph.get_dependents(file_path);

// Step 3: Update only affected analysis
for (const affected of affected_files) {
  // Re-analyze imports if exports changed
  if (change_event.affects_exports) {
    import_resolver.reanalyze(affected);
  }
  
  // Re-analyze calls if functions changed
  if (change_event.affects_functions) {
    call_graph.reanalyze(affected);
  }
}
```

## Graph Builder Responsibilities

### 1. **Orchestration**
- Initialize all feature analyzers in correct order
- Coordinate data sharing between features
- Manage analysis phases (parse → scope → type → call → graph)

### 2. **Cross-Feature Resolution**
- Resolve references across module boundaries
- Link type information to call resolution
- Connect inheritance hierarchies to method calls

### 3. **Graph Construction**
- Aggregate analysis results into unified graph
- Maintain consistent node/edge representations
- Support multiple graph views (call graph, dependency graph, type graph)

### 4. **Query Interface**
- Provide unified API for graph queries
- Support navigation (go-to-definition, find-references)
- Enable graph traversal algorithms

## Integration Interfaces

### Core Graph Builder Interface

```typescript
interface GraphBuilder {
  // Initialize with storage and config
  initialize(storage: StorageInterface, config: ProjectConfig): Promise<void>;
  
  // Build complete project graph
  build_project_graph(): Promise<ProjectGraph>;
  
  // Incremental updates
  update_file(file_path: string, changes: FileChangeEvent[]): Promise<void>;
  
  // Query interface
  get_call_graph(): CallGraph;
  get_module_graph(): ModuleGraph;
  get_type_graph(): TypeGraph;
  
  // Cross-feature queries
  resolve_reference(ref: Reference): Promise<Definition>;
  find_usages(def: Definition): Promise<Usage[]>;
  get_call_hierarchy(func: FunctionDef): Promise<CallHierarchy>;
}
```

### Feature Coordination

```typescript
class GraphBuilderImpl {
  // Feature modules
  private storage: StorageInterface;
  private call_analyzer: CallGraphAnalyzer;
  private import_resolver: ImportResolver;
  private scope_analyzer: ScopeAnalyzer;
  private type_tracker: TypeTracker;
  private class_analyzer: ClassHierarchyAnalyzer;
  
  // Unified graph
  private graph: UnifiedGraph;
  
  async build_file_graph(file: StoredFile): Promise<FileGraph> {
    // Phase 1: Scope analysis
    const scopes = await this.scope_analyzer.analyze(file.tree);
    
    // Phase 2: Import/Export detection
    const imports = await this.import_resolver.analyze(file.tree);
    const exports = await this.export_detector.analyze(file.tree);
    
    // Phase 3: Type tracking
    const types = await this.type_tracker.analyze(file.tree, scopes);
    
    // Phase 4: Call analysis (using scope and type info)
    const calls = await this.call_analyzer.analyze(file.tree, {
      scopes,
      types,
      imports
    });
    
    // Phase 5: Graph construction
    return this.construct_graph({
      file,
      scopes,
      imports,
      exports,
      types,
      calls
    });
  }
}
```

## Key Integration Patterns

### 1. **Phased Analysis**
Each file goes through analysis phases in order:
1. Parse (AST)
2. Scope (symbol tables)
3. Type (type inference)
4. Import/Export (module connections)
5. Call (function/method calls)
6. Graph (unified representation)

### 2. **Shared Context**
Features share analysis context:
- Scope trees used by type tracking and call resolution
- Type information used by method call resolution
- Import maps used by cross-file reference resolution

### 3. **Lazy Resolution**
References resolved on-demand:
- Store unresolved references during initial analysis
- Resolve when building final graph
- Cache resolutions for performance

### 4. **Incremental Propagation**
Changes propagate through dependency chain:
- File change → Update AST
- AST change → Update scopes
- Scope change → Update types
- Type change → Update call resolution
- Call change → Update graph edges

## Implementation Strategy

### Phase 1: Basic Graph Builder
1. Create orchestration framework
2. Integrate storage layer
3. Add simple call graph building

### Phase 2: Cross-Feature Integration
1. Connect import/export resolution
2. Add type-aware method resolution
3. Build module dependency graph

### Phase 3: Advanced Features
1. Incremental update system
2. Query optimization
3. Graph visualization support

### Phase 4: Performance Optimization
1. Parallel analysis where possible
2. Caching and memoization
3. Lazy loading of graph sections

## Benefits of This Architecture

1. **Modular**: Each feature remains independent
2. **Extensible**: Easy to add new analysis features
3. **Efficient**: Incremental updates only recompute affected parts
4. **Unified**: Single graph representation for all queries
5. **Flexible**: Supports multiple language patterns

## Next Steps

1. Locate existing graph_builder code
2. Design migration plan following Architecture.md
3. Implement basic orchestration layer
4. Add feature integrations incrementally
5. Build comprehensive test suite