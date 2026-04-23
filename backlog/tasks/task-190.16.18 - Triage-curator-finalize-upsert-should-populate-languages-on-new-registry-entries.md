---
id: TASK-190.16.18
title: >-
  Triage-curator finalize upsert should populate `languages` on new registry
  entries
status: To Do
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
<!-- SECTION:DESCRIPTION:END -->
