---
name: self-repair-pipeline
description: Runs the full entry point self-repair pipeline. Detects entry points in Ariadne packages or external codebases, triages false positives via sub-agents, aggregates root causes by group, and updates the known-entrypoints registry.
argument-hint: "[config-name | /path/to/repo | owner/repo (GitHub)]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Bash(ls:*), Read, Write, Glob, Task(triage-investigator, rough-aggregator, group-consolidator, group-investigator)
---

# Self-Repair Pipeline

Triage pipeline for entry point analysis: detect false positives, classify root causes, and update the known-entrypoints registry. Supports both self-analysis (Ariadne packages) and external codebase analysis.

**Script invocation:** Always use `node --import tsx` to run scripts. Never use `pnpm exec tsx` or `npx tsx` — these create IPC Unix sockets that the sandbox blocks.

## Pipeline Overview

| Phase          | Script / Agent                                           | Purpose                                                         |
| -------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Detect      | `scripts/detect_entrypoints.ts`                          | Run entry point detection                                       |
| 2. Prepare     | `scripts/prepare_triage.ts`                              | Classify against known-entrypoints registry, build triage state |
| 3. Triage Loop | triage-investigator                                      | Investigate pending entries in batches                          |
| 4. Aggregate   | rough-aggregator, group-consolidator, group-investigator | Group false positives by root cause, verify membership          |
| 5. Finalize    | `scripts/finalize_triage.ts`                             | Save results, update known-entrypoints registry                 |

## Analysis Target

**User input:** `$ARGUMENTS`

Resolve the analysis target from the user's input using this routing table:

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

| File                                                                     | Purpose                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `project_configs/{name}.json`                                            | Per-project detection config (folders, excludes)            |
| `triage_state/{project}/{project}_triage.json`                           | Active triage state (entries, results)                      |
| `triage_state/{project}/results/{entry_index}.json`                      | Per-entry triage result files (written by sub-agents)       |
| `triage_state/{project}/aggregation/slices/slice_{n}.json`               | Pass 1 input slices (false-positive entries)                |
| `triage_state/{project}/aggregation/pass1/slice_{n}.output.json`         | Pass 1 rough groupings                                      |
| `triage_state/{project}/aggregation/pass2/batch_{n}.input.json`          | Pass 2 consolidation input (when >15 groups)                |
| `triage_state/{project}/aggregation/pass2/batch_{n}.output.json`         | Pass 2 consolidated groups                                  |
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

Options: `--config <file>`, `--path <dir>`, `--github <repo>`, `--branch <name>`, `--depth <n>`, `--output <file>`, `--include-tests`, `--folders <paths>`, `--exclude <patterns>`

Tracked project configs for Ariadne packages: `~/.ariadne/self-repair-pipeline/project_configs/{core,mcp,types}.json`

Output: `analysis_output/<project>/detect_entrypoints/<timestamp>.json`

## Phase 2: Prepare

Build triage state from the latest analysis output:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts \
  --analysis ~/.ariadne/self-repair-pipeline/analysis_output/<project>/detect_entrypoints/<timestamp>.json \
  --package <name> \
  --batch-size 5
```

Options: `--analysis <path>` (required), `--package <name>`, `--state <path>`, `--batch-size <n>` (default 5)

The script loads the known-entrypoints registry and classifies entries:

- **known-unreachable**: Matches registry — marked completed immediately
- **llm-triage**: No registry match — marked pending for investigation

Output: `triage_state/{project}/{project}_triage.json` — use Glob to find this path if the project name is unknown: `~/.ariadne/self-repair-pipeline/triage_state/**/*_triage.json`.

## Phase 3: Triage Loop

All commands run from the repository root. The script auto-discovers the active state file in `~/.ariadne/self-repair-pipeline/triage_state/` — no `--state` flag needed.

Repeat the following loop until all entries are processed:

1. Run `get_next_triage_batch.ts` and parse its JSON output:

   ```bash
   node --import tsx .claude/skills/self-repair-pipeline/scripts/get_next_triage_batch.ts
   ```

   Output: `{ "entries": [N, ...], "state_path": "..." }` — **capture `state_path` now**; it is required for all `--state` arguments in Phase 4 and 5. If the script exits non-zero, stop and report stderr to the user.

2. If `entries` is empty, all pending entries are done — proceed to Phase 4 (Aggregate).

3. For each entry index N in the batch: run `get_entry_context.ts` and pass its stdout as the **`prompt:`** parameter of a Task tool call to a **triage-investigator** agent (`run_in_background: true`):

   ```bash
   node --import tsx .claude/skills/self-repair-pipeline/scripts/get_entry_context.ts --entry <N>
   ```

   Pass the raw stdout string verbatim as the `prompt:` value — no wrapping, trimming, or interpretation. If the script exits non-zero, skip that entry and log stderr instead of launching an agent with an empty prompt.

4. Wait for all investigator tasks to complete.

5. Go to step 1.

## Phase 4: Aggregate

Group false-positive results by root cause using a 3-pass pipeline. All aggregation files are stored under `triage_state/aggregation/` relative to the state directory.

**`state_path`** is the value captured from `get_next_triage_batch.ts` output in Phase 3. All `--state` arguments below use this value.

**Step 1:** Split false-positive entries into slices:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/prepare_aggregation_slices.ts \
  --state <state_path>
```

