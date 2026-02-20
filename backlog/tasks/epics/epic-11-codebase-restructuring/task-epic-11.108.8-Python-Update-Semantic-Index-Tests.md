# Task 11.108.8: Python - Update Semantic Index Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 5-6 hours (increased due to query fixes required)
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.4 (Python processing complete)
**Blocks:** Comprehensive Python semantic analysis

## CRITICAL: Fix Missing Query Patterns First

⚠️ **Issues discovered in task-epic-11.107.3 that MUST be fixed before adding new tests:**

### 1. Missing Assignment/Write Reference Queries (CRITICAL)

**Issue:** Python assignments are NOT creating "write" reference types.

**Missing patterns in `packages/core/src/index_single_file/references/queries/python.scm`:**
```scheme
; Simple assignments: x = 42
(assignment
  left: (identifier) @ref.write)

; Augmented assignments: count += 1
(augmented_assignment
  left: (identifier) @ref.write)

; Multiple assignments: a, b = 1, 2
(assignment
  left: (pattern_list
    (identifier) @ref.write))

; Attribute assignments: self.value = 42
(assignment
  left: (attribute
    attribute: (identifier) @ref.write))
```

**Impact:** Cannot track variable mutations, assignments, or data flow.

### 2. Missing None Type Reference Queries (CRITICAL)

**Issue:** `None` in type hints is NOT captured as a type reference.

**Missing patterns in `packages/core/src/index_single_file/references/queries/python.scm`:**
```scheme
; None in Union types: Union[int, None]
(generic_type
  (subscript
    (none) @ref.type))

; None in Optional: Optional[str]
(generic_type
  (subscript
    (none) @ref.type))

; None in pipe unions: int | None
(binary_operator
  left: (_)
  operator: "|"
  right: (none) @ref.type)

(binary_operator
  left: (none) @ref.type
  operator: "|"
  right: (_))

; None in return types: -> None
(type
  (none) @ref.type)
```

**Impact:** Cannot detect nullable types, Optional patterns, or type safety.

### 3. Missing Import Symbol Tracking (CRITICAL)

**Issue:** Imports are parsed but `imported_symbols` map remains empty.

**Location:** `packages/core/src/index_single_file/definitions/queries/python.scm` or import builder

**Examples not captured:**
- `import os` → should populate imported_symbols["os"]
- `from typing import List, Dict` → should populate imported_symbols["List"], imported_symbols["Dict"]
- `import sys as system` → should track alias

**Impact:** Cannot resolve cross-file imports or dependencies.

## Objective

After fixing the critical query issues above, update Python semantic_index tests to verify all data with literal object assertions, including Python-specific features like decorators, *args, **kwargs, and property decorators.

## Coverage Required

### Core Features
- [ ] Classes with __init__
- [ ] Constructor parameters (including self)
- [ ] Methods (instance, static, class)
- [ ] Properties (@property)
- [ ] Fields
- [ ] Functions
- [ ] Lambda functions
- [ ] Variables
- [ ] Imports (from, import, import as, from import *)

### Python-Specific Features
- [ ] **Decorators** (@dataclass, @property, @staticmethod, @classmethod)
- [ ] **Enums** (Enum, IntEnum, StrEnum, Flag, IntFlag)
- [ ] Enum members with values
- [ ] Constructor (__init__) parameters
- [ ] *args parameters
- [ ] **kwargs parameters
- [ ] Type annotations
- [ ] Default parameter values
- [ ] Multiple assignment
- [ ] Async functions
- [ ] Loop variables
- [ ] Comprehension variables

## Critical New Tests

### Constructor with Parameters
```typescript
it("extracts __init__ as constructor with parameters", () => {
  const code = `
