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

- **Current metrics**: nodes-with-calls 40.8% (need 85%), nodes-called-by-others 52.2% (need 85%)
- **Iteration 1 findings**: Method calls not detected, file size limit causing skipped files
- **Active sub-tasks**: task-100.3, task-100.6, task-100.9, task-100.10, task-100.12 (focusing on validation and file size issues)
- **Process**: Fix sub-tasks → Re-run validation → Create new sub-tasks if needed → Repeat
- **Goal**: Achieve 85%+ accuracy through iterative improvements

### task-100.12: Refactor Project class to be immutable (EPIC)

Critical sub-task to address index.ts exceeding 32KB limit (currently 34KB):

- **Problem**: index.ts cannot be analyzed by Ariadne due to file size
- **Solution**: Split Project class into smaller modules with immutable architecture
- **Sub-tasks**:
  - task-100.12.1: Design storage interface
  - task-100.12.2: Extract file management
  - task-100.12.3: Extract navigation logic
  - task-100.12.4: Extract call graph operations
  - task-100.12.5: Implement in-memory storage
  - task-100.12.6: Make Project immutable
  - task-100.12.7: Pluggable storage providers

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

**Today's completions:**

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

- task-100: Improve self-analysis accuracy (EPIC) - active subtasks
- task-100.3: Complete remaining agent validation fixes
- task-100.6: Add file size linting to prevent validation failures
- task-100.9: Add CommonJS and ES6 export support

❌ **Blocked**:

- task-74: File size limit - duplicate of task-60
- task-60: Handle tree-sitter 32KB limit - waiting for response

## Key Achievements

1. **Cross-file Resolution**: Now works for TypeScript, JavaScript, Python, and Rust
2. **Import Resolution**: Fixed TypeScript/JavaScript imports and Rust crate:: paths
3. **Function Counting**: Fixed double-counting and export detection
4. **Test Coverage**: Added 16 comprehensive import/export tests

## Next Steps

1. **Start Project refactoring epic** (task-100.12)
2. **Design storage interface** (task-100.12.1)
3. **Complete remaining agent validation fixes** (task-100.3)
4. **Add CommonJS and ES6 export support** (task-100.9)
5. **Add file size linting** (task-100.6)
6. **Complete JavaScript test updates** (task-100.10)

## Key Findings from Investigation

1. **Low nodes-with-calls (36.9% → 40.8%)**: Now tracks built-in calls (fixed in 100.11.14)
2. **Low nodes-called-by-others (65% → 52%)**: Method chains now fully resolved (fixed in 100.11.13)
3. **Import counting**: Was counting symbols not statements (fixed in 100.7)
4. **File size limits**: Two key files exceed 32KB and can't be analyzed
