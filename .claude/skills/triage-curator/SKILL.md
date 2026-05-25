---
name: triage-curator
description: Offline sweep that consumes the triage-entrypoints skill's v4 triage results — promotes novel issues into the registry with authored classifiers, absorbs classifier-regression flags as drift signals, files signal-library-gap sub-tasks under TASK-190.16 and Ariadne-bug top-level tasks (linked back into the registry), and commits the result.
argument-hint: "[--project <name>] [--last <n>] [--run <path>] [--dry-run] [--commit-to current|new|pr] [--branch <name>] [--pr <number>]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Bash(git *), Bash(gh *), AskUserQuestion, Read, Write, Edit, Glob, Task(triage-curator-investigator), mcp__backlog__task_create, mcp__backlog__task_search
---

# Triage Curator

Offline sweep over `triage-entrypoints` triage outputs. One sub-agent
wave: investigators author classifiers for novel issues the per-entry
triage-entrypoints triage already named. Finalize applies proposals;
backlog captures signal gaps; commit seals the sweep.

The curator reads `analysis_output/<project>/triage_results/<run-id>.json` (schema v4 — includes `project_path`, `commit_hash`, `novel_issues[]`, `classifier_regressions[]`, `confirmed_unreachable[]`, `uncertain[]`). The `<run-id>` is the same identifier the triage-entrypoints skill emits (`<short-commit>-<iso-ts>`): run-id is the shared identifier across the two skills.

**Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`
or `npx tsx`.

## Pipeline Overview

| #   | Step        | Actor                                                          | Output                                                                                                                                                  |
| --- | ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Plan        | `scripts/curate_all.ts`                                        | List of runs with promote-novel investigate dispatches                                                                                                  |
| 2   | Investigate | `triage-curator-investigator` (opus, 200 turns, ≤5 concurrent) | One validated `InvestigateResponse` + `<id>.session.json` per dispatch. The investigator self-validates via `scripts/validate_responses.ts --response`. |
| 3   | Finalize    | `scripts/finalize_run.ts`                                      | Render each builtin spec to `check_<target>.ts`, apply proposals, write `finalized.json`, print summary                                                 |
| 4   | Backlog     | `mcp__backlog__task_create` + `link_ariadne_bug_tasks`         | Gap sub-tasks under `TASK-190.16`; bug tasks + registry link                                                                                            |
| 5   | Commit      | `git` / `gh` via `AskUserQuestion`                             | Committed sweep on current branch, a new branch, or a PR                                                                                                |

## Arguments

**User input:** `$ARGUMENTS`

| Flag                             | Effect                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--project <name>`               | Restrict to one project directory under `analysis_output`                                                   |
| `--last <n>`                     | Keep the most recent N runs after filtering                                                                 |
| `--run <path>`                   | Short-circuit discovery; curate a single `triage_results` JSON                                              |
| `--dry-run`                      | Run the investigation wave but apply no writes and skip commit                                              |
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
`run_path`, `novel_promote_dispatches[]`,
`already_registered_novel_issues[]`,
`fixed_novel_issue_resurfacings[]`, and `finalize_cmd`. Promote-novel
dispatches carry a `get_context_cmd` and pre-allocated `output_path`;
already-registered novel issues need no dispatch (finalize bumps
`observed_count` from the source triage file directly); fixed
resurfacings are surfaced for human review (the reconciler is the only
authorized `fixed` writer). Classifier regressions flow through finalize
directly from the v4 triage_results artifact — no separate dispatch field.

### Step 2 — Dispatch the investigate wave

The investigator is opus/200-turn, so cap concurrency at
`MAX_CONCURRENT_INVESTIGATORS = 5` and drain the queue in waves using
the puller.

**1. Write the dispatch list.** Concatenate every entry in
`PLAN.runs[*].novel_promote_dispatches[]` into a single array. Each entry
already carries `run_path`, `novel_issue_id`, `output_path`, and
`get_context_cmd` — the producer's shape matches the puller's
`DispatchEntry` directly. Persist via the `Write` tool to a temp file as
`$DISPATCH_LIST` (e.g. `/tmp/curator-dispatch-<stamp>.json`).

**2. Pull-and-dispatch loop.** Until `pending[]` is empty:

