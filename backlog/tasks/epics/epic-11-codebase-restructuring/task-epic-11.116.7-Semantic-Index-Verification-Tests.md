# Task epic-11.116.7: Semantic Index Verification Tests (Optional)

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.4
**Priority:** Low (optional polish)
**Created:** 2025-10-14

## Overview

Optionally add tests that verify the semantic index JSON fixtures themselves are correct. This provides an additional validation layer to catch issues in the indexing or serialization process.

**Note:** This task is **optional**. The primary value of fixtures is as inputs to registry/call graph tests. Verifying the fixtures themselves is secondary.

## Objectives

1. Verify generated JSON matches expected structure
2. Validate that indexing produces correct results
3. Provide regression protection for index_single_file
4. Document expected semantic index outputs

## Approach Options

### Option A: Property-Based Verification (Recommended)

Load JSON fixtures and verify structural properties:

```typescript
describe("Semantic Index Verification - TypeScript", () => {
  it("should have valid class structure", () => {
    const index = load_fixture("typescript/classes/basic_class.json");

    // Verify basic structure
    expect(index.language).toBe("typescript");
    expect(index.file_path).toBeTruthy();
    expect(index.root_scope_id).toBeTruthy();

    // Verify class is captured
    expect(index.classes.size).toBe(1);

    const user_class = Array.from(index.classes.values())[0];
    expect(user_class.name).toBe("User");
    expect(user_class.kind).toBe("class");

    // Verify methods are captured in functions map
    const methods = Array.from(index.functions.values()).filter(
      f => f.kind === "method"
    );
    expect(methods.length).toBeGreaterThan(0);

    // Verify each method has correct structure
    methods.forEach(method => {
      expect(method.name).toBeTruthy();
      expect(method.scope_id).toBeTruthy();
      expect(method.location).toBeDefined();
    });
  });
});
```

**Pros:**
- Lightweight (no golden output files)
- Focuses on invariants, not exact output
- Easy to maintain

**Cons:**
- Doesn't catch all regressions
- Manual assertions required

### Option B: Snapshot Testing

Compare generated JSON against committed snapshots:

```typescript
describe("Semantic Index Snapshots - TypeScript", () => {
  it("should match snapshot for basic class", () => {
    const code = load_code_fixture("typescript/classes/basic_class.ts");
    const index = index_single_file(code, "typescript");
    const json = serialize_semantic_index(index);

    expect(json).toMatchSnapshot();
  });
});
```

**Pros:**
- Catches all regressions automatically
- Easy to update when schema changes

**Cons:**
- Snapshot churn on schema changes
- Less readable than explicit assertions

### Option C: Round-Trip Testing

Verify serialization is lossless:

```typescript
describe("Semantic Index Serialization", () => {
  it("should round-trip without loss", () => {
    const code = load_code_fixture("typescript/classes/basic_class.ts");
    const original = index_single_file(code, "typescript");

    const json = serialize_semantic_index(original);
    const deserialized = deserialize_semantic_index(json);

    expect(deserialized).toEqual(original);
  });
});
```

**Pros:**
- Validates serialization logic
- Ensures no data loss

**Cons:**
- Doesn't verify index_single_file is correct
- Only tests serialization, not indexing

## Recommended Implementation

**Hybrid approach:**

1. **Round-trip tests** (in 116.2) - already covered serialization
2. **Spot-check property tests** (this task) - verify key invariants
3. **Skip snapshots** - too much maintenance overhead

```typescript
// packages/core/tests/fixtures/semantic_index_verification.test.ts

import { describe, it, expect } from "vitest";
import { load_fixture } from "./test_helpers";

describe("Semantic Index Fixture Verification", () => {
  describe("TypeScript Fixtures", () => {
    it("classes/basic_class.json has expected structure", () => {
      const index = load_fixture("typescript/classes/basic_class.json");

      expect(index.language).toBe("typescript");
      expect(index.classes.size).toBeGreaterThan(0);
      expect(index.scopes.size).toBeGreaterThan(1); // at least module + class scope
      expect(index.functions.size).toBeGreaterThan(0); // at least constructor
    });

    it("functions/call_chains.json captures all calls", () => {
      const index = load_fixture("typescript/functions/call_chains.json");

      // Verify functions captured
      const func_names = Array.from(index.functions.values()).map(f => f.name);
      expect(func_names).toContain("main");
      expect(func_names).toContain("processData");
      expect(func_names).toContain("fetchData");

      // Verify call references captured
      const call_refs = index.references.filter(r => r.type === "call");
      expect(call_refs.length).toBeGreaterThanOrEqual(2); // At least 2 calls in chain
    });

    it("modules/imports.json captures import symbols", () => {
      const index = load_fixture("typescript/modules/imports.json");

      expect(index.imported_symbols.size).toBeGreaterThan(0);

      const imports = Array.from(index.imported_symbols.values());
      expect(imports.some(imp => imp.source_file)).toBe(true);
    });
  });

  describe("Python Fixtures", () => {
    it("classes/basic_class.json has expected structure", () => {
      const index = load_fixture("python/classes/basic_class.json");

      expect(index.language).toBe("python");
      expect(index.classes.size).toBeGreaterThan(0);
    });
  });

  // Similar spot-checks for Rust and JavaScript
});
```

## Deliverables (if implementing)

- [ ] `semantic_index_verification.test.ts` with spot-checks
- [ ] One test per major fixture category
- [ ] All verification tests passing
- [ ] Documentation of what's being verified

## When to Implement

**Implement if:**
- You want extra confidence in fixtures
- You're refactoring index_single_file
- You want regression protection

**Skip if:**
- Registry/call graph tests provide enough coverage
- Time is limited (focus on 116.5 and 116.6 instead)
- Fixtures are already working well

## Success Criteria (if implementing)

- ✅ Spot-check tests for each language
- ✅ Tests verify key invariants (not exact output)
- ✅ Tests are maintainable (not brittle)
- ✅ All tests passing

## Estimated Effort

**3-4 hours** (if implementing)
- 1 hour: Design verification strategy
- 2 hours: Write spot-check tests
- 1 hour: Review and refine

## Next Steps

- Proceed to **116.8**: Documentation (higher priority)
- Return to this task if time permits

## Notes

- This task is genuinely optional - don't feel obligated to implement
- Registry and call graph tests already provide significant fixture validation
- If fixtures work in those tests, they're probably correct
- Consider implementing only if schema changes frequently
- Can always add later if needed
