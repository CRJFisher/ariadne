---
id: TASK-199.14
title: "Fix: redundant bare scope patterns cause duplicate captures in JS/TS .scm files"
status: Done
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - bugfix
  - query-code-tree
  - correctness
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
  - packages/core/src/index_single_file/scopes/scopes.ts
parent_task_id: TASK-199
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

### Root Cause

The `.scm` query files for JavaScript and TypeScript contain bare catch-all scope patterns that overlap with more specific predicate-guarded patterns, producing duplicate scope captures for the same AST node.

**Bare catch-all patterns (the problem):**
- `javascript.scm` line 18: `(method_definition) @scope.method`
- `typescript.scm` line 23: `(method_definition) @scope.method`

These match ALL `method_definition` nodes unconditionally. But more specific patterns later in each file also capture `@scope.method` or `@scope.constructor` for the same nodes, with predicates to differentiate constructors from regular methods.

**Example: constructor in JavaScript gets two scope captures:**

| Pattern | Captures | Predicate |
|---------|----------|-----------|
| Line 18: `(method_definition) @scope.method` | `@scope.method` | None — matches everything |
| Lines 143-148: `(method_definition ... (#not-eq? "constructor")) @scope.method` | Filtered out | `#not-eq?` correctly excludes constructors |
| Lines 155-158: `(method_definition ... (#eq? "constructor")) @scope.constructor` | `@scope.constructor` | `#eq?` correctly matches constructors |

Result: a constructor gets both `@scope.method` (from the bare pattern) and `@scope.constructor` (from the predicate-guarded pattern). Regular methods get two `@scope.method` captures.

TypeScript has additional overlap from modifier patterns at lines 140-143 and 158-161 that also emit `@scope.method`.

### Predicates work correctly

Investigation confirmed that `query.captures()` in tree-sitter v0.21.1 (node-tree-sitter) **does evaluate all predicates**. The JavaScript wrapper at `node_modules/tree-sitter/index.js` line 698 applies predicate filter functions to both `captures()` and `matches()` identically. All predicates used in our `.scm` files (`#eq?`, `#not-eq?`, `#match?`, `#not-match?`) are fully supported. Unknown predicates throw an error — they are never silently ignored. This behavior is unchanged in v0.25.

The `locations_equal` dedup in `scopes.ts` (line 236) is a symptom-level workaround that handles the duplicate scope captures by replacing the less-specific parent scope when two captures have identical locations.

### Impact

- Every `method_definition` in JS/TS produces at least one redundant scope capture
- The `locations_equal` dedup at `scopes.ts:236` masks the issue at the cost of extra processing
- Python and Rust are **not affected** — their scope patterns are embedded within specific predicate-guarded patterns

### Actions

1. **Remove bare catch-all scope patterns** — Delete `(method_definition) @scope.method` from `javascript.scm` line 18 and `typescript.scm` line 23

2. **Add `@scope.method` to private method patterns** — Without the bare catch-all, private methods lose their scope capture:
   - `javascript.scm` line 150-152: add `@scope.method` to the `(method_definition name: (private_property_identifier) ...)` pattern
   - `typescript.scm` lines 365-367: same fix

3. **Remove `@scope.method` from TypeScript modifier-only patterns** — The main definition pattern at lines 358-363 already captures scope. The modifier-only patterns at lines 140-143 and 158-161 should capture only `@modifier.*` and `@definition.*`, not `@scope.method`, to avoid further duplication

4. **Add regression tests** verifying that:
   - Constructors produce exactly one scope capture (`@scope.constructor`, not `@scope.method`)
   - Regular methods produce exactly one `@scope.method` capture
   - Private methods still get a `@scope.method` capture
   - Static methods and methods with access modifiers get exactly one `@scope.method`

5. **Evaluate removing the `locations_equal` dedup at `scopes.ts:236`** — After fixing the patterns, verify with tests that the overlapping-capture code path is no longer triggered. If confirmed dead, remove it. Keep the `locations_equal` usages at lines 214-215 (module scope dedup) — those handle a separate, legitimate concern.
<!-- SECTION:DESCRIPTION:END -->

## Implementation

Commits: `9d8072ed` (actions 1-4), `aae758c6` (action 5)

### Actions completed

1. **Removed bare catch-all patterns** from `javascript.scm` (line 18) and `typescript.scm` (line 23).

2. **Added `@scope.method` to private method patterns** in both `javascript.scm` (line 151) and `typescript.scm` (line 366).

3. **Removed `@scope.method` from TS modifier-only patterns** at lines 139-142 (accessibility_modifier) and lines 157-160 (static). The main definition pattern at lines 357-362 is now the sole scope emitter for regular methods.

4. **Added 9 regression tests** in `scopes.test.ts` under "Method scope capture deduplication" — covering constructors, regular methods, private methods, static methods (JS+TS), and access-modifier methods (TS only).

5. **Removed the `locations_equal` dedup block** from `scopes.ts` (formerly lines 232-268). Verified dead by inserting a throw and running 103 scope tests — none triggered. The `locations_equal` usage at lines 214-215 (module scope dedup) is retained.
