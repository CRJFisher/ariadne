---
id: TASK-349.2
title: "Make is_exported govern implicit visibility only — let explicit named imports bind regardless"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-349
priority: high
ordinal: 2000
plan_dedup_keys:
  - 353297f2e4746b78d2f28b25eaf9000871464ddfc2cb520d15954a32559b8426
plan_source_tasks:
  - pt-57521973c069ab2e
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Phase-1 binds a named import by calling `resolve_export_chain(source_file, import_name, …)` (`name_resolution.ts:166`). The `ExportRegistry` only registers definitions whose `is_exported === true` (`registries/export.ts:89`). Python's indexer sets `is_exported=false` for single-underscore module-level names (verified at `capture_handlers.python.test.ts:1388-1406`). Therefore `from .x import _y` — a fully explicit, valid import — produces an import whose `resolve_export_chain` returns `null`, so no binding enters the scope map. Nearly every Python row in this leaf is underscore-prefixed (`_make_block`, `_ensure_sync_result`, `_parse_mapper_argument`, `_custom_op_with_schema`, …), so this one data-completeness defect accounts for the entire Python population.

This is one widened lookup, not N independent import fixes.

## Producer edit

- **`resolve_references/registries/export.ts`** — add an explicit-named-import resolution path that falls back to a by-name `DefinitionRegistry` lookup in the source file when the `is_exported`-gated export set has no entry. The defining symbol already exists in the `DefinitionRegistry` keyed by `(file, name)`; the export registry simply refuses to surface it. **Keep the `is_exported` filter for the wildcard / namespace / re-export paths** — `is_exported=false` correctly models "not part of the public surface"; it must only stop gating *explicit* imports.
- **`name_resolution.ts:166`** (`resolve_export_chain` caller) picks up the change automatically once the export lookup is widened.

## Scope boundary

- The TypeScript rows in this leaf (destructured from `./_namespaces/ts` barrel namespace) are **excluded** — they fail for an unrelated reason (re-export-chain indirection) that belongs to `import_resolution`, not this change.
- The sqlx/tokio Rust `use crate::x::y` single-hop named-import rows resolve via the same export-chain path: confirm against the widened lookup and the submodule fallback (`name_resolution.ts:177`). They are likely resolved once the export lookup is symmetric; only if not does a small Rust-import adapter become necessary.

<!-- SECTION:DESCRIPTION:END -->

## Test Plan

Add one integration test per evidence case from the change map. Cross-file binding cases use a multi-file fixture exercised through `Project` + `update_file`; the `is_exported`-contract case is a single-construct `build_index_single_file` assertion. Every test asserts the exact resolution (the callee resolves to the named definition, or the private name is absent from the consumer scope) — no existence-only checks; assert with `toEqual` against typed literals.

### Fixtures

- **`tests/fixtures/python/code/modules/underscore_named_imports/`** — multi-file Python package mirroring the corpus rows:
  - `_lib.py` — module-level defs drawn from the evidence (`_make_block`, `_ensure_sync_result`, `_parse_mapper_argument`) plus one public control name (`make_block`).
  - `app.py` — `from ._lib import _make_block, _ensure_sync_result, make_block` and a call to each.
  - `wildcard_app.py` — `from ._lib import *` then a reference to `_make_block` (must stay unbound).
  - `namespace_app.py` — `import _lib as ns; ns._make_block(...)` (must stay unbound).
  - `__init__.py` — re-exports a public name from `_lib`; a `reexport_app.py` imports the private name through the package (must stay unbound).
- **`tests/fixtures/rust/code/modules/use_named_import/`** — `crate::x::y` single-hop named import in the sqlx/tokio shape: a `lib.rs` module tree and a caller doing `use crate::x::y; y(...)`.

### Cases

