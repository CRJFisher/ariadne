/**
 * Generic classes
 * Tests: generic class definitions, generic methods, type constraints
 */

// Simple generic class
class Box<T> {
  constructor(private value: T) {}

  getValue(): T {
    return this.value;
  }

  setValue(value: T): void {
    this.value = value;
  }
}

// Generic class with multiple type parameters
class Pair<K, V> {
  constructor(
    public key: K,
    public value: V
  ) {}

  getKey(): K {
    return this.key;
  }

  getValue(): V {
    return this.value;
  }
}

// Generic class with constraints
class Collection<T extends { id: number }> {
  private items: T[] = [];

  add(item: T): void {
    this.items.push(item);
  }

  findById(id: number): T | undefined {
    return this.items.find((item) => item.id === id);
  }

  getAll(): T[] {
    return [...this.items];
  }
}

// Generic class with default type
class Result<T = string, E = Error> {
  constructor(
    public success: boolean,
    public data?: T,
    public error?: E
  ) {}

  static ok<T>(data: T): Result<T> {
    return new Result(true, data);
  }

  static err<E>(error: E): Result<never, E> {
    return new Result(false, undefined, error);
  }
}

export { Box, Pair, Collection, Result };
