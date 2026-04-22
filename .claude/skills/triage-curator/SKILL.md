---
name: triage-curator
description: Offline sweep that QAs auto-classified false-positive groups and investigates residuals from completed self-repair-pipeline runs. Tags drifting classifiers, proposes new ones, re-investigates promoted groups whose QA found the classifier is mis-matching, drafts backlog tasks for signal gaps, and commits the result.
argument-hint: "[--project <name>] [--last <n>] [--run <path>] [--reinvestigate] [--dry-run] [--commit-to current|new|pr] [--branch <name>] [--pr <number>]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Bash(git *), Bash(gh *), AskUserQuestion, Read, Write, Edit, Glob, Task(triage-curator-qa, triage-curator-investigator), mcp__backlog__task_create, mcp__backlog__task_search
---

# Triage Curator

Offline sweep over `self-repair-pipeline` triage outputs. Two waves of
sub-agent work (QA, then Investigate), with a Promote pass between them
that re-routes any classifier QA judged mis-matching back through the
investigator. Finalize applies proposals; backlog captures signal gaps;
commit seals the sweep.

**Script invocation:** Always `node --import tsx`. Never `pnpm exec tsx`,
never `npx tsx`.

## Pipeline Overview

| #   | Step          | Actor                                           | Output                                                          |
| --- | ------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| 1   | Plan          | `scripts/curate_all.ts`                         | List of runs, per-run QA + residual-investigate dispatches      |
| 2   | QA            | `triage-curator-qa` (sonnet, 50 turns)          | One `QaResponse` per auto-classified group                      |
| 3   | Promote       | `scripts/promote_qa_to_investigate.ts`          | List of classifiers QA judged mis-matching, re-routed to step 4 |
| 4   | Investigate   | `triage-curator-investigator` (opus, 200 turns) | One `InvestigateResponse` + `<id>.session.json` per dispatch    |
| 4.5 | Author source | Main agent + `scripts/render_classifier.ts`     | One `check_<group_id>.ts` per builtin proposal                  |
| 5   | Finalize      | `scripts/curate_run.ts --phase finalize`        | Apply proposals, fold outcome into `state.json`, print summary  |
| 6   | Backlog       | `mcp__backlog__task_create`                     | One task per `backlog_tasks_to_create[]` entry                  |
| 7   | Commit        | `git` / `gh` via `AskUserQuestion`              | Committed sweep on current branch, a new branch, or an open PR  |

## Arguments

**User input:** `$ARGUMENTS`

