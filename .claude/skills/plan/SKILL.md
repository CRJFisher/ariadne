---
name: plan
description: Offline sweep that consumes the triage skill's v5 triage results, dispatches an investigator wave to author classifier and root-cause proposals for each novel issue, and emits those proposals plus an on-demand impact report. Planning-only — the deferred actuator applies proposals to the registry.
argument-hint: "[--project <name>] [--last <n>] [--run <path>]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read, Write, Glob, Task(plan-strategist), mcp__backlog__task_search
---

# Plan

Offline sweep over `triage` outputs. One sub-agent wave: investigators author
classifier and root-cause proposals for the novel issues the per-entry triage
already named. The sweep is **planning-only** — it reads the registry and emits
proposals; the deferred actuator applies them.

The sweep reads `analysis_output/<project>/triage_results/<run-id>.json` (schema v5, defined by `@ariadnejs/skill-protocol` — includes `project_path`, `commit_hash`, `novel_issues[]`, `classifier_regressions[]`, `confirmed_unreachable[]`, `uncertain[]`). The `<run-id>` is the same identifier the triage skill emits (`<short-commit>-<iso-ts>`): run-id is the shared identifier across the two skills.

**Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`
or `npx tsx`.

## Pipeline Overview

| #   | Step        | Actor                                                          | Output                                                                                                                                                  |
| --- | ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Plan        | `scripts/curate_all.ts`                                        | List of runs with promote-novel investigate dispatches                                                                                                  |
| 2   | Investigate | `plan-strategist` (opus, 200 turns, ≤5 concurrent) | One validated `InvestigateResponse` + `<id>.session.json` per dispatch. The investigator self-validates via `scripts/validate_responses.ts --response`. |

Applying proposals to the registry and the bundled core slice, and committing
the result, belong to the deferred actuator. See
`.claude/rules/classifier-lifecycle.md` for the write-boundary contract.

## Arguments

**User input:** `$ARGUMENTS`

| Flag                             | Effect                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--project <name>`               | Restrict to one project directory under `analysis_output`                                                   |
| `--last <n>`                     | Keep the most recent N runs after filtering                                                                 |
| `--run <path>`                   | Short-circuit discovery; sweep a single `triage_results` JSON                                              |

## Flow

### Step 1 — Plan the sweep

```bash
node --import tsx .claude/skills/plan/scripts/curate_all.ts <FORWARDED_ARGS>
```

Capture the printed JSON as `PLAN`. It holds `runs[]`, each with
`run_path`, `novel_promote_dispatches[]`,
`already_registered_novel_issues[]`, and
`fixed_novel_issue_resurfacings[]`. Promote-novel dispatches carry a
`get_context_cmd` and pre-allocated `output_path`; already-registered novel
issues are surfaced as observed-stat bumps for the actuator (no dispatch);
fixed resurfacings are surfaced for human review (the reconciler is the only
authorized `fixed` writer).

### Step 2 — Dispatch the investigate wave

The investigator is opus/200-turn, so cap concurrency at
`MAX_CONCURRENT_INVESTIGATORS = 5` and drain the queue in waves using
the puller.

**1. Write the dispatch list.** Concatenate every entry in
`PLAN.runs[*].novel_promote_dispatches[]` into a single array. Each entry
already carries `run_path`, `novel_issue_id`, `output_path`, and
`get_context_cmd` — the producer's shape matches the puller's
`DispatchEntry` directly. Persist via the `Write` tool to a temp file as
`$DISPATCH_LIST` (e.g. `/tmp/plan-dispatch-<stamp>.json`).

**2. Pull-and-dispatch loop.** Until `pending[]` is empty:

```bash
node --import tsx .claude/skills/plan/scripts/next_investigate_tasks.ts \
  --dispatch-list "$DISPATCH_LIST" --limit 5
```

The puller dedupes by `output_path`, filters done dispatches, and prints:

```json
{ "pending": [ /* ≤5 entries */ ], "remaining": <total_not_done> }
```

A dispatch is "done" when its `output_path` exists and parses as JSON.

For each entry in `pending[]`, fire one `Task(plan-strategist)`
in a single message so the wave runs in parallel:

> Investigate novel issue `<novel_issue_id>` in run `<run_path>`. Hydrate with
> the command in `<get_context_cmd>`. Run the validator
> (`scripts/validate_responses.ts --response <output_path> --run <run_path>`)
> against your draft until it returns clean before writing the final
> `InvestigateResponse` JSON to `<output_path>` and the session log to the
> sibling `<novel_issue_id>.session.json`. Citations the classifier cannot fit
> go into `rejected_members` rather than weakening the spec. For any
> `kind: "builtin"` proposal, populate `classifier_spec` as structured
> data — never TypeScript. Return nothing inline.

