/**
 * In-memory storage implementation
 * 
 * Provides fast, transient storage for project data.
 * All data is lost when the process exits.
 */

import {
  StorageInterface,
  StorageTransaction,
  StoredFile,
  ProjectState,
  create_empty_state
} from './storage_interface';

/**
 * In-memory transaction implementation
 */
class MemoryTransaction implements StorageTransaction {
  private state: ProjectState;
  private committed = false;
  private rolledBack = false;
  
  constructor(
    initialState: ProjectState,
    private storage: MemoryStorage
  ) {
    // Deep clone the state for transaction isolation
    this.state = {
      files: new Map(initialState.files),
      metadata: { ...initialState.metadata },
      version: initialState.version
    };
  }
  
  async get_state(): Promise<ProjectState> {
    this.check_active();
    return this.state;
  }
  
  async set_state(state: ProjectState): Promise<void> {
    this.check_active();
    this.state = state;
  }
  
  async update_file(file: StoredFile): Promise<void> {
    this.check_active();
    const newFiles = new Map(this.state.files);
    newFiles.set(file.file_path, file);
    this.state = { ...this.state, files: newFiles };
  }
  
  async remove_file(file_path: string): Promise<void> {
    this.check_active();
    const newFiles = new Map(this.state.files);
    newFiles.delete(file_path);
    this.state = { ...this.state, files: newFiles };
  }
  
  async commit(): Promise<void> {
    this.check_active();
    await this.storage.set_state(this.state);
    this.committed = true;
  }
  
  async rollback(): Promise<void> {
    this.check_active();
    this.rolledBack = true;
    // Nothing to do - changes are discarded
  }
  
  private check_active(): void {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction is no longer active');
    }
  }
}

/**
 * In-memory storage implementation
 */
export class MemoryStorage implements StorageInterface {
  private state: ProjectState = create_empty_state();
  private initialized = false;
  
  async initialize(): Promise<void> {
    this.initialized = true;
  }
  
  async get_state(): Promise<ProjectState> {
    this.check_initialized();
    return this.state;
  }
  
  async set_state(state: ProjectState): Promise<void> {
    this.check_initialized();
    this.state = state;
  }
  
  async get_file(file_path: string): Promise<StoredFile | undefined> {
    this.check_initialized();
    return this.state.files.get(file_path);
  }
  
  async update_file(file: StoredFile): Promise<void> {
    this.check_initialized();
    const newFiles = new Map(this.state.files);
    newFiles.set(file.file_path, file);
    this.state = { ...this.state, files: newFiles };
  }
  
  async remove_file(file_path: string): Promise<void> {
    this.check_initialized();
    const newFiles = new Map(this.state.files);
    newFiles.delete(file_path);
    this.state = { ...this.state, files: newFiles };
  }
  
  async list_files(): Promise<string[]> {
    this.check_initialized();
    return Array.from(this.state.files.keys());
  }
  
  async begin_transaction(): Promise<StorageTransaction> {
    this.check_initialized();
    return new MemoryTransaction(this.state, this);
  }
  
  async close(): Promise<void> {
    // Nothing to clean up for in-memory storage
    this.initialized = false;
  }
  
  private check_initialized(): void {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
  }
}

/**
 * Create a new in-memory storage instance
 */
export function create_memory_storage(): StorageInterface {
  return new MemoryStorage();
}