| # | Evidence case | Test location | Fixture / input | Assertion |
| - | ------------- | ------------- | --------------- | --------- |
| B1 | Explicit underscore named import binds (`from ._lib import _make_block`) | `resolve_references/resolve_references.python.test.ts` | `underscore_named_imports/` (`app.py`) | each `_…` callee resolves to its `_lib.py` definition; none appears as an entry point |
| B2 | `is_exported` stays `false` for underscore module-level names | `query_code_tree/.../capture_handlers.python.test.ts` (existing file) | inline `build_index_single_file` | `is_exported === false` for `_private`, `true` for `public` |
| B3 | Public-name Python control still resolves (regression guard) | `resolve_references.python.test.ts` | `underscore_named_imports/` (`make_block`) | `make_block` callee resolves; behavior unchanged |
| B4 | TS named-import control still resolves (regression guard) | `resolve_references.typescript.test.ts` (existing controls) | inline `Project` + `update_file` | exported `import { foo }` resolves; behavior unchanged |
| B5 | Gate kept — wildcard `from ._lib import *` does not surface `_make_block` | `resolve_references.python.test.ts` | `underscore_named_imports/wildcard_app.py` | `_make_block` is **not** bound in the consumer scope |
| B6 | Gate kept — namespace `ns._make_block` does not surface the private name | `resolve_references.python.test.ts` | `underscore_named_imports/namespace_app.py` | `_make_block` member access is **not** resolved |
| B7 | Gate kept — re-export chain does not surface the private name | `resolve_references.python.test.ts` | `underscore_named_imports/reexport_app.py` | private name is **not** on the package's public surface |
| B8 | Rust `use crate::x::y` single-hop named import resolves via the widened lookup | `resolve_references.rust.test.ts` | `use_named_import/` | the `y(...)` call resolves to the imported definition |
| B9 | Existing `is_exported` cases stay green | `capture_handlers.python.test.ts:1388–1448` (existing) | existing | unchanged |

**Out of scope — explicitly not tested here:** the TypeScript barrel-namespace rows (`./_namespaces/ts`) belong to the `import_resolution` group (re-export-chain indirection), per the parent epic's scope decision. Do not add a fixture for them under this task.

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 (B1) Integration test on the `underscore_named_imports/` fixture: `from ._lib import _make_block, _ensure_sync_result, _parse_mapper_argument` resolves each call to its underscore-private definition, and none of those names appears as an entry point.
- [x] #2 (B2) A `build_index_single_file` assertion confirms `is_exported` stays `false` for underscore module-level names and `true` for public names — the public-surface contract is unchanged; only explicit-import resolution widens.
- [x] #3 (B3, B4) The public-name Python control (`make_block`) and the TS named-import control stay green.
- [x] #4 (B5, B6, B7) The `is_exported` filter still applies to wildcard (`from ._lib import *`), namespace (`ns._make_block`), and re-export-chain paths: the private name stays unbound in each consumer.
- [x] #5 (B8) The Rust `use crate::x::y` single-hop named import resolves via the widened lookup on the `use_named_import/` fixture.
- [x] #6 (B9) `capture_handlers.python.test.ts` `is_exported` cases (1388-1448) stay green.
- [x] #7 The TypeScript barrel-namespace (`./_namespaces/ts`) rows are not tested here — they are routed to the `import_resolution` group (parent epic scope decision).

<!-- AC:END -->

## Implementation Notes

## High-level summary

Python single-underscore module-level names (`_make_block`, `_ensure_sync_result`, …) are indexed with `is_exported=false`. The `ExportRegistry` registers only `is_exported=true` definitions, so an explicit `from ._lib import _make_block` — a fully valid import — resolved through `resolve_export_chain` to nothing, leaving the call unbound and surfacing its callee as a false-positive entry point. Because nearly every Python row in this leaf is underscore-prefixed, this single data-completeness gap accounted for the entire Python population.

`is_exported` is reinterpreted to govern only *implicit* visibility — the public surface consumed by the wildcard, namespace, and re-export paths. An explicit named import names its target directly, so it binds to any module-level definition in the source file regardless of `is_exported`. The widening lives as a fallback in `name_resolution.ts` rather than inside `resolve_export_chain`: `resolve_scope_recursive` already owns a cascade of import-binding fallbacks (the pre-existing submodule fallback), and `resolve_export_chain` is deliberately self-contained over `ExportRegistry` data with no access to the scope and definition registries the fallback needs. Placing it in name resolution keeps that boundary intact and sits the new fallback beside the one it parallels.

