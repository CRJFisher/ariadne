---
id: task-178
title: Investigate remaining constructor resolution false positives (40 entries)
status: Completed
assignee: []
created_date: '2026-02-10 20:22'
updated_date: '2026-02-12 22:22'
labels:
  - bug
  - call-graph
dependencies: []
priority: medium
---

## Description

Despite epic-11.175.1 being Completed (renamed constructor field to constructors), the Feb 2026 re-analysis of AmazonAdv/projections shows 40 constructor-resolution-bug false positives (up from 26). The remaining entries include both Python __init__ methods and JS constructor methods. Investigate why the prior fix did not fully resolve these cases. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-10T19-09-38.781Z.json. Related: task-epic-11.175.1

Feb 12 re-analysis: down to 21 entries. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-12T18-12-14.458Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Root cause of remaining constructor false positives identified
- [x] #2 Fix implemented or follow-up task created
<!-- AC:END -->

## Root Cause Analysis (Corrected Feb 12, 2026)

The earlier analysis (struck through below) was incorrect. Five planning agents and four reviewer agents all converged: `preprocess_references.python.ts` does NOT skip based on `construct_target`. The preprocessing at lines 62-68 converts `function_call` → `constructor_call` whenever the callee resolves to a class, regardless of whether `construct_target` is defined.

The 21 remaining entries have three distinct root causes:

### Root Cause A: `extract_extends()` Missing Generic Base Classes (CORE BUG — all languages)

`extract_extends()` in `symbol_factories.python.ts:478-494` only handles `identifier` and `attribute` children. Python generic base classes like `class Foo(Bar[T])` produce a `subscript` tree-sitter node, which is silently skipped. This breaks inheritance chains, causing `find_constructor_in_class_hierarchy()` to see an empty `extends` array and return `null`.

__Cross-language:__ TypeScript has the same bug — `extract_class_extends()`, `extract_interface_extends()`, and `extract_implements()` in `symbol_factories.typescript.ts` all skip `generic_type` nodes (`class Foo extends Bar<T>`). JavaScript's `class_heritage` path has the same gap. Rust already handles `generic_type` correctly (`symbol_factories.rust.ts:258-264`).

__Broader impact:__ This breaks not just constructor hierarchy walking but also method resolution through inheritance chains.

__Affected entries:__ Classes inheriting from generic bases (e.g., `_BaseView[DictKeyType, DictValueType]` in `view.py:27`). ~4-6 entries.

### Root Cause B: Grep Heuristic Bug in Triage (DIAGNOSTIC BUG)

`grep_for_calls()` in `extract_entry_points.ts:265` searches for `\b{name}\s*\(` where `name` is the entry point name. For constructors, `name = "__init__"`, so it searches for `__init__(` — which matches every `def __init__(self, ...)` definition in the entire codebase, not actual constructor call sites (`ClassName(`).

