/**
 * Resolution Cache Module
 *
 * Provides O(1) lookup performance for repeated symbol resolutions
 * by caching (scope_id, name) → symbol_id mappings.
 */

export {
  create_resolution_cache,
  type ResolutionCache,
  type CacheStats,
} from "./resolution_cache";
