---
id: TASK-349.3
title: "Apply two small Phase-1 corrections: self-initializer ordering and sibling/hoist propagation"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-349
priority: high
ordinal: 3000
plan_dedup_keys:
  - a21fbd7311550458aaa9a5695b44828cfa762ee8fef7c903560d56cf5913b7c7
plan_source_tasks:
  - pt-c009557cba419023
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Two same-file binding gaps remain in `name_resolution.ts` (4-member leaf). These are the only rows whose failure is genuinely a Phase-1 defect.

## Change C.1 — import-vs-local self-initializer ordering

Phase-1 Step-2 (`name_resolution.ts:191-196`) layers _all_ local definitions over imports unconditionally. For `let has_flatten = has_flatten(fields)` (serde `struct_.rs:67`), this registers the local binding so the call resolves to the just-declared variable instead of the imported function. The minimal, correct rule: resolve the call reference against the binding in scope _at the reference position_ — do not let a `let x = … x(…)` self-initializer shadow the import for the reference inside its own initializer. Scope this narrowly to the self-initializer case so correct shadowing elsewhere is unchanged.

## Change C.2 — sibling-scope / hoisted-function propagation

A function defined in a sibling inner scope (or hoisted in JS) is absent from the scope map of the calling sibling scope: nest `cleanup` called inside a `this.done` arrow before its sibling `function cleanup` declaration; serde `content_as_str` intra-file. Add propagation in `resolve_scope_recursive`'s child recursion so a function definition is present in the scope map of sibling scopes that lexically reach it (JS function hoisting into the enclosing scope; Rust same-module items).

C.2 is confined to `resolve_references/name_resolution.ts`. C.1 is not: the self-initializer signal it keys on (`VariableDefinition.initialized_from_call`) is emitted only by the JS/TS indexers, so the Rust evidence case (serde `struct_.rs:67`) needs the Rust capture handler to emit it too. C.1 therefore spans the Rust indexer (`query_code_tree/symbol_factories/symbol_factories.rust.ts` + `capture_handlers/capture_handlers.rust.ts`) and `name_resolution.ts`. This matches the parent epic's finding that the plan engine's "one Phase-1 binding gap, all in `name_resolution.ts`" framing is wrong on count and altitude.

<!-- SECTION:DESCRIPTION:END -->

## Test Plan

Add one integration test per evidence case for both corrections, plus a negative control proving the narrow scope. Each correction has a positive case (the corpus shape that must now resolve) and the C.1 change carries a negative case (a non-self-initializer shadow that must keep resolving to the local). Both corrections are same-file, so each fixture is a single file exercised through `Project` + `update_file`. Assert the exact target `SymbolId` (or that the symbol is no longer an entry point) with `toEqual` — never an existence-only check.

### Fixtures

- **`tests/fixtures/rust/code/modules/self_initializer_shadow.rs`** — the serde `struct_.rs:67` shape: `use …::has_flatten;` then `let has_flatten = has_flatten(fields);`. The call inside the initializer must resolve to the imported function.
- **`tests/fixtures/rust/code/modules/sibling_module_item.rs`** — the serde `content_as_str` shape: a function called before its sibling same-module item declaration.
- **`tests/fixtures/javascript/code/functions/sibling_hoisted_call.js`** — a nested `cleanup()` called inside a `this.done` arrow before the sibling `function cleanup() {…}` declaration (JS function hoisting).
- **`tests/fixtures/rust/code/modules/non_self_initializer_shadow.rs`** — negative control: a `let x = …;` binding (not its own initializer) that a later reference must resolve to the **local**, proving correct shadowing is unchanged.

### Cases

