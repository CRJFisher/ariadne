# Task Reorganization Plan

## Current State Analysis

### Task-100 Sub-tasks Review

Task-100 started as "Improve Ariadne self-analysis accuracy" but became a catch-all for test fixes and edge cases. It contains 45+ sub-tasks that should be reorganized into proper epics.

### Identified Duplicates

- task-100.35 & task-100.43: Both "Fix JavaScript scope hoisting issues"
- task-100.36 & task-100.44: Both "Fix TypeScript TSX reference tracking"
- task-60 & task-74 & task-100.31: All address file size limitations

## Proposed Epic Structure

### Epic 1: Type System & Inference 🧠

**Priority: HIGH** - Core feature enhancement

**Initial Audit Task:**
- **NEW**: Audit type system module structure
  - Review folder organization in `src/call_graph/` and `src/types/`
  - Check module/function naming clarity
  - Identify oversized files needing split
  - Output: Refactoring sub-tasks

**Tasks to Move:**

- task-68: Add type inference for function returns and parameters
- task-67: Implement cross-file type registry for method resolution
- task-69: Implement two-pass analysis for comprehensive type resolution
- task-100.39: Support method chaining and return type tracking
- task-100.42: Fix variable reassignment type tracking ✅ (COMPLETED)

### Epic 2: Import/Export Resolution System 📦

**Priority: MEDIUM** - Important for modern codebases

**Initial Audit Task:**
- **NEW**: Audit import/export resolution structure
  - Review `src/project/import_resolver.ts` organization
  - Check clarity of module resolution logic
  - Identify language-specific code that should be separated
  - Output: Refactoring sub-tasks

**Tasks to Move:**

- task-100.9: Add CommonJS and ES6 export support ✅ (COMPLETED)
- task-100.40: Add namespace import resolution
- task-100.41: Add graceful error handling for missing imports ✅ (COMPLETED)
- task-100.45: Add support for .mts/.cts TypeScript extensions
- task-79: Add support for Rust crate module paths
- task-83: Document supported import/export patterns

### Epic 3: Language Support & Edge Cases 🌐

**Priority: LOW** - Nice to have

**Tasks to Move:**

- task-12: Add R language support
- task-13: Add COBOL language support
- task-100.43: Fix JavaScript scope hoisting issues
- task-100.44: Fix TypeScript TSX reference tracking
- task-100.35: [DELETE - duplicate of 100.43]
- task-100.36: [DELETE - duplicate of 100.44]

### Epic 4: Performance & Scalability ⚡

**Priority: HIGH** - Critical for real-world use

**Tasks to Move:**

- task-25: Optimize performance for large codebases
- task-60: Handle tree-sitter 32KB file size limitation
- task-74: [MERGE with task-60]
- task-100.31: Fix large file handling ✅ (COMPLETED)

### Epic 5: MCP Server Features 🔌

**Priority: MEDIUM** - Product differentiation

**Tasks to Move:**

- task-49: Add code tree visualization
- task-50: Add refactoring diff preview
- task-52: Test MCP implementation with open source agents
- task-54: Transform from navigation to context-oriented tools
- task-57: Improve MCP server documentation
- task-58: Add sub-agent capabilities
- task-101: Test MCP integration with Claude Code

### Epic 6: Call Graph & Analysis Enhancement 📊

**Priority: MEDIUM** - Core capability improvement

**Tasks to Move:**

- task-41: Add error handling and diagnostics for call graph API
- task-43: Add polymorphic call resolution
- task-59: Add tree-sitter parsing for control flow analysis
- task-102: Implement graph traversal methods
- task-100.38: Add recursive/self-referential call tracking ✅ (COMPLETED)

### Epic 7: Documentation & Testing 📚

**Priority: MEDIUM** - Essential for adoption

**Tasks to Move:**

- task-16: Improve root README documentation
- task-23: Create comprehensive API documentation
- task-24: Create integration tests for Code Charter
- task-84: Create generic validation script for external repositories
- task-103: Extract docstring and decorators in query service

### Epic 8: Bug Fixes & Regressions (CLOSE THIS EPIC) ✅

**Priority: COMPLETED** - Most issues resolved

**Completed Tasks (Archive):**

