# Task Epic 11.106.10 - Migrate Legacy Tests to New SemanticIndex API

**Parent Task**: [task-epic-11.106](./task-epic-11.106-Remove-Unextractable-SymbolReference-Fields.md)
**Status**: ✅ Completed
**Priority**: High
**Estimated Effort**: 2-3 hours (Actual: 15 minutes)
**Created**: 2025-10-02
**Completed**: 2025-10-02

## Objective

Update 33 legacy tests that use the deprecated SemanticIndex API to work with the current builder pattern and SemanticIndex structure, eliminating all `@ts-nocheck` annotations and test failures.

## Context

During Epic 11.106 full test suite validation, 33 test failures were identified that are NOT related to the SymbolReference interface changes, but rather to tests using an old/deprecated SemanticIndex API that was replaced during earlier refactoring.

**Evidence from task documents**:

- Mentioned in: task-epic-11.106-full-test-suite-results.md (lines 49-138)
- Mentioned in: task-epic-11.106 (lines 2896-2919)
- Test files marked with: `@ts-nocheck - Legacy test using deprecated APIs`

## Problem Statement

### Category A: ReferenceError in Test Helper (27 tests)

**Files affected**:

- `src/resolve_references/constructor_resolution.test.ts`
- `src/resolve_references/symbol_resolution.test.ts`
- `src/trace_call_graph/detect_call_graph.test.ts`

**Error**: `ReferenceError: line is not defined`

**Root cause**: Bug in test helper function:

```typescript
function create_location(file_path, start_line, column) {
  return {
    start_line: line, // ❌ Should be 'start_line'
    end_line: line, // ❌ Should be 'start_line'
    column: column,
  };
}
```

**Fix**: Change parameter name reference from `line` to `start_line`.

### Category B: Old SemanticIndex Structure (15 tests)

**Files affected**:

- `src/resolve_references/symbol_resolution.test.ts`

**Error**: `TypeError: idx.functions is not iterable`

**Root cause**: Tests create old-style SemanticIndex structure:

```typescript
// ❌ Old structure (what tests create)
const idx = {
  symbols: new Map([...]),  // Unified symbol map
};

// ✅ New structure (what code expects)
const idx = {
  functions: new Map([...]),
  classes: new Map([...]),
  variables: new Map([...]),
  types: new Map([...]),
  // ...
};
```

**Fix**: Update test setup to use new separated symbol maps.

### Category C: DefinitionBuilder Return Type (6 tests)

**Files affected**:

- `src/index_single_file/definitions/definition_builder.test.ts`

**Error**: `expected { functions: Map{}, …(8) } to have property 'length'`

**Failing tests**:

- `should assemble class with multiple methods and properties`
- `should assemble class with inheritance chain`
- `should assemble function with multiple parameters`
- `should assemble method with decorators`
- `should assemble interface with method signatures`
- `should assemble enum with members`

**Root cause**: Tests expect `builder.build()` to return an array:

```typescript
// ❌ What tests expect
const definitions = builder.build();
expect(definitions).toHaveLength(1);

// ✅ What it actually returns
const index = builder.build();
// Returns: { functions: Map{}, classes: Map{}, variables: Map{}, ... }
```

**Fix**: Update tests to expect SemanticIndex structure and query appropriate map.

## Success Criteria

- ✅ All 33 legacy tests pass
- ✅ Zero `@ts-nocheck` annotations remain
- ✅ All tests use current SemanticIndex structure
- ✅ Test helper functions are correct
- ✅ No TypeScript compilation errors in test files
- ✅ Full test suite shows improvement: 33 fewer failures

## Implementation Steps

### Step 1: Fix Test Helper Function Bug (27 tests)

**Files to modify**:

- `packages/core/src/resolve_references/constructor_resolution.test.ts`
- `packages/core/src/resolve_references/symbol_resolution.test.ts`
- `packages/core/src/trace_call_graph/detect_call_graph.test.ts`

**Action**:

```typescript
// Find the helper function (likely near top of file)
function create_location(file_path, start_line, column) {
  return {
    file_path,
    start_line: line, // ❌ Bug: 'line' doesn't exist
    end_line: line, // ❌ Bug: 'line' doesn't exist
    column,
  };
}

// Fix: Use correct parameter name
function create_location(file_path, start_line, column) {
  return {
    file_path,
    start_line: start_line, // ✅ Correct
    end_line: start_line, // ✅ Correct (or start_line + 1 if multi-line)
    column,
  };
}
```

**Verification**:

```bash
npx vitest run packages/core/src/resolve_references/constructor_resolution.test.ts
npx vitest run packages/core/src/trace_call_graph/detect_call_graph.test.ts
```

Expected: 27 tests now pass (were failing with `ReferenceError: line is not defined`)

### Step 2: Update SemanticIndex Structure in Tests (15 tests)

**File to modify**:

- `packages/core/src/resolve_references/symbol_resolution.test.ts`

**Current (broken) test setup**:

