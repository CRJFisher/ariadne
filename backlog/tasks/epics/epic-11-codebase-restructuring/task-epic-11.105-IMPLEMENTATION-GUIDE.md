# Task Epic 11.105 Implementation Guide

**Quick Reference for Simplifying Type Hint Extraction**

## Overview

This epic removes 83% of type extraction code (1,513 LOC → 250 LOC) by eliminating unused/duplicate structures and focusing on what method resolution actually needs.

## Task Structure (11 tasks total)

```
105 - Simplify Type Hint Extraction (Parent)
├── 105.1 - Audit actual usage of type structures (1h) ✅ FOUNDATION
├── 105.2 - Remove local_types from semantic index (1.5h)
├── 105.3 - Remove local_type_tracking from semantic index (1h)
├── 105.4 - Remove unused type_flow fields (1h)
├── 105.5 - Rename and simplify type_annotations (1h)
├── 105.6 - Extract constructor_calls directly (1.5h)
├── 105.7 - Enhance local_type_context building (2h)
├── 105.8 - Migrate tests from local_types to index.classes (1.5h)
├── 105.9 - Remove tests for deleted structures (45m)
├── 105.10 - Update documentation and examples (1h)
└── 105.11 - Validation and cleanup (45m)

Total Estimated Effort: 12.5 hours
```

## Implementation Sequence

### Phase 1: Foundation - Audit (1 hour) 🔍

**Task 105.1: Document actual usage patterns**

Create audit document showing:
1. Where each type structure is used (grep analysis)
2. What percentage is in tests vs production
3. What data is actually accessed from each structure

**Files to audit:**
- `local_types`: Check usage in production (spoiler: only tests + enhanced_context.ts)
- `local_type_tracking`: Check usage (spoiler: only enhanced_context.ts)
- `local_type_flow`: Check which fields are used (spoiler: only constructor_calls)
- `local_type_annotations`: Check usage (spoiler: used in local_type_context.ts)

**Deliverable:** `AUDIT-type-structures-usage.md` with concrete line numbers

**Why first:** Need proof before deletion to avoid "what if we need it?" debates

---

### Phase 2: Remove Unused Code (3.5 hours) 🗑️

#### Task 105.2: Remove local_types (1.5 hours)

**Problem:** `local_types` duplicates data already in `ClassDefinition.methods[]`

**Steps:**
1. Remove `local_types` field from `SemanticIndex` interface
2. Remove `extract_type_members()` function
3. Delete `/definitions/type_members/` directory (689 LOC)
4. Update `build_semantic_index()` to remove Phase 6
5. Fix compilation errors (should only be in tests)

**Files modified:**
- `src/index_single_file/semantic_index.ts` (interface + builder)
- Delete `src/index_single_file/definitions/type_members/`

**Tests affected:**
- `semantic_index.rust.test.ts` (uses `local_types` for Rust generics)
- Will fix in Task 105.8

**Validation:**
```bash
npm run build  # Should compile
# Tests will fail - expected at this stage
```

---

#### Task 105.3: Remove local_type_tracking (1 hour)

**Problem:** Only used in abandoned `enhanced_context.ts`, overlaps with `type_annotations`

**Steps:**
1. Remove `local_type_tracking` field from `SemanticIndex` interface
2. Remove `extract_type_tracking()` function
3. Delete `/references/type_tracking/` directory (342 LOC)
4. Update `build_semantic_index()` to remove Phase 8
5. Fix `enhanced_context.ts` (mark as deprecated or remove if unused)

**Files modified:**
- `src/index_single_file/semantic_index.ts`
- Delete `src/index_single_file/references/type_tracking/`
- `src/resolve_references/method_resolution_simple/enhanced_context.ts` (handle gracefully)

**Validation:**
```bash
npm run build
grep -r "local_type_tracking" src/  # Should only find in tests/enhanced_*
```

---

#### Task 105.4: Remove unused type_flow fields (1 hour)

**Problem:** Only `constructor_calls` is used; rest are stubs

**Steps:**
1. Update `LocalTypeFlowData` interface to only include `constructor_calls`
2. Remove `assignments`, `returns`, `call_assignments` fields
3. Simplify `extract_type_flow()` to only extract constructors
4. Remove helper functions for unused flows

**Files modified:**
- `src/index_single_file/references/type_flow_references/type_flow_references.ts`

**Before:**
```typescript
export interface LocalTypeFlowData {
  readonly constructor_calls: LocalConstructorCall[];
  readonly assignments: LocalAssignmentFlow[];  // ❌ Remove
  readonly returns: LocalReturnFlow[];          // ❌ Remove
  readonly call_assignments: LocalCallAssignment[]; // ❌ Remove
}
```

