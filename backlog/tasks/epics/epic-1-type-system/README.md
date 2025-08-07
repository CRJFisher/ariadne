# Epic 1: Type System & Inference 🧠

**Priority: HIGH** - Core feature enhancement

## Goal
Implement comprehensive type inference and tracking to improve method resolution accuracy across function boundaries and enable advanced features like method chaining.

## Initial Audit Task
- [ ] Audit type system module structure
  - Review folder organization in `src/call_graph/` and `src/types/`
  - Check module/function naming clarity
  - Identify oversized files needing split
  - Output: Refactoring sub-tasks

## Tasks

### In Progress
- [ ] task-68: Add type inference for function returns and parameters
- [ ] task-67: Implement cross-file type registry for method resolution
- [ ] task-69: Implement two-pass analysis for comprehensive type resolution
- [ ] task-100.39: Support method chaining and return type tracking

### Completed
- [x] task-100.42: Fix variable reassignment type tracking

## Refactoring Process
After audit, create refactoring sub-tasks that:
1. Improve module structure based on findings
2. Apply `@rules/refactoring.md` for all changes
3. Follow `@rules/testing.md` for test coverage
4. Follow `@rules/coding.md` for code style

## Success Criteria
- Return types correctly inferred for 90% of functions
- Method chaining works for common patterns
- Cross-function type tracking operational
- All tests passing with >80% coverage