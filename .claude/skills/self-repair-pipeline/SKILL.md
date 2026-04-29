---
name: self-repair-pipeline
description: Runs the full entry point self-repair pipeline. Detects entry points in Ariadne packages or external codebases, triages false positives via sub-agents, and aggregates root causes into groups.
argument-hint: "[config-name | /path/to/repo | owner/repo (GitHub)]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Bash(ls:*), Read, Write, Glob, Task(triage-investigator, rough-aggregator, group-investigator)
---

# Self-Repair Pipeline

Triage pipeline for entry point analysis: detect false positives and classify root causes. Supports both self-analysis (Ariadne packages) and external codebase analysis.

Each invocation produces a self-contained run under `triage_state/<project>/runs/<run-id>/`. Run-id format is `<short-commit>-<iso-ts>` (e.g. `deadbee-2026-04-28T13-42-07.812Z`); `nogit-...` for non-git projects. Re-running at the same target commit reuses prior `confirmed_unreachable` verdicts via the TP cache (skip with `--no-reuse-tp`). A new commit on the target busts the cache: every entry re-investigates.

**Script invocation:** Always use `node --import tsx` to run scripts. Never use `pnpm exec tsx` or `npx tsx` — these create IPC Unix sockets that the sandbox blocks.

## Pipeline Overview

| Phase          | Script / Agent                       | Purpose                                                              |
| -------------- | ------------------------------------ | -------------------------------------------------------------------- |
| 1. Detect      | `scripts/detect_entrypoints.ts`      | Run entry point detection                                            |
| 2. Prepare     | `scripts/prepare_triage.ts`          | Auto-classify against the known-issues registry, build triage state  |
| 3. Triage Loop | triage-investigator                  | Investigate pending (residual) entries with a continuous worker pool |
| 4. Aggregate   | rough-aggregator, group-investigator | Group false positives by root cause, verify membership               |
| 5. Finalize    | `scripts/finalize_triage.ts`         | Save triage-results JSON                                             |

## Analysis Target

**User input:** `$ARGUMENTS`

Before routing, extract any pipeline flags from the arguments:

| Flag              | Variable     | Default |
| ----------------- | ------------ | ------- |
| `--max-count <n>` | `$MAX_COUNT` | `150`   |

Strip extracted flags from the input before applying the routing table below.

Resolve the analysis target from the remaining input using this routing table:

| Input pattern                       | Example                                                  | Action                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Empty or blank                      | `/self-repair-pipeline`                                  | List available configs below, ask user what to analyze                                                                           |
| Config name                         | `core`, `mcp`, `types`, `projections`                    | Use `--config ~/.ariadne/self-repair-pipeline/project_configs/{name}.json`                                                       |
| Absolute or relative directory path | `/Users/chuck/workspace/some-repo`, `../other-repo`      | If a project config exists for this path, use `--config <config-path>`; otherwise follow **Creating a New Project Config** below |
| `owner/repo` or GitHub URL          | `anthropics/sdk-python`, `https://github.com/owner/repo` | Use `--github <value>`                                                                                                           |
| Natural language                    | "analyze the core package"                               | Interpret intent and map to one of the above                                                                                     |

### Creating a New Project Config

When the input is a directory path and a project config already exists for that path, skip this section and proceed to Phase 1 using `--config <path>`. Otherwise, follow these steps:

1. Resolve the path and verify it exists.
2. Run the folder preview to see what would be indexed:

   ```bash
   node --import tsx .claude/skills/self-repair-pipeline/scripts/preview_folders.ts \
     --path <abs_path>
   ```

3. Pick directories to exclude from indexing. Common candidates: vendored / third-party / generated trees, directories whose contents are not first-party source, or any single directory whose file count dominates the rest of the project. A high `file_count_recursive` with a low `file_count_direct` means the directory is a container for sub-packages, not a leaf vendor blob — do not exclude it on count alone.
4. Present the **full** preview list in your message text (relative path + `file_count_recursive` per line), with your pre-selected exclusions marked and a short reason for each pick. Then use AskUserQuestion with three options: "Accept these exclusions", "Modify — I'll describe changes in my reply", "Exclude nothing". If the user chooses Modify, read their follow-up message, apply the changes, and confirm the final list before continuing. The user's final answer is authoritative.
5. Propose a config with:
   - `project_path`: absolute path (required)
   - `folders`: relevant source directories (omit if analyzing everything)
   - `exclude`: the list the user confirmed in step 4
   - `project_name` is auto-derived for external projects via `path_to_project_id(project_path)` — do not include it in the config. Only internal projects (`project_path: "."`) require an explicit `project_name`.
