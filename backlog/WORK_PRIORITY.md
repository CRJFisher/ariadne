# Work Priority 🎯

## Current Focus: Epic-Based Organization

The project has been reorganized into 10 epics for better tracking and prioritization. Each epic contains related tasks that advance a specific capability.

## High Priority Epics 🔴

### Epic 1: Type System & Inference
**Goal:** Implement comprehensive type tracking for method resolution  
**Why Critical:** Core functionality that enables accurate cross-file analysis  
**Next Steps:** 
1. Complete initial audit of type system modules
2. Implement return type inference (task-68)
3. Build cross-file type registry (task-67)

### Epic 4: Performance & Scalability
**Goal:** Handle enterprise-scale codebases efficiently  
**Why Critical:** Real-world usage requires analyzing large projects  
**Next Steps:**
1. Profile current bottlenecks (task-100.12)
2. Implement file chunking for >32KB files (task-60)
3. Optimize for 1M+ LOC codebases (task-25)

### Epic 9: Test Suite Maintenance
**Goal:** Keep tests fast, comprehensive, and within limits  
**Why Critical:** Quality assurance and preventing regressions  
**Next Steps:**
1. Split oversized test files immediately
2. Review and enable skipped tests
3. Maintain >80% coverage

## Medium Priority Epics 🟡

### Epic 2: Import/Export Resolution
**Goal:** Robust dependency tracking across module systems  
**Current State:** CommonJS/ES6 basics working, needs enhancement  
**Next:** Namespace imports, .mts/.cts support

### Epic 5: MCP Server Features
**Goal:** Enhanced AI agent integration  
**Current State:** Basic MCP working, needs features  
**Next:** Code visualization, sub-agents

### Epic 6: Call Graph Enhancement
**Goal:** Better analysis capabilities  
**Current State:** Needs refactoring and cleanup  
**Next:** Complete audit, then refactor

### Epic 7: Documentation & Testing
**Goal:** Comprehensive docs and tests  
**Current State:** Needs significant work  
**Next:** API docs, integration tests

### Epic 10: Language Expansion Framework
**Goal:** Systematic framework for adding new languages  
**Current State:** Need to build matrix framework first  
**Next:** Create Language-Feature-Testing matrix, then add 7 new languages

## Low Priority Epics 🟢

### Epic 3: Language Support & Edge Cases
**Goal:** Expand language coverage  
**Current State:** Core languages working  
**Next:** Fix edge cases as needed

## Completed Epic ✅

### Epic 8: Bug Fixes & Regressions
**Status:** ARCHIVED  
**Result:** All critical bugs fixed, cross-file tracking operational

## Test Status Summary
**Current:** 490 passing ✅ | 2 failing 🔧 | 17 skipped ⏭️

### Skipped Test Breakdown
- **7 tests:** JavaScript parsing edge cases (LOW priority)
- **8 tests:** Type tracking enhancements (MEDIUM priority)  
- **2 tests:** Framework-specific features (LOW priority)

### Key Finding
The tool is stable! Skipped tests are enhancements, not critical gaps.

## Weekly Process

1. **Monday:** Review epic progress, adjust priorities
2. **Daily:** Focus on highest priority incomplete tasks
3. **Friday:** Run validation, update metrics

## Success Metrics

- **Type System:** 90% return type inference accuracy
- **Performance:** <5 min for 1M LOC analysis
- **Tests:** 100% passing, >80% coverage, all <32KB
- **MCP:** Working with Claude Code
- **Documentation:** Complete API docs with examples

## Next Immediate Actions

1. **Split oversized test files** (Epic 9)
   - `call_graph.test.ts` (51KB)
   - `javascript.test.ts` (41KB)

2. **Run initial audits** (Epics 1, 2, 6)
   - Generate refactoring sub-tasks
   - Apply `@rules/refactoring.md`

3. **Document limitations** (Epic 7)
   - Method chaining not yet supported
   - Namespace imports pending
   - Return type inference limited

## Notes

- Apply `@rules/refactoring.md` to all changes
- Each epic has initial audit tasks - complete these first
- Create refactoring sub-tasks based on audit findings
- Track progress in epic README files