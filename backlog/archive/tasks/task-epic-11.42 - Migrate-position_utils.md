---
id: task-epic-11.42
title: Migrate position_utils
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, foundation, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate position/range utilities to src/ast/position_utils.ts

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where position_utils currently lives
- [ ] Document current implementation
- [ ] Identify dependencies

### Test Location

- [ ] Find all tests related to position_utils
- [ ] Document test coverage
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how position_utils connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Node Utils**: Position helpers for nodes
   - TODO: Node position utilities
2. **Definition Finder**: Position-based lookup
   - TODO: Find def at position
3. **Usage Finder**: Position-based search
   - TODO: Find refs at position

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface PositionUtils { contains(range: Range, pos: Position): boolean; compare(p1: Position, p2: Position): number; }
```

## Planning Phase

### Architecture Verification

- [ ] Verify against docs/Architecture.md patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan implementation approach

## Implementation Phase

### Code Migration

- [ ] Create/move to src/ast/position_utils.ts
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

1. In `position_utils.ts`:
   ```typescript
   // TODO: Integration with Node Utils
   // - Node position utilities
   // TODO: Integration with Definition Finder
   // - Find def at position
   // TODO: Integration with Usage Finder
   // - Find refs at position
   ```

2. In language-specific files (if applicable):
   ```typescript

   ```