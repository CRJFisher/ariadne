import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DiskStorage, create_disk_storage } from './disk_storage';
import { create_empty_state } from '../storage_interface';

describe('DiskStorage', () => {
  const testDir = path.join(__dirname, '.test-disk-storage');
  let storage: DiskStorage;

  beforeEach(async () => {
    // Clean up and create test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
    await fs.mkdir(testDir, { recursive: true });
    
    storage = new DiskStorage({ storage_dir: testDir });
    await storage.initialize();
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  test('initializes with empty state', async () => {
    const state = await storage.get_state();
    expect(state.files.size).toBe(0);
    expect(state.metadata).toEqual({});
    expect(state.version).toBe('1.0.0');
  });

  test('persists state to disk', async () => {
    const newState = create_empty_state();
    newState.metadata = { test: 'value' };
    
    await storage.set_state(newState);
    
    // Verify state file was created
    const stateFile = path.join(testDir, 'state.json');
    const exists = await fs.access(stateFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // Read and verify content
    const content = JSON.parse(await fs.readFile(stateFile, 'utf-8'));
    expect(content.metadata).toEqual({ test: 'value' });
  });

  test('loads existing state from disk', async () => {
    // Create initial storage and save state
    const initialState = create_empty_state();
    initialState.metadata = { persisted: 'data' };
    await storage.set_state(initialState);
    await storage.close();
    
    // Create new storage instance and verify it loads the state
    const newStorage = new DiskStorage({ storage_dir: testDir });
    await newStorage.initialize();
    
    const loadedState = await newStorage.get_state();
    expect(loadedState.metadata).toEqual({ persisted: 'data' });
    
    await newStorage.close();
  });

  test('stores and retrieves files', async () => {
    const file = {
      file_path: 'test.ts',
      content: 'const x = 1;',
      hash: 'abc123',
      last_modified: Date.now()
    };
    
    await storage.update_file(file);
    
    const retrieved = await storage.get_file('test.ts');
    expect(retrieved).toEqual(file);
  });

  test('removes files', async () => {
    const file = {
      file_path: 'test.ts',
      content: 'const x = 1;',
      hash: 'abc123',
      last_modified: Date.now()
    };
    
    await storage.update_file(file);
    expect(await storage.get_file('test.ts')).toBeDefined();
    
    await storage.remove_file('test.ts');
    expect(await storage.get_file('test.ts')).toBeUndefined();
  });

  test('lists all file paths', async () => {
    await storage.update_file({
      file_path: 'file1.ts',
      content: 'content1',
      hash: 'hash1',
      last_modified: Date.now()
    });
    
    await storage.update_file({
      file_path: 'file2.ts',
      content: 'content2',
      hash: 'hash2',
      last_modified: Date.now()
    });
    
    const files = await storage.list_files();
    expect(files).toEqual(['file1.ts', 'file2.ts']);
  });

  describe('Transactions', () => {
    test('commits transaction changes', async () => {
      const tx = await storage.begin_transaction();
      
      const state = await tx.get_state();
      state.metadata = { inTransaction: true };
      await tx.set_state(state);
      
      // Changes not visible before commit
      const currentState = await storage.get_state();
      expect(currentState.metadata).toEqual({});
      
      await tx.commit();
      
      // Changes visible after commit
      const newState = await storage.get_state();
      expect(newState.metadata).toEqual({ inTransaction: true });
    });

    test('rolls back transaction changes', async () => {
      const tx = await storage.begin_transaction();
      
      const state = await tx.get_state();
      state.metadata = { shouldNotPersist: true };
      await tx.set_state(state);
      
      await tx.rollback();
      
      // Changes should not be visible
      const currentState = await storage.get_state();
      expect(currentState.metadata).toEqual({});
    });

    test('throws error when using inactive transaction', async () => {
      const tx = await storage.begin_transaction();
      await tx.commit();
      
      // Should throw after commit
      await expect(tx.get_state()).rejects.toThrow('Transaction is no longer active');
    });

    test('transaction can update files', async () => {
      const tx = await storage.begin_transaction();
      
      await tx.update_file({
        file_path: 'tx-file.ts',
        content: 'transaction content',
        hash: 'txhash',
        last_modified: Date.now()
      });
      
      // File not visible before commit
      expect(await storage.get_file('tx-file.ts')).toBeUndefined();
      
      await tx.commit();
      
      // File visible after commit
      expect(await storage.get_file('tx-file.ts')).toBeDefined();
    });

    test('transaction can remove files', async () => {
      // Add file first
      await storage.update_file({
        file_path: 'to-remove.ts',
        content: 'will be removed',
        hash: 'removehash',
        last_modified: Date.now()
      });
      
      const tx = await storage.begin_transaction();
      await tx.remove_file('to-remove.ts');
      
      // File still visible before commit
      expect(await storage.get_file('to-remove.ts')).toBeDefined();
      
      await tx.commit();
      
      // File gone after commit
      expect(await storage.get_file('to-remove.ts')).toBeUndefined();
    });
  });

  test('handles concurrent file operations', async () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      file_path: `file${i}.ts`,
      content: `content${i}`,
      hash: `hash${i}`,
      last_modified: Date.now()
    }));
    
    // Add all files concurrently
    await Promise.all(files.map(f => storage.update_file(f)));
    
    // Verify all files exist
    const allFiles = await storage.list_files();
    expect(allFiles.length).toBe(10);
    
    // Remove half concurrently
    await Promise.all(
      files.slice(0, 5).map(f => storage.remove_file(f.file_path))
    );
    
    // Verify correct files remain
    const remaining = await storage.list_files();
    expect(remaining.length).toBe(5);
    expect(remaining).toEqual(files.slice(5).map(f => f.file_path));
  });

  test('create_disk_storage factory function works', async () => {
    const factoryStorage = create_disk_storage({ storage_dir: testDir });
    await factoryStorage.initialize();
    
    const state = await factoryStorage.get_state();
    expect(state.files.size).toBe(0);
    
    await factoryStorage.close();
  });
});