# Ariadne Immutability Guidelines

## Overview

This document outlines the immutability patterns and best practices used in the Ariadne call graph modules. Following these guidelines ensures type safety, prevents bugs, and makes our code easier to reason about.

## Core Principles

### 1. Everything is Readonly by Default

**Do:**
```typescript
interface UserData {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
}
```

**Don't:**
```typescript
interface UserData {
  id: string;
  name: string;
  tags: string[];
}
```

### 2. Use TypeScript's Built-in Immutable Types

**Do:**
```typescript
function processData(items: ReadonlyMap<string, Value>): ReadonlySet<string> {
  // Process without mutation
}
```

**Don't:**
```typescript
function processData(items: Map<string, Value>): Set<string> {
  // Could accidentally mutate input
}
```

### 3. Pure Functions Only

All functions should:
- Not modify their inputs
- Not have side effects
- Return new values instead of mutating

**Do:**
```typescript
export function add_item<T>(
  items: readonly T[], 
  item: T
): readonly T[] {
  return [...items, item];
}
```

**Don't:**
```typescript
export function add_item<T>(items: T[], item: T): void {
  items.push(item); // Mutation!
}
```

### 4. Immutable Update Patterns

Use spread operators and immutable methods:

**Do:**
```typescript
// Object update
const updated = { ...original, field: newValue };

// Array update
const updated = [...original, newItem];
const filtered = original.filter(item => item.valid);

// Map update
const updated = new Map(original);
updated.set(key, value);
```

**Don't:**
```typescript
// Direct mutation
original.field = newValue;
original.push(newItem);
original.set(key, value);
```

### 5. Deep Immutability

Use the `DeepReadonly` utility type for nested structures:

```typescript
import { DeepReadonly } from './immutable_types';

type Config = DeepReadonly<{
  server: {
    host: string;
    port: number;
  };
  features: string[];
}>;
```

### 6. Const Assertions for Literals

Use `as const` for configuration and constant values:

```typescript
const CONFIG = {
  maxRetries: 3,
  timeout: 5000,
  endpoints: ['api/v1', 'api/v2']
} as const;
```

## Practical Examples

### Creating Immutable Data Structures

```typescript
// Define with all readonly
export interface ProjectData {
  readonly files: ReadonlyMap<string, FileData>;
  readonly config: DeepReadonly<Config>;
  readonly stats: {
    readonly totalFiles: number;
    readonly totalLines: number;
  };
}

// Create function returns immutable structure
export function create_project(): ProjectData {
  return {
    files: new Map(),
    config: DEFAULT_CONFIG,
    stats: { totalFiles: 0, totalLines: 0 }
  };
}
```

### Update Functions

```typescript
// Update with structural sharing
export function update_file(
  project: ProjectData,
  path: string,
  data: FileData
): ProjectData {
  const newFiles = new Map(project.files);
  newFiles.set(path, data);
  
  return {
    ...project,
    files: newFiles,
    stats: {
      ...project.stats,
      totalFiles: newFiles.size
    }
  };
}
```

### Two-Phase Pattern

```typescript
// Phase 1: Collect data (no mutations)
export function analyze_files(
  files: ReadonlyMap<string, FileData>
): AnalysisResult {
  const results = [];
  for (const [path, data] of files) {
    results.push(analyze_single_file(path, data));
  }
  return { results };
}

// Phase 2: Build final structure
export function build_from_analysis(
  analysis: AnalysisResult
): ProjectData {
  // Construct immutable result
  return create_project_from_results(analysis);
}
```

## Testing Immutability

```typescript
describe('Immutability', () => {
  it('should not mutate input', () => {
    const original = create_data();
    const originalCopy = { ...original };
    
    const result = update_data(original, newValue);
    
    // Original unchanged
    expect(original).toEqual(originalCopy);
    // Result is different
    expect(result).not.toBe(original);
  });
});
```

## Common Patterns in Ariadne

### 1. Type Tracking
```typescript
// Immutable type tracker
export interface TypeTrackerData {
  readonly variables: ReadonlyMap<string, readonly TypeInfo[]>;
  readonly imports: ReadonlyMap<string, ImportInfo>;
}
```

### 2. Call Analysis
```typescript
// Analysis returns results without mutations
export function analyze_calls(
  def: Def,
  context: ReadonlyContext
): CallAnalysisResult {
  // Pure analysis, no side effects
  return {
    calls: detected_calls,
    types: discovered_types
  };
}
```

### 3. Graph Building
```typescript
// Two-phase: analyze then build
const analysis = await analyze_all_files(config);
const graph = build_from_analysis(analysis);
```

## Checklist for New Code

- [ ] All interface properties are `readonly`
- [ ] Function parameters use readonly types
- [ ] Return types are immutable (ReadonlyArray, ReadonlyMap, etc.)
- [ ] No mutations in function bodies
- [ ] Spread operators used for updates
- [ ] Const assertions for literal values
- [ ] DeepReadonly for nested structures
- [ ] Tests verify immutability

## Performance Tips

1. **Structural Sharing**: Reuse unchanged parts
2. **Batch Updates**: Group multiple changes
3. **Lazy Evaluation**: Defer expensive operations
4. **Memoization**: Cache pure function results

## Migration Guide

When converting mutable code:

1. Add `readonly` to all interface properties
2. Change mutable methods to return new instances
3. Replace mutations with spread operators
4. Update tests to verify immutability
5. Document any necessary mutations

## Exceptions

In rare cases where mutation is necessary:

1. Document why mutation is required
2. Isolate mutable code in specific functions
3. Convert to immutable at API boundaries
4. Add tests to ensure mutations don't leak

## Further Reading

- [TypeScript Handbook: Readonly](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties)
- [Immutable Update Patterns](https://redux.js.org/usage/structuring-reducers/immutable-update-patterns)
- [Functional Programming in TypeScript](https://gcanti.github.io/fp-ts/)