# Top-Level Nodes Analysis

Self-analysis system to evaluate the accuracy of Ariadne's call graph detection and identify improvements.

## Architecture

### Two-Phase Analysis

#### Phase 1: API Coverage Analysis
Analyzes **project.ts** (the public API) to determine:
- ✅ Which public API methods were correctly detected as entry points
- ❌ Which public API methods were missed (FALSE NEGATIVES)
- ⚠️ Which private methods were wrongly exposed

**Script**: `phase1_api_coverage.ts`

**Outputs**:
- `results/api_correctly_detected.json` - TRUE POSITIVES
- `results/api_missing_from_detection.json` - FALSE NEGATIVES
- `results/api_internals_exposed.json` - Private methods wrongly detected

#### Phase 2: Internal Misidentifications Triage
Analyzes all detected entry points that are **NOT** in project.ts (all should be misidentifications).

For each misidentification:
1. Classifies the root cause
2. Performs triage analysis to understand the detection gap
3. Links to existing backlog tasks
4. Suggests fixes

**Script**: `phase2_internal_triage.ts`

**Output**:
- `results/internal_misidentified.json` - FALSE POSITIVES

## Directory Structure

```
top-level-nodes-analysis/
├── README.md                          # This file
├── package.json
├── types.ts                           # Shared type definitions
│
├── analyze_self.ts                    # Runs call graph analysis
├── phase1_api_coverage.ts             # Phase 1: API coverage analysis
├── phase2_internal_triage.ts          # Phase 2: Internal triage
│
├── ground_truth/
│   └── project_api_methods.json       # Manual list of public API
│
├── results/
│   ├── api_correctly_detected.json    # TRUE POSITIVES
│   ├── api_missing_from_detection.json # FALSE NEGATIVES
│   ├── api_internals_exposed.json     # Private methods exposed
│   └── internal_misidentified.json    # FALSE POSITIVES
│
└── [deprecated]/
    ├── verify_entry_points.ts         # Old single-phase script
    ├── correct_entry_points.json      # Old format
    └── misidentified_entry_points.json # Old format
```

## Usage

### Step 1: Run Call Graph Analysis

```bash
npx tsx analyze_self.ts
```

This generates: `../analysis_output/packages-core-analysis_<timestamp>.json`

### Step 2: Run Phase 1 (API Coverage)

```bash
npx tsx phase1_api_coverage.ts ../analysis_output/packages-core-analysis_<timestamp>.json
```

**What it does**:
- Compares detected entry points against ground truth API
- Identifies missing API methods (false negatives)
- Uses Claude Agent SDK to analyze WHY methods were missed
- Links to related backlog tasks

**Outputs**:
- `results/api_correctly_detected.json`
- `results/api_missing_from_detection.json`
- `results/api_internals_exposed.json`

### Step 3: Run Phase 2 (Internal Triage)

```bash
npx tsx phase2_internal_triage.ts ../analysis_output/packages-core-analysis_<timestamp>.json
```

**What it does**:
- Analyzes all non-project.ts entry points (should all be misidentified)
- Uses Claude Agent SDK to classify root cause
- Performs triage analysis to understand detection gaps
- Links to related backlog tasks
- Suggests concrete fixes

**Output**:
- `results/internal_misidentified.json`

## Output Schemas

### api_missing_from_detection.json (FALSE NEGATIVES)

```typescript
{
  "name": "initialize",
  "file_path": "packages/core/src/project/project.ts",
  "line": 126,
  "signature": "async initialize(...): Promise<void>",
  "triage_analysis": {
    "why_missed": "Method is async and may be called indirectly through constructor",
    "related_tasks": ["task-155-type-flow-inference"],
    "suggested_fix": "Track async method calls and initialization patterns"
  }
}
```

### internal_misidentified.json (FALSE POSITIVES)

```typescript
{
  "name": "process_definitions",
  "file_path": "packages/core/src/resolve_references/definition_processor.ts",
  "start_line": 42,
  "signature": "process_definitions(file: ParsedFile): Definition[]",
  "root_cause": "method called by parent class",
  "reasoning": "This method is called by SemanticIndexBuilder but the call is through an interface",
  "triage_analysis": {
    "detection_gap": "Interface method calls not tracked - only direct function calls detected",
    "related_tasks": ["task-155-type-flow-inference", "task-147-method-resolution"],
    "suggested_fix": "Implement interface resolution and track method calls through interfaces"
  }
}
```

## Ground Truth

The ground truth API is manually curated in `ground_truth/project_api_methods.json`.

**Public API Methods** (from Project class):
- `initialize(root_folder_abs_path?, excluded_folders?)`
- `update_file(file_id, content)`
- `remove_file(file_id)`
- `get_call_graph()`
- `get_all_scope_graphs()`
- `get_dependents(file_id)`
- `get_all_files()`
- `get_semantic_index(file_id)`
- `get_source_code(def, file_path?)`
- `get_definition(symbol_id)`
- `clear()`

Plus public registries: `definitions`, `types`, `scopes`, `exports`, `references`, `imports`, `resolutions`

## Key Insights

### Common Root Causes (FALSE POSITIVES)

- "method called by parent class"
- "internal utility function"
- "framework callback method"
- "builder pattern method"
- "test helper function"
- "private implementation detail"
- "exported for testing only"
- "method called through interface"
- "dynamic/indirect method call"

### Detection Gaps

1. **Interface method calls** - Not tracked by call graph
2. **Parent class calls** - Inheritance relationships not followed
3. **Dynamic calls** - Computed method names not resolved
4. **Async patterns** - Promise chains and async initialization
5. **Type flow** - Method calls through type aliases

## Backlog Task Integration

Both phases scan `backlog/tasks/` and `backlog/tasks/epics/epic-11-codebase-restructuring/` to:
- Link misidentifications to existing improvement tasks
- Identify which tasks would fix specific detection gaps
- Prioritize backlog work based on impact

## Notes

- Phase 1 and Phase 2 can be run independently
- Results are incremental - scripts skip already-processed entries
- Both phases use Claude Agent SDK with debugger prevention
- All prompts enforce JSON-only output (no tools, no code modification)
