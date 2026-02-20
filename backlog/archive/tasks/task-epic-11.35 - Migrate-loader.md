---
id: task-epic-11.35
title: Migrate loader
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, foundation, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the scope query loader to src/scope_queries/loader.ts

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where loader currently lives
- [ ] Document current implementation
- [ ] Identify dependencies

### Test Location

- [ ] Find all tests related to loader
- [ ] Document test coverage
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how loader connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Scope Queries**: Load language queries
   - TODO: Load .scm files
2. **File Tracker**: Determine file language
   - TODO: Map extensions to languages
3. **AST Utils**: Provide parser access
   - TODO: Load language parsers

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface QueryLoader { load_query(language: Language): Query; get_language_parser(language: Language): Parser; }
```

## Planning Phase

### Architecture Verification

- [ ] Verify against docs/Architecture.md patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan implementation approach

## Implementation Phase

### Code Migration

- [ ] Create/move to src/scope_queries/loader.ts
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

1. In `loader.ts`:
   ```typescript
   // TODO: Integration with Scope Queries
   // - Load .scm files
   // TODO: Integration with File Tracker
   // - Map extensions to languages
   // TODO: Integration with AST Utils
   // - Load language parsers
   ```

2. In language-specific files (if applicable):
   ```typescript

   ```