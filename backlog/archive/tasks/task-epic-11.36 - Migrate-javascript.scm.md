---
id: task-epic-11.36
title: Migrate javascript.scm
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, foundation, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate JavaScript scope patterns to src/scope_queries/

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where javascript.scm currently lives
- [ ] Document current implementation
- [ ] Identify dependencies

### Test Location

- [ ] Find all tests related to javascript.scm
- [ ] Document test coverage
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how javascript.scm connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Loader**: Loaded by query loader
   - TODO: Provide JS scope queries
2. **Scope Tree**: Define JS scopes
   - TODO: JS-specific scope patterns
3. **Symbol Resolution**: JS symbol patterns
   - TODO: JS-specific resolution

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
; TODO: Integration markers in .scm file
; Used by: scope_tree, symbol_resolution, definition_finder
```

## Planning Phase

### Architecture Verification

- [ ] Verify against docs/Architecture.md patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan implementation approach

## Implementation Phase

### Code Migration

- [ ] Create/move to src/scope_queries/javascript.scm
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

1. In `javascript.scm.ts`:
   ```typescript
   // TODO: Integration with Loader
   // - Provide JS scope queries
   // TODO: Integration with Scope Tree
   // - JS-specific scope patterns
   // TODO: Integration with Symbol Resolution
   // - JS-specific resolution
   ```

2. In language-specific files (if applicable):
   ```typescript

   ```