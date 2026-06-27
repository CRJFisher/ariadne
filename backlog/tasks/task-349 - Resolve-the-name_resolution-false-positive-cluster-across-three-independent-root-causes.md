---
id: TASK-349
title: "Resolve the name_resolution false-positive cluster across three independent root causes"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - name_resolution
dependencies: []
priority: high
plan_dedup_keys:
  - aadecf5dbd628fc82ae827677df9c82d713f2af9cd40d453c6adbedd6f48b617
plan_source_tasks:
  - pt-448af9fb80c21abf
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Every false-positive in this group is a `function_call`/`constructor_call` whose `resolution_failure` is `{stage: "name_resolution", reason: "name_not_in_scope"}`. That single failure code is emitted from **three structurally unrelated upstream defects living in three different files** — the plan engine's "one Phase-1 scope-walk binding gap" framing is wrong on both altitude and count. Only one of the three fixes is in `name_resolution.ts`.

This epic is the fundamental refactor; it coordinates the three coherent changes carried by its sub-tasks and owns the cross-cutting decisions and risks. The three root causes are:

- **Root cause A (largest, Rust-heavy, 56 members):** Rust qualified call references carry the _full scoped path text_ as `name` (`worker::create`, `crate::runtime::Driver`, `Cell::<u8>`, `Self`), so Phase-1 — which only ever holds bare terminal names — can never match. Implementation revealed Change A is itself **three** independent root causes, split into sub-tasks: **349.1** (producer — emit terminal `name` + `path_prefix` — and function-call resolution: bind module- and type-qualified function calls via the prefix; landed), **349.4** (link Rust `new()` as the struct's constructor + `Self` substitution), **349.5** (consume `path_prefix` to resolve inline-full-path module/type-qualified constructors cross-file, reusing 349.1's resolver).
- **Root cause B (Python imports, 43-member leaf):** `is_exported=false` for single-underscore Python names excludes them from the export registry, and Phase-1's `resolve_export_chain` gates on `is_exported`, so an explicit `from .x import _y` never binds. Fixed in Phase-1 name resolution: when the export chain yields nothing for a `named` import, bind to the source file's module-level definition regardless of `is_exported` — `is_exported` then governs only the implicit public surface (sub-task 349.2; landed).
- **Root cause C (same-file binding gaps, 4 members):** a local-`let` self-initializer shadows an explicit import in the same statement, and sibling-inner-scope / hoisted functions are absent from the calling scope's scope map. Fixed by two Phase-1 corrections in `name_resolution.ts` (sub-task 349.3); the self-initializer fix also brings the Rust indexer to JS/TS parity by emitting `initialized_from_call`, so C is not confined to `name_resolution.ts` — another instance of the plan engine's altitude/count framing being wrong.

## Scope decisions owned here

- **TypeScript barrel-namespace rows** (destructured from `./_namespaces/ts`) in the 43-member leaf are **excluded** — they are re-export-chain indirection that belongs to `import_resolution`, not `name_resolution`. Route them to `packages/core/src/resolve_references/import_resolution` as a separate group; name them here so they are not lost.
- **Interim-classifier leaf is retired.** No rule is authored and no registry row is created: two of the three core fixes are tiny and one is not even in this folder, so a classifier would be retired immediately on landing. Authoring it is surplus work (YAGNI). This row folds into this epic with no work of its own.

## Cross-cutting risks to track

- **Examples/tests indexing precondition** — most `sqlx` rows live under `examples/…` and many `tokio` rows under `tests/…`. If the live pipeline excludes those directories from indexing, those rows are `coverage_config`, not `name_resolution`, and the Change A fix would not flip them. Confirm the corpus' indexed-file set before counting them as resolved.
- **`cfg`-gated duplicate definitions** (`Mutex::new` resolving to mocked vs std under `cfg(all(test, loom))`) — Ariadne does not evaluate `cfg`; these may resolve to the wrong arm. Out of scope for binding correctness; flag as a known limitation.
- **Angular TS static dispatch** (`LanguageServiceTestEnv.setup()`) — confirm whether TS class static-member calls reach the same terminal-name path (fold into 1.1) or belong to `method_lookup` (exclude). Decide before closing 1.1.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The three root-cause changes land in the sequenced order: A first, then B (349.2), then C (349.3). Change A is itself sequenced **349.1 → 349.4 → 349.5** (producer + function-call resolution; then constructor linking + `Self`; then inline-full-path constructors), because investigation showed A spans three coherent changes and the producer name-reduction is only correct together with the function-call path-prefix resolver (349.1).
- [ ] #2 No interim classifier rule is authored and no registry row is created for this group.
- [ ] #3 The TypeScript barrel-namespace rows are routed to a separate `import_resolution` group and are not silently dropped.
- [ ] #4 Before counting `examples/`-resident sqlx and `tests/`-resident tokio rows as resolved, the corpus' indexed-file set is confirmed to include those caller files.
- [ ] #5 The Angular TS static-dispatch row is explicitly classified — **excluded to method_lookup**: it is captured as a `MethodCallReference` and shares no mechanism with the terminal-name path (decided in 349.1).

<!-- AC:END -->
