/**
 * Storage Interface Contract Tests
 * 
 * This test suite verifies that all storage implementations correctly
 * implement the StorageInterface contract. Each implementation must pass
 * the same set of tests to ensure consistent behavior.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  StorageInterface,
  StoredFile,
  ProjectState,
  create_empty_state,
  add_file_to_state,
  remove_file_from_state,
  update_state_metadata
} from './storage_interface';
import { MemoryStorage, create_memory_storage } from './memory_storage';
import { DiskStorage, create_disk_storage } from './disk_storage';
import { CacheLayer, create_cache_layer } from './cache_layer';

/**
 * Storage implementation factory for testing
 */
interface StorageFactory {
  name: string;
  create: () => Promise<StorageInterface>;
  cleanup?: () => Promise<void>;
}

/**
 * Create test file data
 */
function create_test_file(
  file_path: string,
  content: string = 'const x = 1;'
): StoredFile {
  return {
    file_path,
    source_code: content,
    language: 'javascript',
    last_modified: Date.now(),
    metadata: { test: true }
  };
}

/**
 * Storage contract test suite
 * 
 * This defines the expected behavior for all storage implementations
 */
function run_storage_contract_tests(factory: StorageFactory) {
  describe(`StorageInterface Contract - ${factory.name}`, () => {
    let storage: StorageInterface;

    beforeEach(async () => {
      storage = await factory.create();
      await storage.initialize();
    });

    afterEach(async () => {
      if (storage) {
        await storage.close();
      }
      if (factory.cleanup) {
        await factory.cleanup();
      }
    });

    describe('Initialization', () => {
      test('should start with empty state', async () => {
        const state = await storage.get_state();
        expect(state.files.size).toBe(0);
        expect(state.metadata).toEqual({});
        expect(state.version).toBe('1.0.0');
      });

      test('should handle multiple initializations gracefully', async () => {
        await storage.initialize(); // Second initialization
        const state = await storage.get_state();
        expect(state.files.size).toBe(0);
      });
    });

    describe('File Operations', () => {
      test('should store and retrieve files', async () => {
        const file = create_test_file('test.js', 'const x = 42;');
        
        await storage.update_file(file);
        
        const retrieved = await storage.get_file('test.js');
        expect(retrieved).toBeDefined();
        expect(retrieved?.source_code).toBe('const x = 42;');
        expect(retrieved?.language).toBe('javascript');
      });

      test('should list all files', async () => {
        const file1 = create_test_file('file1.js');
        const file2 = create_test_file('file2.js');
        
        await storage.update_file(file1);
        await storage.update_file(file2);
        
        const files = await storage.list_files();
        expect(files).toContain('file1.js');
        expect(files).toContain('file2.js');
        expect(files).toHaveLength(2);
      });

      test('should update existing files', async () => {
        const file = create_test_file('test.js', 'const x = 1;');
        await storage.update_file(file);
        
        const updated = create_test_file('test.js', 'const y = 2;');
        await storage.update_file(updated);
        
        const retrieved = await storage.get_file('test.js');
        expect(retrieved?.source_code).toBe('const y = 2;');
      });

      test('should remove files', async () => {
        const file = create_test_file('test.js');
        await storage.update_file(file);
        
        await storage.remove_file('test.js');
        
        const retrieved = await storage.get_file('test.js');
        expect(retrieved).toBeUndefined();
        
        const files = await storage.list_files();
        expect(files).not.toContain('test.js');
      });

      test('should return undefined for non-existent files', async () => {
        const file = await storage.get_file('non-existent.js');
        expect(file).toBeUndefined();
      });
    });

    describe('State Management', () => {
      test('should get and set complete state', async () => {
        const newState = create_empty_state();
        const file = create_test_file('test.js');
        const stateWithFile = add_file_to_state(newState, file);
        
        await storage.set_state(stateWithFile);
        
        const retrieved = await storage.get_state();
        expect(retrieved.files.size).toBe(1);
        expect(retrieved.files.get('test.js')).toBeDefined();
      });

      test('should handle state metadata', async () => {
        const state = create_empty_state();
        const stateWithMetadata = update_state_metadata(state, {
          projectName: 'test-project',
          version: '2.0.0'
        });
        
        await storage.set_state(stateWithMetadata);
        
        const retrieved = await storage.get_state();
        expect(retrieved.metadata.projectName).toBe('test-project');
        expect(retrieved.metadata.version).toBe('2.0.0');
      });

      test('should maintain state immutability', async () => {
        const state1 = await storage.get_state();
        expect(state1.files.size).toBe(0);
        
        // The state should be immutable (readonly)
        // We can't directly test mutation prevention in JS/TS without freezing,
        // but we can verify that getting state multiple times returns consistent data
        const state2 = await storage.get_state();
        expect(state2.files.size).toBe(0);
        
        // States should be the same object reference if nothing changed (implementation dependent)
        // Or at least have same content
        expect(state1.files.size).toBe(state2.files.size);
        expect(state1.version).toBe(state2.version);
      });
    });

    describe('Transactions', () => {
      test('should support atomic transactions', async () => {
        const file1 = create_test_file('file1.js');
        const file2 = create_test_file('file2.js');
        
        const tx = await storage.begin_transaction();
        await tx.update_file(file1);
        await tx.update_file(file2);
        await tx.commit();
        
        const files = await storage.list_files();
        expect(files).toContain('file1.js');
        expect(files).toContain('file2.js');
      });

      test('should isolate transaction changes until commit', async () => {
        const file = create_test_file('test.js', 'original');
        await storage.update_file(file);
        
        const tx = await storage.begin_transaction();
        const updatedFile = create_test_file('test.js', 'modified');
        await tx.update_file(updatedFile);
        
        // Changes should not be visible outside transaction
        const retrieved = await storage.get_file('test.js');
        expect(retrieved?.source_code).toBe('original');
        
        await tx.commit();
        
        // Now changes should be visible
        const afterCommit = await storage.get_file('test.js');
        expect(afterCommit?.source_code).toBe('modified');
      });

      test('should rollback transaction changes', async () => {
        const file = create_test_file('test.js', 'original');
        await storage.update_file(file);
        
        const tx = await storage.begin_transaction();
        const updatedFile = create_test_file('test.js', 'modified');
        await tx.update_file(updatedFile);
        await tx.rollback();
        
        const retrieved = await storage.get_file('test.js');
        expect(retrieved?.source_code).toBe('original');
      });

      test('should handle file removal in transactions', async () => {
        const file = create_test_file('test.js');
        await storage.update_file(file);
        
        const tx = await storage.begin_transaction();
        await tx.remove_file('test.js');
        
        // File should still exist outside transaction
        const beforeCommit = await storage.get_file('test.js');
        expect(beforeCommit).toBeDefined();
        
        await tx.commit();
        
        // File should be removed after commit
        const afterCommit = await storage.get_file('test.js');
        expect(afterCommit).toBeUndefined();
      });

      test('should handle complete state changes in transactions', async () => {
        const file1 = create_test_file('file1.js');
        await storage.update_file(file1);
        
        const tx = await storage.begin_transaction();
        const newState = create_empty_state();
        const file2 = create_test_file('file2.js');
        const stateWithFile2 = add_file_to_state(newState, file2);
        await tx.set_state(stateWithFile2);
        await tx.commit();
        
        const files = await storage.list_files();
        expect(files).toEqual(['file2.js']);
        expect(files).not.toContain('file1.js');
      });
    });

    describe('Error Handling', () => {
      test('should handle removing non-existent files gracefully', async () => {
        await expect(storage.remove_file('non-existent.js'))
          .resolves.not.toThrow();
      });

      test('should handle empty file paths', async () => {
        const file = await storage.get_file('');
        expect(file).toBeUndefined();
      });
    });

    describe('Helper Functions', () => {
      test('add_file_to_state should create new state', () => {
        const state1 = create_empty_state();
        const file = create_test_file('test.js');
        const state2 = add_file_to_state(state1, file);
        
        expect(state1.files.size).toBe(0);
        expect(state2.files.size).toBe(1);
        expect(state1).not.toBe(state2);
      });

      test('remove_file_from_state should create new state', () => {
        const state1 = create_empty_state();
        const file = create_test_file('test.js');
        const state2 = add_file_to_state(state1, file);
        const state3 = remove_file_from_state(state2, 'test.js');
        
        expect(state2.files.size).toBe(1);
        expect(state3.files.size).toBe(0);
        expect(state2).not.toBe(state3);
      });

      test('update_state_metadata should create new state', () => {
        const state1 = create_empty_state();
        const state2 = update_state_metadata(state1, { key: 'value' });
        
        expect(state1.metadata).toEqual({});
        expect(state2.metadata).toEqual({ key: 'value' });
        expect(state1).not.toBe(state2);
      });
    });
  });
}

