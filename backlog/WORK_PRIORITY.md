# Work Priority Guide

## 🚨 CRITICAL - Work on this FIRST

### task-73: Fix duplicate call tracking causing test failures

- **Why**: This is blocking ALL test work. Methods are being processed multiple times.
- **Symptom**: Tests expect 2 calls but get 4 or 8
- **Where to look**:
  - `get_calls_from_definition` is being called multiple times
  - Check if methods appear with both 'method' and 'function' symbol_kinds
  - Look for duplicate processing in `build_call_graph`
- **Blocks**: tasks 75, 76, 77 (all test fixes)

## 🔥 HIGH PRIORITY - Work on these NEXT

### task-74: Fix file size limit (32KB)

- **Why**: Missing critical files like `project_call_graph.ts` (57KB)
- **Impact**: False top-level nodes, incomplete validation
- **Fix**: Increase limit in `validate-ariadne.ts` or implement chunking

### task-75, 76, 77: Fix test failures

- **Wait for**: task-73 to be completed first
- **Then fix**:
  - task-75: Call count issues
  - task-76: Top-level node issues  
  - task-77: Remaining failures

## 📋 MEDIUM PRIORITY - Important but not blocking

### task-78: Fix get_all_functions API

- Methods should be included, not just functions
- May be related to duplicate tracking issue

### task-79: Rust crate:: module paths

- Extension of completed Rust work (task-86)
- Add support for `crate::module::Type` imports

### task-81: Variable reassignments

- Type registry doesn't handle reassignments
- Example: `let x = Foo::new(); x = Bar::new();`

## 🧪 TESTING & VALIDATION

### task-80: Comprehensive import/export tests

### task-82: Edge case tests (circular imports, etc.)

### task-84: Generic validation script for external repos

## 📚 DOCUMENTATION

### task-83: Document import/export patterns

- Wait until implementation is stable

---

## Current Status

✅ **Completed Recently**:

- Rust cross-file method resolution (task-86)
- File-level variable type tracking (task-65)
- Constructor type tracking (task-66)
- Python self parameter tracking (task-70)

🚧 **In Progress**:

- task-62: Agent validation issues
- task-64: Cross-file method resolution for imported classes

❌ **Blocked**:

- Export detection (0% success) - needs task-30
