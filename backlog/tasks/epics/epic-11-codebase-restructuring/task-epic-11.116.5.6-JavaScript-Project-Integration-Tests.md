# Task epic-11.116.5.6: JavaScript Project Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116.5
**Depends On:** task-epic-11.116.5.2, task-epic-11.116.5.5
**Priority:** High
**Created:** 2025-10-16

## Overview

Create integration tests for the `Project` class using JavaScript fixtures. Tests both CommonJS and ES6 module systems, verifying the complete resolution pipeline for JavaScript-specific patterns.

## JavaScript-Specific Considerations

### Module Systems

JavaScript has TWO module systems that must be tested:

1. **CommonJS** (Node.js traditional)

   ```javascript
   // utils.js
   module.exports = { helper };

   // main.js
   const { helper } = require("./utils");
   ```

2. **ES6 Modules** (modern JavaScript)

   ```javascript
   // utils.js
   export function helper() {}

   // main.js
   import { helper } from "./utils";
   ```

### Key Differences from TypeScript

- No type annotations (resolution is purely lexical)
- No TypeScript-specific features (interfaces, type aliases, enums)
- Dynamic property access patterns
- Prototype-based class methods (older code)
- IIFE patterns, closures more common

## Test File Structure

Create: `packages/core/src/project/project.javascript.integration.test.ts`

## Test Categories

### 1. CommonJS Module Resolution

```typescript
describe("Project Integration - JavaScript (CommonJS)", () => {
  it("should resolve require() imports", async () => {
    const project = new Project();
    await project.initialize();

    const utils = load_source("modules/utils_commonjs.js");
    const main = load_source("modules/main_commonjs.js");

    project.update_file("utils_commonjs.js" as FilePath, utils);
    project.update_file("main_commonjs.js" as FilePath, main);

    // Verify require() creates import definitions
    const main_index = project.get_semantic_index(
      "main_commonjs.js" as FilePath
    );
    const imports = Array.from(main_index.imported_symbols.values());
    expect(imports.length).toBeGreaterThan(0);

    // Verify cross-file resolution
    const call = main_index.references.find((r) => r.type === "call");
    const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
    expect(resolved).toBeDefined();
  });

  it("should handle module.exports patterns", async () => {
    // Test various module.exports patterns:
    // - module.exports = { ... }
    // - module.exports.foo = ...
    // - exports.bar = ...
  });
});
```

### 2. ES6 Module Resolution

```typescript
describe("Project Integration - JavaScript (ES6 Modules)", () => {
  it("should resolve import/export", async () => {
    const project = new Project();
    await project.initialize();

    const utils = load_source("modules/utils_es6.js");
    const main = load_source("modules/main_es6.js");

    project.update_file("utils_es6.js" as FilePath, utils);
    project.update_file("main_es6.js" as FilePath, main);

    // Verify ES6 import creates import definitions
    const main_index = project.get_semantic_index("main_es6.js" as FilePath);
    const imports = Array.from(main_index.imported_symbols.values());
    expect(imports.length).toBeGreaterThan(0);

    // Verify cross-file resolution
    const call = main_index.references.find((r) => r.type === "call");
    const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
    expect(resolved).toBeDefined();
  });
});
```

### 3. Class Methods (Both Syntaxes)

```typescript
describe("Class Methods", () => {
  it("should resolve ES6 class methods", async () => {
    const project = new Project();
    await project.initialize();

    const source = load_source("classes/methods.js");
    project.update_file("methods.js" as FilePath, source);

    const index = project.get_semantic_index("methods.js" as FilePath);

    // Find class
    const classes = Array.from(index.classes.values());
    expect(classes.length).toBeGreaterThan(0);

    // Find method call
    const method_call = index.references.find(
      (r) => r.type === "call" && r.call_type === "method"
    );
    expect(method_call).toBeDefined();

    // Verify resolution
    const resolved = project.resolutions.resolve(
      method_call!.scope_id,
      method_call!.name
    );
    expect(resolved).toBeDefined();
  });

  it("should handle prototype methods", async () => {
    // Test older JavaScript pattern:
    // function User(name) { this.name = name; }
    // User.prototype.getName = function() { return this.name; };
  });
});
```

