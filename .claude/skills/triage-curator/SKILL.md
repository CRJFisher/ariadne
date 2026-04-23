---
name: triage-curator
description: Offline sweep that QAs auto-classified false-positive groups and investigates residuals from completed self-repair-pipeline runs. Tags drifting classifiers, proposes new ones, re-investigates classifiers QA found mis-matching, drafts backlog tasks for signal gaps, and commits the result.
argument-hint: "[--project <name>] [--last <n>] [--run <path>] [--dry-run] [--commit-to current|new|pr] [--branch <name>] [--pr <number>]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Bash(git *), Bash(gh *), AskUserQuestion, Read, Write, Edit, Glob, Task(triage-curator-qa, triage-curator-investigator), mcp__backlog__task_create, mcp__backlog__task_search
---

# Triage Curator

Offline sweep over `self-repair-pipeline` triage outputs. Two sub-agent
waves (QA, then Investigate); the puller folds QA-broken classifiers into
the investigate wave automatically. Finalize applies proposals; backlog
captures signal gaps; commit seals the sweep.

**Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`
or `npx tsx`.

## Pipeline Overview

| #   | Step          | Actor                                                          | Output                                                       |
| --- | ------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Plan          | `scripts/curate_all.ts`                                        | List of runs with QA + residual-investigate dispatches       |
| 2   | QA            | `triage-curator-qa` (sonnet, 50 turns)                         | One `QaResponse` per auto-classified group                   |
| 3   | Investigate   | `triage-curator-investigator` (opus, 200 turns, ≤5 concurrent) | One `InvestigateResponse` + `<id>.session.json` per dispatch |
| 3.5 | Validate      | `scripts/validate_responses.ts`                                | `<run>/validation.json`; non-zero exit on any issue          |
| 4   | Author source | Main agent + `scripts/render_classifier.ts`                    | One `check_<target>.ts` per builtin proposal                 |
| 5   | Finalize      | `scripts/finalize_run.ts`                                      | Apply proposals, write `finalized.json`, print summary       |
| 6   | Backlog       | `mcp__backlog__task_create`                                    | One task per `backlog_tasks_to_create[]` entry               |
| 7   | Commit        | `git` / `gh` via `AskUserQuestion`                             | Committed sweep on current branch, a new branch, or a PR     |

## Arguments

**User input:** `$ARGUMENTS`

| Flag                             | Effect                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--project <name>`               | Restrict to one project directory under `analysis_output`                                                   |
| `--last <n>`                     | Keep the most recent N runs after filtering                                                                 |
| `--run <path>`                   | Short-circuit discovery; curate a single `triage_results` JSON                                              |
| `--dry-run`                      | Run QA + investigation but apply no writes and skip commit                                                  |
| `--commit-to <current\|new\|pr>` | Where to commit curation outputs. If omitted and not `--dry-run`, the main agent asks via `AskUserQuestion` |
| `--branch <name>`                | Branch name for `--commit-to new`                                                                           |
| `--pr <number>`                  | Existing PR number for `--commit-to pr`                                                                     |

The three commit flags are consumed by the orchestrator. Strip them from
`$ARGUMENTS` before forwarding the remainder to `curate_all.ts`.

## Flow

### Step 1 — Plan the sweep

```bash
node --import tsx .claude/skills/triage-curator/scripts/curate_all.ts <FORWARDED_ARGS>
```

Capture the printed JSON as `PLAN`. It holds `runs[]`, each with
`run_path`, `qa_groups[]`, `investigate_groups[]`, `validate_cmd`, and
`finalize_cmd`. Each dispatch carries a `get_context_cmd` and
pre-allocated `output_path`.

### Step 2 — Dispatch the QA wave

For every run, fire one `Task(triage-curator-qa)` per entry in
`qa_groups[]`, in parallel:

> QA group `<group_id>` in run `<run_path>`. Write the `QaResponse` JSON to
> `<output_path>`. Return nothing inline.

Wait for all `Task()` calls to return before continuing.

### Step 3 — Dispatch the investigate wave

