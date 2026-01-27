---
name: self-entrypoint-analysis
description: Runs the entrypoint self-analysis pipeline on a specific package. Use when asked to run entrypoint detection, self-analysis, dead code detection, or false positive triage. Compares results against previous runs to track improvement.
allowed-tools: Bash(npx tsx:*), Read
---

# Entry Point Self-Analysis Pipeline

## Purpose

Verify whether recent changes to call graph detection logic improved entry point detection accuracy, and analyze/remediate false positives and false negatives.

## Pipeline Overview

The self-analysis pipeline consists of 4 steps. All scripts live under `entrypoint-analysis/src/self_analysis/`:

| Step | Script                                           | Purpose                                                    |
| ---- | ------------------------------------------------ | ---------------------------------------------------------- |
| 1    | `src/self_analysis/detect_entrypoints.ts`        | Run detection for a package, compare against previous runs |
| 2    | `src/self_analysis/triage_false_negatives.ts`    | Analyze missed public API methods                          |
| 3    | `src/self_analysis/detect_dead_code.ts`          | Auto-delete dead code (no callers or test-only)            |
| 4    | `src/self_analysis/triage_false_positives.ts`    | Classify and triage remaining false positives              |

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

## Step 1: Run Detection

```bash
# Analyze a specific package (required)
npx tsx entrypoint-analysis/src/self_analysis/detect_entrypoints.ts --package core
npx tsx entrypoint-analysis/src/self_analysis/detect_entrypoints.ts --package mcp
npx tsx entrypoint-analysis/src/self_analysis/detect_entrypoints.ts --package types

# Available options:
#   --package <name>   Required. Package to analyze (core, mcp, types)
#   --stdout           Output JSON to stdout only (skip file write)
#   --include-tests    Include test files in analysis
```

The script automatically:

- Analyzes the specified package for entry points
- Enriches each entry point with metadata from `CallableNode` (is_exported, access_modifier, callback_context, call_summary)
- Pre-gathers diagnostics: textual grep for call sites, Ariadne call reference matching, and a diagnosis
- Captures git version metadata (commit hash + working tree changes hash)
- Compares against the most recent analysis for the same package with a different code fingerprint
- Outputs comparison summary showing delta

**Output**: `analysis_output/{package}-analysis_<timestamp>.json`

### Enriched Entry Point Data

Each entry point includes:

- **Metadata**: `is_exported`, `access_modifier`, `is_static`, `is_anonymous`, `callback_context`, `call_summary`
- **Diagnostics**: `grep_call_sites` (textual matches), `ariadne_call_refs` (call graph matches), `diagnosis`
- **Diagnosis values**: `no-textual-callers` | `callers-not-in-registry` | `callers-in-registry-unresolved` | `callers-in-registry-wrong-target`

### Interpret Results

- **IMPROVED** (fewer entry points): Changes successfully reduced false positives
- **REGRESSED** (more entry points): Call graph resolution may have regressed
- **No change**: Expected if recent changes didn't affect call resolution

## (Optional) Step 2: Triage False Negatives

```bash
npx tsx entrypoint-analysis/src/self_analysis/triage_false_negatives.ts
```

Identifies public API methods that SHOULD be entry points but weren't detected.

The script dynamically determines the public API by:

1. Loading all packages into a Project instance
2. Extracting all non-private methods (where `access_modifier !== "private"`) from exported classes in designated public API files
3. Comparing against detected entry points by **name only** (no brittle line numbers)

**Output**: `analysis_output/false_negative_triage_<timestamp>.json`

## Step 3: Delete Dead Code

```bash
npx tsx entrypoint-analysis/src/self_analysis/detect_dead_code.ts
```

For each false positive entry point:

1. Uses AI agent to find all callers via Grep
2. Classifies as: `no-callers` | `test-only` | `has-production-callers`
3. Auto-deletes functions with no callers or only test callers (including their tests)
4. Outputs remaining entries for triage

**Output**: `analysis_output/dead_code_analysis_<timestamp>.json`

## Step 4: Triage False Positives

```bash
npx tsx entrypoint-analysis/src/self_analysis/triage_false_positives.ts --package core
npx tsx entrypoint-analysis/src/self_analysis/triage_false_positives.ts --package core --limit 10
```

Requires `--package <name>` to load ground truth for separating true positives from false positives. Accepts `--limit <n>` to cap how many unclassified entries are sent to LLM triage.

Three-stage pipeline that classifies false positives by root cause:

### Stage 1: Deterministic Pre-Classification

Uses `classify_entrypoints.ts` to apply ordered rules with no LLM cost:

| Rule | Condition | Classification |
| ---- | --------- | -------------- |
| 1 | No textual callers + exported | True positive (public API) |
| 2 | Constructor | False positive: `constructor-resolution-bug` |
| 3 | Protected/private method | False positive: `method-call-via-this-not-tracked` |
| 4 | Callback function | False positive: `callback-invocation-not-tracked` |

Entries with `callers-not-in-registry` or `callers-in-registry-unresolved` diagnoses are intentionally left unclassified — knowing there's a bug isn't enough, the LLM needs to identify the specific code pattern.

### Stage 2: Parallel Entry Investigation

Unclassified entries are investigated in parallel (5 concurrent workers) using a fast model with a structured debugging prompt. Each entry's pre-gathered diagnostic data (grep results, call references, diagnosis) is included in the prompt so the LLM can pinpoint the root cause without needing tool access.

### Stage 3: Aggregation

A single aggregation call reviews all entry analyses to:

- Group entries by shared root cause
- Merge duplicate/overlapping group IDs
- Provide high-level pattern recognition across entries

**Output**: `analysis_output/false_positive_triage_<timestamp>.json`

## Architecture: Key Modules

All modules live under `entrypoint-analysis/src/`:

| Module | Purpose |
| ------ | ------- |
| `extract_entry_points.ts` | Shared extraction with enriched metadata + diagnostics |
| `classify_entrypoints.ts` | Deterministic rule-based classification (no LLM) |
| `types.ts` | Shared type definitions (`EnrichedFunctionEntry`, `EntryPointDiagnostics`, etc.) |
| `agent_queries.ts` | Claude Agent SDK query helpers, parallel execution |
| `analysis_io.ts` | Analysis file lookup, JSON I/O |

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
