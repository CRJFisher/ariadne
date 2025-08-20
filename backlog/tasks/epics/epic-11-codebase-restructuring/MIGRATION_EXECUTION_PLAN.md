# Migration Execution Plan

## Overview

This document tracks the execution of all 41 migration tasks for restructuring the Ariadne codebase.

## Execution Order

We'll execute tasks in logical groups to maintain functionality:

### Phase 1: Setup New Structure
1. Rename src to src_old
2. Create new src folder with all subdirectories

### Phase 2: Foundation Layer (tasks 35-45)
- Migrate utilities and infrastructure first
- These have minimal dependencies

### Phase 3: Data Layer (tasks 25-34)
- Migrate storage, project, and graph management
- Depends on foundation

### Phase 4: High-Level Features (tasks 6-24)
- Migrate analysis features
- Depends on foundation and data layers

### Phase 5: API Layer (task 46)
- Create new index.ts
- Wire up all exports

### Phase 6: Cleanup
- Remove src_old
- Update all imports
- Run all tests

## Task Execution Checklist

For each task:
1. [ ] Research current implementation
2. [ ] Document findings in task file
3. [ ] Create new folder structure
4. [ ] Migrate code with functional paradigm
5. [ ] Migrate/create tests
6. [ ] Verify tests pass
7. [ ] Update task status
8. [ ] Commit changes

## Progress Tracking

### Foundation Layer ✅ COMPLETE
- [x] task-epic-11.35 - loader
- [x] task-epic-11.36 - javascript.scm
- [x] task-epic-11.37 - typescript.scm
- [x] task-epic-11.38 - python.scm
- [x] task-epic-11.39 - rust.scm
- [x] task-epic-11.40 - node_utils
- [x] task-epic-11.41 - query_executor
- [x] task-epic-11.42 - position_utils
- [x] task-epic-11.43 - path_utils
- [x] task-epic-11.44 - string_utils
- [x] task-epic-11.45 - collection_utils

### Data Layer - Storage ✅ COMPLETE
- [ ] task-epic-11.25 - project_manager
- [ ] task-epic-11.26 - file_tracker
- [ ] task-epic-11.27 - incremental_updates
- [x] task-epic-11.28 - storage_interface
- [x] task-epic-11.29 - memory_storage
- [x] task-epic-11.30 - disk_storage
- [x] task-epic-11.31 - cache_layer
- [ ] task-epic-11.32 - graph_builder
- [ ] task-epic-11.33 - graph_data
- [ ] task-epic-11.34 - graph_algorithms

### High-Level Features
- [x] task-epic-11.6 - function_calls ✅ DONE
- [x] task-epic-11.7 - method_calls ✅ DONE
- [x] task-epic-11.8 - constructor_calls ✅ DONE
- [ ] task-epic-11.9 - call_chain_analysis
- [ ] task-epic-11.10 - import_resolution
- [ ] task-epic-11.11 - export_detection
- [ ] task-epic-11.12 - namespace_resolution
- [ ] task-epic-11.13 - module_graph
- [ ] task-epic-11.14 - type_tracking
- [ ] task-epic-11.15 - return_type_inference
- [ ] task-epic-11.16 - parameter_type_inference
- [ ] task-epic-11.17 - type_propagation
- [ ] task-epic-11.18 - scope_tree
- [ ] task-epic-11.19 - symbol_resolution
- [ ] task-epic-11.20 - definition_finder
- [ ] task-epic-11.21 - usage_finder
- [ ] task-epic-11.22 - class_hierarchy
- [ ] task-epic-11.23 - method_override
- [ ] task-epic-11.24 - interface_implementation

### API Layer
- [ ] task-epic-11.46 - index.ts

## Notes

- Start with foundation as it has fewest dependencies
- Test continuously to catch issues early
- Document all decisions and findings
- Keep commits atomic and well-described