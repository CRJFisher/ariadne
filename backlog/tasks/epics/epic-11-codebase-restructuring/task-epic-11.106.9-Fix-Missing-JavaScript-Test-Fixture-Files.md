# Task Epic 11.106.9 - Fix Missing JavaScript Test Fixture Files

**Parent Task**: [task-epic-11.106](./task-epic-11.106-Remove-Unextractable-SymbolReference-Fields.md)
**Status**: ✅ Completed
**Priority**: Medium
**Estimated Effort**: 30 minutes
**Created**: 2025-10-02

## Objective

Create missing JavaScript test fixture files that are causing 4 semantic_index tests to fail, ensuring complete validation of JavaScript SymbolReference extraction.

## Context

During Epic 11.106 validation, 4 JavaScript semantic_index tests were found to fail due to missing fixture files. These failures are pre-existing (not caused by Epic 11.106 changes) but prevent complete validation of the JavaScript metadata extraction system.

**Evidence from task documents**:

- Mentioned in: task-epic-11.106 (lines 1169-1171)
- Mentioned in: task-epic-11.106-test-verification-results.md (lines 86-90)
- Mentioned in: task-epic-11.106-all-semantic-tests-results.md (lines 48-52, 181-193)

## Problem Statement

**Failing tests** (4 total):

```
FAIL  packages/core/src/index_single_file/semantic_index.javascript.test.ts
  ❌ should parse basic_function.js fixture
  ❌ should parse class_and_methods.js fixture
  ❌ should parse imports_exports.js fixture (2 tests)
```

**Error**:

```
ENOENT: no such file or directory, open '.../packages/core/tests/fixtures/javascript/basic_function.js'
ENOENT: no such file or directory, open '.../packages/core/tests/fixtures/javascript/class_and_methods.js'
ENOENT: no such file or directory, open '.../packages/core/tests/fixtures/javascript/imports_exports.js'
```

**Missing files**:

1. `packages/core/tests/fixtures/javascript/basic_function.js`
2. `packages/core/tests/fixtures/javascript/class_and_methods.js`
3. `packages/core/tests/fixtures/javascript/imports_exports.js`

## Success Criteria

- ✅ All 3 missing fixture files created
- ✅ All 4 failing tests now pass
- ✅ Fixtures contain appropriate JavaScript code to test SymbolReference extraction
- ✅ Fixtures match expected test assertions in `semantic_index.javascript.test.ts`
- ✅ Test coverage for JavaScript extraction is complete

## Implementation Steps

### 1. Analyze Failing Tests

Read the test file to understand what each fixture should contain:

```bash
Read packages/core/src/index_single_file/semantic_index.javascript.test.ts
```

Look for test assertions that reference these fixture files to understand expected content.

### 2. Create basic_function.js Fixture

**Expected content** (infer from test name and similar fixtures):

- Basic function declarations
- Function calls
- Variable declarations
- References to test basic semantic extraction

**Suggested structure**:

```javascript
// Basic function declaration
function greet(name) {
  return `Hello, ${name}!`;
}

// Function call
const result = greet("World");

// Variable assignments
let counter = 0;
const increment = () => counter++;

// Export (if needed)
module.exports = { greet, increment };
```

### 3. Create class_and_methods.js Fixture

**Expected content**:

- Class declarations
- Methods (instance and static)
- Constructor
- Method calls
- Property access

**Suggested structure**:

```javascript
// Class with methods
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  getName() {
    return this.name;
  }

  setName(name) {
    this.name = name;
  }

  static createAdmin(name) {
    return new User(name, `${name}@admin.com`);
  }
}

// Usage
const user = new User("Alice", "alice@example.com");
const userName = user.getName();
const admin = User.createAdmin("Bob");

module.exports = User;
```

### 4. Create imports_exports.js Fixture

**Expected content**:

- Import statements
- Export statements
- Named exports
- Default exports
- Re-exports (if needed)

**Suggested structure**:

```javascript
// Imports
const fs = require("fs");
const { readFile, writeFile } = require("fs/promises");

// Named exports
export function processData(data) {
  return data.map((item) => item.toUpperCase());
}

export const API_URL = "https://api.example.com";

// Default export
export default class DataProcessor {
  constructor(config) {
    this.config = config;
  }

  process(data) {
    return processData(data);
  }
}

// Re-export
export { readFile, writeFile };
```

