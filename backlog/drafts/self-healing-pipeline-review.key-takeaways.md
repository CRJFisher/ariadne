# Self-Healing Pipeline Review — Key Takeaways

Multi-lens review (2026-07-03) of the four pipeline skills — `triage`, `plan`, `prioritize`, `reconcile-registry` — their six sub-agents, `classifier-lifecycle.md`, and the registry write-guard hook. Lenses: structural, design, intention-coverage, orchestration, lint, permission, and two strategic passes. 166 raw lens findings deduplicate to 128 unique rows (1 critical, 40 major, 51 minor, 36 info); every per-skill finding passed an adversarial verification pass (4 refuted, 11 adjusted).

Companion pages: [risk posture](self-healing-pipeline-review.risk-posture.html) · [what to fix first](self-healing-pipeline-review.what-to-fix-first.html).

## Verdict

The core architecture is sound and its best disciplines are consistently applied: pass-by-reference hand-offs with terse returns at every wave boundary, file-authoritative verdicts, single-producer artifacts, deterministic-first ordering, a fail-closed export adapter, and a triple-enforced registry write path (lock-sidecar `atomic_update_registry`, the AST-walk test, the `PreToolUse` guard). Plan's finalize guard is exemplary — a half-finished sweep can only block retirement, never cause spurious resolution.

The risk is asymmetric: **the safety properties the docs advertise most loudly have the weakest enforcement.**

## The seven root-cause themes

1. **The human-ownership boundary is lexical and prose, not structural.** The one critical finding: `defaultMode: acceptEdits` plus standing `Bash(python3:*)`/`Bash(node:*)` allow-rules in `settings.local.json` route around the registry guard's write-token list (`registry_write_guard.ts:53`) — a Python `open(..., 'w')` on the registry auto-accepts today. The guard's enforcement seam (hook wrapper `main()` with its fail-open catch, and the `settings.json` `Write|Edit|Bash` matcher) has zero test coverage. The parallel "only writer of backlog/" claim is prose-only and already false (`graduate_group_docs.ts` and step-5 agents also write `backlog/`), and the claimed `*.comprehension.html` gitignore rule does not exist.

2. **Judge outputs gate irreversible decisions with only shape-level checks.** `consolidation.json` — "the spine of the run" — is the only unvalidated hand-off in a chain that validates every other seam; a row dropped from every cluster silently never exports. A strategist's `belongs: false` (k=1, no abstain value) permanently suppresses a false positive via a standing membership override. The architect's "tests cover every evidence case" invariant accepts empty `acceptance_criteria`. A drafted classifier is never executed against its own samples before `--stage` insertion. The `uncertain[]` abstain channel has no consumer anywhere.

3. **Doc-vs-code drift hits load-bearing contracts.** `plan/SKILL.md:166-190` documents an export invocation the code hard-refuses (`--assignments` is required and never mentioned). The pipeline's only `meta.json` (plan's) declares a `registry-read` store the skill forswears, carries a stale "NOT YET WIRED", and truncates both `path_pattern`s. Six of triage's seventeen architecture-table rows point at wrong module paths.

4. **Crash-recovery and atomicity discipline stopped at the registry.** Triage's shared `triage.json` is a bare `writeFileSync` with no lock — the exact lost-update race the registry's contract exists to prevent, guarded only by "call sequentially" prose. Neither plan sweeps nor prioritize runs can resume: a session death mid-fan-out re-spends every finished opus investigation, and `$SCRATCH` in prioritize's copy-paste commands is never bound.

5. **`dedup_key` — the loop-closure identity — is the least drift-stable identity in the pipeline.** It hashes exact `file:line` evidence while every neighboring identity is drift-tolerant, so any target-repo commit can resurface already-funded work as fresh proposals. Triage documents its analogous cache leaks; this one is documented nowhere.

6. **Eval/lint readiness is one skill out of four, and that one drifted.** Three skills have no `meta.json` and no validator-shaped scripts; exit-code conventions are inverted against the lint lens's abstain contract, producing a spurious red on `validate_plan.ts`.

