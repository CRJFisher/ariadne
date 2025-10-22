# Task epic-11.146.6: Triage reference_builder.test.ts skipped tests

**Status:** Not Started
**Parent:** task-epic-11.146
**Priority:** Medium

## Problem

reference_builder.test.ts has 7 tests skipped with no comments:

```typescript
it.skip("should process type references", () => {
it.skip("should process type references with generics", () => {
it.skip("should process property access", () => {
it.skip("should process assignments with type flow", () => {
it.skip("should handle method call with property chain", () => {
it.skip("should handle type references", () => {
it.skip("should handle assignments", () => {
```

## Investigation Required

### Question 1: What features are these testing?

Appears to test:
- Type reference tracking
- Property access chains
- Assignment tracking for type flow
- Generic type parameters

Are these features:
- ❌ Not implemented yet (future work)?
- ✅ Already implemented (tests outdated)?
- 🔄 Partially implemented?

### Question 2: Are these features covered elsewhere?

Check if integration tests cover:
- Type reference resolution
- Property access in method calls
- Type flow through assignments

If covered elsewhere:
- 🗑️ **DELETE** - No need for unit tests if integration tests cover it

If not covered:
- 📝 **DOCUMENT** - Convert `.skip()` to `.todo()` with clear description
- Or delete and create feature task if significant work

### Question 3: What is ReferenceBuilder testing?

- Is ReferenceBuilder still part of current architecture?
- Has reference processing moved to different module?
- Are these tests testing obsolete API?

## Decision Tree

```
Is the feature implemented?
├─ YES → Are integration tests covering it?
│         ├─ YES → 🗑️ Delete unit tests (redundant)
│         └─ NO → ✅ Fix unit tests to work
│
└─ NO → Is this planned work?
          ├─ YES → Convert to .todo() with description
          │        Or delete and create feature task
          └─ NO → 🗑️ Delete (not planned, not needed)
```

## Files to Investigate

- `src/index_single_file/references/reference_builder.test.ts` (7 skipped)
- `src/index_single_file/references/reference_builder.ts` (implementation)
- Integration tests for type references and property access

## Success Criteria

- [ ] Determined status of each feature (implemented/planned/obsolete)
- [ ] Either fixed tests, converted to .todo(), or deleted tests
- [ ] No `.skip()` in reference_builder.test.ts
- [ ] Clear documentation for any .todo() tests
