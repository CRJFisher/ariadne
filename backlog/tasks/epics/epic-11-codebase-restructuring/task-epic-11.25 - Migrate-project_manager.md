---
id: task-epic-11.25
title: Migrate project_manager feature
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, data-layer, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `project_manager` feature to `src/project/project_manager/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where project_manager currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to project_manager
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how project_manager connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **File Tracker**: Manage project files
   - TODO: Track all project files
2. **Incremental Updates**: Handle file changes
   - TODO: Update on file modifications
3. **Module Graph**: Build project module graph
   - TODO: Aggregate module relationships
4. **Storage Interface**: Persist project state
   - TODO: Save/load project data

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface ProjectManager { add_file(path: string): void; remove_file(path: string): void; get_state(): ProjectState; }
```

## Planning Phase

### Folder Structure

- [ ] Determine if sub-folders needed for complex logic
- [ ] Plan file organization per Architecture.md patterns
- [ ] List all files to create

### Architecture Verification

- [ ] Verify against docs/Architecture.md folder patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan dispatcher/marshaler pattern

## Implementation Phase

### Code Migration

- [ ] Create folder structure at src/project/project_manager/
- [ ] Move/create common project_manager.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create project_manager.test.ts
- [ ] Move/create language-specific test files
- [ ] Ensure all tests pass
- [ ] Add test contract if needed

## Verification Phase

### Quality Checks

- [ ] All tests pass
- [ ] Comprehensive test coverage
- [ ] Follows rules/coding.md standards
- [ ] Files under 32KB limit
- [ ] Linting and type checking pass

## Notes

Research findings will be documented here during execution.

### Integration TODOs to Add

When implementing, add these TODO comments:

1. In `project_manager.ts`:
   ```typescript
   // TODO: Integration with File Tracker
   // - Track all project files
   // TODO: Integration with Incremental Updates
   // - Update on file modifications
   // TODO: Integration with Module Graph
   // - Aggregate module relationships
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Storage Interface - Save/load project data
   ```