```bash
node --import tsx .claude/skills/triage-curator/scripts/next_investigate_tasks.ts \
  --dispatch-list "$DISPATCH_LIST" --limit 5
```

The puller dedupes by `output_path`, filters done dispatches, and prints:

```json
{ "pending": [ /* ≤5 entries */ ], "remaining": <total_not_done> }
```

A dispatch is "done" when its `output_path` exists and parses as JSON.

For each entry in `pending[]`, fire one `Task(triage-curator-investigator)`
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
file) is enforced inside `finalize_run.ts` before any registry mutation.

### Step 3 — Finalize per run

Invoke the `finalize_cmd` from `PLAN`:

```bash
<finalize_cmd>
```

Finalize handles several housekeeping steps:

- **Classifier source authoring:** every investigate response with a non-null
  `classifier_spec` is rendered to TypeScript and written to
  `packages/core/src/classify_entry_points/builtins/check_<target_group_id>.ts`
  (where `target_group_id = response.retargets_to ?? response.group_id`).
  Renderer throws land in `failed_authoring[]`.
- **AST check:** each rendered file is parsed through the TypeScript
  compiler; any diagnostic is treated as failed authoring and excludes the
  registry upsert.
- **Language derivation:** new `wip` entries get `languages` from declared
  `language_eq` checks, otherwise from source-group file extensions. No
  derivable language → `failed_authoring[]`.
- **Orphan cleanup:** files rendered for a target whose upsert was rejected
  are `unlink`'d and logged to `deleted_orphan_files[]`.
- **Derived markdown:** when the registry mutates, the four
  `unsupported_features.<lang>.md` golden files are re-rendered and
  added to `authored_files[]`.
- **Sentinel:** writes `runs/<id>/finalized.json` so future sweeps skip
  this run. Re-running finalize on an already-finalized run exits with
  code 2 without re-applying proposals (prevents double-bumping
  `observed_count`); delete the sentinel to force.

Capture each printed JSON as `FINALIZE[run_id]`. Aggregate `authored_files`,
`deleted_orphan_files`, `failed_authoring`, `signal_library_gap_tasks`,
`ariadne_bug_tasks`, `failed_groups`, `skipped_permanent_upserts` across runs.

### Step 4 — File backlog tasks

Skip entirely when `--dry-run` was set. Otherwise file two distinct task
flights from the finalize summaries.

#### Signal-library gap sub-tasks

For every entry across all finalize summaries' `signal_library_gap_tasks[]`,
first dedup via `mcp__backlog__task_search` using a query derived from
`title` + joined `signals_needed`. If a sub-task already exists under
`TASK-190.16` that covers the same signal(s), skip create and remember the
existing task id.

Otherwise call:

```
mcp__backlog__task_create({
  title,
  description,
  parentTaskId: "TASK-190.16",
  labels: ["triage-entrypoints", "signal-gap", "triage-curator", group_id],
})
```

Backlog.md auto-assigns the next `.n+1` suffix (e.g. `TASK-190.16.13`).
Record each created task id alongside its triggering `group_id` for
commit-message rendering. No registry write.

#### Ariadne-bug tasks and registry linkage

For every entry across all finalize summaries' `ariadne_bug_tasks[]`,
resolve a task id using this precedence:

1. **Attach existing.** If `entry.existing_task_id` is set, use it — skip
   create.
2. **Dedup.** Otherwise `mcp__backlog__task_search` on the `title` and
   `root_cause_category` label; if a matching task exists, use its id.
3. **Create new.** Otherwise call:

   ```
   mcp__backlog__task_create({
     title,
     description,
     labels: ["ariadne-core", "false-positive-root-cause",
              "root-cause-<root_cause_category>", group_id],
   })
   ```

Build the registry-linkage mapping file:

```bash
STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
MAPPING_PATH="/tmp/curator-ariadne-bug-mapping-${STAMP}.json"
```

The mapping is a JSON object `{ [target_registry_group_id]: "TASK-<N>" }`.
**Every resolved entry contributes — whether attached via `existing_task_id`,
found via `task_search`, or freshly created.** Omitting attached entries
would leave their registry rows with `backlog_task: undefined`.

Write the mapping via `Write`, then invoke:

