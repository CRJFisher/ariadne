import { ScopeGraph } from '../graph';
import { ProjectState, StoredFileCache, StorageInterface } from './storage_interface';

// Re-export types for consumers
export { ProjectState, StoredFileCache } from './storage_interface';

/**
 * Synchronous transaction handle for atomic operations
 */
export interface StorageTransactionSync {
  /**
   * Get the current state within the transaction
   */
  getState(): ProjectState;
  
  /**
   * Update the state within the transaction
   */
  setState(state: ProjectState): void;
  
  /**
   * Update a specific file's data
   */
  updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): void;
  
  /**
   * Remove a file from the project
   */
  removeFile(filePath: string): void;
  
  /**
   * Commit the transaction
   */
  commit(): void;
  
  /**
   * Rollback the transaction
   */
  rollback(): void;
}

/**
 * Synchronous storage interface for Project state management
 * This is primarily for in-memory storage and easier migration
 */
export interface StorageInterfaceSync {
  /**
   * Initialize the storage
   */
  initialize(): void;
  
  /**
   * Get the current project state
   */
  getState(): ProjectState;
  
  /**
   * Update the entire project state
   */
  setState(state: ProjectState): void;
  
  /**
   * Begin a new transaction
   */
  beginTransaction(): StorageTransactionSync;
  
  /**
   * Get a specific file's cache data
   */
  getFileCache(filePath: string): StoredFileCache | undefined;
  
  /**
   * Get a specific file's scope graph
   */
  getFileGraph(filePath: string): ScopeGraph | undefined;
  
  /**
   * Update a specific file's data
   */
  updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): void;
  
  /**
   * Remove a file from storage
   */
  removeFile(filePath: string): void;
  
  /**
   * Get all file paths in the project
   */
  getFilePaths(): string[];
  
  /**
   * Check if a file exists in the project
   */
  hasFile(filePath: string): boolean;
  
  /**
   * Clear all data
   */
  clear(): void;
  
  /**
   * Close the storage
   */
  close(): void;
}

/**
 * Adapter to convert sync storage to async
 */
export class SyncToAsyncStorageAdapter implements StorageInterface {
  constructor(private readonly syncStorage: StorageInterfaceSync) {}
  
  async initialize(): Promise<void> {
    this.syncStorage.initialize();
  }
  
  async getState(): Promise<ProjectState> {
    return this.syncStorage.getState();
  }
  
  async setState(state: ProjectState): Promise<void> {
    this.syncStorage.setState(state);
  }
  
  async beginTransaction(): Promise<import('./storage_interface').StorageTransaction> {
    const syncTx = this.syncStorage.beginTransaction();
    return {
      getState: async () => syncTx.getState(),
      setState: async (state) => syncTx.setState(state),
      updateFile: async (filePath, fileCache, scopeGraph) => syncTx.updateFile(filePath, fileCache, scopeGraph),
      removeFile: async (filePath) => syncTx.removeFile(filePath),
      commit: async () => syncTx.commit(),
      rollback: async () => syncTx.rollback()
    };
  }
  
  async getFileCache(filePath: string): Promise<StoredFileCache | undefined> {
    return this.syncStorage.getFileCache(filePath);
  }
  
  async getFileGraph(filePath: string): Promise<ScopeGraph | undefined> {
    return this.syncStorage.getFileGraph(filePath);
  }
  
  async updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): Promise<void> {
    this.syncStorage.updateFile(filePath, fileCache, scopeGraph);
  }
  
  async removeFile(filePath: string): Promise<void> {
    this.syncStorage.removeFile(filePath);
  }
  
  async getFilePaths(): Promise<string[]> {
    return this.syncStorage.getFilePaths();
  }
  
  async hasFile(filePath: string): Promise<boolean> {
    return this.syncStorage.hasFile(filePath);
  }
  
  async clear(): Promise<void> {
    this.syncStorage.clear();
  }
  
  async close(): Promise<void> {
    this.syncStorage.close();
  }
}