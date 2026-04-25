---
id: TASK-190.16.17
title: 'Signal gap: expose callers located in unindexed test directories'
status: Done
assignee: []
created_date: '2026-04-22 14:01'
labels:
  - self-repair-pipeline
  - signal-gap
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `unindexed-test-files` false-positive group in the webpack run cannot be classified with the existing signal library. Its single entry (`addModule` at /lib/Chunk.js:177) is a false positive because the only real caller — `chunk.addModule(module)` at /test/configCases/deprecations/chunk-and-module/webpack.config.js:21 — lives in the `/test/` directory, which Ariadne's file-coverage configuration excludes from indexing.

Caveat / missing-signal scope:
- The entry's `diagnostics.grep_call_sites` only contains hits from inside the indexed scope (two false matches in lib/Compilation.js that are `Compilation.addModule`, not `Chunk.addModule`). The real `/test/` caller never appears because the pre-gather grep is scoped to indexed folders.
- The entry's `diagnosis` is `callers-not-in-registry` with empty `ariadne_call_refs`. That combination already matches the broader `callers-outside-scope-strict-grep-evidence` classifier (precision 0.952), so the existing library cannot distinguish the test-directory-unindexed case from other out-of-scope-caller variants with entry-local signals alone.
- The closest existing entry, `unindexed-external-module` (F6), targets `resolution_failure_reason_eq: receiver_is_external_import`, which addresses third-party/npm imports. Its `description` explicitly notes that "When it is an internal but unindexed folder, it is a configuration fix," but it does not currently emit a signal for that internal case.

Requested signal (proposed name `has-callers-in-unindexed-test-dir`): extend the pre-gather pipeline to run a second grep pass against common test-directory patterns (`/test/`, `/tests/`, `/__tests__/`, `/spec/`) outside the indexed scope, and attach hits to the entry as a new diagnostic field `grep_call_sites_unindexed_tests` (or equivalent). A classifier could then match: `diagnosis == callers-not-in-registry` AND `ariadne_call_refs` empty AND `grep_call_sites_unindexed_tests` non-empty → `unindexed-test-files` with high precision.

Alternative (lower-effort) signal: a boolean `entry.is_in_indexed_source_only` plus a builtin-only aggregate check `has_unindexed_test_caller` that resolves by targeted filesystem grep when the builtin runs. Either form would close the gap.

Until this signal exists, the group is documented in the registry with `classifier.kind = none` so it does not misclassify entries but remains visible for human review.

## Implementation notes

- New diagnostic field `EntryPointDiagnostics.grep_call_sites_unindexed_tests` populated by a second pass in `detect_entrypoints.ts` that runs only when `include_tests` is false. Pass collects test files via `find_source_files` (gitignore-aware) and filters to common test-dir segments (`/test/`, `/tests/`, `/__tests__/`, `/spec/`).
- Pass builds an inverted identifier index over the test files for O(1) per-entry lookup. Constructors look up by class name through a position-keyed map (`${file_path}:${start_line}` → class name) since `EnrichedFunctionEntry` does not carry `symbol_id`.
- New `has_unindexed_test_caller` op wired through curator `SignalCheck`, classifier renderer, validator parser, pipeline `PredicateExpr`, registry validator, and predicate evaluator.
- Authoring of the `unindexed-test-files` registry classifier remains future work (parent epic TASK-190.16) — the signal is now expressible.

## Reviewer follow-ups (applied)

- Constructor handling: previously the second-pass grep used the constructor symbol's own name (`__init__` / `constructor`), which never matches a real call site. Now wired through a position-keyed `class_name_by_constructor_position` map so constructor entries grep by class name, mirroring the primary pass.
- `collect_unindexed_test_files` now reuses core's `find_source_files`, which honours `.gitignore` and `options.exclude` (passed through as ignore patterns) — previously the walker only filtered `IGNORED_DIRECTORIES`.
- New colocated integration test `scripts/detect_entrypoints.test.ts` covers the test-dir collection (recognised dir names, gitignore/exclude pruning, indexed-file dedup) and the attach pass (function caller hit, constructor-by-class-name, no-test-files no-op). The script's `main()` is now CLI-gated so the test file can import the helpers without triggering CLI exit.
<!-- SECTION:DESCRIPTION:END -->
