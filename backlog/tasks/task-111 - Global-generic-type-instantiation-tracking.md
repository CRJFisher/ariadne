# Task 111: Global Generic Type Instantiation Tracking

**Status:** Ready  
**Priority:** Medium  
**Created:** 2025-09-03  
**Size:** Large  
**Category:** Type System Enhancement

## Problem Statement

The system currently resolves generic types **in context** (e.g., resolving `Array<T>` to `Array<string>` in a specific usage), but doesn't build a **global registry** of all concrete instantiations of each generic type across the codebase. This means we can't answer questions like "What are all the types that `Array<T>` has been instantiated with?" or "Which concrete types are used with `Map<K,V>`?"

This limits our ability to understand type usage patterns, perform comprehensive type checking, and identify potential type safety issues or optimization opportunities.

## Current Behavior

### What Works ✅

1. **Local Generic Resolution**:

   - `resolve_generics_across_files()` processes each file
   - Resolves generic parameters to concrete types in context
   - Returns `Map<string, ResolvedGeneric[]>` per file
   - Handles constraints and defaults correctly

2. **Example**: In file A:
   ```typescript
   const users: Array<User> = [];
   const names: Array<string> = [];
   ```
   Produces: `ResolvedGeneric { original: "Array<T>", resolved: "Array<User>" }`
   and `ResolvedGeneric { original: "Array<T>", resolved: "Array<string>" }`

### What's Missing ❌

3. **No Global Aggregation**:

   - Each file's generics resolved independently
   - No cross-file instantiation tracking
   - No registry of "all types used with Array<T>"
   - Can't query "what types implement Comparable<T>?"

4. **No Instantiation Graph**:
   - No connection between generic definitions and all their uses
   - No tracking of nested generic instantiations
   - No understanding of generic type flow

## Desired Behavior

Build a comprehensive **Generic Instantiation Registry** that tracks all concrete instantiations globally:

### Core Data Structure

```typescript
interface GenericInstantiationRegistry {
  // Map from generic type to all its instantiations
  instantiations: Map<string, Set<ConcreteInstantiation>>;

  // Map from file to generic uses in that file
  by_file: Map<FilePath, GenericUsage[]>;

  // Reverse mapping: concrete type to generics it's used with
  concrete_to_generic: Map<string, Set<string>>;

  // Statistics and patterns
  statistics: GenericUsageStatistics;
}

interface ConcreteInstantiation {
  generic_type: string; // e.g., "Array<T>"
  concrete_type: string; // e.g., "Array<string>"
  type_arguments: string[]; // e.g., ["string"]
  location: Location; // Where instantiated
  context: InstantiationContext; // How it was instantiated
}

interface InstantiationContext {
  kind: "explicit" | "inferred" | "constraint" | "default";
  in_function?: string;
  in_class?: string;
  in_return_type?: boolean;
  in_parameter?: boolean;
  in_variable?: boolean;
}
```

### Query Interface

```typescript
// Get all instantiations of a generic type
registry.get_all_instantiations("Array<T>");
// => Set<"string", "number", "User", "Promise<Data>", ...>

// Get all generic types instantiated with a concrete type
registry.get_generics_using("string");
// => Set<"Array<T>", "Promise<T>", "Observable<T>", ...>

// Find patterns
registry.find_most_used_instantiation("Map<K,V>");
// => { K: "string" (85%), V: "any" (45%) }

// Check if a specific instantiation exists
registry.has_instantiation("Set<T>", "User");
// => true/false with locations

// Get instantiation statistics
registry.get_statistics();
// => { total_generics: 47, total_instantiations: 234, most_used: "Array<T>" }
```

## Technical Implementation

### Phase 1: Extend Generic Resolution

Modify `resolve_generics_across_files()` to build global registry:

```typescript
export async function resolve_generics_across_files(
  analyses: FileAnalysis[],
  type_registry: TypeRegistry,
  class_hierarchy: ClassHierarchy,
  modules: ModuleGraph
): Promise<{
  by_file: Map<string, ResolvedGeneric[]>;
  global_registry: GenericInstantiationRegistry; // NEW
}> {
  const by_file = new Map<string, ResolvedGeneric[]>();
  const global_registry = create_generic_registry();

  for (const analysis of analyses) {
    const file_generics: ResolvedGeneric[] = [];

    // Process each generic resolution
    for (const generic of resolve_file_generics(analysis)) {
      file_generics.push(generic);

      // NEW: Add to global registry
      global_registry.add_instantiation({
        generic_type: generic.original_type,
        concrete_type: generic.resolved_type,
        type_arguments: extract_type_arguments(generic),
        location: generic.location,
        context: determine_context(generic, analysis),
      });
    }

    by_file.set(analysis.file_path, file_generics);
  }

  // NEW: Build reverse mappings and statistics
  global_registry.build_indices();
  global_registry.calculate_statistics();

  return { by_file, global_registry };
}
```

