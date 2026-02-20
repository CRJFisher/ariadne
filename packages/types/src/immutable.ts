export function create_readonly_array<T>(array: T[]): readonly T[] {
  return Object.freeze(array);
}

export function create_readonly_map<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  // Maps are already compatible, just need type assertion
  return map as ReadonlyMap<K, V>;
}
