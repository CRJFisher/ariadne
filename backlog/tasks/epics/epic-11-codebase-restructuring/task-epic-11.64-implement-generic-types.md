---
id: task-epic-11.64
title: Implement Generic Type Resolution
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, layer-7, type-system, missing-functionality]
dependencies: [task-epic-11.60, task-epic-11.61]
parent_task_id: epic-11
---

## Description

Implement comprehensive generic type support across the codebase. Currently, there's no handling of generic/template types, causing type tracking to fail for generic code and breaking call resolution for generic methods.

## Context

From PROCESSING_PIPELINE.md:
- Layer 3: Need Generic Type Parameter Extraction (per-file)
- Layer 7: Need Generic Type Resolution (global, resolving with concrete types)

From ARCHITECTURE_ISSUES.md (Issue #10):
- No modules handle generic/template types
- Cannot analyze generic code properly
- Type tracking fails for generic instances
- Call resolution breaks for generic methods

## Acceptance Criteria

### Phase 1: Generic Parameter Extraction (Per-File)
- [ ] Create `/type_analysis/generic_extraction/index.ts` module
- [ ] Extract generic parameters from:
  - Class definitions: `class Box<T> {}`
  - Function definitions: `function map<T, U>()`
  - Interface definitions: `interface Container<T>`
  - Type aliases: `type Nullable<T> = T | null`
- [ ] Extract constraints:
  - TypeScript: `<T extends Base>`
  - Rust: `<T: Clone + Debug>`
  - Python: `Generic[T]`, `TypeVar('T', bound=Base)`
- [ ] Extract defaults: `<T = string>`

### Phase 2: Generic Type Resolution (Global)
- [ ] Create `/type_analysis/generic_resolution/index.ts` module
- [ ] Resolve generic parameters with concrete types:
  ```typescript
  // Box<string> → Box with T=string
  // map<number, string> → map with T=number, U=string
  ```
- [ ] Track generic instantiations through code flow
- [ ] Handle generic inference:
  ```typescript
  const box = new Box(42); // Infer Box<number>
  ```
- [ ] Support partial type application

### Phase 3: Language-Specific Features

**TypeScript:**
- [ ] Mapped types: `{ [K in keyof T]: T[K] }`
- [ ] Conditional types: `T extends U ? X : Y`
- [ ] Template literal types: `` `prefix_${T}` ``
- [ ] Variance annotations: `in T`, `out T`

**Rust:**
- [ ] Associated types: `type Item`
- [ ] Higher-ranked trait bounds: `for<'a>`
- [ ] Const generics: `Array<T, N>`

**Python:**
- [ ] TypeVar with constraints and bounds
- [ ] Generic base classes: `class MyList(Generic[T])`
- [ ] Protocol with generics

**JavaScript:**
- [ ] JSDoc generics: `@template T`
- [ ] Flow type parameters (if supporting Flow)

### Phase 4: Integration
- [ ] Update class_detection to extract generic parameters
- [ ] Update type_registry to store generic definitions
- [ ] Update type_tracking to handle generic instantiations
- [ ] Update method_calls to resolve generic method calls
- [ ] Update constructor_calls for generic constructors

### Phase 5: Type Inference
- [ ] Infer generic types from usage:
  ```typescript
  function identity<T>(x: T): T { return x; }
  const num = identity(42); // Infer T=number
  ```
- [ ] Constraint propagation
- [ ] Handle ambiguous cases
- [ ] Error on constraint violations

### Testing
- [ ] Test generic parameter extraction
- [ ] Test constraint validation
- [ ] Test generic instantiation
- [ ] Test type inference
- [ ] Test complex generic scenarios:
  - Nested generics: `Map<string, Array<T>>`
  - Multiple parameters: `<T, U, V>`
  - Recursive generics: `type Tree<T> = T | Tree<T>[]`

## Implementation Notes

### Data Structures

```typescript
interface GenericParameter {
  name: string;
  constraint?: TypeExpression;
  default?: TypeExpression;
  variance?: 'in' | 'out' | 'invariant';
}

interface GenericInstantiation {
  base_type: string;
  type_arguments: Map<string, TypeExpression>;
  resolved_type: TypeExpression;
}

interface GenericContext {
  parameters: GenericParameter[];
  instantiations: GenericInstantiation[];
  constraints: ConstraintSet;
}
```

### Resolution Algorithm
1. Extract generic parameters from definition
2. When encountering usage, collect type arguments
3. Validate constraints
4. Substitute type parameters with arguments
5. Return resolved type

### Inference Algorithm
1. Collect constraints from usage context
2. Build constraint equations
3. Solve using unification
4. Check solution against bounds
5. Apply default types if needed

### Performance Considerations
- Cache resolved generic instantiations
- Lazy evaluation of complex types
- Limit recursion depth for recursive types

## Migration to @ariadnejs/types

All generic type interfaces must be added to `@ariadnejs/types`:
```typescript
// In @ariadnejs/types
export interface GenericParameter { ... }
export interface GenericInstantiation { ... }
export type TypeExpression = ... // Union of all type forms
```

## Success Metrics
- Can extract all generic parameters from code
- Can resolve generic instantiations correctly
- Type inference works for common cases
- No regression in non-generic code analysis
- Performance impact < 10% on analysis time

## References
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layers 3 & 7)
- Architecture issues: `/packages/core/ARCHITECTURE_ISSUES.md` (Issue #10)
- Related modules:
  - `/inheritance/class_detection` (needs to extract generics)
  - `/type_analysis/type_registry` (needs to store generics)
  - `/type_analysis/type_tracking` (needs to track instantiations)

## Notes
This is a complex feature that touches many parts of the system. Consider implementing incrementally:
1. Start with extraction only
2. Add basic resolution
3. Add inference
4. Add advanced features (mapped types, etc.)