---
name: reconcile-registry
description: Reconcile the classifier registry against work already done — flip wip rules to fixed when a fix-bearing task-scoped commit lands, flag drift from published classifier_regressions, and promote rules to permanent. Drives reconcile_registry.ts, the registry's only human-invoked writer, run deliberately by the human through atomic_update_registry.
argument-hint: "[--dry-run] [--fixed] [--drift] [--id <group_id>...] [--reason <text>] [--promote]"
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
`permanent` judgment — those stay human creative and judgment work. Beyond the
detected signals, it also accepts directed name-mode flips
(`--id ... --fixed --reason`, `--id ... --promote`) where the human names the
rules and the transition rather than letting detection propose it.

| #   | Signal (mechanically detected)                                              | Proposed registry write                                        |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | a fix-bearing `git log` scope in this repo matches a `wip` rule's `backlog_task` | `wip → fixed`                                                  |
| 2   | a published `triage_results[].classifier_regressions[]` names a rule — its `rule_id` field carries the registry rule's `group_id` | set `drift_detected: true`; append new `drift_evidence[]` rows |
| 3   | the human elects to promote a rule (`--id <group_id> --promote`)            | flip to `permanent`; regenerate `permanent_data.ts`            |
| 4   | the human retires a rule by name (`--id <group_id>... --fixed --reason`)    | `wip → fixed`; classifier → `retired`                          |

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

4. **Retire by name (direct flip, no detection).** When a fix lands under a
   different task than a `wip` rule's `backlog_task` — the common case for a
   rule subsumed by a broader classifier or a resolver improvement — the auto
   `--fixed` detector cannot match it. Name the rules with `--id` alongside
   `--fixed` and give a `--reason`: the script flips the named `wip` rows to
   `fixed` directly, independent of git-log matching, and records the reason as
   the audit line. A retired row's classifier becomes the structured `retired`
   kind (`{ kind: "retired", from: <former spec>, reason }`) so it dangles no
   reference to a deleted builtin. `--reason` is required in name-mode; a named
   rule that is not `wip` is a no-op; an unknown id reports in `missing_ids`.
   Auto `--fixed` (no `--id`) is unchanged — it cites the matched commit and
   takes no `--reason`. This is the command an agent flow prints for the human
   after doing the code-side deletions (see the sanctioned hand-off in
   `.claude/rules/classifier-lifecycle.md`):

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts \
     --id higher-order-function-callback --id inline-callback \
     --fixed --reason "subsumed by callback-resolution in TASK-348"
   ```

5. **Promote (separate, deliberate).** To make a rule `permanent`, name it
   and pass `--promote`. The script refuses a rule whose `classifier.kind` is
   `"none"` (no classifier to bundle) or `"retired"` (a deactivated classifier
   whose source is deleted — promoting it would resurrect a rule the human
   retired), or that is already `permanent` — refusals exit zero and report in
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

6. **Stage (insert an agent-authored draft).** A permanent-limitation classifier
   drafted by the `classifier-author` agent (`prioritize`, step 3a) lands as a
   staged `draft_entry.json`, never in the registry. Insert it with `--stage`:

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts \
     --stage ~/.ariadne/prioritize/<run>/classifier-author/<group_id>/draft_entry.json
   ```

   The script reads and validates the draft against the `KnownIssue` schema
   (which enforces the evidence gate, `observed_count >= 1`), rejects a
   `group_id` that already exists (no silent overwrite), and — because every
   classifier is a `builtin` — verifies the draft's `function_name` is present in
   core's `BUILTIN_CHECKS` (the `check_*.ts` has been placed under
   `packages/core/src/classify_entry_points/builtins/` and core rebuilt with
   `pnpm build --filter core`). Unlike the reconciliation signals, `--stage` is
   **dry-run by default** (prints the entry it would insert); add `--apply` to
   write via `atomic_update_registry`. A staged entry enters as `status: "wip"`;
   promotion to `permanent` remains the separate `--promote` step.

