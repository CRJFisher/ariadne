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

## Step 1: Detect Entry Points

```bash
# Local repository
npx tsx entrypoint-analysis/src/external_analysis/detect_entrypoints.ts --path /path/to/repo

# GitHub repository
npx tsx entrypoint-analysis/src/external_analysis/detect_entrypoints.ts --github owner/repo
npx tsx entrypoint-analysis/src/external_analysis/detect_entrypoints.ts --github https://github.com/owner/repo

# Available options:
#   --path <dir>           Local directory to analyze
#   --github <repo>        GitHub repository (owner/repo or full URL)
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
