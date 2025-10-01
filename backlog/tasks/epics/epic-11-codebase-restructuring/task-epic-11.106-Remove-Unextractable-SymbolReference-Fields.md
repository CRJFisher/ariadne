# Task Epic 11.106: Remove Unextractable SymbolReference Fields

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3 hours
**Dependencies:** task-epic-11.104 (Metadata Extraction - Complete)
**Created:** 2025-10-01

## Objective

Clean up the `SymbolReference` interface by **deleting** fields that cannot be extracted from tree-sitter AST captures. Analysis of the completed metadata extraction work (task 11.104) revealed several fields that are always undefined/false because they require semantic analysis beyond what tree-sitter provides.

## Background

Task 11.104 implemented comprehensive metadata extraction across all languages (JavaScript/TypeScript, Python, Rust). Through 247 tests and full implementation, we discovered that certain `SymbolReference` fields cannot be populated from AST-local information:

1. **`type_flow.source_type`** - Always `undefined` (line 415 in reference_builder.ts)
2. **`type_flow.is_narrowing`** - Always `false` (requires type system analysis)
3. **`type_flow.is_widening`** - Always `false` (requires type system analysis)
4. **`context.containing_function`** - Never populated (needs scope tree traversal)
5. **`member_access.is_optional_chain`** - Always `false` (but CAN be implemented)

### Note on Rust Implementation

Per `RUST_METADATA_PATTERNS.md`, Rust metadata extraction has some known partial implementations:
- Method vs function distinction is incomplete (all reported as "function")
- Receiver locations not always populated for method calls
- Property chains partially implemented

**Important:** These are Rust-specific implementation gaps, not fundamental extractability issues. The fields we're removing (source_type, is_narrowing, is_widening) are NEVER populated in ANY language.

## Analysis Summary

### Fields to DELETE (Cannot Extract)

| Field | Current State | Reason for Removal |
|-------|--------------|-------------------|
| `type_flow.source_type` | Always `undefined` | Requires inter-procedural analysis |
| `type_flow.is_narrowing` | Always `false` | Requires type system understanding |
| `type_flow.is_widening` | Always `false` | Requires type system understanding |

### Fields to IMPLEMENT (Can Extract)

| Field | Current State | Implementation Path |
|-------|--------------|-------------------|
| `member_access.is_optional_chain` | Always `false` | Add to language-specific extractors |

### Fields to DEFER (Needs Scope Integration)

| Field | Current State | Decision Needed |
|-------|--------------|-----------------|
| `context.containing_function` | Never populated | Either remove OR implement via ScopeBuilder |

## Proposed Changes

### Before (Current):

```typescript
export interface SymbolReference {
  readonly location: Location;
  readonly type: ReferenceType;
  readonly scope_id: ScopeId;
  readonly name: SymbolName;
  readonly context?: ReferenceContext;
  readonly type_info?: TypeInfo;
  readonly call_type?: "function" | "method" | "constructor" | "super";

  readonly type_flow?: {
    source_type?: TypeInfo;        // ❌ Always undefined
    target_type?: TypeInfo;
    is_narrowing: boolean;         // ❌ Always false
    is_widening: boolean;          // ❌ Always false
  };

  readonly return_type?: TypeInfo;

  readonly member_access?: {
    object_type?: TypeInfo;
    access_type: "property" | "method" | "index";
    is_optional_chain: boolean;    // ⚠️ Always false (but implementable)
  };
}
```

### After (Proposed):

```typescript
export interface SymbolReference {
  readonly location: Location;
  readonly type: ReferenceType;
  readonly scope_id: ScopeId;
  readonly name: SymbolName;
  readonly context?: ReferenceContext;
  readonly type_info?: TypeInfo;
  readonly call_type?: "function" | "method" | "constructor" | "super";

  // SIMPLIFIED: Only target type (when extractable)
  readonly assignment_type?: TypeInfo;

  readonly return_type?: TypeInfo;

  readonly member_access?: {
    object_type?: TypeInfo;
    access_type: "property" | "method" | "index";
    is_optional_chain: boolean;    // ✅ Will be implemented
  };
}
```

## Sub-Tasks

### 11.106.1 - Audit type_flow Usage (30 minutes)

Search codebase for all usages of `type_flow` fields:
- `source_type` references
- `is_narrowing` references
- `is_widening` references

Document what (if anything) depends on these fields.

**Success Criteria:**
- ✅ Complete list of all `type_flow` usages
- ✅ Confirmation that nothing depends on deleted fields

