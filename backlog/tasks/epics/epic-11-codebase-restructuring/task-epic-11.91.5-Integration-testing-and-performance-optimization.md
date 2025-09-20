# Task: Integration Testing and Performance Optimization

**Task ID**: task-epic-11.91.5
**Parent**: task-epic-11.91
**Status**: Created
**Priority**: Critical
**Created**: 2025-01-20
**Estimated Effort**: 2-3 days

## Problem Statement

With all symbol resolution phases and call graph construction implemented, we need comprehensive integration testing and performance optimization to ensure the system works correctly and efficiently across real-world codebases.

### Current State

After tasks 11.91.1-11.91.5:
- ✅ Import/export resolution (Phase 1)
- ✅ Function call resolution (Phase 2)
- ✅ Enhanced method/constructor resolution (Phase 4)
- ✅ Call graph construction system
- ✅ Call graph query API

Missing:
- ❌ End-to-end integration testing
- ❌ Performance benchmarking and optimization
- ❌ Real-world codebase validation
- ❌ Cross-language integration testing
- ❌ Documentation and examples

## Solution Overview

Implement comprehensive testing, performance optimization, and documentation to ensure the complete symbol resolution pipeline is production-ready.

### Architecture

```
symbol_resolution/
├── integration_tests/
│   ├── end_to_end.test.ts        # Complete pipeline testing
│   ├── performance.test.ts       # Performance benchmarks
│   ├── cross_language.test.ts    # Multi-language scenarios
│   └── real_world.test.ts        # Real codebase validation
├── performance/
│   ├── profiler.ts               # Performance profiling tools
│   ├── optimizers.ts             # Performance optimizations
│   └── benchmarks.ts             # Benchmark utilities
├── examples/
│   ├── basic_usage.ts            # Basic API usage examples
│   ├── advanced_queries.ts       # Advanced query examples
│   └── visualization.ts          # Graph visualization examples
└── docs/
    ├── API.md                    # Complete API documentation
    ├── architecture.md           # Architecture overview
    └── performance.md            # Performance characteristics
```

## Implementation Plan

### 1. End-to-End Integration Testing

**Module**: `integration_tests/end_to_end.test.ts`

Test complete pipeline from semantic indexing to call graph queries:

```typescript
describe("Complete Symbol Resolution Pipeline", () => {
  it("should resolve cross-file function calls correctly", async () => {
    // Setup test project with multiple files
    const test_project = create_test_project([
      {
        path: "src/utils.ts",
        content: `
          export function helper(x: number): string {
            return x.toString();
          }
        `
      },
      {
        path: "src/main.ts",
        content: `
          import { helper } from './utils';

          function main() {
            const result = helper(42);
            return result;
          }
        `
      }
    ]);

    // Run complete pipeline
    const semantic_indices = await build_semantic_indices(test_project);
    const resolved_symbols = resolve_symbols_with_call_graph({
      indices: semantic_indices
    });

    // Verify import resolution
    const main_file_imports = resolved_symbols.phases.imports.imports.get("src/main.ts");
    expect(main_file_imports?.has("helper" as SymbolName)).toBe(true);

    // Verify function call resolution
    const call_graph = resolved_symbols.call_graphs.get("function_calls")!;
    const query = create_call_graph_query(call_graph);

    const main_function = find_symbol_by_name("main", semantic_indices);
    const helper_function = find_symbol_by_name("helper", semantic_indices);

    expect(query.get_callees(main_function)).toContain(helper_function);
    expect(query.is_reachable(main_function, helper_function)).toBe(true);
  });

  it("should resolve method calls through inheritance", async () => {
    const test_project = create_inheritance_test_project();

    // Test method resolution through inheritance chain
    // Base class -> Derived class -> method calls

    const resolved_symbols = resolve_symbols_with_call_graph({
      indices: await build_semantic_indices(test_project)
    });

    const method_graph = resolved_symbols.call_graphs.get("method_calls")!;
    const query = create_call_graph_query(method_graph);

    // Verify inherited method calls are resolved correctly
    // ...test implementation
  });

  it("should handle constructor calls with type resolution", async () => {
    // Test constructor call resolution with proper type context
    // ...test implementation
  });
});
```

### 2. Performance Benchmarking

**Module**: `integration_tests/performance.test.ts`

