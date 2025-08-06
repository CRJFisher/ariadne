# Epic 9: Test Suite Maintenance 🧪

**Priority: HIGH** - Critical for quality

## Goal
Maintain a healthy, fast, and comprehensive test suite that stays within tree-sitter limits and provides confidence in the codebase.

## Immediate Tasks

### Oversized Test Files (>32KB limit)
- [ ] Split `tests/call_graph.test.ts` (51KB) into logical modules
  - Extract method resolution tests
  - Extract cross-file tests
  - Extract API tests
- [ ] Split `tests/languages/javascript.test.ts` (41KB) into feature groups
  - Extract parsing tests
  - Extract scope tests
  - Extract edge case tests

### Process
1. Split files into logical units
2. Apply `backlog/tasks/operations/testing-standards.md`
3. Ensure each file < 32KB
4. Maintain test organization clarity

## Ongoing Maintenance
- Monitor test file sizes weekly
- Review and enable skipped tests
- Maintain test coverage above 80%
- Fix flaky tests immediately

## Success Criteria
- All test files under 32KB
- Zero flaky tests
- Coverage > 80%
- Test runtime < 30 seconds
- Clear test organization