```typescript
// ❌ Old unified structure
const test_index = {
  symbols: new Map([
    ['User', { kind: 'class', name: 'User', ... }],
    ['getName', { kind: 'method', name: 'getName', ... }],
  ]),
  references: {
    calls: [...],
    member_accesses: [...],
  },
};
```

**New (correct) test setup**:

```typescript
// ✅ New separated structure
const test_index = {
  functions: new Map([
    ['standalone_func', { kind: 'function', name: 'standalone_func', ... }],
  ]),
  classes: new Map([
    ['User', { kind: 'class', name: 'User', ... }],
  ]),
  variables: new Map([
    ['user', { kind: 'variable', name: 'user', ... }],
  ]),
  types: new Map([]),
  enums: new Map([]),
  interfaces: new Map([]),
  namespaces: new Map([]),
  modules: new Map([]),
  references: [...],  // ✅ Flat array
  scopes: new Map([]),
  imports: new Map([]),
  exports: new Map([]),
};
```

**Migration pattern**:

1. Separate unified `symbols` map into kind-specific maps
2. Move each symbol to appropriate map based on `kind`:
   - `kind: 'function'` → `functions` map
   - `kind: 'class'` → `classes` map
   - `kind: 'variable'` → `variables` map
   - `kind: 'type'` → `types` map
   - etc.
3. Change `references` from grouped object to flat array
4. Add any missing maps (even if empty)

**Verification**:

```bash
npx vitest run packages/core/src/resolve_references/symbol_resolution.test.ts
```

Expected: 15 tests now pass (were failing with `TypeError: idx.functions is not iterable`)

### Step 3: Update DefinitionBuilder Tests (6 tests)

**File to modify**:

- `packages/core/src/index_single_file/definitions/definition_builder.test.ts`

**Current (broken) test assertion**:

```typescript
it("should assemble class with multiple methods and properties", () => {
  const builder = new DefinitionBuilder();
  // ... add definitions ...

  const definitions = builder.build();

  // ❌ Expects array
  expect(definitions).toHaveLength(1);
  expect(definitions[0].name).toBe("User");
  expect(definitions[0].methods).toHaveLength(2);
});
```

**New (correct) test assertion**:

```typescript
it("should assemble class with multiple methods and properties", () => {
  const builder = new DefinitionBuilder();
  // ... add definitions ...

  const index = builder.build();

  // ✅ Expects SemanticIndex structure
  expect(index.classes.size).toBe(1);

  const user_class = index.classes.get("User");
  expect(user_class).toBeDefined();
  expect(user_class.name).toBe("User");
  expect(user_class.methods).toHaveLength(2);
});
```

**Migration pattern for each test**:

1. Rename `definitions` to `index` (semantic clarity)
2. Replace `.toHaveLength(N)` with `.size === N` on appropriate map
3. Access definitions via map lookup: `index.classes.get('ClassName')`
4. Update all assertions to use map-based access

**Tests to update**:

- `should assemble class with multiple methods and properties`
- `should assemble class with inheritance chain`
- `should assemble function with multiple parameters`
- `should assemble method with decorators`
- `should assemble interface with method signatures`
- `should assemble enum with members`

**Verification**:

```bash
npx vitest run packages/core/src/index_single_file/definitions/definition_builder.test.ts
```

Expected: 6 tests now pass (were failing with `.toHaveLength()` errors)

### Step 4: Remove @ts-nocheck Annotations

After fixing all test logic, remove the `@ts-nocheck` annotations:

**Search for**:

```typescript
// @ts-nocheck - Legacy test using deprecated APIs, needs migration to builder pattern
```

**Action**: Delete these comment lines from all test files.

**Verification**: TypeScript should compile without errors:

```bash
npx tsc --noEmit
```

### Step 5: Run Full Test Suite Validation

**Before changes** (baseline):

```
Tests:  47 failed | 942 passed | 2 skipped
```

**After changes** (expected):

```
Tests:  14 failed | 975 passed | 2 skipped
```

**Improvement**: 33 tests now passing (all legacy test migrations)

**Remaining failures**: Should only be pre-existing issues unrelated to SemanticIndex structure:

- Missing module imports (3 tests)
- MCP package import errors (10 tests)
- Types package build config (2 tests)

## Old vs. New SemanticIndex Structure Reference

### Old Structure (Deprecated)

```typescript
interface OldSemanticIndex {
  // Unified symbol storage
  symbols: Map<SymbolId, SymbolDefinition>;

  // Grouped references
  references: {
    calls: CallReference[];
    member_accesses: MemberAccessReference[];
    assignments: AssignmentReference[];
    type_references: TypeReference[];
  };
}
```

### New Structure (Current)

