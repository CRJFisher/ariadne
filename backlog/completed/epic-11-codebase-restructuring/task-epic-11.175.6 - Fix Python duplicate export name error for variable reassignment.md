---
id: task-175.6
title: Fix Python duplicate export name error for variable reassignment
status: Completed
assignee: []
created_date: '2026-01-28'
completed_date: '2026-01-29'
labels:
  - bug
  - call-graph
  - epic-11
dependencies:
  - task-epic-11.175
---

## Description

Python variable reassignment at module level causes "Duplicate export name" errors when analyzing external codebases. This is valid Python code that should be handled gracefully.

When Python code has:

```python
predictions = load_data()  # line 190
predictions = transform_data()  # line 197
```

Each assignment creates a separate definition with a different SymbolId (because SymbolIds include location). Both are marked as exported (module-level). The ExportRegistry throws "Duplicate export name" error because the same name appears twice with different SymbolIds.

In Python, the last assignment "wins" - there's only one `predictions` symbol in the module namespace at runtime. The export registry should prefer the later definition.

## Evidence

From MCP server logs analyzing AmazonAdv/projections:

```
Duplicate export name "predictions" in file projections/demand_forecasting/llm_projections/chatgpt_projections.py.
  First:  variable:projections/demand_forecasting/llm_projections/chatgpt_projections.py:190:5:190:15:predictions
  Second: variable:projections/demand_forecasting/llm_projections/chatgpt_projections.py:197:5:197:15:predictions
This indicates a bug in is_exported logic or malformed source code.
```

Similar errors for:

- `predictions_df_copy` in `gemini_projections.py`
- `DIV_COL` in `accuracy_tables.py`
- `acct_mstyle_time_horizon_projections` in `fetch_projections.py`

## Implementation

**File: packages/core/src/resolve_references/registries/export.ts**

Add special case after the existing function/variable conflict handling (~line 137):

```typescript
// Special case 2: Variable/constant reassignment - prefer the later definition
// Python allows: `x = 1; x = 2` at module level
if (
  (existing.symbol_id.includes("variable:") || existing.symbol_id.includes("constant:")) &&
  (def.kind === "variable" || def.kind === "constant")
) {
  const existing_line = extract_line_from_symbol_id(existing.symbol_id);
  const current_line = def.location.start_line;

  if (current_line > existing_line) {
    // Current definition is later - replace existing
    metadata_map.set(export_name, {
      symbol_id: def.symbol_id,
      export_name,
      is_default,
      is_reexport,
      import_def,
    });
    symbol_ids.add(def.symbol_id);
    symbol_ids.delete(existing.symbol_id);
  }
  return; // Don't throw - this is valid reassignment
}
```

Add helper function:

```typescript
function extract_line_from_symbol_id(symbol_id: SymbolId): number {
  const parts = symbol_id.split(':');
  return parseInt(parts[2], 10); // parts[2] is start_line
}
```

## Acceptance Criteria

- [x] No "Duplicate export name" error thrown for variable reassignment at module level
- [x] The later definition is used as the canonical export
- [x] Unit tests cover: single reassignment, multiple reassignments, variable-to-constant reassignment
- [x] Re-run external analysis on AmazonAdv/projections shows no duplicate export errors

## Files to Modify

- packages/core/src/resolve_references/registries/export.ts
- packages/core/src/resolve_references/registries/export.test.ts

## Related

- task-epic-11.175 - Parent task (Fix top false positive groups from external analysis)

## Implementation Notes (2026-01-29)

### Approach

Created a Python-specific export handling module following the language-specific file naming convention (`export.python.ts`). The solution adds special-case handling in the `ExportRegistry.update_file()` method to detect Python variable reassignment and prefer the later definition.

### Files Changed

1. **packages/core/src/resolve_references/registries/export.python.ts** (new)
   - `extract_line_from_symbol_id()`: Parses SymbolId to extract the start line number
   - `should_replace_python_variable()`: Determines if current definition should replace existing based on line number
   - `is_variable_or_constant_symbol()`: Checks if SymbolId represents a variable or constant

2. **packages/core/src/resolve_references/registries/export.python.test.ts** (new)
   - Unit tests for all three helper functions
   - Tests for typical Python variable reassignment scenarios

3. **packages/core/src/resolve_references/registries/export.ts**
   - Added special case in `update_file()` after existing function/variable conflict handling
   - Only applies to Python files (checked via `is_python_file()`)
   - When duplicate variable/constant export detected, keeps the one with higher start_line

4. **packages/core/src/resolve_references/registries/export.test.ts**
   - Added integration tests for variable reassignment handling
   - Tests: single reassignment, multiple reassignments, reverse processing order, multiple variables

5. **packages/core/src/resolve_references/file_folders.ts**
   - Added `is_python_file()` helper function to check `.py` and `.pyw` extensions

### Technical Notes

- The fix is Python-specific because Python allows module-level variable reassignment as a normal pattern
- TypeScript/JavaScript would typically use `let` and wouldn't create multiple definitions for reassignment
- The solution preserves the later definition (higher line number) which matches Python's runtime semantics
- SymbolId format is `kind:file:start_line:start_col:end_line:end_col:name`, so `parts[2]` is the start line
