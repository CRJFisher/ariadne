# Task 11.109.9.1: JavaScript Integration Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1-2 days
**Parent:** task-epic-11.109.9
**Dependencies:** task-epic-11.109.8 (Main orchestration)

## Objective

Create comprehensive integration tests for JavaScript that validate the entire symbol resolution pipeline with realistic SemanticIndex data. Focus on cross-file call resolution, import chains, and scope-aware resolution.

## File to Create

**Single test file:**
- `packages/core/src/resolve_references/symbol_resolution.javascript.test.ts`

## Implementation

### Test Structure

```typescript
/**
 * JavaScript Integration Tests
 *
 * Creates realistic SemanticIndex data from code snippets and validates
 * the complete resolution pipeline: indices → resolver index → resolutions
 */

import { resolve_symbols } from "./symbol_resolution";
import { create_semantic_index_from_code } from "../test_helpers/index_builder";
import type { SemanticIndex, FilePath } from "@ariadnejs/types";

describe("JavaScript Symbol Resolution Integration", () => {
  describe("Local Function Calls", () => {
    it("resolves local function call in same scope", () => {
      // Test implementation
    });

    it("resolves function call from nested scope", () => {
      // Test implementation
    });

    it("handles shadowing - inner function shadows outer", () => {
      // Test implementation
    });
  });

  describe("Cross-File Function Calls", () => {
    it("resolves imported function call", () => {
      // Test implementation
    });

    it("follows re-export chain (A imports B exports C)", () => {
      // Test implementation
    });

    it("handles default exports", () => {
      // Test implementation
    });

    it("handles aliased imports", () => {
      // Test implementation
    });
  });

  describe("Method Calls", () => {
    it("resolves method call on typed variable", () => {
      // Test implementation
    });

    it("resolves method call on constructor result", () => {
      // Test implementation
    });

    it("resolves chained method calls", () => {
      // Test implementation
    });
  });

  describe("Constructor Calls", () => {
    it("resolves local class constructor", () => {
      // Test implementation
    });

    it("resolves imported class constructor", () => {
      // Test implementation
    });
  });

  describe("Complex Scenarios", () => {
    it("resolves full workflow: import → construct → method call", () => {
      // Test implementation
    });

    it("handles circular imports gracefully", () => {
      // Test implementation
    });

    it("resolves calls in nested scopes with multiple shadowing levels", () => {
      // Test implementation
    });
  });
});
```

## Test Scenarios

### 1. Local Function Call

**Code:**
```javascript
// main.js
function helper() {
  return 42;
}

function main() {
  const result = helper();  // Should resolve to helper @ line 2
}
```

**Test:**
```typescript
it("resolves local function call in same scope", () => {
  const code = `
    function helper() { return 42; }
    function main() {
      const result = helper();
    }
  `;

  const index = create_semantic_index_from_code(code, "main.js", "javascript");
  const indices = new Map([["main.js", index]]);

  const resolved = resolve_symbols(indices);

  // Find the call reference at "helper()"
  const helper_call_ref = find_reference(resolved, "helper", { line: 4, column: 18 });

  // Verify it resolves to the helper function definition
  const helper_def = find_definition(index, "helper", "function");
  expect(resolved.resolved_references.get(location_key(helper_call_ref.location)))
    .toBe(helper_def.symbol_id);
});
```

### 2. Cross-File Import and Call

**Code:**
```javascript
// utils.js
export function helper() {
  return 42;
}

// main.js
import { helper } from './utils';

function main() {
  const result = helper();  // Should resolve to helper in utils.js
}
```

**Test:**
```typescript
it("resolves imported function call", () => {
  const utils_code = `export function helper() { return 42; }`;
  const main_code = `
    import { helper } from './utils';
    function main() {
      const result = helper();
    }
  `;

  const utils_index = create_semantic_index_from_code(utils_code, "utils.js", "javascript");
  const main_index = create_semantic_index_from_code(main_code, "main.js", "javascript");

  const indices = new Map([
    ["utils.js", utils_index],
    ["main.js", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Find the call to helper() in main.js
  const helper_call = find_reference_by_location(main_index, { line: 4, column: 18 });

  // Verify it resolves to helper definition in utils.js
  const helper_def = find_definition(utils_index, "helper", "function");
  expect(resolved.resolved_references.get(location_key(helper_call.location)))
    .toBe(helper_def.symbol_id);
});
```

### 3. Re-Export Chain

**Code:**
```javascript
// base.js
export function core() {
  return 42;
}

// middle.js
export { core } from './base';

// main.js
import { core } from './middle';

function main() {
  const result = core();  // Should resolve through chain to base.js
}
```

