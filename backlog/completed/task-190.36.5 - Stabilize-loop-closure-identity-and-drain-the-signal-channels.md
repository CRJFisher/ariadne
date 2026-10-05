---
id: TASK-190.36.5
title: "Stabilize loop-closure identity and drain the signal channels"
status: Done
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - self-repair
  - self-healing
  - pipeline-hardening
  - eval-sets
parent_task_id: TASK-190.36
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The pipeline's canonical drift-tolerant identity is `member_symbol`
`(file_path, name, kind[, start_line])` — the TP cache, membership overrides,
and `diff_runs`' fuzzy fallback all converge on it. Two things do not: the
loop-closure `dedup_key` (which hashes exact `file:line` call sites, so any
target-repo commit can resurface already-funded work as fresh proposals), and
the signal channels that should tell the operator when frozen judgments have
gone stale (`uncertain[]`, TP-cache stability, investigator eval seeds). This
task aligns them.

### Work

1. **Document the dedup_key leak now; add the prioritize cross-check** (small,
   ships first). `compute_dedup_key.ts:43-50` hashes call-site
   `file:line` tokens; both dedup consumers (`reconcile_plan.ts:148-150`
   export suppression, `backlog_dedup.ts` frontmatter matching) miss after
   any line shift. Triage documents its analogous cache leaks
   (`triage/SKILL.md:267-270`); this one is documented nowhere. Add the leak
   note beside plan's dedup guarantee, acknowledge the accepted drift cost in
   the `compute_dedup_key.ts` comment (which currently defends the choice
   without naming the cost), and add a prioritize step-1 advisory cross-check
   of the run's `member_symbol` sets against exported backlog rows that
   surfaces candidate collisions for human review (no auto-suppress).
2. **`tp_stability` metric.** Every cached TP is one sonnet trial frozen as
   ground truth with no re-check
   (`confirmed_unreachable_reuse.ts:188-221`). In
   `apply_tp_cache_to_entries`, deterministically sample ~5 would-be cache
   hits per run and leave them in the `llm-triage` pool tagged
   `tp-stability-sample`; at finalize, record
   `manifest.tp_cache.stability = {sampled, agreed, rate}`. A low rate is the
   operator's signal to run `--no-reuse-tp`. Additive field — no schema bump,
   update fixtures only. Coordinate with TASK-190.36.3 so a stability sample
   is not mistaken for an incomplete entry by the completion gate.
3. **Surface `uncertain[]` with repeat counts.** The abstain channel has no
   operational consumer (only `diff_runs` reads it); uncertain entries never
   enter the TP cache and re-investigate on every run forever, unbounded
   spend. Add the per-run `uncertain` count to `get_triage_summary.ts` and a
   cross-run repeat counter over published `triage_results/*.json` (reuse
   `diff_runs.ts:135-149`'s fuzzy matching). Deliberately do NOT feed
   `uncertain` into plan — grounding fix-plans on unconfirmed FPs would be
   wrong; the repeat count is a human signal. State that decision in one line
   in `plan/SKILL.md`.
4. **Snapshot investigator eval seeds before pruning.** `prune_runs.ts`
   deletes run dirs (verdicts + their byte-identical dispense-payload inputs)
   at keep-count 5 while preserving published labels forever — the
   reproducible inputs decay. Snapshot
   `(dispense_payload, expected_verdict, member_identity, group_id)` tuples
   before `rm`, prioritizing `diff_runs` flips (highest-signal regression
   cases). 190.31 is task docs only — no eval-set store exists yet — so build
   this as the investigator partition of 190.31.1's store (one physical
   store, two logical partitions: classifier examples and investigator
   replay pairs), not a competing mechanism. Gated on / co-built with
   TASK-190.31.1.
5. **Fixed-row resurfacing: verify provenance, then implement or reword.**
   `classifier-lifecycle.md:78` promises a `fixed` row whose `member_symbol`
   reappears "is surfaced for human review" — no producer exists, and the
   investigator's slice (wip+permanent) means a regression verdict can never
   cite a fixed rule. First check whether a `fixed` row retains a member set
   to cross-reference; if yes, extend reconcile-registry's read-only scan to
   emit a `resurfaced_fixed_rules[]` review slice (detection only, no write);
   if no, reword the promise to what is actually detectable.
6. **Re-key `dedup_key` on the sorted `(file_path, name, kind)` member set**
   (large, last, decision required). `PlanTaskEvidence` already carries
   `member_symbol` on every row, so no new upstream plumbing is needed — but
   `dedup_key` also mints `PlanTask.id` (`build_plan_tasks.ts:43-45`), so a
   re-key stales all 61 task-DB rows (27 exported) and the 13 backlog
   `plan_dedup_keys` frontmatter entries. Keep call-site `location_token`
   for evidence union (two call sites are distinct evidence); switch only key
   derivation. Migration per the constitution (no shims): a one-shot re-key
   script over the task-DB and backlog frontmatter, run once and deleted —
   or, if backlog tasks lack recomputable member provenance, a bounded
   one-time human re-confirm of the exported epics. Resolve the provenance
   question before committing. Item 1 mitigates the same failure in the
   interim; ~9 test files regenerate expected hashes/ids.

Suggested order: 1 → 2 → 3 → 5 → 4 → 6.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] The dedup_key line-drift leak is documented beside plan's dedup
      guarantee, and prioritize step 1 surfaces member-set collisions with
      exported work.
- [x] Each run's manifest records a tp_stability agreement rate from real
      re-investigations of sampled cache hits.
- [x] `get_triage_summary` shows uncertain counts and cross-run repeat
      counts; `plan/SKILL.md` states why plan does not consume `uncertain`.