class Person:
    def __init__(self, name: str, age: int, city: str = "Unknown"):
        self.name = name
        self.age = age
        self.city = city
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "Person"
  );

  expect(class_def?.constructor).toBeDefined();
  expect(class_def?.constructor?.parameters).toHaveLength(4); // self, name, age, city

  const params = class_def!.constructor!.parameters;
  expect(params[0].name).toBe("self");
  expect(params[1].name).toBe("name");
  expect(params[1].type).toBe("str");
  expect(params[2].name).toBe("age");
  expect(params[2].type).toBe("int");
  expect(params[3].name).toBe("city");
  expect(params[3].type).toBe("str");
  expect(params[3].default_value).toBe('"Unknown"');
});
```

### Decorators
```typescript
it("extracts decorators on classes and methods", () => {
  const code = `
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

    @property
    def magnitude(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5

    @staticmethod
    def origin():
        return Point(0, 0)

    @classmethod
    def from_tuple(cls, t):
        return cls(t[0], t[1])
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "Point"
  );

  expect(class_def?.decorators).toHaveLength(1);
  expect(class_def?.decorators?.[0].name).toBe("dataclass");

  const methods = Array.from(class_def?.methods?.values() || []);

  const magnitude = methods.find((m) => m.name === "magnitude");
  expect(magnitude?.decorators).toBeDefined();
  expect(magnitude?.decorators?.some(d => d.name === "property")).toBe(true);

  const origin = methods.find((m) => m.name === "origin");
  expect(origin?.decorators?.some(d => d.name === "staticmethod")).toBe(true);
  expect(origin?.static).toBe(true);

  const from_tuple = methods.find((m) => m.name === "from_tuple");
  expect(from_tuple?.decorators?.some(d => d.name === "classmethod")).toBe(true);
});
```

### Enums and Enum Members
```typescript
it("extracts enums and enum members with values", () => {
  const code = `
from enum import Enum, IntEnum, StrEnum

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3

class Status(StrEnum):
    PENDING = "pending"
    COMPLETE = "complete"
    FAILED = "failed"

class Priority(IntEnum):
    LOW = 1
    MEDIUM = 5
    HIGH = 10
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  // Check Color enum
  const color_enum = Array.from(result.definitions.values()).find(
    (d) => d.kind === "enum" && d.name === "Color"
  );
  expect(color_enum).toBeDefined();
  expect(color_enum?.members).toBeDefined();
  expect(color_enum?.members?.length).toBe(3);

  const red = color_enum?.members?.find(m => m.name === "RED");
  expect(red).toBeDefined();
  expect(red?.value).toBe(1);

  const green = color_enum?.members?.find(m => m.name === "GREEN");
  expect(green?.value).toBe(2);

  const blue = color_enum?.members?.find(m => m.name === "BLUE");
  expect(blue?.value).toBe(3);

  // Check Status string enum
  const status_enum = Array.from(result.definitions.values()).find(
    (d) => d.kind === "enum" && d.name === "Status"
  );
  expect(status_enum).toBeDefined();
  expect(status_enum?.members?.length).toBe(3);

  const pending = status_enum?.members?.find(m => m.name === "PENDING");
  expect(pending?.value).toBe('"pending"');

  // Check Priority int enum
  const priority_enum = Array.from(result.definitions.values()).find(
    (d) => d.kind === "enum" && d.name === "Priority"
  );
  expect(priority_enum).toBeDefined();
  expect(priority_enum?.members?.length).toBe(3);

  const high = priority_enum?.members?.find(m => m.name === "HIGH");
  expect(high?.value).toBe(10);
});
```

### Variable Arguments
```typescript
it("extracts *args and **kwargs parameters", () => {
  const code = `
def flexible_function(a, b, *args, **kwargs):
    pass
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const func_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "flexible_function"
  );

  expect(func_def?.parameters).toHaveLength(4);
  expect(func_def?.parameters[0].name).toBe("a");
  expect(func_def?.parameters[1].name).toBe("b");
  expect(func_def?.parameters[2].name).toBe("args");
  expect(func_def?.parameters[2].type).toBe("tuple");
  expect(func_def?.parameters[3].name).toBe("kwargs");
  expect(func_def?.parameters[3].type).toBe("dict");
});
```

### Imports
```typescript
it("extracts Python imports", () => {
  const code = `
import os
import sys as system
from pathlib import Path
from typing import List, Dict
from collections import *
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const imports = Array.from(result.definitions.values()).filter(
    (d) => d.kind === "import"
  );

  expect(imports.length).toBeGreaterThanOrEqual(5);

  const os_import = imports.find((i) => i.name === "os");
  expect(os_import?.import_kind).toBe("namespace");

  const sys_import = imports.find((i) => i.name === "system");
  expect(sys_import?.original_name).toBe("sys");

  const path_import = imports.find((i) => i.name === "Path");
  expect(path_import?.import_path).toBe("pathlib");

  const star_import = imports.find((i) => i.name === "*");
  expect(star_import?.import_path).toBe("collections");
});
```

## File to Update

**File:** `packages/core/src/index_single_file/semantic_index.python.test.ts`

## Tests to Re-add After Query Fixes

Once the critical query patterns are fixed, re-add these tests that were removed in task-epic-11.107.3:

### Assignment/Write Reference Tests
```typescript
it("should extract assignment source and target locations", () => {
  const code = `
x = 42
y = x
z: int = y + 1
  `;
  const tree = parser.parse(code);
  const file_path = "test.py" as FilePath;
  const parsed_file = createParsedFile(code, file_path, tree, "python");
  const result = build_semantic_index(parsed_file, tree, "python");

  // Check assignments via write references
  const writes = result.references.filter(ref => ref.type === "write");
  expect(writes.length).toBeGreaterThan(0);

  // Find y = x assignment
  const y_assignment = writes.find(ref => ref.name === "y");
  expect(y_assignment).toBeDefined();
});

