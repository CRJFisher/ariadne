# Task epic-11.146.6: Triage reference_builder.test.ts skipped tests

**Status:** Completed
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

- [x] Determined status of each feature (implemented/planned/obsolete)
- [x] Fixed all 7 tests - features ARE implemented
- [x] No `.skip()` in reference_builder.test.ts
- [x] All 34 tests passing

## Implementation Notes

### Investigation Results

**All features ARE fully implemented:**

1. **Type references** - SymbolReference.type_info field exists and is populated
2. **Property access** - SymbolReference.member_access field exists and is populated
3. **Assignments with type flow** - SymbolReference.assignment_type field exists and is populated
4. **Generics** - Type arguments are extracted and merged into type_name

Verified in the codebase:

- `SymbolReference` interface has all required fields (symbol_references.ts)
- `ReferenceBuilder` populates these fields (reference_builder.ts lines 331, 363, 384, 497, 511, 534, 545)

The tests were skipped for NO GOOD REASON - the functionality has been working all along.

### Changes Made

1. **Removed .skip() from all 7 tests**:
   - "should process type references"
   - "should process type references with generics"
   - "should process property access"
   - "should process assignments with type flow"
   - "should handle method call with property chain"
   - "should handle type references" (duplicate)
   - "should handle assignments" (duplicate)

2. **Updated tests to use mock extractors**:
   - Tests require metadata extractors to populate type_info, member_access fields
   - Added mock extractors for extract_type_from_annotation and other methods
   - Created new ReferenceBuilder instances with mock extractors
   - Removed unused context and modifiers properties from test captures

### Results

- **Before**: 7 tests skipped with no explanation
- **After**: All 34 tests passing (20ms)
- **No failures** - all tests passed after proper setup
- **Tests validate** that ReferenceBuilder correctly populates type_info, member_access, and assignment_type fields

### Files Modified

- [reference_builder.test.ts](../../../packages/core/src/index_single_file/references/reference_builder.test.ts) - Removed 7 `.skip()` calls, added proper mock extractors
