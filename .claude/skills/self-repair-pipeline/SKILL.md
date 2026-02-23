---
name: self-repair-pipeline
description: Runs the full entry point self-repair pipeline. Detects entry points in Ariadne packages or external codebases, triages false positives via sub-agents, plans fixes for each issue group with competing proposals and multi-angle review, and creates backlog tasks.
argument-hint: "[config-name | /path/to/repo | owner/repo (GitHub)]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Read, Write, Task(triage-investigator, triage-aggregator, triage-rule-reviewer, fix-planner, plan-synthesizer, plan-reviewer, task-writer)
hooks:
  Stop:
    - hooks:
        - type: command
          command: "node --import tsx \"$CLAUDE_PROJECT_DIR/.claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts\""
          timeout: 30
---

# Self-Repair Pipeline

Triage pipeline for entry point analysis: detect false positives, classify root causes, plan fixes, and create backlog tasks. Supports both self-analysis (Ariadne packages) and external codebase analysis.

## Pipeline Overview

| Phase | Script / Agent | Purpose |
| ----- | -------------- | ------- |
| 1. Detect | `scripts/detect_entrypoints.ts` | Run entry point detection |
| 2. Prepare | `scripts/prepare_triage.ts` | Classify against known-entrypoints registry, build triage state |
| 3. Triage Loop | triage-investigator, triage-aggregator, triage-rule-reviewer | Investigate pending entries, aggregate results, review for patterns |
| 4. Fix Planning | fix-planner, plan-synthesizer, plan-reviewer, task-writer | Generate competing fix plans, synthesize, review, create tasks |
| 5. Finalize | `scripts/finalize_triage.ts` | Save results, update registry |

## Analysis Target

**User input:** `$ARGUMENTS`

Resolve the analysis target from the user's input using this routing table:

| Input pattern | Example | Action |
| ------------- | ------- | ------ |
| Empty or blank | `/self-repair-pipeline` | List available configs below, ask user what to analyze |
| Config name | `core`, `mcp`, `types`, `projections` | Use `--config .claude/skills/self-repair-pipeline/project_configs/{name}.json` |
| Absolute or relative directory path | `/Users/chuck/workspace/some-repo`, `../other-repo` | Check for matching config; if none, create one interactively (see below) |
| `owner/repo` or GitHub URL | `anthropics/sdk-python`, `https://github.com/owner/repo` | Use `--github <value>` |
| Natural language | "analyze the core package" | Interpret intent and map to one of the above |

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
5. Save to `project_configs/{name}.json`
6. Continue the pipeline with `--config project_configs/{name}.json`

Available project configs:

| Config name | Config path |
| ----------- | ----------- |
| `core` | `project_configs/core.json` |
| `mcp` | `project_configs/mcp.json` |
| `types` | `project_configs/types.json` |
| `projections` | `project_configs/projections.json` |

If no arguments are provided or the input is ambiguous, **ask the user** before proceeding.

## Current State

!`cat .claude/self-repair-pipeline-state/triage/*_triage.json 2>/dev/null || echo "No active triage"`

## State and Output Locations

| File | Purpose |
| ---- | ------- |
| `triage/{project}_triage.json` | Active triage state (phases, entries, results) |
| `triage/results/{entry_index}.json` | Per-entry triage result files (written by sub-agents) |
| `triage/fix_plans/{group_id}/` | Fix plans, synthesis, and reviews per group |
| `analysis/{project}/` | Project-scoped timestamped analysis and triage result files |
| `known_entrypoints/{project}.json` | Known-entrypoints registry (persists across runs) |

`{project}` is the short name for internal packages (e.g., `core`) or the full path identifier for external projects (e.g., `-Users-chuck-workspace-AmazonAdv-projections`).
| `triage_patterns.json` | Extracted classification patterns from meta-review |

All paths above are relative to `.claude/self-repair-pipeline-state/`.

## Phase 1: Detect

Use the target resolved from the **Analysis Target** section above to construct the detect command.

```bash
# From project config (preferred for Ariadne packages)
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts \
  --config .claude/skills/self-repair-pipeline/project_configs/core.json

# Local repository
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts --path /path/to/repo

# GitHub repository
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts --github owner/repo
```

Options: `--config <file>`, `--path <dir>`, `--github <repo>`, `--branch <name>`, `--depth <n>`, `--output <file>`, `--include-tests`, `--folders <paths>`, `--exclude <patterns>`

Tracked project configs for Ariadne packages: `project_configs/{core,mcp,types}.json`

Output: `.claude/self-repair-pipeline-state/analysis/<project>/detect_entrypoints/<timestamp>.json`

## Phase 2: Prepare

Build triage state from the latest analysis output:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts \
  --analysis .claude/self-repair-pipeline-state/analysis/<project>/detect_entrypoints/<timestamp>.json \
  --package <name> \
  --batch-size 5
