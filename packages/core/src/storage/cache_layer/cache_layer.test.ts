import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CacheLayer, create_cache_layer } from './cache_layer';
import { StorageInterface, StorageTransaction, StoredFile, ProjectState, create_empty_state } from '../storage_interface';

// Mock storage backend
class MockStorage implements StorageInterface {
  private state: ProjectState = create_empty_state();
  private files = new Map<string, StoredFile>();
  public call_counts = {
    get_state: 0,
    set_state: 0,
    get_file: 0,
    update_file: 0,
    remove_file: 0,
    list_files: 0,
    begin_transaction: 0,
    initialize: 0,
    close: 0
  };

  async initialize(): Promise<void> {
    this.call_counts.initialize++;
  }

  async get_state(): Promise<ProjectState> {
    this.call_counts.get_state++;
    return this.state;
  }

  async set_state(state: ProjectState): Promise<void> {
    this.call_counts.set_state++;
    this.state = state;
  }

  async get_file(file_path: string): Promise<StoredFile | undefined> {
    this.call_counts.get_file++;
    return this.files.get(file_path);
  }

  async update_file(file: StoredFile): Promise<void> {
    this.call_counts.update_file++;
    this.files.set(file.file_path, file);
  }

  async remove_file(file_path: string): Promise<void> {
    this.call_counts.remove_file++;
    this.files.delete(file_path);
  }

  async list_files(): Promise<string[]> {
    this.call_counts.list_files++;
    return Array.from(this.files.keys());
  }

  async begin_transaction(): Promise<StorageTransaction> {
    this.call_counts.begin_transaction++;
    const tx_state = { ...this.state };
    const tx_files = new Map(this.files);
    
    return {
      get_state: async () => tx_state,
      set_state: async (state: ProjectState) => { Object.assign(tx_state, state); },
      update_file: async (file: StoredFile) => { tx_files.set(file.file_path, file); },
      remove_file: async (file_path: string) => { tx_files.delete(file_path); },
      commit: async () => {
        this.state = tx_state;
        this.files = tx_files;
      },
      rollback: async () => {}
    };
  }

  async close(): Promise<void> {
    this.call_counts.close++;
  }

  reset_counts(): void {
    for (const key in this.call_counts) {
      this.call_counts[key as keyof typeof this.call_counts] = 0;
    }
  }
}

