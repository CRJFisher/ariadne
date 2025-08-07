---
id: task-100.15
title: Refactor call_analysis.ts to reduce file size below 32KB
status: Done
assignee: []
created_date: '2025-08-05 13:34'
updated_date: '2025-08-05 20:37'
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


## Implementation Notes

Successfully refactored the large call_analysis.ts file (32KB) into a modular structure using a folder-based approach. 

## Approach taken
- Created a new call_analysis/ folder with 8 focused modules
- Preserved the critical AST node identity fix for built-in calls
- Used immutable types from @ariadnejs/types package throughout
- Maintained all existing functionality with tests passing

## Features implemented or modified
- Split monolithic file into focused, single-responsibility modules:
  - range_utils.ts: Range calculation utilities (5.5KB)
  - call_detection.ts: Call pattern detection with AST fix (4.4KB)
  - constructor_analysis.ts: Constructor call analysis (7.1KB)
  - reference_resolution.ts: Reference resolution logic (8.3KB)
  - method_resolution.ts: Method-specific resolution (6.0KB)
  - types.ts: Shared interfaces (1.8KB)
  - core.ts: Main orchestration functions (10KB)
  - index.ts: Public API exports (625B)

## Technical decisions and trade-offs
- Used folder structure instead of flat files for better organization
- Imported types from @ariadnejs/types package to ensure immutability
- All modules are now under 28KB warning threshold
- Maintained backwards compatibility by preserving the same public API

## Modified or added files
- Deleted: packages/core/src/call_graph/call_analysis.ts
- Added: packages/core/src/call_graph/call_analysis/ (folder with 8 modules)
- Updated: Imports in call_graph_service.ts, graph_builder.ts, and tests
## Sub-tasks Created

1. task-100.15.1: Extract range utilities
2. task-100.15.2: Extract call detection functions
3. task-100.15.3: Extract constructor analysis
4. task-100.15.4: Extract reference resolution
5. task-100.15.5: Extract method resolution
6. task-100.15.6: Extract types and create core module
