/**
 * In-memory storage implementation (functional)
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
} from '../storage_interface';
import {
  MemoryStorageState,
  MemoryTransactionState,
  create_initial_storage_state,
  create_initial_transaction_state
} from './types';

// TODO: Integration with Storage Interface
// - Store data in memory
// TODO: Integration with Cache Layer
// - Fast memory-based cache
// TODO: Integration with Project Manager
// - Keep project state in RAM

/**
 * Create a memory transaction
 */
function create_transaction(
  transaction_state: MemoryTransactionState
): StorageTransaction {
  // Closure to maintain transaction state
  let current_state = transaction_state;
  
  const check_active = (): void => {
    if (current_state.committed || current_state.rolled_back) {
      throw new Error('Transaction is no longer active');
    }
  };
  
  return {
    async get_state(): Promise<ProjectState> {
      check_active();
      return current_state.state;
    },
    
    async set_state(state: ProjectState): Promise<void> {
      check_active();
      current_state = { ...current_state, state };
    },
    
    async update_file(file: StoredFile): Promise<void> {
      check_active();
      const new_files = new Map(current_state.state.files);
      new_files.set(file.file_path, file);
      current_state = {
        ...current_state,
        state: {
          ...current_state.state,
          files: new_files
        }
      };
    },
    
    async remove_file(file_path: string): Promise<void> {
      check_active();
      const new_files = new Map(current_state.state.files);
      new_files.delete(file_path);
      current_state = {
        ...current_state,
        state: {
          ...current_state.state,
          files: new_files
        }
      };
    },
    
    async commit(): Promise<void> {
      check_active();
      // Apply changes to parent storage
      await current_state.storage_ref.set_state(current_state.state);
      current_state = { ...current_state, committed: true };
    },
    
    async rollback(): Promise<void> {
      check_active();
      current_state = { ...current_state, rolled_back: true };
      // Nothing to do - changes are discarded
    }
  };
}

/**
 * Create a new in-memory storage instance (functional)
 */
export function create_memory_storage(): StorageInterface {
  // Closure to maintain storage state
  let storage_state = create_initial_storage_state();
  
  const check_initialized = (): void => {
    if (!storage_state.initialized) {
      throw new Error('Storage not initialized');
    }
  };
  
  const storage: StorageInterface = {
    async initialize(): Promise<void> {
      storage_state = { ...storage_state, initialized: true };
    },
    
    async get_state(): Promise<ProjectState> {
      check_initialized();
      return storage_state.state;
    },
    
    async set_state(state: ProjectState): Promise<void> {
      check_initialized();
      storage_state = { ...storage_state, state };
    },
    
    async get_file(file_path: string): Promise<StoredFile | undefined> {
      check_initialized();
      return storage_state.state.files.get(file_path);
    },
    
    async update_file(file: StoredFile): Promise<void> {
      check_initialized();
      const new_files = new Map(storage_state.state.files);
      new_files.set(file.file_path, file);
      storage_state = {
        ...storage_state,
        state: {
          ...storage_state.state,
          files: new_files
        }
      };
    },
    
    async remove_file(file_path: string): Promise<void> {
      check_initialized();
      const new_files = new Map(storage_state.state.files);
      new_files.delete(file_path);
      storage_state = {
        ...storage_state,
        state: {
          ...storage_state.state,
          files: new_files
        }
      };
    },
    
    async list_files(): Promise<string[]> {
      check_initialized();
      return Array.from(storage_state.state.files.keys());
    },
    
    async begin_transaction(): Promise<StorageTransaction> {
      check_initialized();
      const transaction_state = create_initial_transaction_state(
        storage_state.state,
        storage // Pass reference to parent storage
      );
      return create_transaction(transaction_state);
    },
    
    async close(): Promise<void> {
      // Nothing to clean up for in-memory storage
      storage_state = { ...storage_state, initialized: false };
    }
  };
  
  return storage;
}