it("should handle augmented assignments with metadata", () => {
  const code = `
count = 0
count += 1
value *= 2
  `;
  const tree = parser.parse(code);
  const file_path = "test.py" as FilePath;
  const parsed_file = createParsedFile(code, file_path, tree, "python");
  const result = build_semantic_index(parsed_file, tree, "python");

  const writes = result.references.filter(ref => ref.type === "write");

  // Augmented assignments should create write references
  const count_writes = writes.filter(ref => ref.name === "count");
  expect(count_writes.length).toBeGreaterThan(0);
});

it("should handle multiple assignment with metadata", () => {
  const code = `
a, b = 1, 2
x, y, z = values
  `;
  const tree = parser.parse(code);
  const file_path = "test.py" as FilePath;
  const parsed_file = createParsedFile(code, file_path, tree, "python");
  const result = build_semantic_index(parsed_file, tree, "python");

  const writes = result.references.filter(ref => ref.type === "write");

  // Multiple assignments should track all targets
  const a_write = writes.find(ref => ref.name === "a");
  expect(a_write).toBeDefined();

  const b_write = writes.find(ref => ref.name === "b");
  expect(b_write).toBeDefined();
});
```

### None Type Reference Tests
```typescript
it("should extract None type references from return type hints", () => {
  const code = `
def get_value() -> int:
    return 42

def get_optional() -> Optional[str]:
    return None

def get_union() -> Union[int, str]:
    return "test"

def get_pipe_union() -> int | str | None:
    return 42
  `;
  const tree = parser.parse(code);
  const file_path = "test.py" as FilePath;
  const parsed_file = createParsedFile(code, file_path, tree, "python");
  const result = build_semantic_index(parsed_file, tree, "python");

  const type_refs = result.references.filter(ref => ref.type === "type");

  // Check for None type references (indicates nullable)
  const none_refs = type_refs.filter(ref => ref.name === "None");
  expect(none_refs.length).toBeGreaterThan(0);
});

it("should handle Union and Optional types with nullable detection", () => {
  const code = `
from typing import Union, Optional

def process(value: Optional[str]) -> Union[int, None]:
    return None

x: str | None = None
y: int | str = 42
  `;
  const tree = parser.parse(code);
  const file_path = "test.py" as FilePath;
  const parsed_file = createParsedFile(code, file_path, tree, "python");
  const result = build_semantic_index(parsed_file, tree, "python");

  const type_refs = result.references.filter(ref => ref.type === "type");

  // Check for None type references (indicates nullable)
  const none_refs = type_refs.filter(ref => ref.name === "None");
  expect(none_refs.length).toBeGreaterThan(0);
});
```

### Import Tracking Tests
```typescript
it("should maintain import tracking", () => {
  const code = `
import os
import sys as system
from typing import List, Dict, Optional
from collections import defaultdict, Counter
  `;
  const tree = parser.parse(code);
  const file_path = "test.py" as FilePath;
  const parsed_file = createParsedFile(code, file_path, tree, "python");
  const result = build_semantic_index(parsed_file, tree, "python");

  // Verify imports are captured
  const imports = Array.from(result.imported_symbols.values());
  expect(imports.length).toBeGreaterThan(0);

  // Check various import types
  const import_names = imports.map(imp => imp.name);
  expect(import_names).toContain("os");
});
```

## Success Criteria

### Phase 1: Query Fixes (CRITICAL)
- ✅ Assignment/write reference queries added to python.scm
- ✅ None type reference queries added to python.scm
- ✅ Import symbol tracking implemented
- ✅ All 6 removed tests now pass

### Phase 2: Comprehensive Tests
- ✅ All Python-specific features tested
- ✅ Decorators fully verified
- ✅ Enums and enum members verified (Enum, IntEnum, StrEnum)
- ✅ Constructor parameters verified
- ✅ *args and **kwargs tested
- ✅ All tests use complete object assertions
- ✅ All tests pass (target: 60+ tests passing)
