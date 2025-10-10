# Performance Characteristics

This document describes the basic performance characteristics of the Project coordination layer.

## Running Benchmarks

Run optional performance benchmarks with:

```bash
npm run benchmark
```

Note: These benchmarks are optional and document typical performance, not strict requirements.

## Update Performance

### update_file()

The `update_file()` method processes files incrementally:

- **Small files** (< 100 lines): Typically < 50ms
- **Medium files** (~500 lines): Typically < 200ms

Time complexity: O(file_size) - each file is processed independently.

### Incremental Updates

Incremental updates are typically **2-5x faster** than full rebuilds, depending on:
- Project size
- Number of affected dependents
- Resolution cache hit rate

## Resolution Performance

### Cache Behavior

- **Unmodified files**: 100% cache hit (no re-resolution needed)
- **Modified file**: Cache invalidated for that file and its dependents
- **Cold start**: 0% cache hit (first resolution)

### Resolution Time

- **With cache**: < 1ms per file (cache lookup)
- **Without cache**: Depends on file size and complexity

## Memory Usage

### Per-File Overhead

Each indexed file stores:
- Semantic index (definitions, references, scopes)
- Derived data (type bindings, exports)
- Resolution cache entries

Typical overhead: ~50-100 KB per file.

### Registries

Project-level registries aggregate data across all files:
- DefinitionRegistry: O(total_definitions)
- TypeRegistry: O(total_type_bindings)
- ScopeRegistry: O(total_scopes)
- ExportRegistry: O(total_exports)
- ImportGraph: O(import_edges)
- ResolutionCache: O(total_resolutions)

All registries use Map-based indexing for O(1) lookup.

## Scaling Characteristics

The Project coordination layer scales sub-linearly with project size due to:
1. Only affected files are re-resolved on updates
2. Lazy resolution avoids unnecessary work
3. Cache reduces redundant computation

## Design Principles

The performance design prioritizes:
1. **Incremental updates**: Only recompute what changed
2. **Lazy resolution**: Only resolve when needed
3. **Effective caching**: Minimize redundant work
4. **Memory efficiency**: Reasonable overhead per file
