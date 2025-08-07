---
id: task-100.30
title: Fix cross-file call tracking for all languages
status: To Do
assignee: []
created_date: "2025-08-05 22:38"
updated_date: "2025-08-06 07:18"
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Cross-file method resolution is failing for JavaScript (CommonJS), TypeScript (ES6), Python, and Rust. Methods are incorrectly being marked as top-level nodes, and constructor calls are being included incorrectly in TypeScript.

## Root Cause Analysis

The issue is that method calls on imported class instances are not being resolved to the actual class methods. Instead, they're being treated as built-in functions. For example:

```javascript
// calculator.js
class Calculator {
  add(a, b) {
    return a + b;
  }
}
module.exports = Calculator;

// compute.js
const Calculator = require("./calculator");
function compute() {
  const calc = new Calculator();
  calc.add(5, 3); // <-- This resolves to <builtin>#add instead of calculator#Calculator.add
}
```

The type tracking system is not maintaining the connection between:

1. The imported class (`Calculator`)
2. The instance created (`calc`)
3. The method calls on that instance (`calc.add()`)

This affects all languages and is a fundamental limitation in the current type tracking implementation after the refactoring.

## Acceptance Criteria

- [ ] JavaScript CommonJS tests pass
- [ ] TypeScript ES6 import tests pass
- [ ] Python import tests pass
- [ ] Rust use statement tests pass
- [ ] Methods called within modules are not marked as top-level

## Implementation Notes

Successfully fixed cross-file call tracking for JavaScript (CommonJS), TypeScript (ES6), and Python. The core issue was that imported class methods were resolving to <builtin>#method instead of the actual class methods.

### Approach Taken

1. **Enhanced Export Detection**: Modified ScopeGraph.findExportedDef() to detect CommonJS exports by looking for module.exports patterns in addition to ES6 exports.
2. 

3. **Virtual File System Support**: Added virtual file resolution to ImportResolver.resolveModulePath() to handle in-memory test files properly.

4. **Fixed Method Resolution**: The combination of proper export detection and import resolution now correctly links method calls to their definitions across files.

### Features Implemented

- Cross-file method resolution for CommonJS imports (require/module.exports)
- Cross-file method resolution for ES6 imports (import/export)
- Cross-file method resolution for Python imports (from/import)
- Virtual file system support for testing

### Technical Decisions

- Added CommonJS detection by checking for 'module' references in root scope
- Virtual file resolution checks ProjectState before filesystem
- Marked CommonJS exports explicitly with is_exported flag

### Modified Files

- src/graph.ts: Enhanced findExportedDef() for CommonJS
- src/project/import_resolver.ts: Added virtual file resolution
- tests/cross_file_all_languages.test.ts: Comprehensive test coverage

### Test Results

- ✅ JavaScript CommonJS: All tests passing
- ✅ TypeScript ES6: All tests passing
- ✅ Python: All tests passing
- ⚠️ Rust: Partial (constructor works, methods don't) - Created task-100.37 for this

The main cross-file tracking functionality is now working for the primary languages. Rust needs additional work tracked in task-100.37.
