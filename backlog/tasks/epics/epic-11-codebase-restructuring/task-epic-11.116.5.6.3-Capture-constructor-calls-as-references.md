# Task: Capture constructor calls as references in JavaScript

**ID**: epic-11.116.5.6.3
**Status**: Done
**Priority**: HIGH
**Parent**: epic-11.116.5.6
**Completed**: 2025-10-20

## Description

Constructor calls (`new Foo()`) are not currently captured as SymbolReference objects in JavaScript semantic indexing. This prevents resolution of constructor calls to their class definitions.

## Current Behavior

- `new Foo()` calls are parsed but not captured as references
- Cannot resolve constructor call location to class definition
- Tests skip constructor call verification with "might not be captured" comment
- This is a critical gap in semantic understanding

## Required Behavior

- Capture `new_expression` nodes as constructor call references
- Add appropriate query patterns in `javascript.scm`
- Create reference handler in `javascript_builder_config.ts`
- Constructor calls should resolve to class definitions via `project.resolutions.resolve()`
- Handle both local and imported class constructors

## Implementation Plan

1. **Add Query Pattern** (`javascript.scm`)
   - Add pattern to capture `new_expression` constructor identifier
   - Pattern should capture both simple and member expression constructors

2. **Create Reference Handler** (`javascript_builder_config.ts`)
   - Add handler for constructor call references
   - Set `call_type: "constructor"`
   - Extract class name from new_expression

3. **Update Tests** (`project.javascript.integration.test.ts`)
   - Revert "should capture method calls on imported class instances" to test constructor resolution
   - Revert "should handle aliased class imports and method calls" to test aliased constructor resolution
   - Tests should verify `project.resolutions.resolve()` returns the class definition

## Test Coverage

- Constructor call on imported class: `new User()` → resolves to User class in user_class.js
- Constructor call on aliased class: `new Manager()` → resolves to DataManager class in utils_aliased.js
- Constructor call on local class: already tested in "should resolve ES6 class methods"

## Acceptance Criteria

- [ ] Constructor calls captured as SymbolReference with `call_type: "constructor"`
- [ ] `project.resolutions.resolve()` returns class SymbolId for constructor calls
- [ ] Integration tests pass for imported class constructors
- [ ] Integration tests pass for aliased class constructors
- [ ] Existing tests remain passing

## Related Files

- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`
- `packages/core/src/project/project.javascript.integration.test.ts`

## Notes

TypeScript has the same limitation - consider applying the same fix to TypeScript after this is working for JavaScript.

## Implementation Notes (2025-10-20)

**Resolution**: Constructor call capture was **already fully implemented**! The tests were using incorrect filters.

### What We Found

The entire infrastructure for constructor calls was already in place:

1. **Query patterns** exist in `javascript.scm`:

   ```scheme
   (new_expression
     constructor: (identifier) @reference.constructor
   ) @reference.call
   ```

2. **Reference processing** exists in `reference_builder.ts`:
   - `ReferenceKind.CONSTRUCTOR_CALL` enum value
   - `determine_call_type()` returns `"constructor"`
   - `map_to_reference_type()` returns `"construct"`
   - `extract_construct_target()` finds the target variable

3. **All handlers** exist - constructor calls are fully processed

### The Actual Issue

Tests were filtering for the wrong reference type:

```typescript
// ❌ WRONG - Constructor refs have type "construct", not "call"
r.type === "call" && r.call_type === "constructor"

// ✅ CORRECT - Just check call_type
r.call_type === "constructor"
```

### Changes Made

Fixed test filters in `project.javascript.integration.test.ts`:

- Line 454-458: Changed to filter by `call_type` only
- Line 624-631: Changed to filter by `call_type` only

### Test Results

All 23 tests passing, 2 todo (25 total)

Both constructor call tests now pass:

- ✅ should resolve imported class constructor calls
- ✅ should resolve aliased class constructor calls

The 2 TODO tests are for method resolution (task-154).

### Key Insight

The reference type hierarchy is:

- `type: "construct"` + `call_type: "constructor"` = constructor calls
- `type: "call"` + `call_type: "function"` = function calls
- `type: "call"` + `call_type: "method"` = method calls

This was a documentation/test issue, not an implementation gap.
