/**
 * Cache layer for storage
 * 
 * Provides caching on top of another storage implementation
 * to improve performance.
 */

import {
  StorageInterface,
  StorageTransaction,
  StoredFile,
  ProjectState
} from '../storage_interface';

/**
 * Cache configuration
 */
export interface CacheConfig {
  max_file_cache_size?: number;  // Maximum number of files to cache
  ttl_ms?: number;               // Time-to-live in milliseconds
}


/**
 * Cache layer implementation
 */
export class CacheLayer implements StorageInterface {
  private file_cache = new Map<string, any>();
  private state_cache: any | null = null;
  private readonly max_cache_size: number;
  private readonly ttl_ms: number;
  
  constructor(
    private backend: StorageInterface,
    config: CacheConfig = {}
  ) {
    this.max_cache_size = config.max_file_cache_size || 1000;
    this.ttl_ms = config.ttl_ms || 60000; // 1 minute default
  }
  
  async initialize(): Promise<void> {
    await this.backend.initialize();
  }
  
  async get_state(): Promise<ProjectState> {
    // Check cache first
    if (this.state_cache && this.is_cache_valid(this.state_cache)) {
      return this.state_cache.value;
    }
    
    // Fetch from backend and cache
    const state = await this.backend.get_state();
    this.state_cache = {
      value: state,
      timestamp: Date.now()
    };
    
    return state;
  }
  
  async set_state(state: ProjectState): Promise<void> {
    await this.backend.set_state(state);
    
    // Update cache
    this.state_cache = {
      value: state,
      timestamp: Date.now()
    };
    
    // Clear file cache as state has changed
    this.file_cache.clear();
  }
  
  async get_file(file_path: string): Promise<StoredFile | undefined> {
    // Check cache first
    const cached = this.file_cache.get(file_path);
    if (cached && this.is_cache_valid(cached)) {
      return cached.value;
    }
    
    // Fetch from backend and cache
    const file = await this.backend.get_file(file_path);
    if (file) {
      this.cache_file(file);
    }
    
    return file;
  }
  
  async update_file(file: StoredFile): Promise<void> {
    await this.backend.update_file(file);
    
    // Update cache
    this.cache_file(file);
    
    // Invalidate state cache
    this.state_cache = null;
  }
  
  async remove_file(file_path: string): Promise<void> {
    await this.backend.remove_file(file_path);
    
    // Remove from cache
    this.file_cache.delete(file_path);
    
    // Invalidate state cache
    this.state_cache = null;
  }
  
  async list_files(): Promise<string[]> {
    return this.backend.list_files();
  }
  
  async begin_transaction(): Promise<StorageTransaction> {
    // Transactions bypass cache for consistency
    const transaction = await this.backend.begin_transaction();
    
    // Wrap transaction to invalidate cache on commit
    return new CacheInvalidatingTransaction(transaction, this);
  }
  
  async close(): Promise<void> {
    // Clear caches
    this.file_cache.clear();
    this.state_cache = null;
    
    await this.backend.close();
  }
  
  /**
   * Clear all caches
   */
  clear_cache(): void {
    this.file_cache.clear();
    this.state_cache = null;
  }
  
  /**
   * Get cache statistics
   */
  get_cache_stats(): {
    file_cache_size: number;
    has_state_cache: boolean;
  } {
    return {
      file_cache_size: this.file_cache.size,
      has_state_cache: this.state_cache !== null
    };
  }
  
  private cache_file(file: StoredFile): void {
    // Evict old entries if cache is full
    if (this.file_cache.size >= this.max_cache_size) {
      this.evict_oldest();
    }
    
    this.file_cache.set(file.file_path, {
      value: file,
      timestamp: Date.now()
    });
  }
  
  private evict_oldest(): void {
    let oldest_key: string | null = null;
    let oldest_time = Number.MAX_SAFE_INTEGER;
    
    for (const [key, item] of this.file_cache) {
      if (item.timestamp < oldest_time) {
        oldest_time = item.timestamp;
        oldest_key = key;
      }
    }
    
    if (oldest_key) {
      this.file_cache.delete(oldest_key);
    }
  }
  
  private is_cache_valid<T>(cached: any): boolean {
    return Date.now() - cached.timestamp < this.ttl_ms;
  }
}

/**
 * Transaction wrapper that invalidates cache on commit
 */
class CacheInvalidatingTransaction implements StorageTransaction {
  constructor(
    private wrapped: StorageTransaction,
    private cache: CacheLayer
  ) {}
  
  async get_state(): Promise<ProjectState> {
    return this.wrapped.get_state();
  }
  
  async set_state(state: ProjectState): Promise<void> {
    return this.wrapped.set_state(state);
  }
  
  async update_file(file: StoredFile): Promise<void> {
    return this.wrapped.update_file(file);
  }
  
  async remove_file(file_path: string): Promise<void> {
    return this.wrapped.remove_file(file_path);
  }
  
  async commit(): Promise<void> {
    await this.wrapped.commit();
    // Clear cache after successful commit
    this.cache.clear_cache();
  }
  
  async rollback(): Promise<void> {
    return this.wrapped.rollback();
  }
}

/**
 * Create a cache layer on top of existing storage
 */
export function create_cache_layer(
  backend: StorageInterface,
  config?: CacheConfig
): CacheLayer {
  return new CacheLayer(backend, config);
}