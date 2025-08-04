# Work Priority Guide

## 🚨 CRITICAL - Work on this FIRST

*All critical issues have been resolved!*

## 🔥 HIGH PRIORITY

*All high priority issues have been resolved!*

## 📋 MEDIUM PRIORITY - Important but not blocking

### task-82: Edge case tests (circular imports, etc.)

- Add tests for complex scenarios
- Circular imports, nested calls, inheritance

### task-92: Add validation test to CI/CD pipeline

- Automate the validation process
- Ensure no regressions in cross-file resolution

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

- Handle variable reassignments in type registry (task-81)
- Fix hoisted variable reference resolution (task-100)
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

- task-62: Agent validation issues
- task-67: Cross-file type registry for method resolution

❌ **Blocked**:

- task-74: File size limit - waiting for tree-sitter-node response

## Key Achievements

1. **Cross-file Resolution**: Now works for TypeScript, JavaScript, Python, and Rust
2. **Import Resolution**: Fixed TypeScript/JavaScript imports and Rust crate:: paths
3. **Function Counting**: Fixed double-counting and export detection
4. **Test Coverage**: Added 16 comprehensive import/export tests

## Next Steps

1. Add edge case tests (task-82)
2. Add validation test to CI/CD pipeline (task-92)
3. Complete remaining JavaScript test updates (task-99) - low priority
