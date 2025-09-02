# Task 11.74.13: Activate Caching Layer for Performance

## Status: Created
**Priority**: LOW
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Infrastructure Enhancement

## Summary

Wire the complete but unused storage/caching layer modules to cache analysis results and dramatically improve performance for repeated analyses. The infrastructure exists but is not connected to the pipeline.

## Context

We have complete caching infrastructure:
- `storage/cache_layer` - TTL-based caching with LRU eviction
- `storage/memory_storage` - In-memory storage backend
- `storage/disk_storage` - Persistent disk storage

But it's completely unused:
- Every analysis starts from scratch
- No caching of parsed ASTs
- No caching of type information
- No incremental analysis possible

## Problem Statement

Current performance issues:
```typescript
// Every call parses everything from scratch
const graph1 = await generate_code_graph(options);  // 10 seconds
const graph2 = await generate_code_graph(options);  // Another 10 seconds!

// Should be:
const graph1 = await generate_code_graph(options);  // 10 seconds
const graph2 = await generate_code_graph(options);  // 0.5 seconds (cache hit)
```

## Success Criteria

- [ ] Cache layer integrated into pipeline
- [ ] AST parsing cached
- [ ] Type registry cached
- [ ] Module graph cached
- [ ] Cache invalidation on file changes
- [ ] Configurable cache backends (memory/disk)
- [ ] Performance improvement demonstrated

## Technical Approach

### Caching Strategy

1. **Cache parsed ASTs** (biggest win)
2. **Cache per-file analysis** results
3. **Cache global structures** (type registry, module graph)
4. **Invalidate on changes**
5. **Provide cache controls**

### Implementation Steps

1. **Initialize cache in code_graph.ts**:
```typescript
import { create_cache_layer, CacheLayer } from "./storage/cache_layer";
import { create_memory_storage } from "./storage/memory_storage";
import { create_disk_storage } from "./storage/disk_storage";

export interface CodeGraphOptions {
  // ... existing options ...
  cache?: {
    enabled: boolean;
    backend: 'memory' | 'disk' | 'hybrid';
    ttl?: number;
    max_size?: number;
    disk_path?: string;
  };
}

export async function generate_code_graph(
  options: CodeGraphOptions
): Promise<CodeGraph> {
  // Initialize cache
  const cache = create_cache(options.cache);
  
  // Check for cached result
  const cache_key = compute_cache_key(options);
  const cached_result = await cache.get(cache_key);
  if (cached_result && !is_stale(cached_result)) {
    return cached_result;
  }
  
  // ... perform analysis ...
  
  // Cache the result
  await cache.set(cache_key, result, options.cache?.ttl);
  
  return result;
}

function create_cache(options?: CacheOptions): CacheLayer {
  if (!options?.enabled) {
    return create_null_cache();  // No-op cache
  }
  
  const storage = options.backend === 'disk'
    ? create_disk_storage({ path: options.disk_path })
    : create_memory_storage();
  
  return create_cache_layer({
    storage,
    ttl: options.ttl || 3600000,  // 1 hour default
    max_size: options.max_size || 100 * 1024 * 1024  // 100MB default
  });
}
```

2. **Cache parsed ASTs**:
```typescript
// In file_analyzer.ts
async function parse_file_with_cache(
  file: CodeFile,
  cache: CacheLayer
): Promise<ParseResult> {
  // Create cache key from file content hash
  const cache_key = `ast:${file.file_path}:${hash(file.source_code)}`;
  
  // Check cache
  const cached_ast = await cache.get(cache_key);
  if (cached_ast) {
    return deserialize_ast(cached_ast);
  }
  
  // Parse file
  const result = parse_file(file);
  
  // Cache the AST
  await cache.set(cache_key, serialize_ast(result), {
    ttl: 3600000,  // 1 hour
    size: estimate_ast_size(result.tree)
  });
  
  return result;
}

// AST serialization (tree-sitter specific)
function serialize_ast(result: ParseResult): string {
  return JSON.stringify({
    tree: result.tree.rootNode.toString(),
    language: result.parser.getLanguage().name
  });
}

function deserialize_ast(cached: string): ParseResult {
  const data = JSON.parse(cached);
  // Reconstruct tree from S-expression
  return reconstruct_tree(data.tree, data.language);
}
```