**Test:**
```typescript
it("follows re-export chain (A imports B exports C)", () => {
  const base_code = `export function core() { return 42; }`;
  const middle_code = `export { core } from './base';`;
  const main_code = `
    import { core } from './middle';
    function main() {
      const result = core();
    }
  `;

  const base_index = create_semantic_index_from_code(base_code, "base.js", "javascript");
  const middle_index = create_semantic_index_from_code(middle_code, "middle.js", "javascript");
  const main_index = create_semantic_index_from_code(main_code, "main.js", "javascript");

  const indices = new Map([
    ["base.js", base_index],
    ["middle.js", middle_index],
    ["main.js", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Find call to core() in main.js
  const core_call = find_reference_by_location(main_index, { line: 4, column: 18 });

  // Verify it resolves to core in base.js (not middle.js)
  const core_def = find_definition(base_index, "core", "function");
  expect(resolved.resolved_references.get(location_key(core_call.location)))
    .toBe(core_def.symbol_id);
});
```

### 4. Method Call with Type Tracking

**Code:**
```javascript
// user.js
export class User {
  getName() {
    return "Alice";
  }
}

// main.js
import { User } from './user';

function main() {
  const user = new User();
  const name = user.getName();  // Should resolve to User.getName
}
```

**Test:**
```typescript
it("resolves method call on constructor result", () => {
  const user_code = `
    export class User {
      getName() {
        return "Alice";
      }
    }
  `;
  const main_code = `
    import { User } from './user';
    function main() {
      const user = new User();
      const name = user.getName();
    }
  `;

  const user_index = create_semantic_index_from_code(user_code, "user.js", "javascript");
  const main_index = create_semantic_index_from_code(main_code, "main.js", "javascript");

  const indices = new Map([
    ["user.js", user_index],
    ["main.js", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Find constructor call
  const user_constructor_call = find_reference_by_name(main_index, "User", "constructor");
  const User_class = find_definition(user_index, "User", "class");
  expect(resolved.resolved_references.get(location_key(user_constructor_call.location)))
    .toBe(User_class.symbol_id);

  // Find method call
  const getName_call = find_reference_by_name(main_index, "getName", "method");
  const getName_method = find_class_method(user_index, "User", "getName");
  expect(resolved.resolved_references.get(location_key(getName_call.location)))
    .toBe(getName_method.symbol_id);
});
```

### 5. Shadowing with Nested Scopes

**Code:**
```javascript
// main.js
function helper() {
  return 42;
}

function outer() {
  helper();  // Should resolve to global helper

  function helper() {
    return 100;
  }

  function inner() {
    helper();  // Should resolve to outer's helper (line 9)
  }
}
```

**Test:**
```typescript
it("handles shadowing in nested scopes", () => {
  const code = `
    function helper() { return 42; }

    function outer() {
      helper();

      function helper() { return 100; }

      function inner() {
        helper();
      }
    }
  `;

  const index = create_semantic_index_from_code(code, "main.js", "javascript");
  const indices = new Map([["main.js", index]]);

  const resolved = resolve_symbols(indices);

  // First call (line 5) should resolve to global helper (line 2)
  const first_call = find_reference_by_location(index, { line: 5, column: 6 });
  const global_helper = find_definition_at_line(index, "helper", 2);
  expect(resolved.resolved_references.get(location_key(first_call.location)))
    .toBe(global_helper.symbol_id);

  // Second call (line 10) should resolve to local helper (line 7)
  const second_call = find_reference_by_location(index, { line: 10, column: 8 });
  const local_helper = find_definition_at_line(index, "helper", 7);
  expect(resolved.resolved_references.get(location_key(second_call.location)))
    .toBe(local_helper.symbol_id);
});
```

### 6. Full Workflow: Import → Constructor → Method

**Code:**
```javascript
// repository.js
export class Repository {
  save(data) {
    return true;
  }
}

// service.js
import { Repository } from './repository';

export class UserService {
  constructor() {
    this.repo = new Repository();
  }

  saveUser(user) {
    return this.repo.save(user);
  }
}

// main.js
import { UserService } from './service';

function main() {
  const service = new UserService();
  const result = service.saveUser({ name: "Alice" });
}
```

**Test:**
```typescript
it("resolves full workflow: import → construct → method call", () => {
  const repository_code = `
    export class Repository {
      save(data) { return true; }
    }
  `;

  const service_code = `
    import { Repository } from './repository';
    export class UserService {
      constructor() {
        this.repo = new Repository();
      }
      saveUser(user) {
        return this.repo.save(user);
      }
    }
  `;

  const main_code = `
    import { UserService } from './service';
    function main() {
      const service = new UserService();
      const result = service.saveUser({ name: "Alice" });
    }
  `;

  const repository_index = create_semantic_index_from_code(repository_code, "repository.js", "javascript");
  const service_index = create_semantic_index_from_code(service_code, "service.js", "javascript");
  const main_index = create_semantic_index_from_code(main_code, "main.js", "javascript");

  const indices = new Map([
    ["repository.js", repository_index],
    ["service.js", service_index],
    ["main.js", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Verify UserService constructor call in main.js
  const userservice_call = find_reference_by_name(main_index, "UserService", "constructor");
  const UserService_class = find_definition(service_index, "UserService", "class");
  expect(resolved.resolved_references.get(location_key(userservice_call.location)))
    .toBe(UserService_class.symbol_id);

  // Verify saveUser method call in main.js
  const saveUser_call = find_reference_by_name(main_index, "saveUser", "method");
  const saveUser_method = find_class_method(service_index, "UserService", "saveUser");
  expect(resolved.resolved_references.get(location_key(saveUser_call.location)))
    .toBe(saveUser_method.symbol_id);

  // Verify Repository constructor call in service.js
  const repository_call = find_reference_by_name(service_index, "Repository", "constructor");
  const Repository_class = find_definition(repository_index, "Repository", "class");
  expect(resolved.resolved_references.get(location_key(repository_call.location)))
    .toBe(Repository_class.symbol_id);

  // Verify save method call in service.js
  const save_call = find_reference_by_name(service_index, "save", "method");
  const save_method = find_class_method(repository_index, "Repository", "save");
  expect(resolved.resolved_references.get(location_key(save_call.location)))
    .toBe(save_method.symbol_id);
});
```