- task-100.18: Fix critical cross-file call tracking failure ✅
- task-100.20: Create dedicated ImportResolver service ✅
- task-100.20.1: Eliminate redundant NavigationService ✅
- task-100.27: Fix class inheritance analysis regression ✅
- task-100.28: Fix get_source_code regression ✅
- task-100.29: Fix incremental parsing ✅
- task-100.30: Fix cross-file call tracking for all languages ✅
- task-100.32: Fix method call detection on built-in types ✅
- task-100.37: Fix Rust cross-file method resolution ✅

### Epic 9: Test Suite Maintenance 🧪

**Priority: HIGH** - Critical for quality

**Initial Tasks:**
- **NEW**: Split oversized test files
  - Split `tests/call_graph.test.ts` (51KB) into logical modules
  - Split `tests/languages/javascript.test.ts` (41KB) into feature groups
  - Apply testing-standards.md after split
  
**Ongoing:**
- Monitor test file sizes (keep under 32KB)
- Review and enable skipped tests
- Maintain test coverage above 80%

## Refactoring Process for Each Epic

**Each Initial Audit Task should spawn a refactoring sub-epic with:**
1. Specific refactoring tasks based on audit findings
2. Apply `backlog/tasks/operations/testing-standards.md`
3. Apply `backlog/tasks/operations/coding-standards.md`

## New Operations/Maintenance Structure

### Create: `backlog/tasks/operations/` and `backlog/tasks/epics/`

This folder contains recurring processes, validation procedures, and maintenance tasks that need periodic execution.

#### Proposed Operations Tasks:

**1. Agent Validation Process**

- **File**: `agent-validation-process.md`
- **Frequency**: Weekly or before major releases
- **Output Location**: `validation-results/YYYY-MM-DD/`
- **Description**: Run comprehensive validation against Ariadne and diverse repos

**2. Test Suite Health Check**

- **File**: `test-suite-health-check.md`
- **Frequency**: Daily in CI, weekly manual review
- **Output Location**: `test-reports/`
- **Description**: Monitor skipped/failing tests, coverage trends

**3. Performance Benchmarking**

- **File**: `performance-benchmarking.md`
- **Frequency**: Before/after major changes
- **Output Location**: `benchmarks/YYYY-MM-DD/`
- **Description**: Track parsing speed, memory usage, large file handling

**4. Documentation Sync**

- **File**: `documentation-sync.md`
- **Frequency**: After each sprint
- **Output Location**: Update README.md, API docs
- **Description**: Ensure docs reflect current capabilities and limitations

**5. Dependency Audit**

- **File**: `dependency-audit.md`
- **Frequency**: Monthly
- **Output Location**: `security-reports/`
- **Description**: Check for vulnerabilities, update tree-sitter, etc.

**6. Release Checklist**

- **File**: `release-checklist.md`
- **Frequency**: Per release
- **Output Location**: GitHub releases
- **Description**: Version bump, changelog, test suite, validation

## Implementation Steps

### Phase 1: Create Structure (Immediate)

1. Create `backlog/tasks/operations/` folder
2. Create `backlog/tasks/epics/` folder structure
3. Move operations files to new location
4. Update CLAUDE.md with new folder documentation

### Phase 2: Task Migration (This Week)

1. Archive completed task-100 sub-tasks
2. Move tasks to appropriate epics
3. Delete duplicate tasks
4. Update task-100 to reference new structure

### Phase 3: Documentation (Next Week)

1. Update WORK_PRIORITY.md with new epic structure
2. Create epic overview documents
3. Document task dependencies

### Phase 4: Cleanup (Following Week)

1. Close task-100 as reorganized
2. Remove obsolete tasks
3. Update task numbering if needed

## Success Criteria

- [ ] All task-100 sub-tasks categorized into epics
- [ ] Operations folder created with at least 3 processes
- [ ] No duplicate tasks remain
- [ ] Clear hierarchy: Epics → Features → Tasks
- [ ] WORK_PRIORITY.md reflects new structure

## Benefits of Reorganization

1. **Clarity**: Major features visible at top level
2. **Focus**: Related work grouped together
3. **Maintenance**: Recurring tasks properly tracked
4. **Progress**: Easy to see what's done vs pending
5. **Planning**: Better sprint/milestone planning

## Notes

- Task-100 becomes a historical reference, closed as "Reorganized into epics"
- Operations tasks are living documents, updated based on learnings
- Each epic should have a clear owner/champion
- Consider using GitHub Projects to track epics visually
