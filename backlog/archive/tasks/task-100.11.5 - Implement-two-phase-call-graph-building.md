---
id: task-100.11.5
title: Implement two-phase call graph building
status: Done
assignee:
  - '@chuck'
created_date: '2025-08-04 14:17'
labels:
  - immutable
  - refactoring
dependencies: []
parent_task_id: task-100.11
---

## Description

Separate call graph building into distinct phases: 1) Analysis phase that collects all data without mutations, 2) Construction phase that builds the final immutable structures. This eliminates mutations during graph traversal.

## Acceptance Criteria

- [x] Clear separation between analysis and construction
- [x] Analysis phase collects all exports imports and calls
- [x] Construction phase builds final graph from collected data
- [x] No mutations during graph building
- [x] Results are fully immutable

## Implementation Plan

1. Analyze current call graph building process
   - build_call_graph() function flow
   - When type tracking happens
   - When exports/imports are processed
   - When calls are detected
2. Create immutable_graph_builder.ts module
3. Define data structures for collected information:
   - FileAnalysisData - collected data per file
   - ProjectAnalysisData - aggregated analysis results
   - BuildResult - final immutable graph
4. Implement Phase 1 - Analysis:
   - analyze_file() - analyze single file, return FileAnalysisData
   - collect_exports() - gather export information
   - collect_imports() - gather import information
   - collect_calls() - gather function calls
   - collect_type_info() - gather type discoveries
5. Implement Phase 2 - Construction:
   - build_from_analysis() - construct final graph from analysis
   - apply_type_discoveries() - apply all type info
   - resolve_cross_file_refs() - resolve imports/exports
   - construct_call_edges() - build call relationships
6. Create orchestrator function:
   - build_call_graph_two_phase() - coordinates both phases
   - Processes files in parallel during analysis
   - Constructs final graph sequentially
7. Add comprehensive tests for two-phase approach
8. Verify immutability throughout the process

## Implementation Notes

- Created immutable_graph_builder.ts module (331 lines)
- Defined clear data structures:
  - FileAnalysisData - per-file analysis results (exports, imports, calls, type tracker)
  - ProjectAnalysisData - aggregated project-wide results
  - TwoPhaseBuildConfig - configuration for the build process
- Implemented Phase 1 - Analysis:
  - analyze_file() - analyzes single file without mutations
  - analyze_all_files() - parallel analysis of all files
  - Collects exports, imports, function calls, and type discoveries
  - Returns immutable data structures
- Implemented Phase 2 - Construction:
  - build_from_analysis() - builds final graph from analysis data
  - Processes imports to connect cross-file references
  - Updates project registry with all exports
  - Uses batch updates for efficiency
- Created two main entry points:
  - build_call_graph_two_phase() - async version for parallel processing
  - build_call_graph_two_phase_sync() - sync version for compatibility
- Added comprehensive unit tests (15 tests, all passing)
- Achieved complete separation of concerns:
  - Analysis phase is read-only, no mutations
  - Construction phase builds from collected data
  - All results are fully immutable
- File size: ~10KB (well under 32KB limit)
