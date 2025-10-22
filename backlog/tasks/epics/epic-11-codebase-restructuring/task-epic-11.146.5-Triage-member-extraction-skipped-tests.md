# Task epic-11.146.5: Triage member_extraction.test.ts skipped tests

**Status:** Not Started
**Parent:** task-epic-11.146
**Priority:** Medium

## Problem

member_extraction.test.ts has 7 tests skipped with explicit comments:

**Python tests (4 skipped):**
- "SKIPPED: semantic_index does not extract Python class methods yet"
- "SKIPPED: semantic_index does not extract Python class methods yet"
- "SKIPPED: semantic_index does not extract Python class methods/extends yet"
- "SKIPPED: semantic_index does not extract Python class methods yet"

**Rust tests (3 skipped):**
- "SKIPPED: semantic_index does not extract Rust methods yet"
- "SKIPPED: semantic_index does not extract Rust methods yet"
- "SKIPPED: semantic_index does not extract Rust methods yet"

## Investigation Required

### Question 1: Are these comments still accurate?

Check if semantic_index NOW extracts these features:
- Look at Python integration tests - do they test methods?
- Look at Rust integration tests - do they test methods?
- Check semantic_index.python.test.ts and semantic_index.rust.test.ts

If methods ARE being extracted:
- ✅ **FIX** - Enable tests and verify they pass
- Remove skip and update test if needed

If methods are NOT being extracted:
- 🗑️ **DELETE** - These tests can't work until feature is implemented
- Create separate task for implementing the missing feature
- Don't leave `.skip()` tests as placeholders

### Question 2: What is member_extraction.test.ts testing?

This file appears to be testing type preprocessing functionality:
- Does this overlap with semantic_index tests?
- Is member_extraction still a relevant part of the architecture?
- Or has this functionality moved elsewhere?

## Decision Tree

```
Are Python/Rust methods extracted by semantic_index?
├─ YES → Enable tests, verify they pass
│         └─ Pass?
│            ├─ YES → ✅ Done
│            └─ NO → Fix or delete with reason
│
└─ NO → Check if member_extraction is still relevant
          ├─ YES → Keep .skip(), document blocking issue clearly
          │        Create feature task for method extraction
          └─ NO → 🗑️ Delete tests, functionality moved elsewhere
```

## Files to Investigate

- `src/index_single_file/type_preprocessing/member_extraction.test.ts` (7 skipped)
- `src/index_single_file/semantic_index.python.test.ts` (check for method tests)
- `src/index_single_file/semantic_index.rust.test.ts` (check for method tests)

## Success Criteria

- [ ] Determined if Python/Rust methods are extracted
- [ ] Either enabled tests (if feature exists) or deleted tests (if obsolete)
- [ ] No `.skip()` in member_extraction.test.ts
- [ ] If feature is missing, created separate task for implementation
