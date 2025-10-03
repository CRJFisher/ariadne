# Task epic-11.112.5: Implement get_defining_scope_id Helper

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2 hours
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.4

## Objective

Implement the `get_defining_scope_id()` helper function in `scope_processor.ts` that uses start position only to find the defining scope.

## Files

### MODIFIED
- `packages/core/src/index_single_file/scopes/scope_processor.ts`

## Implementation Steps

### 1. Add Function to create_processing_context (60 min)

```typescript
export function create_processing_context(
  scopes: Map<ScopeId, LexicalScope>,
  captures: CaptureNode[]
): ProcessingContext {
  const scope_depths = new Map<ScopeId, number>();
  const root_scope_id = find_root_scope(scopes);

  // Precompute all depths once
  for (const scope of scopes.values()) {
    scope_depths.set(scope.id, compute_scope_depth(scope, scopes));
  }

  return {
    captures,
    scopes,
    scope_depths,
    root_scope_id,

    get_scope_id(location: Location): ScopeId {
      // Existing implementation...
      let best_scope_id = root_scope_id;
      let best_depth = 0;

      for (const scope of scopes.values()) {
        if (location_contains(scope.location, location)) {
          const depth = scope_depths.get(scope.id)!;
          if (depth > best_depth) {
            best_scope_id = scope.id;
            best_depth = depth;
          }
        }
      }

      return best_scope_id;
    },

    // NEW METHOD
    get_defining_scope_id(location: Location): ScopeId {
      // Use only START position to find the scope where a symbol is DECLARED
      // This prevents the bug where a class body containing nested methods
      // causes the class to be assigned to a method scope instead of its
      // actual declaring scope.
      const start_point_location: Location = {
        file_path: location.file_path,
        start_line: location.start_line,
        start_column: location.start_column,
        // Make it a point, not a span
        end_line: location.start_line,
        end_column: location.start_column,
      };

      // Reuse get_scope_id logic with the point location
      return this.get_scope_id(start_point_location);
    },
  };
}
```

### 2. Add JSDoc Documentation (15 min)

```typescript
/**
 * Get the scope where a definition is DECLARED.
 *
 * Unlike get_scope_id(), this uses only the START position to find the scope.
 * This is crucial for definitions whose location spans their entire body
 * (classes, interfaces, enums) to avoid assigning them to nested scopes.
 *
 * Example:
 * ```typescript
 * class MyClass {        // <-- START position (line 1, col 0) - in file scope
 *   method() {           // method scope created (child of file scope)
 *     const x = 1;
 *   }
 * }                      // <-- END position (line 5, col 0)
 * ```
 *
 * Using the full span (lines 1-5) with get_scope_id() would return method_scope
 * because it's the deepest scope in that range. Using start position (line 1, col 0)
 * correctly returns file_scope.
 *
 * @param location - The location of the definition (only start position is used)
 * @returns The scope_id where this definition should be registered
 */
get_defining_scope_id(location: Location): ScopeId {
  // ... implementation ...
}
```

### 3. Create Unit Tests (30 min)

Add to `scope_processor.test.ts`:

```typescript
describe("get_defining_scope_id", () => {
  it("returns file scope for class at file level, not method scope", () => {
    const file_location = create_location(1, 0, 100, 0);
    const class_location = create_location(10, 0, 30, 1);
    const method_location = create_location(15, 2, 20, 3);

    const captures: CaptureNode[] = [
      create_raw_capture("scope", "class", class_location, "MyClass"),
      create_raw_capture("scope", "method", method_location, "myMethod"),
    ];

    const scopes = process_scopes(captures, file);
    const context = create_processing_context(scopes, captures);

    const defining_scope = context.get_defining_scope_id(class_location);
    const file_scope = Array.from(scopes.values()).find(
      (s) => s.parent_id === null
    );

    expect(defining_scope).toBe(file_scope?.id);
  });

  it("returns parent scope for nested class", () => {
    const outer_method_location = create_location(5, 0, 40, 1);
    const inner_class_location = create_location(10, 2, 30, 3);
    const inner_method_location = create_location(15, 4, 20, 5);

    const captures: CaptureNode[] = [
      create_raw_capture("scope", "method", outer_method_location, "outerMethod"),
      create_raw_capture("scope", "class", inner_class_location, "InnerClass"),
      create_raw_capture("scope", "method", inner_method_location, "innerMethod"),
    ];

    const scopes = process_scopes(captures, file);
    const context = create_processing_context(scopes, captures);

    const defining_scope = context.get_defining_scope_id(inner_class_location);
    const outer_method_scope = Array.from(scopes.values()).find(
      (s) => s.name === "outerMethod"
    );

    expect(defining_scope).toBe(outer_method_scope?.id);
  });
});
```

### 4. Run Tests (10 min)

```bash
npm test -- scope_processor.test.ts
```

Expected: New tests pass.

### 5. Verify TypeScript Compilation (5 min)

```bash
cd packages/core
npx tsc --noEmit
```

Expected: No errors.

## Success Criteria

- ✅ Function implemented in scope_processor.ts
- ✅ JSDoc documentation added
- ✅ Unit tests created and passing
- ✅ TypeScript compiles
- ✅ Ready for task-epic-11.112.6

## Outputs

- Working `get_defining_scope_id()` function
- Unit tests demonstrating correctness

## Next Task

**task-epic-11.112.6** - Add helper to ProcessingContext interface
