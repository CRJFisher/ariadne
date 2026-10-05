# Task epic-11.117.2: Update Python Import Resolver Unit Tests

**Status**: Completed
**Priority**: Medium
**Parent Task**: epic-11.117
**Depends On**: 117.1
**Blocks**: 117.3
**File**: `packages/core/src/resolve_references/import_resolution/import_resolver.python.test.ts`

## Objective

Update and expand unit tests for Python module resolution to ensure all import scenarios work correctly and prevent regressions.

## Prerequisites

- Task 117.1 must be complete (fixes to `import_resolver.python.ts`)
- Debug script from 117.1 should be passing

## Tasks

### Review Existing Tests
- [ ] Read current test file and identify coverage gaps
- [ ] Note which scenarios are already tested
- [ ] Identify missing test cases based on 117.1 fixes

### Add Missing Test Cases
- [ ] Bare module name imports (`"helper"` → `.../helper.py`)
- [ ] Projects without `__init__.py` files
- [ ] Resolution from different directory depths
- [ ] Single-dot relative imports (`.module`)
- [ ] Double-dot relative imports (`..module`)
- [ ] Multi-level relative imports (`..utils.helper`)
- [ ] Import path with dotted notation (`utils.helper`)

### Use Real Filesystem Paths
- [ ] Update tests to use `/tmp/ariadne-test/python/` structure
- [ ] Ensure test files actually exist on disk (like integration tests)
- [ ] Test both file and directory resolution (`.py` vs `__init__.py`)

### Edge Cases
- [ ] Missing files (should return fallback path)
- [ ] Invalid import paths (empty string, special characters)
- [ ] Root-level imports
- [ ] Circular import scenarios (document, may not implement)

### Test Organization
- [ ] Group tests by import type (bare, relative, absolute)
- [ ] Add descriptive test names
- [ ] Include comments explaining what's being tested

## Test Structure Template

```typescript
describe("resolve_module_path_python", () => {
  describe("Bare Module Imports", () => {
    it("should resolve bare module name in same directory", () => {
      const importing_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const import_path = "helper";

      const resolved = resolve_module_path_python(import_path, importing_file);

      expect(resolved).toBe("/tmp/ariadne-test/python/helper.py");
    });

    it("should resolve bare module name from subdirectory", () => {
      const importing_file = "/tmp/ariadne-test/python/utils/worker.py" as FilePath;
      const import_path = "helper";

      const resolved = resolve_module_path_python(import_path, importing_file);

      // Should look from project root, not current dir
      expect(resolved).toBe("/tmp/ariadne-test/python/helper.py");
    });

    it("should resolve package import (module with __init__.py)", () => {
      const importing_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const import_path = "utils";

      const resolved = resolve_module_path_python(import_path, importing_file);

      expect(resolved).toBe("/tmp/ariadne-test/python/utils/__init__.py");
    });
  });

  describe("Relative Imports", () => {
    it("should resolve single-dot import (same directory)", () => {
      const importing_file = "/tmp/ariadne-test/python/utils/worker.py" as FilePath;
      const import_path = ".helper";

      const resolved = resolve_module_path_python(import_path, importing_file);

      expect(resolved).toBe("/tmp/ariadne-test/python/utils/helper.py");
    });

    it("should resolve double-dot import (parent directory)", () => {
      const importing_file = "/tmp/ariadne-test/python/utils/worker.py" as FilePath;
      const import_path = "..helper";

      const resolved = resolve_module_path_python(import_path, importing_file);

      expect(resolved).toBe("/tmp/ariadne-test/python/helper.py");
    });

    it("should resolve multi-level relative import", () => {
      const importing_file = "/tmp/ariadne-test/python/utils/worker.py" as FilePath;
      const import_path = "..other.module";

      const resolved = resolve_module_path_python(import_path, importing_file);

      expect(resolved).toBe("/tmp/ariadne-test/python/other/module.py");
    });
  });

  describe("Dotted Path Imports", () => {
    it("should resolve dotted absolute import", () => {
      const importing_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const import_path = "utils.helper";

      const resolved = resolve_module_path_python(import_path, importing_file);

      expect(resolved).toBe("/tmp/ariadne-test/python/utils/helper.py");
    });

    it("should resolve deeply nested dotted import", () => {
      const importing_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const import_path = "utils.nested.module";

      const resolved = resolve_module_path_python(import_path, importing_file);

      expect(resolved).toBe("/tmp/ariadne-test/python/utils/nested/module.py");
    });
  });

  describe("Project Root Detection", () => {
    it("should find project root without __init__.py files", () => {
      const importing_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const import_path = "helper";

      const resolved = resolve_module_path_python(import_path, importing_file);

      // Should resolve from /tmp/ariadne-test/python/ even without __init__.py
      expect(resolved).toBe("/tmp/ariadne-test/python/helper.py");
    });

    it("should respect __init__.py package boundaries when present", () => {
      // Create a test with __init__.py to verify it's respected
      // This tests the topmost package detection logic
    });
  });

  describe("Edge Cases", () => {
    it("should return fallback path for non-existent module", () => {
      const importing_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const import_path = "nonexistent";

      const resolved = resolve_module_path_python(import_path, importing_file);

      // Should return expected path even if file doesn't exist
      expect(resolved).toBe("/tmp/ariadne-test/python/nonexistent.py");
    });

    it("should handle empty import path gracefully", () => {
      const importing_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const import_path = "";

      const resolved = resolve_module_path_python(import_path, importing_file);

      // Should handle gracefully, not crash
      expect(resolved).toBeDefined();
    });
  });
});
```

