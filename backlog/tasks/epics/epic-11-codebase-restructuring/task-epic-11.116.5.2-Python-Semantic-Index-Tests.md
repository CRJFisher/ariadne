# Task epic-11.116.5.2: Refactor Python semantic_index Tests

**Status:** Not Started
**Parent:** task-epic-11.116.5
**Depends On:** 116.5.0
**Language:** Python
**Priority:** High
**Estimated Effort:** 1.5 hours

## Objective

Refactor `semantic_index.python.test.ts` to use JSON fixture approach.

## Current Test File

**Location:** `packages/core/src/index_single_file/semantic_index.python.test.ts`

## Test Organization

```typescript
describe("Semantic Index - Python", () => {
  describe("Classes", () => {
    it("should index basic class definition", () => { /* ... */ });
    it("should index class inheritance", () => { /* ... */ });
    it("should index @dataclass", () => { /* ... */ });
    it("should index @property methods", () => { /* ... */ });
  });

  describe("Functions", () => {
    it("should index function definitions", () => { /* ... */ });
    it("should index lambda functions", () => { /* ... */ });
    it("should index generators with yield", () => { /* ... */ });
    it("should index async def", () => { /* ... */ });
  });

  describe("Type Hints", () => {
    it("should index type annotations", () => { /* ... */ });
    it("should index Union types", () => { /* ... */ });
    it("should index Optional types", () => { /* ... */ });
  });

  describe("Modules", () => {
    it("should index imports", () => { /* ... */ });
    it("should index from...import", () => { /* ... */ });
    it("should index __all__ exports", () => { /* ... */ });
  });

  describe("Decorators", () => {
    it("should index function decorators", () => { /* ... */ });
    it("should index class decorators", () => { /* ... */ });
  });
});
```

## Test Coverage Goals

- [ ] Classes (basic, inheritance, @dataclass, @staticmethod, @classmethod)
- [ ] Functions (def, lambda, generators, async)
- [ ] Type hints (basic, Union, Optional, Generic)
- [ ] Modules (import, from...import, __all__)
- [ ] Decorators (function, class, with args)
- [ ] Scope (module, function, class, nested)

## Deliverables

- [ ] Test file refactored to use fixtures
- [ ] All Python-specific features covered
- [ ] All tests passing

## Acceptance Criteria

- [ ] Zero inline code (all fixture-based)
- [ ] Python features comprehensively tested
- [ ] Test suite passes
