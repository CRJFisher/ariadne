---
id: TASK-210
title: 'Signal gap: expose callers located in unindexed test directories'
status: To Do
assignee: []
created_date: '2026-04-22 14:01'
labels:
  - self-repair-pipeline
  - signal-gap
dependencies: []
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
<!-- SECTION:DESCRIPTION:END -->