### 4. JavaScript-Specific Patterns

```typescript
describe("JavaScript Patterns", () => {
  it("should handle IIFE patterns", async () => {
    const project = new Project();
    await project.initialize();

    const source = load_source("functions/iife_patterns.js");
    project.update_file("iife.js" as FilePath, source);

    const index = project.get_semantic_index("iife.js" as FilePath);

    // Verify IIFE scope is captured
    const scopes = Array.from(index.scopes.values());
    const has_function_scope = scopes.some((s) => s.type === "function");
    expect(has_function_scope).toBe(true);
  });

  it("should handle closures and nested scopes", async () => {
    const source = load_source("functions/closures.js");
    // Test closure variable capture
  });

  it("should handle factory patterns", async () => {
    const source = load_source("functions/factory_patterns.js");
    // Test factory function returning objects
  });

  it("should handle object literal methods", async () => {
    const source = load_source("classes/object_literals.js");
    // Test: const obj = { method() {} }
  });
});
```

### 5. Dynamic Access Patterns

```typescript
describe("Dynamic Access", () => {
  it("should handle bracket notation method calls", async () => {
    // obj['methodName']()
    // May not fully resolve (dynamic), but should not crash
  });

  it("should handle computed property names", async () => {
    // const key = 'method'; obj[key]()
  });
});
```

## Test Coverage Requirements

### Must Cover

- [ ] CommonJS require/module.exports
- [ ] ES6 import/export
- [ ] ES6 class methods
- [ ] Prototype-based methods
- [ ] Function expressions
- [ ] Arrow functions
- [ ] IIFE patterns
- [ ] Closures
- [ ] Object literal methods
- [ ] Shadowing

### JavaScript-Specific

- [ ] module.exports variations
- [ ] exports vs module.exports
- [ ] require() with relative paths
- [ ] Dynamic imports (import())
- [ ] Destructuring imports
- [ ] Default exports

## Fixtures Required

Based on task 11.116.5.2, these fixtures should exist:

```
javascript/code/
├── modules/
│   ├── utils_commonjs.js
│   ├── main_commonjs.js
│   ├── utils_es6.js
│   ├── main_es6.js
│   ├── user_class.js
│   ├── uses_user.js
│   └── shadowing.js
├── classes/
│   ├── methods.js
│   ├── prototype_methods.js
│   ├── object_literals.js
│   └── constructor_workflow.js
└── functions/
    ├── closures.js
    ├── iife_patterns.js
    ├── factory_patterns.js
    └── nested_scopes.js
```

## Success Criteria

- [ ] All CommonJS patterns resolve correctly
- [ ] All ES6 module patterns resolve correctly
- [ ] Both class syntaxes work (ES6 and prototype)
- [ ] JavaScript-specific patterns handled
- [ ] Tests use real `Project` class
- [ ] Tests load actual .js source files
- [ ] No TypeScript-specific assumptions

## Key Differences from TypeScript Tests

1. **No type annotations** - Resolution is purely lexical/name-based
2. **Two module systems** - Must test both CommonJS and ES6
3. **More dynamic** - Some patterns may not fully resolve
4. **Legacy patterns** - Prototype methods, IIFE, etc.

## Implementation Template

```typescript
import { describe, it, expect } from "vitest";
import { Project } from "./project";
import path from "path";
import fs from "fs";
import type { FilePath } from "@ariadnejs/types";

const FIXTURE_ROOT = path.join(__dirname, "../tests/fixtures/javascript/code");

function load_source(relative_path: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, relative_path), "utf-8");
}

describe("Project Integration - JavaScript", () => {
  // Tests here
});
```

## Estimated Effort

**3-4 hours**

- 1 hour: CommonJS module resolution
- 1 hour: ES6 module resolution
- 1 hour: Class methods (both syntaxes)
- 1 hour: JavaScript-specific patterns

## Notes

- JavaScript tests will likely have more "expected failures" than TypeScript
- Dynamic patterns (bracket notation, computed properties) may not resolve
- Focus on common patterns, not edge cases
- Document any JavaScript-specific resolution limitations

## Implementation Notes

