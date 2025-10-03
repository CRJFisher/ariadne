# Task epic-11.112.14: Create Comprehensive Scope Assignment Tests

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 1 file created
**Dependencies:** tasks epic-11.112.7-13

## Objective

Create a comprehensive test suite that verifies scope assignment correctness across all languages (JavaScript, TypeScript, Python, Rust). This test file will serve as the authoritative regression test for the scope assignment bug fix.

## Files

### CREATED
- `packages/core/src/index_single_file/query_code_tree/scope_assignment.test.ts`

## Implementation Steps

### 1. Create Test File Structure (15 min)

```typescript
import { describe, it, expect } from 'vitest';
import { build_semantic_index } from '../index_single_file';
import type { SemanticIndex, ClassDefinition, InterfaceDefinition } from '@ariadnejs/types';

describe('Scope Assignment Bug Fix', () => {
  describe('JavaScript', () => {
    // Tests for JavaScript classes
  });

  describe('TypeScript', () => {
    // Tests for TypeScript classes, interfaces, enums
  });

  describe('Python', () => {
    // Tests for Python classes
  });

  describe('Rust', () => {
    // Tests for Rust structs and enums
  });
});
```

### 2. Add JavaScript Class Tests (20 min)

```typescript
describe('JavaScript', () => {
  it('class at file scope has file_scope_id', () => {
    const code = `
class MyClass {
  method() {
    const x = 1;
  }
}`;
    const index = build_semantic_index(code, 'test.js');
    const class_def = Array.from(index.classes.values()).find(c => c.name === 'MyClass');

    expect(class_def).toBeDefined();
    expect(class_def!.scope_id).toBe(index.root_scope_id);
  });

  it('nested class has enclosing class scope_id', () => {
    const code = `
class Outer {
  static Inner = class {
    method() { }
  }
}`;
    const index = build_semantic_index(code, 'test.js');
    const outer = Array.from(index.classes.values()).find(c => c.name === 'Outer');
    const inner = Array.from(index.classes.values()).find(c => c.name === 'Inner');
    const outer_scope = Array.from(index.scopes.values()).find(s => s.name === 'Outer');

    expect(inner!.scope_id).toBe(outer_scope!.id);
    expect(inner!.scope_id).not.toBe(index.root_scope_id);
  });

  it('class with multiple methods uses defining scope', () => {
    const code = `
class Calculator {
  add(a, b) { return a + b; }
  subtract(a, b) { return a - b; }
  multiply(a, b) { return a * b; }
}`;
    const index = build_semantic_index(code, 'test.js');
    const class_def = Array.from(index.classes.values()).find(c => c.name === 'Calculator');

    expect(class_def!.scope_id).toBe(index.root_scope_id);
  });
});
```

### 3. Add TypeScript Class Tests (25 min)

```typescript
describe('TypeScript', () => {
  it('regular class has file_scope_id', () => {
    const code = `
class RegularClass {
  method(): void { }
}`;
    const index = build_semantic_index(code, 'test.ts');
    const class_def = Array.from(index.classes.values()).find(c => c.name === 'RegularClass');

    expect(class_def!.scope_id).toBe(index.root_scope_id);
  });

  it('abstract class has file_scope_id', () => {
    const code = `
abstract class AbstractClass {
  abstract abstractMethod(): void;
  concreteMethod(): void { }
}`;
    const index = build_semantic_index(code, 'test.ts');
    const class_def = Array.from(index.classes.values()).find(c => c.name === 'AbstractClass');

    expect(class_def!.scope_id).toBe(index.root_scope_id);
  });

  it('generic class has file_scope_id', () => {
    const code = `
class Container<T> {
  private value: T;
  getValue(): T { return this.value; }
}`;
    const index = build_semantic_index(code, 'test.ts');
    const class_def = Array.from(index.classes.values()).find(c => c.name === 'Container');

    expect(class_def!.scope_id).toBe(index.root_scope_id);
  });
});
```

### 4. Add TypeScript Interface Tests (20 min)

```typescript
describe('TypeScript Interfaces', () => {
  it('interface with method signatures has file_scope_id', () => {
    const code = `
interface IUser {
  getName(): string;
  setName(name: string): void;
  getAge(): number;
}`;
    const index = build_semantic_index(code, 'test.ts');
    const interface_def = Array.from(index.interfaces.values()).find(i => i.name === 'IUser');

    expect(interface_def!.scope_id).toBe(index.root_scope_id);
  });

  it('generic interface has file_scope_id', () => {
    const code = `
interface Container<T> {
  get(): T;
  set(value: T): void;
}`;
    const index = build_semantic_index(code, 'test.ts');
    const interface_def = Array.from(index.interfaces.values()).find(i => i.name === 'Container');

    expect(interface_def!.scope_id).toBe(index.root_scope_id);
  });
});
```

