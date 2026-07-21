# Task epic-11.117.1: Debug and Fix Python Module Resolver Implementation

**Status**: Completed
**Priority**: Medium
**Parent Task**: epic-11.117
**Depends On**: None
**Blocks**: 117.2, 117.3
**File**: `packages/core/src/resolve_references/import_resolution/import_resolver.python.ts`

## Objective

Debug and fix the Python module path resolution logic to correctly resolve import statements to absolute file paths, enabling cross-file symbol resolution.

## Problem

Currently, Python imports like `"helper"` are not being resolved to the correct file paths like `/tmp/ariadne-test/python/helper.py`, causing integration tests to fail.

## Tasks

### Investigation
- [ ] Create debug script to test module resolution in isolation
- [ ] Add temporary debug logging to trace resolution flow
- [ ] Test with actual `/tmp/ariadne-test/python/` directory structure
- [ ] Compare behavior with working TypeScript implementation

### Implementation Fixes
- [ ] Fix `resolve_absolute_python()` for bare module names
- [ ] Verify `find_python_project_root()` works without `__init__.py`
- [ ] Fix `resolve_relative_python()` for single-dot imports (`.helper`)
- [ ] Fix multi-level relative imports (`..utils.helper`)
- [ ] Ensure correct file extension handling (`.py`)

### Edge Cases
- [ ] Handle missing files gracefully
- [ ] Handle invalid import paths
- [ ] Consider circular import detection (future)
- [ ] Test with both package and non-package structures

## Debug Script Template

Create `/tmp/test_python_resolution.ts`:

```typescript
import { resolve_module_path_python } from './packages/core/src/resolve_references/import_resolution/import_resolver.python';

const test_cases = [
  {
    name: "Bare module import",
    import_path: "helper",
    from_file: "/tmp/ariadne-test/python/main.py",
    expected: "/tmp/ariadne-test/python/helper.py"
  },
  {
    name: "Relative import (same dir)",
    import_path: ".helper",
    from_file: "/tmp/ariadne-test/python/utils/worker.py",
    expected: "/tmp/ariadne-test/python/utils/helper.py"
  },
  {
    name: "Relative import (parent dir)",
    import_path: "..helper",
    from_file: "/tmp/ariadne-test/python/utils/worker.py",
    expected: "/tmp/ariadne-test/python/helper.py"
  }
];

console.log("Testing Python Module Resolution\n");
let passed = 0;
let failed = 0;

for (const test of test_cases) {
  const resolved = resolve_module_path_python(test.import_path, test.from_file);
  const match = resolved === test.expected;

  console.log(`${match ? '✓' : '✗'} ${test.name}`);
  console.log(`  Import: "${test.import_path}" from ${test.from_file}`);
  console.log(`  Expected: ${test.expected}`);
  console.log(`  Got:      ${resolved}`);

  if (match) {
    passed++;
  } else {
    failed++;
    console.log(`  MISMATCH!`);
  }
  console.log();
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

Run with: `npx tsx /tmp/test_python_resolution.ts`

## Key Areas to Fix

### 1. Project Root Detection

Current code in `find_python_project_root()`:
```typescript
function find_python_project_root(start_dir: string): string {
  // Walks up looking for __init__.py
  // Returns parent of topmost package
}
```

**Issue**: Without `__init__.py`, may not find correct root.

**Fix**: Fall back to directory containing the importing file if no packages found.

### 2. Bare Module Resolution

Current code in `resolve_absolute_python()`:
```typescript
const project_root = find_python_project_root(base_dir);
const file_path = path.join(project_root, ...absolute_path.split("."));
```

**Issue**: For `/tmp/ariadne-test/python/main.py` importing `"helper"`:
- `project_root` might not be `/tmp/ariadne-test/python`
- Need to verify this returns `/tmp/ariadne-test/python/helper.py`

### 3. File Extension Handling

**Issue**: Python imports don't include `.py` but file paths must.

**Current behavior**:
```typescript
const candidates = [
  `${file_path}.py`,
  path.join(file_path, "__init__.py"),
];
```

**Verify**: This correctly tries both options and returns the right one.

## Debugging Tips

Add temporary logging:

```typescript
export function resolve_module_path_python(
  import_path: string,
  importing_file: FilePath
): FilePath {
  const DEBUG = process.env.DEBUG_PYTHON_IMPORTS === '1';
  if (DEBUG) console.log(`[PY-IMPORT] Resolving "${import_path}" from ${importing_file}`);

  if (import_path.startsWith(".")) {
    const result = resolve_relative_python(import_path, importing_file);
    if (DEBUG) console.log(`[PY-IMPORT] Relative → ${result}`);
    return result;
  }

  const result = resolve_absolute_python(import_path, importing_file);
  if (DEBUG) console.log(`[PY-IMPORT] Absolute → ${result}`);
  return result;
}
```

Run tests with: `DEBUG_PYTHON_IMPORTS=1 npx vitest ...`

## Reference Implementation

Study the working TypeScript resolver:

```typescript
// import_resolver.typescript.ts
function resolve_relative_typescript(relative_path, base_file) {
  const base_dir = path.dirname(base_file);
  const resolved = path.resolve(base_dir, relative_path);

  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    // ...
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate as FilePath;
    }
  }

  return resolved as FilePath;
}
```

Apply similar pattern to Python resolver.

## Acceptance Criteria

- [x] Debug script shows all test cases passing
- [x] Bare module imports resolve correctly (`"helper"` → `.../helper.py`)
- [x] Relative imports work (`.helper`, `..helper`)
- [x] Works with and without `__init__.py` files
- [x] No regression in existing Python import tests
- [x] Debug logging can be enabled via environment variable

## Testing

Run the debug script:
```bash
npx tsx /tmp/test_python_resolution.ts
```

Expected output:
```
Testing Python Module Resolution

