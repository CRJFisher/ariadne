---
name: triage-curator
description: Offline sweep that QAs auto-classified false-positive groups and investigates residuals from completed self-repair-pipeline runs. Tags drifting classifiers, proposes new ones, and drafts backlog tasks for pattern detection gaps.
argument-hint: "[--project <name>] [--last <n>] [--run <path>] [--reinvestigate] [--dry-run]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Read, Write, Glob, Task(triage-curator-qa, triage-curator-investigator), mcp__backlog__task_create, mcp__backlog__task_search
---

# Triage Curator

Periodic maintenance sweep over `self-repair-pipeline` triage outputs. For
every un-curated run, every false-positive group is either **QA'd** (already
auto-classified, sonnet samples ~10 members and flags outliers) or
**investigated** (residual, opus proposes a new classifier + backlog task).
The main agent sees only pointers; sub-agents hydrate their own context.

**Script invocation:** Always `node --import tsx`. Never `pnpm exec tsx` or
`npx tsx`.

## Pipeline Overview

| Phase          | Script / Agent                            | Purpose                                                         |
| -------------- | ----------------------------------------- | --------------------------------------------------------------- |
| 1. Plan        | `scripts/curate_all.ts`                   | List un-curated runs and the group dispatches for each          |
| 2. QA          | `triage-curator-qa` (sonnet, 50 turns)    | Sample ~10 members per auto-classified group, flag outliers     |
| 3. Investigate | `triage-curator-investigator` (opus, 200) | For each residual group, propose classifier + backlog + signals |
| 4. Finalize    | `scripts/curate_run.ts --phase finalize`  | Apply proposals (or dry-run), fold outcome into state           |

## Arguments

**User input:** `$ARGUMENTS`

| Flag               | Effect                                                         |
| ------------------ | -------------------------------------------------------------- |
| `--project <name>` | Restrict to one project directory under `analysis_output`      |
| `--last <n>`       | Keep the most recent N runs after filtering                    |
| `--run <path>`     | Short-circuit discovery; curate a single `triage_results` JSON |
| `--reinvestigate`  | Also resurface curated runs where a wip group has grown        |
| `--dry-run`        | Run QA + investigation but apply no writes                     |

## Orchestration

1. **Plan the sweep.** Run:

   ```bash
   node --import tsx .claude/skills/triage-curator/scripts/curate_all.ts $ARGUMENTS
   ```

   The script prints a JSON plan: one `runs[]` entry per un-curated run,
   each carrying `qa_groups[]` and `investigate_groups[]`. Every dispatch
   has a pre-allocated `output_path` and a `get_context_cmd` the sub-agent
   will run to hydrate its context.

2. **Dispatch sub-agents.** For each run, for each group, fire a `Task` in
   parallel (up to a reasonable batch — the main agent has no context to
   hold). Each Task prompt is ~3 lines:

   For an auto-classified group:

   > QA group `<group_id>` in run `<run_path>`. Write the QaResponse JSON
   > to `<output_path>`. Return nothing inline.

   Use `subagent_type: triage-curator-qa`.

   For a residual group:

   > Investigate residual group `<group_id>` in run `<run_path>`. Write
   > the InvestigateResponse JSON to `<output_path>`. Return nothing
   > inline.

   Use `subagent_type: triage-curator-investigator`.

3. **Finalize per run.** After all sub-agents for a given run have
   completed, invoke:

   ```bash
   node --import tsx .claude/skills/triage-curator/scripts/curate_run.ts \
     --phase finalize --run <run_path> [--dry-run]
   ```

   The dispatcher reads every JSON under
   `~/.ariadne/triage-curator/runs/<run_id>/{qa,investigate}/`, validates
   each response, tags drift on groups whose outlier rate ≥ 15%, upserts
   proposed classifiers into the registry, writes any allowed
   `code_changes`, and folds the outcome into `state.json`. In `--dry-run`
   no files are written; the printed summary describes what _would_ have
   happened.

4. **Create backlog tasks.** The finalize summary lists
   `backlog_tasks_to_create[]`. When not in dry-run, call
   `mcp__backlog__task_create` once per entry.

## State

- **Input:** `~/.ariadne/self-repair-pipeline/analysis_output/{project}/triage_results/{iso}.json`
- **Working dir:** `~/.ariadne/triage-curator/runs/{run_id}/{qa|investigate}/{group_id}.json`
- **Rollup:** `~/.ariadne/triage-curator/state.json`
- **Registry writes:** `.claude/skills/self-repair-pipeline/known_issues/registry.json`
  (only when not in dry-run; drift tags + classifier upserts)

## Drift tagging

Drift is detected at QA time: if a sampled classifier has outlier rate
≥ 15 %, the finalize dispatcher sets `drift_detected: true` on that
registry entry. **The tag is sticky.** The curator never clears it — the
registry entry is trusted again only when a human or a follow-up task
fixes the classifier and resets `drift_detected` by hand (or omits the
field entirely on the next write). A clean follow-up QA does not reset
the tag; it only refuses to set a new one.

## Write scope

The investigator proposes; it does not write. The dispatcher
(`curate_run --phase finalize`) is the sole writer and enforces an
allowlist:

- `known_issues/registry.json` — upserts and drift tags
- `src/auto_classify/builtins/` — new builtin classifier files
- `.claude/skills/triage-curator/reference/` — signal-inventory updates

Any `code_changes.path` outside these roots is dropped with a
`skipped_code_changes[]` entry in the summary.
