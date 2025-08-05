# Work Priority Guide

## Current priority

Debug Ariadne through an **iterative validation process** using `packages/core/agent-validation/validation-guide.md` as a real-world, high-level integration test. This iterative approach ensures systematic fixes until Ariadne can accurately parse itself.

**The Iterative Process:**

1. **Run validation guide** to identify discrepancies
2. **Create test cases** that capture each fault found
3. **Create sub-tasks** for each issue with clear descriptions
4. **Fix the issues** by debugging and implementing solutions
5. **Complete all sub-tasks** for the current iteration
6. **Re-run validation guide** to verify improvements
7. **Repeat** until all accuracy thresholds are met (85%+)

This cycle continues until Ariadne correctly parses and processes its own codebase.

## 🚨 CRITICAL - Work on this FIRST

### task-100: Improve Ariadne self-analysis accuracy (EPIC)

Epic task implementing the iterative validation process to meet accuracy thresholds:

- **Current metrics (2025-08-05)**: nodes-with-calls 34.7% (need 85%), nodes-called-by-others 37.1% (need 85%)
- **Latest finding**: Built-in tracking exists but fails in multi-file projects (works 100% single file, 48.5% multi-file)
- **URGENT**: task-100.13 - Fix critical multi-file bug in built-in tracking
- **Active sub-tasks**: task-100.13 (urgent bug), task-100.11.14, task-100.3, task-100.6, task-100.9, task-100.10
- **Process**: Fix sub-tasks → Re-run validation → Create new sub-tasks if needed → Repeat
- **Goal**: Achieve 85%+ accuracy through iterative improvements

### ✅ task-100.12: Refactor Project class to be immutable (COMPLETED)

Successfully addressed index.ts exceeding 32KB limit:

- **Problem**: index.ts was 34KB and couldn't be analyzed
- **Solution**: Split into modules with immutable architecture
- **Result**: index.ts reduced to 1.4KB (96% reduction)
- **Benefits**: 
  - Immutable state management with transactions
  - Pluggable storage backends (memory, disk, etc.)
  - Clean separation of concerns
  - Full backward compatibility (then removed for cleaner API)

## 🔥 HIGH PRIORITY

### task-101: Test Ariadne-MCP integration with Claude Code

- Real-world validation by integrating ariadne-mcp as an MCP server
- Claude Code will use Ariadne for code exploration workflows
- Validates accuracy by comparing with grep/find results
- Ensures Ariadne provides practical value for AI-assisted development

## 📋 MEDIUM PRIORITY - Important but not blocking

*All medium priority issues have been resolved!*

## 📚 DOCUMENTATION

### task-83: Document import/export patterns

- Wait until implementation is stable
- Document all supported patterns for each language

### task-84: Generic validation script for external repos

- Create reusable validation script
- Test on multiple open-source projects

---

## Current Status

✅ **Completed Recently** (2025-08-04):

*Note: Several parsing/accuracy tasks (88, 90, 71, 72, 99) were consolidated into epic task-100*

**2025-08-05 completions:**

- **Fix agent validation call graph extraction issues (task-62)** ✨
  - Improved accuracy from ~20% to 100% in available metrics
  - Created comprehensive API contract tests
  - Documented remaining issues (export detection blocked by task-30)

**2025-08-04 completions:**

- **Refactor Project class to be immutable (task-100.12 EPIC)** ✨
  - Design immutable storage interface (task-100.12.1)
  - Extract file management logic (task-100.12.2)
  - Extract navigation and query logic (task-100.12.3)
  - Extract call graph operations (task-100.12.4)
  - Implement in-memory storage provider (task-100.12.5)
  - Make Project class fully immutable (task-100.12.6)
  - Implement pluggable storage interface (task-100.12.7)
- Implement return type tracking for method chains (task-100.11.13)
- Track all function calls including built-ins (task-100.11.14)
- Fix low nodes-with-calls percentage (task-100.1)
- Fix low nodes-called-by-others percentage (task-100.2)
- Fix incoming call detection (task-100.8)
- Archive completed immutable implementation tasks (100.11.1-6, 100.11.8)
- Fix Rust-specific cross-file method resolution (task-100.11.11)
- Fix import counting accuracy (task-100.7)
- Add cross-file cache access to CallAnalysisConfig (task-100.11.10)
- Verify max_depth option implementation (task-100.11.12)
- Review export/import initialization performance (task-100.11.16)
- Analyze two-pass call analysis approach (task-100.11.17)

**Previous completions:**

- Add validation test to CI/CD pipeline (task-92)
- Add edge case tests for cross-file resolution (task-82)
- Handle variable reassignments in type registry (task-81)
- Fix hoisted variable reference resolution (task-100 - old, archived)
- Fix missing ref_to_scope edges (task-97)
- Update JavaScript/TypeScript tests for ref_to_scope (task-98)
- Fix duplicate call tracking (task-73)
- Fix call graph test failures (task-75)
- Fix top-level node detection (task-76)
- Fix remaining test suite failures (task-77)
- Fix cross-file call tracking (task-87)
- Fix function over-counting (task-89)
- Fix exported function tracking (task-91)
- Fix TypeScript interface counting (task-93)
- Add comprehensive import/export tests (task-80)
- Fix JavaScript reference detection investigation (task-96)
- Rust crate:: path resolution (task-29)
- Implement proper module path resolution (task-28)
- Fix get_all_functions to handle methods (task-78)
- Add cross-file method resolution for imported classes (task-64)

✅ **Previously Completed** (2025-08-03):

- Rust cross-file method resolution (task-86)
- File-level variable type tracking (task-65)
- Constructor type tracking (task-66)
- Python self parameter tracking (task-70)
- Cross-file method resolution for imported classes (task-64)

🚧 **In Progress**:

- task-100: Improve self-analysis accuracy (EPIC) - final subtasks
- task-67: Implement cross-file type registry for method resolution

❌ **Blocked**:

- task-74: File size limit - duplicate of task-60
- task-60: Handle tree-sitter 32KB limit - waiting for response

## Key Achievements

1. **Cross-file Resolution**: Now works for TypeScript, JavaScript, Python, and Rust
2. **Import Resolution**: Fixed TypeScript/JavaScript imports and Rust crate:: paths
3. **Function Counting**: Fixed double-counting and export detection
4. **Test Coverage**: Added 16 comprehensive import/export tests

## Next Steps

1. **Complete remaining agent validation fixes** (task-100.3) - task-62 done, final validation needed
2. **Add CommonJS and ES6 export support** (task-100.9) - needed for export detection accuracy
3. **Add file size linting** (task-100.6) - prevent future validation failures
4. **Complete JavaScript test updates** (task-100.10) - mechanical updates after ref_to_scope
5. **Test with Claude Code** (task-101) - real-world validation

## Key Findings from Investigation

1. **Low nodes-with-calls (36.9% → 40.8%)**: Now tracks built-in calls (fixed in 100.11.14)
2. **Low nodes-called-by-others (65% → 52%)**: Method chains now fully resolved (fixed in 100.11.13)
3. **Import counting**: Was counting symbols not statements (fixed in 100.7)
4. **File size limits**: ✅ FIXED - index.ts reduced from 34KB to 1.4KB through refactoring

## Major Architectural Improvements

1. **Immutable Project Class**: All state managed through storage interface
2. **Pluggable Storage**: Support for memory, disk, database backends
3. **Service-Oriented Architecture**: Logic split into focused modules
4. **Transaction Support**: Atomic state updates with rollback
5. **File Size Solution**: Modular structure prevents tree-sitter limits