6. Show the proposed config and ask for final confirmation.
7. Save to `~/.ariadne/self-repair-pipeline/project_configs/{name}.json`.
8. Continue the pipeline with `--config ~/.ariadne/self-repair-pipeline/project_configs/{name}.json`.

Available project configs:

| Config name   | Config path                                                        |
| ------------- | ------------------------------------------------------------------ |
| `core`        | `~/.ariadne/self-repair-pipeline/project_configs/core.json`        |
| `mcp`         | `~/.ariadne/self-repair-pipeline/project_configs/mcp.json`         |
| `types`       | `~/.ariadne/self-repair-pipeline/project_configs/types.json`       |
| `projections` | `~/.ariadne/self-repair-pipeline/project_configs/projections.json` |

If no arguments are provided or the input is ambiguous, **ask the user** before proceeding.

## Current State

!`node --import tsx .claude/skills/self-repair-pipeline/scripts/get_triage_summary.ts 2>/dev/null || echo "No active triage"`

## State and Output Locations

Scripts that operate on existing triage state take `--project <name>` (`prepare_triage` uses `--project` at creation time; `get_triage_summary` enumerates every project and takes no flags). Each pipeline invocation operates on exactly one project, and different projects can run in parallel against the same `triage_state/` dir — the project name is the isolation boundary.

| File                                                                                   | Purpose                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `project_configs/{name}.json`                                                          | Per-project detection config (folders, excludes)                                      |
| `triage_state/{project}/LATEST`                                                        | Pointer to the active run-id; absent when no run is in progress                       |
| `triage_state/{project}/runs/{run-id}/manifest.json`                                   | Per-run metadata (status, commit_hash, tp_cache record)                               |
| `triage_state/{project}/runs/{run-id}/triage.json`                                     | Per-run triage state (entries, per-entry results)                                     |
| `triage_state/{project}/runs/{run-id}/results/{entry_index}.json`                      | Per-entry investigator outputs (written by sub-agents)                                |
| `triage_state/{project}/runs/{run-id}/aggregation/slices/slice_{n}.json`               | Pass 1 input slices (false-positive entries)                                          |
| `triage_state/{project}/runs/{run-id}/aggregation/pass1/slice_{n}.output.json`         | Pass 1 rough groupings                                                                |
| `triage_state/{project}/runs/{run-id}/aggregation/pass3/input.json`                    | Pass 3 canonical group list                                                           |
| `triage_state/{project}/runs/{run-id}/aggregation/pass3/{group_id}_investigation.json` | Pass 3 per-group investigation results                                                |
| `analysis_output/{project}/detect_entrypoints/{ts}.json`                               | Detection output (kept project-scoped; one detection feeds many triage runs)          |
| `analysis_output/{project}/triage_results/{run-id}.json`                               | Published triage results (schema v2, with `commit_hash`, `kind`, relative file paths) |

All paths above are relative to `~/.ariadne/self-repair-pipeline/`. Run-ids have the form `<short-commit>-<iso-ts>` (e.g. `deadbee-2026-04-28T13-42-07.812Z`); `nogit-<iso-ts>` when the target is not a git repo.

Phase 3-5 scripts default to the run pointed at by `LATEST`; pass `--run-id <id>` to operate on a specific run. `prepare_triage` writes `LATEST` and `finalize_triage` clears it.

The dead-code whitelist at `known_entrypoints/<package>.json` (also under `~/.ariadne/self-repair-pipeline/`) is owned by the `detect_dead_code` Stop hook and is never read or written by this pipeline. See **Dead-code guardrail** below.

## Phase 1: Detect

Use the target resolved from the **Analysis Target** section above to construct the detect command.

```bash
# From project config (preferred for Ariadne packages)
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts \
  --config ~/.ariadne/self-repair-pipeline/project_configs/core.json

# Local repository
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts --path /path/to/repo

# GitHub repository
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts --github owner/repo
```

Options: `--config <file>`, `--path <dir>`, `--github <repo>`, `--branch <name>`, `--depth <n>`. Folder filters, exclusions, and test inclusion are declared in the project config file, not as CLI flags.

Tracked project configs for Ariadne packages: `~/.ariadne/self-repair-pipeline/project_configs/{core,mcp,types}.json`

Output: `analysis_output/<project>/detect_entrypoints/<timestamp>.json`

## Phase 2: Prepare

Build triage state from the latest analysis output:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts \
  --analysis ~/.ariadne/self-repair-pipeline/analysis_output/<project>/detect_entrypoints/<timestamp>.json \
  --project <name> \
  [--max-count $MAX_COUNT]   # omit to use default of 150
