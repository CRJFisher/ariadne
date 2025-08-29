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

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where node_utils currently lives
- [ ] Document current implementation
- [ ] Identify dependencies

### Test Location

- [ ] Find all tests related to node_utils
- [ ] Document test coverage
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how node_utils connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **AST traversal**: All features need AST utils
   - TODO: Provide node helpers
2. **Query Executor**: Support query execution
   - TODO: Node matching utilities
3. **Position Utils**: Node position helpers
   - TODO: Get node positions

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface NodeUtils { get_node_text(node: SyntaxNode): string; find_parent(node: SyntaxNode, type: string): SyntaxNode | null; }
```

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

### Integration TODOs to Add

When implementing, add these TODO comments:

1. In `node_utils.ts`:
   ```typescript
   // TODO: Integration with AST traversal
   // - Provide node helpers
   // TODO: Integration with Query Executor
   // - Node matching utilities
   // TODO: Integration with Position Utils
   // - Get node positions
   ```

2. In language-specific files (if applicable):
   ```typescript

   ```