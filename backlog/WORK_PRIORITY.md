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

- **Current metrics**: nodes-with-calls 36.9% (need 85%), nodes-called-by-others 65% (need 85%)
- **Iteration 1 findings**: Method calls not detected, file size limit causing skipped files
- **Active sub-tasks**: task-100.1 through task-100.10 (focusing on method call and file size issues)
- **Process**: Fix sub-tasks → Re-run validation → Create new sub-tasks if needed → Repeat
- **Goal**: Achieve 85%+ accuracy through iterative improvements

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

- Fix Rust-specific cross-file method resolution (task-100.11.11)
- Fix import counting accuracy (task-100.7)

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
- task-100.8: Fix incoming call detection (investigated, root cause identified)
- task-100.1: Fix nodes-with-calls percentage (investigated, root cause identified)
- task-100.2: Fix nodes-called-by-others percentage (same as 100.8)

❌ **Blocked**:

- task-74: File size limit - duplicate of task-60
- task-60: Handle tree-sitter 32KB limit - waiting for response

## Key Achievements

1. **Cross-file Resolution**: Now works for TypeScript, JavaScript, Python, and Rust
2. **Import Resolution**: Fixed TypeScript/JavaScript imports and Rust crate:: paths
3. **Function Counting**: Fixed double-counting and export detection
4. **Test Coverage**: Added 16 comprehensive import/export tests

## Next Steps

1. **Implement return type tracking** (task-100.11.13) - critical for method chains
2. **Track all function calls** (task-100.11.12) - include built-ins
3. **Complete remaining agent validation fixes** (task-100.3)
4. **Add CommonJS and ES6 export support** (task-100.9)
5. **Add file size linting** (task-100.6)
6. **Complete JavaScript test updates** (task-100.10)

## Key Findings from Investigation

1. **Low nodes-with-calls (36.9%)**: Only tracks internal calls, not built-in/external
2. **Low nodes-called-by-others (65%)**: Method chains like `obj.getInner().process()` only detect first call
3. **Import counting**: Was counting symbols not statements (fixed in 100.7)