```

Options:

- `--analysis <path>` (required)
- `--project <name>` (optional — falls back to the analysis file's `project_name`)
- `--max-count <n>` (optional, default `150`)
- `--no-reuse-tp` (optional) — disable the TP cache for this run; every `llm-triage` entry will re-investigate even if a prior run at the same commit confirmed it unreachable
- `--tp-source-run <run-id>` (optional) — pin a specific source run for the TP cache. Must be at the current HEAD commit; the script throws otherwise.

`--max-count` caps how many `llm-triage` entries are kept (and thus the total number of triage-investigator agents Phase 3 dispatches — distinct from the `N = 5` concurrency setting in Phase 3). The script keeps the top `<n>` residual entries by `tree_size`. Auto-classified entries are always kept in full and do not count toward this cap. Override the default for a smaller probe or larger sweep.

The script captures the target's HEAD short-commit, generates run-id `<short-commit>-<iso-ts>`, and creates `triage_state/<project>/runs/<run-id>/`. It partitions entries into three buckets:

- **known-unreachable (registry)**: A predicate classifier from `known_issues/registry.json` matched at or above its `min_confidence` — marked completed immediately with the matched `group_id`.
- **known-unreachable (previously-confirmed-tp)**: Reused from the most recent finalized run at the same commit. Skipped via `--no-reuse-tp`. Distinguished by `known_source: "previously-confirmed-tp"` and `tp_source_run_id`.
- **llm-triage**: No classifier matched — marked pending for investigation.

`prepare_triage` prints `{ "run_id": "...", "stats": { ... } }` to stdout. Capture the `run_id` if you need to pin Phase 3-5 to a specific run; otherwise the project's `LATEST` pointer makes that automatic.

Output: `triage_state/<project>/runs/<run-id>/triage.json` and `manifest.json`.

## Phase 3: Triage Loop

Run investigators as a **continuous worker pool**: keep `N` triage-investigator agents in flight at all times, launching a replacement the moment any one of them completes. This keeps concurrency close to `N` for the whole phase instead of averaging `N/2` as a batch loop would.

**Default concurrency:** `N = 5`.

Every script takes `--project <name>` — use the project captured in Phase 2. The main agent tracks in-flight indices locally and passes them via `--active` so the script never hands the same index to two workers.

**Crash recovery is automatic.** Entries stay `pending` until an investigator writes a result file, which `merge_results` absorbs on the next script call (transitioning the entry to `completed`). If an investigator crashes before writing a result, its entry remains `pending` and is redispensed naturally on a later call. The `--active` set tells the script which `pending` entries are currently assigned to live workers so they are skipped when picking replacements.

### Step 1: Initial fill

Run once to pick up to `N` pending entries:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/get_next_triage_entry.ts \
  --project <name> --count 5
```

Output: `{ "entries": [N, ...] }`. If the script exits non-zero, stop and report stderr to the user. If `entries` is empty, skip to Phase 4.

Launch one **triage-investigator** agent per returned index in a **single message with multiple Agent calls** (parallel), all `run_in_background: true`. Prompt each with:

```
project: <name>
entry_index: N
```

The triage-investigator runs `get_entry_context.ts --project <name> --entry <index>` itself to fetch the full investigation context and writes its result to `results/{entry_index}.json`.

Track the set of in-flight entry indices locally — it seeds `--active` on the next call.

### Step 2: Steady-state worker pool

Whenever any background investigator completes, remove its entry index from the in-flight set, then run the script once with the remaining in-flight indices:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/get_next_triage_entry.ts \
  --project <name> --active 7,12,18,23
```

- If `entries` has one index, launch one replacement `triage-investigator` agent (`run_in_background: true`) for that index and add it to the in-flight set.
- If `entries` is empty and the in-flight set is empty, proceed to Phase 4.
- If `entries` is empty but the in-flight set is non-empty, wait for the next completion and call the script again.

Call the script **sequentially** (not in parallel) for replacements — each call needs a fresh `merge_results` pass to see the just-completed entry before picking the next pending one. Pass an empty `--active` (omit the flag) if every worker has finished and you're doing a final drain check.

## Phase 4: Aggregate

Group false-positive results by root cause using a 3-pass pipeline. All aggregation files are stored under `triage_state/aggregation/` relative to the state directory.

**Step 1:** Split false-positive entries into slices:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/prepare_aggregation_slices.ts \
  --project <name>
```

Output: `{ "slice_count": N }`. Writes `aggregation/slices/slice_{n}.json` files (~50 entries each). If `slice_count` is 0 (no false positives), skip to Phase 5.