**After:**
```typescript
export interface LocalTypeFlowData {
  readonly constructor_calls: LocalConstructorCall[];
}
```

**Validation:**
```bash
npm run build
npm test -- type_flow_references.test.ts
```

---

### Phase 3: Simplify Remaining Structures (2.5 hours) 🎯

#### Task 105.5: Rename local_type_annotations → type_annotations (1 hour)

**Goal:** Clear, consistent naming without "local_" prefix

**Steps:**
1. Rename `local_type_annotations` → `type_annotations` in `SemanticIndex`
2. Rename `LocalTypeAnnotation` → `TypeAnnotation`
3. Rename `process_type_annotations()` → `extract_type_annotations()`
4. Update all imports and usage

**Files modified:**
- `src/index_single_file/semantic_index.ts` (interface)
- `src/index_single_file/references/type_annotation_references/` (types + function)
- `src/resolve_references/local_type_context/local_type_context.ts` (usage)
- `src/resolve_references/method_resolution_simple/enhanced_context.ts` (usage)

**Find/Replace:**
- `local_type_annotations` → `type_annotations`
- `LocalTypeAnnotation` → `TypeAnnotation`
- `process_type_annotations` → `extract_type_annotations`

**Validation:**
```bash
npm run build
npm test -- type_annotation_references.test.ts
```

---

#### Task 105.6: Extract constructor_calls directly (1.5 hours)

**Goal:** Flatten structure - don't need `LocalTypeFlowData` wrapper for single field

**Steps:**
1. Add `constructor_calls` directly to `SemanticIndex`
2. Remove `local_type_flow` field
3. Create `extract_constructor_calls()` function
4. Update `build_semantic_index()` to call new extractor
5. Update usage in `local_type_context.ts`

**Files modified:**
- `src/index_single_file/semantic_index.ts` (interface + builder)
- Create `src/index_single_file/references/constructor_calls/constructor_calls.ts`
- Update `src/resolve_references/local_type_context/local_type_context.ts`

**Before:**
```typescript
export interface SemanticIndex {
  readonly local_type_flow: LocalTypeFlowData;
}

// Usage:
index.local_type_flow.constructor_calls
```

**After:**
```typescript
export interface SemanticIndex {
  readonly constructor_calls: ConstructorCall[];
}

// Usage:
index.constructor_calls
```

**Validation:**
```bash
npm run build
npm test -- local_type_context.test.ts
```

---

### Phase 4: Enhance Type Context (2 hours) 🚀

#### Task 105.7: Add missing type resolution strategies (2 hours)

**Goal:** Make up for removed code by improving what remains

**Current strategies in `build_local_type_context()`:**
1. ✅ Constructor calls (`new User()`)
2. ✅ Type annotations (`let x: User`)
3. ❌ Function return types (not implemented)
4. ❌ Import-based hints (partially implemented)

**Add new strategies:**

**Strategy 3: Function return type hints**
```typescript
// If function has return type annotation, track it
function getUser(): User { ... }

// When resolving:
const user = getUser();  // user has type User
user.method();  // Look for method on User
```

**Implementation:**
1. Check if function has return type annotation
2. Store in `variable_types` map when result is assigned
3. Use in `get_variable_type()` lookup

**Strategy 4: Import-based type hints**
```typescript
import { User } from './user';

// 'User' is known to be a class
const u = new User();  // Already works via constructor
const u2: User = ...;  // Should work via annotations
```

**Implementation:**
1. When resolving type names in annotations, check imports first
2. Store import → SymbolId mapping in type context
3. Use in `resolve_type_name()`

**Files modified:**
- `src/resolve_references/local_type_context/local_type_context.ts`

**Tests to add:**
- Function return type tracking
- Import resolution for annotated types

**Validation:**
```bash
npm test -- local_type_context.test.ts
# Should have higher method resolution coverage
```

---

### Phase 5: Test Migration (2.25 hours) 🧪

#### Task 105.8: Migrate tests from local_types to index.classes (1.5 hours)

**Problem:** Tests use `local_types` to check class methods/properties

**Solution:** Use canonical `ClassDefinition.methods[]` instead

**Files to migrate:**
- `src/index_single_file/semantic_index.rust.test.ts` (main user of local_types)

**Migration pattern:**

**Before:**
```typescript
const pointType = index.local_types.find(t => t.type_name === "Point");
expect(pointType.direct_members.has("new")).toBe(true);
```

**After:**
```typescript
const pointClass = Array.from(index.classes.values())
  .find(c => c.name === "Point");
expect(pointClass.methods.some(m => m.name === "new")).toBe(true);
```

