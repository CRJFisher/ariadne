---
id: task-100.11.4
title: Create immutable ProjectCallGraphData with update functions
status: Done
assignee:
  - '@chuck'
created_date: '2025-08-04 14:17'
updated_date: '2025-08-04 15:03'
labels:
  - immutable
  - refactoring
dependencies: []
parent_task_id: task-100.11
---

## Description

Design and implement an immutable ProjectCallGraphData structure with pure update functions. Use techniques like copy-on-write or structural sharing for efficiency. All updates should return new instances.

## Acceptance Criteria

- [x] ProjectCallGraphData is immutable
- [x] Update functions return new instances
- [x] Efficient structural sharing implemented
- [x] Helper functions for common updates
- [x] TypeScript types enforce immutability

## Implementation Plan

1. Analyze current ProjectCallGraph class structure
   - file_graphs Map
   - file_cache Map
   - type trackers
   - project registry
2. Create immutable_project_call_graph.ts module
3. Define immutable data structure:
   - ProjectCallGraphData interface
   - Use ReadonlyMap for collections
   - Ensure all nested structures are immutable
4. Implement core update functions:
   - add_file_graph() - adds/updates a file's graph
   - add_file_cache() - adds/updates file cache
   - update_file_type_tracker() - updates type tracker for a file
   - update_project_registry() - updates the registry
5. Implement helper functions:
   - batch_update_files() - update multiple files at once
   - merge_graphs() - merge two project graphs
   - clear_file_data() - remove a file's data
6. Use structural sharing for efficiency:
   - Only copy changed Maps
   - Reuse unchanged references
7. Add TypeScript readonly modifiers
8. Create comprehensive unit tests

## Implementation Notes

- Created immutable_project_call_graph.ts module (328 lines)
- Defined ProjectCallGraphData interface with all readonly collections:
  - ReadonlyMap for fileGraphs, fileCache, languages, fileTypeTrackers
  - Immutable ProjectTypeRegistryData
- Implemented core update functions:
  - add_file_graph() - adds/updates a file's graph with structural sharing
  - add_file_cache() - adds/updates file cache immutably
  - update_file_type_tracker() - updates type tracker for a file
  - update_project_registry() - updates the registry
- Implemented helper functions:
  - batch_update_files() - efficiently update multiple files at once
  - merge_project_graphs() - merge two project graphs (project2 takes precedence)
  - clear_file_data() - remove a file's data immutably
  - get_all_file_paths() - get unique paths from graphs and cache
  - has_file() - check if file exists in project
  - get_file_data() - retrieve all file data if present
- Created ProjectCallGraphUpdater class for builder pattern updates
- All functions use structural sharing - unchanged Maps are reused
- TypeScript readonly modifiers enforce compile-time immutability
- Created comprehensive unit tests (24 tests, all passing)
- File size: ~10KB (well under 32KB limit)