- [ ] Investigator (dispense payload, expected verdict) pairs survive
      `prune_runs`, hosted in the 190.31.1 store. **Deferred** onto
      TASK-190.31.1 (no eval-set store exists yet); wiring recorded there.
- [x] The fixed-row resurfacing promise either has a working detector
      emitting a review slice, or is reworded to what is detectable.
- [x] The re-key decision is made explicitly: either dedup_key derives from
      the sorted member set with the one-shot migration landed and deleted,
      or the deferral is recorded with its standing cost.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The pipeline's drift-tolerant identity is the `member_symbol`
`(file_path, name, kind[, start_line])`, but two surfaces did not use it: the
loop-closure `dedup_key` hashed exact call-site `file:line`, so any target-repo
line shift resurfaced already-funded work as fresh proposals; and the
abstain/TP-cache signal channels gave the operator no way to tell when frozen
judgments had gone stale. This task aligns them.

`dedup_key` now hashes the sorted `(file_path, name, kind)` member set
(`compute_dedup_key`), so a member that only moves down its file keeps its key
and augments the existing task instead of duplicating it; evidence union and the
orphan-overlap scorer still key on the call-site `location_token`, since two
call sites are distinct evidence. `start_line` is excluded so pure line shifts
are absorbed; the residual costs — a member changing FILE or NAME re-keys, and
two members sharing `(file, name, kind)` at different lines collapse to one
token — are documented at the derivation. The one-shot migration re-stamped the
single exported backlog key (task-347.1), recomputed from its recovered member
set (its two `_getitem` overloads collapsing to one token).

Two audit signals now drain the frozen-judgment channels. The TP cache leaves up
to five would-be hits per run on the `llm-triage` route (`tp_stability_sample`)
so the investigator re-checks them; finalize records
`manifest.tp_cache.stability = {sampled, agreed, rate}`, a low rate being the
operator's cue to run `--no-reuse-tp`. `get_triage_summary` surfaces the latest
`uncertain` count plus a cross-run repeat count, so a perpetually-uncertain entry
— which re-investigates every run and never enters the cache — is visible instead
of silent spend.

Navigate from `compute_dedup_key.ts` (the identity),
`exported_overlap.ts` + `cross_check_exported_overlap.ts` (the prioritize
step-1 advisory that catches the partial member-set overlaps exact-hash dedup
misses), and `confirmed_unreachable_reuse.ts` (`apply_tp_cache_to_entries` +
`compute_tp_stability`). Cross-run signals live under `src/cross_run/`
(`uncertain_repeats.ts` reuses `diff_runs`' fuzzy key).

Deliberate non-goals: plan does not consume `uncertain` (grounding a fix-plan on
an unproven FP would mint work against an unconfirmed signal); the fixed-row
resurfacing promise is reworded to what is detectable — fixed rows retain only
call-site examples, no member identity, and the investigator's active slice is
wip+permanent, so nothing auto-detects a regression against a fixed rule. Item 4
(snapshot investigator eval seeds before `prune_runs`) is deferred onto
TASK-190.31.1, whose eval-set store does not yet exist; the investigator
replay-pair partition is specified there.

### Per-item detail

- **Item 6 (re-key):** `compute_dedup_key` derives from `member_token`
  (`file_path\0name\0kind`, NUL-joined). `location_token` is retained and still
  drives `union_evidence` and reconcile's orphan supersede/combine overlap.
  Migration: task-347.1's `plan_dedup_keys` re-stamped to
  `3fc6b57f…4f51` (the live task-DB is empty post-wipe, so it was the only
  persisted key; membership-override and sweep-log stores key on member identity
  or are append-only, so nothing else silently mismatched). ~9 test hashes
  regenerated; a positive line-shift-tolerance test added.
- **Item 1:** identity + residual cost documented in `compute_dedup_key.ts`,
  `plan_task.ts`, and `plan/SKILL.md`. `find_exported_overlaps` +
  `cross_check_exported_overlap.ts` surface partial member-set overlaps with
  exported backlog rows for human review (no auto-suppress), wired into
  `prioritize/SKILL.md` step 1.
- **Item 2:** `select_stability_sample_indices` picks a deterministic even
  spread; samples stay `route=llm-triage`, `auto_classified=false`, so the
  picker/completion gate treat them as ordinary residual entries.
  `compute_tp_stability` scores agreement at finalize; `TpCacheRecord.stability`
  is `null` until then. Accepted bound: for a run with ≤5 hits, all are sampled
  and none reused — documented at `TP_STABILITY_SAMPLE_TARGET`.
- **Item 3:** `count_uncertain_repeats` counts fuzzy-identity recurrences across
  the recent published runs; `all_finalized_run_ids` orders by the ISO-timestamp
  suffix so "newest-first" holds across commits.

### Review

Reviewed by a 6-lens opus fan-out plus a fix-diff re-review. Findings actioned:
the cross-commit run ordering bug (`all_finalized_run_ids` sorted lexicographically,
letting the commit hex dominate — now sorts on the timestamp suffix), a
membership-override doc inaccuracy (it keys on the full 4-tuple incl.
`start_line`, not `(file, name, kind)`), the same-name/overload collision cost
(now documented), and four test-coverage gaps (overlap ordering, format helpers,
uncertain tie-breaker, an inert `status:"failed"` premise). Noted-not-actioned:
the ≤5-hit TP-cache no-op (documented as an accepted bound rather than changed).
The re-review also caught an out-of-scope working-tree change that had weakened
the registry write-guard (dropping `Bash` from its PreToolUse matcher); it was
reverted and is not part of this task.
