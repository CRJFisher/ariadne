---
name: triage-curator
description: Offline sweep that QAs auto-classified false-positive groups and investigates residuals from completed self-repair-pipeline runs. Tags drifting classifiers, proposes new ones, re-investigates promoted groups whose QA found the classifier is mis-matching, drafts backlog tasks for signal gaps, and commits the result.
argument-hint: "[--project <name>] [--last <n>] [--run <path>] [--reinvestigate] [--dry-run] [--reaggregate-on-incoherent] [--commit-to current|new|pr] [--branch <name>] [--pr <number>]"
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

| #    | Step          | Actor                                                          | Output                                                          |
| ---- | ------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | Plan          | `scripts/curate_all.ts`                                        | List of runs, per-run QA + residual-investigate dispatches      |
| 2    | QA            | `triage-curator-qa` (sonnet, 50 turns)                         | One `QaResponse` per auto-classified group                      |
| 3    | Promote       | `scripts/promote_qa_to_investigate.ts`                         | List of classifiers QA judged mis-matching, re-routed to step 4 |
| 4    | Investigate   | `triage-curator-investigator` (opus, 200 turns, ≤5 concurrent) | One `InvestigateResponse` + `<id>.session.json` per dispatch    |
| 4.25 | Validate      | `scripts/validate_responses.ts`                                | `<run>/validation.json`; non-zero exit on any issue             |
| 4.5  | Author source | Main agent + `scripts/render_classifier.ts`                    | One `check_<target_group_id>.ts` per builtin proposal           |
| 5    | Finalize      | `scripts/curate_run.ts --phase finalize`                       | Apply proposals, fold outcome into `state.json`, print summary  |
| 6    | Backlog       | `mcp__backlog__task_create`                                    | One task per `backlog_tasks_to_create[]` entry                  |
| 7    | Commit        | `git` / `gh` via `AskUserQuestion`                             | Committed sweep on current branch, a new branch, or an open PR  |

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
| `--reaggregate-on-incoherent`    | When any session log ends in `failure_category: "group_incoherent"`, write `<run>/reaggregate_queue.json`   |

The three commit flags are consumed by the orchestrator. Strip them from
`$ARGUMENTS` before forwarding the remainder to `curate_all.ts`.

## Flow

### Step 1 — Plan the sweep

Run the planner over the filtered argument list:

```bash
node --import tsx .claude/skills/triage-curator/scripts/curate_all.ts <FORWARDED_ARGS>
```

Checkpoint: capture the printed JSON as `PLAN`. It holds `runs[]`, each
with `run_path` (the triage_results JSON path), `qa_groups[]`,
`investigate_groups[]`, `promote_cmd`, `validate_cmd`, and `finalize_cmd`.
Each dispatch carries a `get_context_cmd` and pre-allocated `output_path`.

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

The investigator is an opus/200-turn sub-agent, so a large sweep can
spawn too many concurrent instances. Cap concurrency at
`MAX_CONCURRENT_INVESTIGATORS = 5` and drain the queue in waves, pulling
the next batch from a helper script that derives state from disk.

**1. Build the combined dispatch list.** Flatten every entry in
`PLAN.runs[*].investigate_groups[]` and every entry in each run's
`PROMOTED.promoted_groups[]` (there is one `PROMOTED` output per run)
into a single array. Tag each entry with the `run_path` of the run it
came from — the same `PLAN.runs[i].run_path` value (the triage_results
JSON path). Each entry carries exactly these four fields:

```json
{
  "run_path": "<PLAN.runs[i].run_path>",
  "group_id": "<entry.group_id>",
  "output_path": "<entry.output_path>",
  "get_context_cmd": "<entry.get_context_cmd>"
}
```

Using the `Write` tool, persist the JSON array to a temp file and
capture the path as `$DISPATCH_LIST`, e.g.
`/tmp/curator-dispatch-<run_stamp>.json`.

**2. Pull-and-dispatch loop.** Until the puller returns an empty
`pending[]`:

```bash
node --import tsx .claude/skills/triage-curator/scripts/next_investigate_tasks.ts \
  --dispatch-list "$DISPATCH_LIST" --limit 5
```

