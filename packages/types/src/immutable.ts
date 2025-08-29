/**
 * Immutable type utilities for enforcing deep immutability in TypeScript.
 * These utilities ensure that all data structures are readonly at compile time.
 */

/**
 * Deep readonly utility type for TypeScript immutability.
 * Makes all properties and nested properties readonly.
 */
export type DeepReadonly<T> = T extends primitive
  ? T
  : T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends ReadonlyArray<infer U>
  ? readonly DeepReadonly<U>[]
  : T extends Set<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

/**
 * Primitive types that don't need deep readonly treatment
 */
type primitive = string | number | boolean | null | undefined | symbol | bigint;

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
 * Alias for DeepReadonly for cleaner syntax
 */
export type Immutable<T> = DeepReadonly<T>;

/**
 * Make a single level of properties readonly (not deep)
 */
export type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

/**
 * Make specific properties readonly
 */
export type ReadonlyKeys<T, K extends keyof T> = T & {
  readonly [P in K]: T[P];
};

/**
 * Make all properties optional and readonly
 */
export type PartialReadonly<T> = {
  readonly [P in keyof T]?: T[P];
};

/**
 * Deep partial and readonly
 */
export type DeepPartialReadonly<T> = {
  readonly [P in keyof T]?: T[P] extends (infer U)[]
    ? readonly DeepPartialReadonly<U>[]
    : T[P] extends ReadonlyArray<infer U>
    ? readonly DeepPartialReadonly<U>[]
    : T[P] extends object
    ? DeepPartialReadonly<T[P]>
    : T[P];
};