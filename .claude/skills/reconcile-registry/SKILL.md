---
name: reconcile-registry
description: Reconcile the classifier registry against work already done — flip wip rules to fixed when a fix-bearing task-scoped commit lands, flag drift from published classifier_regressions, and promote rules to permanent. Drives reconcile_registry.ts, the registry's only human-invoked writer, run deliberately by the human through atomic_update_registry.
argument-hint: "[--dry-run] [--fixed] [--drift] [--id <group_id>...] [--promote]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read
---

# Reconcile Registry

Reconcile the known-issues registry at
`.claude/skills/triage/known_issues/registry.json` against work the rest of
the pipeline has already done: fixes that landed in this repo's git log, drift
that triage published, and rules the human elects to make permanent. This
skill is the deliberate, human-invoked step that detects those mechanical
writes and proposes them — the registry's analogue of `prioritize`.

It owns no logic of its own. All work runs through one script:

```
.claude/skills/triage/scripts/reconcile_registry.ts
```

That script is the **only human-invoked writer of `registry.json`** in the
pipeline, and it reaches the registry only through
`atomic_update_registry(path, mutator)` — one lock-fenced read-mutate-write
per invocation. It never runs on the autonomous sweep: the human is the
registry's sole decider, and this skill exists to make each decision cheap,
never to make it autonomously.

## What it detects

The script scans the mechanically-detectable signals and proposes the
corresponding registry write. It never authors rule prose and never makes the
`permanent` judgment — those stay human creative and judgment work.

| #   | Signal (mechanically detected)                                              | Proposed registry write                                        |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | a fix-bearing `git log` scope in this repo matches a `wip` rule's `backlog_task` | `wip → fixed`                                                  |
| 2   | a published `triage_results[].classifier_regressions[]` names a rule — its `rule_id` field carries the registry rule's `group_id` | set `drift_detected: true`; append new `drift_evidence[]` rows |
| 3   | the human elects to promote a rule (`--id <group_id> --promote`)            | flip to `permanent`; regenerate `permanent_data.ts`            |

The `wip → fixed` detector derives the bare task scope from each rule's
`backlog_task` (`TASK-198 → 198`) and matches it exactly — never by prefix —
against this repo's `git log`, reusing the scope grammar in
`scripts/check-commit-message.ts` (range scopes like `190.17.12-14` expand to
their exact ids). Only `fix` and `feat` commits count: a `docs(198)` or
`review(198)` commit references the task without fixing anything. Each
proposal cites the newest matching commit subject as its audit line. No
commit hash is stored — the `backlog_task` link plus the git log are the
audit trail.

Drift evidence is append-only and deduped by `entry_index`, so a re-run after
apply proposes nothing. Drift detection reads each project's latest finalized
run only.

## Workflow

Always invoke with `node --import tsx`. Never `pnpm exec tsx` or `npx tsx`
(those open IPC sockets the sandbox blocks).

1. **Preview the changeset.** Run with `--dry-run`. The script scans both
   detection signals and prints the proposed writes grouped by transition,
   writing nothing — this is the reconciliation view.

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts --dry-run
   ```

2. **Review and narrow.** Restrict the set with the selectors below —
   `--fixed` / `--drift` for one signal, or `--id <group_id>` to name exact
   rules — and re-run `--dry-run` until the changeset is exactly the intended
   work. To weigh a proposed flip, read its rule in the registry, or its
   published evidence in `analysis_output/<project>/triage_results/<run-id>.json`.

3. **Apply.** Drop `--dry-run`. All proposals fold into one
   `atomic_update_registry` transaction. A re-run of the same apply is a
   no-op: the fold degrades already-absorbed proposals to nothing and the
   summary reports `applied: false`.

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts --fixed
   ```

4. **Promote (separate, deliberate).** To make a rule `permanent`, name it
   and pass `--promote`. The script refuses a rule whose `classifier.kind` is
   `"none"` (core cannot load an unclassified permanent rule) or that is
   already `permanent` — refusals exit zero and report in
   `rejected_promotions` with the reason. Accepted promotions flip the
   status, then the bundled core slice syncs via `generate_permanent_data.ts`
   on **every** `--promote` invocation (accepted or not), so a crash between
   the registry write and the regeneration is recovered by re-running the
   same command; `permanent_data.sync.test.ts` guards the slice against drift
   thereafter. `--promote` cannot combine with `--fixed`/`--drift` —
   promotion is its own transaction.

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts \
     --id <group_id> --promote
   ```

## Selectors

| Flag              | Selects                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `--dry-run`       | print the proposed changeset, write nothing                              |
| `--fixed`         | `wip → fixed` proposals only                                             |
| `--drift`         | drift-flag proposals only                                                |
| `--id <group_id>` | exact rules (repeatable); **overrides** `--fixed`/`--drift` — both signals are scanned and only the named rules' proposals survive; ids matching no proposal report in `missing_ids` |
| `--promote`       | with `--id`: name rules directly (no detection); flip them to `permanent` and sync the slice |

`--id` has two modes: as a selector it overrides the signal filters and
narrows the detected proposals to the named rules; with `--promote` it
bypasses detection entirely and names the rules to flip. With no selectors,
every proposal across both detection signals is selected — always preview
that with `--dry-run` first.

## Output

The script's only stdout is one JSON summary:

| Field                     | Meaning                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `proposals`               | the changeset, grouped by transition (`wip_to_fixed`, `drift_detected`, `promote_to_permanent`)                                     |
| `applied`                 | a registry write happened. `false` under `--dry-run`, when nothing was proposed, and when the fold was byte-identical (idempotent re-run) |
| `permanent_slice_changed` | core's `permanent_data.ts` differs from a fresh render — rewritten on a real `--promote`, reported-only under `--dry-run` (rendered from the would-be-promoted rules) |
| `missing_ids`             | `--id` values matching no proposal (selector mode) or no rule (`--promote` mode)                                                    |
| `rejected_promotions`     | `--promote` targets refused, with the reason (`classifier.kind` is `"none"`, or already permanent)                                  |
| `drift_unknown_rule_ids`  | published `rule_id`s with no registry rule — review signals, never writes                                                           |
| `skipped_sources`         | published files that failed to read or parse (e.g. a stale schema version) — reported, never fatal                                  |

Each `wip_to_fixed` proposal carries `matched_subject` (the newest matching
commit) as its audit line; each `drift_detected` proposal carries
`flagged_by`, the `{project, run_id}` provenance of every run that flagged
the rule.

## Cross-references

- Canonical writer matrix and lifecycle: `.claude/rules/classifier-lifecycle.md`
- Producer of `classifier_regressions[]`: `.claude/skills/triage/SKILL.md`
- The backlog-side analogue this skill mirrors: `.claude/skills/prioritize/SKILL.md` over `.claude/skills/plan/scripts/export_to_backlog.ts`
- The permanent-slice generator: `.claude/skills/triage/scripts/generate_permanent_data.ts`
