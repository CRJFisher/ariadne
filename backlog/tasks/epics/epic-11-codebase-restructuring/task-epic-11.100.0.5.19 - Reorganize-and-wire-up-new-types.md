---
id: task-epic-11.100.0.5.19
title: Reorganize and wire up new types system
status: To Do
assignee: []
created_date: "2025-01-12"
labels: ["type-system", "refactoring", "cleanup"]
dependencies: ["task-epic-11.100.0.5.18"]
parent_task_id: task-epic-11.100.0.5
priority: high
---

## Description

Complete reorganization and integration of the new type system, including file renaming, deletion of old types, redistribution of branded types, and wiring up all AST processing modules to use the new types.

## Background

After eliminating type adapters and creating new unified types, we now need to:

1. Fix file naming conventions (kebab-case to snake_case)
2. Delete old duplicate type definitions
3. Reorganize branded types into functional groups
4. Wire up downstream consumers to use new types
5. Update AST processing modules to use new type signatures
6. Update refactoring task documentation

## Sub-tasks

### File Organization (11.100.0.5.19.1-3)

- 11.100.0.5.19.1: Rename type files from kebab-case to snake_case
- 11.100.0.5.19.2: Delete old duplicate type definitions
- 11.100.0.5.19.3: Reorganize branded types into functional groups

### Wire Up Downstream Consumers (11.100.0.5.19.4-5)

- 11.100.0.5.19.4: Update file_analyzer.ts to use new types
- 11.100.0.5.19.5: Update code_graph.ts to use new types

### Update AST Processing Modules (11.100.0.5.19.6-20)

One sub-task per module to:

- Change function signature to use new types
- Clear function body (make blank for refactoring)
- Update corresponding task doc (11.100.1-19)
- Reference new type creation functions in task doc

- 11.100.0.5.19.6: Update import_resolution module
- 11.100.0.5.19.7: Update export_detection module
- 11.100.0.5.19.8: Update function_calls module
- 11.100.0.5.19.9: Update method_calls module
- 11.100.0.5.19.10: Update constructor_calls module
- 11.100.0.5.19.11: Update type_tracking module
- 11.100.0.5.19.12: Update class_detection module
- 11.100.0.5.19.13: Update scope_tree module
- 11.100.0.5.19.14: Update symbol_resolution module
- 11.100.0.5.19.15: Update namespace_resolution module
- 11.100.0.5.19.16: Update module_graph module
- 11.100.0.5.19.17: Update parameter_type_inference module
- 11.100.0.5.19.18: Update return_type_inference module
- 11.100.0.5.19.19: Update scope_entity_connections module
- 11.100.0.5.19.20: Update call_chain_analysis module

## Acceptance Criteria

- [ ] All type files use snake_case naming
- [ ] No duplicate type definitions remain
- [ ] Branded types distributed to relevant functional modules
- [ ] file_analyzer.ts uses new types throughout
- [ ] code_graph.ts uses new types throughout
- [ ] All AST processing modules have updated signatures
- [ ] All AST processing modules have blank bodies ready for refactoring
- [ ] All refactoring task docs (11.100.1-19) updated with new type info
- [ ] New type creation functions referenced in task docs