describe('CacheLayer', () => {
  let mockStorage: MockStorage;
  let cacheLayer: CacheLayer;

  beforeEach(() => {
    mockStorage = new MockStorage();
    cacheLayer = new CacheLayer(mockStorage, { ttl_ms: 1000 });
  });

  test('initializes backend storage', async () => {
    await cacheLayer.initialize();
    expect(mockStorage.call_counts.initialize).toBe(1);
  });

  test('caches state on first get', async () => {
    await cacheLayer.get_state();
    expect(mockStorage.call_counts.get_state).toBe(1);
    
    // Second call should use cache
    await cacheLayer.get_state();
    expect(mockStorage.call_counts.get_state).toBe(1);
  });

  test('updates state cache on set', async () => {
    // Get state to populate cache
    await cacheLayer.get_state();
    expect(mockStorage.call_counts.get_state).toBe(1);
    
    // Set new state
    const newState = create_empty_state();
    newState.metadata = { updated: true };
    await cacheLayer.set_state(newState);
    
    // Next get should use updated cache, not fetch from backend
    const cachedState = await cacheLayer.get_state();
    expect(mockStorage.call_counts.get_state).toBe(1); // Still 1, using cache
    expect(cachedState.metadata).toEqual({ updated: true });
  });

  test('caches files on get', async () => {
    const file: StoredFile = {
      file_path: 'test.ts',
      content: 'const x = 1;',
      hash: 'abc123',
      last_modified: Date.now()
    };
    
    await mockStorage.update_file(file);
    mockStorage.reset_counts();
    
    // First get fetches from backend
    const result1 = await cacheLayer.get_file('test.ts');
    expect(result1).toEqual(file);
    expect(mockStorage.call_counts.get_file).toBe(1);
    
    // Second get uses cache
    const result2 = await cacheLayer.get_file('test.ts');
    expect(result2).toEqual(file);
    expect(mockStorage.call_counts.get_file).toBe(1);
  });

  test('updates file cache on update', async () => {
    const file: StoredFile = {
      file_path: 'test.ts',
      content: 'const x = 1;',
      hash: 'abc123',
      last_modified: Date.now()
    };
    
    await cacheLayer.update_file(file);
    
    // Should be in cache immediately
    mockStorage.reset_counts();
    const cached = await cacheLayer.get_file('test.ts');
    expect(cached).toEqual(file);
    expect(mockStorage.call_counts.get_file).toBe(0); // Should use cache
  });

  test('removes file from cache on remove', async () => {
    const file: StoredFile = {
      file_path: 'test.ts',
      content: 'const x = 1;',
      hash: 'abc123',
      last_modified: Date.now()
    };
    
    await cacheLayer.update_file(file);
    await cacheLayer.remove_file('test.ts');
    
    // Should not be in cache
    mockStorage.reset_counts();
    const result = await cacheLayer.get_file('test.ts');
    expect(result).toBeUndefined();
    expect(mockStorage.call_counts.get_file).toBe(1); // Had to check backend
  });

  test('TTL expiration works', async () => {
    const cache = new CacheLayer(mockStorage, { ttl_ms: 100 }); // 100ms TTL
    
    await cache.get_state();
    expect(mockStorage.call_counts.get_state).toBe(1);
    
    // Within TTL - should use cache
    await cache.get_state();
    expect(mockStorage.call_counts.get_state).toBe(1);
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // After TTL - should fetch from backend
    await cache.get_state();
    expect(mockStorage.call_counts.get_state).toBe(2);
  });

  test('LRU eviction when cache is full', async () => {
    const cache = new CacheLayer(mockStorage, { 
      max_file_cache_size: 3,
      ttl_ms: 10000 // Long TTL so we test eviction, not expiration
    });
    
    // Add 4 files to trigger eviction on the 4th
    const files: StoredFile[] = [];
    for (let i = 1; i <= 4; i++) {
      const file = {
        file_path: `file${i}.ts`,
        content: `content${i}`,
        hash: `hash${i}`,
        last_modified: Date.now()
      };
      files.push(file);
      // Small delay to ensure different timestamps
      if (i < 4) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    // Add first 3 files to both backend and cache
    for (let i = 0; i < 3; i++) {
      await mockStorage.update_file(files[i]);
      await cache.update_file(files[i]);
    }
    
    // Verify cache has 3 files
    let stats = cache.get_cache_stats();
    expect(stats.file_cache_size).toBe(3);
    
    // Add 4th file - should evict the oldest (file1.ts)
    await mockStorage.update_file(files[3]);
    await cache.update_file(files[3]);
    
    // Cache should still have only 3 files
    stats = cache.get_cache_stats();
    expect(stats.file_cache_size).toBe(3);
    
    // file1.ts should have been evicted
    mockStorage.reset_counts();
    const file1 = await cache.get_file('file1.ts');
    expect(file1).toBeDefined();
    expect(mockStorage.call_counts.get_file).toBe(1); // Had to fetch from backend
    
    // file4.ts should be in cache
    const file4 = await cache.get_file('file4.ts');
    expect(file4).toBeDefined();
    expect(mockStorage.call_counts.get_file).toBe(1); // Still just 1, used cache
  });

  describe('Transactions', () => {
    test('transaction clears cache on commit', async () => {
      // Populate cache
      await cacheLayer.get_state();
      expect(mockStorage.call_counts.get_state).toBe(1);
      
      // Begin transaction and commit
      const tx = await cacheLayer.begin_transaction();
      await tx.commit();
      
      // Cache should be cleared, so next get fetches from backend
      await cacheLayer.get_state();
      expect(mockStorage.call_counts.get_state).toBe(2);
    });

    test('transaction does not clear cache on rollback', async () => {
      // Populate cache
      await cacheLayer.get_state();
      expect(mockStorage.call_counts.get_state).toBe(1);
      
      // Begin transaction and rollback
      const tx = await cacheLayer.begin_transaction();
      await tx.rollback();
      
      // Cache should still be valid
      await cacheLayer.get_state();
      expect(mockStorage.call_counts.get_state).toBe(1);
    });

    test('transaction operations work correctly', async () => {
      const tx = await cacheLayer.begin_transaction();
      
      const state = await tx.get_state();
      state.metadata = { in_transaction: true };
      await tx.set_state(state);
      
      await tx.update_file({
        file_path: 'tx-file.ts',
        content: 'transaction content',
        hash: 'txhash',
        last_modified: Date.now()
      });
      
      await tx.remove_file('some-file.ts');
      
      await tx.commit();
      
      // Verify operations were applied
      expect(mockStorage.call_counts.begin_transaction).toBe(1);
    });
  });

  test('clear_cache clears all caches', async () => {
    // Populate file cache
    await cacheLayer.update_file({
      file_path: 'test.ts',
      content: 'content',
      hash: 'hash',
      last_modified: Date.now()
    });
    
    // Populate state cache (after file update since file updates invalidate state cache)
    const state = await cacheLayer.get_state();
    expect(state).toBeDefined();
    
    let stats = cacheLayer.get_cache_stats();
    expect(stats.has_state_cache).toBe(true);
    expect(stats.file_cache_size).toBe(1);
    
    // Clear cache
    cacheLayer.clear_cache();
    
    stats = cacheLayer.get_cache_stats();
    expect(stats.has_state_cache).toBe(false);
    expect(stats.file_cache_size).toBe(0);
  });

  test('close clears cache and closes backend', async () => {
    // Populate caches
    await cacheLayer.get_state();
    await cacheLayer.update_file({
      file_path: 'test.ts',
      content: 'content',
      hash: 'hash',
      last_modified: Date.now()
    });
    
    await cacheLayer.close();
    
    expect(mockStorage.call_counts.close).toBe(1);
    
    const stats = cacheLayer.get_cache_stats();
    expect(stats.has_state_cache).toBe(false);
    expect(stats.file_cache_size).toBe(0);
  });

  test('list_files always queries backend', async () => {
    await cacheLayer.list_files();
    expect(mockStorage.call_counts.list_files).toBe(1);
    
    await cacheLayer.list_files();
    expect(mockStorage.call_counts.list_files).toBe(2);
  });

  test('create_cache_layer factory function works', async () => {
    const cache = create_cache_layer(mockStorage, { ttl_ms: 500 });
    await cache.initialize();
    
    const state = await cache.get_state();
    expect(state).toBeDefined();
    expect(mockStorage.call_counts.initialize).toBe(1);
  });

  test('handles missing files correctly', async () => {
    const result = await cacheLayer.get_file('nonexistent.ts');
    expect(result).toBeUndefined();
    expect(mockStorage.call_counts.get_file).toBe(1);
    
    // Should still check backend even on second call (no caching of undefined)
    const result2 = await cacheLayer.get_file('nonexistent.ts');
    expect(result2).toBeUndefined();
    expect(mockStorage.call_counts.get_file).toBe(2);
  });

  test('state cache invalidated on file operations', async () => {
    // Populate state cache
    await cacheLayer.get_state();
    expect(mockStorage.call_counts.get_state).toBe(1);
    
    // Update a file - should invalidate state cache
    await cacheLayer.update_file({
      file_path: 'new.ts',
      content: 'content',
      hash: 'hash',
      last_modified: Date.now()
    });
    
    // Getting state should fetch from backend
    await cacheLayer.get_state();
    expect(mockStorage.call_counts.get_state).toBe(2);
    
    // Remove a file - should also invalidate state cache
    await cacheLayer.remove_file('new.ts');
    await cacheLayer.get_state();
    expect(mockStorage.call_counts.get_state).toBe(3);
  });
});