/**
 * Implementation-specific tests
 */
describe('Storage Implementations', () => {
  // Test temporary directory for disk storage
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // Memory Storage
  const memoryFactory: StorageFactory = {
    name: 'MemoryStorage',
    create: async () => create_memory_storage()
  };

  // Disk Storage
  const diskFactory: StorageFactory = {
    name: 'DiskStorage',
    create: async () => create_disk_storage({ storage_dir: tempDir }),
    cleanup: async () => {
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  };

  // Cache Layer (wrapping memory storage)
  const cacheFactory: StorageFactory = {
    name: 'CacheLayer',
    create: async () => {
      const base = create_memory_storage();
      await base.initialize();
      return create_cache_layer(base, {
        ttl_ms: 60000,  // 60 seconds
        max_file_cache_size: 100
      });
    }
  };

  // Run contract tests for all implementations
  run_storage_contract_tests(memoryFactory);
  run_storage_contract_tests(diskFactory);
  run_storage_contract_tests(cacheFactory);

  // Disk Storage specific tests
  describe('DiskStorage - Persistence', () => {
    test('should persist data across instances', async () => {
      const storage1 = create_disk_storage({ storage_dir: tempDir });
      await storage1.initialize();
      
      const file = create_test_file('test.js', 'persistent data');
      await storage1.update_file(file);
      await storage1.close();
      
      // Create new instance with same directory
      const storage2 = create_disk_storage({ storage_dir: tempDir });
      await storage2.initialize();
      
      const retrieved = await storage2.get_file('test.js');
      expect(retrieved?.source_code).toBe('persistent data');
      
      await storage2.close();
    });

    test('should create storage directory if it does not exist', async () => {
      const newDir = path.join(tempDir, 'new-storage');
      
      const storage = create_disk_storage({ storage_dir: newDir });
      await storage.initialize();
      
      const dirExists = await fs.access(newDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
      
      await storage.close();
    });
  });

  // Cache Layer specific tests
  describe('CacheLayer - Caching Behavior', () => {
    test('should cache file reads', async () => {
      const base = create_memory_storage();
      await base.initialize();
      
      const cache = create_cache_layer(base, {
        ttl_ms: 60000,
        max_file_cache_size: 10
      });
      await cache.initialize();
      
      const file = create_test_file('test.js', 'cached content');
      await cache.update_file(file);
      
      // First read - from base storage
      const read1 = await cache.get_file('test.js');
      expect(read1?.source_code).toBe('cached content');
      
      // Update base storage directly
      await base.update_file(create_test_file('test.js', 'updated content'));
      
      // Second read - should still get cached version
      const read2 = await cache.get_file('test.js');
      expect(read2?.source_code).toBe('cached content');
      
      await cache.close();
      await base.close();
    });

    test('should invalidate cache on updates', async () => {
      const base = create_memory_storage();
      await base.initialize();
      
      const cache = create_cache_layer(base, {
        ttl_ms: 60000,
        max_file_cache_size: 10
      });
      await cache.initialize();
      
      const file1 = create_test_file('test.js', 'version 1');
      await cache.update_file(file1);
      
      const read1 = await cache.get_file('test.js');
      expect(read1?.source_code).toBe('version 1');
      
      const file2 = create_test_file('test.js', 'version 2');
      await cache.update_file(file2);
      
      const read2 = await cache.get_file('test.js');
      expect(read2?.source_code).toBe('version 2');
      
      await cache.close();
      await base.close();
    });

    test('should respect max entries limit', async () => {
      const base = create_memory_storage();
      await base.initialize();
      
      const cache = create_cache_layer(base, {
        ttl_ms: 60000,
        max_file_cache_size: 2  // Very small cache
      });
      await cache.initialize();
      
      // Add 3 files, exceeding cache limit
      await cache.update_file(create_test_file('file1.js', 'content1'));
      await cache.update_file(create_test_file('file2.js', 'content2'));
      await cache.update_file(create_test_file('file3.js', 'content3'));
      
      // Access file1 and file3 to make them most recently used
      await cache.get_file('file1.js');
      await cache.get_file('file3.js');
      
      // file2 should be evicted as least recently used
      // Update file2 in base storage
      await base.update_file(create_test_file('file2.js', 'updated2'));
      
      // Reading file2 should get the updated version (not cached)
      const file2 = await cache.get_file('file2.js');
      expect(file2?.source_code).toBe('updated2');
      
      await cache.close();
      await base.close();
    });
  });
});