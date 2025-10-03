# Task epic-11.112.6: Add Helper to ProcessingContext Interface

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.5

## Objective

Update the `ProcessingContext` interface in `semantic_index.ts` to include the new `get_defining_scope_id()` method signature with documentation.

## Files

### MODIFIED
- `packages/core/src/index_single_file/semantic_index.ts`

## Implementation Steps

### 1. Update ProcessingContext Interface (30 min)

```typescript
export interface ProcessingContext {
  captures: CaptureNode[];
  scopes: Map<ScopeId, LexicalScope>;
  scope_depths: Map<ScopeId, number>;
  root_scope_id: ScopeId;

  /**
   * Get the scope containing a given location.
   * Finds the DEEPEST scope that contains the entire location span.
   *
   * Use this for:
   * - References (variables, function calls, property access)
   * - Nested scopes
   * - Code blocks where full span matters
   *
   * @param location - The location to find scope for
   * @returns The deepest scope containing this location
   */
  get_scope_id(location: Location): ScopeId;

  /**
   * Get the scope where a definition is DECLARED.
   *
   * Uses only the START position of the location to find the scope.
   * This avoids the bug where definitions with large body spans
   * (classes, interfaces, enums) get assigned to nested scopes
   * instead of their actual declaring scope.
   *
   * Use this for:
   * - Class definitions
   * - Interface definitions (TypeScript)
   * - Enum definitions (TypeScript, Rust)
   * - Type alias definitions (TypeScript)
   * - Struct definitions (Rust)
   * - Any definition where the body contains nested scopes
   *
   * DO NOT use for:
   * - References (use get_scope_id)
   * - Function definitions (if they work correctly with get_scope_id)
   *
   * Example:
   * ```typescript
   * class MyClass {        // <-- START at line 1 (file scope)
   *   method() {           // method scope (nested)
   *     const x = 1;
   *   }
   * }                      // <-- END at line 5
   * ```
   * - capture.location spans lines 1-5
   * - get_scope_id(lines 1-5) returns method_scope ❌
   * - get_defining_scope_id(lines 1-5) uses line 1 only, returns file_scope ✓
   *
   * @param location - The definition location (only start position used)
   * @returns The scope_id where this definition should be registered
   */
  get_defining_scope_id(location: Location): ScopeId;
}
```

### 2. Verify TypeScript Compilation (10 min)

```bash
cd packages/core
npx tsc --noEmit
```

Expected: Compiles with no errors.

### 3. Update Import Statements (10 min)

Verify that `Location` type is imported:

```typescript
import type {
  FilePath,
  Language,
  ScopeId,
  Location  // Make sure this is imported
} from "@ariadnejs/types";
```

### 4. Test with Temporary Usage (10 min)

Temporarily test the interface works:

```typescript
// In any language_config file, try using it:
scope_id: context.get_defining_scope_id(capture.location)

// TypeScript should autocomplete and show documentation
```

Remove temporary usage after verification.

## Success Criteria

- ✅ Interface updated with new method signature
- ✅ Comprehensive JSDoc documentation added
- ✅ TypeScript compiles without errors
- ✅ Autocomplete works in language config files
- ✅ Ready for tasks 11.112.7-13

## Outputs

- Updated `ProcessingContext` interface with new method

## Next Task

**task-epic-11.112.7** - Fix JavaScript class scope assignment