## Test Helpers

Create helpers for working with SemanticIndex:

```typescript
/**
 * Helper: Create SemanticIndex from code string
 *
 * Uses the actual indexing pipeline to create realistic indices
 */
function create_semantic_index_from_code(
  code: string,
  file_path: FilePath,
  language: "javascript" | "typescript" | "python" | "rust"
): SemanticIndex {
  // Parse code to AST
  const ast = parse_code(code, language);

  // Run indexing pipeline
  return index_single_file(ast, file_path, language);
}

/**
 * Helper: Find reference by location
 */
function find_reference_by_location(
  index: SemanticIndex,
  location: { line: number; column: number }
): SymbolReference {
  return index.references.find(ref =>
    ref.location.start.line === location.line &&
    ref.location.start.column === location.column
  );
}

/**
 * Helper: Find reference by name and type
 */
function find_reference_by_name(
  index: SemanticIndex,
  name: SymbolName,
  call_type: "function" | "method" | "constructor"
): SymbolReference {
  return index.references.find(ref =>
    ref.name === name &&
    ref.type === "call" &&
    ref.call_type === call_type
  );
}

/**
 * Helper: Find definition by name and kind
 */
function find_definition(
  index: SemanticIndex,
  name: SymbolName,
  kind: "function" | "class" | "variable"
): AnyDefinition {
  switch (kind) {
    case "function":
      return Array.from(index.functions.values()).find(f => f.name === name);
    case "class":
      return Array.from(index.classes.values()).find(c => c.name === name);
    case "variable":
      return Array.from(index.variables.values()).find(v => v.name === name);
  }
}

/**
 * Helper: Find class method
 */
function find_class_method(
  index: SemanticIndex,
  class_name: SymbolName,
  method_name: SymbolName
): MethodDefinition {
  const cls = find_definition(index, class_name, "class");
  return cls.methods.find(m => m.name === method_name);
}
```

## Success Criteria

### Functional
- ✅ All local function calls resolve correctly
- ✅ All cross-file function calls resolve correctly
- ✅ Import chains (re-exports) followed correctly
- ✅ Method calls resolve with type tracking
- ✅ Constructor calls resolve correctly
- ✅ Shadowing handled correctly at all nesting levels
- ✅ Full workflow tests pass (multi-file, multi-step)

### Coverage
- ✅ At least 15 integration test cases
- ✅ Tests cover all call types (function, method, constructor)
- ✅ Tests cover scope boundaries and shadowing
- ✅ Tests cover import/export scenarios
- ✅ Tests use realistic, complete code examples

### Quality
- ✅ Tests use actual indexing pipeline (not mocked data)
- ✅ Test helpers are reusable and well-documented
- ✅ Clear error messages when assertions fail
- ✅ Tests run quickly (<100ms per test)

## Dependencies

**Uses:**
- task-epic-11.109.8 (Main orchestration - `resolve_symbols()`)
- Indexing pipeline (to create realistic SemanticIndex data)
- Test helpers for working with indices

**Validates:**
- Entire resolution pipeline for JavaScript
- Cross-file resolution works correctly
- Scope-aware resolution works correctly
- Lazy import resolution works correctly

## Notes

### Why Integration Tests Matter

Unit tests verify individual components, but integration tests verify the **entire system** works together:

1. **Real data**: Uses actual SemanticIndex from parsing, not mock data
2. **Real pipeline**: Exercises resolver index build, cache, type tracking, and resolution
3. **Real complexity**: Multi-file scenarios with imports, re-exports, and type tracking
4. **Confidence**: If these pass, we know the system works end-to-end

### Test Data Strategy

**Option 1**: Parse real code snippets (preferred)
```typescript
const index = create_semantic_index_from_code(code, "file.js", "javascript");
```

**Option 2**: Use fixtures from disk
```typescript
const index = load_and_index_fixture("packages/core/tests/fixtures/resolve_references/javascript/simple_project");
```

Use Option 1 for most tests (faster, more explicit). Use Option 2 for complex multi-file scenarios.

## Next Steps

After completion:
- Create similar tests for TypeScript (11.109.9.2)
- Create similar tests for Python (11.109.9.3)
- Create similar tests for Rust (11.109.9.4)
- Compare results across languages for consistency
