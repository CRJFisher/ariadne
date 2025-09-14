/**
 * Simple in-memory cache for analysis results
 * 
 * Provides caching of parsed ASTs and file analysis results
 * to avoid re-analyzing unchanged files.
 */

import { FileAnalysis } from '@ariadnejs/types';
import { Tree } from 'tree-sitter';
import * as crypto from 'crypto';

/**
 * Cache configuration options
 */
export interface CacheOptions {
  enabled: boolean;
  ttl: number; // Time-to-live in milliseconds
  maxSize: number; // Maximum number of cached entries
}


/**
 * Simple LRU cache for analysis results
 */
export class AnalysisCache {
  private astCache = new Map<string, any>();
  private analysisCache = new Map<string, any>();
  private readonly ttl: number;
  private readonly maxSize: number;
  private readonly enabled: boolean;

  constructor(options: CacheOptions) {
    this.enabled = options.enabled;
    this.ttl = options.ttl; // Now guaranteed to be non-null
    this.maxSize = options.maxSize; // Now guaranteed to be non-null
  }

  /**
   * Generate hash for file content
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: any, currentHash: string): boolean {
    if (!this.enabled) return false;
    
    // Check hash match
    if (entry.hash !== currentHash) return false;
    
    // Check TTL
    const age = Date.now() - entry.timestamp;
    return age < this.ttl;
  }

  /**
   * Evict oldest entries if cache is full
   */
  private evictIfNeeded<T>(cache: Map<string, any>): void {
    if (cache.size >= this.maxSize) {
      // Simple FIFO eviction - remove first (oldest) entry
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
  }

  /**
   * Get cached AST if available and valid
   */
  getCachedAST(filePath: string, content: string): Tree | undefined {
    if (!this.enabled) return undefined;
    
    const entry = this.astCache.get(filePath);
    if (!entry) return undefined;
    
    const hash = this.generateHash(content);
    if (this.isValid(entry, hash)) {
      // Move to end (most recently used)
      this.astCache.delete(filePath);
      this.astCache.set(filePath, entry);
      return entry.value;
    }
    
    // Invalid entry, remove it
    this.astCache.delete(filePath);
    return undefined;
  }

  /**
   * Cache an AST
   */
  cacheAST(filePath: string, content: string, ast: Tree): void {
    if (!this.enabled) return;
    
    this.evictIfNeeded(this.astCache);
    
    const entry = {
      value: ast,
      hash: this.generateHash(content),
      timestamp: Date.now()
    };
    
    this.astCache.set(filePath, entry);
  }

  /**
   * Get cached analysis if available and valid
   */
  getCachedAnalysis(filePath: string, content: string): FileAnalysis | undefined {
    if (!this.enabled) return undefined;
    
    const entry = this.analysisCache.get(filePath);
    if (!entry) return undefined;
    
    const hash = this.generateHash(content);
    if (this.isValid(entry, hash)) {
      // Move to end (most recently used)
      this.analysisCache.delete(filePath);
      this.analysisCache.set(filePath, entry);
      return entry.value;
    }
    
    // Invalid entry, remove it
    this.analysisCache.delete(filePath);
    return undefined;
  }

  /**
   * Cache a file analysis
   */
  cacheAnalysis(filePath: string, content: string, analysis: FileAnalysis): void {
    if (!this.enabled) return;
    
    this.evictIfNeeded(this.analysisCache);
    
    const entry = {
      value: analysis,
      hash: this.generateHash(content),
      timestamp: Date.now()
    };
    
    this.analysisCache.set(filePath, entry);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.astCache.clear();
    this.analysisCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    astCacheSize: number;
    analysisCacheSize: number;
    enabled: boolean;
  } {
    return {
      astCacheSize: this.astCache.size,
      analysisCacheSize: this.analysisCache.size,
      enabled: this.enabled
    };
  }
}

/**
 * Default cache options
 */
const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  enabled: false,
  ttl: 15 * 60 * 1000, // 15 minutes
  maxSize: 100
};

/**
 * Create a new analysis cache with default options
 */
export function create_analysis_cache(options: Partial<CacheOptions> = {}): AnalysisCache {
  return new AnalysisCache({
    enabled: options.enabled ?? DEFAULT_CACHE_OPTIONS.enabled,
    ttl: options.ttl ?? DEFAULT_CACHE_OPTIONS.ttl,
    maxSize: options.maxSize ?? DEFAULT_CACHE_OPTIONS.maxSize
  });
}