**Steps:**
1. Find all uses of `local_types` in tests
2. Rewrite to use `index.classes`, `index.interfaces`, etc.
3. Verify test still validates the same behavior
4. Run tests to ensure no regressions

**Validation:**
```bash
npm test -- semantic_index.rust.test.ts
npm test -- semantic_index.javascript.test.ts
npm test -- semantic_index.typescript.test.ts
```

---

#### Task 105.9: Remove tests for deleted structures (45 minutes)

**Goal:** Delete test files for removed code

**Files to delete:**
- `src/index_single_file/definitions/type_members/type_members.test.ts`
- `src/index_single_file/references/type_tracking/type_tracking.test.ts`
- `src/index_single_file/references/type_flow_references/type_flow_references.test.ts` (partially)

**Keep:**
- Constructor call extraction tests (move to new file)

**Steps:**
1. Extract constructor call tests to new file
2. Delete old test files
3. Update test imports
4. Verify test suite still comprehensive

**Validation:**
```bash
npm test  # All remaining tests pass
npm run test:coverage  # Coverage maintained or improved
```

---

### Phase 6: Documentation (1.75 hours) 📚

#### Task 105.10: Update documentation and examples (1 hour)

**Update files:**
- `docs/Architecture.md` - Update semantic index section
- `CLAUDE.md` - Update type processing guidelines
- `packages/core/README.md` - Update API examples

**Add comments:**
- Explain purpose of `type_annotations` vs `constructor_calls`
- Document what type hints are extracted and why
- Clarify that type members live in definitions, not separate structure

**Create examples:**
```typescript
// Example: Using semantic index type hints
const index = build_semantic_index(file, tree, "typescript");

// Type annotations: explicit types in code
index.type_annotations.forEach(ann => {
  console.log(`${ann.annotation_text} at ${ann.location}`);
});

// Constructor calls: instance creation
index.constructor_calls.forEach(ctor => {
  console.log(`new ${ctor.class_name}() assigned to ${ctor.assigned_to}`);
});

// Type members: use definitions directly
index.classes.forEach(cls => {
  console.log(`Class ${cls.name} has methods: ${cls.methods.map(m => m.name)}`);
});
```

---

#### Task 105.11: Validation and cleanup (45 minutes)

**Final checks:**

1. **Full test suite**
```bash
npm test
```

2. **Build validation**
```bash
npm run build
```

3. **Coverage check**
```bash
npm run test:coverage
# Should maintain or improve coverage
```

4. **Performance benchmark**
```bash
# Index a large file, compare before/after
time npm run benchmark:indexing
```

5. **Code cleanup**
- Remove TODO comments about type extraction
- Remove deprecated `enhanced_context.ts` if unused
- Update CHANGELOG.md with changes

6. **Documentation review**
- All new code has JSDoc comments
- Architecture docs updated
- Migration guide for users (if public API)

---

## Critical Path

**Must complete in order:**
1. Task 105.1 (Audit) - Need proof before deletion
2. Tasks 105.2-105.4 (Remove code) - Can be done in parallel
3. Tasks 105.5-105.6 (Simplify) - Depends on removals
4. Task 105.7 (Enhance) - Can overlap with tests
5. Tasks 105.8-105.9 (Tests) - Depends on interface changes
6. Tasks 105.10-105.11 (Docs + validation) - Final polish

## Rollback Plan

If issues discovered:
1. Revert commits (git history preserved)
2. Re-evaluate which structures are truly needed
3. Consider hybrid approach (keep some, remove others)

## Success Metrics

- ✅ 80%+ reduction in type extraction code
- ✅ All method resolution tests pass
- ✅ No performance regression
- ✅ Test coverage maintained
- ✅ Clear documentation of purpose

## Key Files Changed

### Deleted (1,513 LOC):
- `src/index_single_file/definitions/type_members/` (689 LOC)
- `src/index_single_file/references/type_tracking/` (342 LOC)
- `src/index_single_file/references/type_flow_references/` (273 LOC) - mostly
- Related test files (209 LOC)

### Modified:
- `src/index_single_file/semantic_index.ts` - Interface simplification
- `src/resolve_references/local_type_context/local_type_context.ts` - Enhanced strategies
- Test files using `local_types` - Migration to `index.classes`

### Created (~250 LOC):
- `src/index_single_file/references/constructor_calls/constructor_calls.ts`
- Enhanced type context strategies
- New documentation

## Timeline

**Aggressive (1.5 days):** One task per 1-1.5 hours
**Moderate (3 days):** Careful testing between each task
**Conservative (1 week):** Full validation at each phase

Recommend **moderate timeline** with phase-level validation.
