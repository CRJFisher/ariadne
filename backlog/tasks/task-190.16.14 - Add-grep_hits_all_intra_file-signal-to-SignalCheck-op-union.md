---
id: TASK-190.16.14
title: Add `grep_hits_all_intra_file` signal to SignalCheck op union
status: Done
assignee: []
created_date: '2026-04-22 14:00'
labels:
  - self-repair-pipeline
  - signal-gap
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The investigator cannot classify the residual group `intra-file-call-not-resolved` because the discriminating signal — `every grep_call_site.file_path === entry.file_path` — is not expressible in the closed `SignalCheck` op list at `.claude/skills/triage-curator/src/types.ts` (`SIGNAL_CHECK_OPS`).

Evidence (from `/Users/chuck/.ariadne/self-repair-pipeline/analysis_output/webpack/detect_entrypoints/2026-04-16T16-19-50.394Z.json`):

- `mimeScore` at `lib/util/mimeTypes.js:72` has `diagnosis = callers-not-in-registry`, empty `ariadne_call_refs`, and two grep hits at lines 98–99, both inside `mimeTypes.js` itself.
- `preferredType` at `lib/util/mimeTypes.js:97` is a `const` arrow function that calls `mimeScore`. `list_entrypoints` indexes both symbols but `show_call_graph_neighborhood` fails to look up either, confirming the intra-file call edge was never materialised.
- The same pattern repeats for `populate` at line 108 (grep hit at line 129, intra-file) and `preferredType` (grep hit at line 124, intra-file).
- `extension` and `lookup` in the same file also have `callers-not-in-registry` but their grep hits are cross-file (they are `module.exports`), so they legitimately belong to the broader `callers-outside-scope-strict-grep-evidence` pattern, not this one.

The existing closed op set offers `file_path_matches` (tests `entry.file_path`) and `grep_line_regex` / `has_capture_at_grep_hit` (tests hit content and captures), but nothing that correlates a grep hit's `file` field with the entry's `file_path`. Without this predicate there is no way to separate `intra-file-call-not-resolved` from the broader `callers-outside-scope-strict-grep-evidence` bucket.

Proposed signal:

- Op name: `grep_hits_all_intra_file` (no arguments) — matches when `grep_call_sites.length >= 1` and every hit's `file_path` equals the entry's `file_path`.

Implementation notes:

1. Add the op to the `SignalCheck` union and to `SIGNAL_CHECK_OPS` in `.claude/skills/triage-curator/src/types.ts`.
2. Extend the render template used by the main agent in triage-curator Step 4.5 to translate the op to a call-count check that iterates `entry.diagnostics.grep_call_sites`.
3. Extend `predicate_evaluator.ts` if the op should also be exposed to `kind: "predicate"` classifiers (recommended — the signal is entry-local).
4. Once merged, re-run the investigator on this group so a proper `kind: "builtin"` classifier can be emitted with checks `[{ diagnosis_eq: callers-not-in-registry }, { callers_count_at_most: 0 }, { grep_hits_all_intra_file: true }]`.

The root cause of the false positive itself — Ariadne's within-file resolver failing to link arrow functions (`const preferredType = (ext, ...) => ...`) to sibling `function`-declaration callees (`function mimeScore(...)`) inside a CommonJS module — is a separate resolver defect that should be tracked in its own task once the classifier is in place.

## Implementation notes

- `grep_hits_all_intra_file` wired through curator `SignalCheck`, classifier renderer, validator parser, pipeline `PredicateExpr`, registry validator, predicate evaluator, and the "unsupported features" doc renderer.
- Renderer and evaluator agree on the empty-grep edge case: `value:true` requires at least one hit, all in the entry's file.

## Reviewer follow-ups (applied)

- Predicate evaluator: explicit `value:false` and empty-grep-array tests added (covers the `0 === false` and `0 === true` truth-table corners).
- Renderer test: explicit `value:false` case so a future polarity-flip regression in the rendered string would be caught.
<!-- SECTION:DESCRIPTION:END -->
