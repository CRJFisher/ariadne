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

The 945-line call_analysis.ts will be split into 7 focused modules in a new `call_analysis/` folder:

```
src/call_graph/
├── call_analysis.ts (to be removed)
└── call_analysis/
    ├── index.ts (~20 lines) - Public API exports
    ├── types.ts (~45 lines) - Shared interfaces
    ├── range_utils.ts (~100 lines) - Range calculation utilities
    ├── call_detection.ts (~150 lines) - Call pattern detection (includes AST fix)
    ├── constructor_analysis.ts (~150 lines) - Constructor call analysis
    ├── reference_resolution.ts (~200 lines) - Reference resolution logic
    ├── method_resolution.ts (~150 lines) - Method-specific resolution
    └── core.ts (~150 lines) - Main orchestration functions
```

Benefits of folder structure:
- Clear separation from other call_graph modules
- Easy to locate all call analysis related code
- Clean imports via index.ts
- Allows for future expansion without cluttering call_graph/

## Sub-tasks Created

1. task-100.15.1: Extract range utilities
2. task-100.15.2: Extract call detection functions
3. task-100.15.3: Extract constructor analysis
4. task-100.15.4: Extract reference resolution
5. task-100.15.5: Extract method resolution
6. task-100.15.6: Extract types and create core module