### Phase 2: Track Generic Flow

Track how generic types flow through the codebase:

```typescript
interface GenericFlow {
  source: GenericSource; // Where generic is defined
  instantiation_sites: Location[]; // Where it's instantiated
  propagation_paths: FlowPath[]; // How types flow through
}

interface FlowPath {
  from: Location;
  to: Location;
  via: "parameter" | "return" | "assignment" | "inheritance";
  type_transformation?: string; // e.g., "T" -> "Array<T>"
}
```

### Phase 3: Handle Complex Scenarios

#### Nested Generics

```typescript
Map<string, Array<Promise<User>>>;
// Should track:
// - Map<K,V> instantiated with K=string, V=Array<Promise<User>>
// - Array<T> instantiated with T=Promise<User>
// - Promise<T> instantiated with T=User
```

#### Partial Instantiation

```typescript
class Container<T, U> {}
type StringContainer<U> = Container<string, U>;
const c: StringContainer<number> = ...;
// Track partial: Container<string, *>
// Track full: Container<string, number>
```

#### Generic Constraints

```typescript
function process<T extends Comparable>(item: T) {}
process(new User()); // User must implement Comparable
// Track: Comparable constraint satisfied by User
```

## Use Cases

### 1. Type Safety Analysis

- Find all types used with collections to ensure they're serializable
- Verify all `Comparable<T>` instantiations actually implement comparison

### 2. Performance Optimization

- Identify heavily used generic instantiations for specialization
- Find unnecessary boxing/unboxing patterns

### 3. Code Quality

- Detect overuse of `any` in generic instantiations
- Find inconsistent type usage patterns

### 4. Documentation Generation

- Auto-generate "Known instantiations" for generic types
- Create type usage heat maps

### 5. Refactoring Support

- Understand impact of changing generic constraints
- Find all places a specific instantiation is used

## Test Scenarios

### Basic Collection Tracking

```typescript
// File1.ts
const numbers: Array<number> = [1, 2, 3];
const strings: Array<string> = ["a", "b"];

// File2.ts
const users: Array<User> = [];
const promises: Array<Promise<Data>> = [];

// Registry should show:
// Array<T> instantiated with: [number, string, User, Promise<Data>]
```

### Cross-File Generic Flow

```typescript
// lib.ts
export class Container<T> {
  value: T;
}

// app.ts
import { Container } from "./lib";
const c1: Container<string> = new Container();
const c2: Container<User> = new Container();

// Registry should track Container<T> across file boundaries
```

### Constraint Satisfaction Tracking

```typescript
interface Comparable<T> {
  compareTo(other: T): number;
}

class User implements Comparable<User> { ... }
class Product implements Comparable<Product> { ... }

// Registry should track:
// Comparable<T> implemented by: [User, Product]
```

### Higher-Order Generics

```typescript
type Mapper<T, U> = (value: T) => U;
const stringToNumber: Mapper<string, number> = (s) => s.length;
const userToString: Mapper<User, string> = (u) => u.name;

// Registry should track:
// Mapper<T,U> instantiated with: [[string,number], [User,string]]
```

## Success Criteria

- [ ] Global registry tracks ALL generic instantiations across codebase
- [ ] Can query all concrete types used with any generic
- [ ] Can query all generics instantiated with any concrete type
- [ ] Handles nested generics correctly
- [ ] Tracks partial instantiations
- [ ] Provides usage statistics and patterns
- [ ] Handles cross-file generic usage
- [ ] Performance acceptable for large codebases (< 1s for 10K files)
- [ ] Tests verify complex scenarios (nested, partial, constrained)

## Dependencies

- Requires generic resolution to be working (currently is ✅)
- Should integrate with type registry
- Should integrate with type propagation
- May affect type checking performance

## Future Enhancements

1. **Variance Analysis** - Track covariant/contravariant usage
2. **Generic Specialization** - Suggest monomorphization opportunities
3. **Type Pattern Mining** - Detect common generic usage patterns
4. **Incremental Updates** - Update registry on file changes only
5. **Visual Generic Explorer** - UI to explore generic relationships
6. **Smart Suggestions** - Suggest likely instantiations based on patterns
7. **Generic Coverage** - Report which generic parameters are never instantiated

## Implementation Priority

### Must Have (P0)

- Basic instantiation tracking
- Cross-file aggregation
- Simple query interface

### Should Have (P1)

- Nested generic handling
- Constraint tracking
- Usage statistics

### Nice to Have (P2)

- Generic flow analysis
- Pattern detection
- Performance optimizations

## Notes

This enhancement would provide unprecedented visibility into how generic types are actually used across a codebase. It's particularly valuable for:

- Large codebases with extensive generic usage
- Library authors wanting to understand API usage
- Performance optimization (identifying monomorphization opportunities)
- Type safety audits

The implementation should be careful about memory usage - we don't want to store duplicate information unnecessarily. Consider using interned strings or symbols for type names.