When `resolve_export_chain` yields nothing for a `named` import, name resolution looks the import's name up in the source file's module (root) scope via `get_file_root_scope` → `get_scope_definitions`. The lookup is restricted to the module scope, so it can never bind a nested-scope definition, and to `named` imports, so default, namespace, and wildcard imports stay gated. Because `by_scope` excludes import definitions, a name merely re-exported (not defined) by an intermediate `__init__.py` is never surfaced — package indirection cannot leak a private name.

To navigate the result: the fix is the `named`-import fallback in `resolve_references/name_resolution.ts`, inside `resolve_scope_recursive`, immediately after the `resolve_export_chain` call and before the submodule fallback. Behaviour is pinned by the `underscore-private explicit named imports` suite in `resolve_references.python.test.ts`, the Rust `crate-path single-hop` case in `resolve_references.rust.test.ts`, the TS regression control in `resolve_references.typescript.test.ts`, and the `is_exported` contract case in `capture_handlers.python.test.ts`.

## What changed

- **`resolve_references/name_resolution.ts`** — a single fallback added to the named/default import branch of `resolve_scope_recursive`. When `resolve_export_chain` returns null and `imp_def.import_kind === "named"`, it binds to `get_scope_definitions(get_file_root_scope(source_file).id).get(import_name)`. No new registry methods or imports were required — `get_file_root_scope` (ScopeRegistry) and `get_scope_definitions` (DefinitionRegistry) already exist and are already on the injected `NameResolutionContext`. The fix is generic across languages by design.
- The implementation **deviates from the task's "Producer edit" section**, which proposed widening `registries/export.ts`. That would force `ExportRegistry` to depend on the scope and definition registries, breaking the self-containment its `resolve_export_chain` documents, and would also leak the widening onto the recursive re-export hops `resolve_export_chain` serves. Siting the fallback in name resolution — beside the existing submodule fallback — keeps `resolve_export_chain` strictly gated and matches the established fallback-cascade IA. The acceptance criteria are behavioural, so the relocation satisfies them in full.

## Verification

- AC#1/#3/#4 — `resolve_references.python.test.ts › underscore-private explicit named imports`: underscore imports bind and resolve their calls to the `_lib.py` definitions and drop out of the entry-point set (B1); the public `make_block` control still resolves (B3); wildcard / namespace / re-export keep the private name unbound (B5/B6/B7).
- AC#2/#6 — `capture_handlers.python.test.ts`: a new case asserts `is_exported` stays `false` for `_make_block` and `true` for `make_block`; the existing `is_exported` cases are untouched and green.
- AC#3 (TS) — `resolve_references.typescript.test.ts › TypeScript Named Import Regression Control`: an exported `import { foo }` still resolves and its callee is not an entry point.
- AC#5 — `resolve_references.rust.test.ts › crate-path single-hop named import of a non-pub item`: `use crate::helpers::format_value` of a non-`pub` item resolves via the widened lookup, confirming no Rust-specific adapter is needed.
- AC#7 — no TypeScript barrel-namespace fixture was added; those rows remain routed to `import_resolution`.
- Review-driven additions: tests for an aliased underscore import (`_make_block as mb`, exercising the `original_name || name` lookup vs the alias bind-key), the module-scope-only invariant (a nested same-named def must not bind), and the fallback's null path (an import of a name absent from the source module stays unbound).
- The full multi-package suite runs green under the pre-commit hook; the lone `tsc` `import.meta` error in `permanent_data.sync.test.ts` is pre-existing on the base branch and unrelated.

## Scope and follow-ups

- **The widening is language-agnostic by design.** Binding an explicit named import to a non-exported module-level symbol is a strict call-graph improvement and never diverts a correctly-exported target, because the export-chain path returns before the fallback runs. A non-exported TS/JS named import (a compile error in real code) therefore also binds; this is intended, not a regression.
- **Known boundary:** Rust inline-`mod` private items resolve only at file-root level. A non-`pub` item nested inside an inline `mod x { … }` block carries the module body's scope id, not the file root, so the module-scope lookup does not reach it. This is the documented module-scope-only limit, not a misbind.
- **Noted, not actioned:** for a *reassigned* non-exported module-level Python variable, the fallback binds by `by_scope` last-write rather than replicating the export path's highest-line selection (`should_replace_python_variable`). The case is vanishingly rare and either same-named def is a valid call-graph target; replicating the ordering logic in the fallback would be surplus.