The puller considers a dispatch done when its pre-allocated `output_path`
exists and parses as JSON — the same convention finalize uses. It
prints:

```json
{ "pending": [ { …up to 5 entries… } ], "remaining": <total_not_done> }
```

For each entry in `pending[]`, fire one `Task(triage-curator-investigator)`
in a single message so the wave runs in parallel:

> Investigate group `<group_id>` in run `<run_path>`. Hydrate with the
> command in `<get_context_cmd>`. Write the `InvestigateResponse` JSON to
> `<output_path>` and the session log to the sibling `<group_id>.session.json`.
> For any `kind: "builtin"` proposal, populate `classifier_spec` as
> structured data — never TypeScript. Return nothing inline.

Wait for every `Task()` in the wave to return before calling the puller
again. Each completed task writes its response file, so the next puller
call naturally excludes it.

Exit the loop when `pending[]` is empty.

Checkpoint: puller returns `{ "pending": [], "remaining": 0 }`, and every
combined-list entry has a response file on disk. Proceed to Step 4.25.

### Step 4.25 — Validate investigator responses

Every response must pass a schema + semantic validator before any file is
rendered. Use each run's `validate_cmd` from `PLAN`:

```bash
node --import tsx .claude/skills/triage-curator/scripts/validate_responses.ts --run <run_path>
```

The script walks `<run>/investigate/` and `<run>/investigate_promoted/`,
parses each response, and runs:

- Shape parse (unknown SignalCheck op, bad combinator, malformed proposal).
- `group_id` must equal the dispatch id derived from the filename.
- `retargets_to`, when set, must name an existing registry `group_id`.
- When retargeting, `positive_examples` and `negative_examples` must be
  empty.
- `positive_examples` / `negative_examples` indices must be in-range
  against the source group's entries.
- `kind: "none"` must carry either `new_signals_needed[]` or a session log
  with `failure_category` set.

Output: `<run>/validation.json` with `{ ok: boolean, issues: [...] }`.
Non-zero exit when any issue is present.

Checkpoint: when `ok === false`, halt. Read each issue, decide which
investigators to re-dispatch with corrections, re-run those `Task()` calls,
then re-invoke the validator. Do not proceed to Step 4.5 until validation
passes cleanly — rendering a broken response pollutes the working tree and
wastes finalize cycles.

### Step 4.5 — Author builtin classifier source

For every validated investigate response with a non-null `classifier_spec`,
render the classifier to TypeScript. The renderer derives the filename
itself from `response.retargets_to ?? response.group_id`, so the main
agent does not compose paths by hand:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
BUILTINS_DIR="$REPO_ROOT/.claude/skills/self-repair-pipeline/src/auto_classify/builtins"
node --import tsx .claude/skills/triage-curator/scripts/render_classifier.ts \
  --response <response_path> --out "$BUILTINS_DIR"
