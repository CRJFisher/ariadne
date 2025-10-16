# Task epic-11.116.5.7: Python Project Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116.5
**Depends On:** task-epic-11.116.5.3, task-epic-11.116.5.5
**Priority:** High
**Created:** 2025-10-16

## Overview

Create integration tests for the `Project` class using Python fixtures. Tests Python-specific patterns including class methods with `self`, decorators, type hints, and Python's import system.

## Python-Specific Considerations

### Key Differences from TypeScript/JavaScript

1. **Class Methods** - Explicit `self` parameter
2. **Import System** - `from module import name`, absolute/relative imports
3. **Type Hints** - Optional, used for type binding
4. **Decorators** - `@staticmethod`, `@classmethod`, `@property`
5. **Indentation-based scoping** - No braces
6. **Magic methods** - `__init__`, `__str__`, etc.

### Python Import Patterns

```python
# Various import styles
from utils import helper           # Named import
import utils                       # Module import
from utils import *                # Wildcard (avoid testing)
from .relative import helper       # Relative import
from package.module import Class   # Nested module
```

## Test File Structure

Create: `packages/core/src/project/project.python.integration.test.ts`

## Test Categories

### 1. Module Resolution

```typescript
describe("Project Integration - Python", () => {
  describe("Module Resolution", () => {
    it("should resolve 'from module import name' imports", async () => {
      const project = new Project();
      await project.initialize();

      const utils = load_source("modules/utils.py");
      const main = load_source("modules/uses_user.py");

      project.update_file("utils.py" as FilePath, utils);
      project.update_file("uses_user.py" as FilePath, main);

      // Verify import definition created
      const main_index = project.get_semantic_index("uses_user.py" as FilePath);
      const imports = Array.from(main_index.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Verify call to imported function resolves
      const call = main_index.references.find(
        r => r.type === "call" && r.name === ("helper" as SymbolName)
      );
      const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
      expect(resolved).toBeDefined();

      // Verify resolved to utils.py
      const def = project.definitions.get(resolved!);
      expect(def?.location.file_path).toContain("utils.py");
    });

    it("should handle 'import module' style", async () => {
      // Test: import utils; utils.helper()
      // Verify module namespace resolution
    });

    it("should handle relative imports", async () => {
      // Test: from .utils import helper
      // Verify relative path resolution
    });
  });
});
```

### 2. Class Methods with self

```typescript
describe("Class Methods", () => {
  it("should resolve instance methods with self parameter", async () => {
    const project = new Project();
    await project.initialize();

    const source = load_source("classes/basic_class.py");
    project.update_file("basic_class.py" as FilePath, source);

    const index = project.get_semantic_index("basic_class.py" as FilePath);

    // Find class
    const classes = Array.from(index.classes.values());
    expect(classes.length).toBeGreaterThan(0);

    // Find __init__ constructor
    const methods = Array.from(classes[0].methods);
    const init_method = methods.find(m => m.name === "__init__");
    expect(init_method).toBeDefined();

    // Verify self parameter is captured
    expect(init_method?.parameters.length).toBeGreaterThan(0);
    expect(init_method?.parameters[0].name).toBe("self");
  });

  it("should resolve cross-file class method calls", async () => {
    const project = new Project();
    await project.initialize();

    const user_class = load_source("classes/user_class.py");
    const main = load_source("modules/uses_user.py");

    project.update_file("user_class.py" as FilePath, user_class);
    project.update_file("uses_user.py" as FilePath, main);

    // Find method call
    const main_index = project.get_semantic_index("uses_user.py" as FilePath);
    const method_call = main_index.references.find(
      r => r.type === "call" && r.call_type === "method"
    );
    expect(method_call).toBeDefined();

    // Verify resolves to method in user_class.py
    const resolved = project.resolutions.resolve(
      method_call!.scope_id,
      method_call!.name
    );
    const def = project.definitions.get(resolved!);
    expect(def?.kind).toBe("method");
    expect(def?.location.file_path).toContain("user_class.py");
  });
});
```

### 3. Decorators and Method Types

```typescript
describe("Method Types and Decorators", () => {
  it("should handle @staticmethod", async () => {
    const project = new Project();
    await project.initialize();

    const source = load_source("classes/method_types.py");
    project.update_file("method_types.py" as FilePath, source);

    const index = project.get_semantic_index("method_types.py" as FilePath);
    const classes = Array.from(index.classes.values());

    // Find static method
    const methods = classes[0].methods;
    const static_method = methods.find(
      m => m.name === "static_method"
    );
    expect(static_method).toBeDefined();

    // Verify decorator captured (if we extract decorators)
    // This may depend on whether decorators are in metadata
  });

  it("should handle @classmethod", async () => {
    // Test class methods with cls parameter
  });

  it("should handle @property", async () => {
    // Test property decorators
    // May appear as method but behaves like attribute access
  });
});
```

### 4. Type Hints

```typescript
describe("Type Hints", () => {
  it("should extract type hints for method resolution", async () => {
    const project = new Project();
    await project.initialize();

    const source = `
class User:
    def __init__(self, name: str):
        self.name: str = name

    def get_name(self) -> str:
        return self.name

