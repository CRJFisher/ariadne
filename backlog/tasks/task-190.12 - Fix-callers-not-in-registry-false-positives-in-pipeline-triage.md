---
id: TASK-190.12
title: Fix callers-not-in-registry false positives in pipeline triage
status: To Do
assignee: []
created_date: '2026-03-28 14:38'
labels: []
dependencies: []
parent_task_id: TASK-190
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Description

Functions that grep evidence shows are called from outside Ariadne's indexed scope are reported as unreachable entry points. The pipeline triage sends these to LLM classification even though the diagnosis field already encodes the answer: `diagnosis === "callers-not-in-registry"` is set by `compute_diagnosis` in `extract_entry_points.ts` when `grep_hits.length > 0 && call_refs.length === 0`. The `deterministic-fp` route in `TriageRoute` exists for exactly this kind of predicate-classified false positive but is never assigned anywhere in the codebase.

## Reproduction

```
File: packages/core/src/some_module.ts
Function: internal_helper (line 42)
Expected: Not sent to LLM triage (grep confirms external callers exist)
Actual: Sent to LLM triage with diagnosis "callers-not-in-registry"
```

Any function where Ariadne's indexed scope does not include all caller files will trigger this pattern. The function has real callers that grep finds, but Ariadne has no call edge for them, so it appears unreachable.

## Root Cause

- **Pipeline stage**: pre-LLM classification (self-repair pipeline)
- **Module**: `.claude/skills/self-repair-pipeline/src/classify_entrypoints.ts`
- **Code path**: `PreClassificationResult` has only `known_true_positives` and `unclassified` buckets. There is no `deterministic_false_positives` bucket and no branch in `build_triage_entries` that writes `route: "deterministic-fp"`. Entries with `diagnosis === "callers-not-in-registry"` fall through to `unclassified` and are routed to LLM triage unnecessarily.

## Fix Approach

1. **`classify_entrypoints.ts`** — Add `deterministic_false_positives: Array<{ entry: EnrichedFunctionEntry; group_id: string }>` to `PreClassificationResult`. Add a rule: if `entry.diagnostics.diagnosis === "callers-not-in-registry"`, push to `deterministic_false_positives` with `group_id: "callers-not-in-registry"`. Update the module-level JSDoc to describe all three classification outcomes (known TPs, deterministic FPs, unclassified for LLM).

2. **`build_triage_entries.ts`** — Add a branch that maps `deterministic_false_positives` entries to `TriageEntry` with `route: "deterministic-fp"` and `deterministic_group_id: "callers-not-in-registry"`. This wires the existing `deterministic-fp` route that is currently orphaned.

3. **`classify_entrypoints.test.ts`** — Add two test cases using the existing `make_entry` helper: one verifying an entry with `diagnosis: "callers-not-in-registry"` lands in `deterministic_false_positives`, and one verifying entries with other diagnosis values remain in `unclassified`.

No changes to `extract_entry_points.ts` (grep data is already sufficient) and no changes to core `load_project` or `trace_call_graph` (deferred as a separate concern).

## Review Notes

- **info-architecture**: Wire through the existing `deterministic-fp` route in `TriageRoute`. Extend `PreClassificationResult` with a `deterministic_false_positives` bucket and update `build_triage_entries` to emit `route: "deterministic-fp"`. The `caller_folders` scope extension belongs in `TraceCallGraphOptions` not `LoadProjectOptions` — deferred to a future task.
- **simplicity**: Layer 2 (`caller_folders` in core) is deferred entirely per YAGNI. Use `entry.diagnostics.diagnosis === "callers-not-in-registry"` directly — it is already computed by `compute_diagnosis` upstream, making the classifier a single field read. Remove grep-scope expansion from scope; existing grep data is sufficient.
- **fundamentality**: Layer 1 is a pragmatic pipeline workaround (95.2% accuracy on training data). The root cause — Ariadne's indexed scope not including external caller files — is a separate concern deferred to a future task involving `TraceCallGraphOptions.context_folders`.
- **language-coverage**: Fix is fully language-agnostic. The `diagnosis` field and grep predicate work identically across all supported languages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An entry with diagnosis callers-not-in-registry is classified into deterministic_false_positives in classify_entrypoints.ts and routed with route: deterministic-fp in build_triage_entries.ts,The deterministic-fp route in TriageRoute is fully wired end-to-end and no longer orphaned,classify_entrypoints.test.ts has two new test cases: one confirming callers-not-in-registry maps to deterministic_false_positives and one confirming other diagnosis values remain unclassified,No changes to extract_entry_points.ts or core load_project / trace_call_graph,No regression in existing test suite
<!-- AC:END -->
