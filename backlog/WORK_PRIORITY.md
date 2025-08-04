# Work Priority Guide

## 🚨 CRITICAL - Work on this FIRST

### task-97: Fix missing ref_to_scope edges

- **Why**: References are not attached to their containing scopes, causing JavaScript/TypeScript test failures
- **Symptom**: All orphaned references appear at root level instead of proper scopes
- **Where to look**:
  - Scope graph construction where references are added
  - Need to create `ref_to_scope` edges when references are created
  - Check `addReference` or similar methods in scope graph builder
- **Blocks**: task-98 (JavaScript/TypeScript test updates)

## 🔥 HIGH PRIORITY - Work on these NEXT

### task-73: Fix duplicate call tracking causing test failures

- **Why**: This is blocking multiple test fixes. Methods are being processed multiple times.
- **Symptom**: Tests expect 2 calls but get 4 or 8
- **Where to look**:
  - `get_calls_from_definition` is being called multiple times
  - Check if methods appear with both 'method' and 'function' symbol_kinds
  - Look for duplicate processing in `build_call_graph`
- **Blocks**: tasks 75, 76, 77 (all test fixes)

### task-74: Fix file size limit (32KB)

- **Why**: Missing critical files like `project_call_graph.ts` (57KB)
- **Impact**: False top-level nodes, incomplete validation
- **Fix**: Increase limit or implement chunking

### task-98: Update JavaScript/TypeScript tests

- **Wait for**: task-97 to be completed first
- **Then**: Update test expectations to match correct scope hierarchy
- **Impact**: 8 JavaScript tests and 1 TypeScript test currently failing

## 📋 MEDIUM PRIORITY - Important but not blocking

### task-75, 76, 77: Fix test failures

- **Wait for**: task-73 to be completed first
- **Then fix**:
  - task-75: Call count issues
  - task-76: Top-level node issues  
  - task-77: Remaining failures

### task-81: Variable reassignments

- Type registry doesn't handle reassignments
- Example: `let x = Foo::new(); x = Bar::new();`

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

- Fix cross-file call tracking (task-87)
- Fix function over-counting (task-89)
- Fix exported function tracking (task-91)
- Fix TypeScript interface counting (task-93)
- Add comprehensive import/export tests (task-80)
- Fix JavaScript reference detection investigation (task-96)
- Rust crate:: path resolution (task-29)
- Implement proper module path resolution (task-28)

✅ **Previously Completed** (2025-08-03):

- Rust cross-file method resolution (task-86)
- File-level variable type tracking (task-65)
- Constructor type tracking (task-66)
- Python self parameter tracking (task-70)
- Cross-file method resolution for imported classes (task-64)

🚧 **In Progress**:

- task-62: Agent validation issues

❌ **Blocked**:

- Export detection improvements need investigation

## Key Achievements

1. **Cross-file Resolution**: Now works for TypeScript, JavaScript, Python, and Rust
2. **Import Resolution**: Fixed TypeScript/JavaScript imports and Rust crate:: paths
3. **Function Counting**: Fixed double-counting and export detection
4. **Test Coverage**: Added 16 comprehensive import/export tests

## Next Steps

1. Fix ref_to_scope edges (task-97) - CRITICAL
2. Update JS/TS tests after fix (task-98)
3. Fix duplicate call tracking (task-73)
4. Continue with test suite stabilization
