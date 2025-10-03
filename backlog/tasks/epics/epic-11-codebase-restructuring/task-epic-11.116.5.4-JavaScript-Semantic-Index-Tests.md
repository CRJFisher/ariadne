# Task epic-11.116.5.4: Refactor JavaScript semantic_index Tests

**Status:** Not Started
**Parent:** task-epic-11.116.5
**Depends On:** 116.5.0
**Language:** JavaScript
**Priority:** High
**Estimated Effort:** 1 hour

## Objective

Refactor `semantic_index.javascript.test.ts` to use JSON fixture approach.

## Current Test File

**Location:** `packages/core/src/index_single_file/semantic_index.javascript.test.ts`

## Test Organization

```typescript
describe("Semantic Index - JavaScript", () => {
  describe("Classes", () => {
    it("should index ES6 classes", () => { /* ... */ });
    it("should index class inheritance", () => { /* ... */ });
    it("should index static methods", () => { /* ... */ });
  });

  describe("Functions", () => {
    it("should index function declarations", () => { /* ... */ });
    it("should index function expressions", () => { /* ... */ });
    it("should index arrow functions", () => { /* ... */ });
    it("should index IIFE", () => { /* ... */ });
  });

  describe("Modules", () => {
    it("should index CommonJS require", () => { /* ... */ });
    it("should index CommonJS module.exports", () => { /* ... */ });
    it("should index ES6 imports", () => { /* ... */ });
    it("should index ES6 exports", () => { /* ... */ });
  });

  describe("Objects", () => {
    it("should index object literals", () => { /* ... */ });
    it("should index destructuring", () => { /* ... */ });
  });

  describe("Async", () => {
    it("should index promises", () => { /* ... */ });
    it("should index async/await", () => { /* ... */ });
  });

  describe("Prototypes", () => {
    it("should index constructor functions", () => { /* ... */ });
    it("should index prototype methods", () => { /* ... */ });
  });
});
```

## Test Coverage Goals

- [ ] Classes (ES6 class, inheritance, static)
- [ ] Functions (declaration, expression, arrow, IIFE)
- [ ] Modules (CommonJS and ES6)
- [ ] Objects (literals, destructuring)
- [ ] Async (promises, async/await)
- [ ] Prototypes (constructor functions, prototype chain)

## Deliverables

- [ ] Test file refactored to use fixtures
- [ ] All JavaScript-specific features covered
- [ ] All tests passing

## Acceptance Criteria

- [ ] Zero inline code (all fixture-based)
- [ ] JavaScript features comprehensively tested
- [ ] Test suite passes
