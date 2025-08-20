---
id: task-epic-11.38
title: Migrate python.scm
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, foundation, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate Python scope patterns to src/scope_queries/

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where python.scm currently lives
- [ ] Document current implementation
- [ ] Identify dependencies

### Test Location

- [ ] Find all tests related to python.scm
- [ ] Document test coverage
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how python.scm connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Loader**: Loaded by query loader
   - TODO: Provide Python scope queries
2. **Class Hierarchy**: Python classes
   - TODO: Python inheritance patterns
3. **Type Tracking**: Python type hints
   - TODO: Extract Python type hints

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
; TODO: Integration markers in .scm file
; Used by: scope_tree, class_hierarchy, type_tracking
```

## Planning Phase

### Architecture Verification

- [ ] Verify against docs/Architecture.md patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan implementation approach

## Implementation Phase

### Code Migration

- [ ] Create/move to src/scope_queries/python.scm
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

### Integration TODOs to Add

When implementing, add these TODO comments:

1. In `python.scm.ts`:
   ```typescript
   // TODO: Integration with Loader
   // - Provide Python scope queries
   // TODO: Integration with Class Hierarchy
   // - Python inheritance patterns
   // TODO: Integration with Type Tracking
   // - Extract Python type hints
   ```

2. In language-specific files (if applicable):
   ```typescript

   ```