Wait for every `Task()` in the wave to return before calling the puller
again. Exit the loop when `pending[]` is empty.

Each investigator self-validates inside its own loop using
`scripts/validate_responses.ts --response <path> --run <run_path>`.
Cross-response coherence (two responses targeting the same classifier
file) is checked by `validate_run_coherence` before the actuator applies
any registry mutation.

## Impact reporting (on demand)

Generate a human-readable ranking of the known-issues registry by observed
impact. Not part of the main sweep — invoked separately when the user wants a
snapshot.

```bash
node --import tsx .claude/skills/plan/scripts/generate_impact_report.ts \
  [--top-n 20] [--prior <json>] [--out <md>] [--snapshot <json>]
```

The report prints to stdout and optionally to `--out`. Pass `--snapshot` to
write the current `{ [group_id]: observed_count }` map, and pass the previous
run's snapshot as `--prior` to highlight groups that first appeared since then.

The report has four sections: top N by `observed_count`, per-language breakdown,
per-project breakdown, and "new since prior snapshot". Every registry entry
carries its accumulated `observed_count`, `observed_projects`, and
`last_seen_run`. The report prints to stdout (and `--out`) for the user to read;
the pipeline never writes it into `backlog/`.

## Rendering task content for the task-DB

Registry entries minted by the novel-group scanner, or seeded `wip` entries that
carry no linked task, need task content rendered for the plan engine's task-DB
at `~/.ariadne/plan/` — firewalled from the user's `backlog/`. The pure
row-builders in `src/propose/render_task.ts` (`render_task_title`,
`render_task_body`, `render_task_labels`) turn a registry entry into that
content. The plan engine (TASK-190.22.10) renders these into `PlanTask` records;
the user-invoked export adapter (TASK-190.22.11) reuses the same builders when
promoting a DB task into `backlog/`. The sweep itself writes nothing to
`backlog/`. The full write-boundary contract — and the structural test that
enforces it — is `.claude/rules/backlog-firewall.md`.

## Classifier lifecycle (write boundaries)

`plan` never writes the registry. The actuator (deferred) is the single
autonomous writer for every `wip` transition — minting, drift tagging, and
observed-stat bookkeeping — applying the proposals this sweep emits. `wip →
permanent` is the manual promotion transition; `wip → fixed` is owned by the
fix-sequencer reconciler (TASK-190.18.3). See
`.claude/rules/classifier-lifecycle.md` for the canonical writer matrix.

## Reference

### State

`triage-entrypoints` and `triage-curator` are fixed on-disk storage namespaces, independent of the skill names. They are distinct from `~/.ariadne/plan/`, which holds the plan engine's task-DB (defined in `@ariadnejs/skill-protocol`).

- **Input:** `~/.ariadne/triage-entrypoints/analysis_output/{project}/triage_results/{iso}.json`
- **Working dir:** `~/.ariadne/triage-curator/runs/{run_id}/investigate/{novel_issue_id}.json`
- **Session logs:** `~/.ariadne/triage-curator/runs/{run_id}/investigate/{novel_issue_id}.session.json`
- **Registry (read-only):** `.claude/skills/triage/known_issues/registry.json`

### Drift signals

`KnownIssue.drift_evidence[]` accumulates per-entry
`fp-classifier-regression` verdicts emitted by the triage-investigator the
moment it spots an entry the classifier *should* have caught. Surfaced via
the run's `classifier_regressions[]` aggregate; the actuator converts that
slice to evidence rows.

`status: "permanent"` rows are never drift-tagged automatically.

### Session log statuses

Every investigator dispatch emits `<novel_issue_id>.session.json` alongside
its response.

- **`success`** — valid classifier (`kind: "builtin"`), paired with a
  required `ariadne_bug` (new task or `existing_task_id`).
- **`blocked_missing_signal`** — `kind: "none"` plus `signal_library_gap`
  populated. Legitimate outcome when the signal library cannot express
  the pattern. `ariadne_bug` may still be populated to name the
  underlying resolver deficiency.
- **`failure`** — structural block: incoherent group, infeasible pattern,
  permanent lock, registry conflict. Carries `failure_category` and
  `failure_details`.
