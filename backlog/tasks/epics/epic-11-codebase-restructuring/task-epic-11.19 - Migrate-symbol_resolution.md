---
id: task-epic-11.19
title: Migrate symbol_resolution feature
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, scope-analysis, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `symbol_resolution` feature to `src/scope_analysis/symbol_resolution/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where symbol_resolution currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to symbol_resolution
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how symbol_resolution connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Scope Tree**: Resolve symbols in scope hierarchy
   - TODO: Walk scope tree for resolution
2. **Import Resolution**: Resolve imported symbols
   - TODO: Check imports for external symbols
3. **Type Tracking**: Resolve typed symbols
   - TODO: Use type info for disambiguation
4. **Namespace Resolution**: Resolve qualified names
   - TODO: Handle namespace.member patterns

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface SymbolResolver { resolve(name: string, scope: ScopeNode): Def | undefined; }
interface ResolutionContext { scope: ScopeNode; imports: ImportInfo[]; types: TypeContext; }
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

- [ ] Create folder structure at src/scope_analysis/symbol_resolution/
- [ ] Move/create common symbol_resolution.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create symbol_resolution.test.ts
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

1. In `symbol_resolution.ts`:
   ```typescript
   // TODO: Integration with Scope Tree
   // - Walk scope tree for resolution
   // TODO: Integration with Import Resolution
   // - Check imports for external symbols
   // TODO: Integration with Type Tracking
   // - Use type info for disambiguation
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Namespace Resolution - Handle namespace.member patterns
   ```