```bash
node --import tsx .claude/skills/triage-curator/scripts/link_ariadne_bug_tasks.ts \
  --mapping "$MAPPING_PATH"
```

This writes `backlog_task` onto matching registry entries. The helper is a
thin wrapper around `link_ariadne_bug_tasks` in `apply_proposals.ts`.

**Crash recovery.** If the orchestrator crashes between finalize and
successful linkage, the run's `runs/<id>/finalized.json` already contains
the full `outcome.ariadne_bug_tasks[]` array. Re-running this sub-step
from that array reconstructs the mapping without re-dispatching
investigators.

### Step 5 — Commit the sweep

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
triage-curator: <run_count> runs curated, <classifiers_added> classifiers, <gap_tasks> gap tasks, <bug_tasks> bug tasks

Projects: <proj1>, <proj2>
Runs:
  - <run_id_1>
New classifiers:
  - <group_id> (builtin: check_<id>.ts)
Drift tagged: <group_id_x>
Signal-library gap sub-tasks: <n>
  - TASK-190.16.<n+1> (<group_id>): <signals_needed>
Ariadne-bug tasks: <n>
  - TASK-<N> (<group_id>, <root_cause_category>): <title>
Registry links updated: <n>
Failed groups: <n>
  - <group_id> (<category>): <details>
Failed authoring: <n>        # omit when empty
  - <group_id>: <reason>
```

Confirm the commit landed on the expected ref.

## Impact reporting (on demand)

After curating one or more runs, generate a human-readable ranking of the
known-issues registry by observed impact. Not part of the main curation
pipeline — invoked separately when the user wants a snapshot.

```bash
node --import tsx .claude/skills/triage-curator/scripts/generate_impact_report.ts \
  [--top-n 20] [--prior <json>] [--out <md>] [--snapshot <json>]
```

The report prints to stdout and optionally to `--out`. Pass `--snapshot` to
write the current `{ [group_id]: observed_count }` map, and pass the previous
run's snapshot as `--prior` to highlight groups that first appeared since then.

The report has four sections: top N by `observed_count`, per-language breakdown,
per-project breakdown, and "new since prior snapshot". Every registry entry
carries its accumulated `observed_count`, `observed_projects`, and
`last_seen_run`; these are bumped automatically by `finalize_run` each time a
false-positive group is seen.

### Posting the report to the backlog

After running `generate_impact_report.ts`, the main agent optionally posts the
markdown to the backlog as a document for ongoing reference:

```
mcp__backlog__document_create({
  title: "Self-repair impact report — <YYYY-MM-DD>",
  content: <markdown from --out>,
  tags: ["triage-entrypoints", "impact-report"],
})
```

Post a fresh document each time rather than editing an existing one — old
reports are useful as a historical record of where false-positive pressure
sat at a given point.

## Sweeping registry entries without a linked backlog task (on demand)

Registry entries minted by the novel-group scanner, or seeded `wip` entries
that predate the curator's Ariadne-bug flow, carry no `backlog_task`. The
sweeper emits `mcp__backlog__task_create` proposals for each unlinked entry
and flags linked entries whose body needs refreshing because `observed_count`
has changed since the prior sweep.

```bash
node --import tsx .claude/skills/triage-curator/scripts/propose_backlog_tasks.ts \
  [--prior <json>] [--out <json>] [--snapshot <json>]
