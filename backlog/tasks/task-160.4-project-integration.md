---
id: task-160.4
title: Project integration
status: To Do
assignee: []
created_date: '2025-11-24'
labels: [performance, architecture]
dependencies: [task-160.1, task-160.2, task-160.3]
parent_task_id: task-160
---

## Description

Integrate the caching system into the `Project` class. This is the main integration point where caching is actually used to speed up project loading and file updates.

## Key Changes

### 1. Project Options

```typescript
// In packages/core/src/project/project.ts

import type { CacheProvider } from '../cache'
import { InMemoryCacheProvider, CACHE_SCHEMA_VERSION } from '../cache'

export interface ProjectOptions {
  /** Optional cache provider. Defaults to InMemoryCacheProvider. */
  cache_provider?: CacheProvider

  /** Disable caching entirely. Default: false */
  disable_cache?: boolean
}
```

### 2. Project Class Updates

```typescript
export class Project {
  private cache: CacheProvider | null
  private file_contents: Map<FilePath, string>  // Already exists, used for hashing

  constructor(options?: ProjectOptions) {
    // ... existing initialization ...

    this.cache = options?.disable_cache
      ? null
      : (options?.cache_provider ?? new InMemoryCacheProvider())
  }

  // New method: Load project with cache
  async load_with_cache(files: Array<{ path: FilePath; content: string }>): Promise<void> {
    // Phase 1: Determine which files changed
    const changed_files = new Set<FilePath>()

    for (const { path, content } of files) {
      const content_hash = hash_content(content)
      const cached = await this.try_get_semantic_index_cache(path, content_hash)

      if (cached) {
        // Cache hit: load from cache
        this.populate_registries_from_semantic_index(path, cached)
      } else {
        // Cache miss: mark for fresh indexing
        changed_files.add(path)
      }

      // Store content for later use
      this.file_contents.set(path, content)
    }

    // Phase 2: Index changed files
    for (const path of changed_files) {
      const content = this.file_contents.get(path)!
      await this.index_file_and_cache(path, content)
    }

    // Phase 3: Compute affected files for resolution
    const affected_files = this.compute_affected_files(changed_files)

    // Phase 4: Load/resolve resolutions
    for (const { path } of files) {
      if (affected_files.has(path)) {
        // Affected: resolve fresh
        await this.resolve_file_and_cache(path)
      } else {
        // Unaffected: try loading from cache
        const content_hash = hash_content(this.file_contents.get(path)!)
        const cached = await this.try_get_resolution_cache(path, content_hash)

        if (cached) {
          this.load_resolutions_from_cache(path, cached)
        } else {
          // Cache miss: resolve fresh
          await this.resolve_file_and_cache(path)
        }
      }
    }
  }

  // Existing method: Update single file (modified)
  async update_file(file_path: FilePath, content: string): Promise<void> {
    const content_hash = hash_content(content)

    // Phase 0: Track dependents before updates
    const dependents = this.imports.get_dependents(file_path)

    // Phase 1: Index the changed file
    await this.index_file_and_cache(file_path, content)

    // Phase 2: Compute affected files
    const affected_files = new Set([file_path, ...dependents])

    // Phase 3: Re-resolve affected files
    for (const affected of affected_files) {
      await this.resolve_file_and_cache(affected)
    }
  }

  // Helper: Try to get semantic index from cache
  private async try_get_semantic_index_cache(
    file_path: FilePath,
    content_hash: string
  ): Promise<SemanticIndex | null> {
    if (!this.cache) return null

    const entry = await this.cache.get<SemanticIndexCacheEntry>(
      'semantic_indexes',
      file_path
    )

    if (!entry) return null

    // Validate cache entry
    if (entry.content_hash !== content_hash) return null
    if (entry.schema_version !== CACHE_SCHEMA_VERSION) return null

    return deserialize_semantic_index(entry.semantic_index)
  }

  // Helper: Index file and update cache
  private async index_file_and_cache(file_path: FilePath, content: string): Promise<void> {
    const content_hash = hash_content(content)

    // Index file (existing logic)
    const semantic_index = this.build_semantic_index(file_path, content)
    this.populate_registries_from_semantic_index(file_path, semantic_index)

    // Update cache
    if (this.cache) {
      const entry: SemanticIndexCacheEntry = {
        content_hash,
        schema_version: CACHE_SCHEMA_VERSION,
        semantic_index: serialize_semantic_index(semantic_index),
      }
      await this.cache.set('semantic_indexes', file_path, entry)
    }
  }

  // Helper: Try to get resolutions from cache
  private async try_get_resolution_cache(
    file_path: FilePath,
    content_hash: string
  ): Promise<ResolutionCacheEntry | null> {
    if (!this.cache) return null

    const entry = await this.cache.get<ResolutionCacheEntry>('resolutions', file_path)

    if (!entry) return null
    if (entry.content_hash !== content_hash) return null
    if (entry.schema_version !== CACHE_SCHEMA_VERSION) return null

    return entry
  }

  // Helper: Resolve file and update cache
  private async resolve_file_and_cache(file_path: FilePath): Promise<void> {
    const content = this.file_contents.get(file_path)
    if (!content) return

    const content_hash = hash_content(content)

    // Resolve file (existing logic)
    this.resolutions.resolve_names(new Set([file_path]), /* ... */)
    this.resolutions.resolve_calls_for_files(new Set([file_path]), /* ... */)

    // Update cache
    if (this.cache) {
      const entry: ResolutionCacheEntry = {
        content_hash,
        schema_version: CACHE_SCHEMA_VERSION,
        name_resolutions: this.get_serialized_name_resolutions(file_path),
        call_resolutions: this.get_serialized_call_resolutions(file_path),
      }
      await this.cache.set('resolutions', file_path, entry)
    }
  }

  // Helper: Compute affected files from changed files
  private compute_affected_files(changed_files: Set<FilePath>): Set<FilePath> {
    const affected = new Set<FilePath>()

    for (const changed of changed_files) {
      affected.add(changed)
      for (const dependent of this.imports.get_dependents(changed)) {
        affected.add(dependent)
      }
    }

    return affected
  }

  // Helper: Load resolutions from cache
  private load_resolutions_from_cache(file_path: FilePath, entry: ResolutionCacheEntry): void {
    const name_resolutions = deserialize_name_resolutions(entry.name_resolutions)
    const call_resolutions = deserialize_call_resolutions(entry.call_resolutions)

    this.resolutions.load_from_cache(file_path, name_resolutions, call_resolutions)
  }

  // Cleanup
  async close(): Promise<void> {
    if (this.cache) {
      await this.cache.close()
    }
  }
}
```

