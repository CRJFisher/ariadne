---
id: task-160.1
title: Cache interface and types
status: To Do
assignee: []
created_date: '2025-11-24'
labels: [performance, architecture]
dependencies: []
parent_task_id: task-160
---

## Description

Define the foundational types and interfaces for the caching system. This includes the pluggable `CacheProvider` interface, cache entry types, and utility functions.

## Deliverables

### 1. CacheProvider Interface

```typescript
// packages/core/src/cache/cache_provider.ts

/**
 * Pluggable cache backend interface.
 * Users can implement custom providers (SQLite, filesystem, Redis, etc.)
 */
export interface CacheProvider {
  /**
   * Get a cached value by namespace and key.
   * Returns null if not found or expired.
   */
  get<T>(namespace: string, key: string): Promise<T | null>

  /**
   * Set a cached value.
   */
  set<T>(namespace: string, key: string, value: T): Promise<void>

  /**
   * Delete a cached value.
   */
  delete(namespace: string, key: string): Promise<void>

  /**
   * Clear all values in a namespace.
   */
  clear(namespace: string): Promise<void>

  /**
   * Get multiple values in a single call (batch optimization).
   */
  get_many<T>(namespace: string, keys: string[]): Promise<Map<string, T>>

  /**
   * Set multiple values in a single call (batch optimization).
   */
  set_many<T>(namespace: string, entries: Map<string, T>): Promise<void>

  /**
   * Clean up resources (close connections, flush buffers, etc.)
   */
  close(): Promise<void>
}

/**
 * Cache namespaces for logical separation.
 */
export type CacheNamespace = 'semantic_indexes' | 'resolutions' | 'metadata'
```

### 2. Cache Entry Types

```typescript
// packages/core/src/cache/cache_types.ts

import type { FilePath } from '@ariadnejs/types'

/**
 * Current schema version for cache invalidation.
 * Increment this when making breaking changes to cached data structures.
 */
export const CACHE_SCHEMA_VERSION = '1.0.0'

/**
 * Cached semantic index for a single file.
 */
export interface SemanticIndexCacheEntry {
  /** SHA-256 hash of file content */
  content_hash: string
  /** Schema version when this entry was created */
  schema_version: string
  /** Serialized semantic index data */
  semantic_index: SerializedSemanticIndex
}

/**
 * Cached resolutions for a single file.
 */
export interface ResolutionCacheEntry {
  /** SHA-256 hash of file content */
  content_hash: string
  /** Schema version when this entry was created */
  schema_version: string
  /** Serialized name resolutions */
  name_resolutions: SerializedNameResolutions
  /** Serialized call resolutions */
  call_resolutions: SerializedCallReferences
}

/**
 * Serialized semantic index (Maps converted to arrays for JSON compatibility).
 */
export interface SerializedSemanticIndex {
  file_path: string
  language: string
  root_scope_id: string
  scopes: Array<[string, SerializedLexicalScope]>
  functions: Array<[string, unknown]>
  classes: Array<[string, unknown]>
  variables: Array<[string, unknown]>
  interfaces: Array<[string, unknown]>
  enums: Array<[string, unknown]>
  namespaces: Array<[string, unknown]>
  types: Array<[string, unknown]>
  imported_symbols: Array<[string, unknown]>
  references: unknown[]
}

/**
 * Serialized name resolutions.
 */
export interface SerializedNameResolutions {
  /** Array of [ScopeId, Array<[SymbolName, SymbolId]>] */
  resolutions_by_scope: Array<[string, Array<[string, string]>]>
}

/**
 * Serialized call references.
 */
export interface SerializedCallReferences {
  calls: unknown[]
}

/**
 * Serialized lexical scope.
 */
export interface SerializedLexicalScope {
  scope_id: string
  parent_scope_id: string | null
  scope_type: string
  location: unknown
  children: string[]
}
```

### 3. Content Hashing Utility

```typescript
// packages/core/src/cache/hash_utils.ts

import { createHash } from 'crypto'

/**
 * Compute SHA-256 hash of file content.
 * Used for cache key generation and invalidation detection.
 */
export function hash_content(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * Compute hash of multiple strings (for composite keys).
 */
export function hash_composite(...parts: string[]): string {
  const hash = createHash('sha256')
  for (const part of parts) {
    hash.update(part, 'utf8')
    hash.update('\0', 'utf8')  // Separator to avoid collisions
  }
  return hash.digest('hex')
}
```

### 4. Barrel Export

```typescript
// packages/core/src/cache/index.ts

export type { CacheProvider, CacheNamespace } from './cache_provider'
export {
  CACHE_SCHEMA_VERSION,
  type SemanticIndexCacheEntry,
  type ResolutionCacheEntry,
  type SerializedSemanticIndex,
  type SerializedNameResolutions,
  type SerializedCallReferences,
  type SerializedLexicalScope,
} from './cache_types'
export { hash_content, hash_composite } from './hash_utils'
```

## Files to Create

- `packages/core/src/cache/cache_provider.ts`
- `packages/core/src/cache/cache_types.ts`
- `packages/core/src/cache/hash_utils.ts`
- `packages/core/src/cache/index.ts`

## Acceptance Criteria

- [ ] `CacheProvider` interface defined with all methods
- [ ] `SemanticIndexCacheEntry` and `ResolutionCacheEntry` types defined
- [ ] `CACHE_SCHEMA_VERSION` constant defined
- [ ] `hash_content()` utility implemented
- [ ] All types exported from barrel
- [ ] JSDoc documentation for all public types and functions

## Testing

- [ ] Unit test for `hash_content()` - consistent output for same input
- [ ] Unit test for `hash_content()` - different output for different input
- [ ] Unit test for `hash_composite()` - order matters