### 11.106.2 - Remove type_flow.source_type (30 minutes)

Delete the `source_type` field and all code that sets it to `undefined`.

**Files to Modify:**
- `packages/types/src/semantic_index.ts` - Remove from interface
- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts` - Remove assignment

**Success Criteria:**
- ✅ Field removed from TypeScript interface
- ✅ No code references `source_type`
- ✅ TypeScript compiles

### 11.106.3 - Remove type_flow Boolean Flags (30 minutes)

Delete `is_narrowing` and `is_widening` fields.

**Files to Modify:**
- `packages/types/src/semantic_index.ts` - Remove from interface
- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts` - Remove assignments

**Success Criteria:**
- ✅ Fields removed from interface
- ✅ No code references these flags
- ✅ TypeScript compiles

### 11.106.4 - Simplify type_flow to assignment_type (45 minutes)

Replace the complex `type_flow` object with a simple `assignment_type?: TypeInfo` field.

**Changes:**
1. Rename `type_flow` to `assignment_type` in interface
2. Update reference_builder.ts to assign directly (not wrapped in object)
3. Update any tests that check for `type_flow.target_type`

**Files to Modify:**
- `packages/types/src/semantic_index.ts`
- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`
- Any test files that assert on `type_flow`

**Success Criteria:**
- ✅ `type_flow` replaced with `assignment_type`
- ✅ All tests updated and passing
- ✅ TypeScript compiles

### 11.106.5 - Audit containing_function Usage (15 minutes)

Search for any code that reads or writes `context.containing_function`.

**Decision Point:**
- If USED: Keep and add to follow-up task to implement via ScopeBuilder
- If UNUSED: Delete in sub-task 11.106.6

**Success Criteria:**
- ✅ Usage documented
- ✅ Decision made: keep or delete

### 11.106.6 - Remove containing_function (If Unused) (15 minutes)

**Conditional:** Only if task 11.106.5 determines it's unused.

Delete `containing_function` from `ReferenceContext`.

**Files to Modify:**
- `packages/types/src/semantic_index.ts`

**Success Criteria:**
- ✅ Field removed
- ✅ TypeScript compiles

### 11.106.7 - Implement is_optional_chain Detection (45 minutes)

Add optional chain detection to language-specific metadata extractors.

**Languages:**
- JavaScript/TypeScript: `obj?.method()`, `obj?.prop`
- Python: N/A (no optional chaining)
- Rust: N/A (no optional chaining)

**Implementation:**
- Update `javascript_metadata.ts` to detect `optional_chain` AST nodes
- Update `extract_call_receiver` to return chain flag
- Update reference_builder.ts to use the flag

**Files to Modify:**
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts`
- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`

**Success Criteria:**
- ✅ Optional chain detected in JavaScript/TypeScript
- ✅ Tests added for `obj?.method()` patterns
- ✅ Other languages return `false` (correct for those languages)

### 11.106.8 - Update All Tests (30 minutes)

Update test assertions to match new simplified structure.

**Test Categories:**
- Reference builder tests
- Metadata extractor tests
- Semantic index integration tests

**Changes:**
- Remove assertions on deleted fields
- Update `type_flow.target_type` → `assignment_type`
- Add tests for `is_optional_chain` detection

**Success Criteria:**
- ✅ All existing tests updated
- ✅ New tests for optional chain detection
- ✅ Zero test regressions

### 11.106.9 - Update Documentation (15 minutes)

Update documentation to reflect simplified interface.

**Files to Update:**
- `METADATA_EXTRACTORS_GUIDE.md` - Update examples
- `REFERENCE_METADATA_PLAN.md` - Note field removals
- Any inline comments in code

**Success Criteria:**
- ✅ Documentation matches implementation
- ✅ No references to deleted fields
- ✅ Examples use new `assignment_type` field

## Implementation Sequence

```
11.106.1 (Audit type_flow)
    ↓
11.106.2 (Remove source_type) ─┐
    ↓                          │
11.106.3 (Remove boolean flags) ┤─→ Can run in parallel
    ↓                          │
11.106.4 (Simplify to assignment_type)
    ↓
11.106.5 (Audit containing_function)
    ↓
11.106.6 (Remove containing_function - conditional)
    ↓
11.106.7 (Implement is_optional_chain)
    ↓
11.106.8 (Update tests)
    ↓
