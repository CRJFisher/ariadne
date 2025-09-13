/**
 * Types for memory storage implementation
 * 
 * Immutable data structures for in-memory storage
 */

import { ProjectState, StoredFile, StorageInterface } from '../storage_interface';

/**
 * Memory storage state container (immutable)
 */
export interface MemoryStorageState {
  readonly initialized: boolean;
  readonly state: ProjectState;
}

/**
 * Memory transaction state (immutable)
 */
export interface MemoryTransactionState {
  readonly state: ProjectState;
  readonly committed: boolean;
  readonly rolled_back: boolean;
  readonly storage_ref: StorageInterface; // Reference to parent storage
}

/**
 * Create initial storage state
 */
export function create_initial_storage_state(): MemoryStorageState {
  return {
    initialized: false,
    state: {
      files: new Map(),
      metadata: {},
      version: '1.0.0'
    }
  };
}

/**
 * Create initial transaction state
 */
export function create_initial_transaction_state(
  initial_state: ProjectState,
  storage_ref: StorageInterface
): MemoryTransactionState {
  return {
    state: {
      files: new Map(initial_state.files),
      metadata: { ...initial_state.metadata },
      version: initial_state.version
    },
    committed: false,
    rolled_back: false,
    storage_ref
  };
}