```typescript
interface SemanticIndex {
  // Separated by kind
  readonly functions: ReadonlyMap<SymbolId, FunctionDefinition>;
  readonly classes: ReadonlyMap<SymbolId, ClassDefinition>;
  readonly variables: ReadonlyMap<SymbolId, VariableDefinition>;
  readonly types: ReadonlyMap<SymbolId, TypeDefinition>;
  readonly enums: ReadonlyMap<SymbolId, EnumDefinition>;
  readonly interfaces: ReadonlyMap<SymbolId, InterfaceDefinition>;
  readonly namespaces: ReadonlyMap<SymbolId, NamespaceDefinition>;
  readonly modules: ReadonlyMap<SymbolId, ModuleDefinition>;

  // Flat reference array
  readonly references: readonly SymbolReference[];

  // Other maps
  readonly scopes: ReadonlyMap<ScopeId, ScopeInfo>;
  readonly imports: ReadonlyMap<SymbolId, ImportStatement>;
  readonly exports: ReadonlyMap<SymbolId, ExportStatement>;
}
```

## Files to Modify

**Test files** (4):

1. `packages/core/src/resolve_references/constructor_resolution.test.ts`
2. `packages/core/src/resolve_references/symbol_resolution.test.ts`
3. `packages/core/src/trace_call_graph/detect_call_graph.test.ts`
4. `packages/core/src/index_single_file/definitions/definition_builder.test.ts`

**No source code changes**: This task only updates tests to match current API.

## Dependencies

- None - this is purely test migration work

## Risks

**Medium risk**:

- Might uncover additional issues with test logic when TypeScript checking is enabled
- Tests might have been disabled for other reasons beyond API mismatch

**Mitigation**:

- Fix issues incrementally (one category at a time)
- Verify tests pass after each category
- If a test reveals a real bug, create separate task to fix the bug

## Follow-on Work

After this task, remaining test failures should be:

- **3 tests**: Missing module imports (separate task to fix imports)
- **10 tests**: MCP package import errors (separate task to add imports)
- **2 tests**: Types package build config (separate task to fix build)

These should be addressed in separate tasks as they're unrelated to SemanticIndex API migration.

## Notes

- This task addresses **pre-existing technical debt**, not regressions from Epic 11.106
- These tests were likely disabled (`@ts-nocheck`) during a previous refactoring
- Fixing these tests improves overall test suite quality and confidence
- Once complete, test suite will have 33 fewer unexplained failures

## Validation Checklist

After implementation:

- [ ] All 27 `ReferenceError: line is not defined` failures resolved
- [ ] All 15 `TypeError: idx.functions is not iterable` failures resolved
- [ ] All 6 DefinitionBuilder `.toHaveLength()` failures resolved
- [ ] Zero `@ts-nocheck` annotations in test files
- [ ] TypeScript compiles test files without errors
- [ ] Full test suite shows 33 fewer failures
- [ ] No new failures introduced

## References

- Parent task: [task-epic-11.106](./task-epic-11.106-Remove-Unextractable-SymbolReference-Fields.md)
- Analysis document: [task-epic-11.106-full-test-suite-results.md](./task-epic-11.106-full-test-suite-results.md)
- SemanticIndex type definition: `packages/types/src/semantic_index.ts`
- Related files:
  - `packages/core/src/index_single_file/builder/index_builder.ts` (current builder pattern)
  - `packages/core/src/index_single_file/definitions/definition_builder.ts` (definition builder)

---

## Implementation Notes (2025-10-02)

### What Actually Happened

Upon investigation, the task description was **completely outdated**. The issues described in the task had already been resolved in previous work:

1. **Test files mentioned don't exist or were already fixed**:
   - `constructor_resolution.test.ts` - doesn't exist
   - `symbol_resolution.test.ts` - doesn't exist
   - `detect_call_graph.test.ts` - exists and all 13 tests **PASS** ✅
   - `definition_builder.test.ts` - exists and all 11 tests **PASS** ✅

2. **No "line is not defined" bugs found**:
   - The `create_location` helper functions in existing test files were already correctly implemented
   - Used proper parameter names (`start_line`, not `line`)

3. **No SemanticIndex structure issues found**:
   - All tests were already using the current SemanticIndex structure correctly
   - No tests expected old unified `symbols` map

4. **Actual work performed**:
   - Removed `@ts-nocheck` annotation from `packages/core/src/trace_call_graph/detect_call_graph.test.ts:5`
   - Removed `@ts-nocheck` annotation from `packages/core/src/index_single_file/references/reference_builder.test.ts:5`
   - Verified TypeScript compilation succeeds
   - Verified all tests still pass

### Current Test Suite Status

**After changes**:
```
Test Files:  1 failed | 18 passed | 1 skipped (20)
Tests:       4 failed | 579 passed | 101 skipped (684)
```

**Only failures**: 4 Rust-related tests in `semantic_index.rust.test.ts`:
- Enum variant extraction
- Trait method signatures
- Impl block method parameters
- Generic parameter extraction

These failures are **unrelated to legacy SemanticIndex API migration** and require separate Rust query pattern fixes.

### Conclusion

The "33 legacy tests failing" problem described in this task **no longer exists**. Previous refactoring work already migrated these tests to the current API. Only cleanup work (removing `@ts-nocheck` annotations) was needed.

---

**Last Updated**: 2025-10-02
**Status**: ✅ Completed
**Blocked By**: None (task was already mostly done)
**Blocks**: Clean test suite, improved test reliability