```

The script prints the absolute target path on stdout when it succeeds. On
failure (should not happen after Step 4.25) it exits non-zero and does
NOT create the file — the working tree is never polluted with half-rendered
source.

Build the authored-files map for finalize. The renderer derives both the
filename and the map key from `response.retargets_to ?? response.group_id`
(they are the same string), and finalize looks up paths by that same key.
Always use the derivation for both:

```json
{ "<retargets_to ?? group_id>": "/abs/path/to/check_<retargets_to ?? group_id>.ts", ... }
```

Write it to a temp file and pass it to Step 5 via `--authored-files`.

Checkpoint: every builtin investigate response has a corresponding
authored `.ts` file on disk, and the authored-files map is ready to
hand to `curate_run --phase finalize`.

### Step 5 — Finalize per run

For every run, invoke the `finalize_cmd` from `PLAN`, passing the
authored-files map from Step 4.5:

Invoke the `finalize_cmd` verbatim — it already carries `--dry-run` /
`--reaggregate-on-incoherent` if you asked for them at Step 1 — and pass
the authored-files map from Step 4.5:

```bash
<finalize_cmd> --authored-files <path/to/authored-files.json>
```

Finalize owns several automatic housekeeping steps beyond the registry
upsert itself:

- **Language derivation**: new `wip` entries get their `languages` field
  populated from (a) declared `language_eq` checks in the classifier spec,
  (b) otherwise from source-group member file extensions. A group with no
  derivable language fails with a `spec_validation_failures[]` entry.
- **Orphan cleanup**: any path in the authored-files map that does not
  land as an accepted upsert is `unlink`'d and logged to
  `deleted_orphan_files[]`.
- **Derived markdown**: when the registry is mutated, the four
  `packages/core/src/index_single_file/query_code_tree/queries/unsupported_features.<lang>.md`
  files are re-rendered and added to `authored_files[]` so the pre-commit
  hook sees them as part of the sweep.
- **Incoherent-group queue**: with `--reaggregate-on-incoherent`, any
  session log with `failure_category: "group_incoherent"` is written to
  `<run>/reaggregate_queue.json` for follow-up dispatch.

Checkpoint: capture each printed JSON as `FINALIZE[run_id]`. Aggregate
`authored_files`, `deleted_orphan_files`, `failed_authoring`,
`spec_validation_failures`, `backlog_tasks_to_create`, `failed_groups`,
`session_response_mismatches`, `skipped_permanent_upserts`,
`promoted_reinvestigations`, `reaggregate_queue` across all runs.

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

- **Main agent (Step 4.5)** calls `render_classifier.ts --out <dir>` for
  every validated builtin `classifier_spec`. The renderer derives the
  target path itself as `<dir>/check_<response.retargets_to ?? response.group_id>.ts`,
  writes the file atomically, and prints the path on stdout. Render
  failures exit non-zero and leave no file behind.
- **Dispatcher (`curate_run --phase finalize`)** AST-parses each authored
  file, upserts the registry entry for every proposal whose classifier
  file passed, flips drift tags, re-renders derived markdown, and unlinks
  orphaned `.ts` files whose groups failed validation. Failures become
  `failed_authoring[]` / `spec_validation_failures[]` entries and block
  the corresponding registry upsert.

Registry files written: `known_issues/registry.json` (upserts + drift
tags). Classifier files written:
`src/auto_classify/builtins/check_<target_group_id>.ts`. Derived files
written on upsert: `packages/core/src/index_single_file/query_code_tree/queries/unsupported_features.{typescript,javascript,python,rust}.md`.
No other paths are ever written during the sweep.

#### Failure cleanup

Finalize unlinks every path in the authored-files map that did not land
as an accepted upsert — whether the rejection came from AST failure,
spec validation, language-derivation failure, or file readability. The
list of removed paths is surfaced in `deleted_orphan_files[]` so the
commit diff never carries half-finished source.

#### Derived-markdown regeneration

When finalize mutates the registry (any upsert or drift tag), it invokes
`render_unsupported_features` directly, overwrites the four
`unsupported_features.<lang>.md` golden files, and adds those paths to
`authored_files[]` so they're staged alongside the classifier source.
The pre-commit hook's `render_unsupported_features.test.ts` pins them, so
this step is required for the commit to succeed when the registry moves.

### Retarget-to-existing-entry

An investigator may decide its classifier should extend an existing
registry entry rather than create a new one. Signal this by setting
`response.retargets_to: "<existing-group-id>"` while keeping
`response.group_id` equal to the dispatch group id. Effects:

- The authored `.ts` filename becomes `check_<retargets_to>.ts`.
- The registry upsert lands on the `<retargets_to>` entry, not a new one.
- `positive_examples` and `negative_examples` must be empty — their
  indices would reference the source group's entries, not the target's.

Step 4.25 rejects retargets where `retargets_to` names a non-existent
entry, or where `positive_examples`/`negative_examples` are non-empty.

### Incoherent-group handling

`--reaggregate-on-incoherent` collects every session log whose
`failure_category === "group_incoherent"` into
`<run>/reaggregate_queue.json`. Schema:

```json
{
  "run_id": "string",
  "project": "string",
  "groups": [
    {
      "group_id": "string",
      "project": "string",
      "run_id": "string",
      "failure_details": "string"
    }
  ]
}
```

The bundle is a hand-off — finalize does not trigger the rough-aggregator
itself. Orchestration layers (the main agent, a follow-up script, or a
human) dispatch against the queue as a separate step.

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
