# Self-Healing Pipeline — Recommended Architecture

_Chief-architect synthesis of the architecture map + five judged redesign proposals. Verified against the live tree (worktree root: `/Users/chuck/workspace/ariadne/.worktrees/self-healing-pipeline`)._

## TL;DR

Take **RADICAL-SIMPLIFICATION (Proposal 4)** as the spine: collapse the pipeline to one registry-centered loop and **close it with a small reconciler instead of the unbuilt fix-sequencer**. Graft in the **CallSiteId stable-identity fix (Proposal 1)** and the **two-skill data-seam topology (Proposal 2)** as the target shape, plus the **low-risk naming/contract cleanups (Proposal 3)**. The loop is genuinely open — 171/180 registry rows are stuck `wip`, **0 are `fixed`**, and the `KnownIssue` type has no `fixed_commit`/`fixed_in_run` fields — so the highest-value change is the ~80-line git-log + resurfacing reconciler that makes a row reachable to `fixed` for the first time. **Drop** the fix-sequencer's clustering/Pareto/DAG/calibration machinery (YAGNI on a singleton corpus), the dead absorb/coordinator subsystem, and the second call-graph pass. **Keep** the `atomic_update_registry` lock and the AST write-boundary test — both judges proved the "race cannot occur" premise false (two live writers; the reconciler is a third) — so the lock is load-bearing, not surplus.

## Current architecture in one breath

Three skills under `.claude/skills/` chain detect → curate → (planned) fix, joined only by filesystem strings (`run-id = <short-commit>-<iso-ts>`) and convention-only `~/.ariadne` paths. `triage` traces the call graph (twice — `detect_entrypoints.ts` then `prepare_triage.ts` re-trace from live HEAD), classifies known FPs against `known_issues/registry.json`, runs an LLM investigator pool, and publishes a v4 `triage_results` artifact; `plan` sweeps those runs, registers recurring FPs as `wip` registry rows, authors classifiers + backlog tasks, and manages a `wip→permanent(→fixed)` lifecycle. The entire fix-delivery half (`fix-sequencer` skill + reconciler + the `fixed_*` storage fields) **does not exist on disk** — verified absent — so the registry only ever grows.

## The core problems

Ranked by leverage on the top intention (drive down FP entry points by fixing resolver bugs over runs):

- **The loop cannot close — there is no actuator.** `KnownIssueStatus` includes `"fixed"` (`packages/types/src/known_issues.ts:14`) but the `KnownIssue` interface has **no** `fixed_commit`/`fixed_in_run` fields (verified, lines 16-27); 0/180 rows are `fixed`; `fix-sequencer` is absent; `prepare_triage.ts:107-114` already filters `status !== "fixed"` for a state nothing produces. The curator proposes endlessly with no retirement path.
- **A whole subsystem is built-but-dead.** `absorb_verdict` is referenced only by its own file and test — **zero production callers** (verified); `coordinator_prompt.ts` emits a criteria-free JSON dump; `SKILL.md` describes this in-run novel-issue path as live. Pure surplus per the no-surplus constitution.
- **The planned fix-sequencer is over-designed before its actuator exists.** Union-find/Jaccard clustering, Fibonacci/risk scoring, Pareto ranking, and a 3-store DAG (`graph.json`+`state.jsonl`+`calibration.jsonl`) target a ~116-task corpus the specs themselves admit "collapses to mostly singletons" under single-worker execution (`backlog/tasks/task-190.18.7`, `.11`). Solving races and scale that do not occur.
- **Two parallel verdict models + duplicated published shape.** The live 5-arm `TriageVerdict` coexists with the legacy binary `TriageEntryResult` (still typed onto `TriageEntry.result`, `src/triage_state_types.ts`); the v4 artifact is hand-copied as `FinalizationOutput` vs `TriageResultsFile` with **two** independent `=4` schema constants, plus two **incompatible** `MemberEvidence` shapes (`{file,line,why}` vs `{summary,excerpt}`).
- **No stable cross-run call-site identity.** `drift_evidence.ts:20-28` self-documents that `entry_index` is run-local and append-only across runs ("do NOT use it as a cross-run identity key") — so the same call site is never recognized run-to-run, even though the stable 4-tuple (`name+file_path+kind+start_line`) already exists in the TP cache and is then discarded. This is the precondition for any resurfacing-based reconciliation.
- **Correctness-critical orchestration lives in LLM-executed prose.** ~250+ lines of worker-pool / pull-loop / same-turn-sidecar invariants in both `SKILL.md` files, plus an **unlocked** read-modify-write in `get_next_triage_entry.ts` — a real double-dispense hazard.
- **Idempotency leaks into the filesystem.** `bump_observed_stats` adds unconditionally; correctness depends entirely on external sentinel files (`finalized.json`/`finalize_started.json`). `observed_count` reaches **219** and gates promotion-to-core, so a deleted sentinel silently distorts what ships.