| Flag                             | Effect                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--project <name>`               | Restrict to one project directory under `analysis_output`                                                   |
| `--last <n>`                     | Keep the most recent N runs after filtering                                                                 |
| `--run <path>`                   | Short-circuit discovery; curate a single `triage_results` JSON                                              |
| `--reinvestigate`                | Also resurface curated runs where a wip group has grown                                                     |
| `--dry-run`                      | Run QA + investigation but apply no writes and skip commit                                                  |
| `--commit-to <current\|new\|pr>` | Where to commit curation outputs. If omitted and not `--dry-run`, the main agent asks via `AskUserQuestion` |
| `--branch <name>`                | Branch name for `--commit-to new`                                                                           |
| `--pr <number>`                  | Existing PR number for `--commit-to pr`                                                                     |

The three commit flags are consumed by the orchestrator. Strip them from
`$ARGUMENTS` before forwarding the remainder to `curate_all.ts`.

## Flow

### Step 1 — Plan the sweep

Run the planner over the filtered argument list:

```bash
node --import tsx .claude/skills/triage-curator/scripts/curate_all.ts <FORWARDED_ARGS>
```

Checkpoint: capture the printed JSON as `PLAN`. It holds `runs[]`, each
with `qa_groups[]`, `investigate_groups[]`, `promote_cmd`, and
`finalize_cmd`. Each dispatch carries a `get_context_cmd` and pre-allocated
`output_path`.

### Step 2 — Dispatch the QA wave

For every run, fire one `Task(triage-curator-qa)` per entry in
`qa_groups[]`, in parallel:

> QA group `<group_id>` in run `<run_path>`. Write the `QaResponse` JSON to
> `<output_path>`. Return nothing inline.

Checkpoint: wait for all `Task()` calls to return before continuing.

### Step 3 — Promote mis-matching classifiers

Run the promoter per run, using the `promote_cmd` from `PLAN`:

```bash
node --import tsx .claude/skills/triage-curator/scripts/promote_qa_to_investigate.ts --run <run_path>
```

Checkpoint: capture the printed JSON as `PROMOTED`. Its `promoted_groups[]`
carries `output_path` and `get_context_cmd` with `--promoted` baked in.

### Step 4 — Dispatch the investigate wave

For every run, fire one `Task(triage-curator-investigator)` per entry in
the union of `investigate_groups[]` (from `PLAN`) and `promoted_groups[]`
(from `PROMOTED`):

> Investigate group `<group_id>` in run `<run_path>`. Hydrate with the
> command in `<get_context_cmd>`. Write the `InvestigateResponse` JSON to
> `<output_path>` and the session log to the sibling `<group_id>.session.json`.
> For any `kind: "builtin"` proposal, populate `classifier_spec` as
> structured data — never TypeScript. Return nothing inline.

Checkpoint: wait for all `Task()` calls to return before continuing.

### Step 4.5 — Author builtin classifier source

For every investigate response under `<run_id>/investigate/` and
`<run_id>/investigate_promoted/` whose `classifier_spec` is non-null,
render the classifier to TypeScript and write it to the pre-assigned
path. For each such response JSON at `<response_path>` with
`classifier_spec.function_name` set:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
TARGET="$REPO_ROOT/.claude/skills/self-repair-pipeline/src/auto_classify/builtins/check_<group_id>.ts"
node --import tsx .claude/skills/triage-curator/scripts/render_classifier.ts \
  --response <response_path> > "$TARGET"
```

Render errors (unknown op, missing spec) surface as non-zero exits —
re-read the response and halt Step 5 for that run if the renderer fails.

Build the authored-files map for finalize:

```json
{ "<group_id_1>": "/abs/path/to/check_<group_id_1>.ts", ... }
```

Write it to a temp file and pass it to Step 5 via `--authored-files`.

Checkpoint: every builtin investigate response has a corresponding
authored `.ts` file on disk, and the authored-files map is ready to
hand to `curate_run --phase finalize`.

### Step 5 — Finalize per run

For every run, invoke the `finalize_cmd` from `PLAN`, passing the
authored-files map from Step 4.5:

```bash
node --import tsx .claude/skills/triage-curator/scripts/curate_run.ts \
  --phase finalize --run <run_path> \
  --authored-files <path/to/authored-files.json> [--dry-run]
```

Checkpoint: capture each printed JSON as `FINALIZE[run_id]`. Aggregate
`authored_files`, `failed_authoring`, `spec_validation_failures`,
`backlog_tasks_to_create`, `failed_groups`, `session_response_mismatches`,
`skipped_permanent_upserts`, `promoted_reinvestigations` across all runs.

### Step 6 — Create backlog tasks

For every entry across all finalize summaries' `backlog_tasks_to_create[]`,
call `mcp__backlog__task_create` with the entry's `title` and
`description`.

Checkpoint: record each created task id alongside its triggering group.

### Step 7 — Commit the sweep

Skip this step when `--dry-run` was set or when no files were written
across all runs.

Resolve `--commit-to` — if absent, ask:

```
AskUserQuestion({
  question: "Where should I commit the curation changes?",
  options: [
    { label: "Current branch",        value: "current" },
    { label: "New branch (ask name)", value: "new" },
    { label: "Push to existing PR",   value: "pr" },
    { label: "Skip commit",           value: "skip" },
  ],
})
```

For `new` and `pr`, ask a follow-up `AskUserQuestion` for the branch name
or PR number. Then run one of:

```bash
# current
git add <PATHS>
git commit -m "$(cat <<'EOF'
<MESSAGE>
EOF
)"

# new
git checkout -b <BRANCH>
git add <PATHS>
git commit -m "$(cat <<'EOF'
<MESSAGE>
EOF
)"
git push -u origin <BRANCH>

# pr — switches branches; resolve uncommitted work in the current worktree first
BR=$(gh pr view <N> --json headRefName -q .headRefName)
git fetch origin "$BR"
git checkout "$BR"
git add <PATHS>
git commit -m "$(cat <<'EOF'
<MESSAGE>
EOF
)"
git push origin "$BR"
```

