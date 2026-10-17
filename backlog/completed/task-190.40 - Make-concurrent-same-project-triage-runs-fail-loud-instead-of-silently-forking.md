---
id: TASK-190.40
title: Make concurrent same-project triage runs fail loud instead of silently forking
status: Done
assignee: []
created_date: "2026-07-28 16:00"
labels:
  - self-repair
  - triage
  - concurrency
  - dx
dependencies: []
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Two `/triage tokio-rs/tokio` invocations ran concurrently against the same
project and the same commit — one driven by hand, one from a session picking up
`TASK-190.15.17`, whose literal instruction is `/triage tokio-rs/tokio`. The
second invocation's `prepare_triage` silently repointed the project's `LATEST`
pointer at its own fresh run. The first orchestrator, mid-Phase-3, kept calling
`get_next_triage_entry` with no `--run-id` and was handed entries it had already
completed 19 batches earlier.

Nothing in any tool output named the run being read, so the swap was detectable
only by noticing that dispensed indices repeated. The run dirs themselves are
properly isolated — each owns its `triage.json` and `results/` — so the contended
state is exactly one thing: the single-slot `LATEST` pointer, which
`prepare_triage` writes, and `finalize_triage`/`abandon_run` clear.

The damage is worse than duplicated work. The TP cache reads only _finalized_
runs at the commit (`all_finalized_runs_at_commit`), so a run that is orphaned
mid-flight contributes nothing — its completed investigations are stranded on
disk unless it is explicitly resumed and finalized. A silent fork therefore
converts finished work into waste with no signal.

`SKILL.md` already states the isolation boundary: "different projects can run in
parallel against the same `triage_state/` dir — the project name is the isolation
boundary." Same-project concurrency is out of contract; it just is not enforced.

Each gap is stated symptom → cause → direction.

### 1. `prepare_triage` clobbers an active run's LATEST pointer

**Symptom.** A second `prepare_triage` for a project with a live, unfinalized run
creates its run and takes over `LATEST` without a word, orphaning the first.

**Cause.** `prepare_triage.ts` stamps `status: "active"` and calls
`write_latest_run_id(project_name, run_id)` unconditionally. It never enumerates
existing runs, so an already-active run is invisible to it.

**Direction.** Before writing the manifest, enumerate with `list_runs(project)`
and refuse when any manifest is `status: "active"`. The error names the offending
run and both existing remedies — `--run-id <id>` to continue it, or
`abandon_run.ts` to discard it. No new force flag: `abandon_run.ts` is already
the sanctioned escape hatch, and two genuinely parallel runs are expressed as two
project names.

### 2. The dispense output does not name the run it read

**Symptom.** `get_next_triage_entry` prints `{"entries":[390,391,...]}`. When the
underlying run changes between calls, the output is indistinguishable from a
normal dispense.

**Cause.** The resolved `run_id` is computed by `require_run` and then discarded
rather than echoed.

**Direction.** Emit `{"run_id": "...", "entries": [...]}`. A swap then shows up in
the very next tool result instead of depending on someone recognising repeated
indices by eye.

### 3. `--run-id` exists end to end but is threaded nowhere

**Symptom.** Every pipeline invocation rides the implicit `LATEST` default, so any
concurrent `prepare_triage` can steal the run out from under an in-flight loop.

**Cause.** `require_run(project, run_id_opt)` falls back to `read_latest_run_id`
when `run_id_opt` is null. Both `get_next_triage_entry.ts` and
`get_entry_context.ts` accept `--run-id` via `parse_run_id_arg`, but `SKILL.md`
Phase 3 and `.claude/agents/triage-investigator.md` both document the call
_without_ it.

**Direction.** Thread the `run_id` that Phase 2 already prints through the whole
loop: `SKILL.md` passes it on every dispense and includes it in the investigator
prompt, and `triage-investigator.md` documents it on the `get_entry_context`
call.

**This must land as one unit.** Pinning only the orchestrator is strictly worse
than today: `get_entry_context.ts` derives the verdict path from the run _it_
resolves (`results_dir_for(cli.project, run_id)`), so an unpinned investigator
would read context from, and write its verdict into, the `LATEST` run while the
orchestrator tracks the pinned one. The orchestrator's entry would never leave
`pending` — an endless redispense loop — while the other run accumulated verdicts
nobody dispensed. Entry indices are not stable across runs, so the verdict would
also describe the wrong symbol.

### 4. (Non-goal) the shared clone is already serialised

`detect_entrypoints.ts` guards `repos/<owner>--<repo>` with `with_clone_lock`, an
atomic-mkdir lock explicitly built for parallel pipelines, and reuses an existing
clone rather than re-checking it out. Concurrent detection against one repo is
already safe. Recorded so this is not "fixed" a second time.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 prepare_triage refuses to create a second run while another run for the same project is status:active, naming the run and both remedies (--run-id to continue, abandon_run.ts to discard).
- [x] #2 get_next_triage_entry emits the resolved run_id alongside entries, so a LATEST swap is visible in the dispense output itself.
- [x] #3 SKILL.md Phase 3 threads --run-id through every dispense call and into the investigator prompt.
- [x] #4 triage-investigator.md documents --run-id on the get_entry_context invocation, so orchestrator and investigator can never resolve different runs.
<!-- AC:END -->

## Implementation Notes

### High-level summary