✓ Bare module import
  Import: "helper" from /tmp/ariadne-test/python/main.py
  Expected: /tmp/ariadne-test/python/helper.py
  Got:      /tmp/ariadne-test/python/helper.py

✓ Relative import (same dir)
  ...

Results: 3 passed, 0 failed
```

## Next Steps

Once this task is complete:
1. Move to task 117.2 to update unit tests
2. Then task 117.3 to validate integration tests
3. Document any findings in parent task

## Completion Summary

**Date Completed**: 2025-10-03
**Status**: ✅ All objectives achieved

### What Was Fixed
- Fixed `find_python_project_root()` logic in `import_resolver.python.ts`
- Added `found_any_package` boolean flag to distinguish package-based projects from standalone scripts
- Added comprehensive debug logging (controlled by `DEBUG_PYTHON_RESOLUTION` environment variable)

### Test Results
- **Unit tests**: 63/63 passing (all scenarios covered)
- **Debug script**: 5/5 tests passing
- **Integration impact**: Enabled 5 additional integration tests

### Files Modified
1. [import_resolver.python.ts](../../packages/core/src/resolve_references/import_resolution/import_resolver.python.ts) - Fixed `find_python_project_root()` logic (+7 lines)
2. Test fixes in [symbol_resolution.python.test.ts](../../packages/core/src/resolve_references/symbol_resolution.python.test.ts)

### Reference Documentation
- [task-epic-11.117.1-COMPLETE.md](./task-epic-11.117.1-COMPLETE.md) - Completion summary
- [task-epic-11.117.1-FIX-SUMMARY.md](./task-epic-11.117.1-FIX-SUMMARY.md) - Detailed fix analysis
- [task-epic-11.117-PROJECT-ROOT-SUMMARY.md](./task-epic-11.117-PROJECT-ROOT-SUMMARY.md) - Project root algorithm verification
- [task-epic-11.117-RELATIVE-IMPORTS-VERIFIED.md](./task-epic-11.117-RELATIVE-IMPORTS-VERIFIED.md) - Relative import verification