### 3. ResolutionRegistry Updates

Add method to load cached resolutions:

```typescript
// In resolution_registry.ts

/**
 * Load pre-computed resolutions from cache.
 */
load_from_cache(
  file_path: FilePath,
  name_resolutions: Map<ScopeId, Map<SymbolName, SymbolId>>,
  call_resolutions: CallReference[]
): void {
  // Store name resolutions
  for (const [scope_id, names] of name_resolutions) {
    this.resolutions_by_scope.set(scope_id, names)
    this.scope_to_file.set(scope_id, file_path)
  }

  // Store call resolutions
  this.resolved_calls_by_file.set(file_path, call_resolutions)

  // Index by caller scope
  for (const call of call_resolutions) {
    if (call.caller_scope_id) {
      const scope_calls = this.calls_by_caller_scope.get(call.caller_scope_id) ?? []
      scope_calls.push(call)
      this.calls_by_caller_scope.set(call.caller_scope_id, scope_calls)
    }
  }
}

/**
 * Get name resolutions for a file (for caching).
 */
get_name_resolutions_for_file(file_path: FilePath): Map<ScopeId, Map<SymbolName, SymbolId>> {
  const result = new Map<ScopeId, Map<SymbolName, SymbolId>>()

  for (const [scope_id, file] of this.scope_to_file) {
    if (file === file_path) {
      const names = this.resolutions_by_scope.get(scope_id)
      if (names) {
        result.set(scope_id, names)
      }
    }
  }

  return result
}
```

## Files to Modify

- `packages/core/src/project/project.ts` - Main integration
- `packages/core/src/resolve_references/resolution_registry.ts` - Add cache loading

## Acceptance Criteria

- [ ] `ProjectOptions` includes optional `cache_provider`
- [ ] `load_with_cache()` method implemented
- [ ] `update_file()` updates cache after changes
- [ ] Cache hits skip expensive re-computation
- [ ] Changed files computed correctly on load
- [ ] Affected files computed correctly (changed + dependents)
- [ ] `close()` method cleans up cache

## Testing

### Unit Tests

- [ ] Project uses provided cache provider
- [ ] Project uses default InMemoryCacheProvider when none provided
- [ ] `disable_cache: true` disables caching

### Integration Tests

- [ ] Full cache hit: Load project, no files changed, all from cache
- [ ] Partial cache hit: Load project, 1 file changed, others from cache
- [ ] Cache miss: Load project with stale cache, full rebuild
- [ ] Schema version mismatch invalidates cache
- [ ] Incremental update: Edit file, dependents re-resolved
- [ ] Dependents correctly identified via ImportGraph

### Performance Tests

- [ ] Measure startup time with full cache hit vs cold start
- [ ] Verify cache actually reduces work (mock build_semantic_index calls)