| # | Evidence case | Correction | Test location | Fixture | Assertion |
| - | ------------- | ---------- | ------------- | ------- | --------- |
| C1 | `let has_flatten = has_flatten(fields)` self-initializer resolves to the imported fn | C.1 | `resolve_references/resolve_references.rust.test.ts` | `self_initializer_shadow.rs` | the call resolves to the imported function, not the local `let`; imported fn is not an entry point |
| C1-neg | Non-self-initializer shadow still resolves to the local | C.1 | `resolve_references.rust.test.ts` | `non_self_initializer_shadow.rs` | a later reference resolves to the local binding (shadowing unchanged) |
| C2-js | Nested `cleanup()` before its sibling `function cleanup` declaration resolves (JS hoist) | C.2 | `resolve_references/resolve_references.javascript.test.ts` | `sibling_hoisted_call.js` | the `cleanup()` call resolves to the hoisted function; `cleanup` is not an entry point |
| C2-rust | `content_as_str` called before its sibling same-module item resolves | C.2 | `resolve_references.rust.test.ts` | `sibling_module_item.rs` | the call resolves to the same-module function definition |
| C3 | Correction scope is honoured | C.1 + C.2 | n/a (diff review) | n/a | C.2 changes only `name_resolution.ts` (`resolve_scope_recursive`); C.1 changes `name_resolution.ts` (self-initializer carve-out) plus the Rust indexer to emit `initialized_from_call` at JS/TS parity |

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 (C1) Integration test on `self_initializer_shadow.rs`: a serde-style `let x = … x(…)` self-initializer resolves the call to the imported function, not the local binding.
- [x] #2 (C2-js, C2-rust) A nested function called before its sibling declaration resolves to the function definition — covered for both JS hoisting (`sibling_hoisted_call.js`) and Rust same-module items (`sibling_module_item.rs`).
- [x] #3 (C1-neg) Correct shadowing in non-self-initializer cases is unchanged (`non_self_initializer_shadow.rs`) — the ordering fix is scoped to the self-initializer.
- [x] #4 (C3) C.2 is confined to `resolve_references/name_resolution.ts` (`resolve_scope_recursive`). C.1's name-resolution edit lives there too (self-initializer carve-out), and C.1 additionally brings the Rust indexer to JS/TS parity by emitting `initialized_from_call` — it is not confined to `name_resolution.ts`, because the Rust evidence case cannot be fixed without that signal.

<!-- AC:END -->

## Implementation Notes

## High-level summary

Phase-1 name resolution emitted `name_not_in_scope` false-positives from two same-file binding gaps, each surfacing a real function as a spurious unreachable entry point. Both are now closed.

The first gap is the self-initializer. A `let x = … x(…)` binding (serde `struct_.rs:67`'s `let has_flatten = has_flatten(fields)`) registered its local over an inherited import, so the call inside the initializer resolved to a binding that is not yet live — Rust and JS bring the name into scope only after the initializer evaluates. Name resolution now keeps the shadowed binding for a self-initializer and lets every other shadow override, so ordinary lexical shadowing is unchanged. Detection rides on `VariableDefinition.initialized_from_call`. That signal was emitted only by the JS/TS indexers, so the Rust evidence case was unreachable from `name_resolution.ts` alone; the Rust capture handler now emits it too — for `let`, `let mut`, and `const`, including the turbofish form `x::<T>()` — bringing the three languages to parity. This is why C.1 spans the Rust indexer in addition to name resolution, correcting the parent epic's "all in `name_resolution.ts`" framing.

The second gap is sibling/hoist propagation. A `function`/`fn` declared inside a nested block carries that block as its defining scope, so a sibling scope that lexically reaches it (a JS arrow hoisting `function cleanup`; a Rust block item) missed the definition. `resolve_scope_recursive` now hoists function declarations out of descendant block scopes into the enclosing scope before recursing, stopping at nested function/class boundaries so each function opens its own hoisting domain.

To navigate: the front door is `resolve_scope_recursive` in `resolve_references/name_resolution.ts`, whose five steps read top to bottom (imports → locals with the self-initializer carve-out → hoist → store → recurse); `is_self_initializer` and `collect_hoisted_functions` are its helpers. The Rust signal is produced in `query_code_tree/symbol_factories/symbol_factories.rust.ts` (`extract_call_initializer_name`) and wired in by `capture_handlers/capture_handlers.rust.ts`.

Two deliberate edges. Resolution is scope-keyed, not position-keyed, so the self-initializer carve-out drops the local from the scope map for the whole scope — references after the initializer also resolve to the import. That is correct for the leaf-value self-initializers this targets; a self-initializer local later used as a method/dispatch receiver would need position-aware resolution, which is out of scope. The hoist over-approximates toward reachability — the safe direction for entry-point detection — but only layers in a function whose name has no competing binding, so on valid code (where a block item is never referenced from a scope that cannot reach it) no edge changes.

Coverage: Rust and JS integration tests for the self-initializer (positive, negative control, turbofish), the sibling-block hoist (single-level, multi-level, and the stop-at-function-boundary guard), plus a Rust indexer unit test for `initialized_from_call` (plain call, self-named call, turbofish, `const`, method-call and literal negatives).
