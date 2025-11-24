---
id: task-160.3
title: In-memory cache provider
status: To Do
assignee: []
created_date: '2025-11-24'
labels: [performance, architecture]
dependencies: [task-160.1]
parent_task_id: task-160
---

## Description

Implement the default in-memory cache provider with LRU (Least Recently Used) eviction. This provider stores cached data in memory and is the default when no custom provider is configured.

## Design Goals

- Zero external dependencies
- Configurable memory limits
- LRU eviction when limits exceeded
- Efficient batch operations
- Thread-safe (though Node.js is single-threaded, async operations should be safe)

## Deliverables

### 1. LRU Cache Implementation

```typescript
// packages/core/src/cache/lru_cache.ts

/**
 * Simple LRU cache with configurable max entries.
 * Uses Map's insertion order for LRU tracking.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>
  private readonly max_entries: number

  constructor(max_entries: number) {
    this.cache = new Map()
    this.max_entries = max_entries
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    // If key exists, delete first to update insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    this.cache.set(key, value)

    // Evict oldest entries if over limit
    while (this.cache.size > this.max_entries) {
      const oldest_key = this.cache.keys().next().value
      this.cache.delete(oldest_key)
    }
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  get size(): number {
    return this.cache.size
  }

  keys(): IterableIterator<K> {
    return this.cache.keys()
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries()
  }
}
```

### 2. In-Memory Cache Provider

```typescript
// packages/core/src/cache/in_memory_cache.ts

import type { CacheProvider } from './cache_provider'
import { LRUCache } from './lru_cache'

export interface InMemoryCacheOptions {
  /** Maximum entries per namespace. Default: 1000 */
  max_entries_per_namespace?: number
}

/**
 * Default cache provider using in-memory LRU caches.
 * No persistence across process restarts.
 */
export class InMemoryCacheProvider implements CacheProvider {
  private caches: Map<string, LRUCache<string, unknown>>
  private readonly max_entries: number

  constructor(options?: InMemoryCacheOptions) {
    this.caches = new Map()
    this.max_entries = options?.max_entries_per_namespace ?? 1000
  }

  private get_or_create_cache(namespace: string): LRUCache<string, unknown> {
    let cache = this.caches.get(namespace)
    if (!cache) {
      cache = new LRUCache<string, unknown>(this.max_entries)
      this.caches.set(namespace, cache)
    }
    return cache
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const cache = this.caches.get(namespace)
    if (!cache) return null

    const value = cache.get(key)
    return value !== undefined ? (value as T) : null
  }

  async set<T>(namespace: string, key: string, value: T): Promise<void> {
    const cache = this.get_or_create_cache(namespace)
    cache.set(key, value)
  }

  async delete(namespace: string, key: string): Promise<void> {
    const cache = this.caches.get(namespace)
    if (cache) {
      cache.delete(key)
    }
  }

  async clear(namespace: string): Promise<void> {
    const cache = this.caches.get(namespace)
    if (cache) {
      cache.clear()
    }
  }

  async get_many<T>(namespace: string, keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>()
    const cache = this.caches.get(namespace)

    if (cache) {
      for (const key of keys) {
        const value = cache.get(key)
        if (value !== undefined) {
          result.set(key, value as T)
        }
      }
    }

    return result
  }

  async set_many<T>(namespace: string, entries: Map<string, T>): Promise<void> {
    const cache = this.get_or_create_cache(namespace)

    for (const [key, value] of entries) {
      cache.set(key, value)
    }
  }

  async close(): Promise<void> {
    // Clear all caches
    this.caches.clear()
  }

  // Debug/testing helpers

  /**
   * Get statistics for a namespace.
   */
  get_stats(namespace: string): { entries: number; max_entries: number } | null {
    const cache = this.caches.get(namespace)
    if (!cache) return null

    return {
      entries: cache.size,
      max_entries: this.max_entries,
    }
  }

  /**
   * Get all namespaces.
   */
  get_namespaces(): string[] {
    return Array.from(this.caches.keys())
  }
}
```

## Files to Create

- `packages/core/src/cache/lru_cache.ts`
- `packages/core/src/cache/in_memory_cache.ts`

## Files to Modify

- `packages/core/src/cache/index.ts` (add exports)

## Acceptance Criteria

- [ ] `LRUCache` class implemented with get/set/delete/clear
- [ ] LRU eviction works correctly (oldest entries removed first)
- [ ] `InMemoryCacheProvider` implements `CacheProvider` interface
- [ ] Batch operations (`get_many`, `set_many`) implemented
- [ ] Configurable max entries per namespace
- [ ] All methods are async (for interface compliance)
- [ ] Debug helpers (`get_stats`, `get_namespaces`) implemented

## Testing

### LRU Cache Tests

- [ ] Basic get/set/delete operations
- [ ] LRU eviction: oldest entry removed when over limit
- [ ] Access updates recency: recently accessed items not evicted
- [ ] Clear removes all entries
- [ ] Size tracking is accurate

### InMemoryCacheProvider Tests

- [ ] Implements all CacheProvider methods
- [ ] Namespaces are isolated (key in ns1 doesn't affect ns2)
- [ ] get returns null for missing keys
- [ ] get_many returns only found entries
- [ ] set_many sets all entries
- [ ] close clears all data
- [ ] Stats are accurate
