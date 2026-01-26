# Top-Level Nodes Analysis

Self-analysis system to evaluate the accuracy of Ariadne's call graph detection and identify improvements.

## Workflow Overview

The analysis consists of three steps that evaluate how accurately Ariadne detects entry points (functions that are never called internally):

```
┌─────────────────────────────────────────┐
│ Step 1: detect_entrypoints_using_ariadne│  Run Ariadne on packages/core
│                                         │  Output: analysis_output/*.json
└──────────────────┬──────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│ Step 2: Triage   │   │ Step 3: Triage   │
│ False Negatives  │   │ False Positives  │
│                  │   │                  │
│ API methods that │   │ Internal funcs   │
│ SHOULD be entry  │   │ wrongly detected │
│ points but were  │   │ as entry points  │
│ not detected     │   │                  │
└──────────────────┘   └──────────────────┘
```

## Scripts

### Step 1: `detect_entrypoints_using_ariadne.ts`

Runs Ariadne's call graph analysis on `packages/core` to detect entry points.

```bash
npx tsx detect_entrypoints_using_ariadne.ts
```

**Output**: `analysis_output/packages-core-analysis_<timestamp>.json`

Contains:

- All detected entry points (functions not called by other functions)
- File paths, line numbers, signatures
- Tree size (number of functions each entry point calls)

### Step 2: `triage_false_negative_entrypoints.ts`

Analyzes which public API methods were missed (false negatives).

Compares detected entry points against the ground truth API methods in `ground_truth/project_api_methods.json`. For each API method NOT detected as an entry point, uses Claude Agent SDK to investigate why.

```bash
npx tsx triage_false_negative_entrypoints.ts
```

**Outputs**:

- `results/api_correctly_detected.json` - TRUE POSITIVES
- `results/api_missing_from_detection.json` - FALSE NEGATIVES (with triage analysis)

### Step 3: `triage_false_positive_entrypoints.ts`

Analyzes internal functions wrongly detected as entry points (false positives).

All entry points NOT in `project.ts` are misidentifications. For each one, uses Claude Agent SDK to classify the root cause and suggest fixes.

```bash
npx tsx triage_false_positive_entrypoints.ts
```

**Output**: `results/internal_misidentified.json` - FALSE POSITIVES (with root cause analysis)

## Supporting Files

| File | Purpose |
|------|---------|
| `types.ts` | Shared TypeScript type definitions |
| `utils.ts` | Claude Agent SDK query helpers, file I/O utilities |
| `ground_truth/project_api_methods.json` | Manual list of public API methods (source of truth) |
| `verify_entry_points_legacy.ts` | Deprecated single-phase verification script |

## Directory Structure

```
top-level-nodes-analysis/
├── README.md
├── package.json
├── tsconfig.json
│
├── detect_entrypoints_using_ariadne.ts    # Step 1: Run analysis
├── triage_false_negative_entrypoints.ts   # Step 2: Find missed API methods
├── triage_false_positive_entrypoints.ts   # Step 3: Find misidentified internals
│
├── types.ts                               # Shared type definitions
├── utils.ts                               # Query helpers and utilities
├── verify_entry_points_legacy.ts          # Deprecated
│
├── ground_truth/
│   └── project_api_methods.json           # Manual list of public API
│
├── analysis_output/
│   └── packages-core-analysis_*.json      # Step 1 outputs (timestamped)
│
└── results/
    ├── api_correctly_detected.json        # TRUE POSITIVES
    ├── api_missing_from_detection.json    # FALSE NEGATIVES
    ├── api_internals_exposed.json         # Private methods in project.ts
    └── internal_misidentified.json        # FALSE POSITIVES
```

## Interpreting Results

### Goal: Minimize Entry Points

The ideal result is that **only the public API methods** are detected as entry points. Everything else should be called by something.

- **FALSE NEGATIVES** (API methods not detected): Indicates our API methods ARE being called internally, which may be expected if they delegate to internal implementations.
- **FALSE POSITIVES** (internal functions detected): Indicates call graph analysis gaps where we fail to track certain call patterns.

### Common Root Causes for False Positives

- "method called by parent class" - Inheritance not tracked
- "method called through interface" - Interface dispatch not resolved
- "dynamic/indirect method call" - Computed property access
- "framework callback method" - External framework calls the method
- "builder pattern method" - Chained calls not fully tracked

## Ground Truth API

The public API consists of methods on the `Project` class:

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize project with root folder |
| `update_file()` | Add/update a file |
| `remove_file()` | Remove a file |
| `get_call_graph()` | Get the call graph |
| `get_all_scope_graphs()` | Get all semantic indexes |
| `get_dependents()` | Get files depending on a file |
| `get_all_files()` | List all project files |
| `get_semantic_index()` | Get semantic index for a file |
| `get_source_code()` | Get source code for a definition |
| `get_definition()` | Get definition by symbol ID |
| `clear()` | Clear all project state |
