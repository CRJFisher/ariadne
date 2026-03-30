---
id: TASK-190.11
title: Fix deterministic classification for callers-not-in-registry false positives
status: To Do
assignee: []
created_date: "2026-03-28 14:39"
labels:
  - bug
  - self-repair-pipeline
  - auto-generated
dependencies: []
references:
  - .claude/skills/self-repair-pipeline/src/classify_entrypoints.ts
  - .claude/skills/self-repair-pipeline/src/build_triage_entries.ts
  - .claude/skills/self-repair-pipeline/src/triage_state_types.ts
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Description

Functions flagged as entry points when their callers exist in files outside the configured analysis scope. The `diagnosis` field already correctly identifies these as `"callers-not-in-registry"` but the classifier has no rule to act on this — entries fall through to LLM triage unnecessarily.

## Reproduction

```
File: timesfm_base.py
Function: forecast_on_df (line 429)
Expected: Not reported as entry point (called from predict/generate.py)
Actual: Reported as unreachable entry point
```

Also affects: for_profile, update_field_names (×2), date_util functions, preceding_sunday, proj_week_col_names_and_dates, and cross-package callers from amazon_ads/scripts/.

## Root Cause

- **Pipeline stage**: self-repair-pipeline (classify_entrypoints)
- **Module**: `.claude/skills/self-repair-pipeline/src/classify_entrypoints.ts`
- **Code path**: `PreClassificationResult` only has `known_true_positives` and `unclassified` buckets. The `deterministic-fp` route exists in `TriageRoute` but is never assigned. Entries with `diagnosis === "callers-not-in-registry"` (95.2% accuracy on training data) pass through to LLM triage instead of being deterministically classified.

## Fix Approach (incorporating reviewer feedback)

1. **`classify_entrypoints.ts`**: Add `deterministic_false_positives` bucket to `PreClassificationResult`. Add rule: if `entry.diagnostics.diagnosis === "callers-not-in-registry"`, classify as deterministic false-positive with `group_id: "callers-not-in-registry"`. Use existing `diagnosis` field — do NOT re-evaluate raw arrays.

2. **`build_triage_entries.ts`**: Wire the new bucket through to emit `route: "deterministic-fp"` with `deterministic_group_id` populated.

3. **`classify_entrypoints.ts` module comment**: Update JSDoc to reflect three-way classification (known TPs + deterministic FPs + unclassified).

4. **`classify_entrypoints.test.ts`**: Add test case using existing `make_entry` helper.

## Review Notes

- **info-architecture**: Wire through existing `deterministic-fp` route. `PreClassificationResult` needs third bucket. Module comment update needed.
- **simplicity**: ~5-line change. Use existing `diagnosis` field. No grep-scope expansion needed. Layer 2 (caller_folders) deferred as YAGNI.
- **fundamentality**: Pipeline rule is pragmatic; core fix (caller_folders in TraceCallGraphOptions) deferred to separate task.
- **language-coverage**: Language-agnostic — works for all supported languages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Entries with diagnosis callers-not-in-registry are classified as deterministic-fp without LLM triage
- [ ] #2 deterministic-fp route in TriageRoute is wired through PreClassificationResult and build_triage_entries
- [ ] #3 Test case added to classify_entrypoints.test.ts
- [ ] #4 No regression in existing test suite
<!-- AC:END -->