The investigator is opus/200-turn, so cap concurrency at
`MAX_CONCURRENT_INVESTIGATORS = 5` and drain the queue in waves using
the puller — which internally folds in any QA-broken classifier that
needs re-investigation (sample outlier rate ≥ 0.40, not `permanent`).

**1. Write the residual dispatch list.** Flatten every entry in
`PLAN.runs[*].investigate_groups[]` into a single array — these are the
groups without a registry entry. Tag each with the `run_path` it came
from:

```json
{
  "run_path": "...",
  "group_id": "...",
  "output_path": "...",
  "get_context_cmd": "..."
}
```

Using the `Write` tool, persist to a temp file as `$DISPATCH_LIST`
(e.g. `/tmp/curator-dispatch-<stamp>.json`).

**2. Pull-and-dispatch loop.** Until `pending[]` is empty:

```bash
node --import tsx .claude/skills/triage-curator/scripts/next_investigate_tasks.ts \
  --dispatch-list "$DISPATCH_LIST" --limit 5
```

The puller reads residuals from the list, inspects each run's `qa/` dir
to compute promotions on the fly, merges, filters done, and prints:

```json
{ "pending": [ /* ≤5 entries */ ], "remaining": <total_not_done> }
```

A dispatch is "done" when its `output_path` exists and parses as JSON.

For each entry in `pending[]`, fire one `Task(triage-curator-investigator)`
in a single message so the wave runs in parallel:

> Investigate group `<group_id>` in run `<run_path>`. Hydrate with the
> command in `<get_context_cmd>`. Write the `InvestigateResponse` JSON to
> `<output_path>` and the session log to the sibling `<group_id>.session.json`.
> For any `kind: "builtin"` proposal, populate `classifier_spec` as
> structured data — never TypeScript. Return nothing inline.

Wait for every `Task()` in the wave to return before calling the puller
again. Exit the loop when `pending[]` is empty.

### Step 3.5 — Validate investigator responses

Every response must pass the validator before anything is rendered. Use
each run's `validate_cmd` from `PLAN`:

```bash
node --import tsx .claude/skills/triage-curator/scripts/validate_responses.ts --run <run_path>
```

The validator walks `<run>/investigate/`, parses each response against
the shape schema, and checks:

- Unknown SignalCheck ops, malformed proposal shape.
- `response.group_id` matches the dispatch id derived from the filename.
- `retargets_to`, when set, names an existing registry entry.
- When retargeting, `positive_examples` and `negative_examples` are empty.
- `positive_examples` / `negative_examples` indices are in-range.
- `kind: "none"` carries either `new_signals_needed[]` or a session log
  with `failure_category` set (no silent dead-ends).
- No two responses target the same classifier file.

Output: `<run>/validation.json` with `{ ok: boolean, issues: [...] }`.
Non-zero exit when any issue is present.

When `ok === false`, halt. Read each issue, decide which investigators
to re-dispatch with corrections, re-run those `Task()` calls, then
re-invoke the validator.

### Step 4 — Author builtin classifier source

For every validated investigate response with a non-null `classifier_spec`,
render it to TypeScript. The renderer derives the filename from
`response.retargets_to ?? response.group_id`, so the main agent does not
compose paths by hand:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
BUILTINS_DIR="$REPO_ROOT/.claude/skills/self-repair-pipeline/src/auto_classify/builtins"
node --import tsx .claude/skills/triage-curator/scripts/render_classifier.ts \
  --response <response_path> --out "$BUILTINS_DIR"
