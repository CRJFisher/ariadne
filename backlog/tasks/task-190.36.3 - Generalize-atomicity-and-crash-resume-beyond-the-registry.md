---
id: TASK-190.36.3
title: "Generalize atomicity and crash-resume beyond the registry"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - self-repair
  - self-healing
  - pipeline-hardening
parent_task_id: TASK-190.36
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The atomic-write/lock/resume discipline that `classifier-lifecycle.md`
mandates for `registry.json` was never generalized to the pipeline's other
shared mutable state. The two failure modes are direct efficacy losses: a
lost triage verdict throws away a paid investigation, and a session death
mid-fan-out re-spends every finished opus/200-turn investigation.

### Work

1. **Make triage state writes atomic and locked.** `triage.json` is a bare
   `fs.writeFileSync` (`get_next_triage_entry.ts:144`) over a full
   read (`:121`) → `merge_results` → write cycle; two overlapping invocations
   lose absorbed verdicts last-writer-wins, guarded only by
   `triage/SKILL.md:219` prose. Replace with
   `atomic_update_registry(state_path, mutator)` from `@ariadnejs/skill-fs` —
   the helper is generic `(path, mutator)` and triage already depends on the
   package (`triage/package.json:16`). Add an interleaving test: two
   concurrent picks over the same state with disjoint result files, assert
   both verdict sets absorbed and the lock released.
2. **Give `failed` entries a retry path.** The completion gate counts only
   `pending` (`get_next_triage_entry.ts:136-141`) and the picker never
   re-picks `failed` (`:99-105`) — a run with failures flips
   `phase="complete"` prematurely, then finalize throws loudly at load
   (`verdict_ledger.ts:75-77`). Add `retry_count` to the entry state; re-pick
   `failed` while `retry_count < N`, keep the completion gate open until each
   failure terminalizes, and leave the loud finalize throw as the terminal
   signal.
3. **Prioritize resume.** No step checks for existing outputs before
   dispatch, and `refactor-investigator.md:96` overwrites unconditionally.
   Add a skip-if-output-exists rule for steps 3/3a/7a ("if
   `<root>/<area>/refactor_plan.md` / `task_assignment.json` exists and is
   non-empty, skip dispatch") plus a `<root>/run.json` manifest recording
   dispatched/completed waves so resume is a lookup, not a filesystem scan.
   Coordination with TASK-190.36.4: the skip predicate must trust only
   _validated_ artifacts — a resumed run re-runs `validate_consolidation`
   rather than blindly accepting a stale partial `consolidation.json`.
4. **Plan Pass B resume.** `group_runs.ts` mints a fresh `sweep_id`
   unconditionally. Add `--sweep <id>` to reuse an existing sweep dir and
   skip buckets whose staged plan already exists (waste-only failure today —
   the finalize guard prevents corruption — but a re-run re-spends the
   strategist fan-out).
5. **Strategist write confirmation.** "Return nothing inline"
   (`plan/SKILL.md:103`, `plan-strategist.md:247`) makes a pre-write crash
   indistinguishable from success until Pass C's `missing_plan` rejection.
   Change the return contract to a ~15-char `wrote <area>` confirmation.
6. **Task-DB two-writer posture: document, don't lock (YAGNI).** Plan Pass C
   and prioritize export both `put()` the same
   `~/.ariadne/plan/tasks/<id>.json` files, but the skills are
   human-sequenced, the window requires deliberate concurrent invocation, and
   recovery is benign (the next sweep's overlay re-marks `exported`). Harden
   the header comment in `json_plan_task_repository.ts:21-26` to state the
   sequencing assumption and the benign-recovery property; add no lock.

Suggested order: 1 → 3 → 2 → 5 → 4 → 6 (verdict integrity first, then the
most expensive re-spend protection).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] No bare `writeFileSync` against triage's shared state remains; the
      interleaving test proves two concurrent picks lose no verdicts.
- [ ] A run with transient investigator failures re-picks up to the retry
      budget and cannot report `complete` while an un-terminalized `failed`
      entry exists.
- [ ] Killing a prioritize session mid-fan-out and re-invoking the skill
      re-dispatches only the missing areas (verified by manifest inspection).
- [ ] `group_runs.ts --sweep <id>` reuses the sweep dir and skips existing
      staged plans, pinned by a test.
- [ ] Strategist dispatches return `wrote <area>`; the SKILL and agent body
      agree.
- [ ] `json_plan_task_repository.ts` documents the single-writer sequencing
      assumption; no lock is added.

<!-- AC:END -->
