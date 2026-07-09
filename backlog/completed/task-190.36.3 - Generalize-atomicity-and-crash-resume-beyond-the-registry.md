---
id: TASK-190.36.3
title: "Generalize atomicity and crash-resume beyond the registry"
status: Done
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

- [x] No bare `writeFileSync` against triage's shared state remains; the
      interleaving test proves two concurrent picks lose no verdicts.
- [x] A run with transient investigator failures re-picks up to the retry
      budget and cannot report `complete` while an un-terminalized `failed`
      entry exists.
- [x] Killing a prioritize session mid-fan-out and re-invoking the skill
      re-dispatches only the missing areas (verified by manifest inspection).
- [x] `group_runs.ts --sweep <id>` reuses the sweep dir and skips existing
      staged plans, pinned by a test.
- [x] Strategist dispatches return `wrote <area>`; the SKILL and agent body
      agree.
- [x] `json_plan_task_repository.ts` documents the single-writer sequencing
      assumption; no lock is added.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The atomic-write/lock/resume discipline the registry already carries now extends
to the pipeline's other shared mutable state, so a session death or overlapping
invocation no longer discards a paid investigation.

Triage's picker (`get_next_triage_entry.ts`) runs its whole read → merge → pick →
write cycle as one locked transaction (`absorb_and_pick`) through
`atomic_update_registry`, replacing the bare `writeFileSync`. Two overlapping
picks can no longer lose a state mutation to last-writer-wins. `failed` entries —
which always carry a malformed result file, since that parse failure is the only
path to `failed` — now retry: the picker re-dispatches a `failed` entry while
`retry_count < MAX_TRIAGE_RETRIES` (2), clearing the stale result file inside the
same locked transaction so `merge_results` cannot re-fail it before the retry
investigator writes, and the completion gate (`pool_is_drained`) stays open until
every failure terminalizes. A persistently-malformed file still halts finalize
loudly — the intended terminal signal.

The plan and prioritize skills gain crash-resume. `group_runs.ts --sweep <id>`
reuses an existing sweep dir and marks each fault area whose `StrategistPlan` is
already staged (`plan_exists`), and plan Pass B skips re-dispatching those
opus/200-turn strategists; "already staged" is gated on JSON-parseability so a
truncated non-atomic write does not mask a re-dispatch. Strategist dispatches now
return a `wrote <fault_area>` confirmation, so a pre-write crash is distinguishable
from success without waiting for Pass C's `missing_plan` rejection. Prioritize
documents an idempotent resume: skip-if-output-exists guards on steps 3/3a/7a plus
a `<root>/run.json` manifest, trusting only completed per-group artifacts
(`consolidation.json` is re-validated, coordinating with TASK-190.36.4). The
task-DB store (`json_plan_task_repository.ts`) documents the Pass-C/export
two-writer sequencing assumption and its benign-recovery property — both writers
agree on the terminal `exported` decision and a lost write is re-healed by the
next sweep's overlay — and adds no lock (YAGNI).

### What changed

- **Triage picker — atomic + locked + retry** (`get_next_triage_entry.ts`,
  `triage_state_types.ts`, `build_triage_entries.ts`). New exported
  `absorb_and_pick` wraps the transaction in `atomic_update_registry`;
  `pick_next_entries` also selects retryable `failed` entries;
  `pool_is_drained` generalizes the completion gate; new `retry_count` field
  (required, initialized to 0 at entry creation). Tests prove disjoint-verdict
  absorption under concurrency, the retry-race the lock actually protects,
  stale-file unlink + `retry_count` bump, and the gate staying open until
  terminalization.
- **Plan Pass B resume** (`group_runs.ts`, `plan/SKILL.md`). `--sweep <id>` via
  `resolve_sweep_id`; `existing_plan_areas` reports parseable staged plans;
  the summary carries `resumed` / `skipped_planned` / per-bucket `plan_exists`,
  and Pass B skips already-staged buckets and re-dispatches a strategist that
  returns without `wrote <area>`. Pinned by `group_runs.test.ts`.
- **Strategist return contract** (`plan/SKILL.md`, `plan-strategist.md`) — a
  ~15-char `wrote <fault_area>` confirmation, SKILL and agent body agreed.
- **Prioritize resume** (`prioritize/SKILL.md`) — a "Resuming a crashed run"
  section, per-step skip predicates on 3/3a/7a, and the `run.json` manifest.
- **Task-DB two-writer posture** (`json_plan_task_repository.ts`) — documented,
  no lock.

### Review outcome

A seven-lens review plus a fix-diff re-review ran over the implementation.
Applied fixes: wired plan Pass B to actually consume the new `plan_exists`
signal (the resume was otherwise inert at the operator surface); gated
`existing_plan_areas` on JSON-parseability rather than mere non-emptiness (a
non-atomic strategist write can truncate); made the concurrency test target the
retry read-modify-write the lock genuinely protects (the original test was
tautological against the lock); corrected several prose overclaims (the resume
root-discovery step, the "atomically renamed" characterization of sub-agent
writes, and the two-writer comment's "no divergent state" claim); and kept
`existing_plan_areas` fault-tolerant to unreadable/dir-shaped entries.

### Deferred (surfaced by review, out of scope)

- An investigator that crashes **without writing any result file** leaves its
  entry `pending` with no retry bound (retries key on the malformed-file
  `failed` path only). Pre-existing; bounding it needs a dispatch counter or a
  worker-pool attempt cap.
- Double-dispatch of the same `pending` entry is prevented only by the caller's
  shared `--active` set, not by persisted in-flight state; safe under the
  pipeline's sequential worker-pool usage. Pre-existing.
- A `--sweep` resume whose scanned run-set changed can leave stale bucket/plan
  files that Pass C still reads — belongs with TASK-190.36.4's validation gate.
- `retry_count` is a required field read via a bare cast with no schema bump; a
  run created before this change and resumed after would silently not retry old
  `failed` entries. Consistent with the ephemeral-state / no-back-compat policy;
  adding a `?? 0` normalization would be a forbidden compatibility shim.
