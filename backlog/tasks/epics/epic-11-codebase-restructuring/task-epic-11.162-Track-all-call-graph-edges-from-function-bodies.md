# Task 11.162: Fix Cross-File Call Resolution in Call Graph

## Status: Completed

## Parent: epic-11-codebase-restructuring

## Overview

The call graph detection system failed to resolve calls to functions imported from other files. This caused imported functions to incorrectly appear as entry points with no callers.

## False Positive Groups Addressed

This task addresses the following false positive groups from `top-level-nodes-analysis/results/false_positive_groups.json`:

1. **internal-helper-function-calls-not-tracked** (2 entries)
2. **for-loop-body-calls-not-tracked** (3 entries)
3. **recursive-method-calls-not-tracked** (1 entry)
4. **nested-function-calls-not-tracked** (3 entries)
5. **array-method-argument-calls-not-tracked** (1 entry)

## Root Cause Analysis (Verified via Diagnostics)

### Original Hypothesis (INCORRECT)

The original hypothesis was that "call expressions are only being extracted from certain syntactic contexts" (loops, callbacks, etc.). This was **proven incorrect** by diagnostic testing.

### Actual Root Cause (VERIFIED)

The issue was **TypeScript ESM extension resolution failure**. Diagnostic testing revealed:

1. **Call Extraction Works**: All syntactic patterns (loops, callbacks, nested functions, etc.) ARE correctly captured by tree-sitter queries
2. **Scope Assignment Works**: Calls ARE correctly assigned to the enclosing function's scope
3. **Import Resolution Fails**: Import paths with `.js` extensions were not resolved to `.ts` files

### Evidence from Diagnostic Testing

```text
=== is_valid_capture DIAGNOSTIC (BEFORE FIX) ===

Resolved import path: .../query_code_tree.capture_schema.js  ← WRONG EXTENSION
is_valid_capture resolved in module scope: NO
is_valid_capture resolved calls: 0  ← NOT RESOLVED

=== is_valid_capture DIAGNOSTIC (AFTER FIX) ===

Resolved import path: .../query_code_tree.capture_schema.ts  ← CORRECT
is_valid_capture resolved in module scope: YES
is_valid_capture resolved calls: 1  ← RESOLVED
callers: collect_stats  ← CORRECT CALLER
```

## Solution Implemented

### The Problem

TypeScript's ESM convention requires imports to use `.js` extensions (e.g., `import { foo } from "./bar.js"`), but the actual source files are `.ts`. The `resolve_module_path_typescript` function was not handling this extension mapping.

### The Fix

Modified [import_resolution.typescript.ts](packages/core/src/resolve_references/import_resolution/import_resolution.typescript.ts) to:

1. **Strip `.js`/`.mjs`/`.jsx` extensions** and try `.ts`/`.tsx` first
2. **Add candidates** that replace the JavaScript extension with TypeScript equivalents
3. **Update fallback logic** to prefer `.ts` when the import had a `.js` extension

```typescript
// Handle TypeScript's ESM convention: imports use .js extension but files are .ts
const ext = path.extname(resolved_absolute);
const base_path_without_ext =
  ext === ".js" || ext === ".mjs" || ext === ".jsx"
    ? resolved_absolute.slice(0, -ext.length)
    : resolved_absolute;

// Try TypeScript extensions first (including .js → .ts replacement)
const candidates = [
  // If import had .js extension, try .ts/.tsx first (ESM convention)
  ...(ext === ".js" || ext === ".mjs"
    ? [`${base_path_without_ext}.ts`, `${base_path_without_ext}.tsx`]
    : []),
  // ... rest of candidates
];
```

## Files Modified

- `packages/core/src/resolve_references/import_resolution/import_resolution.typescript.ts`

## Validation

All tests pass:

- `import_resolution.typescript.test.ts` - 31 tests (includes 8 new ESM extension mapping tests)
- All resolve_references tests - 234 tests
- All project tests - 208 tests

## Sub-Tasks

- **Task 11.162.1**: Fix `body_scope_id` assignment in `find_body_scope_for_definition` (separate scope matching issue discovered during diagnostics - still pending)

## Dependencies

- Complements Task 11.161 (named handler extraction)
- Sub-task 11.162.1 addresses a separate scope matching issue
