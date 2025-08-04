# Storage Providers

AriadneJS uses a pluggable storage interface to handle project state management. This allows you to customize how data is stored based on your needs.

## Available Providers

- **memory** (default) - Stores all data in memory. Fast but uses more RAM.
- **disk** (example) - Stores data on disk to reduce memory usage.

## Using a Storage Provider

```typescript
import { ImmutableProject, createStorage } from '@ariadnejs/core';

// Use default in-memory storage
const project1 = new ImmutableProject();

// Use disk storage
const storage = await createStorage('disk', { storageDir: './cache' });
const project2 = new ImmutableProject(storage);
```

## Creating Custom Providers

See [docs/custom-storage-providers.md](../../docs/custom-storage-providers.md) for a complete guide.

Quick example:

```typescript
import { StorageInterface, registerStorageProvider } from '@ariadnejs/core';

class MyStorage implements StorageInterface {
  // Implement required methods
}

// Register your provider
registerStorageProvider('my-storage', async (options) => {
  return new MyStorage(options);
});

// Use it
const storage = await createStorage('my-storage', { /* options */ });
```