---
name: entrypoint-self-analysis
description: Runs the entrypoint self-analysis pipeline on a specific package. Use when asked to run entrypoint detection, self-analysis, dead code detection, or false positive triage. Compares results against previous runs to track improvement.
allowed-tools: Bash(npx tsx:*), Read
---

# Entry Point Self-Analysis Pipeline

## Purpose

Verify whether recent changes to call graph detection logic improved entry point detection accuracy, and analyze/remediate false positives and false negatives.

## Pipeline Overview

The self-analysis pipeline consists of 5 steps run from `entrypoint-analysis/`:

| Step | Script                                 | Purpose                                                    |
| ---- | -------------------------------------- | ---------------------------------------------------------- |
| 1    | `detect_entrypoints_using_ariadne.ts`  | Run detection for a package, compare against previous runs |
| 2    | `triage_false_negative_entrypoints.ts` | Analyze missed public API methods                          |
| 3    | `detect_dead_code.ts`                  | Auto-delete dead code (no callers or test-only)            |
| 4    | `triage_false_positive_entrypoints.ts` | Classify remaining false positives                         |
| 5    | Performed in claude session            | Run sub-agents to triage each false-positive group         |

## Output Location

All outputs go to `entrypoint-analysis/analysis_output/` with timestamped filenames.

| Output Type           | Filename Pattern                           |
| --------------------- | ------------------------------------------ |
| Detection results     | `{package}-analysis_<timestamp>.json`      |
| False negative triage | `false_negative_triage_<timestamp>.json`   |
| Dead code analysis    | `dead_code_analysis_<timestamp>.json`      |
| False positive triage | `false_positive_triage_<timestamp>.json`   |

**Timestamp format**: `YYYY-MM-DD_HH-mm-ss` (ISO 8601 with colons replaced by dashes, `T` by underscore)

**Finding the latest file**: Timestamps are lexicographically sortable. Sort alphabetically and take the last file.

## Ground Truth Files

Ground truth files are package-specific and located in `entrypoint-analysis/ground_truth/`:

| Package | Ground Truth File |
| ------- | ----------------- |
| core    | `core.json`       |
| mcp     | `mcp.json`        |
| types   | `types.json`      |

Each file contains an array of legitimate API methods: `[{ "name": "...", "file": "..." }, ...]`

## Prerequisites: Build packages

**IMPORTANT**: Before running the pipeline, rebuild all packages to ensure the analysis uses the latest code changes:

```bash
npm run build
```

The detection script imports from compiled JavaScript (`dist/`), not TypeScript source. Without rebuilding, your code changes won't be reflected in the analysis.

## Step 1: Run Detection

```bash
# Analyze a specific package (required)
npx tsx entrypoint-analysis/detect_entrypoints_using_ariadne.ts --package core
npx tsx entrypoint-analysis/detect_entrypoints_using_ariadne.ts --package mcp
npx tsx entrypoint-analysis/detect_entrypoints_using_ariadne.ts --package types

# Available options:
#   --package <name>   Required. Package to analyze (core, mcp, types)
#   --stdout           Output JSON to stdout only (skip file write)
#   --include-tests    Include test files in analysis
```

The script automatically:

- Analyzes the specified package for entry points
- Captures git version metadata (commit hash + working tree changes hash)
- Compares against the most recent analysis for the same package with a different code fingerprint
- Outputs comparison summary showing delta

**Output**: `analysis_output/{package}-analysis_<timestamp>.json`

### Interpret Results

- **IMPROVED** (fewer entry points): Changes successfully reduced false positives
- **REGRESSED** (more entry points): Call graph resolution may have regressed
- **No change**: Expected if recent changes didn't affect call resolution

## (Optional) Step 2: Triage False Negatives

```bash
npx tsx entrypoint-analysis/triage_false_negative_entrypoints.ts
```

Identifies public API methods that SHOULD be entry points but weren't detected.

The script dynamically determines the public API by:

1. Loading all packages into a Project instance
2. Extracting all non-private methods (where `access_modifier !== "private"`) from exported classes in designated public API files
3. Comparing against detected entry points by **name only** (no brittle line numbers)

**Output**: `analysis_output/false_negative_triage_<timestamp>.json`

## Step 3: Delete Dead Code

```bash
npx tsx entrypoint-analysis/detect_dead_code.ts
```

For each false positive entry point:

1. Uses AI agent to find all callers via Grep
2. Classifies as: `no-callers` | `test-only` | `has-production-callers`
3. Auto-deletes functions with no callers or only test callers (including their tests)
4. Outputs remaining entries for syntactic triage

**Output**: `analysis_output/dead_code_analysis_<timestamp>.json`

## Step 4: Triage False Positives

```bash
npx tsx entrypoint-analysis/triage_false_positive_entrypoints.ts
```

Classifies remaining false positives by root cause (inheritance, interface dispatch, dynamic calls, etc.) for further investigation.

**Output**: `analysis_output/false_positive_triage_<timestamp>.json`

## Step 5: Processing Triage Results

The false-positive triage output groups false positives by syntactic root cause. Each group should be investigated by a sub-agent:

1. **Spawn one sub-agent per group** - Each agent focuses on a single root cause category
2. **Validate the classification** - Check if the errors are real and well-defined (not noise or misclassification)
3. **Check for existing tasks** - Search the backlog to see if any tasks already address the root cause
4. **Report findings** - Document whether:
   - The root cause is valid and actionable
   - An existing task covers it (link the task)
   - A new task should be created (describe the fix)

## Key Metrics

- **Fewer entry points = Better** (better call graph resolution)
- Code fingerprint format: `{commit_short}_{working_tree_hash}`
- Ground truth is maintained per-package in `ground_truth/{package}.json`

## Example Output (Step 1)

```text
Analyzing package "core" at: /path/to/ariadne/packages/core
🔖 Code version: f6c4caf_8f549bb5bf8a8977
...
═══════════════════════════════════════════════════════
           Entry Point Comparison
═══════════════════════════════════════════════════════
Current:  42 entry points
Change:   -2 from previous (abc1234_clean)
Status:   📈 IMPROVING
═══════════════════════════════════════════════════════
```

## Example Output (Step 2)

```text
📊 Public methods (from semantic index): 15
   Detected entry points in API files: 14
✅ initialize - correctly detected
✅ update_file - correctly detected
...
❌ get_file_tree - MISSING from detection
```

## Status Meanings

- **📈 IMPROVING**: Fewer entry points than before
- **⚠️ REGRESSED**: More entry points than before
- **⏸️ NO CHANGE**: Same as previous run
- **🆕 First analysis**: No previous run to compare
