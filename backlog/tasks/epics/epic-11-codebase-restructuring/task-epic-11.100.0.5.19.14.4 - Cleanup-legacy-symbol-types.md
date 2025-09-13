---
id: task-epic-11.100.0.5.19.14.4
title: Clean up legacy SymbolInfo types and update references
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['cleanup', 'deprecation', 'types']
dependencies: ['task-epic-11.100.0.5.19.14.3']
parent_task_id: task-epic-11.100.0.5.19.14
priority: low
---

## Description

Remove or deprecate legacy `SymbolInfo` types and update all references to use the new `SymbolDefinition` approach across the codebase.

## Current State

The codebase likely still has references to old symbol extraction types that conflict with the new SymbolDefinition-based approach. This cleanup ensures consistency and prevents type confusion.

## Cleanup Tasks

### Type Removal
- [ ] Identify all `SymbolInfo` type usages across codebase
- [ ] Find legacy symbol extraction interfaces
- [ ] Locate old symbol processing functions
- [ ] Check for unused type imports

### Migration Actions
- [ ] Replace SymbolInfo with SymbolDefinition where appropriate
- [ ] Update function signatures using old types
- [ ] Fix import statements throughout codebase
- [ ] Update JSDoc and documentation references

### Deprecation Strategy
1. **Mark as deprecated**: Add @deprecated tags to old types
2. **Migration period**: Allow 1-2 sprint cycles for adaptation
3. **Breaking change**: Remove deprecated types in next major version
4. **Documentation**: Update all guides and examples

## Files Likely Affected
- Type definition files in packages/types
- Symbol processing modules
- Test files with symbol assertions
- Documentation and examples

## Success Criteria

- [ ] No references to legacy SymbolInfo types
- [ ] All symbol processing uses SymbolDefinition
- [ ] TypeScript compilation clean
- [ ] Documentation updated
- [ ] Breaking changes properly versioned

## Notes

This should be the final task in the symbol_resolution refactoring chain, ensuring complete migration to the new type system.