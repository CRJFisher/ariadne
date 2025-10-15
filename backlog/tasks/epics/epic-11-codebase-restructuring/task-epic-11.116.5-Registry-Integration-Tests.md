# Task epic-11.116.5: Registry Integration Tests with JSON Fixtures

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.4
**Priority:** High
**Created:** 2025-10-14

## Overview

Refactor existing registry integration tests to use JSON fixtures as inputs instead of manually constructing semantic indexes inline. This dramatically reduces test bloat and makes tests more readable.

**Key Change:** Tests currently in `symbol_resolution.integration.test.ts` actually test the registry architecture, not the deprecated `symbol_resolution` module.

## Current State

**File:** `packages/core/src/resolve_references/symbol_resolution.integration.test.ts`

**Current test pattern (bloated):**
```typescript
it("should resolve imported function calls", () => {
  // 50+ lines: manually construct utils.ts semantic index
  const utils_index = create_test_index(utils_file, {
    root_scope_id: utils_scope,
    scopes_raw: new Map([...]),  // 20 lines
    functions_raw: new Map([...]), // 30 lines
  });

  // 50+ lines: manually construct main.ts semantic index
  const main_index = create_test_index(main_file, {
    // ... another 50 lines ...
  });

  // 5 lines: actual test
  const result = resolve_symbols_with_registries([utils_index, main_index]);
  expect(result.resolved_references.get(call_key)).toBe(helper_id);
});
```

**Problem:** 100+ lines of setup for 5 lines of testing.

## Objectives

1. Replace `create_test_index()` with `load_fixture()`
2. Reduce test file from ~1500 lines to ~300-400 lines
3. Maintain or improve test coverage
4. Verify registries work correctly with realistic fixtures
5. Keep existing test categories and structure

## Target State

**With JSON fixtures:**
```typescript
import { load_fixture, build_registries } from "../../tests/fixtures/test_helpers";

describe("Registry Integration Tests", () => {
  describe("Cross-Module Resolution", () => {
    it("should resolve imported function calls", () => {
      // 2 lines: load pre-generated fixtures
      const utils_index = load_fixture("typescript/modules/utils.json");
      const main_index = load_fixture("typescript/modules/imports_utils.json");

      // Build registries from fixtures
      const { definitions, resolutions } = build_registries([utils_index, main_index]);

      // Verify resolution (actual behavior being tested)
      const helper_symbol = definitions.get_by_scope_and_name(
        utils_index.root_scope_id,
        "helper"
      );
      expect(helper_symbol).toBeDefined();

      // Verify call resolution
      const main_ref = main_index.references.find(r => r.name === "helper");
      const resolved = resolutions.resolve(main_ref.scope_id, "helper");

      expect(resolved).toBe(helper_symbol.symbol_id);
    });
  });
});
```

**Benefits:**
- 98% reduction in setup code
- Clear focus on behavior being tested
- Fixtures reusable across tests
- Easy to add new test cases

## Implementation Plan

### 1. Identify Test Categories (0.5 hours)

Review existing test file and list all test categories:

**Current categories (from existing file):**
- Basic Resolution (local function calls)
- Cross-Module Resolution (imports)
- Shadowing Scenarios (local shadows import)
- Complete Workflows (constructor → type → method chains)
- CallReference validation

**Keep these categories** - they're testing important registry behavior.

### 2. Map Tests to Fixtures (1 hour)

For each test, identify which fixture(s) it needs:

| Test | Required Fixtures |
|------|------------------|
| Local function call resolution | `typescript/functions/call_chains.json` |
| Import resolution | `typescript/modules/utils.json`, `typescript/modules/imports_utils.json` |
| Method call through type binding | `typescript/classes/user.json`, `typescript/classes/main_uses_user.json` |
| Constructor call resolution | `typescript/classes/basic_class.json` |
| Shadowing (local shadows import) | `typescript/modules/shadowing.json` |

**Create missing code fixtures if needed**, then generate their JSON (using 116.4 workflow).

### 3. Create Test Helper Extensions (1 hour)

Extend `test_helpers.ts` with registry-specific helpers:

```typescript
/**
 * Find definition by name in a specific scope
 */
export function find_definition_in_scope(
  definitions: DefinitionRegistry,
  scope_id: ScopeId,
  name: SymbolName
): Definition | undefined {
  const scope_defs = definitions.get_by_scope(scope_id);
  return Array.from(scope_defs.values()).find(d => d.name === name);
}

/**
 * Find reference by name and scope
 */
export function find_reference(
  index: SemanticIndex,
  name: SymbolName,
  scope_id?: ScopeId
): SymbolReference | undefined {
  return index.references.find(r =>
    r.name === name && (!scope_id || r.scope_id === scope_id)
  );
}

/**
 * Assert resolution matches expected symbol
 */
export function expect_resolved_to(
  resolutions: ResolutionRegistry,
  ref: SymbolReference,
  expected_symbol_id: SymbolId
): void {
  const resolved = resolutions.resolve(ref.scope_id, ref.name);
  expect(resolved).toBe(expected_symbol_id);
}
```

### 4. Refactor Test Categories (2-3 hours)

Refactor each test category one at a time:

**Example - Cross-Module Resolution:**