### 5. Add TypeScript Enum Tests (20 min)

```typescript
describe('TypeScript Enums', () => {
  it('regular enum has file_scope_id', () => {
    const code = `
enum Direction {
  Up,
  Down,
  Left,
  Right
}`;
    const index = build_semantic_index(code, 'test.ts');
    const enum_def = Array.from(index.enums.values()).find(e => e.name === 'Direction');

    expect(enum_def!.scope_id).toBe(index.root_scope_id);
  });

  it('const enum has file_scope_id', () => {
    const code = `
const enum Status {
  Success = 0,
  Error = 1
}`;
    const index = build_semantic_index(code, 'test.ts');
    const enum_def = Array.from(index.enums.values()).find(e => e.name === 'Status');

    expect(enum_def!.scope_id).toBe(index.root_scope_id);
  });
});
```

### 6. Add Python Class Tests (25 min)

```typescript
describe('Python', () => {
  it('class at module scope has file_scope_id', () => {
    const code = `
class MyClass:
    def method(self):
        x = 1
`;
    const index = build_semantic_index(code, 'test.py');
    const class_def = Array.from(index.classes.values()).find(c => c.name === 'MyClass');

    expect(class_def!.scope_id).toBe(index.root_scope_id);
  });

  it('nested class has enclosing class scope_id', () => {
    const code = `
class Company:
    class Employee:
        def work(self):
            pass
`;
    const index = build_semantic_index(code, 'test.py');
    const employee = Array.from(index.classes.values()).find(c => c.name === 'Employee');
    const company_scope = Array.from(index.scopes.values()).find(s => s.name === 'Company');

    expect(employee!.scope_id).toBe(company_scope!.id);
  });

  it('class with decorators has file_scope_id', () => {
    const code = `
@dataclass
class Person:
    name: str
    age: int

    def greet(self):
        return f"Hello, {self.name}"
`;
    const index = build_semantic_index(code, 'test.py');
    const class_def = Array.from(index.classes.values()).find(c => c.name === 'Person');

    expect(class_def!.scope_id).toBe(index.root_scope_id);
  });
});
```

### 7. Add Rust Struct Tests (20 min)

```typescript
describe('Rust Structs', () => {
  it('struct at file scope has file_scope_id', () => {
    const code = `
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn area(&self) -> u32 {
        self.width * self.height
    }
}`;
    const index = build_semantic_index(code, 'test.rs');
    const struct_def = Array.from(index.classes.values()).find(c => c.name === 'Rectangle');

    expect(struct_def!.scope_id).toBe(index.root_scope_id);
  });

  it('tuple struct has file_scope_id', () => {
    const code = `
struct Point(i32, i32);

impl Point {
    fn distance(&self) -> f64 {
        ((self.0 * self.0 + self.1 * self.1) as f64).sqrt()
    }
}`;
    const index = build_semantic_index(code, 'test.rs');
    const struct_def = Array.from(index.classes.values()).find(c => c.name === 'Point');

    expect(struct_def!.scope_id).toBe(index.root_scope_id);
  });
});
```

### 8. Add Rust Enum Tests (20 min)

```typescript
describe('Rust Enums', () => {
  it('simple enum has file_scope_id', () => {
    const code = `
enum Color {
    Red,
    Green,
    Blue,
}

fn process_color(color: Color) {
    match color {
        Color::Red => println!("Red"),
        _ => println!("Other"),
    }
}`;
    const index = build_semantic_index(code, 'test.rs');
    const enum_def = Array.from(index.enums.values()).find(e => e.name === 'Color');

    expect(enum_def!.scope_id).toBe(index.root_scope_id);
  });

  it('enum with variants has file_scope_id', () => {
    const code = `
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
}

impl Message {
    fn call(&self) { }
}`;
    const index = build_semantic_index(code, 'test.rs');
    const enum_def = Array.from(index.enums.values()).find(e => e.name === 'Message');

    expect(enum_def!.scope_id).toBe(index.root_scope_id);
  });
});
```

### 9. Run Test Suite (10 min)

```bash
npm test -- scope_assignment.test.ts
```

Expected: All tests pass, confirming scope assignment fix works across all languages.

## Success Criteria

- ✅ Test file created with 40+ comprehensive tests
- ✅ Tests cover JavaScript, TypeScript, Python, Rust
- ✅ Tests verify classes, interfaces, enums, structs
- ✅ Tests cover nested definitions
- ✅ All tests pass

## Outputs

- `scope_assignment.test.ts` with comprehensive coverage

## Next Task

**task-epic-11.112.15** - Verify JavaScript semantic tests
