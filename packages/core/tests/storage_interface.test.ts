import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { 
  StorageInterface,
  createStorage,
  registerStorageProvider,
  InMemoryStorage,
  ImmutableProject
} from '../src';
import { typescript_config } from '../src/languages/typescript';
import { SyncToAsyncStorageAdapter } from '../src/storage/storage_interface_sync';
import * as fs from 'fs';
import * as path from 'path';

// Mock storage implementation for testing
class MockStorage implements StorageInterface {
  private data = new Map<string, any>();
  public methodCalls: string[] = [];
  
  async initialize(): Promise<void> {
    this.methodCalls.push('initialize');
  }
  
  async getState(): Promise<any> {
    this.methodCalls.push('getState');
    return this.data.get('state') || {
      file_graphs: new Map(),
      file_cache: new Map(),
      languages: new Map([['typescript', typescript_config]]),
      inheritance_map: new Map(),
      call_graph_data: {
        fileGraphs: new Map(),
        fileCache: new Map(),
        fileTypeTrackers: new Map(),
        languages: new Map([['typescript', typescript_config]])
      }
    };
  }
  
  async setState(state: any): Promise<void> {
    this.methodCalls.push('setState');
    this.data.set('state', state);
  }
  
  async beginTransaction(): Promise<any> {
    this.methodCalls.push('beginTransaction');
    const state = await this.getState();
    return {
      getState: async () => state,
      setState: async (s: any) => { this.data.set('txState', s); },
      updateFile: async () => {},
      removeFile: async () => {},
      commit: async () => { 
        const txState = this.data.get('txState');
        if (txState) await this.setState(txState);
      },
      rollback: async () => { this.data.delete('txState'); }
    };
  }
  
  async getFileCache(filePath: string): Promise<any> {
    this.methodCalls.push(`getFileCache:${filePath}`);
    const state = await this.getState();
    return state.file_cache.get(filePath);
  }
  
  async getFileGraph(filePath: string): Promise<any> {
    this.methodCalls.push(`getFileGraph:${filePath}`);
    const state = await this.getState();
    return state.file_graphs.get(filePath);
  }
  
  async updateFile(filePath: string, fileCache: any, scopeGraph: any): Promise<void> {
    this.methodCalls.push(`updateFile:${filePath}`);
  }
  
  async removeFile(filePath: string): Promise<void> {
    this.methodCalls.push(`removeFile:${filePath}`);
  }
  
  async getFilePaths(): Promise<string[]> {
    this.methodCalls.push('getFilePaths');
    const state = await this.getState();
    return Array.from(state.file_graphs.keys());
  }
  
  async hasFile(filePath: string): Promise<boolean> {
    this.methodCalls.push(`hasFile:${filePath}`);
    const state = await this.getState();
    return state.file_graphs.has(filePath);
  }
  
  async clear(): Promise<void> {
    this.methodCalls.push('clear');
    this.data.clear();
  }
  
  async close(): Promise<void> {
    this.methodCalls.push('close');
  }
}

