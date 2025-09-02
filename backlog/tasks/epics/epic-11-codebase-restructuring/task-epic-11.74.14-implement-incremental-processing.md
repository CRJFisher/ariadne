# Task 11.74.14: Implement Incremental Processing

## Status: Created
**Priority**: LOW
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Infrastructure Enhancement

## Summary

Implement the stub `project/incremental_updates` module to enable incremental processing where only changed files and their dependents are reanalyzed. This builds on the caching layer (11.74.13) to provide IDE-level performance.

## Context

The incremental_updates module exists but is only a stub:
- Basic types defined
- Factory function exists
- No actual implementation
- Critical for IDE/watch mode performance

Without incremental processing:
- Every change triggers full reanalysis
- Large projects become unusable
- Watch mode is impractical

## Problem Statement

Current full reanalysis on every change:
```typescript
// File A changes
fileA.ts modified -> Reanalyze ALL files (slow!)

// Should be:
fileA.ts modified -> Reanalyze fileA + dependents only (fast!)
```

## Success Criteria

- [ ] Incremental updater implemented
- [ ] Dependency tracking working
- [ ] Minimal reanalysis on changes
- [ ] Watch mode integrated
- [ ] Performance improvement demonstrated
- [ ] Cache coordination working

## Technical Approach

### Incremental Strategy

1. **Track dependencies** between files
2. **Detect changes** to files
3. **Calculate impact** of changes
4. **Reanalyze minimum** set
5. **Update incrementally**

### Implementation Steps

1. **Implement incremental updater**:
```typescript
// project/incremental_updates/updater.ts

import { FileTracker } from '../file_tracker';
import { CacheLayer } from '../../storage/cache_layer';

export interface IncrementalUpdater {
  // Track a file change
  file_changed(file_path: string, change_type: ChangeType): void;
  
  // Get files that need reanalysis
  get_affected_files(): Set<string>;
  
  // Update analysis results incrementally
  update_analysis(
    previous: CodeGraph,
    changed_files: Map<string, FileAnalysis>
  ): CodeGraph;
  
  // Reset incremental state
  reset(): void;
}

export function create_incremental_updater(
  options: IncrementalOptions
): IncrementalUpdater {
  const dependency_graph = new Map<string, Set<string>>();
  const reverse_deps = new Map<string, Set<string>>();
  const change_queue = new Set<string>();
  
  return {
    file_changed(file_path: string, change_type: ChangeType) {
      change_queue.add(file_path);
      
      // Add all dependents to queue
      const dependents = get_transitive_dependents(
        file_path,
        reverse_deps
      );
      dependents.forEach(dep => change_queue.add(dep));
    },
    
    get_affected_files(): Set<string> {
      return new Set(change_queue);
    },
    
    update_analysis(
      previous: CodeGraph,
      changed_analyses: Map<string, FileAnalysis>
    ): CodeGraph {
      // Merge changed analyses into previous graph
      return merge_incremental_changes(
        previous,
        changed_analyses,
        dependency_graph
      );
    },
    
    reset() {
      change_queue.clear();
      dependency_graph.clear();
      reverse_deps.clear();
    }
  };
}
```

2. **Build dependency tracking**:
```typescript
// Track import dependencies
function build_dependency_graph(
  analyses: FileAnalysis[]
): DependencyGraph {
  const deps = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();
  
  for (const analysis of analyses) {
    const file_deps = new Set<string>();
    
    // Track import dependencies
    for (const imp of analysis.imports) {
      const resolved = resolve_import_path(imp.source, analysis.file_path);
      if (resolved) {
        file_deps.add(resolved);
        
        // Add reverse dependency
        if (!reverse.has(resolved)) {
          reverse.set(resolved, new Set());
        }
        reverse.get(resolved)!.add(analysis.file_path);
      }
    }
    
    deps.set(analysis.file_path, file_deps);
  }
  
  return { forward: deps, reverse };
}

// Get all files affected by a change
function get_transitive_dependents(
  file_path: string,
  reverse_deps: Map<string, Set<string>>
): Set<string> {
  const affected = new Set<string>();
  const queue = [file_path];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    const dependents = reverse_deps.get(current) || new Set();
    for (const dep of dependents) {
      if (!affected.has(dep)) {
        affected.add(dep);
        queue.push(dep);
      }
    }
  }
  
  return affected;
}
```

3. **Integrate with file watcher**:
```typescript
// Incremental watch mode
export async function watch_incremental(
  options: CodeGraphOptions
): Promise<void> {
  // Initial analysis
  let graph = await generate_code_graph(options);
  const updater = create_incremental_updater({
    cache: options.cache
  });
  
  // Build dependency graph
  const deps = build_dependency_graph(
    Array.from(graph.files.values())
  );
  
  // Watch for changes
  const watcher = chokidar.watch(options.root_path, {
    ignored: /node_modules/,
    persistent: true
  });
  
  watcher.on('change', async (path) => {
    console.log(`File changed: ${path}`);
    
    // Mark file as changed
    updater.file_changed(path, 'modified');
    
    // Get affected files
    const affected = updater.get_affected_files();
    console.log(`Reanalyzing ${affected.size} files`);
    
    // Reanalyze only affected files
    const changed_analyses = new Map();
    for (const file_path of affected) {
      const file = await read_and_parse_file(file_path);
      const analysis = await analyze_file(file);
      changed_analyses.set(file_path, analysis);
    }
    
    // Update graph incrementally
    graph = updater.update_analysis(graph, changed_analyses);
    
    // Notify listeners
    emit_graph_updated(graph);
  });
}
```