user: User = User("Alice")
name = user.get_name()  # Should resolve via type hint
`;

    project.update_file("typed_usage.py" as FilePath, source);

    const index = project.get_semantic_index("typed_usage.py" as FilePath);

    // Find method call
    const method_call = index.references.find(
      r => r.type === "call" && r.name === ("get_name" as SymbolName)
    );
    expect(method_call).toBeDefined();

    // Verify resolves via type binding
    const resolved = project.resolutions.resolve(
      method_call!.scope_id,
      method_call!.name
    );
    expect(resolved).toBeDefined();
  });
});
```

### 5. Python-Specific Patterns

```typescript
describe("Python Patterns", () => {
  it("should handle list comprehensions", async () => {
    const source = load_source("functions/language_features.py");
    // Test scope handling for comprehensions
  });

  it("should handle lambda functions", async () => {
    // Test: lambda x: x + 1
  });

  it("should handle nested functions and closures", async () => {
    const source = load_source("functions/closures.py");
    // Test Python closure variable capture
  });

  it("should handle generator functions", async () => {
    // Test: def gen(): yield x
  });

  it("should handle async/await", async () => {
    // Test: async def foo(): await bar()
  });
});
```

### 6. Magic Methods

```typescript
describe("Magic Methods", () => {
  it("should capture __init__ as constructor", async () => {
    const project = new Project();
    await project.initialize();

    const source = load_source("classes/basic_class.py");
    project.update_file("basic_class.py" as FilePath, source);

    const index = project.get_semantic_index("basic_class.py" as FilePath);
    const classes = Array.from(index.classes.values());

    // Verify __init__ is treated as constructor
    const type_members = project.types.get_type_members(classes[0].symbol_id);
    expect(type_members?.constructor).toBeDefined();
  });

  it("should handle other magic methods", async () => {
    // __str__, __repr__, __eq__, etc.
  });
});
```

### 7. Shadowing

```typescript
describe("Shadowing", () => {
  it("should resolve to local definition when it shadows import", async () => {
    const project = new Project();
    await project.initialize();

    const utils = load_source("modules/utils.py");
    const main = load_source("modules/shadowing.py");

    project.update_file("utils.py" as FilePath, utils);
    project.update_file("shadowing.py" as FilePath, main);

    const main_index = project.get_semantic_index("shadowing.py" as FilePath);

    // Find call that should resolve to local, not imported
    const call = main_index.references.find(
      r => r.type === "call" && r.name === ("helper" as SymbolName)
    );

    const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
    const def = project.definitions.get(resolved!);

    // Should resolve to local definition in shadowing.py
    expect(def?.location.file_path).toContain("shadowing.py");
  });
});
```

## Test Coverage Requirements

### Must Cover

- [ ] from...import resolution
- [ ] import module resolution
- [ ] Class methods with self
- [ ] __init__ constructor
- [ ] Cross-file method calls
- [ ] Type hints for type binding
- [ ] Shadowing
- [ ] Nested scopes

### Python-Specific

- [ ] @staticmethod, @classmethod, @property
- [ ] Relative imports (from .module)
- [ ] Magic methods (__init__, __str__, etc.)
- [ ] List comprehensions
- [ ] Lambda functions
- [ ] Generator functions
- [ ] async/await patterns

## Fixtures Required

Based on task 11.116.5.3, these fixtures should exist:

```
python/code/
├── modules/
│   ├── utils.py
│   ├── imports.py
│   ├── user_class.py
│   ├── uses_user.py
│   ├── shadowing.py
│   └── import_patterns.py
├── classes/
│   ├── basic_class.py
│   ├── inheritance.py
│   ├── method_types.py
│   ├── constructor_workflow.py
│   └── advanced_oop.py
└── functions/
    ├── basic_functions.py
    ├── closures.py
    ├── nested_scopes.py
    ├── variable_shadowing.py
    └── language_features.py
```

## Success Criteria

- [ ] Python import resolution works
- [ ] Class methods with self resolve correctly
- [ ] Type hints enable method resolution
- [ ] Decorators handled correctly
- [ ] Magic methods recognized
- [ ] Shadowing works
- [ ] Tests use real `Project` class
- [ ] Tests load actual .py source files

## Implementation Template

```typescript
import { describe, it, expect } from "vitest";
import { Project } from "./project";
import path from "path";
import fs from "fs";
import type { FilePath, SymbolName } from "@ariadnejs/types";

const FIXTURE_ROOT = path.join(
  __dirname,
  "../tests/fixtures/python/code"
);

function load_source(relative_path: string): string {
  return fs.readFileSync(
    path.join(FIXTURE_ROOT, relative_path),
    "utf-8"
  );
}

describe("Project Integration - Python", () => {
  // Tests here
});
```

## Estimated Effort

**3-4 hours**
- 1 hour: Module resolution (from/import)
- 1 hour: Class methods and decorators
- 1 hour: Type hints and method resolution
- 30 min: Python-specific patterns
- 30 min: Magic methods and edge cases

## Notes

- Python's indentation-based syntax may have different scope boundaries
- Type hints are optional - test both typed and untyped code
- `self` parameter is explicit, unlike TypeScript's `this`
- Python allows runtime modification - focus on static patterns
- Relative imports may need special path handling