Measure and optimize performance on large codebases:

```typescript
describe("Performance Benchmarks", () => {
  const LARGE_PROJECT_SIZES = [1000, 5000, 10000]; // Number of files

  LARGE_PROJECT_SIZES.forEach(size => {
    it(`should handle ${size} files efficiently`, async () => {
      const large_project = generate_large_test_project(size);

      const start_time = performance.now();

      // Measure semantic indexing
      const index_start = performance.now();
      const semantic_indices = await build_semantic_indices(large_project);
      const index_time = performance.now() - index_start;

      // Measure symbol resolution
      const resolution_start = performance.now();
      const resolved_symbols = resolve_symbols_with_call_graph({
        indices: semantic_indices
      });
      const resolution_time = performance.now() - resolution_start;

      // Measure call graph construction
      const graph_start = performance.now();
      const call_graph = resolved_symbols.call_graphs.get("combined")!;
      const graph_time = performance.now() - graph_start;

      const total_time = performance.now() - start_time;

      // Performance assertions
      expect(total_time).toBeLessThan(size * 10); // 10ms per file max
      expect(index_time).toBeLessThan(total_time * 0.6); // Indexing < 60%
      expect(resolution_time).toBeLessThan(total_time * 0.3); // Resolution < 30%
      expect(graph_time).toBeLessThan(total_time * 0.1); // Graph construction < 10%

      // Memory usage checks
      const memory_usage = process.memoryUsage();
      expect(memory_usage.heapUsed).toBeLessThan(size * 1024 * 1024); // 1MB per file max

      // Log performance metrics
      console.log(`${size} files: ${total_time.toFixed(2)}ms total`);
      console.log(`  Indexing: ${index_time.toFixed(2)}ms`);
      console.log(`  Resolution: ${resolution_time.toFixed(2)}ms`);
      console.log(`  Graph: ${graph_time.toFixed(2)}ms`);
    });
  });

  it("should have efficient query performance", async () => {
    const large_project = generate_large_test_project(5000);
    const resolved_symbols = resolve_symbols_with_call_graph({
      indices: await build_semantic_indices(large_project)
    });

    const call_graph = resolved_symbols.call_graphs.get("combined")!;
    const query = create_call_graph_query(call_graph);

    // Test query performance
    const random_symbols = get_random_symbols(call_graph, 100);

    for (const symbol of random_symbols) {
      const start = performance.now();

      // Common query operations
      query.get_callees(symbol);
      query.get_callers(symbol);
      query.get_all_dependencies(symbol, { max_depth: 3 });
      query.compute_call_metrics(symbol);

      const query_time = performance.now() - start;
      expect(query_time).toBeLessThan(10); // 10ms per symbol max
    }
  });
});
```

### 3. Cross-Language Integration Testing

**Module**: `integration_tests/cross_language.test.ts`

Test symbol resolution across different languages:

```typescript
describe("Cross-Language Symbol Resolution", () => {
  it("should handle JavaScript/TypeScript mixed projects", async () => {
    const mixed_project = create_mixed_js_ts_project();

    // Test:
    // - .js files importing from .ts files
    // - .ts files importing from .js files
    // - Type information flow across boundaries

    const resolved_symbols = resolve_symbols_with_call_graph({
      indices: await build_semantic_indices(mixed_project)
    });

    // Verify cross-language imports work
    // Verify call resolution across language boundaries
    // ...test implementation
  });

  it("should support all language features", async () => {
    const multi_lang_project = {
      javascript: create_js_test_files(),
      typescript: create_ts_test_files(),
      python: create_py_test_files(),
      rust: create_rs_test_files()
    };

    // Test each language independently
    for (const [lang, files] of Object.entries(multi_lang_project)) {
      const resolved_symbols = resolve_symbols_with_call_graph({
        indices: await build_semantic_indices(files)
      });

      // Verify language-specific features work
      validate_language_features(lang, resolved_symbols);
    }
  });
});

function validate_language_features(
  language: string,
  resolved_symbols: ResolvedSymbols
): void {
  switch (language) {
    case "javascript":
      // Test hoisting, closures, prototypes
      break;
    case "typescript":
      // Test interfaces, generics, method overloading
      break;
    case "python":
      // Test classes, inheritance, decorators
      break;
    case "rust":
      // Test traits, associated functions, generics
      break;
  }
}
```

