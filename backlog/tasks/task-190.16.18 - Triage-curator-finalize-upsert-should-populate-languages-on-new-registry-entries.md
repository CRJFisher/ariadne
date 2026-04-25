---
id: TASK-190.16.18
title: >-
  Triage-curator finalize upsert should populate `languages` on new registry
  entries
status: Done
assignee: []
created_date: '2026-04-22 14:42'
labels:
  - self-repair-pipeline
  - triage-curator
  - bug
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When `curate_run --phase finalize` upserts new registry entries for groups it has not seen before, the entries are written with `languages: []`. The `known_issues_registry` validator rejects entries with empty `languages`, so the post-commit hook (`pnpm test`) fails with `[N](group_id="X").languages: must not be empty`.

Observed during the webpack sweep at 2026-04-16T18-10-16.855Z — 8 new `wip`-status entries were written with empty `languages` for: context-object-destructuring, dynamic-dispatch, intra-file-call-not-resolved, property-accessor-not-tracked, require-indirection, static-method-call-resolution, unindexed-test-files, wasm-cross-language-call. The sweep worked around this by hand-patching `languages` before re-staging.

The finalize upsert has three sources of truth it could use to populate `languages`:

1. For `kind: "builtin"` proposals: the classifier_spec `language_eq` check values — e.g. `static-method-call-resolution` declares `language_eq: javascript`; `wasm-cross-language-call` declares `language_eq: typescript`.
2. For `kind: "predicate"` proposals: the predicate's language clause.
3. For `kind: "none"` proposals: the languages observed across the triage run's members (`{ language }` per entry in the group's member list).

Acceptance criteria:
- `apply_proposals` / finalize upsert sets `languages` to a non-empty array on every newly-inserted entry.
- Prefer declared classifier languages when present; fall back to observed member languages.
- Existing entries are not downgraded — only new upserts are touched.
- Add a unit test covering (a) builtin proposal with `language_eq`, (b) predicate proposal with language gate, (c) `kind: "none"` proposal with member-observed languages.

## Implementation notes

- `derive_languages_for_upsert` prefers the classifier spec's `language_eq` checks (authoritative) and falls back to file-extension inspection on the source group's members. When neither yields anything, the upsert is recorded as `failed_authoring` rather than written with `languages: []`.
- Existing entries' `languages` are preserved verbatim — only newly minted entries are populated.
- The `predicate proposal with language gate` AC item is non-applicable in practice: curator-side proposals carry `BuiltinClassifierSpec` only, and predicate proposals flow through the same `language_eq` extraction path.

## Reviewer follow-ups (applied)

- `derive_languages_for_upsert` now returns the closed `KnownIssueLanguage[]` type (mirrored from self-repair-pipeline) instead of `string[]`, with a guard on the spec-side `language_eq` value.
- Returned languages are sorted for deterministic on-disk diffs. The test that previously called `.sort()` to compensate is now an exact-equality assertion, plus a new "deterministic sorted order" test locks the contract.
<!-- SECTION:DESCRIPTION:END -->