11.106.9 (Update docs)
```

## Files Affected

| File | Tasks | Change Type |
|------|-------|------------|
| `packages/types/src/semantic_index.ts` | 11.106.2-4, 11.106.6 | Interface definition |
| `packages/core/src/.../reference_builder.ts` | 11.106.2-4, 11.106.7 | Field assignments |
| `packages/core/src/.../javascript_metadata.ts` | 11.106.7 | Add optional chain detection |
| `packages/core/src/.../metadata_types.ts` | 11.106.7 | Update extractor interface |
| Test files | 11.106.8 | Update assertions |
| Documentation | 11.106.9 | Update examples |

## Success Metrics

### Code Quality
- ✅ TypeScript compiles with 0 errors
- ✅ All tests pass (maintain 99.6% pass rate)
- ✅ No references to deleted fields remain

### Functional Improvement
- ✅ Optional chain detection working for JS/TS
- ✅ Simplified interface easier to understand
- ✅ Less confusing "always undefined/false" fields

### Documentation Quality
- ✅ All docs updated
- ✅ No stale references
- ✅ Clear examples of new structure

## Testing Strategy

### Unit Tests
- Verify optional chain detection in JS/TS
- Test that simplified `assignment_type` works

### Integration Tests
- Semantic index tests still pass
- Reference builder tests updated
- No regressions in full test suite

### Validation
- Search codebase for deleted field names (should be 0 results)
- Run full test suite (should match current baseline)

## Risk Assessment

**Risk Level:** Low

- Changes are primarily deletions (low risk)
- Deleted fields were never populated (no behavior change)
- Optional chain implementation is additive
- Comprehensive test coverage exists

## Related Tasks

- **task-epic-11.104** - Metadata extraction (revealed these issues)
- **task-epic-11.105** - Type hint simplification (related cleanup)

## Notes

### Why Delete vs Deprecate?

Per user request: "we should *delete*, not mark deprecated, any fields and usages of fields that are no longer needed"

Rationale:
1. Fields were never working (always undefined/false)
2. No downstream dependencies identified
3. Early in project lifecycle (not public API yet)
4. Cleaner to remove than carry dead code

### What Counts as "Usage"?

**Production code usage:** Code that READS these fields for business logic counts as usage.

**Test-only usage:** Test assertions on these fields do NOT count as usage and should be DELETED along with the fields.

**Examples:**
```typescript
// ❌ This is production usage - would prevent deletion
function analyzeTypeFlow(ref: SymbolReference) {
  if (ref.type_flow?.is_narrowing) {
    // Do something with narrowing information
  }
}

// ✅ This is test-only usage - DELETE the test assertion
expect(reference.type_flow?.is_narrowing).toBe(false);
```

When auditing usage (task 11.106.1), ignore test files. When deleting fields, also delete any test assertions on those fields.

### What About containing_function?

Task 11.106.5 will determine if this field is used anywhere. If it's needed for future work, we'll keep it and add a follow-up task to implement via ScopeBuilder integration. If unused, delete it.

### Optional Chain as Special Case

`is_optional_chain` is the only field that CAN be extracted but isn't yet. We'll implement it as part of this cleanup since it's JavaScript/TypeScript-only and straightforward to detect from AST.

## Follow-Up Work

After this task:

1. **If containing_function kept:** Create task to implement via ScopeBuilder
2. **Performance:** Profile impact of optional chain detection
3. **Enhancement:** Consider other extractable patterns we're missing

## Estimated Time Breakdown

| Sub-task | Estimated | Notes |
|----------|-----------|-------|
| 11.106.1 | 30 min | Audit type_flow usage |
| 11.106.2 | 30 min | Remove source_type |
| 11.106.3 | 30 min | Remove boolean flags |
| 11.106.4 | 45 min | Simplify to assignment_type |
| 11.106.5 | 15 min | Audit containing_function |
| 11.106.6 | 15 min | Remove containing_function (conditional) |
| 11.106.7 | 45 min | Implement optional chain |
| 11.106.8 | 30 min | Update tests |
| 11.106.9 | 15 min | Update docs |
| **Total** | **3.75 hours** | ~4 hours with buffer |

## Definition of Done

- ✅ All unused fields deleted from interfaces
- ✅ All code setting deleted fields removed
- ✅ `type_flow` simplified to `assignment_type`
- ✅ Optional chain detection implemented for JS/TS
- ✅ All tests updated and passing
- ✅ Documentation reflects new structure
- ✅ TypeScript compiles with 0 errors
- ✅ Zero test regressions
- ✅ No references to deleted fields in codebase

---

**Last Updated:** 2025-10-01
**Next Step:** Start with 11.106.1 (Audit type_flow usage)