```typescript
describe("Cross-Module Resolution", () => {
  it("should resolve function imported from another file", () => {
    // Load fixtures
    const utils = load_fixture("typescript/modules/utils.json");
    const main = load_fixture("typescript/modules/imports_utils.json");

    // Build registries
    const { definitions, resolutions } = build_registries([utils, main]);

    // Find the exported helper function
    const helper = find_definition_in_scope(
      definitions,
      utils.root_scope_id,
      "helper"
    );
    expect(helper).toBeDefined();

    // Find the call reference in main
    const call_ref = find_reference(main, "helper");
    expect(call_ref).toBeDefined();
    expect(call_ref.type).toBe("call");

    // Verify resolution
    expect_resolved_to(resolutions, call_ref, helper.symbol_id);
  });

  it("should resolve re-exported symbols", () => {
    const source = load_fixture("typescript/modules/source.json");
    const middleware = load_fixture("typescript/modules/re_exports.json");
    const consumer = load_fixture("typescript/modules/imports_reexported.json");

    const { definitions, resolutions, exports } = build_registries([
      source,
      middleware,
      consumer
    ]);

    // Verify export chain
    const exported = exports.resolve_export_chain(
      "middleware.ts" as FilePath,
      "originalFunc" as SymbolName,
      "named",
      languages,
      root_folder
    );

    expect(exported).toBeDefined();

    // Verify resolution in consumer
    const ref = find_reference(consumer, "originalFunc");
    expect_resolved_to(resolutions, ref, exported);
  });
});
```

**Example - Type-Based Resolution:**

```typescript
describe("Type-Based Method Resolution", () => {
  it("should resolve method call through type binding", () => {
    const user_class = load_fixture("typescript/classes/user.json");
    const main = load_fixture("typescript/classes/main_uses_user.json");

    const { definitions, resolutions, types } = build_registries([
      user_class,
      main
    ]);

    // Find User class and its getName method
    const user = find_definition_in_scope(
      definitions,
      user_class.root_scope_id,
      "User"
    );
    const user_members = types.get_type_members(user.symbol_id);
    const getName_method = user_members.methods.get("getName");

    expect(getName_method).toBeDefined();

    // Find method call reference
    const method_ref = main.references.find(
      r => r.type === "call" && r.call_type === "method" && r.name === "getName"
    );
    expect(method_ref).toBeDefined();

    // Verify resolution
    expect_resolved_to(resolutions, method_ref, getName_method);
  });

  it("should resolve constructor calls through type binding", () => {
    const user_class = load_fixture("typescript/classes/user.json");
    const main = load_fixture("typescript/classes/instantiates_user.json");

    const { definitions, resolutions, types } = build_registries([
      user_class,
      main
    ]);

    // Find User class constructor
    const user = find_definition_in_scope(
      definitions,
      user_class.root_scope_id,
      "User"
    );
    const user_members = types.get_type_members(user.symbol_id);
    const constructor_id = user_members.constructor;

    expect(constructor_id).toBeDefined();

    // Find constructor call
    const ctor_ref = main.references.find(
      r => r.type === "call" && r.call_type === "constructor" && r.name === "User"
    );

    // Verify resolution
    expect_resolved_to(resolutions, ctor_ref, constructor_id);
  });
});
```

### 5. Remove Old Test Helpers (0.5 hours)

After refactoring, remove or deprecate old helpers:
- `create_test_index()` - no longer needed
- Hand-crafted semantic index builders - replaced by fixtures

### 6. Verify Coverage (0.5 hours)

Ensure refactored tests cover at least the same scenarios:

```bash
# Run tests and check coverage
npm test -- symbol_resolution.integration.test.ts --coverage

# Compare line count (should be much smaller)
wc -l src/resolve_references/symbol_resolution.integration.test.ts
```

**Expected outcome:**
- From ~1500 lines → ~300-400 lines
- All tests passing
- Same or better coverage

## Deliverables

- [ ] `symbol_resolution.integration.test.ts` refactored to use fixtures
- [ ] Test helper extensions implemented
- [ ] All tests passing with JSON fixtures
- [ ] Test file size reduced by ~70%
- [ ] Coverage maintained or improved
- [ ] Any missing fixtures created and generated

## Testing Strategy

**Before refactoring:**
1. Run existing tests and capture results: `npm test -- symbol_resolution.integration.test.ts`
2. Note which tests pass/fail
3. Create baseline

**During refactoring:**
4. Refactor one test category at a time
5. Verify tests still pass after each category
6. Compare behavior with baseline

**After refactoring:**
7. Run full test suite
8. Verify all tests pass
9. Check coverage report
10. Review test file for readability

## Success Criteria

- ✅ All registry integration tests use JSON fixtures
- ✅ No `create_test_index()` calls remaining
- ✅ Test file reduced from 1500+ lines to 300-400 lines
- ✅ All existing test scenarios covered
- ✅ Tests are more readable and maintainable
- ✅ New tests easy to add (just reference fixture)

## Estimated Effort

**4-5 hours**
- 0.5 hours: Identify test categories and map to fixtures
- 1 hour: Create test helper extensions
- 2-3 hours: Refactor tests category by category
- 0.5 hours: Cleanup and verification
- 0.5 hours: Buffer for issues

## Next Steps

After completion:
- Proceed to **116.6**: Call graph integration tests (similar pattern)
- Document pattern for future integration tests

## Notes

- This is where the fixture investment pays off immediately
- Expect significant improvement in test readability
- May discover bugs or issues in existing tests during refactoring
- Keep git history clean - one commit per test category refactored
- If fixtures are missing, pause and create them (back to 116.3/116.4)
