/**
 * Collection and data structure utilities
 *
 * Provides helpers for working with arrays, maps, sets, and other collections
 * Uses type-safe patterns to avoid null/undefined issues
 */

/**
 * Get array from map or empty array if not found
 */
function get_map_array_or_empty<K, V>(map: Map<K, V[]>, key: K): V[] {
  return map.get(key) || [];
}

/**
 * Group array items by a key function
 */
export function group_by<T, K>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  
  for (const item of items) {
    const key = keyFn(item);
    const group = get_map_array_or_empty(groups, key);
    groups.set(key, [...group, item]);
  }
  
  return groups;
}

/**
 * Create an index map from array
 */
export function index_by<T, K>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T> {
  const index = new Map<K, T>();
  
  for (const item of items) {
    const key = keyFn(item);
    index.set(key, item);
  }
  
  return index;
}

/**
 * Get unique items from array
 */
export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Get unique items by key function
 */
export function unique_by<T, K>(
  items: T[],
  keyFn: (item: T) => K
): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Partition array into two based on predicate
 */
export function partition<T>(
  items: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];
  
  for (const item of items) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  
  return [truthy, falsy];
}

/**
 * Flatten nested arrays by one level
 */
export function flatten<T>(arrays: T[][]): T[] {
  return arrays.reduce((acc, arr) => acc.concat(arr), []);
}

/**
 * Deep flatten arrays to any depth
 */
export function deep_flatten<T>(arr: any[]): T[] {
  const result: T[] = [];
  
  function flatten_recursive(item: any) {
    if (Array.isArray(item)) {
      item.forEach(flatten_recursive);
    } else {
      result.push(item);
    }
  }
  
  flatten_recursive(arr);
  return result;
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  
  return chunks;
}

/**
 * Get intersection of multiple sets
 */
export function set_intersection<T>(...sets: Set<T>[]): Set<T> {
  if (sets.length === 0) return new Set();
  if (sets.length === 1) return new Set(sets[0]);
  
  const result = new Set<T>();
  const [first, ...rest] = sets;
  
  for (const item of first) {
    if (rest.every(set => set.has(item))) {
      result.add(item);
    }
  }
  
  return result;
}

/**
 * Get union of multiple sets
 */
export function set_union<T>(...sets: Set<T>[]): Set<T> {
  const result = new Set<T>();
  
  for (const set of sets) {
    for (const item of set) {
      result.add(item);
    }
  }
  
  return result;
}

/**
 * Get difference of two sets (items in first but not in second)
 */
export function set_difference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const result = new Set<T>();
  
  for (const item of set1) {
    if (!set2.has(item)) {
      result.add(item);
    }
  }
  
  return result;
}

/**
 * Merge multiple maps
 */
export function merge_maps<K, V>(...maps: Map<K, V>[]): Map<K, V> {
  const result = new Map<K, V>();
  
  for (const map of maps) {
    for (const [key, value] of map) {
      result.set(key, value);
    }
  }
  
  return result;
}

/**
 * Sort array by multiple keys
 */
export function sort_by<T>(
  items: T[],
  ...keyFns: Array<(item: T) => any>
): T[] {
  return [...items].sort((a, b) => {
    for (const keyFn of keyFns) {
      const aKey = keyFn(a);
      const bKey = keyFn(b);
      
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
    }
    
    return 0;
  });
}

/**
 * Create a default map that returns a default value for missing keys
 */
export class DefaultMap<K, V> extends Map<K, V> {
  constructor(private defaultFactory: () => V) {
    super();
  }
  
  get(key: K): V {
    if (!super.has(key)) {
      super.set(key, this.defaultFactory());
    }
    return super.get(key)!;
  }
}

/**
 * Pick specific keys from object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj } as any;
  
  for (const key of keys) {
    delete result[key];
  }
  
  return result;
}