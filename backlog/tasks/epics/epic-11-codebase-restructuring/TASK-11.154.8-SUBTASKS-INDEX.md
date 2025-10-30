# Task 11.154.8 Subtasks - Final Integration

**Parent Task**: task-epic-11.154.8-Final-Integration-and-Documentation.md

---

## Current Status

**Validation**: ✅ 3 languages at 0 errors (TypeScript, JavaScript, Python)
**Rust**: ❌ 16 errors (agent added fragments back - must fix)
**Tests**: 20 failures out of 1393 (98.6% passing)

---

## Critical Priority

### 11.154.7.1 - Fix Rust Import Builder (BLOCKING)
**File**: [task-epic-11.154.7.1-Fix-Rust-Import-Builder.md](task-epic-11.154.7.1-Fix-Rust-Import-Builder.md)
**Impact**: Fixes 16 validation errors + ~4 test failures
**Time**: 2-3 hours

**Issue**: Agent incorrectly added `@import.import` fragments to rust.scm

**Fix**:
- Remove fragments from rust.scm
- Add builder logic to extract from complete `use_declaration` nodes
- Handle: simple, scoped, list, alias, wildcard patterns

**Blocks**: All other tasks (must have validation passing)

---

## High Priority (After Rust Fixed)

### 11.154.8.1 - Fix Re-export Resolution
**File**: [task-epic-11.154.8.1-Fix-Re-export-Resolution.md](task-epic-11.154.8.1-Fix-Re-export-Resolution.md)
**Impact**: 6 tests
**Time**: 1-2 hours

**Fix**: ResolutionRegistry follows re-export chains
**Approach**: Resolution logic, not captures

### 11.154.8.2 - Fix JavaScript CommonJS Resolution
**File**: [task-epic-11.154.8.2-Fix-JavaScript-CommonJS-Resolution.md](task-epic-11.154.8.2-Fix-JavaScript-CommonJS-Resolution.md)
**Impact**: 6 tests
**Time**: 1-2 hours

**Fix**: Detect `require()` calls as imports via builder
**Approach**: Pattern matching on `@reference.call`, not new captures

---

## Medium Priority

### 11.154.8.3 - Fix Rust Cross-Module Resolution
**File**: [task-epic-11.154.8.3-Fix-Rust-Cross-Module-Resolution.md](task-epic-11.154.8.3-Fix-Rust-Cross-Module-Resolution.md)
**Impact**: 4 tests
**Time**: 1-2 hours (overlaps with 11.154.7.1)

**Fix**: Builder extracts all items from use_list
**Approach**: Complete node traversal

### 11.154.8.4 - Fix Python/TypeScript Edge Cases
**File**: [task-epic-11.154.8.4-Fix-Python-TypeScript-Edge-Cases.md](task-epic-11.154.8.4-Fix-Python-TypeScript-Edge-Cases.md)
**Impact**: 4 tests
**Time**: 1-2 hours

**Fix**: Parameter defaults, decorator extraction
**Approach**: AST traversal from complete nodes

---

## Total Remaining Work

**Test failures**: 20 (after fixing Rust validation)
**Estimated time**: 6-10 hours
- Rust import builder: 2-3 hours (critical)
- Re-export resolution: 1-2 hours
- CommonJS resolution: 1-2 hours
- Rust cross-module: 1-2 hours (overlaps with Rust import)
- Edge cases: 1-2 hours

---

## Execution Order

1. **11.154.7.1** - MUST do first (blocks validation)
2. **11.154.8.1 + 11.154.8.2** - Can do in parallel
3. **11.154.8.3** - After 11.154.7.1 (shares Rust import logic)
4. **11.154.8.4** - Independent, any time

---

## Key Principle for ALL Subtasks

**DO NOT add fragment captures to .scm files**

**DO use**:
- Complete captures (already in queries)
- Builder AST traversal
- Metadata extraction
- Resolution logic

**If you must add a capture**:
1. Ensure it captures a COMPLETE node
2. Add to capture_schema.ts optional list first
3. Document why it's necessary
4. Get validation passing

---

## Success Criteria

- [ ] All 20 test failures fixed
- [ ] Rust validation: 0 errors, 0 warnings
- [ ] All languages validation: 0 errors, 0 warnings
- [ ] Test pass rate: 100% (or document acceptable skips)
- [ ] Complete capture principle maintained
- [ ] Entry point detection bug verified fixed