4. **Implement incremental merge**:
```typescript
function merge_incremental_changes(
  previous: CodeGraph,
  changed: Map<string, FileAnalysis>,
  deps: DependencyGraph
): CodeGraph {
  // Clone previous graph
  const updated = clone_code_graph(previous);
  
  // Update changed files
  for (const [path, analysis] of changed) {
    updated.files.set(path, analysis);
  }
  
  // Rebuild affected global structures
  const affected_files = Array.from(changed.keys());
  
  // Update module graph for affected files
  const affected_modules = get_affected_modules(affected_files, deps);
  update_module_graph_incremental(
    updated.modules,
    affected_modules
  );
  
  // Update type registry for changed types
  const changed_types = extract_changed_types(changed);
  update_type_registry_incremental(
    updated.types,
    changed_types
  );
  
  // Update class hierarchy if classes changed
  const changed_classes = extract_changed_classes(changed);
  if (changed_classes.length > 0) {
    update_class_hierarchy_incremental(
      updated.classes,
      changed_classes
    );
  }
  
  // Rebuild call graph for affected files
  update_call_graph_incremental(
    updated.calls,
    changed,
    deps
  );
  
  return updated;
}
```

5. **Add incremental API to code_graph**:
```typescript
// In code_graph.ts

export interface IncrementalCodeGraphOptions extends CodeGraphOptions {
  incremental?: {
    enabled: boolean;
    watch?: boolean;
    on_update?: (graph: CodeGraph) => void;
  };
}

export async function generate_code_graph_incremental(
  options: IncrementalCodeGraphOptions
): Promise<CodeGraph> {
  if (!options.incremental?.enabled) {
    return generate_code_graph(options);
  }
  
  // Initial full analysis
  const initial = await generate_code_graph(options);
  
  if (options.incremental.watch) {
    // Start watch mode
    watch_incremental({
      ...options,
      initial_graph: initial,
      on_update: options.incremental.on_update
    });
  }
  
  return initial;
}
```

## Dependencies

- Requires caching layer (11.74.13)
- Needs file watching
- Depends on dependency tracking

## Testing Requirements

### Incremental Tests
```typescript
test("incremental update only reanalyzes affected files", async () => {
  // Initial analysis
  const graph1 = await generate_code_graph(options);
  const updater = create_incremental_updater(options);
  
  // Change one file
  await modify_file("src/utils.ts");
  updater.file_changed("src/utils.ts", 'modified');
  
  // Should only reanalyze utils.ts and its dependents
  const affected = updater.get_affected_files();
  expect(affected.size).toBeLessThan(total_files / 2);
  expect(affected).toContain("src/utils.ts");
  expect(affected).toContain("src/main.ts");  // Imports utils
});

test("incremental performance is better than full", async () => {
  const initial = await generate_code_graph(options);
  
  // Full reanalysis
  const full_start = Date.now();
  const full_result = await generate_code_graph(options);
  const full_time = Date.now() - full_start;
  
  // Incremental update
  const inc_start = Date.now();
  const inc_result = await update_incremental(initial, ["file1.ts"]);
  const inc_time = Date.now() - inc_start;
  
  expect(inc_time).toBeLessThan(full_time / 5);  // At least 5x faster
});
```

## Risks

1. **Complexity**: Dependency tracking is complex
2. **Correctness**: Might miss dependencies
3. **Memory**: Keeping previous state in memory

## Implementation Notes

### Dependency Types

1. **Import dependencies**: File A imports from File B
2. **Type dependencies**: File A uses type from File B
3. **Inheritance dependencies**: Class extends/implements from another file
4. **Call dependencies**: Function calls across files

### Invalidation Strategies

- **Conservative**: Invalidate all transitive dependents
- **Optimistic**: Only invalidate direct dependents
- **Smart**: Analyze change impact to minimize invalidation

### Performance Targets

- Single file change: < 500ms
- Small module change: < 2 seconds
- Large refactor: < 10 seconds

## Estimated Effort

- Core implementation: 2 days
- Dependency tracking: 1 day
- Watch integration: 1 day
- Incremental merge: 1 day
- Testing: 1 day
- **Total**: 6 days

## Notes

Incremental processing is essential for IDE integration and watch mode. Without it, large projects become unusable as every keystroke triggers full reanalysis. This builds on the caching layer to provide sub-second response times for most changes. The key is accurate dependency tracking to ensure we reanalyze the minimum necessary files while maintaining correctness.