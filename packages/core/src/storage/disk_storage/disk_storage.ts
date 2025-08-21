/**
 * Disk-based storage implementation
 * 
 * Provides persistent storage for project data using the file system.
 * Data is stored as JSON files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  StorageInterface,
  StorageTransaction,
  StoredFile,
  ProjectState,
  create_empty_state
} from '../storage_interface';

/**
 * Disk-based transaction implementation
 */
class DiskTransaction implements StorageTransaction {
  private state: ProjectState;
  private committed = false;
  private rolledBack = false;
  
  constructor(
    initialState: ProjectState,
    private storage: DiskStorage
  ) {
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
  }
  
  private check_active(): void {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction is no longer active');
    }
  }
}

/**
 * Disk storage configuration
 */
export interface DiskStorageConfig {
  storage_dir: string;
  use_compression?: boolean;
}

/**
 * Disk-based storage implementation
 */
export class DiskStorage implements StorageInterface {
  private state: ProjectState = create_empty_state();
  private initialized = false;
  private state_file: string;
  private files_dir: string;
  
  constructor(private config: DiskStorageConfig) {
    this.state_file = path.join(config.storage_dir, 'state.json');
    this.files_dir = path.join(config.storage_dir, 'files');
  }
  
  async initialize(): Promise<void> {
    // Create storage directories
    await fs.mkdir(this.config.storage_dir, { recursive: true });
    await fs.mkdir(this.files_dir, { recursive: true });
    
    // Load existing state if it exists
    try {
      const stateData = await fs.readFile(this.state_file, 'utf-8');
      const loaded = JSON.parse(stateData);
      
      // Reconstruct the state with Maps
      this.state = {
        files: new Map(loaded.files),
        metadata: loaded.metadata,
        version: loaded.version
      };
    } catch (error) {
      // State file doesn't exist yet, use empty state
      this.state = create_empty_state();
    }
    
    this.initialized = true;
  }
  
  async get_state(): Promise<ProjectState> {
    this.check_initialized();
    return this.state;
  }
  
  async set_state(state: ProjectState): Promise<void> {
    this.check_initialized();
    this.state = state;
    await this.persist_state();
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
    
    // Persist the file content
    await this.persist_file(file);
    await this.persist_state();
  }
  
  async remove_file(file_path: string): Promise<void> {
    this.check_initialized();
    const newFiles = new Map(this.state.files);
    newFiles.delete(file_path);
    this.state = { ...this.state, files: newFiles };
    
    // Remove the file from disk
    await this.remove_persisted_file(file_path);
    await this.persist_state();
  }
  
  async list_files(): Promise<string[]> {
    this.check_initialized();
    return Array.from(this.state.files.keys());
  }
  
  async begin_transaction(): Promise<StorageTransaction> {
    this.check_initialized();
    return new DiskTransaction(this.state, this);
  }
  
  async close(): Promise<void> {
    if (this.initialized) {
      await this.persist_state();
      this.initialized = false;
    }
  }
  
  private async persist_state(): Promise<void> {
    // Convert state to JSON-serializable format
    const serializable = {
      files: Array.from(this.state.files.entries()),
      metadata: this.state.metadata,
      version: this.state.version
    };
    
    await fs.writeFile(
      this.state_file,
      JSON.stringify(serializable, null, 2),
      'utf-8'
    );
  }
  
  private async persist_file(file: StoredFile): Promise<void> {
    const fileHash = this.get_file_hash(file.file_path);
    const filePath = path.join(this.files_dir, `${fileHash}.json`);
    
    await fs.writeFile(
      filePath,
      JSON.stringify(file, null, 2),
      'utf-8'
    );
  }
  
  private async remove_persisted_file(file_path: string): Promise<void> {
    const fileHash = this.get_file_hash(file_path);
    const filePath = path.join(this.files_dir, `${fileHash}.json`);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore error
    }
  }
  
  private get_file_hash(file_path: string): string {
    // Simple hash function for file names
    let hash = 0;
    for (let i = 0; i < file_path.length; i++) {
      const char = file_path.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  private check_initialized(): void {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
  }
}

/**
 * Create a new disk storage instance
 */
export function create_disk_storage(config: DiskStorageConfig): StorageInterface {
  return new DiskStorage(config);
}