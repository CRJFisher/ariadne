---
id: task-160.5
title: Example disk-based cache provider
status: To Do
assignee: []
created_date: '2025-11-24'
labels: [performance, architecture]
dependencies: [task-160.1]
parent_task_id: task-160
---

## Description

Implement an example filesystem-based cache provider that persists cache data to disk. This serves as:

1. A working example for users who want persistent caching
2. Documentation of how to implement custom cache providers
3. A reference implementation for more advanced backends (SQLite, Redis, etc.)

## Design

Store each cache entry as a JSON file:

```
.ariadne-cache/
  semantic_indexes/
    src_utils.ts.json
    src_app.ts.json
  resolutions/
    src_utils.ts.json
    src_app.ts.json
  metadata/
    schema_version.json
```

File names are derived from the cache key (file paths with `/` replaced by `_`).

## Deliverables

### FileSystemCacheProvider Implementation

```typescript
// packages/core/src/cache/filesystem_cache.ts

import { mkdir, readFile, writeFile, unlink, readdir, rm } from 'fs/promises'
import { join, dirname } from 'path'
import type { CacheProvider } from './cache_provider'

export interface FileSystemCacheOptions {
  /** Directory to store cache files. Default: '.ariadne-cache' */
  cache_dir?: string
}

/**
 * Filesystem-based cache provider.
 * Persists cache data as JSON files for cross-session caching.
 */
export class FileSystemCacheProvider implements CacheProvider {
  private readonly cache_dir: string

  constructor(options?: FileSystemCacheOptions) {
    this.cache_dir = options?.cache_dir ?? '.ariadne-cache'
  }

  private get_file_path(namespace: string, key: string): string {
    // Sanitize key for filesystem
    const safe_key = key.replace(/[/\\:*?"<>|]/g, '_')
    return join(this.cache_dir, namespace, `${safe_key}.json`)
  }

  private async ensure_dir(file_path: string): Promise<void> {
    const dir = dirname(file_path)
    await mkdir(dir, { recursive: true })
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const file_path = this.get_file_path(namespace, key)

    try {
      const content = await readFile(file_path, 'utf-8')
      return JSON.parse(content) as T
    } catch (error: unknown) {
      // File not found or parse error
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      // Log parse errors but don't throw
      console.warn(`Cache read error for ${key}:`, error)
      return null
    }
  }

  async set<T>(namespace: string, key: string, value: T): Promise<void> {
    const file_path = this.get_file_path(namespace, key)

    try {
      await this.ensure_dir(file_path)
      const content = JSON.stringify(value, null, 2)
      await writeFile(file_path, content, 'utf-8')
    } catch (error) {
      // Log write errors but don't throw
      console.warn(`Cache write error for ${key}:`, error)
    }
  }

  async delete(namespace: string, key: string): Promise<void> {
    const file_path = this.get_file_path(namespace, key)

    try {
      await unlink(file_path)
    } catch (error: unknown) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Cache delete error for ${key}:`, error)
      }
    }
  }

  async clear(namespace: string): Promise<void> {
    const namespace_dir = join(this.cache_dir, namespace)

    try {
      await rm(namespace_dir, { recursive: true, force: true })
    } catch (error) {
      console.warn(`Cache clear error for namespace ${namespace}:`, error)
    }
  }

  async get_many<T>(namespace: string, keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>()

    // Read files in parallel
    const promises = keys.map(async (key) => {
      const value = await this.get<T>(namespace, key)
      if (value !== null) {
        result.set(key, value)
      }
    })

    await Promise.all(promises)
    return result
  }

  async set_many<T>(namespace: string, entries: Map<string, T>): Promise<void> {
    // Write files in parallel
    const promises = Array.from(entries.entries()).map(([key, value]) =>
      this.set(namespace, key, value)
    )

    await Promise.all(promises)
  }

  async close(): Promise<void> {
    // Nothing to close for filesystem
  }

  // Additional helpers

  /**
   * Get list of cached keys in a namespace.
   */
  async list_keys(namespace: string): Promise<string[]> {
    const namespace_dir = join(this.cache_dir, namespace)

    try {
      const files = await readdir(namespace_dir)
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5))  // Remove .json extension
    } catch {
      return []
    }
  }

  /**
   * Clear all namespaces.
   */
  async clear_all(): Promise<void> {
    try {
      await rm(this.cache_dir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Cache clear all error:', error)
    }
  }

  /**
   * Get total size of cache in bytes.
   */
  async get_total_size(): Promise<number> {
    // Implementation left as exercise - would recursively stat all files
    return 0
  }
}
```

## Usage Example

```typescript
import { Project, FileSystemCacheProvider } from '@ariadnejs/core'

// Use filesystem cache for persistent caching
const cache = new FileSystemCacheProvider({
  cache_dir: '.ariadne-cache'
})

const project = new Project({
  cache_provider: cache
})

// Load project - will use disk cache if available
await project.load_with_cache(files)

// ... work with project ...

// Clean up
await project.close()
```

## Documentation Section

Add to main task-160 or README:

```markdown
## Custom Cache Providers

Ariadne supports pluggable cache backends. Implement the `CacheProvider` interface:

\`\`\`typescript
interface CacheProvider {
  get<T>(namespace: string, key: string): Promise<T | null>
  set<T>(namespace: string, key: string, value: T): Promise<void>
  delete(namespace: string, key: string): Promise<void>
  clear(namespace: string): Promise<void>
  get_many<T>(namespace: string, keys: string[]): Promise<Map<string, T>>
  set_many<T>(namespace: string, entries: Map<string, T>): Promise<void>
  close(): Promise<void>
}
\`\`\`

### Built-in Providers

- `InMemoryCacheProvider` (default) - Fast, no persistence
- `FileSystemCacheProvider` - Persists to disk as JSON files

### Custom Provider Examples

**SQLite:**
\`\`\`typescript
class SQLiteCacheProvider implements CacheProvider {
  private db: Database

  constructor(db_path: string) {
    this.db = new Database(db_path)
    this.db.exec(\`
      CREATE TABLE IF NOT EXISTS cache (
        namespace TEXT,
        key TEXT,
        value TEXT,
        PRIMARY KEY (namespace, key)
      )
    \`)
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const row = this.db.prepare(
      'SELECT value FROM cache WHERE namespace = ? AND key = ?'
    ).get(namespace, key)
    return row ? JSON.parse(row.value) : null
  }

  // ... other methods ...
}
\`\`\`

**Redis:**
\`\`\`typescript
class RedisCacheProvider implements CacheProvider {
  private client: RedisClient

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const value = await this.client.get(\`\${namespace}:\${key}\`)
    return value ? JSON.parse(value) : null
  }

  // ... other methods ...
}
\`\`\`
```

## Files to Create

- `packages/core/src/cache/filesystem_cache.ts`

## Files to Modify

- `packages/core/src/cache/index.ts` (add export)

## Acceptance Criteria

- [ ] `FileSystemCacheProvider` implements `CacheProvider` interface
- [ ] Cache files stored in configurable directory
- [ ] JSON format for human readability and debugging
- [ ] Handles file system errors gracefully (no throws)
- [ ] Parallel reads/writes for batch operations
- [ ] Helper methods for listing keys and clearing all
- [ ] Documentation for custom provider implementation

## Testing

- [ ] Basic get/set/delete operations
- [ ] Clear removes namespace directory
- [ ] get_many/set_many work correctly
- [ ] Handles missing files gracefully
- [ ] Handles invalid JSON gracefully
- [ ] File path sanitization works (special characters)
- [ ] Works with real Project integration