**Step 2:** Launch one **rough-aggregator** agent per slice in parallel (`run_in_background: true`). Prompt each agent with the **absolute path to its slice file as plain text** — no key-value wrapping, just the path string. Each agent groups entries by semantic similarity and writes `aggregation/pass1/slice_{n}.output.json`.

**Step 3:** Verify all pass1 output files exist (one per slice), then merge rough groups:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/merge_rough_groups.ts \
  --project <name>
```

Output: `{ "group_count": N }`. Writes `aggregation/pass3/input.json`. If `group_count` is 0, stop and investigate — at least one false-positive slice was expected.

**Step 4:** Read `aggregation/pass3/input.json` to get the group list. Launch one **group-investigator** agent per false-positive group in parallel (`run_in_background: true`). Prompt each agent with the following **key-value plain text** (not JSON, not a file path):

```
project: <name>
group_id: <id>
root_cause: <root_cause>
entry_indices: [N, ...]
```

Each agent verifies member assignments and writes `aggregation/pass3/{group_id}_investigation.json`.

**Step 5:** Apply investigation results and finalize group assignments:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/finalize_aggregation.ts \
  --project <name>
```

Writes canonical `group_id`/`root_cause` back to state entries, handles reject reallocation, sets `phase = "complete"`.

**Step 6:** Run Phase 5.

## Phase 5: Finalize

Run after Phase 4 sets `phase = "complete"`.

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/finalize_triage.ts \
  --project <name>
```

Finalization:

- Partitions entries into confirmed-unreachable and false-positive groups
- Saves triage results JSON to `analysis_output/<project>/triage_results/<run-id>.json` (schema v2: includes `commit_hash`, `kind`, relative file paths)
- Sets `manifest.status = "finalized"`, `finalized_at = now`
- Clears the project's `LATEST` pointer

The run directory is preserved for diffing and audit. Use `prune_runs.ts` to garbage-collect old run dirs (the published `triage_results/<run-id>.json` is kept forever — diff_runs and the curator depend on it).

## Reusing Prior TP Verdicts

When you re-run the pipeline at the same target HEAD commit, `prepare_triage` reuses entries that the most recent finalized run classified as `confirmed_unreachable` — they skip Phase 3 and ship straight to the new run's `confirmed_unreachable[]` with `known_source: "previously-confirmed-tp"` and a `tp_source_run_id` that records the source.

The cache validity gate is **the run-id's `<short-commit>-` prefix**:

- Same prefix → cache reuses prior TP verdicts.
- Different prefix (any commit on the target) → cache misses; every entry re-investigates.

Two known leaks (accepted; document for users):

- **Uncommitted target-repo changes don't bust the cache.** HEAD is the only signal. To force a clean pass after a dirty edit, either `git commit` first or pass `--no-reuse-tp`.
- **Ariadne core changes don't bust the cache.** If you tighten Ariadne's call resolution and want to validate that prior TPs still hold, run once with `--no-reuse-tp`.

`--tp-source-run <run-id>` pins a specific source (must be at the current commit).

## Comparing Runs

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/diff_runs.ts \
  --project <name> --from <run-id> --to <run-id> [--format text|json]
```

Output highlights TP↔FP flips (regression candidates), entries that appeared/disappeared, group-id changes, and group membership deltas. Reads the published `triage_results/<run-id>.json` files; works even when the underlying run dirs have been pruned.

## Run Retention

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/prune_runs.ts \
  --project <name> [--keep <n>] [--dry-run]
```

Default keep-count is `5` (override with `--keep` or `ARIADNE_RETAIN_RUNS`). Runs whose run-id is referenced by another run's `tp_cache.source_run_id` are protected. Active and abandoned runs are never pruned. Published `triage_results/<run-id>.json` files are kept forever.

`list_runs.ts --project <name> [--status active|finalized|abandoned] [--last <n>]` enumerates the run history with status (JSON to stdout). `abandon_run.ts --project <name> [--run-id <id>]` marks a run abandoned and clears `LATEST` if it pointed there.

## Typical Iteration Loop

The user's iteration cycle when tuning the classifier registry or Ariadne core resolution against a fixed target commit:

```bash
# 1. Detect once (entry-point set is stable for a given target HEAD)
node --import tsx scripts/detect_entrypoints.ts --config <config> > /dev/null
# capture the analysis JSON path (or use Glob to find it)

# 2. Initial run
node --import tsx scripts/prepare_triage.ts --analysis <analysis.json> --project <name>
#   ... walk through Phase 3-5 ...

