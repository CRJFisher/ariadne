---
id: task-epic-11.40
title: Migrate node_utils
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, foundation, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate AST node utilities to src/ast/node_utils.ts

## Research Phase

### Current Location

- [ ] Find where node_utils currently lives
- [ ] Document current implementation
- [ ] Identify dependencies

### Test Location

- [ ] Find all tests related to node_utils
- [ ] Document test coverage
- [ ] Identify missing test cases

## Planning Phase

### Architecture Verification

- [ ] Verify against docs/Architecture.md patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan implementation approach

## Implementation Phase

### Code Migration

- [ ] Create/move to src/ast/node_utils.ts
- [ ] Update implementation as needed
- [ ] Update all imports

### Test Migration

- [ ] Move/create tests as needed
- [ ] Ensure all tests pass
- [ ] Add missing test coverage

## Verification Phase

### Quality Checks

- [ ] All tests pass
- [ ] Follows rules/coding.md standards
- [ ] Files under 32KB limit
- [ ] Linting and type checking pass

## Notes

Research findings will be documented here during execution.
