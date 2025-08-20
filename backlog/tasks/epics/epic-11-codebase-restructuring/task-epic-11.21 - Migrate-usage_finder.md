---
id: task-epic-11.21
title: Migrate usage_finder feature
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, scope-analysis, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `usage_finder` feature to `src/scope_analysis/usage_finder/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where usage_finder currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to usage_finder
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how usage_finder connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Scope Tree**: Search scopes for usages
   - TODO: Find all refs in scope tree
2. **Symbol Resolution**: Find symbol usages
   - TODO: Resolve all references to a definition
3. **Import Resolution**: Find cross-file usages
   - TODO: Track usage through imports
4. **Call Graph**: Find function call usages
   - TODO: Include calls as usages

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface UsageFinder { find_usages(def: Def): Ref[]; find_references(symbol: string): Ref[]; }
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

- [ ] Create folder structure at src/scope_analysis/usage_finder/
- [ ] Move/create common usage_finder.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create usage_finder.test.ts
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

1. In `usage_finder.ts`:
   ```typescript
   // TODO: Integration with Scope Tree
   // - Find all refs in scope tree
   // TODO: Integration with Symbol Resolution
   // - Resolve all references to a definition
   // TODO: Integration with Import Resolution
   // - Track usage through imports
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Call Graph - Include calls as usages
   ```