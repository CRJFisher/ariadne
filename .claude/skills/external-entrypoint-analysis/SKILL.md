---
name: external-entrypoint-analysis
description: Runs entrypoint analysis on external codebases (local directories or GitHub repos). Use when asked to analyze entry points in a non-Ariadne codebase. Supports TypeScript, JavaScript, Python, Rust, Go, Java, C++, C.
allowed-tools: Bash(npx tsx:*), Read
---

# External Entry Point Analysis

## Purpose

Detect and classify entry points in any external codebase using Ariadne's call graph analysis. Supports local directories and GitHub repositories across multiple languages.

## Pipeline Overview

The external analysis pipeline consists of 2 steps. All scripts live under `entrypoint-analysis/src/external_analysis/`:

| Step | Script                                            | Purpose                                                     |
| ---- | ------------------------------------------------- | ----------------------------------------------------------- |
| 1    | `src/external_analysis/detect_entrypoints.ts`     | Detect entry points in an external codebase                 |
| 2    | `src/external_analysis/triage_entry_points.ts`    | Classify entries as true positives or false positives        |

## Output Location

All outputs go to `entrypoint-analysis/analysis_output/` with timestamped filenames.

| Output Type           | Filename Pattern                               |
| --------------------- | ---------------------------------------------- |
| Detection results     | `{project}-analysis_<timestamp>.json`          |
| Entry point triage    | `entry_point_triage_<timestamp>.json`          |

## Project Configuration

Before running detection, check for an existing project config:

1. Look in `entrypoint-analysis/project_configs/` for a `{project_name}.json` file
2. If a config exists, use it with `--config` (skip to Step 1)
3. If no config exists, ask the user for:
   - Absolute path to the repository
   - Folders to include (or all)
   - Folders to exclude
4. Create a config file from this template:

```json
{
  "project_name": "<short-name>",
  "project_path": "/absolute/path/to/repo",
  "folders": ["src", "lib"],
  "exclude": ["vendor", "generated"],
  "include_tests": false
}
```

| Field            | Required | Description                                      |
| ---------------- | -------- | ------------------------------------------------ |
| `project_name`   | Yes      | Short identifier used in output filenames        |
| `project_path`   | Yes      | Absolute path to the repository root             |
| `folders`        | No       | Subfolders to analyze (omit to analyze all)      |
| `exclude`        | No       | Folder names to exclude from analysis            |
| `include_tests`  | No       | Whether to include test files (default: false)   |

Save the config to `entrypoint-analysis/project_configs/{project_name}.json`.

## Step 1: Detect Entry Points

```bash
# From project config (preferred)
npx tsx entrypoint-analysis/src/external_analysis/detect_entrypoints.ts \
  --config entrypoint-analysis/project_configs/{project_name}.json

# Local repository (without config)
npx tsx entrypoint-analysis/src/external_analysis/detect_entrypoints.ts --path /path/to/repo

# GitHub repository
npx tsx entrypoint-analysis/src/external_analysis/detect_entrypoints.ts --github owner/repo
npx tsx entrypoint-analysis/src/external_analysis/detect_entrypoints.ts --github https://github.com/owner/repo

# Additional options (used with --path or --github):
#   --branch <name>        Branch to analyze (default: default branch)
#   --depth <n>            Clone depth for GitHub repos (default: 1)
#   --output <file>        Output file (default: stdout + timestamped file)
#   --include-tests        Include test files in analysis
#   --folders <paths>      Comma-separated subfolders to analyze
#   --exclude <patterns>   Comma-separated exclude patterns
```

The script:

- Discovers all source files matching supported languages (TS, JS, Python, Rust, Go, Java, C++, C)
- Indexes files into an Ariadne Project instance
- Builds call graph and extracts entry points
- Enriches each entry with metadata (is_exported, access_modifier, callback_context, call_summary)
- Pre-gathers diagnostics (grep call sites, Ariadne call references, diagnosis)

**Output**: `analysis_output/{project}-analysis_<timestamp>.json`

### Supported Languages

TypeScript, JavaScript, Python, Rust, Go, Java, C++, C. Language detection is automatic based on file extension.

## Step 2: Triage Entry Points

```bash
npx tsx entrypoint-analysis/src/external_analysis/triage_entry_points.ts
npx tsx entrypoint-analysis/src/external_analysis/triage_entry_points.ts --limit 10
```

Three-stage pipeline that classifies each detected entry point as either a **true positive** (legitimate public API) or **false positive** (detection artifact):

### Stage 1: Deterministic Pre-Classification

