/**
 * Generic functions
 * Tests: generic function parameters, type inference, constraints
 */

// Simple generic function
function identity<T>(value: T): T {
  return value;
}

// Generic function with multiple type parameters
function pair<A, B>(first: A, second: B): [A, B] {
  return [first, second];
}

// Generic function with constraint
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Generic function with extends constraint
function merge<T extends object, U extends object>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
}

// Generic array operations
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

function map<T, U>(arr: T[], fn: (item: T) => U): U[] {
  const result: U[] = [];
  for (const item of arr) {
    result.push(fn(item));
  }
  return result;
}

function filter<T>(arr: T[], predicate: (item: T) => boolean): T[] {
  const result: T[] = [];
  for (const item of arr) {
    if (predicate(item)) {
      result.push(item);
    }
  }
  return result;
}

export { identity, pair, getProperty, merge, first, last, map, filter };
