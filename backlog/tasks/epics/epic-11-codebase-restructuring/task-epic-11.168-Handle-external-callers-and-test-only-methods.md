# Task 11.168: Handle External Callers and Test-Only Methods

## Status: Planning

## Parent: epic-11-codebase-restructuring

## Overview

Some functions appear as entry points because their callers are outside the analyzed scope (e.g., scripts/) or only in test files. This task addresses how to handle these cases.

## False Positive Groups Addressed

This task addresses the following false positive groups from `top-level-nodes-analysis/results/false_positive_groups.json`:

1. **external-caller-outside-analysis-scope** (5 entries)
   - Functions called only from `scripts/` directory (not in `packages/core/src`)
   - Examples:
     - `format_json_output` called from `scripts/validate_captures.ts`
     - `run_validation` called from `scripts/validate_captures.ts`
     - `resolve_names` called from external consumers

2. **test-only-public-methods-detected-as-entry-points** (16 entries)
   - Public methods called only from test files (`*.test.ts`)
   - Examples:
     - `detect_cycle`, `get_stats` - utility methods for testing
     - `build_file_tree` - test helper
     - `has`, `get_all_files`, `get_all_definitions` - introspection methods

## Root Cause Analysis

### External Callers

The detection script analyzes only `packages/core/src`:

```typescript
// detect_entrypoints_using_ariadne.ts:167
const source_directory = path.join(cwd, 'packages/core/src');
```

Calls from `scripts/`, `top-level-nodes-analysis/`, or external packages are not included.

### Test-Only Methods

Test files (`*.test.ts`) are typically excluded from production analysis. Methods with callers only in tests appear uncalled in production scope.

## Solution Options

### Option A: Expand Analysis Scope (For External Callers)

Include additional directories in the analysis:

```typescript
const source_directories = [
  'packages/core/src',
  'scripts',
  'top-level-nodes-analysis'
];
```

**Pros**: Complete picture of all internal callers
**Cons**: Includes non-production code

### Option B: Annotate as External API (For External Callers)

Mark certain exports as "external API" that are expected to be entry points:

```typescript
/** @external-api */
export function format_json_output(...) { ... }
```

**Pros**: Explicit documentation of API surface
**Cons**: Requires manual annotation

### Option C: Accept as True Entry Points (For Both)

Some functions ARE legitimate entry points:
- Public API functions meant for external consumers
- Test utilities (entry points for test runner)

**Pros**: Accurate - these ARE entry points in their context
**Cons**: May not match "find dead code" use case

### Option D: Scope-Aware Entry Point Categories (Recommended)

Categorize entry points by their caller context:

```typescript
interface EntryPointCategory {
  kind: 'production_entry' | 'test_entry' | 'external_api' | 'dead_code';
  callers_in_scope: SymbolId[];
  callers_out_of_scope: string[];  // File paths outside analysis
}
```

## Implementation Plan

### 11.168.1: Expand Analysis Scope Option

Modify `detect_entrypoints_using_ariadne.ts` to optionally include:
- `scripts/` directory
- `top-level-nodes-analysis/` directory

### 11.168.2: Categorize Entry Points

Add entry point categorization:
1. Analyze caller file paths
2. Determine if callers are in test files
3. Determine if callers are outside analysis scope
4. Categorize accordingly

### 11.168.3: Filter/Report by Category

Modify false positive detection to:
1. Report category with each entry point
2. Allow filtering by category
3. Focus on "truly dead code" (no callers anywhere)

### 11.168.4: Consider Dead Code Deletion

For methods with NO callers (not even in tests):
- Mark as dead code candidates
- Consider deletion (see Task 11.166)

## Entries Analysis

### External Caller Entries (Keep as External API)

| Function | File | External Caller |
|----------|------|-----------------|
| `format_json_output` | validate_captures.ts | scripts/validate_captures.ts |
| `run_validation` | validate_captures.ts | scripts/validate_captures.ts |
| `get_transitive_dependents` | import_graph.ts | external consumers |
| `size` | scope_registry.ts | external consumers |
| `resolve_names` | resolution_registry.ts | external consumers |

### Test-Only Methods (Consider Action)

| Function | File | Action |
|----------|------|--------|
| `detect_cycle` | import_graph.ts | Keep - test utility |
| `get_stats` | import_graph.ts | Keep - diagnostics |
| `build_file_tree` | file_folders_test_helper.ts | Keep - test helper |
| `has` | definition_registry.ts | Keep - introspection |
| `get_all_files` | definition_registry.ts | Keep - introspection |
| `get_all_definitions` | definition_registry.ts | Keep - introspection |
| `clear` | definition_registry.ts | Keep - test cleanup |
| ... | ... | ... |

## Files to Modify

- `top-level-nodes-analysis/detect_entrypoints_using_ariadne.ts`
- `top-level-nodes-analysis/triage_false_positive_entrypoints.ts`

## Success Criteria

1. Entry points are categorized by caller context
2. External API functions are documented
3. Test-only methods are identified but not flagged as dead code
4. Truly dead code is identified

## Dependencies

- None - standalone analysis improvement

## Priority

Low - These are not false positives per se, but correctly identified entry points for their respective scopes.

## Notes

This task is more about **improving analysis reporting** than fixing actual call graph bugs. The detected entry points are technically correct - they ARE entry points for their respective scopes.