Uses `classify_entrypoints.ts` to apply ordered rules with no LLM cost. Deterministically classified false positives are grouped. True positives and unclassified entries proceed to Stage 2.

### Stage 2: Parallel Entry Investigation

Unclassified entries are investigated in parallel (5 concurrent workers). External triage asks: "Is this a legitimate public API entry point, or a detection artifact?"

Each entry produces:

- `is_true_positive`: whether the entry is a real entry point
- `group_id` + `root_cause`: if false positive, what detection bug caused it

### Stage 3: Aggregation

False positive analyses are aggregated to group entries by shared root cause.

**Output**: `analysis_output/entry_point_triage_<timestamp>.json`

### Output Structure

The triage output separates true and false positives:

```json
{
  "true_positives": [
    { "name": "main", "file_path": "src/main.ts", "start_line": 10 }
  ],
  "groups": {
    "method-dispatch": {
      "group_id": "method-dispatch",
      "root_cause": "...",
      "entries": [...]
    }
  },
  "last_updated": "2026-01-27T..."
}
```

## (Optional) Step 3: Investigate and Document Issues

After triage identifies false positives with detection bugs, the agent can investigate each aggregation group and create task documentation. This step is agent-driven (not a script).

### When to Use

Use this step when triage results show false positive groups that indicate bugs in Ariadne's call graph detection logic (not just noise in the analyzed codebase).

### Workflow

1. **Load triage results** - Read the most recent `entry_point_triage_*.json`
2. **Spawn investigation sub-agents** - For each false positive group, use the Task tool to spawn an Explore sub-agent that:
   - Verifies the detection bug exists with concrete code examples from the analyzed codebase
   - Identifies the root cause in Ariadne's call graph detection logic
   - Locates potential fix locations in the Ariadne codebase
   - Documents reproduction steps
3. **Collect investigation results** - Aggregate findings from all sub-agents
4. **Discover task management system** - Check for local task management patterns:
   - Run `backlog task list --plain` to check for backlog CLI
   - Look in `/backlog/` directory for existing task file structure
   - Review 2-3 existing task files to understand format conventions
   - Default to the discovered pattern (backlog CLI if available)
5. **Confirm with user** - Ask the user how they'd like tasks written up, presenting the discovered default
6. **Create task documents** - Generate tasks in the confirmed format

### Investigation Sub-Agent Prompt

Each sub-agent should receive:

- Group ID and root cause description from triage
- List of affected entries with file paths and signatures
- Pre-gathered diagnostic data (grep results, call references)
- Instructions to explore the Ariadne codebase and verify the bug

### Task Documentation Requirements

Every task document must include **reproducible code samples** that demonstrate the detection bug:

1. **Minimal reproducible example** - The exact code syntax that triggers the false positive
2. **Expected behavior** - What the call graph detection should find
3. **Actual behavior** - What the detection currently produces
4. **File path and line references** - Where the bug manifests in Ariadne's detection logic

### Example Task Content

```markdown
## Problem

Method calls via `this` in derived classes are not tracked when the method is defined in a parent class.

## Reproduction

[List of code blocks in triple backticks, each mentioning the file paths and line numbers of the code that reproduces the problem]

**Expected**: `handleRequest` is NOT an entry point (called via `this` in DerivedService)
**Actual**: `handleRequest` is detected as entry point

## Root Cause

`packages/core/src/resolve_references/resolve_references.ts:312` - `this` member access resolution does not traverse the inheritance chain.

## Fix Location

`packages/core/src/resolve_references/resolve_references.ts` - add parent class traversal when resolving `this.method()` calls.

```

## Architecture: Key Modules

All modules live under `entrypoint-analysis/src/`:

| Module | Purpose |
| ------ | ------- |
| `extract_entry_points.ts` | Shared extraction with enriched metadata + diagnostics |
| `classify_entrypoints.ts` | Deterministic rule-based classification (no LLM) |
| `types.ts` | Shared type definitions |
| `agent_queries.ts` | Claude Agent SDK query helpers, parallel execution |
| `analysis_io.ts` | Analysis file lookup, JSON I/O |

## Differences from Self-Analysis

| Aspect | Self-Analysis | External Analysis |
| ------ | ------------- | ----------------- |
| Ground truth | Uses `ground_truth/{package}.json` | No ground truth available |
| Triage assumption | All entries are false positives | Must decide true vs false positive |
| Dead code filtering | Filters previously deleted functions | No dead code step |
| False negative triage | Checks for missed public API | Not applicable |
| Package scope | Single Ariadne package | Entire repository or subfolders |
