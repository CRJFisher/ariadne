# Task epic-11.116: Integration Testing with JSON Fixtures

**Status:** Not Started
**Epic:** Epic 11 - Codebase Restructuring
**Priority:** High
**Created:** 2025-10-03
**Updated:** 2025-10-14

## Overview

Create a JSON fixture system for integration testing. The system generates semantic index JSON from code files, then uses these fixtures as reusable inputs for registry and call graph integration tests.

## Problem Statement

Current integration tests suffer from excessive boilerplate. Each test manually constructs semantic indexes inline, resulting in 100+ lines of setup code for 5 lines of actual testing.

**Current pattern:**

```typescript
it("should resolve imported function calls", () => {
  // 50+ lines: manually construct utils.ts semantic index
  const utils_index = create_test_index(utils_file, {
    root_scope_id: utils_scope,
    scopes_raw: new Map([
      /* ... 20 lines ... */
    ]),
    functions_raw: new Map([
      /* ... 30 lines ... */
    ]),
  });

  // 50+ lines: manually construct main.ts semantic index
  const main_index = create_test_index(main_file, {
    // ... another 50+ lines ...
  });

  // 5 lines: actual testing
  const result = resolve_symbols_with_registries([utils_index, main_index]);
  expect(result.resolved_references.get(call_key)).toBe(helper_id);
});
```

**Issues:**

- Cognitive overload - difficult to identify what's being tested
- Duplication - same semantic indexes reconstructed across multiple tests
- Maintenance burden - schema changes require updates throughout test files

## Solution

Generate semantic index JSON fixtures once, load them as test inputs. This reduces test setup from 100+ lines to 2 lines.

**Testing pipeline:**

```
Stage 1: Code → SemanticIndex → JSON fixtures
         └─ Generated once, version controlled
         └─ Regenerated when schema changes

Stage 2: Load JSON → Registries → Verify behavior
         └─ JSON as input, code assertions as verification

Stage 3: Load JSON → Registries → CallGraph → Verify behavior
         └─ Same JSON fixtures reused
```

**With fixtures:**

```typescript
it("should resolve imported function calls", () => {
  // 2 lines: load fixtures
  const utils_index = load_fixture("typescript/imports/utils.json");
  const main_index = load_fixture("typescript/imports/main.json");

  // 5 lines: actual testing
  const { definitions, resolutions } = build_registries([
    utils_index,
    main_index,
  ]);
  expect(resolutions.resolve(main_scope, "helper")).toBe(helper_id);
});
```

## Fixture Structure

```
packages/core/tests/fixtures/
├── typescript/
│   ├── code/                          # Source .ts files
│   │   ├── classes/
│   │   │   ├── basic_class.ts
│   │   │   ├── inheritance.ts
│   │   │   └── methods.ts
│   │   ├── functions/
│   │   │   ├── call_chains.ts
│   │   │   └── recursive.ts
│   │   └── modules/
│   │       ├── exports.ts
│   │       └── imports.ts
│   └── semantic_index/                # Generated JSON
│       ├── classes/
│       │   ├── basic_class.json       ← SemanticIndex JSON
│       │   ├── inheritance.json
│       │   └── methods.json
│       ├── functions/
│       │   ├── call_chains.json
│       │   └── recursive.json
│       └── modules/
│           ├── exports.json
│           └── imports.json
├── python/ (same structure)
├── rust/ (same structure)
└── javascript/ (same structure)
```

**Scope:**

- JSON fixtures represent semantic index outputs only
- Registry and call graph outputs are verified with code assertions (not JSON)
- This keeps serialization simple and focuses on solving the test bloat problem

## Benefits

1. **Reduces test bloat:** 100+ lines → 2 lines (98% reduction in setup code)
2. **Improves readability:** Tests clearly show what behavior is being verified
3. **Enables reuse:** Same fixtures used across registry AND call graph tests
4. **Simplifies maintenance:** Single regeneration point when schema changes
5. **Provides realistic data:** Fixtures represent actual parsed code, not minimal synthetic examples

## Implementation Strategy