### 5. Verify Fixture Location

Ensure files are created in correct directory:

```
packages/core/tests/fixtures/javascript/
├── basic_function.js
├── class_and_methods.js
└── imports_exports.js
```

### 6. Run Tests and Verify

Run the JavaScript semantic_index tests:

```bash
npx vitest run packages/core/src/index_single_file/semantic_index.javascript.test.ts
```

Expected result:

- ✅ All 4 previously failing tests now pass
- ✅ Total: 25/25 tests passing (up from 21/25)

### 7. Adjust Fixtures Based on Test Assertions

If tests still fail:

1. Read test assertions to understand exact expectations
2. Adjust fixture content to match
3. Re-run tests
4. Iterate until all pass

## Tree-Sitter Patterns to Test

Fixtures should exercise these JavaScript extraction patterns:

**Functions**:

```javascript
// Function declarations
function myFunc() {}

// Arrow functions
const arrow = () => {};

// Function expressions
const func = function () {};
```

**Classes**:

```javascript
// Class declarations
class MyClass {}

// Methods
class MyClass {
  method() {}
  static staticMethod() {}
}

// Constructor
class MyClass {
  constructor(param) {
    this.prop = param;
  }
}
```

**Imports/Exports**:

```javascript
// CommonJS
const module = require("module");
module.exports = {};

// ES6
import { named } from "module";
export default class {}
export const value = 42;
```

## Validation

After implementation, verify:

1. **Test Results**:

   ```bash
   npx vitest run packages/core/src/index_single_file/semantic_index.javascript.test.ts
   ```

   - Should show: `Tests: 25 passed (25 total)`
   - No ENOENT errors

2. **Fixture Content**:

   - Each fixture is valid JavaScript
   - Each fixture exercises relevant extraction patterns
   - Each fixture matches test expectations

3. **Cross-Language Parity**:
   - Compare with TypeScript/Python/Rust fixtures
   - Ensure similar test coverage across languages

## Files to Modify

**New files** (3):

- `packages/core/tests/fixtures/javascript/basic_function.js`
- `packages/core/tests/fixtures/javascript/class_and_methods.js`
- `packages/core/tests/fixtures/javascript/imports_exports.js`

**No changes needed**:

- Tests already written in `semantic_index.javascript.test.ts`
- Metadata extractors already working

## Dependencies

- None - this is purely adding missing test data files

## Risks

- **Low risk**: Only creating test fixtures, no code changes
- **Potential issue**: Might need to iterate on fixture content to match test expectations

## Follow-on Work

None - this task is self-contained.

## Notes

- This is a **pre-existing issue**, not caused by Epic 11.106
- Tests are already written and working (they just need the fixture files)
- Once fixtures are added, JavaScript will have same test coverage as TypeScript/Python/Rust
- These fixtures will help catch regressions in JavaScript metadata extraction

## References

- Parent task: [task-epic-11.106](./task-epic-11.106-Remove-Unextractable-SymbolReference-Fields.md)
- Test file: `packages/core/src/index_single_file/semantic_index.javascript.test.ts`
- Fixture directory: `packages/core/tests/fixtures/javascript/`
- Related documentation:
  - [task-epic-11.106-test-verification-results.md](./task-epic-11.106-test-verification-results.md)
  - [task-epic-11.106-all-semantic-tests-results.md](./task-epic-11.106-all-semantic-tests-results.md)

---

**Last Updated**: 2025-10-02
**Status**: ✅ Completed
**Completed**: 2025-10-02
**Blocked By**: None
**Blocks**: Complete JavaScript test coverage

## Implementation Notes

All three fixture files were created successfully:
- `basic_function.js`: Contains function declaration, function calls, and console.log (method call with receiver)
- `class_and_methods.js`: Contains Dog class with constructor, instance method (speak), and static method (getSpecies)
- `imports_exports.js`: Contains ES6 imports/exports with VERSION constant, processData function, DataProcessor class, and main function

All 4 previously failing tests now pass:
- ✅ should correctly parse basic_function.js fixture
- ✅ should correctly parse class_and_methods.js fixture
- ✅ should correctly parse imports_exports.js fixture (2 tests)

Total test results: **32 passed | 1 skipped (33 total)** - all JavaScript semantic_index tests passing.
