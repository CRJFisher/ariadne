---
id: task-epic-11.17
title: Migrate type_propagation feature
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, type-analysis, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `type_propagation` feature to `src/type_analysis/type_propagation/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where type_propagation currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to type_propagation
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how type_propagation connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Type Tracking**: Propagate types through assignments
   - TODO: Update type map on assignment
2. **Call Chain Analysis**: Propagate types through call chains
   - TODO: Flow types along call paths
3. **Scope Analysis**: Respect scope boundaries
   - TODO: Type flow within scope rules
4. **Module Graph**: Cross-module type flow
   - TODO: Propagate types across module boundaries

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface TypePropagator { propagate(from: TypedNode, to: TypedNode): void; }
interface TypeFlow { source: TypeInfo; target: string; path: string[]; }
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

- [ ] Create folder structure at src/type_analysis/type_propagation/
- [ ] Move/create common type_propagation.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create type_propagation.test.ts
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

1. In `type_propagation.ts`:
   ```typescript
   // TODO: Integration with Type Tracking
   // - Update type map on assignment
   // TODO: Integration with Call Chain Analysis
   // - Flow types along call paths
   // TODO: Integration with Scope Analysis
   // - Type flow within scope rules
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Module Graph - Propagate types across module boundaries
   ```