### Completed (2025-10-16)

Created comprehensive JavaScript integration test suite in:

- `packages/core/src/project/project.javascript.integration.test.ts`

Test structure follows the TypeScript integration test pattern with JavaScript-specific adaptations.

### Test Results

**Overall:** 16 out of 19 tests passing (84% pass rate)

**Passing Tests:**

- ✅ ES6 module resolution (import/export)
- ✅ Cross-file function call resolution for ES6 modules
- ✅ ES6 class methods
- ✅ Prototype methods (basic structure captured)
- ✅ Method chaining
- ✅ IIFE patterns
- ✅ Closures and nested scopes
- ✅ Factory patterns
- ✅ Cross-module class resolution
- ✅ Shadowing
- ✅ Call graph generation
- ✅ Incremental updates
- ✅ File removal handling

**Failing Tests (3):**

1. CommonJS `require()` imports - imports.length === 0
2. CommonJS cross-file resolution - resolved_def is undefined
3. Default export resolution - resolved_def is undefined

### Identified Issues

Created sub-tasks to address the failures:

1. **task-epic-11.116.5.6.1**: Add CommonJS require() support

   - Root cause: `javascript.scm` query file only captures ES6 imports, not `require()` calls
   - Impact: CommonJS modules cannot be resolved across files
   - Status: To Do

2. **task-epic-11.116.5.6.2**: Fix default export resolution
   - Root cause: Default exported functions resolve but definition lookup fails
   - Impact: Default imports work but call resolution fails
   - Status: To Do

### Coverage Achieved

The test suite covers:

- ✅ ES6 import/export
- ✅ ES6 class methods
- ✅ Prototype-based methods
- ✅ IIFE patterns
- ✅ Closures
- ✅ Object literal methods
- ✅ Shadowing
- ✅ Call graph
- ✅ Incremental updates
- ⚠️ CommonJS (partial - needs query pattern updates)
- ⚠️ Default exports (partial - needs resolution fix)

### Test Migration and Critical Gaps (2025-10-20)

Successfully migrated all unit tests from `symbol_resolution.javascript.test.ts` to integration tests. Added comprehensive coverage for re-export chains and aliased imports.

**Test Results:** 21/25 passing (4 expected failures)

**Created Sub-Tasks for Critical Gaps:**

1. **task-epic-11.116.5.6.3**: Capture constructor calls as references ✅ DONE
   - Issue: `new Foo()` calls appeared not to be captured as SymbolReference objects
   - Resolution: Infrastructure was already complete - tests were using wrong filter
   - Status: Done (2025-10-20)
   - Priority: HIGH

2. **task-154**: Type Resolution & Heuristic Fallback System (MOVED TO TOP-LEVEL)
   - Issue: Method calls on imported class instances don't resolve via `project.resolutions.resolve()`
   - Impact: Cannot trace method calls from usage site to definition across files
   - Status: Backlog (affects all languages, not just JavaScript)
   - Priority: Medium (task-154), HIGH for JavaScript tests
   - Note: Originally task-epic-11.116.5.6.4, moved because this is a cross-language issue

**Test Status (Updated 2025-10-20):**

23/25 passing, 2 TODO

Passing constructor call tests:

- ✅ should resolve imported class constructor calls
- ✅ should resolve aliased class constructor calls

TODO tests (waiting on task-154):

- ⏸️ should resolve method calls on imported class instances
- ⏸️ should resolve method calls on aliased class instances

### Next Steps

1. Complete sub-task epic-11.116.5.6.1 to add CommonJS support ✅ DONE
2. Complete sub-task epic-11.116.5.6.2 to fix default exports ✅ DONE
3. Complete sub-task epic-11.116.5.6.3 to capture constructor calls ✅ DONE
4. Complete task-154 to fix method resolution (MOVED TO TOP-LEVEL - cross-language) ⏸️ FUTURE
5. Consider adding tests for:
   - Dynamic imports (`import()`)
   - Namespace imports
   - Mixed CommonJS/ES6 modules

**Current Status**: JavaScript integration tests are comprehensive and 92% passing (23/25). The 2 TODO tests require cross-language type flow tracking (task-154).
