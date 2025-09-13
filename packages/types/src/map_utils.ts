/**
 * Map utilities for safer null handling
 */

/**
 * Safely get a value from a map with a default
 */
export function map_get_or_default<K, V>(map: Map<K, V>, key: K, default_value: V): V {
  return map.get(key) ?? default_value;
}

/**
 * Safely get an array from a map, defaulting to empty array
 */
export function map_get_array<K, V>(map: Map<K, V[]>, key: K): V[] {
  return map.get(key) ?? [];
}

/**
 * Safely get a Set from a map, defaulting to empty Set
 */
export function map_get_set<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  return map.get(key) ?? new Set();
}

/**
 * Get a value from a map if it exists, otherwise throw an error
 */
export function map_get_required<K, V>(map: Map<K, V>, key: K, error_message?: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(error_message ?? `Required key not found in map: ${String(key)}`);
  }
  return value;
}

/**
 * Check if map has key and get value with proper type safety
 */
export function map_get_if_exists<K, V>(map: Map<K, V>, key: K): V | undefined {
  return map.has(key) ? map.get(key) : undefined;
}

/**
 * Get or create a value in a map using a factory function
 */
export function map_get_or_create<K, V>(
  map: Map<K, V>,
  key: K,
  factory: () => V
): V {
  if (map.has(key)) {
    return map.get(key)!; // Safe to use ! here since we checked has()
  }
  const value = factory();
  map.set(key, value);
  return value;
}

/**
 * Get or create an array in a map
 */
export function map_get_or_create_array<K, V>(map: Map<K, V[]>, key: K): V[] {
  return map_get_or_create(map, key, () => []);
}

/**
 * Get or create a Set in a map
 */
export function map_get_or_create_set<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  return map_get_or_create(map, key, () => new Set());
}