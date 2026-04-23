---
name: self-repair-pipeline
description: Runs the full entry point self-repair pipeline. Detects entry points in Ariadne packages or external codebases, triages false positives via sub-agents, aggregates root causes by group, and updates the known-entrypoints registry.
argument-hint: "[config-name | /path/to/repo | owner/repo (GitHub)]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Bash(ls:*), Read, Write, Glob, Task(triage-investigator, rough-aggregator, group-investigator)
---

# Self-Repair Pipeline

Triage pipeline for entry point analysis: detect false positives, classify root causes, and update the known-entrypoints registry. Supports both self-analysis (Ariadne packages) and external codebase analysis.

**Script invocation:** Always use `node --import tsx` to run scripts. Never use `pnpm exec tsx` or `npx tsx` — these create IPC Unix sockets that the sandbox blocks.

## Pipeline Overview

| Phase          | Script / Agent                       | Purpose                                                         |
| -------------- | ------------------------------------ | --------------------------------------------------------------- |
| 1. Detect      | `scripts/detect_entrypoints.ts`      | Run entry point detection                                       |
| 2. Prepare     | `scripts/prepare_triage.ts`          | Classify against known-entrypoints registry, build triage state |
| 3. Triage Loop | triage-investigator                  | Investigate pending entries with a continuous worker pool       |
| 4. Aggregate   | rough-aggregator, group-investigator | Group false positives by root cause, verify membership          |
| 5. Finalize    | `scripts/finalize_triage.ts`         | Save results, update known-entrypoints registry                 |

## Analysis Target

**User input:** `$ARGUMENTS`

Before routing, extract any pipeline flags from the arguments:

| Flag              | Variable     | Default   |
| ----------------- | ------------ | --------- |
| `--max-count <n>` | `$MAX_COUNT` | _(unset)_ |

Strip extracted flags from the input before applying the routing table below.

Resolve the analysis target from the remaining input using this routing table:

| Input pattern                       | Example                                                  | Action                                                                     |
| ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Empty or blank                      | `/self-repair-pipeline`                                  | List available configs below, ask user what to analyze                     |
| Config name                         | `core`, `mcp`, `types`, `projections`                    | Use `--config ~/.ariadne/self-repair-pipeline/project_configs/{name}.json` |
| Absolute or relative directory path | `/Users/chuck/workspace/some-repo`, `../other-repo`      | Use `--path <path>`                                                        |
| `owner/repo` or GitHub URL          | `anthropics/sdk-python`, `https://github.com/owner/repo` | Use `--github <value>`                                                     |
| Natural language                    | "analyze the core package"                               | Interpret intent and map to one of the above                               |

### Creating a New Project Config

When the input is a directory path and no existing config matches:

1. Resolve the path and verify it exists
2. Run `ls` to see top-level structure; check for `.gitignore`, `package.json`, `pyproject.toml`
3. Propose a config with:
   - `project_path`: absolute path (required)
   - `folders`: relevant source directories (omit if analyzing everything)
   - `exclude`: obvious non-source directories beyond the defaults
   - `project_name` is auto-derived for external projects via `path_to_project_id(project_path)` — do not include it in the config. Only internal projects (`project_path: "."`) require an explicit `project_name`.
4. Show the proposed config and ask the user to confirm or adjust
5. Save to `~/.ariadne/self-repair-pipeline/project_configs/{name}.json`
6. Continue the pipeline with `--config ~/.ariadne/self-repair-pipeline/project_configs/{name}.json`

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

| File                                                                     | Purpose                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `project_configs/{name}.json`                                            | Per-project detection config (folders, excludes)            |
| `triage_state/{project}/{project}_triage.json`                           | Project triage state (entries, results)                     |
| `triage_state/{project}/results/{entry_index}.json`                      | Per-entry triage result files (written by sub-agents)       |
| `triage_state/{project}/aggregation/slices/slice_{n}.json`               | Pass 1 input slices (false-positive entries)                |
| `triage_state/{project}/aggregation/pass1/slice_{n}.output.json`         | Pass 1 rough groupings                                      |
| `triage_state/{project}/aggregation/pass3/input.json`                    | Pass 3 canonical group list                                 |
| `triage_state/{project}/aggregation/pass3/{group_id}_investigation.json` | Pass 3 per-group investigation results                      |
| `analysis_output/{project}/`                                             | Project-scoped timestamped analysis and triage result files |
| `known_entrypoints/{project}.json`                                       | Known-entrypoints registry (persists across runs)           |

All paths above are relative to `~/.ariadne/self-repair-pipeline/`.

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
  [--max-count $MAX_COUNT]   # omit if $MAX_COUNT is unset
```

Options: `--analysis <path>` (required), `--project <name>` (optional — falls back to analysis file's project_name), `--max-count <n>` (optional)

When `--max-count` is set, the script shuffles the `llm-triage` entries (Fisher-Yates) and keeps only the first `<n>`. Use this to take a random sample when the full triage set is too large to process in one run.

The script loads the known-entrypoints registry and classifies entries:

- **known-unreachable**: Matches registry — marked completed immediately
- **llm-triage**: No registry match — marked pending for investigation

Output: `triage_state/{project}/{project}_triage.json` — use Glob to find this path if the project name is unknown: `~/.ariadne/self-repair-pipeline/triage_state/**/*_triage.json`.

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
- Saves triage results JSON to `analysis_output/<project>/triage_results/`
- Updates the known-entrypoints registry with confirmed unreachable entries

## Architecture: Key Modules

All library modules live under `src/`:

| Module                                | Purpose                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `extract_entry_points.ts`             | Shared extraction with enriched metadata + diagnostics                         |
| `known_entrypoints.ts`                | Known-entrypoints registry I/O and matching                                    |
| `known_issues_registry.ts`            | Known-issues registry loader + predicate-expression schema validator           |
| `prepare_triage.ts`                   | Three-bucket orchestration (whitelist / auto-classified / residual)            |
| `build_triage_entries.ts`             | Assemble `TriageEntry` records from prepared buckets                           |
| `build_finalization_output.ts`        | Build final results from a completed triage state                              |
| `merge_results.ts`                    | Merge investigator result files into triage state                              |
| `aggregation/prepare_slices.ts`       | Slice completed false positives into rough-aggregator inputs                   |
| `aggregation/merge_rough_groups.ts`   | Merge pass1 outputs into canonical pass3 input                                 |
| `aggregation/finalize_aggregation.ts` | Apply pass3 verdicts back to triage state                                      |
| `entry_point_types.ts`                | Entry-point shapes (`EnrichedFunctionEntry`, diagnostics, known-entrypoints)   |
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