describe('Storage Interface', () => {
  beforeEach(() => {
    // Clear any existing registrations
    (globalThis as any).__storageProviders = new Map();
  });
  
  test('can register and create storage providers', async () => {
    // Register a test provider
    registerStorageProvider('test', async () => new MockStorage());
    
    // Create an instance
    const storage = await createStorage('test');
    expect(storage).toBeInstanceOf(MockStorage);
  });
  
  test('throws error for unknown storage provider', async () => {
    await expect(createStorage('unknown')).rejects.toThrow('Unknown storage provider: unknown');
  });
  
  test('passes options to storage factory', async () => {
    let receivedOptions: any;
    
    registerStorageProvider('test-options', async (options) => {
      receivedOptions = options;
      return new MockStorage();
    });
    
    await createStorage('test-options', { foo: 'bar' });
    expect(receivedOptions).toEqual({ foo: 'bar' });
  });
  
  test('ImmutableProject uses provided storage', async () => {
    const mockStorage = new MockStorage();
    
    // Convert to sync storage for ImmutableProject
    const syncMockStorage = {
      initialize: () => mockStorage.initialize(),
      getState: () => ({
        file_graphs: new Map(),
        file_cache: new Map(),
        languages: new Map([['typescript', typescript_config]]),
        inheritance_map: new Map(),
        call_graph_data: {
          fileGraphs: new Map(),
          fileCache: new Map(),
          fileTypeTrackers: new Map(),
          languages: new Map([['typescript', typescript_config]])
        }
      }),
      setState: (state: any) => mockStorage.setState(state),
      beginTransaction: () => ({
        getState: () => syncMockStorage.getState(),
        setState: (s: any) => {},
        updateFile: () => {},
        removeFile: () => {},
        commit: () => {},
        rollback: () => {}
      }),
      getFileCache: () => undefined,
      getFileGraph: () => undefined,
      updateFile: () => {},
      removeFile: () => {},
      getFilePaths: () => [],
      hasFile: () => false,
      clear: () => {},
      close: () => {}
    };
    
    const project = new ImmutableProject(syncMockStorage as any);
    
    // Add a file - should trigger storage methods
    project.add_or_update_file('test.ts', 'const x = 1;');
    
    // Check that storage methods were called
    expect(mockStorage.methodCalls.length).toBeGreaterThan(0);
  });
  
  test('in-memory storage is registered by default', async () => {
    // Import to trigger registration
    await import('../src/storage/in_memory_storage');
    
    const storage = await createStorage('memory', {
      languages: new Map([['typescript', typescript_config]])
    });
    
    expect(storage).toBeDefined();
    
    // Verify it works
    await storage.initialize();
    const state = await storage.getState();
    expect(state.file_graphs.size).toBe(0);
  });
  
  test('storage adapter converts sync to async', async () => {
    const languages = new Map([['typescript', typescript_config]]);
    const syncStorage = new InMemoryStorage(languages);
    const asyncStorage = new SyncToAsyncStorageAdapter(syncStorage);
    
    // Test async methods
    await asyncStorage.initialize();
    
    // Add some data through sync storage
    syncStorage.updateFile('test.ts', {
      source_code: 'const x = 1;',
      tree: {} as any,
      graph: {} as any
    }, {} as any);
    
    // Verify through async storage
    const hasFile = await asyncStorage.hasFile('test.ts');
    expect(hasFile).toBe(true);
    
    const filePaths = await asyncStorage.getFilePaths();
    expect(filePaths).toEqual(['test.ts']);
  });
  
  test('transactions work correctly with custom storage', async () => {
    const mockStorage = new MockStorage();
    
    await mockStorage.initialize();
    
    // Start transaction
    const tx = await mockStorage.beginTransaction();
    
    // Make changes in transaction
    const state = await tx.getState();
    state.file_cache.set('test.ts', { source_code: 'const x = 1;' });
    await tx.setState(state);
    
    // Changes shouldn't be visible yet
    const currentState = await mockStorage.getState();
    expect(currentState.file_cache.has('test.ts')).toBe(false);
    
    // Commit transaction
    await tx.commit();
    
    // Now changes should be visible
    const newState = await mockStorage.getState();
    expect(newState.file_cache.has('test.ts')).toBe(true);
  });
});

describe('Storage Provider Examples', () => {
  const testDir = path.join(__dirname, '.test-storage');
  
  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });
  
  test('disk storage provider works correctly', async () => {
    // Import to register the provider
    await import('../src/storage/examples/disk_storage');
    
    const languages = new Map([['typescript', typescript_config]]);
    const storage = await createStorage('disk', { 
      storageDir: testDir,
      languages 
    });
    
    await storage.initialize();
    
    // Add a file
    const tx = await storage.beginTransaction();
    const state = await tx.getState();
    
    state.file_cache.set('test.ts', {
      source_code: 'const x = 1;',
      tree: {} as any,
      graph: {} as any
    });
    state.file_graphs.set('test.ts', {} as any);
    
    await tx.setState(state);
    await tx.commit();
    
    // Verify file was saved to disk
    expect(fs.existsSync(path.join(testDir, 'index.json'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'metadata.json'))).toBe(true);
    
    // Create a new storage instance and verify data persists
    const storage2 = await createStorage('disk', { 
      storageDir: testDir,
      languages 
    });
    await storage2.initialize();
    
    const hasFile = await storage2.hasFile('test.ts');
    expect(hasFile).toBe(true);
    
    const filePaths = await storage2.getFilePaths();
    expect(filePaths).toEqual(['test.ts']);
  });
});