7. **Contracts are authored 2–6 times across surfaces and drift independently.** Worst: the TriageVerdict shape ×3 (two copies paid in-context on every one of 75+ dispatches), prioritize's permanent-limitation routing ×6, reconcile's name-mode ×4. The fix is uniform: one runtime-authoritative copy, the rest pointers.

## Per-skill headlines

- **triage** — strongest orchestration in the pipeline (file-based verdicts save ~179K chars at observed fan-out; sound double-dispatch prevention). Weakest points: the non-atomic state file, a `!`-injected live status block at line 80 that invalidates prompt-cache for ~80% of the doc, `AskUserQuestion` used but not in `allowed-tools`, and `failed` entries with no retry path (the "silent black hole" variant was refuted — finalize throws loudly).
- **plan** — cleanest write-boundary story (smoke-tested) and zero result bloat; the export section documents an unrunnable workflow, `belongs: false` needs an abstain value, and sweeps cannot resume (one orphan sweep sits on disk).
- **prioritize** — pass-by-reference honored across all six waves, but it carries the most operational sharp edges: `refactor-investigator.md:3` is invalid YAML (empirically fails to parse — one-line quote fix for the step-3 workhorse), no crash-resume with destructive re-dispatch, an unnamed "comprehension-doc specialist" dispatch that names no existing agent, and ~2.7K chars of dead routing surface from four specialists without `disable-model-invocation`.
- **reconcile-registry** — the cleanest CLI contract and the positive permission baseline; its gaps are the untested guard enforcement seam, an `argument-hint` omitting the two write-opt-in flags (`--stage`/`--apply`), and a raw stack trace on a flag typo.

## Fix first (condensed from the 15-item action list)

1. **Close the registry-guard bypass routes and test the seam** — extend the write-token list (`cpSync|renameSync|rmSync|createWriteStream`, python/perl open-modes), add `bun`/bare-path exec to the runner alternation, write the hook-wrapper integration test and a settings-matcher assertion; narrow the standing `python3`/`node` allow-rules in `settings.local.json`. _(resolves the critical)_
2. **Quote `refactor-investigator.md:3`'s description** — one line.
3. **Unblock the live export path** — the stale pre-190.35 row `~/.ariadne/plan/tasks/pt-018de0f069fbfd82.json` aborts even `--dry-run` exports today.
4. **Fix the false safety claims** — gitignore line (or delete the claim), rewrite plan's export section around `--assignments`, decide the backlog-boundary posture (narrow the prose or extend the AST test to backlog-shaped paths).
5. **Add `validate_consolidation.ts`** between prioritize steps 4 and 5 (~40 lines: partition/plan_path/slug checks) — closes the weakest judge gate.
6. **Make triage state writes atomic + locked**; include `failed` in the completion gate with a retry counter.
7. **Give prioritize (and plan Pass B) a resume story**; bind `$SCRATCH`; name a `refactor-comprehension-author` agent.
8. Then: the meta.json campaign, contract de-duplication, hardening the judge gates that mint work (sample-execution in `--stage` is the smallest, highest-leverage piece), `dedup_key` documentation-now/re-key-later, the CLI hygiene sweep, draining `uncertain[]` plus a `tp_stability` metric, eval-set seeds before run pruning decays them, and the YAGNI deletions (`accepted` status, `--strategist`, stale local rules).

## Trust notes

- The critical and the pipeline-level strategic findings were not adversarially re-verified (per-skill findings were); several are corroborated by verified per-skill findings.
- Verification corrections worth knowing: "failed entries finalize silently" refuted (finalize throws at `verdict_ledger.ts:79-84`); the prioritize staging-root "collision" rested on stale June-25 artifacts; reconcile's promote crash-recovery invariant is tested; triage's architecture-table fix must use the structural-lens paths (the orchestration variant's `src/cross_run/` placement is wrong).

Full evidence, per-finding citations, and the complete 128-row inventory live in the [review dossier](self-healing-pipeline-review.dossier.md).