```

Options: `--analysis <path>` (required), `--package <name>`, `--state <path>`, `--batch-size <n>` (default 5)

The script loads the known-entrypoints registry and classifies entries:

- **known-tp**: Matches registry — marked completed immediately
- **llm-triage**: No registry match — marked pending for investigation

Output: `.claude/self-repair-pipeline-state/triage/{project}_triage.json`

## Phase 3: Triage Loop (Hook-Driven)

After running `prepare_triage.ts`, stop. The stop hook drives all remaining phases.

Each time you stop, the hook evaluates the triage state and either BLOCKs with instructions or ALLOWs completion:

| Hook says | You do |
|-----------|--------|
| `Triage batch: entries [62, 63, ...]. State: <path>` | Launch a **triage-investigator** per entry index (`prompt: "<N>"`, `run_in_background: true`). Stop. |
| `All entries triaged. Phase transitioned to aggregation.` | Launch one **triage-aggregator** (`prompt: "<state_path>"`). Stop. |
| `Phase transitioned to meta-review.` | Launch one **triage-rule-reviewer** (`prompt: "<state_path>"`). Stop. |
| Fix planning instructions | Follow sub-phase instructions for fix-planner/synthesizer/reviewer/task-writer. |
| (ALLOW — no block) | Run `finalize_triage.ts`. |

The hook handles result merging, validation, phase transitions, and batch coordination. Sub-agents fetch their own context via `scripts/get_entry_context.ts` — the main agent never reads entry data, diagnostics, or templates.

## Phase 4: Fix Planning

If meta-review found multi-entry false-positive groups (>1 entry sharing the same group_id), the stop hook transitions to `fix-planning` phase. Single-entry groups are recorded but skipped.

Fix planning proceeds per group through four sub-phases:

### 4a. Planning

Launch 5 **fix-planner** sub-agents for each group. Each generates an independent fix proposal.

Output: `triage/fix_plans/{group_id}/plan_{n}.md` (relative to `.claude/self-repair-pipeline-state/`)

Update `plans_written` in the state file after each plan is written.

### 4b. Synthesis

Launch a **plan-synthesizer** sub-agent that reads all 5 plans and produces a unified fix approach.

Output: `triage/fix_plans/{group_id}/synthesis.md` (relative to `.claude/self-repair-pipeline-state/`)

Set `synthesis_written: true` in the state file.

### 4c. Review

Launch 4 **plan-reviewer** sub-agents, each reviewing from a different angle:

- Information architecture
- Simplicity
- Fundamentality
- Language coverage

Output: `triage/fix_plans/{group_id}/review_{angle}.md` (relative to `.claude/self-repair-pipeline-state/`)

Update `reviews_written` in the state file after each review.

### 4d. Task Writing

Launch a **task-writer** sub-agent that creates a backlog task using `templates/backlog_task_template.md`.

Set `task_file` in the state file to the created task path.

## Phase 5: Finalize

After the stop hook ALLOWs completion (all phases done or error exit), run finalization:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/finalize_triage.ts \
  --state .claude/self-repair-pipeline-state/triage/{project}_triage.json
```

Finalization:

- Partitions entries into true positives, dead code, and false-positive groups
- Saves triage results JSON to `.claude/self-repair-pipeline-state/analysis/<project>/triage_results/`
- Updates the known-entrypoints registry with confirmed true positives and dead code
- Writes triage patterns file (if meta-review produced patterns)

## Architecture: Key Modules

All library modules live under `src/`:

| Module | Purpose |
| ------ | ------- |
| `extract_entry_points.ts` | Shared extraction with enriched metadata + diagnostics |
| `classify_entrypoints.ts` | Deterministic rule-based classification (no LLM) |
| `known_entrypoints.ts` | Known-entrypoints registry I/O and matching |
| `build_triage_entries.ts` | Build triage entries from classification results |
| `build_finalization_output.ts` | Build finalization output from completed state |
| `types.ts` | Shared type definitions (`EnrichedFunctionEntry`, `EntryPointDiagnostics`, etc.) |
| `triage_state_types.ts` | Triage state machine types |
| `analysis_io.ts` | Analysis file lookup, JSON I/O |
| `discover_state.ts` | Triage state file discovery (shared by hook + scripts) |

## Reference

- [State Machine: Phase Transitions and BLOCK/ALLOW Logic](reference/state_machine.md)
- [Diagnosis Routes: Routing Table and Escape Hatch](reference/diagnosis_routes.md)
- [Sample Triage Output](examples/sample_triage_output.json)

## Sub-Agents

| Agent | Model | Purpose |
| ----- | ----- | ------- |
| triage-investigator | sonnet | Investigate a single pending entry (fetches own context via `get_entry_context.ts`) |
| triage-aggregator | sonnet | Review all entry results, group by root cause, merge duplicates |
| triage-rule-reviewer | sonnet | Analyze false-positive patterns, propose deterministic classification rules |
| fix-planner | sonnet | Generate one independent fix proposal for a false-positive group |
| plan-synthesizer | opus | Synthesize 5 competing plans into a unified fix approach |
| plan-reviewer | sonnet | Review synthesized plan from one specific angle |
| task-writer | sonnet | Create a backlog task from synthesis + reviews using the task template |
