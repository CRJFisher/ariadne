---
id: TASK-190.16.20
title: >-
  Fix triage-curator finalize regressions: missing-field guard + cross-run
  orphan delete
status: Done
assignee: []
created_date: "2026-04-24 13:09"
labels:
  - self-repair-pipeline
  - triage-curator
  - bug
dependencies: []
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Problem

Two independent bugs in `triage-curator` finalize surfaced during the 2026-04-24 five-project sweep. Both corrupt state even on a sweep that passes `validate_responses.ts`.

### Bug 1 — Optional field read through `=== null` guard

`.claude/skills/triage-curator/src/apply_proposals.ts:244-252`:

```ts
const introspection_gap_tasks: IntrospectionGapTaskToCreate[] = [];
for (const r of inv) {
  if (r.introspection_gap === null) continue;
  introspection_gap_tasks.push({
    group_id: r.group_id,
    title: r.introspection_gap.title, // ← crashes when field is undefined
    description: r.introspection_gap.description,
    signals_needed: r.introspection_gap.signals_needed,
  });
}
```

When an investigator writes a response JSON without the `introspection_gap` key at all (undefined, not `null`), the strict-equality guard falls through and the dereference crashes with `TypeError: Cannot read properties of undefined (reading 'title')`. Observed on `~/.ariadne/triage-curator/runs/2026-04-16T18-10-16.855Z/investigate/{callback-registration,residual-fp}.json` — both written by earlier sweeps before the stricter schema.

Fix options:

- **(A)** Tighten the `InvestigateResponse` validator to require the field explicitly (accepting `null` for "no gap") and reject responses where it is absent. Matches the existing shape for `ariadne_bug` — validator already complains if that's missing.
- **(B)** Change the guard to `r.introspection_gap == null` or `!r.introspection_gap`. Tolerant of older artifacts.

Prefer **(A)**: the validator is the canonical gate and tolerance in `apply_proposals` masks investigator bugs. Same applies to the analogous `ariadne_bug` loop at line 254.

### Bug 2 — Orphan cleanup over-deletes across runs

`.claude/skills/triage-curator/scripts/finalize_run.ts:280-293`:

```ts
const accepted = new Set(result.authored_files);
const deleted_orphan_files: string[] = [];
if (!dry_run) {
  for (const orphan_path of Object.values(authored_files_raw)) {
    if (accepted.has(orphan_path)) continue;
    try {
      await fs.unlink(orphan_path);
      deleted_orphan_files.push(orphan_path);
    } catch (err) {
      if (error_code(err) === "ENOENT") continue;
      throw err;
    }
  }
}
```

The main curator agent (`SKILL.md` Step 4) renders classifier files for _all_ runs' investigate responses and builds a single `authored-files.json` map keyed on `target_group_id → file_path`. That same map is passed to every per-run `finalize_cmd` in Step 5.

Inside `apply_proposals`, `authored_files` contains only paths whose target is claimed by a response in the _current run_. So when run B finalizes, every path authored for runs A, C, D, E shows up in `authored_files_raw` but not in `accepted`, and the orphan loop unlinks them. The next run inherits an empty directory.

Observed as: 23 rendered `check_*.ts` files vanished after the first few finalize attempts ran.

Fix options:

- **(A)** Partition the authored-files map per-run in the main agent before calling `finalize_cmd`. Document in `SKILL.md` Step 5 and update the skill's driver logic. Preserves the current cleanup semantics.
- **(B)** Restrict the cleanup loop to paths whose `target_group_id` corresponds to a response in the current run's `investigate/` dir. The `authored_files_raw` map already has target → path; cross-reference with the current run's response group_ids to filter.

Prefer **(B)** — the skill's main-agent flow is brittle and Step-5 already has enough going on. Scoping the check inside the script keeps the contract narrow and makes the script correct regardless of how the caller constructs the map.

## Acceptance

Both fixes should be unit-tested against synthesised `InvestigateResponse` / per-run `investigate/` directories so this regresses if anyone re-introduces the same failure modes.

## References

- Preserved failing artifacts: `~/.ariadne/triage-curator/runs/2026-04-16T18-10-16.855Z/investigate/{callback-registration,residual-fp}.json`
- Sweep halt report: conversation `/triage-curator` run dated 2026-04-24
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 InvestigateResponse validator requires the introspection_gap field to be present (allowing null), with a parallel check on ariadne_bug
- [x] #2 apply_proposals iterates introspection_gap and ariadne_bug using explicit null checks that no longer throw on undefined
- [x] #3 Orphan cleanup in finalize_run only considers authored paths whose target corresponds to an investigate response present in the current run
- [x] #4 A unit test covers: (a) response missing the introspection_gap field — validator rejects; (b) multi-run authored-files map — each finalize deletes only its own unaccepted paths
- [ ] #5 Rerunning the 2026-04-24 sweep from the preserved investigate artifacts produces stable finalize output across all five runs (depends on TASK-190.16.19 for the kind:'builtin' fixes) — deferred to a future sweep run.
<!-- AC:END -->

## Implementation notes

- `parse_response_shape` in `validate_investigate_responses.ts` requires `"introspection_gap"` and `"ariadne_bug"` keys via `"key" in obj` checks (distinct from explicit-null and from undefined).
- New pure helper `compute_orphan_paths(authored_files_raw, this_run_responses, accepted_paths)` lives in `orphan_cleanup.ts`. It walks the authored-files map, narrows to targets owned by current-run responses (`retargets_to ?? group_id`), and excludes any accepted path. Reviewer confirmed PASS — multi-run preservation explicitly verified by the new test.
- `apply_proposals` uses `const gap = r.introspection_gap; if (gap == null) continue;` pattern (and same for `ariadne_bug`) so TypeScript narrows the dereference safely.
