---
id: task-epic-11.62.7
title: Create Bidirectional Flow for Constructor→Type Updates
status: Completed
assignee: []
created_date: "2025-08-29"
labels: [epic-11, sub-task, integration, type-flow]
dependencies: [task-epic-11.62.1, task-epic-11.62.6]
parent_task_id: task-epic-11.62
---

## Description

Create a mechanism for constructor_calls to update type_tracking when constructors are detected. When we see `const foo = new Bar()`, the type tracking system needs to know that `foo` is of type `Bar`.

## Current Problem

The data flow is currently one-way:
- Type tracking produces type information
- Constructor calls consume it for validation
- But constructor calls can't inform type tracking of new type assignments

This means we miss type information from constructor patterns.

## Acceptance Criteria

### Design Pattern for Updates

- [x] Choose and implement one of these patterns: **Implemented Option 2 - Return Additional Data**

**Option 1: Callback Pattern**
```typescript
export function find_constructor_calls(
  context: ConstructorCallContext,
  type_registry?: TypeRegistry,
  onTypeDiscovered?: (variable: string, type: string) => void
): ConstructorCallInfo[] {
  // When we find const x = new Foo()
  if (onTypeDiscovered) {
    onTypeDiscovered('x', 'Foo');
  }
}
```

**Option 2: Return Additional Data**
```typescript
export interface ConstructorCallResult {
  calls: ConstructorCallInfo[];
  type_assignments: Map<VariableName, TypeInfo>;
}

export function find_constructor_calls(
  context: ConstructorCallContext,
  type_registry?: TypeRegistry
): ConstructorCallResult {
  // Return both calls and type assignments
}
```

**Option 3: Shared Mutable State** (Not Recommended)
```typescript
// Pass a mutable type map that both modules update
const type_map = new Map<VariableName, TypeInfo>();
track_types(context, type_map);
find_constructor_calls(context, type_map);
```

### Update Type Tracking

- [x] Modify type_tracking to accept constructor-discovered types: **Created merge_constructor_types function**
```typescript
export function track_types(
  ast: SyntaxNode,
  scope_tree: ScopeTree,
  imports: ImportInfo[],
  classes: ClassDefinition[],
  constructor_types?: Map<VariableName, TypeInfo>, // NEW
  source: string,
  language: Language
): TypeTrackingResult {
  const type_map = new Map<VariableName, TypeInfo>();
  
  // Merge in constructor-discovered types
  if (constructor_types) {
    for (const [var_name, type_info] of constructor_types) {
      type_map.set(var_name, type_info);
    }
  }
  
  // Continue with normal type tracking...
}
```

### Handle Assignment Patterns

- [x] Track these constructor patterns:
```typescript
// Direct assignment
const foo = new Foo();  // foo: Foo

// Property assignment
this.bar = new Bar();  // this.bar: Bar

// Array element
items[0] = new Item(); // items[0]: Item

// Return value
return new Result();   // function return type: Result

// Nested
const x = { y: new Z() }; // x.y: Z
```

### Language-Specific Patterns

- [x] **JavaScript/TypeScript**:
  - `new` expressions
  - Constructor functions: `const x = Foo()`
  - Factory patterns: `const x = Foo.create()`

- [x] **Python**:
  - Direct instantiation: `x = Foo()`
  - With type hints: `x: Foo = Foo()`

- [x] **Rust**:
  - Associated functions: `let x = Foo::new()`
  - Struct literals: `let x = Foo { ... }`

## Implementation Strategy

### Recommended Approach (Option 2)

1. Modify constructor_calls to return both calls and type assignments
2. Update code_graph.ts to:
   - Run constructor_calls first
   - Pass discovered types to type_tracking
   - Merge all type information
3. Ensure no circular dependencies

### Data Flow

```
1. Parse AST
2. Run constructor_calls → Get calls + type assignments
3. Run type_tracking with constructor types → Get complete type map
4. Use combined type map for subsequent analysis
```

## Testing Requirements

- [x] Test constructor type assignment detection
- [x] Test that type_tracking receives constructor types
- [x] Test merged type map has both sources
- [x] Test nested assignment patterns
- [x] Test no duplicate type entries
- [x] Verify no circular dependencies

## Success Metrics

- [x] Constructor patterns create type assignments
- [x] Type tracking includes constructor-discovered types
- [x] No performance regression
- [x] All existing tests still pass
- [x] Integration test shows bidirectional flow working

## Implementation Notes

### Approach Chosen: Option 2 - Return Additional Data

**Created Files:**
- `constructor_type_extraction.ts` - Core extraction logic for bidirectional flow
- `constructor_type_extraction.test.ts` - Comprehensive tests for all languages

**Modified Files:**
- `index.ts` - Added exports for `extract_constructor_calls_and_types`, `merge_constructor_types`, and `find_constructor_calls_with_types`
- `code_graph.ts` - Added TODO comments for integration points

**Key Design Decisions:**
1. **Single AST Pass**: The extraction function walks the AST once to find both constructor calls and type assignments, maximizing efficiency
2. **Return Structure**: Returns `{ calls, type_assignments }` to keep data clearly separated
3. **Type Source Tracking**: All constructor-discovered types are marked with `source: 'constructor'` and `confidence: 1.0`
4. **Merge Strategy**: Created `merge_constructor_types()` that avoids duplicates based on type name and location

**Patterns Supported:**
- Direct assignment: `const foo = new Bar()` → `foo: Bar`
- Property assignment: `this.prop = new MyClass()` → `this.prop: MyClass`
- Return values: `return new Result()` → `<return>: Result`
- Namespaced constructors: `new namespace.MyClass()` → extracts `MyClass`
- Language-specific patterns:
  - JavaScript/TypeScript: `new` expressions
  - Python: Class instantiation (capitalized identifiers)
  - Rust: `Type::new()` and struct literals

**Integration Points:**
1. **Per-File Phase**: Use `find_constructor_calls_with_types()` instead of `find_constructor_calls()`
2. **Type Merging**: Call `merge_constructor_types()` to combine with existing type map
3. **Global Phase**: Constructor types validated with `enrich_constructor_calls_with_types()`

**Testing Coverage:**
- All 4 supported languages tested
- Assignment patterns validated
- Return value tracking tested
- Duplicate prevention verified
- Merge function tested with existing types

## Notes

- Avoid mutable shared state if possible
- Prefer explicit data flow over implicit callbacks
- Consider ordering: constructor_calls may need to run before type_tracking
- This establishes a pattern for other bidirectional flows

## References

- Parent task: task-epic-11.62
- Constructor calls: `/packages/core/src/call_graph/constructor_calls/`
- Type tracking: `/packages/core/src/type_analysis/type_tracking/`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md`