### 4. Real-World Codebase Validation

**Module**: `integration_tests/real_world.test.ts`

Test on actual open-source projects:

```typescript
describe("Real-World Codebase Validation", () => {
  const REAL_PROJECTS = [
    { name: "lodash", type: "javascript", size: "large" },
    { name: "express", type: "javascript", size: "medium" },
    { name: "typescript", type: "typescript", size: "very_large" },
    { name: "django", type: "python", size: "large" },
    { name: "serde", type: "rust", size: "medium" }
  ];

  REAL_PROJECTS.forEach(project => {
    it(`should analyze ${project.name} correctly`, async () => {
      // Clone or use cached version of real project
      const project_files = await load_real_project(project.name);

      if (project_files.length > 1000) {
        // Skip very large projects in CI
        return;
      }

      const resolved_symbols = resolve_symbols_with_call_graph({
        indices: await build_semantic_indices(project_files)
      });

      // Basic validation
      expect(resolved_symbols.resolved_references.size).toBeGreaterThan(0);
      expect(resolved_symbols.call_graphs.size).toBeGreaterThan(0);

      // Validate call graph structure
      const combined_graph = resolved_symbols.call_graphs.get("combined")!;
      const query = create_call_graph_query(combined_graph);

      // Check for reasonable graph structure
      const symbols = Array.from(combined_graph.call_edges.keys());
      expect(symbols.length).toBeGreaterThan(10);

      // Validate some calls are resolved
      let resolved_calls = 0;
      for (const symbol of symbols.slice(0, 10)) {
        const callees = query.get_callees(symbol);
        resolved_calls += callees.length;
      }
      expect(resolved_calls).toBeGreaterThan(0);

      console.log(`${project.name}: ${symbols.length} symbols, ${resolved_calls} calls resolved`);
    });
  });
});
```

### 5. Performance Optimization

**Module**: `performance/optimizers.ts`

Implement performance optimizations based on profiling:

```typescript
// Optimized import resolution with caching
class CachedImportResolver {
  private readonly path_cache = new Map<string, FilePath | null>();
  private readonly resolution_cache = new Map<string, SymbolId | null>();

  resolve_import_with_cache(
    import_path: string,
    importing_file: FilePath,
    import_name: SymbolName
  ): SymbolId | null {
    // Use cached results when available
    const cache_key = `${importing_file}:${import_path}:${import_name}`;

    if (this.resolution_cache.has(cache_key)) {
      return this.resolution_cache.get(cache_key)!;
    }

    // Resolve and cache
    const result = this.resolve_import(import_path, importing_file, import_name);
    this.resolution_cache.set(cache_key, result);

    return result;
  }
}

// Optimized call graph construction
function build_call_graph_optimized(
  resolved_symbols: ResolvedSymbols
): CallGraph {
  // Use more efficient data structures
  const call_edges = new Map<SymbolId, Set<SymbolId>>();
  const called_by = new Map<SymbolId, Set<SymbolId>>();

  // Batch process all call types together
  const all_calls = [
    ...resolved_symbols.phases.functions.function_calls.entries(),
    ...resolved_symbols.phases.methods.method_calls.entries(),
    ...resolved_symbols.phases.methods.constructor_calls.entries()
  ];

  // Single pass to build all mappings
  for (const [location, callee_id] of all_calls) {
    const caller_id = find_containing_function(location, resolved_symbols);
    if (caller_id) {
      add_edge_fast(caller_id, callee_id, call_edges, called_by);
    }
  }

  return create_optimized_call_graph(call_edges, called_by);
}
```

### 6. Memory Usage Optimization

Monitor and optimize memory usage:

```typescript
class MemoryOptimizedCallGraph implements CallGraph {
  // Use WeakMap for automatic cleanup
  private readonly weak_cache = new WeakMap<object, any>();

  // Use symbols interning to reduce memory
  private readonly symbol_intern = new Map<string, SymbolId>();

  intern_symbol(symbol_string: string): SymbolId {
    if (!this.symbol_intern.has(symbol_string)) {
      this.symbol_intern.set(symbol_string, symbol_string as SymbolId);
    }
    return this.symbol_intern.get(symbol_string)!;
  }

  // Lazy loading for call sites
  get_call_sites(caller: SymbolId, callee: SymbolId): readonly Location[] {
    // Load call sites on demand
    return this.load_call_sites_lazy(caller, callee);
  }
}
```