This causes `rule_constructor` in `classify_entrypoints.ts:70-83` to misclassify genuinely dead constructors as "constructor-resolution-bug" because `diagnosis !== "no-textual-callers"` is always true (other classes' `__init__` definitions always match).

Note: The actual diagnostic functions are `gather_diagnostics()` and `compute_diagnosis()` in `extract_entry_points.ts` (not `diagnose_entry_point()` which doesn't exist).

__Affected entries:__ `AuthApi`, `FormulasApi`, `RecordsApi`, `ReportsApi`, `UserTokenApi` (OpenAPI-generated, never instantiated), `MessageQueue`, `DFMatcher`, `ProcessingError`, `ValidateError`, `TimeCovariates` — all genuinely dead code. ~10-12 entries.

### Root Cause C: Cross-Module Import Resolution Gaps

Classes imported through deep package paths (`from qb_rest.exceptions import ApiTypeError`) or `__init__.py` re-exports fail name resolution at the call site. Overlaps with task-188.

__Affected entries:__ `ApiTypeError`, `ApiValueError`, `ApiKeyError` (exception classes in `raise` statements), `RESTClientObject` (module-qualified call). ~3-5 entries.

### ~~Previous Root Cause Analysis (Incorrect)~~

~~The primary failure is standalone constructor calls without assignment targets. `extract_construct_target()` returns `undefined`, and `preprocess_references.python.ts` skips conversion to `constructor_call`.~~

This was wrong: preprocessing converts based solely on whether the callee resolves to a class definition. `construct_target` is never checked.

## Quality Review Addendum — Status

| Item | Description | Status |
|------|-------------|--------|
| 1 | `resolve_constructor_call` use hierarchy walking | Already done — uses `find_constructor_in_class_hierarchy()` |
| 2 | Trim barrel exports | Outstanding — `call_resolution/index.ts` barrel is entirely dead code (no imports) |
| 3 | Rename enrichment function | Already done — named `include_constructors_for_class_symbols` |
| 4 | Integration test for enrichment pipeline | Already done — test at `call_resolver.test.ts:677` |
| 5 | `function_call.test.ts` coverage | Already done — collection dispatch and callable instance tests exist |

Only item 2 remains, and it's a cleanup concern (the barrel is unused), not a bug fix.

## Follow-On Work

### Sub-task 1: Fix `extract_extends()` across all languages (FUNDAMENTAL — do first)

The core semantic index bug. Fix across all languages that have the gap:

__Python__ (`symbol_factories.python.ts:483`): Add `subscript` handling — extract `value` child from `subscript` node for `Bar[T]` patterns.

__TypeScript__ (`symbol_factories.typescript.ts`): Add `generic_type` handling to `extract_class_extends()`, `extract_interface_extends()`, and `extract_implements()`.

__JavaScript__ (`symbol_factories.javascript.ts`): Add `generic_type` handling in the `class_heritage` child path.

__Reference pattern__: Rust `extract_impl_type()` at `symbol_factories.rust.ts:258-264` already handles `generic_type` correctly.

__Tests needed__ (currently zero behavioral tests for `extract_extends` in any language):

- Python: `class Foo(Bar[T])`, `class Foo(mod.Bar[T])`, `class Foo(Bar[T], Baz[U])`
- TypeScript: `class Foo extends Bar<T>`, `interface Foo extends Bar<T>`, `class Foo implements Bar<T>`
- JavaScript: generic base class if JS grammar supports it

__Expected impact:__ Fixes inheritance chain resolution for ~4-6 entries. Also fixes method resolution through inheritance for generic base classes (broader win).

### Sub-task 2: Re-run external analysis, then fix grep heuristic

After sub-task 1, re-run `npx tsx src/external_analysis/triage_entry_points.ts` to see how many entries remain.

For remaining dead-code constructors misclassified by the grep: In `gather_diagnostics()` (`extract_entry_points.ts:218`), when `kind === "constructor"`, substitute the class name for the grep search term. Build a `class_name_by_constructor_id: Map<SymbolId, string>` from the Project's definitions registry in `detect_entrypoints.ts` (where `Project` is available) and pass it through.

__Expected impact:__ ~10-12 entries correctly reclassified as true positives (dead code) or sent to LLM triage.

### Sub-task 3: Cross-module import resolution (overlap with task-188)

The remaining ~3-5 entries are caused by import resolution gaps for deep package paths and `__init__.py` re-exports. Verify task-188 scope covers constructor calls on imported exception classes.

### Cleanup: Remove dead barrel file

Delete `packages/core/src/resolve_references/call_resolution/index.ts` — confirmed zero imports across the codebase.

## Implementation Notes

### Sub-task 1: Fix `extract_extends()` for generic base classes

Fixed across all four languages:

- __Python__ (`symbol_factories.python.ts`): Added `subscript` node handling to `extract_extends()`. Extracts the `value` child from `subscript` nodes for patterns like `Bar[T]`, `mod.Bar[T, U]`.
- __TypeScript__ (`symbol_factories.typescript.ts`): Added `generic_type` handling to `extract_class_extends()`, `extract_implements()`, and rewrote `extract_interface_extends()`. The previous interface implementation used `childForFieldName("extends")` which returns `undefined` in tree-sitter-typescript — the grammar uses `extends_type_clause` as a named child instead.
- __JavaScript__ (`symbol_factories.javascript.ts`): Added `generic_type` handling inside the `class_heritage` → `extends_clause`/`implements_clause` path.
- __Rust__: Already correct (reference implementation).

Added behavioral tests for all languages (previously zero existed):

- Python: 7 tests covering simple, generic, module-qualified generic, multi-generic, mixed, and no-base cases
- TypeScript: 14 tests across `extract_class_extends`, `extract_interface_extends`, and `extract_implements`
- JavaScript: 3 tests for generic extends/implements via TypeScript parser path

### Sub-task 2: Fix grep heuristic for constructor entry points

- Added `build_constructor_to_class_name_map()` to `DefinitionRegistry` — iterates all class definitions and maps constructor symbol_ids to class names.
- Modified `gather_diagnostics()` in `extract_entry_points.ts` to use the class name instead of `__init__`/`constructor` when grepping for constructor call sites.
- Updated both `detect_entrypoints.ts` files (external and self-analysis) to build and pass the map.

### Cleanup

- Deleted dead barrel file `packages/core/src/resolve_references/call_resolution/index.ts` (confirmed zero imports).

### Sub-task 3: Cross-module import resolution

Deferred to task-188 (import resolution gaps).