Output: `{ "slice_count": N }`. Writes `aggregation/slices/slice_{n}.json` files (~50 entries each). If `slice_count` is 0 (no false positives), skip to Phase 5.

**Step 2:** Launch one **rough-aggregator** agent per slice in parallel (`run_in_background: true`). Prompt each agent with the **absolute path to its slice file as plain text** — no key-value wrapping, just the path string. Each agent groups entries by semantic similarity and writes `aggregation/pass1/slice_{n}.output.json`.

**Step 3:** Verify all pass1 output files exist (one per slice), then merge rough groups:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/merge_rough_groups.ts \
  --state <state_path>
```

Output: `{ "group_count": N, "skip_pass2": true|false }`

- If `group_count` is 0: stop and investigate — at least one false-positive slice was expected.
- If `skip_pass2: true` (≤15 groups): writes `aggregation/pass3/input.json` directly — skip to Step 5.
- If `skip_pass2: false` (>15 groups): writes `aggregation/pass2/batch_{n}.input.json` bundles.

**Step 4** (only if `skip_pass2: false`):

- Launch one **group-consolidator** agent per batch in parallel (`run_in_background: true`). Prompt each agent with the **absolute path to its batch file as plain text** — no key-value wrapping, just the path string. Each agent merges synonymous group names and writes `aggregation/pass2/batch_{n}.output.json`.
- Then run:
  ```bash
  node --import tsx .claude/skills/self-repair-pipeline/scripts/merge_consolidated_groups.ts \
    --state <state_path>
  ```
  Writes `aggregation/pass3/input.json`.

**Step 5:** Read `aggregation/pass3/input.json` to get the group list. Launch one **group-investigator** agent per false-positive group in parallel (`run_in_background: true`). Prompt each agent with the following **key-value plain text** (not JSON, not a file path):

```
group_id: <id>
root_cause: <root_cause>
entry_indices: [N, ...]
state_path: <state_path>
```

Each agent verifies member assignments and writes `aggregation/pass3/{group_id}_investigation.json`.

**Step 6:** Apply investigation results and finalize group assignments:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/finalize_aggregation.ts \
  --state <state_path>
```

Writes canonical `group_id`/`root_cause` back to state entries, handles reject reallocation, sets `phase = "complete"`.

**Step 7:** Run Phase 5.

## Phase 5: Finalize

Run after Phase 4 sets `phase = "complete"`. Use the `state_path` captured in Phase 3.

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/finalize_triage.ts \
  --state <state_path>
```

Finalization:

- Partitions entries into confirmed-unreachable and false-positive groups
- Saves triage results JSON to `analysis_output/<project>/triage_results/`
- Updates the known-entrypoints registry with confirmed unreachable entries

## Architecture: Key Modules

All library modules live under `src/`:

| Module                         | Purpose                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `extract_entry_points.ts`      | Shared extraction with enriched metadata + diagnostics                           |
| `classify_entrypoints.ts`      | Deterministic rule-based classification (no LLM)                                 |
| `known_entrypoints.ts`         | Known-entrypoints registry I/O and matching                                      |
| `build_triage_entries.ts`      | Build triage entries from classification results                                 |
| `build_finalization_output.ts` | Build finalization output from completed state                                   |
| `merge_results.ts`             | Merge investigator result files into triage state                                |
| `types.ts`                     | Shared type definitions (`EnrichedFunctionEntry`, `EntryPointDiagnostics`, etc.) |
| `triage_state_types.ts`        | Triage state types (`TriageState`, `TriageEntry`, `TriageEntryResult`)           |
| `analysis_io.ts`               | Analysis file lookup, JSON I/O                                                   |
| `discover_state.ts`            | Triage state file discovery                                                      |

## Reference

- [Diagnosis Routes: Routing Table and Classification Guide](reference/diagnosis_routes.md)

## Sub-Agents

| Agent               | Model  | Purpose                                                                      |
| ------------------- | ------ | ---------------------------------------------------------------------------- |
| triage-investigator | sonnet | Investigate a single pending entry; determine if Ariadne missed real callers |
| rough-aggregator    | sonnet | Group a slice of false-positive entries by semantic similarity of root cause |
| group-consolidator  | sonnet | Merge synonymous group names across slices into canonical group identifiers  |
| group-investigator  | opus   | Verify per-entry group membership using source code and Ariadne MCP evidence |