## Selectors

| Flag              | Selects                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `--dry-run`       | print the proposed changeset, write nothing                              |
| `--fixed`         | `wip → fixed` proposals only (auto-detected from the git log)            |
| `--drift`         | drift-flag proposals only                                                |
| `--id <group_id>` | exact rules (repeatable). As a **selector** (alone or with `--fixed`/`--drift`) it **overrides** the signal filters — both signals are scanned and only the named rules' proposals survive; ids matching no proposal report in `missing_ids` |
| `--id ... --fixed --reason "<text>"` | **name-mode**: flip the named `wip` rows to `fixed` directly, no detection — for fixes that landed under a task other than the rule's `backlog_task`. Converts each row's classifier to the `retired` kind. `--reason` required; cannot combine with `--drift`; non-`wip` named rule is a no-op; unknown id reports in `missing_ids` |
| `--id ... --promote` | name rules directly (no detection); flip them to `permanent` and sync the slice |
| `--reason "<text>"` | valid ONLY with name-mode (`--fixed` and `--id` together), where it is required; the retirement audit line, since no commit subject is cited. Any other combination is rejected |
| `--stage <path> [--apply]` | **insertion mode**: read + validate an agent-authored `draft_entry.json`, reject a duplicate `group_id` and a `builtin` `function_name` absent from `BUILTIN_CHECKS`, enforce `observed_count >= 1`; dry-run unless `--apply`. Cannot combine with `--fixed`/`--drift`/`--promote`/`--id`/`--reason` — insertion is its own transaction |

`--id` has three modes. As a **selector** (alone or with `--fixed`/`--drift`)
it overrides the signal filters and narrows the detected proposals to the
named rules. With **`--fixed --reason`** it is name-mode: it bypasses detection
and flips the named `wip` rows straight to `fixed` (classifier → `retired`),
recording `--reason` as the audit line. With **`--promote`** it bypasses
detection and flips the named rules to `permanent`. With no selectors at all,
every proposal across both detection signals is selected — always preview that
with `--dry-run` first.

## Output

The script's only stdout is one JSON summary:

| Field                     | Meaning                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `proposals`               | the changeset, grouped by transition (`wip_to_fixed`, `wip_to_fixed_by_name`, `drift_detected`, `promote_to_permanent`)             |
| `applied`                 | a registry write happened. `false` under `--dry-run`, when nothing was proposed, and when the fold was byte-identical (idempotent re-run) |
| `permanent_slice_changed` | core's `permanent_data.ts` differs from a fresh render — rewritten on a real `--promote`, reported-only under `--dry-run` (rendered from the would-be-promoted rules) |
| `missing_ids`             | `--id` values matching no proposal (selector mode) or no rule (`--promote` / name-mode `--fixed`)                                   |
| `rejected_promotions`     | `--promote` targets refused, with the reason (`classifier.kind` is `"none"` or `"retired"`, or already permanent)                   |
| `drift_unknown_rule_ids`  | published `rule_id`s with no registry rule — review signals, never writes                                                           |
| `skipped_sources`         | published files that failed to read or parse (e.g. a stale schema version) — reported, never fatal                                  |

Each auto-detected `wip_to_fixed` proposal carries `matched_subject` (the
newest matching commit) as its audit line; each name-mode
`wip_to_fixed_by_name` proposal carries `reason` (the supplied `--reason`
text) in its place, since no commit subject is cited. Each `drift_detected`
proposal carries `flagged_by`, the `{project, run_id}` provenance of every run
that flagged the rule.

## Cross-references

- Canonical writer matrix and lifecycle: `.claude/rules/classifier-lifecycle.md`
- Producer of `classifier_regressions[]`: `.claude/skills/triage/SKILL.md`
- The backlog-side analogue this skill mirrors: `.claude/skills/prioritize/SKILL.md` over `.claude/skills/plan/scripts/export_to_backlog.ts`
- The permanent-slice generator: `.claude/skills/triage/scripts/generate_permanent_data.ts`