A project runs one triage at a time, and the pipeline names the run it is
working on at every step. `prepare_triage` enumerates the project's runs and
refuses while any manifest reads `status: "active"`, printing each live run,
the commit it was prepared at, and a runnable command for each remedy.
`get_next_triage_entry` returns the run it dispensed from alongside the
indices, so a run that changes underneath a loop shows up in the next tool
result rather than as entry numbers that quietly repeat. `SKILL.md` and
`triage-investigator.md` carry the run-id Phase 2 prints through every
dispense, every investigator, and finalize, so orchestrator and investigator
resolve the same run by construction.

The refusal is a fail-loud check, not a lock. It reads the run set twice —
once before the re-index so the refusal lands in seconds, and once immediately
before the run is claimed — which leaves a window measured in the gap between
that second read and the manifest write. Two launches started in the same
instant can still both pass; the dispense output's run-id is what catches that
residual case. Mutual exclusion would mean holding a lock across a multi-minute
re-index, which is a different design than this task calls for.

### What changed

- **`src/store/run_discovery.ts`** — `find_active_runs` returns each active run
  with the short commit it was prepared at and whether it owns a `triage.json`.
  Both fields feed the refusal: the commit is what decides between continuing
  and abandoning, and a run interrupted before its state was written has no
  entries to hand out, so only abandon is offered for it. A run whose manifest
  is unreadable counts as inactive rather than holding the project hostage to a
  file nothing can parse.
- **`scripts/prepare_triage.ts`** — `active_run_conflict_message` builds the
  refusal; the guard runs before the re-index and again before the manifest
  write. The run directory is created only once the run is certain to be
  claimed, so a refusal leaves nothing behind. The manifest is written through
  `atomic_write_file` because the guard now reads it, and a torn read parses as
  null, which would count a live run as inactive.
- **`src/store/paths.ts`** — run resolution splits into `require_run` (needs
  `triage.json`; every caller that reads or writes entries) and
  `require_run_manifest` (needs only the manifest). `abandon_run.ts` uses the
  latter and writes atomically.
- **`scripts/get_next_triage_entry.ts`** — `dispense_batch` resolves the run
  and returns `{ run_id, entries }`, which is what the script prints.
- **Docs** — `SKILL.md` (guard behaviour, `--run-id` on every Phase 3-4 call,
  run liveness living in `manifest.status`), `.claude/agents/triage-investigator.md`,
  and `docs/self-healing-pipeline/triage-investigator.html`.

### Why `require_run` had to split

Review caught that the guard converted a previously harmless state into a
permanent wedge. `prepare_triage` writes the manifest before `triage.json`, so
an interruption between those two writes leaves a run stamped `active` with no
state. `abandon_run` resolved through `require_run`, which exits on a missing
state file before ever reaching the manifest it only needed to rewrite — so the
one remedy the refusal prescribed could not run, and the project was blocked
with no exit but `rm -rf`. `abandon_run` is the recovery tool; demanding state
it never reads was the root cause, and splitting resolution fixes it at that
level rather than by teaching the guard to overlook such runs.

### Verification

`.claude/skills/triage` suite green (458 tests), typecheck and lint clean. The
CLIs were driven directly: with `LATEST` pointing at a second run, a pinned
dispense returned that run's own index while an unpinned one followed `LATEST`,
and `get_entry_context` at the same index resolved a different symbol and a
different verdict output path depending on whether `--run-id` was passed. The
refusal, the abandon-only labelling, the absence of an orphan run dir, and the
manifest-only recovery path were each exercised end to end.

### Operational note

Existing runs left `active` on disk block their projects on the next
`/triage` — by design, since they genuinely hold the LATEST slot. `list_runs.ts
--project <name> --status active` names them and `abandon_run.ts --run-id`
clears them, including runs with no `triage.json`.

### Not addressed

- `detect_entrypoints` (Phase 1) has no active-run awareness, so a refused
  project still pays for the clone and index before Phase 2 declines. Closing
  that means a guard in a second script and is out of this task's scope.
- Section 4's shared-clone locking remains a non-goal; `with_clone_lock` already
  serialises it.

## Cross-references

- The unconditional LATEST write: `.claude/skills/triage/scripts/prepare_triage.ts` (`write_latest_run_id`, manifest `status: "active"`)
- The LATEST fallback both scripts share: `.claude/skills/triage/src/store/paths.ts` (`require_run`)
- Run enumeration available to the guard: `.claude/skills/triage/src/store/run_discovery.ts` (`list_runs`)
- The dispense output to extend: `.claude/skills/triage/scripts/get_next_triage_entry.ts`
- The investigator-side run resolution and verdict path: `.claude/skills/triage/scripts/get_entry_context.ts` (`results_dir_for`)
- Docs that must thread the run-id: `.claude/skills/triage/SKILL.md` (Phase 3), `.claude/agents/triage-investigator.md`
- The existing escape hatch the guard points at: `.claude/skills/triage/scripts/abandon_run.ts`
- The finalized-only TP cache that strands orphaned runs: `.claude/skills/triage/src/finalize/confirmed_unreachable_reuse.ts`
- The already-serialised shared clone (non-goal): `.claude/skills/triage/scripts/detect_entrypoints.ts` (`with_clone_lock`)
- The task whose pickup produced the second concurrent run: `TASK-190.15.17`
