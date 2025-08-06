# Epic 6: Call Graph & Analysis Enhancement 📊

**Priority: MEDIUM** - Core capability improvement

## Goal
Enhance the call graph analysis capabilities with better error handling, polymorphic resolution, and control flow analysis.

## Initial Audit Task
- [ ] Audit call graph module structure
  - Review `src/call_graph/` organization
  - Check for oversized modules
  - Identify unclear naming or structure
  - Output: Refactoring sub-tasks

## Tasks

### In Progress
- [ ] task-100.21: Split reference resolution into type-specific strategies
- [ ] task-100.22: Refactor CallAnalyzer to use clear two-phase separation
- [ ] task-100.19: Add proper error handling for unimplemented methods
- [ ] task-100.16: Clean up debug logging in call graph service
- [ ] task-100.24: Remove dead code and TODO placeholders

### To Do
- [ ] task-41: Add error handling and diagnostics for call graph API
- [ ] task-43: Add polymorphic call resolution
- [ ] task-59: Add tree-sitter parsing for control flow analysis
- [ ] task-102: Implement graph traversal methods

### Completed
- [x] task-100.38: Add recursive/self-referential call tracking

## Refactoring Process
After audit, create refactoring sub-tasks that:
1. Improve module structure based on findings
2. Apply `@rules/refactoring.md` for all changes
3. Follow `@rules/testing.md` for test coverage
4. Follow `@rules/coding.md` for code style

## Success Criteria
- Clear two-phase analysis separation
- Polymorphic calls correctly resolved
- Control flow properly analyzed
- Error handling comprehensive
- >85% test coverage