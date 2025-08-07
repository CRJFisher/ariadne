# Epic 4: Performance & Scalability ⚡

**Priority: HIGH** - Critical for real-world use

## Goal
Optimize Ariadne for large codebases and ensure it can handle enterprise-scale projects efficiently.

## Tasks

### In Progress
- [ ] task-25: Optimize performance for large codebases
- [ ] task-60: Handle tree-sitter 32KB file size limitation
- [ ] task-74: Handle large files in call graph analysis
- [ ] task-100.12: Investigate low nodes-called-by-others percentage (37% vs 85%)

### Completed
- [x] task-100.31: Fix large file handling

## Refactoring Process
When optimizing performance:
1. Profile before optimizing
2. Apply `@rules/refactoring.md` for all changes
3. Follow `@rules/testing.md` for test coverage
4. Follow `@rules/coding.md` for code style
5. Document performance gains

## Success Criteria
- Can analyze 1M+ LOC codebases
- Analysis completes in <5 minutes for large projects
- Memory usage stays under 2GB
- Handles files up to 1MB gracefully