## Recommended architecture

### Data model — one identity, derive what you can, store what closes the loop

- **Add a stable `CallSiteId`** (branded 4-tuple, project-relative path) in `@ariadnejs/types`, mirroring the existing `SymbolId`. Carry it verbatim through every artifact. `entry_index` is demoted to a run-local queue index and **forbidden** as any cross-artifact key. This structurally fixes the drift/novel-issue identity gap (Proposal 1's strongest, judge-verified idea).
- **Add `fixed_commit` and `fixed_in_run` to `KnownIssue`** — the minimal change that lets a row exit the loop. This is already scoped in `task-190.18.3`; adopt it.
- **Unify the cross-skill contract:** one published-run type + one `SCHEMA_VERSION` in `@ariadnejs/types`, imported by both producer and consumer. Collapse the two `MemberEvidence` shapes onto the structured `{file,line,why}` (it carries the identity the dedupe needs). Delete the legacy binary `TriageEntryResult`.
- **Make `observed_count` idempotent at the function** (key the bump on `run_id` via a `counted_runs` set on the row), so re-curating a run is a no-op without sentinels. Do **not** go all the way to Proposal 1's full append-only-log-with-derived-registry rewrite: judges rated it feasibility-2/risk-5, it bundles a promotion-metric semantics change with a brand-new compaction subsystem, and two of its demolition premises were factually wrong. Derive-don't-store is right for `observed_count` specifically; the registry stays the durable truth.
- **Normalize `group_id`** (today spelled 6+ ways: `rule_id`, `should_have_matched_rule_id`, `target_group_id`, `retargets_to`, novel-issue slug…) to one term end-to-end.

### Skill topology — two skills on the real data seam

Re-cut on the two memory horizons (Proposal 2), but **without** the high-blast-radius rename theatrics judges rejected:

```
before:  triage  +  plan  +  fix-sequencer(absent)
after:   triage (per-run, run-id keyed)  +  heal (cross-run, registry keyed)
```

- **`triage`** = one `analyze` pass (load+trace **once**, classify inline, emit work queue — kills the second call-graph trace and the `include_tests` divergence) → investigate → publish. Novel FPs go straight into the run artifact (the dead absorb/coordinator cluster is deleted; dedupe moves to the `heal` sweep where the cross-run registry actually lives).
- **`heal`** = sweep → author classifiers + backlog tasks → **reconcile**. The reconciler is a ~80-line step, **not a skill**: scan the target repo's `git log` for the Conventional-Commits scope matching `rule.backlog_task` (the commit hook already guarantees this link), confirm the row's member call-sites are now reachable in the freshly-built call graph (distinguish "fixed" from merely "deleted"), and flip `wip→fixed` via `atomic_update_registry`. Fix ordering degrades to `ORDER BY observed_count DESC` (counts up to 219 are a strong proxy; clustering is empty on this corpus).

> Conflict resolution — reconciler placement: Proposals 4/5 put the reconciler inside detection/finalize, which **violates** the write-boundary contract (`triage` must never write the registry, per `classifier-lifecycle.md`). It lives in **`heal`**, which already owns all registry writes. This keeps the lifecycle contract intact while still being one process.

### Naming / IA — adopt the cheap wins only

- Rename the two clashing `finalize` verbs: `publish_run` (triage) vs `apply_sweep`/`seal_sweep` (heal).
- Move `confirmed_unreachable_reuse.ts` out of `src/finalize/` (it runs at prepare time — the folder name lies, violating the CLAUDE.md folder-naming rule) into the `triage` analyze module.
- Pick one authoritative phase count (docs currently say 4, 5, and "four bands").
- Split the three "impact report" names by consumer (human summary vs machine feed).
- **Defer** Proposal 3's `fp_id`/`FalsePositive` spine sweep, the `NovelIssue`+`KnownIssue` merge, and the top-level skill-folder renames touching the live 180-row registry path and harness discovery surface — judges rated that bundle feasibility-2/risk-5 and it smuggles a live-registry migration into a "naming" pass.

### Write-boundary — keep the lock, keep the test

**Reject** the proposals to delete `atomic_update_registry`'s lock and replace the AST boundary test with grep. Both judges verified the justification is false: `apply_proposals.ts` issues **two** registry mutations (lines 352, 447) plus an exported link path, all drivable across processes, and the reconciler becomes a genuine concurrent writer. The lock is load-bearing; the AST test (which resolves a write call's first-argument path — grep cannot) is the right enforcement and already scaffolds the reconciler slot.