### 7. Documentation and Examples

**Module**: `examples/basic_usage.ts`

Comprehensive usage examples:

```typescript
/**
 * Basic Symbol Resolution and Call Graph Usage
 */

async function basic_usage_example() {
  // 1. Build semantic indices from source files
  const source_files = await load_source_files("./src");
  const semantic_indices = await build_semantic_indices(source_files);

  // 2. Resolve all symbols and build call graphs
  const resolved_symbols = resolve_symbols_with_call_graph({
    indices: semantic_indices,
    target_files: ["./src/main.ts"] // Optional: focus on specific files
  });

  // 3. Query call graphs
  const combined_graph = resolved_symbols.call_graphs.get("combined")!;
  const query = create_call_graph_query(combined_graph);

  // Find a specific function
  const main_function = find_symbol_by_name("main", semantic_indices);

  // Analyze its dependencies
  const dependencies = query.get_all_dependencies(main_function);
  console.log(`main() depends on ${dependencies.length} functions`);

  // Find who calls it
  const callers = query.get_callers(main_function);
  console.log(`main() is called by ${callers.length} functions`);

  // Detect cycles
  const cycles = query.detect_cycles();
  console.log(`Found ${cycles.length} circular dependencies`);

  // Export for visualization
  const dot_graph = export_to_dot(combined_graph, {
    include_file_paths: true,
    color_by_file: true
  });
  await write_file("call_graph.dot", dot_graph);
}
```

## Testing Infrastructure

### Test Utilities

Create comprehensive test utilities:

```typescript
// Test project generation
function generate_large_test_project(size: number): ProjectFiles {
  // Generate realistic project structure with:
  // - Cross-file dependencies
  // - Inheritance hierarchies
  // - Complex call patterns
  // - Different languages
}

// Performance measurement
function measure_performance<T>(
  operation: () => T,
  description: string
): { result: T; time: number; memory: number } {
  const start_memory = process.memoryUsage().heapUsed;
  const start_time = performance.now();

  const result = operation();

  const end_time = performance.now();
  const end_memory = process.memoryUsage().heapUsed;

  const time = end_time - start_time;
  const memory = end_memory - start_memory;

  console.log(`${description}: ${time.toFixed(2)}ms, ${(memory / 1024 / 1024).toFixed(2)}MB`);

  return { result, time, memory };
}
```

## Success Criteria

1. **End-to-End Functionality**: Complete pipeline works from source code to call graph queries
2. **Performance Targets**:
   - Handle 10,000 files in under 30 seconds
   - Query response time under 100ms for large graphs
   - Memory usage under 1GB for large projects
3. **Real-World Validation**: Successfully analyzes popular open-source projects
4. **Cross-Language Support**: Works correctly for all supported languages
5. **Comprehensive Documentation**: Complete API docs and usage examples
6. **Test Coverage**: >95% test coverage for all modules

## Dependencies

- **Prerequisite**: All tasks 11.91.1-11.91.5 completed
- **Enables**: Production deployment of symbol resolution system
- **Enables**: Advanced IDE features and static analysis tools

## Performance Targets

### Throughput Targets

- **Small projects** (< 100 files): < 1 second total
- **Medium projects** (100-1,000 files): < 10 seconds total
- **Large projects** (1,000-10,000 files): < 60 seconds total
- **Very large projects** (> 10,000 files): < 300 seconds total

### Memory Targets

- **Base memory**: < 100MB for runtime
- **Per-file overhead**: < 1MB per source file
- **Call graph overhead**: < 10KB per symbol

### Query Performance Targets

- **Direct queries** (get_callees, get_callers): < 1ms
- **Dependency analysis**: < 10ms for depth 5
- **Path finding**: < 100ms for typical cases
- **Cycle detection**: < 1 second for large graphs

## Implementation Notes

- Use Node.js performance APIs for accurate measurements
- Implement memory profiling with heap snapshots
- Create automated performance regression tests
- Document performance characteristics for users
- Provide configuration options for memory/speed tradeoffs

## References

- Performance testing best practices
- Memory optimization techniques for Node.js
- Static analysis tool performance benchmarks
- Open-source project analysis case studies