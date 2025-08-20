---
id: task-epic-11.18
title: Migrate scope_tree feature
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, scope-analysis, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `scope_tree` feature to `src/scope_analysis/scope_tree/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where scope_tree currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to scope_tree
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how scope_tree connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Symbol Resolution**: Provide scope hierarchy
   - TODO: Symbols resolved within scope tree
2. **Type Tracking**: Scope-local type contexts
   - TODO: Each scope has type context
3. **Definition Finder**: Find definitions in scope
   - TODO: Search scope tree for definitions
4. **Usage Finder**: Find usages in scope
   - TODO: Search scope tree for references

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface ScopeNode { type: ScopeType; symbols: Map<string, Def>; children: ScopeNode[]; parent?: ScopeNode; }
interface ScopeTree { root: ScopeNode; find_scope(pos: Position): ScopeNode; }
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

- [ ] Create folder structure at src/scope_analysis/scope_tree/
- [ ] Move/create common scope_tree.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create scope_tree.test.ts
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

1. In `scope_tree.ts`:
   ```typescript
   // TODO: Integration with Symbol Resolution
   // - Symbols resolved within scope tree
   // TODO: Integration with Type Tracking
   // - Each scope has type context
   // TODO: Integration with Definition Finder
   // - Search scope tree for definitions
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Usage Finder - Search scope tree for references
   ```