# Custom Storage Providers

AriadneJS supports pluggable storage backends to handle large codebases efficiently. This guide explains how to implement your own storage provider.

## Overview

The storage interface allows you to implement custom backends like:
- Disk-based storage for reduced memory usage
- Database storage (SQLite, PostgreSQL, etc.)
- Distributed caching (Redis, etc.)
- Cloud storage (S3, etc.)

## Storage Interface

Your storage provider must implement either `StorageInterface` (async) or `StorageInterfaceSync` (sync).

### Async Storage Interface

```typescript
import { StorageInterface, ProjectState, StorageTransaction } from '@ariadnejs/core';

class MyCustomStorage implements StorageInterface {
  async initialize(): Promise<void> {
    // Initialize your storage backend
  }
  
  async getState(): Promise<ProjectState> {
    // Return the complete project state
  }
  
  async setState(state: ProjectState): Promise<void> {
    // Replace the entire state
  }
  
  async beginTransaction(): Promise<StorageTransaction> {
    // Start a new transaction
  }
  
  // ... other required methods
}
```

### Sync Storage Interface

```typescript
import { StorageInterfaceSync, ProjectState } from '@ariadnejs/core';

class MySyncStorage implements StorageInterfaceSync {
  initialize(): void {
    // Initialize your storage backend
  }
  
  getState(): ProjectState {
    // Return the complete project state
  }
  
  // ... other required methods
}
```

## Example: SQLite Storage Provider

Here's a complete example of a SQLite-based storage provider:

```typescript
import { StorageInterfaceSync, ProjectState, StorageTransactionSync } from '@ariadnejs/core';
import Database from 'better-sqlite3';

export class SQLiteStorage implements StorageInterfaceSync {
  private db: Database.Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.setupTables();
  }
  
  private setupTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_cache (
        file_path TEXT PRIMARY KEY,
        source_code TEXT NOT NULL,
        tree BLOB NOT NULL,
        graph BLOB NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS project_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
  
  initialize(): void {
    // Already initialized in constructor
  }
  
  getState(): ProjectState {
    // Reconstruct state from database
    const state: ProjectState = {
      file_graphs: new Map(),
      file_cache: new Map(),
      languages: this.getLanguages(),
      inheritance_map: new Map(),
      call_graph_data: this.getCallGraphData()
    };
    
    // Load file data
    const files = this.db.prepare('SELECT * FROM file_cache').all();
    for (const file of files) {
      // Deserialize and add to state
      // ... deserialization logic
    }
    
    return state;
  }
  
  setState(state: ProjectState): void {
    // Clear existing data
    this.db.exec('DELETE FROM file_cache');
    
    // Store new state
    const insertFile = this.db.prepare(
      'INSERT INTO file_cache (file_path, source_code, tree, graph) VALUES (?, ?, ?, ?)'
    );
    
    for (const [filePath, cache] of state.file_cache) {
      insertFile.run(
        filePath,
        cache.source_code,
        this.serializeTree(cache.tree),
        this.serializeGraph(cache.graph)
      );
    }
  }
  
  beginTransaction(): StorageTransactionSync {
    return new SQLiteTransaction(this.db);
  }
  
  // ... implement other required methods
  
  close(): void {
    this.db.close();
  }
}
```

## Registering Your Storage Provider

Register your storage provider so it can be used:

```typescript
import { registerStorageProvider } from '@ariadnejs/core';
import { SQLiteStorage } from './sqlite-storage';

// Register the provider
registerStorageProvider('sqlite', async (options) => {
  const storage = new SQLiteStorage(options.dbPath);
  // If your storage is sync, wrap it in the adapter
  return new SyncToAsyncStorageAdapter(storage);
});
```

## Using Custom Storage

### With ImmutableProject

```typescript
import { ImmutableProject, createStorage } from '@ariadnejs/core';

// Create storage instance
const storage = await createStorage('sqlite', { dbPath: './project.db' });

// Use with ImmutableProject
const project = new ImmutableProject(storage);
```

### With Legacy Project Class

```typescript
import { Project } from '@ariadnejs/core';

// The legacy Project class uses in-memory storage by default
// To use custom storage, use ImmutableProject instead
```

## Performance Considerations

1. **Batch Operations**: Implement batch operations to reduce round trips
2. **Caching**: Cache frequently accessed data in memory
3. **Indexing**: Create indexes for common queries
4. **Compression**: Compress large data structures before storage
5. **Lazy Loading**: Load data on-demand rather than all at once

## Transaction Support

Transactions ensure atomic updates:

```typescript
class MyTransaction implements StorageTransactionSync {
  private tempState: ProjectState;
  private committed = false;
  
  commit(): void {
    if (this.committed) throw new Error('Already committed');
    // Apply changes atomically
    this.storage.applyChanges(this.tempState);
    this.committed = true;
  }
  
  rollback(): void {
    // Discard changes
    this.tempState = null;
  }
}
```

## Testing Your Storage Provider

```typescript
import { describe, test, expect } from 'vitest';
import { MyCustomStorage } from './my-storage';

describe('MyCustomStorage', () => {
  test('stores and retrieves files', () => {
    const storage = new MyCustomStorage();
    storage.initialize();
    
    // Test your implementation
    const initialState = storage.getState();
    expect(initialState.file_graphs.size).toBe(0);
    
    // ... more tests
  });
});
```

## Best Practices

1. **Immutability**: Never modify state objects directly
2. **Error Handling**: Handle storage failures gracefully
3. **Cleanup**: Implement proper cleanup in `close()`
4. **Validation**: Validate data integrity on read/write
5. **Documentation**: Document storage-specific options

## Common Patterns

### Key Generation
Use consistent keys for storing data:
```typescript
function getFileKey(filePath: string): string {
  return `file:${filePath}`;
}
```

### Serialization
Handle tree-sitter objects carefully:
```typescript
function serializeTree(tree: Tree): Buffer {
  // Tree-sitter trees contain native bindings
  // Store the source and reparse instead
  return Buffer.from(tree.rootNode.text);
}
```

### State Reconstruction
Efficiently rebuild complex objects:
```typescript
function deserializeGraph(data: string): ScopeGraph {
  const parsed = JSON.parse(data);
  // Reconstruct ScopeGraph instance
  return ScopeGraph.fromJSON(parsed);
}
```