3. **Cache per-file analysis**:
```typescript
async function analyze_file_with_cache(
  file: CodeFile,
  cache: CacheLayer
): Promise<FileAnalysis> {
  const cache_key = `analysis:${file.file_path}:${hash(file.source_code)}`;
  
  // Check cache
  const cached = await cache.get(cache_key);
  if (cached) {
    return cached;
  }
  
  // Perform analysis
  const analysis = await analyze_file(file);
  
  // Cache the result
  await cache.set(cache_key, analysis, {
    ttl: 1800000  // 30 minutes
  });
  
  return analysis;
}
```

4. **Cache global structures**:
```typescript
// Cache type registry
async function build_type_registry_with_cache(
  analyses: FileAnalysis[],
  cache: CacheLayer
): Promise<TypeRegistry> {
  const cache_key = `type_registry:${hash_analyses(analyses)}`;
  
  const cached = await cache.get(cache_key);
  if (cached) {
    return cached;
  }
  
  const registry = await build_type_registry_from_analyses(analyses);
  await cache.set(cache_key, registry);
  
  return registry;
}

// Cache module graph
async function build_module_graph_with_cache(
  file_data: Map<string, FileData>,
  options: ModuleGraphOptions,
  cache: CacheLayer
): Promise<ModuleGraph> {
  const cache_key = `module_graph:${hash_file_data(file_data)}`;
  
  const cached = await cache.get(cache_key);
  if (cached) {
    return cached;
  }
  
  const graph = build_module_graph(file_data, options);
  await cache.set(cache_key, graph);
  
  return graph;
}
```

5. **Add cache invalidation**:
```typescript
// Invalidate on file changes
export async function invalidate_file_cache(
  file_path: string,
  cache: CacheLayer
): Promise<void> {
  // Remove all cache entries for this file
  await cache.delete_pattern(`ast:${file_path}:*`);
  await cache.delete_pattern(`analysis:${file_path}:*`);
  
  // Mark global caches as stale
  await cache.invalidate_pattern('type_registry:*');
  await cache.invalidate_pattern('module_graph:*');
}

// Watch for file changes
export function watch_and_invalidate(
  root_path: string,
  cache: CacheLayer
): void {
  const watcher = chokidar.watch(root_path, {
    ignored: /node_modules/,
    persistent: true
  });
  
  watcher.on('change', (path) => {
    invalidate_file_cache(path, cache);
  });
}
```

## Dependencies

- Storage modules must be working
- Need serialization for complex types
- File watching for invalidation

## Testing Requirements

### Cache Performance Tests
```typescript
test("caching improves performance", async () => {
  const options = {
    root_path: "./test-project",
    cache: { enabled: true, backend: 'memory' }
  };
  
  // First run - no cache
  const start1 = Date.now();
  const result1 = await generate_code_graph(options);
  const time1 = Date.now() - start1;
  
  // Second run - cache hit
  const start2 = Date.now();
  const result2 = await generate_code_graph(options);
  const time2 = Date.now() - start2;
  
  expect(time2).toBeLessThan(time1 / 2);  // At least 2x faster
  expect(result2).toEqual(result1);  // Same results
});
```

### Cache Invalidation Tests
```typescript
test("cache invalidates on file change", async () => {
  const cache = create_cache_layer({ storage: create_memory_storage() });
  
  // Cache a result
  await cache.set("analysis:file.ts:v1", analysis1);
  
  // Simulate file change
  await invalidate_file_cache("file.ts", cache);
  
  // Cache should be invalidated
  const cached = await cache.get("analysis:file.ts:v1");
  expect(cached).toBeNull();
});
```

## Risks

1. **Memory Usage**: Cache could grow large
2. **Stale Data**: Cache invalidation bugs
3. **Serialization**: Complex types hard to cache

## Implementation Notes

### What to Cache

**High Value** (expensive to compute):
- Parsed ASTs
- Type registry
- Class hierarchy
- Module graph

**Medium Value**:
- Per-file analysis
- Symbol tables
- Call graphs

**Low Value** (cheap to compute):
- Simple transformations
- Formatting

### Cache Backends

- **Memory**: Fast, limited size, lost on restart
- **Disk**: Slower, unlimited size, persistent
- **Hybrid**: Memory with disk fallback

## Estimated Effort

- Basic integration: 1 day
- AST caching: 1 day
- Global structure caching: 1 day
- Invalidation: 0.5 days
- Testing: 0.5 days
- **Total**: 4 days

## Notes

Caching is crucial for IDE-like performance where users expect instant feedback. The biggest win is caching parsed ASTs since parsing is often the slowest operation. With proper caching, subsequent analyses can be 10-100x faster. This also enables incremental analysis where only changed files are reprocessed.