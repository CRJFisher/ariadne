import { 
  StorageInterfaceSync,
  StorageTransactionSync,
  ProjectState,
  StoredFileCache
} from './storage_interface_sync';
import { ScopeGraph } from '../graph';
import { 
  createEmptyState,
  updateFileInState,
  removeFileFromState,
  deepFreeze
} from './storage_utils';
import { LanguageConfig } from '../types';

/**
 * In-memory transaction implementation
 */
class InMemoryTransaction implements StorageTransactionSync {
  private transactionState: ProjectState;
  private committed = false;
  private rolledBack = false;
  
  constructor(
    private readonly storage: InMemoryStorage,
    initialState: ProjectState
  ) {
    // Create a snapshot of the current state
    this.transactionState = this.cloneState(initialState);
  }
  
  getState(): ProjectState {
    this.checkValid();
    return this.transactionState;
  }
  
  setState(state: ProjectState): void {
    this.checkValid();
    this.transactionState = state;
  }
  
  updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): void {
    this.checkValid();
    this.transactionState = updateFileInState(
      this.transactionState,
      filePath,
      fileCache,
      scopeGraph
    );
  }
  
  removeFile(filePath: string): void {
    this.checkValid();
    this.transactionState = removeFileFromState(this.transactionState, filePath);
  }
  
  commit(): void {
    this.checkValid();
    this.storage.applyTransaction(this.transactionState);
    this.committed = true;
  }
  
  rollback(): void {
    this.checkValid();
    this.rolledBack = true;
  }
  
  private checkValid(): void {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already completed');
    }
  }
  
  private cloneState(state: ProjectState): ProjectState {
    // Create a shallow clone with new Map instances
    return {
      file_graphs: new Map(state.file_graphs),
      file_cache: new Map(state.file_cache),
      languages: state.languages, // Languages are immutable
      inheritance_map: new Map(state.inheritance_map),
      call_graph_data: {
        ...state.call_graph_data,
        fileGraphs: new Map(state.call_graph_data.fileGraphs),
        fileCache: new Map(state.call_graph_data.fileCache),
        fileTypeTrackers: new Map(state.call_graph_data.fileTypeTrackers)
      }
    };
  }
}

/**
 * In-memory storage implementation
 * This is the default storage provider that maintains all data in memory
 */
export class InMemoryStorage implements StorageInterfaceSync {
  private state: ProjectState;
  
  constructor(languages: ReadonlyMap<string, LanguageConfig>) {
    this.state = createEmptyState(languages);
  }
  
  initialize(): void {
    // No initialization needed for in-memory storage
  }
  
  getState(): ProjectState {
    // Return frozen state in development to catch mutations
    return process.env.NODE_ENV === 'development' 
      ? deepFreeze(this.state) 
      : this.state;
  }
  
  setState(state: ProjectState): void {
    this.state = state;
  }
  
  beginTransaction(): StorageTransactionSync {
    return new InMemoryTransaction(this, this.state);
  }
  
  getFileCache(filePath: string): StoredFileCache | undefined {
    return this.state.file_cache.get(filePath);
  }
  
  getFileGraph(filePath: string): ScopeGraph | undefined {
    return this.state.file_graphs.get(filePath);
  }
  
  updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): void {
    this.state = updateFileInState(this.state, filePath, fileCache, scopeGraph);
  }
  
  removeFile(filePath: string): void {
    this.state = removeFileFromState(this.state, filePath);
  }
  
  getFilePaths(): string[] {
    return Array.from(this.state.file_graphs.keys());
  }
  
  hasFile(filePath: string): boolean {
    return this.state.file_graphs.has(filePath);
  }
  
  clear(): void {
    this.state = createEmptyState(this.state.languages);
  }
  
  close(): void {
    // No cleanup needed for in-memory storage
  }
  
  /**
   * Apply a transaction's state (internal method)
   */
  applyTransaction(newState: ProjectState): void {
    this.state = newState;
  }
}

/**
 * Register the in-memory storage provider
 */
import { registerStorageProvider } from './storage_interface';
import { SyncToAsyncStorageAdapter } from './storage_interface_sync';

registerStorageProvider('memory', async (options?: { languages?: ReadonlyMap<string, LanguageConfig> }) => {
  const languages = options?.languages || new Map();
  const syncStorage = new InMemoryStorage(languages);
  return new SyncToAsyncStorageAdapter(syncStorage);
});