# 3. Edit registry / Ariadne core. (No commit needed; the cache gates on target HEAD.)

# 4. Re-run at the same commit. Cache reuses prior TPs; LLM re-investigates only the residual.
node --import tsx scripts/prepare_triage.ts --analysis <analysis.json> --project <name>
#   ... walk through Phase 3-5 again ...

# 5. Diff to spot regressions
node --import tsx scripts/diff_runs.ts --project <name> --from <run-1> --to <run-2>
```

Two known leaks during this loop (escape hatch: `--no-reuse-tp`):

- **Uncommitted target-repo edits** don't bust the cache (`git commit` first, or pass `--no-reuse-tp`).
- **Ariadne core changes** don't bust it either (run once with `--no-reuse-tp` after substantive resolution improvements).

## Migrating from a Pre-Run-Namespaced Pipeline

If you upgraded from a version that wrote `triage_state/<project>/<project>_triage.json` directly:

```bash
# Wrap the legacy state into runs/legacy-<ts>/ with status=abandoned (default)
node --import tsx scripts/migrate_legacy_state.ts --project <name>

# OR: delete the legacy artifacts
node --import tsx scripts/migrate_legacy_state.ts --project <name> --purge
```

`prepare_triage` emits a one-line stderr warning when it detects unmigrated legacy state.

## Dead-code guardrail

Orthogonal to the self-repair pipeline. The `detect_dead_code` Stop hook (`.claude/hooks/detect_dead_code.ts`, registered in `.claude/settings.json`) runs Ariadne against git-modified packages after each Claude Code session and cross-checks flagged entry points against a per-package whitelist at `~/.ariadne/self-repair-pipeline/known_entrypoints/<package>.json`. Exported-but-uncalled entry points not on the whitelist block the session.

The whitelist is **human-owned**. Add a legitimate entry point by editing the package's JSON file and committing:

```json
[
  {
    "source": "project",
    "description": "Confirmed legitimate entry points",
    "entrypoints": [
      { "name": "handle_request", "file_path": "src/handlers.ts" }
    ]
  }
]
```

The self-repair pipeline does not read or write this whitelist. If you previously ran the pipeline under an older version that auto-appended `confirmed-unreachable` entries, audit each `known_entrypoints/<package>.json` once and delete any entries you do not actually want gated as legitimate entry points.

## Architecture: Key Modules

All library modules live under `src/`:

| Module                                | Purpose                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `extract_entry_points.ts`             | Shared extraction with enriched metadata + diagnostics                         |
| `known_issues_registry.ts`            | Known-issues registry loader + predicate-expression schema validator           |
| `prepare_triage.ts`                   | Two-bucket orchestration (auto-classified / residual)                          |
| `build_triage_entries.ts`             | Assemble `TriageEntry` records from prepared buckets                           |
| `build_finalization_output.ts`        | Build final results from a completed triage state                              |
| `merge_results.ts`                    | Merge investigator result files into triage state                              |
| `aggregation/prepare_slices.ts`       | Slice completed false positives into rough-aggregator inputs                   |
| `aggregation/merge_rough_groups.ts`   | Merge pass1 outputs into canonical pass3 input                                 |
| `aggregation/finalize_aggregation.ts` | Apply pass3 verdicts back to triage state                                      |
| `entry_point_types.ts`                | Entry-point shapes (`EnrichedEntryPoint`, diagnostics)                         |
| `known_issues_types.ts`               | Known-issues registry DSL (`ClassifierSpec`, `PredicateExpr`, `KnownIssue`, …) |
| `triage_state_types.ts`               | Triage state types (`TriageState`, `TriageEntry`, `TriageEntryResult`)         |
| `triage_state_paths.ts`               | Triage state file locations + required-flag CLI helpers                        |
| `analysis_output.ts`                  | Timestamped analysis output JSON I/O                                           |
| `project_id.ts`                       | Project-identifier derivation (`path_to_project_id`, `project_id_from_config`) |
| `guard_tsx_invocation.ts`             | Enforce `node --import tsx` invocation (sandbox-compatible)                    |

## Reference

- [Diagnosis Routes: Routing Table and Classification Guide](reference/diagnosis_routes.md)

## Sub-Agents

| Agent               | Model  | Purpose                                                                      |
| ------------------- | ------ | ---------------------------------------------------------------------------- |
| triage-investigator | sonnet | Investigate a single pending entry; determine if Ariadne missed real callers |
| rough-aggregator    | sonnet | Group a slice of false-positive entries by semantic similarity of root cause |
| group-investigator  | opus   | Verify per-entry group membership using source code and Ariadne MCP evidence |
