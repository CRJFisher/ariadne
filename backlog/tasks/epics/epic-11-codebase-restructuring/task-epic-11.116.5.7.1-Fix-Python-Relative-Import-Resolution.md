# Task epic-11.116.5.7.1: Fix Python Relative Import Resolution

**Status:** Not Started
**Parent:** task-epic-11.116.5.7
**Priority:** High
**Created:** 2025-10-20

## Overview

Fix Python relative import resolution so that imports like `from .utils import helper` and `from .user_class import User` correctly resolve to their source definitions.

## Problem

Python integration tests reveal that relative imports (using `.` notation) do not resolve correctly:
- `from .utils import helper` - import is created but resolution fails
- `from .user_class import User` - import is created but resolution fails
- Absolute imports work correctly

This causes ImportDefinitions to exist but `project.definitions.get(resolved_symbol_id)` returns `undefined`.

## Root Cause Analysis Needed

Investigate why relative imports fail:
1. **Import path resolution** - Are relative paths being converted to absolute paths correctly?
2. **Module path matching** - Is the import graph matching Python relative imports to file paths?
3. **Symbol resolution** - Are ImportDefinitions being created with correct source file paths?

## Expected Behavior

When a file imports from a relative module:
```python
# modules/shadowing.py
from .utils import helper, process_data
```

The ImportDefinition should:
1. Resolve `.utils` to the correct file path (`modules/utils.py`)
2. Create ImportDefinition pointing to the source file
3. Allow `project.definitions.get(symbol_id)` to return the original function definition
4. The definition's `file_path` should contain `utils.py`

## Test Cases to Fix

These tests currently work around the limitation with conditional checks:

### Test 1: Module Resolution
**File:** `packages/core/src/project/project.python.integration.test.ts`
**Test:** "should resolve 'from module import name' imports"
**Line:** ~153

Currently shows warning:
```
Python relative import resolution not working yet for process_data import
```

### Test 2: Shadowing - Import Resolution
**Test:** "should resolve to import when no local shadowing occurs"
**Line:** ~313

Currently shows warning:
```
Python relative import resolution not working yet
```

### Test 3: Incremental Updates
**Test:** "should update dependent files when imported file changes"
**Line:** ~494

Currently shows warning:
```
Python relative import resolution not working yet
```

### Test 4: Dependency Tracking
**Test:** "should handle file removal and update dependents"
**Line:** ~535

Currently shows warning:
```
Python dependency tracking not working correctly for relative imports
```

## Investigation Steps

1. **Examine import processing for Python**
   - Check `packages/core/src/index_single_file/imports/`
   - Look at how Python tree-sitter captures imports
   - Review import path resolution logic

2. **Check import graph construction**
   - Review `packages/core/src/project/import_graph.ts`
   - See how Python relative imports are added to the graph
   - Verify path normalization for relative imports

3. **Test with debug logging**
   - Add logging to see what paths are being generated
   - Compare Python relative imports vs TypeScript/JavaScript imports
   - Check if the issue is in path resolution or symbol lookup

4. **Review symbol resolution**
   - Check `packages/core/src/resolve_references/`
   - Verify ImportDefinition creation for Python
   - Ensure source file paths are set correctly

## Files to Review

- `packages/core/src/index_single_file/imports/python_imports.ts` (if exists)
- `packages/core/src/project/import_graph.ts`
- `packages/core/src/project/project.ts` - import handling
- Python tree-sitter query files for imports
- `packages/core/src/resolve_references/resolve_imports.ts` (if exists)

## Success Criteria

- [ ] All 4 test cases pass without warnings or workarounds
- [ ] `from .module import name` resolves to correct source file
- [ ] `project.definitions.get(resolved_symbol_id)` returns valid definition
- [ ] Definition's `file_path` points to correct source file
- [ ] Dependency tracking works for Python relative imports
- [ ] Remove conditional checks and warnings from tests

## Implementation Plan

1. **Debug current behavior** (30 min)
   - Add logging to track import path resolution
   - Identify where relative paths fail to resolve

2. **Fix import path resolution** (1-2 hours)
   - Update Python import path resolution to handle `.` notation
   - Ensure relative paths are converted to absolute paths correctly
   - Match behavior to TypeScript/JavaScript relative imports

3. **Test and verify** (30 min)
   - Run Python integration tests
   - Verify all warnings are gone
   - Check that definitions resolve correctly

4. **Clean up tests** (15 min)
   - Remove conditional checks in tests
   - Remove console.warn statements
   - Ensure tests fail properly if resolution fails

## Estimated Effort

**2-3 hours**

## Notes

- This is likely a path resolution issue, not a fundamental architecture problem
- TypeScript/JavaScript relative imports (e.g., `from "./utils"`) work correctly
- Python uses different syntax (`.utils` vs `./utils`) but concept is the same
- May need to handle Python package structure differently than JS modules