```

The script prints the absolute target path on stdout. On failure it exits
non-zero and does NOT create the file.

Build the authored-files map keyed by `response.retargets_to ?? response.group_id`
(values are the stdout paths from render_classifier), persist via `Write`,
and pass it to Step 5 via `--authored-files`.

### Step 5 — Finalize per run

Invoke the `finalize_cmd` from `PLAN` with the authored-files map:

```bash
<finalize_cmd> --authored-files <path/to/authored-files.json>
```

Finalize handles several housekeeping steps:

- **Language derivation:** new `wip` entries get `languages` from declared
  `language_eq` checks, otherwise from source-group file extensions. No
  derivable language → `failed_authoring[]`.
- **Orphan cleanup:** paths in the authored-files map not landing as an
  accepted upsert are `unlink`'d and logged to `deleted_orphan_files[]`.
- **Derived markdown:** when the registry mutates, the four
  `unsupported_features.<lang>.md` golden files are re-rendered and
  added to `authored_files[]`.
- **Sentinel:** writes `runs/<id>/finalized.json` so future sweeps skip
  this run.

Capture each printed JSON as `FINALIZE[run_id]`. Aggregate `authored_files`,
`deleted_orphan_files`, `failed_authoring`, `backlog_tasks_to_create`,
`failed_groups`, `skipped_permanent_upserts` across runs.

### Step 6 — Create backlog tasks

For every entry across all finalize summaries' `backlog_tasks_to_create[]`,
call `mcp__backlog__task_create` with the entry's `title` and
`description`. Record each created task id alongside its triggering group.

### Step 7 — Commit the sweep

Skip when `--dry-run` was set or no files were written across all runs.

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
or PR number.

| target    | Prepare                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `current` | (no prep)                                                                                                                                   |
| `new`     | `git checkout -b <BRANCH>` before commit; `git push -u origin <BRANCH>` after                                                               |
| `pr`      | `BR=$(gh pr view <N> --json headRefName -q .headRefName); git fetch origin "$BR"; git checkout "$BR"` before; `git push origin "$BR"` after |

Then:

```bash
git add <PATHS>
git commit -m "$(cat <<'EOF'
<MESSAGE>
EOF
)"
```

`<PATHS>` is the union of every `authored_files` entry across all
finalize summaries plus the registry file (`~/.ariadne/` is never staged).
`<MESSAGE>` format:

```
triage-curator: <run_count> runs curated, <classifiers_added> classifiers, <signal_tasks> signal tasks

Projects: <proj1>, <proj2>
Runs:
  - <run_id_1>
New classifiers:
  - <group_id> (builtin: check_<id>.ts)
Drift tagged: <group_id_x>
Missing-signal tasks queued: <n>
Failed groups: <n>
  - <group_id> (<category>): <details>
Failed authoring: <n>        # omit when empty
  - <group_id>: <reason>
```

Confirm the commit landed on the expected ref.

## Reference

### State

- **Input:** `~/.ariadne/self-repair-pipeline/analysis_output/{project}/triage_results/{iso}.json`
- **Working dir:** `~/.ariadne/triage-curator/runs/{run_id}/{qa|investigate}/{group_id}.json`
- **Session logs:** `~/.ariadne/triage-curator/runs/{run_id}/investigate/{group_id}.session.json`
- **Sentinel:** `~/.ariadne/triage-curator/runs/{run_id}/finalized.json` (presence → run is curated)
- **Registry writes:** `.claude/skills/self-repair-pipeline/known_issues/registry.json`
  (only when not `--dry-run`; drift tags + classifier upserts)

### Drift vs promotion — two thresholds, two denominators

Both consume the same QA `outliers[]` list but answer different questions.

- **`DRIFT_OUTLIER_RATE_THRESHOLD = 0.15`** — denominator is full group size.
  Tags the registry entry as `drift_detected: true`. Sticky: the curator
  never clears it. A human (or follow-up task) resets after fixing the
  classifier.
- **`PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD = 0.40`** — denominator is
  QA sample size (≤ 10). Triggers re-investigation inside the puller.
- **`PROMOTE_MIN_SAMPLE_SIZE = 4`** guards against noisy small samples.
- `status: "permanent"` entries are never promoted — promotion attempts
  route to a human-authored backlog task instead.

### Session log statuses

Every investigator dispatch emits `<group_id>.session.json` alongside its
response. Finalize folds the statuses into the summary and commit message.

- **`success`** — valid classifier (`kind: "builtin"`).
- **`blocked_missing_signal`** — `kind: "none"` plus non-empty
  `new_signals_needed` plus a `backlog_ref`. Legitimate outcome when the
  signal library cannot express the pattern.
- **`failure`** — structural block: incoherent group, infeasible pattern,
  permanent lock, registry conflict. Carries `failure_category` and
  `failure_details`; surfaced in the commit message.
