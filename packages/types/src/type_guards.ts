/**
 * Type guards and assertion functions for enforcing non-nullability
 *
 * This module provides utilities for cases where nullability is genuinely necessary
 * and we need to handle null/undefined values safely with proper type narrowing.
 */

/**
 * Assertion function that throws if value is null or undefined
 */
export function assert_not_null<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value == null) {
    throw new Error(message);
  }
}

/**
 * Type guard to check if value is not null or undefined
 */
export function is_not_null<T>(value: T | null | undefined): value is T {
  return value != null;
}

/**
 * Type guard to check if value is defined (not undefined)
 */
export function is_defined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Type guard to check if value is not null specifically
 */
export function is_not_null_value<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * Assert that an array is not null/undefined and return as non-null
 */
export function assert_array<T>(
  value: readonly T[] | null | undefined,
  message: string
): asserts value is readonly T[] {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that a Map is not null/undefined and return as non-null
 */
export function assert_map<K, V>(
  value: Map<K, V> | null | undefined,
  message: string
): asserts value is Map<K, V> {
  if (!(value instanceof Map)) {
    throw new Error(message);
  }
}

/**
 * Assert that a string is not null/undefined/empty and return as non-null
 */
export function assert_non_empty_string(
  value: string | null | undefined,
  message: string
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(message);
  }
}

/**
 * Type guard for non-empty arrays
 */
export function is_non_empty_array<T>(value: readonly T[]): value is readonly [T, ...T[]] {
  return value.length > 0;
}

/**
 * Type guard for non-empty strings
 */
export function is_non_empty_string(value: string): value is string {
  return value.length > 0;
}

/**
 * Get Map value with assertion that it exists
 */
export function get_map_value<K, V>(
  map: Map<K, V>,
  key: K,
  errorMessage: string
): V {
  const value = map.get(key);
  assert_not_null(value, `${errorMessage}: Key "${String(key)}" not found in map`);
  return value;
}

/**
 * Get Map value or return default (type-safe alternative to || operator)
 */
export function get_map_value_or_default<K, V>(
  map: Map<K, V>,
  key: K,
  defaultValue: V
): V {
  const value = map.get(key);
  return value !== undefined ? value : defaultValue;
}

/**
 * Get array from Map or return empty array (type-safe)
 */
export function get_map_array_or_empty<K, T>(
  map: Map<K, T[]>,
  key: K
): T[] {
  return map.get(key) ?? [];
}

/**
 * Type guard for checking if an object has a specific property
 */
export function has_property<T extends object, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return prop in obj;
}

/**
 * Type guard for checking if an object has a specific property with expected type
 */
export function has_property_of_type<T extends object, K extends string, V>(
  obj: T,
  prop: K,
  typeGuard: (value: unknown) => value is V
): obj is T & Record<K, V> {
  return prop in obj && typeGuard((obj as any)[prop]);
}

/**
 * Assert that a value matches a specific type using a type guard
 */
export function assert_type<T>(
  value: unknown,
  typeGuard: (value: unknown) => value is T,
  message: string
): asserts value is T {
  if (!typeGuard(value)) {
    throw new Error(message);
  }
}

/**
 * Filter out null and undefined values from an array (type-safe)
 */
export function filter_non_null<T>(array: readonly (T | null | undefined)[]): T[] {
  return array.filter(is_not_null);
}

/**
 * Find first non-null value in an array
 */
export function find_non_null<T>(array: readonly (T | null | undefined)[]): T | undefined {
  return array.find(is_not_null);
}

/**
 * Assert that an optional field is present and return as non-optional
 */
export function assert_field_present<T, K extends keyof T>(
  obj: T,
  field: K,
  message: string
): asserts obj is T & Required<Pick<T, K>> {
  if (obj[field] == null) {
    throw new Error(`${message}: Required field '${String(field)}' is missing`);
  }
}

/**
 * Type guard to check if an optional field is present
 */
export function has_field<T, K extends keyof T>(
  obj: T,
  field: K
): obj is T & Required<Pick<T, K>> {
  return obj[field] != null;
}

/**
 * Assert that all required fields are present in a partial object
 */
export function assert_required_fields<T extends object>(
  obj: Partial<T>,
  requiredFields: (keyof T)[],
  message: string
): asserts obj is T {
  for (const field of requiredFields) {
    if (obj[field] == null) {
      throw new Error(`${message}: Required field '${String(field)}' is missing`);
    }
  }
}

/**
 * Type guard for objects that have all specified required fields
 */
export function has_required_fields<T extends object>(
  obj: Partial<T>,
  requiredFields: (keyof T)[]
): obj is T {
  return requiredFields.every(field => obj[field] != null);
}

/**
 * Assert that a value is in a specific array of valid values (for enums/unions)
 */
export function assert_valid_value<T extends readonly unknown[]>(
  value: unknown,
  validValues: T,
  message: string
): asserts value is T[number] {
  if (!validValues.includes(value)) {
    throw new Error(`${message}: Value "${String(value)}" is not one of: ${validValues.map(String).join(', ')}`);
  }
}

/**
 * Type guard for checking if a value is in a specific array (for enums/unions)
 */
export function is_valid_value<T extends readonly unknown[]>(
  value: unknown,
  validValues: T
): value is T[number] {
  return validValues.includes(value);
}