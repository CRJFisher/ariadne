---
id: task-100.15
title: Refactor call_analysis.ts to reduce file size below 32KB
status: To Do
assignee: []
created_date: '2025-08-05 13:34'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

The call_analysis.ts file has reached the 32KB limit (945 lines), preventing commits with file size checks enabled. This file needs to be refactored to split functionality into smaller, more focused modules using immutable patterns and pure functions.

## Acceptance Criteria

- [ ] All extracted modules are below 28KB warning threshold
- [ ] Core functionality is preserved
- [ ] All tests pass
- [ ] Code uses immutable data structures and pure functions
- [ ] No stateful classes - only data interfaces and functions
- [ ] Original call_analysis.ts is replaced by modular structure

## Implementation Plan

The 945-line call_analysis.ts will be split into 7 focused modules:

1. **range_utils.ts** (~100 lines) - Range calculation utilities
2. **call_detection.ts** (~150 lines) - Call pattern detection (includes AST fix)
3. **constructor_analysis.ts** (~150 lines) - Constructor call analysis
4. **reference_resolution.ts** (~200 lines) - Reference resolution logic
5. **method_resolution.ts** (~150 lines) - Method-specific resolution
6. **call_analysis_types.ts** (~45 lines) - Shared interfaces
7. **call_analysis_core.ts** (~150 lines) - Main orchestration functions

Total: ~945 lines split into modules of max 200 lines each

## Sub-tasks Created

1. task-100.15.1: Extract range utilities
2. task-100.15.2: Extract call detection functions
3. task-100.15.3: Extract constructor analysis
4. task-100.15.4: Extract reference resolution
5. task-100.15.5: Extract method resolution
6. task-100.15.6: Extract types and create core module