```

Output shape:

```json
{
  "creates": [
    {
      "group_id": "novel:xxx",
      "title": "[novel:xxx] …",
      "description": "<markdown body with observed_count, examples, classifier spec, AC checklist>",
      "labels": [
        "triage-entrypoints",
        "known-issue",
        "novel:xxx",
        "lang-typescript"
      ]
    }
  ],
  "updates": [
    {
      "group_id": "method-chain-dispatch",
      "backlog_task": "TASK-900",
      "description": "<refreshed body>"
    }
  ]
}
```

For each `creates[]` entry the main agent calls `mcp__backlog__task_create`
with the supplied fields, then feeds `{ [group_id]: "TASK-<N>" }` back through
`link_ariadne_bug_tasks.ts` to record the linkage. For each `updates[]` entry
it calls `mcp__backlog__task_edit` on the `backlog_task` with the new
`description`.

## Classifier lifecycle (write boundaries)

The curator is the single autonomous writer for every `wip` transition: minting via the investigator's first classifier upsert against a previously-unregistered `novel_issue.id` (`apply_proposals.ts:upsert_classifier`), drift tagging (`curator_drift_absorb.ts:absorb_classifier_regressions`, gated on `classifier.kind !== "none"`), and observed-stat bookkeeping. `wip → permanent` is the only manual transition — surfaced by `pnpm find-promotion-candidates` for human review. `wip → fixed` is owned by the fix-sequencer reconciler (TASK-190.18.3). See `.claude/rules/classifier-lifecycle.md` for the canonical writer matrix.

All registry writes go through `atomic_write_file` (`src/atomic_write.ts`) so concurrent curator + reconciler runs cannot lose data.

## Cross-package write contract

`finalize_run` is a **cross-package writer**: when a curation run produces
classifier upserts or drift tags, it writes generated source into the
versioned `@ariadnejs/core` package alongside its own skill-local outputs.
A successful sweep's commit therefore spans both the skill and the package.

| Path                                                             | Owner                         | Trigger                             |
| ---------------------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `.claude/skills/triage-entrypoints/known_issues/registry.json` | Skill (canonical)             | Every classifier upsert / drift tag |
| `packages/core/src/classify_entry_points/builtins/check_*.ts`    | Skill writes core path        | Per builtin proposal in Step 3      |
| `packages/core/src/classify_entry_points/builtins/index.ts`      | Auto — `sync_permanent_rules` | Registry mutated this run           |
| `packages/core/src/classify_entry_points/permanent_data.ts`      | Auto — `sync_permanent_rules` | Registry mutated this run           |

Path resolution lives in `src/paths.ts` (`get_core_builtins_dir`,
`get_core_builtins_barrel_path`, `get_permanent_slice_path`); never
hardcode the `packages/core/...` prefix in finalize / cleanup code.

CI invokes `pnpm sync-permanent-rules && git diff --exit-code
packages/core/src/classify_entry_points/` so a registry edit without a
matching regen fails fast.

## Reference

### State

- **Input:** `~/.ariadne/triage-entrypoints/analysis_output/{project}/triage_results/{iso}.json`
- **Working dir:** `~/.ariadne/triage-curator/runs/{run_id}/investigate/{novel_issue_id}.json`
- **Session logs:** `~/.ariadne/triage-curator/runs/{run_id}/investigate/{novel_issue_id}.session.json`
- **Sentinel:** `~/.ariadne/triage-curator/runs/{run_id}/finalized.json` (presence → run is curated)
- **Registry writes:** `.claude/skills/triage-entrypoints/known_issues/registry.json`
  (only when not `--dry-run`; drift tags + classifier upserts + `backlog_task`
  linkage for Ariadne-bug tasks created in Step 4)
- **Core writes:** `packages/core/src/classify_entry_points/builtins/check_*.ts`
  (per builtin proposal) plus `builtins/index.ts` and `permanent_data.ts`
  (auto-regenerated by `sync_permanent_rules` whenever the registry mutates).
  See _Cross-package write contract_ above.

### Drift signals

`KnownIssue.drift_evidence[]` accumulates per-entry
`fp-classifier-regression` verdicts emitted by the triage-investigator the
moment it spots an entry the classifier *should* have caught. Surfaced via
the run's `classifier_regressions[]` aggregate; absorbed by
`curator_drift_absorb.ts:absorb_classifier_regressions`.

`status: "permanent"` rows are never drift-tagged automatically; regression
flags against them surface in `skipped_permanent_upserts` for human review.

### Session log statuses

Every investigator dispatch emits `<novel_issue_id>.session.json` alongside
its response. Finalize folds the statuses into the summary and commit message.

- **`success`** — valid classifier (`kind: "builtin"`), paired with a
  required `ariadne_bug` (new task or `existing_task_id`).
- **`blocked_missing_signal`** — `kind: "none"` plus `signal_library_gap`
  populated. Legitimate outcome when the signal library cannot express
  the pattern. `ariadne_bug` may still be populated to name the
  underlying resolver deficiency.
- **`failure`** — structural block: incoherent group, infeasible pattern,
  permanent lock, registry conflict. Carries `failure_category` and
  `failure_details`; surfaced in the commit message.