`<PATHS>` is the union of every `authored_files` entry across all
finalize summaries plus the registry file (`state.json` under
`~/.ariadne/` is never staged). `<MESSAGE>` follows the format:

```
triage-curator: <run_count> runs curated, <classifiers_added> classifiers, <signal_tasks> signal tasks

Projects: <proj1>, <proj2>
Runs:
  - <run_id_1>
  - <run_id_2>
New classifiers:
  - <group_id_1> (builtin: check_<id>.ts)
  - <group_id_2> (predicate)
Drift tagged: <group_id_x>
Missing-signal tasks queued: <n>
Failed groups: <n>
  - <group_id_a> (<category>): <details>
Failed authoring: <n>
  - <group_id_b>: <reason>
Spec validation failures: <n>
  - <group_id_c>: <reason>
```

Omit `Failed authoring:` when `failed_authoring` is empty across all
finalize summaries. Likewise omit `Spec validation failures:` when
`spec_validation_failures` is empty.

Checkpoint: confirm the commit landed on the expected ref.

## Reference

### State

- **Input:** `~/.ariadne/self-repair-pipeline/analysis_output/{project}/triage_results/{iso}.json`
- **Working dir:** `~/.ariadne/triage-curator/runs/{run_id}/{qa|investigate|investigate_promoted}/{group_id}.json`
- **Session logs:** `~/.ariadne/triage-curator/runs/{run_id}/{investigate|investigate_promoted}/{group_id}.session.json`
- **Rollup:** `~/.ariadne/triage-curator/state.json`
- **Registry writes:** `.claude/skills/self-repair-pipeline/known_issues/registry.json`
  (only when not in dry-run; drift tags + classifier upserts)

### Drift vs promotion — two thresholds, two denominators

Both thresholds consume the same QA `outliers[]` list but answer different
questions.

- **`DRIFT_OUTLIER_RATE_THRESHOLD = 0.15`** — denominator is group-size.
  Tags the registry entry as `drift_detected: true`. Sticky: the curator
  never clears it. A human (or follow-up task) resets it after fixing the
  classifier.
- **`PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD = 0.40`** — denominator is
  sample-size (≤ 10). Triggers an immediate re-investigation of the
  classifier in step 4. Complementary to drift, not redundant: drift flags
  _the existence_ of a problem; promotion acts on it.
- `PROMOTE_MIN_SAMPLE_SIZE = 4` guards against noisy small samples.
- Registry entries with `status: "permanent"` are never promoted —
  promotion attempts route to a human-authored backlog task instead.

### Write scope

The investigator never writes to the source tree — it emits structured
proposals only. Two actors handle writes:

- **Main agent (Step 4.5)** renders each builtin `classifier_spec` to
  `src/auto_classify/builtins/check_<group_id>.ts` via
  `render_classifier.ts`. The filename is derived deterministically from
  `group_id`; there is no way for two investigators to collide.
- **Dispatcher (`curate_run --phase finalize`)** AST-parses each
  authored file, upserts the registry entry for every proposal whose
  classifier file passed, and flips drift tags. Failures become
  `failed_authoring[]` entries and block the corresponding registry
  upsert.

Registry files written: `known_issues/registry.json` (upserts + drift
tags). Classifier files written: `src/auto_classify/builtins/check_<group_id>.ts`.
No other paths are ever written during the sweep.

### Session log statuses

Every investigator dispatch emits `<group_id>.session.json` alongside its
response. Finalize folds the statuses into the summary and the commit
message.

- **`success`** — valid classifier (`kind: "predicate"` or `"builtin"`).
- **`blocked_missing_signal`** — `kind: "none"` plus non-empty
  `new_signals_needed` plus a `backlog_ref`. Legitimate outcome when the
  signal library cannot express the pattern.
- **`failure`** — structural block: incoherent group, infeasible pattern,
  permanent lock, registry conflict. Carries `failure_category` and
  `failure_details`; surfaced in the commit message.