### Phase 1: Fixture Infrastructure (Foundation)

Build the tooling and generate the fixture library.

**Tasks:**

1. Design JSON structure for semantic index (116.1)
2. Implement serialization/deserialization (116.2)
3. Create CLI tooling for fixture generation (116.2)
4. Organize code fixtures (116.3)
5. Generate initial JSON fixtures (116.4)

**Effort:** 10-15 hours
**Outcome:** Complete fixture library ready for use

### Phase 2: High-Value Testing (Immediate Impact)

Refactor tests to use fixtures.

**Tasks:** 6. Refactor registry integration tests to use JSON inputs (116.5) 7. Create call graph integration tests with JSON inputs (116.6)

**Effort:** 10-13 hours
**Outcome:** Massive test bloat reduction, improved test coverage

### Phase 3: Optional Polish

Additional validation and documentation.

**Tasks:** 8. Add semantic index verification tests (116.7) - optional 9. Documentation and CI integration (116.8)

**Effort:** 5-7 hours

## Sub-Tasks

- **[116.1](task-epic-11.116.1-Design-Semantic-Index-JSON-Schema.md)**: Design JSON structure
- **[116.2](task-epic-11.116.2-Implement-Fixture-Generation-Tooling.md)**: Implement serialization and tooling
- **[116.3](task-epic-11.116.3-Organize-Code-Fixtures.md)**: Organize code fixtures
- **[116.4](task-epic-11.116.4-Generate-Initial-JSON-Fixtures.md)**: Generate JSON library
- **[116.5](task-epic-11.116.5-Registry-Integration-Tests.md)**: Refactor registry tests
- **[116.6](task-epic-11.116.6-Call-Graph-Integration-Tests.md)**: Create call graph tests
- **[116.7](task-epic-11.116.7-Semantic-Index-Verification-Tests.md)**: Verification tests (optional)
- **[116.8](task-epic-11.116.8-Documentation.md)**: Documentation and CI

## Success Criteria

**Must Have:**

- ✅ Semantic index JSON fixtures exist for all 4 languages
- ✅ Fixtures cover major language features (classes, functions, modules, etc.)
- ✅ Generation tooling works and is documented
- ✅ Registry tests use JSON fixtures (test file size reduced by 50-70%)
- ✅ Call graph tests use JSON fixtures
- ✅ All tests passing

**Success Metrics:**

- Test file size: Expect 50-70% reduction in registry/call graph test files
- Fixture reuse: Same JSON fixtures used in both registry AND call graph tests
- Maintenance: Single regeneration point when SemanticIndex schema changes

## Estimated Effort

**Total:** 25-35 hours

**Breakdown:**

- Phase 1 (Infrastructure): 10-15 hours
- Phase 2 (High-value testing): 10-13 hours
- Phase 3 (Polish): 5-7 hours

**Why worth it:**

- Solves real problem (test bloat)
- One-time infrastructure investment
- Ongoing benefits for all future tests
- Fixtures reused across multiple test levels

## Dependencies

None - this is a self-contained testing infrastructure improvement.

## Implementation Notes

- This is purely testing infrastructure - no production code changes
- Can be done incrementally (one language at a time, one stage at a time)
- Once complete, significantly reduces maintenance burden
- Sets foundation for future language additions
- JSON files will be version controlled alongside code

## Related Tasks

- Related to all Epic 11 tasks as testing infrastructure improvement
- Specifically benefits registry and call graph testing

## References

- **Detailed analysis:** [task-epic-11.116-ARCHITECTURE-REVIEW.md](task-epic-11.116-ARCHITECTURE-REVIEW.md)
- **Quick reference:** [task-epic-11.116-FINAL-SUMMARY.md](task-epic-11.116-FINAL-SUMMARY.md)
- **Current registry architecture:** `packages/core/src/resolve_references/registries/`
- **Current call graph:** `packages/core/src/trace_call_graph/detect_call_graph.ts`
- **Existing integration tests:** `packages/core/src/resolve_references/symbol_resolution.integration.test.ts`
