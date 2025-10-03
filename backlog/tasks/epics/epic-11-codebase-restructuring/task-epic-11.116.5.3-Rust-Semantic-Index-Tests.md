# Task epic-11.116.5.3: Refactor Rust semantic_index Tests

**Status:** Not Started
**Parent:** task-epic-11.116.5
**Depends On:** 116.5.0
**Language:** Rust
**Priority:** High
**Estimated Effort:** 1.5 hours

## Objective

Refactor `semantic_index.rust.test.ts` to use JSON fixture approach.

## Current Test File

**Location:** `packages/core/src/index_single_file/semantic_index.rust.test.ts`

## Test Organization

```typescript
describe("Semantic Index - Rust", () => {
  describe("Structs", () => {
    it("should index basic struct", () => { /* ... */ });
    it("should index tuple struct", () => { /* ... */ });
    it("should index unit struct", () => { /* ... */ });
  });

  describe("Enums", () => {
    it("should index basic enum", () => { /* ... */ });
    it("should index enum with variants", () => { /* ... */ });
  });

  describe("Traits", () => {
    it("should index trait definition", () => { /* ... */ });
    it("should index trait implementation", () => { /* ... */ });
    it("should index trait bounds", () => { /* ... */ });
  });

  describe("Impl Blocks", () => {
    it("should index basic impl", () => { /* ... */ });
    it("should index trait impl", () => { /* ... */ });
    it("should index associated functions", () => { /* ... */ });
  });

  describe("Functions", () => {
    it("should index fn definitions", () => { /* ... */ });
    it("should index closures", () => { /* ... */ });
  });

  describe("Modules", () => {
    it("should index mod declarations", () => { /* ... */ });
    it("should index use statements", () => { /* ... */ });
    it("should index pub use re-exports", () => { /* ... */ });
  });

  describe("Generics", () => {
    it("should index generic structs", () => { /* ... */ });
    it("should index generic functions", () => { /* ... */ });
    it("should index lifetime parameters", () => { /* ... */ });
  });
});
```

## Test Coverage Goals

- [ ] Structs (basic, tuple, unit, generic)
- [ ] Enums (basic, with variants)
- [ ] Traits (definition, implementation, bounds)
- [ ] Impl blocks (basic, trait, associated functions)
- [ ] Functions (fn, closures)
- [ ] Modules (mod, use, pub use)
- [ ] Generics (structs, functions, lifetimes)
- [ ] Ownership/References (if applicable)

## Deliverables

- [ ] Test file refactored to use fixtures
- [ ] All Rust-specific features covered
- [ ] All tests passing

## Acceptance Criteria

- [ ] Zero inline code (all fixture-based)
- [ ] Rust features comprehensively tested
- [ ] Test suite passes
