---
id: task-epic-11.62.18
title: Validate All Modules Follow Architecture.md Patterns
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, architecture, validation]
dependencies: []
parent_task_id: task-epic-11.62
---

## Description

Systematically validate that all modules in the codebase follow the patterns defined in Architecture.md, particularly the dispatcher pattern and file organization.

## Context

Task 11.47 raised concerns that need systematic validation:
- Some `index.ts` files might not use the correct dispatcher/marshaler pattern
- Language-specific logic might still be in monolithic files
- Tests might not be properly colocated with code
- The `index.ts` files should only contain exports and dispatching

## Acceptance Criteria

### Dispatcher Pattern Validation

- [ ] All feature index.ts files use explicit switch/if dispatch (not dynamic lookup)
- [ ] No use of function reference objects for language dispatch
- [ ] Clear separation between dispatcher and implementation

### File Organization

- [ ] Each feature with language-specific logic has separate .language.ts files
- [ ] Common logic is in the base module file (not index.ts)
- [ ] Index.ts files only contain exports and minimal dispatching
- [ ] Tests are colocated with implementation files

### Specific Checks

- [ ] No language-specific code in index.ts files
- [ ] No tests in separate /tests folder
- [ ] All tests use real tree-sitter parsers (not custom parsing)
- [ ] Maximum code reuse in common modules

## Implementation Plan

1. **Audit Phase**: List all feature modules
2. **Validation Phase**: Check each against Architecture.md
3. **Documentation Phase**: Create compliance report
4. **Fix Phase**: Create tasks for non-compliant modules

## Modules to Validate

### Priority 1 - Core Features
- `/call_graph/*`
- `/scope_analysis/*`
- `/import_export/*`
- `/type_analysis/*`
- `/inheritance/*`

### Priority 2 - Support Modules
- `/queries/*`
- `/utils/*`

## Testing Requirements

- [ ] Create automated architecture validation script
- [ ] Script checks for anti-patterns
- [ ] Script validates file structure
- [ ] Generate compliance report

## Success Metrics

- 100% modules follow dispatcher pattern
- 0 tests in separate /tests folder
- All language-specific code in .language.ts files
- Clear separation of concerns

## Notes

This is a systematic validation task to ensure architectural consistency across the entire codebase. It addresses the concerns raised in task 11.47 about code organization and patterns.

## References

- Architecture.md: `/docs/Architecture.md`
- Task 11.47: Connect-up-functionality-and-verify-completeness
- Processing Pipeline: `/docs/PROCESSING_PIPELINE.md`