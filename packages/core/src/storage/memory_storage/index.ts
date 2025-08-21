/**
 * Memory storage public API
 * 
 * Exports the functional memory storage implementation
 */

export { create_memory_storage } from './memory_storage';
export type { MemoryStorageState, MemoryTransactionState } from './types';

// For backwards compatibility, export a MemoryStorage class wrapper
// This allows existing code to continue using `new MemoryStorage()`
import { create_memory_storage } from './memory_storage';
import { StorageInterface } from '../storage_interface';

export class MemoryStorage implements StorageInterface {
  private storage: StorageInterface;
  
  constructor() {
    this.storage = create_memory_storage();
  }
  
  async initialize(): Promise<void> {
    return this.storage.initialize();
  }
  
  async get_state() {
    return this.storage.get_state();
  }
  
  async set_state(state: any) {
    return this.storage.set_state(state);
  }
  
  async get_file(file_path: string) {
    return this.storage.get_file(file_path);
  }
  
  async update_file(file: any) {
    return this.storage.update_file(file);
  }
  
  async remove_file(file_path: string) {
    return this.storage.remove_file(file_path);
  }
  
  async list_files() {
    return this.storage.list_files();
  }
  
  async begin_transaction() {
    return this.storage.begin_transaction();
  }
  
  async close() {
    return this.storage.close();
  }
}