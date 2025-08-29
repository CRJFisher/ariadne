---
id: task-epic-11.41
title: Migrate query_executor
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, foundation, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate tree-sitter query executor to src/ast/query_executor.ts

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where query_executor currently lives
- [ ] Document current implementation
- [ ] Identify dependencies

### Test Location

- [ ] Find all tests related to query_executor
- [ ] Document test coverage
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how query_executor connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Scope Queries**: Execute loaded queries
   - TODO: Run .scm queries
2. **Node Utils**: Use node utilities
   - TODO: Process query matches
3. **All Analysis Features**: Extract AST patterns
   - TODO: Provide query results

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface QueryExecutor { execute(query: Query, tree: Tree): QueryMatch[]; capture(match: QueryMatch, name: string): SyntaxNode; }
```

## Planning Phase

### Architecture Verification

- [ ] Verify against docs/Architecture.md patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan implementation approach

## Implementation Phase

### Code Migration

- [ ] Create/move to src/ast/query_executor.ts
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

1. In `query_executor.ts`:
   ```typescript
   // TODO: Integration with Scope Queries
   // - Run .scm queries
   // TODO: Integration with Node Utils
   // - Process query matches
   // TODO: Integration with All Analysis Features
   // - Provide query results
   ```

2. In language-specific files (if applicable):
   ```typescript

   ```