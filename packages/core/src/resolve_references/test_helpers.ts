/**
 * Test utility functions for working with ReadonlyMap types
 *
 * These helpers allow tests to create and manipulate maps that satisfy
 * ReadonlyMap interfaces while maintaining test flexibility.
 */

import type {
  LocationKey,
  SymbolId,
  TypeId,
  Location,
  FilePath,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * Create a ReadonlyMap from a regular Map
 * This is a simple type cast but makes intention clear
 */
export function asReadonly<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  return map as ReadonlyMap<K, V>;
}

/**
 * Create a mutable copy of a ReadonlyMap for testing
 */
export function asMutable<K, V>(readonly: ReadonlyMap<K, V>): Map<K, V> {
  return new Map(readonly);
}

/**
 * Convert Location map to LocationKey map
 * Many tests use Location as keys but interfaces expect LocationKey
 */
export function locationMapToKeyMap<V>(
  locationMap: Map<Location, V>
): ReadonlyMap<LocationKey, V> {
  const keyMap = new Map<LocationKey, V>();
  for (const [loc, value] of locationMap) {
    keyMap.set(location_key(loc), value);
  }
  return keyMap as ReadonlyMap<LocationKey, V>;
}

/**
 * Create a ReadonlyMap from an array of entries
 */
export function readonlyMapFrom<K, V>(
  entries: Array<[K, V]>
): ReadonlyMap<K, V> {
  return new Map(entries) as ReadonlyMap<K, V>;
}

/**
 * Create nested ReadonlyMap structures
 */
export function nestedReadonlyMap<K1, K2, V>(
  entries: Array<[K1, Array<[K2, V]>]>
): ReadonlyMap<K1, ReadonlyMap<K2, V>> {
  const result = new Map<K1, ReadonlyMap<K2, V>>();
  for (const [key, innerEntries] of entries) {
    result.set(key, readonlyMapFrom(innerEntries));
  }
  return result as ReadonlyMap<K1, ReadonlyMap<K2, V>>;
}

/**
 * Helper to create a ReadonlyMap with proper typing for common test patterns
 */
export function createTestSymbolMap(
  entries: Array<[SymbolId, any]>
): ReadonlyMap<SymbolId, any> {
  return readonlyMapFrom(entries);
}

export function createTestLocationKeyMap<V>(
  entries: Array<[Location, V]>
): ReadonlyMap<LocationKey, V> {
  const map = new Map<LocationKey, V>();
  for (const [loc, value] of entries) {
    map.set(location_key(loc), value);
  }
  return asReadonly(map);
}

/**
 * Modify a ReadonlyMap for testing by creating a mutable copy,
 * applying changes, and returning as ReadonlyMap
 */
export function modifyReadonlyMap<K, V>(
  readonly: ReadonlyMap<K, V>,
  modifier: (map: Map<K, V>) => void
): ReadonlyMap<K, V> {
  const mutable = asMutable(readonly);
  modifier(mutable);
  return asReadonly(mutable);
}

/**
 * Helper for array to readonly array conversion
 */
export function asReadonlyArray<T>(array: T[]): readonly T[] {
  return array as readonly T[];
}