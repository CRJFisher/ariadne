# TypeScript Immutability Patterns and Best Practices

## Core Principles

### 1. Use `readonly` Modifiers Extensively

TypeScript's `readonly` modifier prevents reassignment at compile time:

```typescript
// ✅ Good - Properties cannot be reassigned
interface Point {
  readonly x: number;
  readonly y: number;
}

// ✅ Good - Array elements cannot be modified
type ReadonlyNumbers = readonly number[];
type ReadonlyNumbers2 = ReadonlyArray<number>;

// ❌ Bad - Mutable by default
interface MutablePoint {
  x: number;
  y: number;
}
```

### 2. Use Built-in Readonly Types

TypeScript provides built-in readonly versions of common types:

```typescript
// ✅ Good - Use readonly collections
const map: ReadonlyMap<string, number> = new Map();
const set: ReadonlySet<string> = new Set();
const arr: readonly string[] = ['a', 'b'];

// ❌ Bad - Mutable collections
const mutableMap: Map<string, number> = new Map();
```

### 3. Deep Readonly with Utility Types

For nested immutability, create deep readonly types:

```typescript
// Built-in Readonly is shallow
type ShallowReadonly<T> = Readonly<T>;

// Deep readonly utility type
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Example usage
interface Config {
  server: {
    port: number;
    host: string;
  };
  features: string[];
}

type ImmutableConfig = DeepReadonly<Config>;
```

### 4. Const Assertions

Use `as const` for literal types and deep readonly:

```typescript
// ✅ Good - Everything is readonly
const config = {
  api: {
    endpoint: 'https://api.example.com',
    timeout: 5000
  },
  features: ['auth', 'logging']
} as const;

// Type is deeply readonly with literal types
// typeof config = {
//   readonly api: {
//     readonly endpoint: "https://api.example.com";
//     readonly timeout: 5000;
//   };
//   readonly features: readonly ["auth", "logging"];
// }
```

### 5. Immutable Update Patterns

Use spread operators and object/array methods that return new instances:

```typescript
// ✅ Good - Returns new object
function updateName(person: Readonly<Person>, name: string): Person {
  return { ...person, name };
}

// ✅ Good - Returns new array
function addItem<T>(items: readonly T[], item: T): T[] {
  return [...items, item];
}

// ✅ Good - Nested updates
function updateNested(state: DeepReadonly<State>, value: number): State {
  return {
    ...state,
    nested: {
      ...state.nested,
      value
    }
  };
}

// ❌ Bad - Mutates original
function badUpdate(person: Person, name: string): void {
  person.name = name; // Mutation!
}
```

### 6. Function Parameter Immutability

Make function parameters readonly by default:

```typescript
// ✅ Good - Parameters are readonly
function processItems(items: readonly Item[]): readonly ProcessedItem[] {
  return items.map(item => process(item));
}

// ❌ Bad - Could mutate input
function badProcess(items: Item[]): void {
  items.sort(); // Mutates input!
}
```

### 7. Return Type Immutability

Ensure returned values are immutable:

```typescript
// ✅ Good - Returns immutable data
class DataStore {
  private data: Map<string, Value>;
  
  getData(): ReadonlyMap<string, Value> {
    return this.data; // Safe - ReadonlyMap prevents external mutations
  }
}

// ❌ Bad - Exposes mutable internals
class BadStore {
  private data: Map<string, Value>;
  
  getData(): Map<string, Value> {
    return this.data; // Dangerous - caller can mutate!
  }
}
```

### 8. Avoid Object.freeze() in TypeScript

While `Object.freeze()` provides runtime immutability, prefer compile-time guarantees:

```typescript
// ✅ Good - Compile-time immutability
const point: Readonly<Point> = { x: 1, y: 2 };

// ⚠️ Avoid - Runtime overhead, no type safety
const frozenPoint = Object.freeze({ x: 1, y: 2 });
```

### 9. Immutability Libraries

Consider libraries for complex immutable operations:

- **Immer**: Provides a mutable API that produces immutable updates
- **Immutable.js**: Facebook's immutable collections library

However, for most cases, TypeScript's built-in features are sufficient.

### 10. Performance Considerations

1. **Structural Sharing**: Reuse unchanged parts of data structures
2. **Batch Updates**: Group multiple updates into single operations
3. **Lazy Evaluation**: Defer expensive computations
4. **Memoization**: Cache results of pure functions

## Best Practices Summary

1. **Default to Immutable**: Make everything readonly unless mutation is necessary
2. **Use TypeScript's Type System**: Leverage readonly, const assertions, and utility types
3. **Pure Functions**: Functions should not have side effects
4. **Immutable Updates**: Always return new instances, never mutate
5. **Defensive Copying**: When accepting external data, create immutable copies
6. **Document Mutability**: When mutation is necessary, clearly document why

## Anti-Patterns to Avoid

1. **Shallow Readonly**: Using `Readonly<T>` on nested structures
2. **Cast Away Readonly**: Using `as` to remove readonly modifiers
3. **Mutable Class Properties**: Class properties without readonly
4. **Array Mutation Methods**: Using push(), pop(), sort() on arrays
5. **Mixed Mutability**: Having some properties readonly and others mutable

## Migration Strategy

1. **Start with Interfaces**: Add readonly to all interface properties
2. **Update Function Signatures**: Make parameters and return types readonly
3. **Fix Compilation Errors**: Update code to use immutable patterns
4. **Add Tests**: Verify immutability is maintained
5. **Document Patterns**: Create team guidelines for immutability