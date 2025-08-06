# Epic 2: Import/Export Resolution System 📦

**Priority: MEDIUM** - Important for modern codebases

## Goal
Build a robust import/export resolution system that accurately tracks dependencies across all supported languages and module systems.

## Initial Audit Task
- [ ] Audit import/export resolution structure
  - Review `src/project/import_resolver.ts` organization
  - Check clarity of module resolution logic
  - Identify language-specific code that should be separated
  - Output: Refactoring sub-tasks

## Tasks

### In Progress
- [ ] task-100.40: Add namespace import resolution
- [ ] task-100.45: Add support for .mts/.cts TypeScript extensions
- [ ] task-79: Add support for Rust crate module paths

### To Do
- [ ] task-83: Document supported import/export patterns
- [ ] task-100.23: Add focused unit tests for import resolution
- [ ] task-100.25: Standardize import resolution patterns across services
- [ ] task-100.26: Simplify complex conditionals in import matching

### Completed
- [x] task-100.9: Add CommonJS and ES6 export support
- [x] task-100.41: Add graceful error handling for missing imports

## Refactoring Process
After audit, create refactoring sub-tasks that:
1. Improve module structure based on findings
2. Apply `@rules/refactoring.md` for all changes
3. Follow `@rules/testing.md` for test coverage
4. Follow `@rules/coding.md` for code style

## Success Criteria
- All import patterns correctly resolved
- Language-specific resolution clearly separated
- Error handling for missing imports
- >90% test coverage for resolution logic