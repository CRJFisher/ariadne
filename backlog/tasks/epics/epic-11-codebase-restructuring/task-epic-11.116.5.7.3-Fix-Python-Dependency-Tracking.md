# Task epic-11.116.5.7.3: Fix Python Dependency Tracking for Relative Imports

**Status:** Not Started
**Parent:** task-epic-11.116.5.7
**Depends On:** task-epic-11.116.5.7.1
**Priority:** Medium
**Created:** 2025-10-20

## Overview

Fix dependency tracking for Python files that use relative imports, so that `project.get_dependents(file)` correctly returns files that import from it.

## Problem

Python integration tests show that dependency tracking doesn't work for relative imports:
- `project.get_dependents(utils_file)` does not include `shadowing_file`
- This happens even though `shadowing.py` imports from `utils.py`
- The dependency graph is not tracking Python relative imports correctly

## Current Behavior

```typescript
// Test: should handle file removal and update dependents
const utils_file = file_path("modules/utils.py");
const shadowing_file = file_path("modules/shadowing.py");

project.update_file(utils_file, utils_source);
project.update_file(shadowing_file, shadowing_source); // imports from .utils

const dependents = project.get_dependents(utils_file);
expect(dependents.has(shadowing_file)).toBe(true); // FAILS - returns false
```

Test currently works around this:
```typescript
if (!dependents.has(shadowing_file)) {
  console.warn("Python dependency tracking not working correctly for relative imports");
  return; // Skip rest of test
}
```

## Expected Behavior

When a file imports from another file:
```python
# modules/shadowing.py
from .utils import helper, process_data
```

Then:
```typescript
const dependents = project.get_dependents(utils_file);
expect(dependents.has(shadowing_file)).toBe(true); // Should PASS
```

## Root Cause

This issue is **dependent on** task epic-11.116.5.7.1 (Fix Python Relative Import Resolution). The dependency graph is likely populated based on import resolution, so if imports don't resolve, dependencies won't be tracked.

## Dependency Chain

```
Import Path Resolution (task .7.1)
    ↓
Import Definition Creation
    ↓
Import Graph Population
    ↓
Dependency Tracking (task .7.3)
```

If relative import paths aren't resolved correctly (task .7.1), the import graph won't know that `shadowing.py` depends on `utils.py`.

## Investigation Steps

**Note:** Complete task epic-11.116.5.7.1 first, then investigate if this issue persists.

1. **Verify import graph construction**
   - Check `packages/core/src/project/import_graph.ts`
   - See how dependencies are tracked
   - Verify Python imports are added to the graph

2. **Check dependency retrieval**
   - Review `project.get_dependents()` implementation
   - Ensure it queries the import graph correctly
   - Verify reverse dependency lookup works

3. **Test after fixing relative imports**
   - After task .7.1 is complete, re-run this test
   - Check if dependency tracking now works
   - If not, debug import graph population

## Test Cases to Fix

### Test: Incremental Updates - File Removal
**File:** `packages/core/src/project/project.python.integration.test.ts`
**Test:** "should handle file removal and update dependents"
**Line:** ~535

Currently has workaround:
```typescript
// Python relative imports may not be tracked correctly yet
// This is a known limitation
if (!dependents.has(shadowing_file)) {
  console.warn("Python dependency tracking not working correctly for relative imports");
  return; // Skip rest of test
}
```

## Files to Review

- `packages/core/src/project/import_graph.ts`
- `packages/core/src/project/project.ts` - `get_dependents()` method
- Import graph population logic
- Dependency tracking in `update_file()` and `remove_file()`

## Success Criteria

- [ ] Task epic-11.116.5.7.1 is completed first
- [ ] `project.get_dependents()` returns correct dependent files for Python
- [ ] Files with relative imports are tracked in dependency graph
- [ ] Test passes without workarounds or early returns
- [ ] File removal properly invalidates dependent file imports

## Implementation Plan

1. **Wait for task .7.1 completion** (blocking)
   - Relative import resolution must work first
   - This task cannot proceed until dependencies resolve

2. **Re-test after .7.1** (15 min)
   - Run the failing test
   - Check if dependency tracking now works
   - If yes, just remove workaround and mark complete

3. **Debug if still failing** (1-2 hours)
   - Add logging to import graph population
   - Verify ImportDefinitions are being processed
   - Check if source file paths are correct
   - Ensure dependency edges are created

4. **Fix import graph** (if needed, 1-2 hours)
   - Update import graph to handle Python imports
   - Ensure reverse dependencies are tracked
   - Verify dependency removal on file removal

5. **Clean up test** (15 min)
   - Remove early return workaround
   - Ensure test properly verifies dependencies
   - Add assertions for dependency invalidation

## Estimated Effort

**1-3 hours** (after task .7.1 is complete)
- 15 min if .7.1 fixes it automatically
- 1-3 hours if additional import graph work is needed

## Notes

- **Blocking Dependency:** This task cannot be completed until task .7.1 is done
- May be automatically fixed by task .7.1 if the issue is purely import resolution
- If not, likely requires import graph updates to track Python imports
- Test should verify both dependency tracking and invalidation on file removal
- Consider whether this affects incremental re-indexing and file watching
