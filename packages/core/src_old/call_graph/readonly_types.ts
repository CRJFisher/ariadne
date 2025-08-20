/**
 * Deep readonly utility type for TypeScript immutability
 * Makes all properties and nested properties readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T[P] extends ReadonlyArray<infer U>
    ? readonly DeepReadonly<U>[]
    : T[P] extends Set<infer U>
    ? ReadonlySet<DeepReadonly<U>>
    : T[P] extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

/**
 * Utility type to make specific properties mutable
 * Useful when you need controlled mutability
 */
export type Mutable<T, K extends keyof T> = Omit<T, K> & {
  -readonly [P in K]: T[P];
};

/**
 * Utility type for immutable arrays
 */
export type ImmutableArray<T> = readonly DeepReadonly<T>[];

/**
 * Utility type for immutable maps
 */
export type ImmutableMap<K, V> = ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>;

/**
 * Utility type for immutable sets
 */
export type ImmutableSet<T> = ReadonlySet<DeepReadonly<T>>;

/**
 * Type guard to check if a value is readonly
 */
export function isReadonly<T>(value: T | DeepReadonly<T>): value is DeepReadonly<T> {
  // This is a compile-time check, runtime always returns true
  return true;
}

/**
 * Helper to create a deep readonly copy of an object
 * Note: This is a type assertion, not runtime immutability
 */
export function asDeepReadonly<T>(value: T): DeepReadonly<T> {
  return value as DeepReadonly<T>;
}

/**
 * Helper to create an immutable array
 */
export function asImmutableArray<T>(arr: T[]): ImmutableArray<T> {
  return arr as ImmutableArray<T>;
}

/**
 * Helper for const assertions
 */
export function asConst<T extends readonly unknown[] | Record<string, unknown>>(value: T): T {
  return value;
}