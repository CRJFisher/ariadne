/**
 * Cache layer feature module
 * 
 * Provides caching functionality on top of any storage implementation
 * to improve performance through TTL-based caching with LRU eviction.
 */

export {
  CacheLayer,
  CacheConfig,
  create_cache_layer
} from './cache_layer';