## Setup Requirements

Before running tests, ensure test directory structure exists:

```bash
mkdir -p /tmp/ariadne-test/python/utils/nested
touch /tmp/ariadne-test/python/main.py
touch /tmp/ariadne-test/python/helper.py
touch /tmp/ariadne-test/python/user.py
touch /tmp/ariadne-test/python/utils/helper.py
touch /tmp/ariadne-test/python/utils/worker.py
touch /tmp/ariadne-test/python/utils/nested/module.py

# Optional: Create package structure with __init__.py
touch /tmp/ariadne-test/python/utils/__init__.py
```

Or add to test setup:

```typescript
beforeAll(() => {
  // Ensure test files exist
  const files = [
    "/tmp/ariadne-test/python/main.py",
    "/tmp/ariadne-test/python/helper.py",
    // ... more files
  ];

  for (const file of files) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, "");
    }
  }
});
```

## Review Checklist

- [ ] All tests use actual filesystem paths (not mock)
- [ ] Test files exist on disk before tests run
- [ ] Tests cover scenarios fixed in 117.1
- [ ] Test names clearly describe what's being tested
- [ ] Edge cases are documented
- [ ] Tests are organized into logical groups (describe blocks)
- [ ] No regressions in existing tests

## Acceptance Criteria

- [x] All new tests pass
- [x] All existing tests still pass (no regressions)
- [x] Test coverage includes all scenarios from debug script (117.1)
- [x] Tests use `/tmp/ariadne-test/python/` structure
- [x] Edge cases are tested and documented
- [x] Test file is well-organized and readable

## Testing

Run the unit tests:
```bash
npx vitest run packages/core/src/resolve_references/import_resolution/import_resolver.python.test.ts
```

Expected output:
```
✓ packages/core/src/resolve_references/import_resolution/import_resolver.python.test.ts
  ✓ resolve_module_path_python
    ✓ Bare Module Imports
      ✓ should resolve bare module name in same directory
      ✓ should resolve bare module name from subdirectory
      ✓ should resolve package import (module with __init__.py)
    ✓ Relative Imports
      ✓ should resolve single-dot import (same directory)
      ✓ should resolve double-dot import (parent directory)
      ✓ should resolve multi-level relative import
    ... (more tests)

Test Files  1 passed (1)
     Tests  XX passed (XX)
```

## Reference

- Existing tests in file (review before adding)
- TypeScript import resolver tests (similar patterns)
- Python PEP 328: https://peps.python.org/pep-0328/
- Integration test requirements from task 117.3

## Next Steps

Once this task is complete:
1. All unit tests should be passing
2. Move to task 117.3 to validate integration tests
3. Document any findings in parent task 117

## Completion Summary

**Date Completed**: 2025-10-03
**Status**: ✅ All objectives achieved

### Test Results
- **Total unit tests**: 63/63 passing
- **Coverage**: All import scenarios (bare module, relative, absolute, package-based)
- **Backward compatibility**: All existing tests passing (zero regressions)

### What Was Added/Updated
- Comprehensive test coverage for standalone scripts (no `__init__.py`)
- Tests for bare module imports
- Tests for dotted path imports
- Tests for relative imports (single-dot, double-dot, triple-dot)
- Tests for nested package structures

### Test Execution
```bash
cd packages/core
npm test -- import_resolver.python.test.ts --run
# Result: 63 passed (63)
```

### Key Achievements
- ✅ Verified fix works for standalone scripts
- ✅ Verified backward compatibility with package-based projects
- ✅ All edge cases covered
- ✅ Zero regressions

### Files Modified
[import_resolver.python.test.ts](../../packages/core/src/resolve_references/import_resolution/import_resolver.python.test.ts) - Enhanced test coverage