## What gets deleted

- **Entire planned fix-sequencer** scope: union-find/Jaccard clustering, Fibonacci/risk scoring, Pareto frontier, `graph.json`/`state.jsonl`/`calibration.jsonl` 3-store DAG, worker concurrency (`task-190.18.4–.12`). Replaced by the ~80-line `heal` reconciler + `observed_count DESC` ordering.
- **Entire absorb/coordinator cluster** in `triage/src/absorb/` (`absorb_verdict.ts` + coordinator decision/apply/prompt/log + replay-guard) — zero production callers.
- **Second call-graph pass:** `detect_entrypoints.ts` as a separate stage + `detect_entrypoints/*.json` + `warn_if_analysis_stale` + the ~200-line bespoke streaming-JSON reader (no large artifact remains after the merge).
- **Legacy binary `TriageEntryResult`** + the binary section of `diagnosis_routes.md`; one of the two duplicate published shapes; one of the two `=4` constants; duplicate `relativize()`/`describe()`/`MemberEvidence`.
- **`LATEST` pointer** (a third write idiom) + the curator sentinel files — run selection collapses to `manifest.status`; idempotency moves into the bump function.
- **Backwards-compat `migrate_legacy_state.ts`** (144 lines, constitution-banned) + uncalled housekeeping scripts (`preview_folders`, `get_triage_summary`).
- **Inert fields:** `min_confidence` (validated/stored, never rendered into `check_<id>.ts`) and the `llm_attributed_count: 0` phantom scoring dimension.

## Migration in phases

1. **Close the loop (highest value, low blast radius).** Add `fixed_commit`/`fixed_in_run` to `KnownIssue`; build the `heal` reconciler (git-log scope scan + call-graph reachability check + `wip→fixed` via `atomic_update_registry`). The loop reaches `fixed` for the first time.
2. **Stable identity.** Introduce `CallSiteId`; re-key drift/novel-issue accumulation onto it (note: 19 live `drift_detected` rows must be re-derived from `member_evidence` file/line — not zero, contra one proposal). Ship standalone; it's a prerequisite for reliable reconciliation.
3. **Contract + verdict cleanup.** Move the published shape + `MemberEvidence` into `@ariadnejs/types` with one schema constant; delete `TriageEntryResult`; normalize `group_id`. Make `observed_count` idempotent.
4. **Delete the dead surplus.** Remove the absorb/coordinator cluster and formally drop the fix-sequencer clustering/scoring/DAG scope from the backlog.
5. **Merge detect+prepare into one `analyze` pass**; delete the streaming reader and `LATEST`.
6. **Topology + naming.** Recut into `triage`/`heal`, rename the `finalize` verbs, relocate `confirmed_unreachable_reuse.ts`, reconcile docs. Do this last — it is the riskiest, lowest-marginal-value step, and every earlier phase stands alone.

Each phase is independently shippable (no big-bang rewrite, honoring the no-shims constitution by replacing, not bridging).

## Risks & open questions

- **Resurfacing is a weak "fixed" oracle.** It must distinguish "now correctly resolved" (call-site exists but is reachable) from "gone" (function deleted / config changed) by reading the call graph, and gate the flip on HEAD descending from the backlog-task landing commit. Fall back to N≥2 clean runs when no Conventional-Commits scope is found. This is real machinery — cheaper than the DAG, but not the "machinery-free script" the simplification lens advertised.
- **Auto-promotion `wip→permanent`: keep manual for now.** Proposal 5's auto-flip-on-2-clean-runs removes the last human gate before code ships to `packages/core` and was justified partly on a false "observed_count is low" premise (it reaches **219**). Keep promotion manual until the resurfacing oracle and the `CallSiteId` re-key are proven; revisit as a separate proposal.
- **Cross-worktree coupling.** `packages/core` is outside this worktree yet receives generated classifier source; `packages/types` is inside. The type moves are in-worktree, but the reconciler/promotion writes into core must be sequenced as coordinated changes with CI gates.
- **`drift_detected` has no auto-clear** and is a hard promotion veto. Once identity is stable (Phase 2), decide whether a fixed/resurfacing-free row should clear its drift flag automatically or stay human-gated.
- **Open:** does any out-of-band agent orchestration actually invoke the coordinator path before deletion? Verified no in-code caller; confirm no undocumented SKILL.md-driven invocation exists before removing it.
