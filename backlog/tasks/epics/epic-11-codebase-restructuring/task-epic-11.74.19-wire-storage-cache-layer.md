# Task 11.74.19: Wire Storage and Cache Layer

**Status:** Ready
**Priority:** Low
**Size:** Medium

## Summary

Wire the complete but unused storage layer modules (`cache_layer`, `memory_storage`, `disk_storage`) to enable caching of analysis results for improved performance on repeated runs.

## Context

The storage infrastructure is complete with TTL-based caching, memory storage, and disk persistence options, but none of it is wired into the pipeline. This causes full re-analysis on every run even when files haven't changed.

## Acceptance Criteria

- [ ] Wire memory_storage as default storage backend
- [ ] Add cache_layer with TTL for analysis results
- [ ] Cache parsed ASTs with file hash validation
- [ ] Cache file analysis results with dependency tracking
- [ ] Add cache configuration options to CodeGraphOptions
- [ ] Implement cache invalidation on file changes
- [ ] Add metrics for cache hit/miss rates

## Technical Details

### Current State
- Modules exist at `/storage/cache_layer/`, `/storage/memory_storage/`, `/storage/disk_storage/`
- Complete implementations with tests
- Storage interface defined
- Not imported or used anywhere

### Integration Points

1. **AST Caching** (file_analyzer.ts):
```typescript
const cache_key = `ast:${file_hash}:${language}`;
let tree = cache.get(cache_key);
if (!tree) {
  tree = parser.parse(source_code);
  cache.set(cache_key, tree, TTL_1_HOUR);
}
```

2. **File Analysis Caching** (code_graph.ts):
```typescript
const cache_key = `analysis:${file_path}:${content_hash}`;
let analysis = cache.get(cache_key);
if (!analysis) {
  analysis = await analyze_file(file);
  cache.set(cache_key, analysis, TTL_15_MIN);
}
```

3. **Configuration**:
```typescript
interface CodeGraphOptions {
  // ... existing options
  cache?: {
    enabled: boolean;
    storage: 'memory' | 'disk';
    ttl: number;
    max_size?: number;
  }
}
```

### Cache Keys Strategy
- Use file content hash for immutable caching
- Include language and version in keys
- Track dependencies for invalidation

### Files to Modify
- `packages/core/src/code_graph.ts` - Add cache configuration and usage
- `packages/core/src/file_analyzer.ts` - Cache ASTs and analyses
- `packages/core/src/project/file_scanner.ts` - Add file hashing
- Types package - Add cache options to CodeGraphOptions

## Dependencies
- Can be done independently
- Benefits from file_tracker for change detection
- Should be done after core functionality is stable

## Implementation Notes
- Start with memory cache only
- Add disk persistence as optional enhancement
- Be careful with memory usage for large codebases
- Consider LRU eviction for memory cache
- Add debug logging for cache operations

## Test Requirements
- Test cache hit for unchanged files
- Test cache miss for modified files
- Test cache invalidation on dependency changes
- Test memory usage limits
- Test TTL expiration
- Test cache persistence (disk storage)
- Benchmark performance improvements

## Related Tasks
- Parent: Task 11.74 (Module consolidation)
- Related: Task 11.74.20 (Usage finder)
- Enables: Incremental analysis in future