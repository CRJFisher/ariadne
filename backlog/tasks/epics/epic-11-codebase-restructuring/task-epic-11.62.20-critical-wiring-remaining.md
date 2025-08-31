---
id: task-epic-11.62.20
title: Critical Remaining Wiring for Processing Pipeline
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, critical, wiring, integration]
dependencies: [task-epic-11.62.11]
parent_task_id: task-epic-11.62
priority: CRITICAL
---

## 🚨 CRITICAL WIRING GAPS 🚨

Based on comprehensive review of PROCESSING_PIPELINE.md, these critical wirings are still missing or incomplete:

## Immediate Priority - Breaking Cross-File Analysis

### 1. ✅ Type Tracking → Import Resolution (task 11.62.3 - FIXED 2025-08-30)
**Current State:** ✅ Type tracking now properly resolves imported types
**Impact:** ✅ Can track types from other files correctly
**Location:** `/type_analysis/type_tracking` now receives import info
**Fix:** ✅ Imports passed to type tracking, imported types properly qualified

### 2. ✅ Method Calls → Type Tracking (task 11.62.4 - FIXED 2025-08-30)
**Current State:** ✅ Method calls now receive enriched type map with imports
**Impact:** ✅ Can resolve methods on imported classes correctly
**Location:** `/call_graph/method_calls` now receives enriched_type_map
**Fix:** ✅ Reordered operations to pass enriched map after constructor merge

### 3. ✅ Symbol Resolution → Import Resolution (task 11.62.14 - FIXED 2025-08-31)
**Current State:** ✅ Symbol resolution now uses imports from Layer 1/2
**Impact:** ✅ No more duplicate extraction, improved performance
**Location:** `/scope_analysis/symbol_resolution` now receives imports properly
**Fix:** ✅ Removed duplicate extraction functions, uses imports parameter

### 4. ✅ Type Propagation → Call Graph (FIXED 2025-08-31)
**Current State:** ✅ Type propagation now uses call graph information
**Impact:** ✅ Types flow through function, method, and constructor calls
**Location:** `/type_analysis/type_propagation` with new call_propagation module
**Fix:** ✅ Added propagation functions for all call types

## High Priority - Incomplete Features

### 5. Generic Type Resolution (task 11.62.12)
**Current State:** No generic type parameter support
**Impact:** Cannot handle TypeScript/Rust generics
**Location:** Need new module in `/type_analysis/`
**Fix:** Create generic type resolver, wire to type registry

### 6. Return Type Inference Integration (task 11.62.13)
**Current State:** Return type inference exists but not integrated
**Impact:** Missing critical type information
**Location:** `/type_analysis/return_type_inference`
**Fix:** Wire return types to type maps and propagation

### 7. Virtual Method Resolution
**Current State:** Enrichment exists but no polymorphic resolution
**Impact:** Cannot trace virtual dispatch
**Location:** `/call_graph/method_calls/method_hierarchy_resolver`
**Fix:** Add virtual dispatch resolution using hierarchy

## Medium Priority - Architecture Validation

### 8. Validate All Modules Follow Patterns (task 11.62.18)
**Current State:** Unknown compliance with Architecture.md
**Impact:** Inconsistent code organization
**Fix:** Audit all modules for dispatcher pattern compliance

### 9. Remove Unused Parameters (task 11.62.17)
**Current State:** Functions have unused parameters from old design
**Impact:** Confusing API, maintenance burden
**Fix:** Clean up function signatures

### 10. Fix Remaining Export Tests (task 11.62.16)
**Current State:** Some export tests still failing
**Impact:** Export detection might be incomplete
**Fix:** Update tests for new architecture

## Wiring Checklist

### Per-File Phase Wirings
- [x] Type tracking receives imports (✅ Fixed 2025-08-30)
- [x] Method calls receive enriched type map (✅ Fixed 2025-08-30)
- [ ] Constructor types flow back to type map (✅ Done in 11.62.11)
- [ ] Return types integrated into type tracking

### Global Assembly Wirings
- [ ] Type registry built from all files (✅ Done in 11.62.11)
- [ ] Class hierarchy built from all classes (✅ Done in 11.62.11)
- [x] Symbol resolution consumes imports (✅ Fixed 2025-08-31)
- [x] Type propagation uses call graph (✅ Fixed 2025-08-31)

### Enrichment Phase Wirings
- [ ] Method enrichment applied (✅ Done in 11.62.11)
- [ ] Constructor enrichment applied (✅ Done in 11.62.11)
- [ ] Virtual method resolution added
- [ ] Generic type resolution integrated

## Success Criteria

1. **Cross-file type tracking works**: Can track `const x = new ImportedClass()`
2. **Method resolution works**: Can resolve `importedObj.method()`
3. **Virtual dispatch works**: Can trace polymorphic calls
4. **Type flow works**: Types propagate through function calls
5. **No duplicate extraction**: Each piece of data extracted once

## Implementation Order

1. **First**: Wire type tracking → imports (enables cross-file types)
2. **Second**: Wire method calls → enriched types (enables method resolution)
3. **Third**: Fix symbol resolution to consume imports (removes duplication)
4. **Fourth**: Wire type propagation → call graph (enables type flow)
5. **Fifth**: Add generic type support (completes type system)

## Testing Requirements

Each wiring must have an integration test that verifies:
- Data flows correctly between modules
- Cross-file scenarios work
- No performance regression
- Error cases handled gracefully

## Notes

This task consolidates all critical wiring needs discovered during the PROCESSING_PIPELINE.md review. Many sub-tasks claim to be "complete" but the actual wiring is missing or partial. This task ensures we actually connect all the pieces.