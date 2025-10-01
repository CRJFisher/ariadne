# Extended Builder Method Audit

## Overview

This document audits five builder methods that were incompletely covered in the initial audit:
1. `add_property_signature_to_interface`
2. `add_enum`
3. `add_enum_member`
4. `add_namespace`
5. `add_decorator_to_target`

## Method-by-Method Analysis

### 1. `add_property_signature_to_interface`

**Purpose:** Add a property signature to an interface (TypeScript interfaces, Rust traits)

**Signature:**
```typescript
add_property_signature_to_interface(
  interface_id: SymbolId,
  definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    type?: SymbolName;
    optional?: boolean;
    readonly?: boolean;
  }
): DefinitionBuilder
```

**Language Support:**

| Language | Should Use? | Currently Uses? | Gap |
|----------|-------------|-----------------|-----|
| JavaScript | N/A (no interfaces) | N/A | - |
| TypeScript | ✅ Yes | ✅ Yes | ✅ Complete |
| Python | ⚠️ Maybe (Protocols) | ❌ No | ⚠️ Missing |
| Rust | ⚠️ Maybe (trait associated types) | ❌ No | ⚠️ Missing |

**TypeScript Usage:**
```typescript
interface Point {
  x: number;    // ← property signature
  y: number;    // ← property signature
  readonly z?: number;  // ← optional, readonly
}
```
✅ Currently tracked in TypeScript builder

**Python Gap: Protocol Properties**
```python
from typing import Protocol

class Drawable(Protocol):
    color: str  # ← property signature
    width: int  # ← property signature

    def draw(self) -> None: ...
```
❌ Not currently tracked - Python protocols with properties aren't handled

**Rust Gap: Trait Associated Types**
```rust
trait Container {
    type Item;  // ← associated type (not quite a property)
    fn get(&self) -> &Self::Item;
}
```
❌ Not tracked as property signature
⚠️ However: Associated types are different from properties - they're type parameters set at implementation time, not properties. Current handling as type aliases may be correct.

**Issues:**
- TypeScript: ✅ Working
- Python: ❌ Missing Protocol property support
- Rust: ⚠️ Associated types handled differently (as type aliases) - may be correct approach

---

### 2. `add_enum`

**Purpose:** Add an enum definition

**Signature:**
```typescript
add_enum(definition: {
  symbol_id: SymbolId;
  name: SymbolName;
  location: Location;
  scope_id: ScopeId;
  availability: SymbolAvailability;
  is_const?: boolean;
}): DefinitionBuilder
```

**Language Support:**

| Language | Should Use? | Currently Uses? | Gap |
|----------|-------------|-----------------|-----|
| JavaScript | N/A (no enums) | N/A | - |
| TypeScript | ✅ Yes | ✅ Yes | ✅ Complete |
| Python | ✅ Yes | ❌ No | ❌ **CRITICAL** |
| Rust | ✅ Yes | ✅ Yes | ✅ Complete |

**TypeScript Usage:**
```typescript
enum Color {
  Red,
  Green,
  Blue
}

const enum Direction {  // const enum
  Up, Down, Left, Right
}
```
✅ Currently tracked with `is_const` flag

**Python CRITICAL Gap:**
```python
from enum import Enum, IntEnum, StrEnum

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3

class Status(StrEnum):
    PENDING = "pending"
    COMPLETE = "complete"
```
❌ **NOT TRACKED AT ALL!** Python enums are classes that inherit from `Enum`, but we don't recognize them as enums.

**Rust Usage:**
```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}

enum Color {
    Red,
    Green,
    Blue,
}
```
✅ Currently tracked

**Issues:**
- TypeScript: ✅ Working
- Python: ❌ **CRITICAL** - No enum support despite Python having enums
- Rust: ✅ Working

---

### 3. `add_enum_member`

**Purpose:** Add a member/variant to an enum

**Signature:**
```typescript
add_enum_member(
  enum_id: SymbolId,
  definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    value?: string | number;
  }
): DefinitionBuilder
```

**Language Support:**

| Language | Should Use? | Currently Uses? | Gap |
|----------|-------------|-----------------|-----|
| JavaScript | N/A | N/A | - |
| TypeScript | ✅ Yes | ✅ Yes | ✅ Complete |
| Python | ✅ Yes | ❌ No | ❌ **CRITICAL** |
| Rust | ✅ Yes | ✅ Yes | ⚠️ Partial |

**TypeScript Usage:**
```typescript
enum Color {
  Red = "#ff0000",   // ← member with value
  Green = "#00ff00", // ← member with value
  Blue = 3           // ← member with numeric value
}
```
✅ Members tracked with values

**Python Gap:**
```python
class Color(Enum):
    RED = 1      # ← member with value
    GREEN = 2    # ← member with value
    BLUE = 3     # ← member with value
```
❌ Not tracked because enums themselves aren't tracked

**Rust Usage:**
```rust
enum Color {
    Red,         // ← variant without data
    Green,       // ← variant without data
    Blue,        // ← variant without data
}

enum Message {
    Move { x: i32, y: i32 },  // ← variant with fields
    Write(String),             // ← variant with tuple data
    Quit,
}
```
⚠️ **Partial** - Simple variants tracked, but variants with fields/data may not capture the field structure

**Issues:**
- TypeScript: ✅ Working
- Python: ❌ Missing (depends on enum support)
- Rust: ⚠️ Partial - enum variants with fields/data may not fully represent the structure

---

### 4. `add_namespace`

**Purpose:** Add a namespace/module definition

**Signature:**
```typescript
add_namespace(definition: {
  symbol_id: SymbolId;
  name: SymbolName;
  location: Location;
  scope_id: ScopeId;
  availability: SymbolAvailability;
}): DefinitionBuilder
```

**Language Support:**

| Language | Should Use? | Currently Uses? | Gap |
|----------|-------------|-----------------|-----|
| JavaScript | ⚠️ Maybe (modules) | ❌ No | ⚠️ Questionable |
| TypeScript | ✅ Yes | ✅ Yes | ✅ Complete |
| Python | ⚠️ Maybe (modules) | ❌ No | ⚠️ Questionable |
| Rust | ✅ Yes | ✅ Yes | ✅ Complete |

**TypeScript Usage:**
```typescript
namespace Validation {
    export interface StringValidator {
        isValid(s: string): boolean;
    }

    export class LettersOnlyValidator implements StringValidator {
        isValid(s: string) { return /^[A-Za-z]+$/.test(s); }
    }
}
```
✅ Namespaces tracked

**Python Question:**
```python
# Python doesn't have explicit namespaces
# Modules ARE the namespace mechanism
# module.py file itself is the namespace
```
⚠️ Should we track file-level modules as namespaces? Probably not - they're implicit.

**Rust Usage:**
```rust
mod graphics {
    pub struct Point { x: i32, y: i32 }

    pub mod shapes {
        pub struct Circle { radius: f64 }
    }
}
```
✅ Modules tracked as namespaces

**Issues:**
- TypeScript: ✅ Working
- Python: ⚠️ Modules are file-level, not explicit constructs - probably correct to not track
- Rust: ✅ Working
- JavaScript: ⚠️ No namespace keyword - correct to not track

---

### 5. `add_decorator_to_target`

**Purpose:** Add a decorator to a class, method, or property

**Signature:**
```typescript
add_decorator_to_target(
  target_id: SymbolId,
  decorator: {
    name: SymbolName;
    arguments?: string[];
    location: Location;
  }
): DefinitionBuilder
```

**Language Support:**

| Language | Should Use? | Currently Uses? | Gap |
|----------|-------------|-----------------|-----|
| JavaScript | ⚠️ Stage 3 proposal | ❌ No | ⚠️ Future |
| TypeScript | ✅ Yes | ✅ Yes | ✅ Complete |
| Python | ✅ Yes | ❌ No | ❌ **CRITICAL** |
| Rust | N/A (uses macros) | N/A | - |

**TypeScript Usage:**
```typescript
@Component({ selector: 'app-root' })
class AppComponent {
    @Input() name: string;

    @Output()
    changed = new EventEmitter();
}
```
✅ Decorators tracked with arguments

**Python CRITICAL Gap:**
```python
@dataclass
class Point:
    x: int
    y: int

class MyClass:
    @property
    def value(self):
        return self._value

    @staticmethod
    def create():
        return MyClass()
```
❌ **ALREADY IDENTIFIED IN FIRST AUDIT** - Python extracts decorators but never calls `add_decorator_to_target`!

**JavaScript:**
```javascript
// Decorators are Stage 3 proposal, not standard yet
@sealed
class MyClass {
    @readonly
    property = 1;
}
```
⚠️ Not in standard JavaScript yet - may want to add when stage 4

**Rust:**
```rust
// Rust uses macros, not decorators
#[derive(Debug, Clone)]
struct Point { x: i32, y: i32 }
```
N/A - Macros tracked as function calls, which is probably correct

**Issues:**
- TypeScript: ✅ Working
- Python: ❌ **CRITICAL** - Already identified in first audit (task 11.108.4)
- JavaScript: ⚠️ Future consideration
- Rust: N/A - uses different mechanism

---

## Summary of Critical Gaps

### 1. Python Enum Support - **CRITICAL**

**Impact:** HIGH - Python's `Enum` class is widely used

**Example:**
```python
from enum import Enum

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3
```

**Required:**
1. Query to detect classes inheriting from `Enum`
2. Handler to call `add_enum`
3. Handler to call `add_enum_member` for each enum member
4. Tests for enum extraction

**Difficulty:** Medium - requires AST analysis to detect Enum inheritance

---

### 2. Python Decorators - **CRITICAL**

**Impact:** HIGH - Decorators are ubiquitous in Python

**Status:** Already identified in task 11.108.4

---

### 3. Python Protocol Properties - Medium Priority

**Impact:** MEDIUM - Protocols with properties are less common

**Example:**
```python
from typing import Protocol

class Drawable(Protocol):
    color: str
    width: int
```

**Required:**
1. Detect Protocol classes
2. Extract property signatures
3. Call `add_property_signature_to_interface`

**Difficulty:** Medium - requires Protocol detection

---

### 4. Rust Enum Variants with Fields - Low Priority

**Impact:** LOW-MEDIUM - Complex enum variants exist but basic tracking may suffice

**Example:**
```rust
enum Message {
    Move { x: i32, y: i32 },     // Named fields
    Write(String),                // Tuple data
    ChangeColor(i32, i32, i32),  // Multiple tuple fields
}
```

**Current:** Variants tracked but field structure may be incomplete

**Required:** Enhance enum member tracking to capture field information

**Difficulty:** Medium-High - complex AST structure

---

## Recommendations

### Immediate Actions (Add to Task 11.108.4 - Python)

1. **Add Python Enum Support:**
   - Query: Detect `class X(Enum):`
   - Handler: `add_enum` + `add_enum_member`
   - Test: Enum extraction

2. **Add Python Protocol Property Support:**
   - Query: Detect Protocol classes and their properties
   - Handler: Create interface + `add_property_signature_to_interface`
   - Test: Protocol property extraction

### Future Considerations

1. **JavaScript Decorators:**
   - Monitor decorator proposal progress
   - Add support when Stage 4

2. **Rust Complex Enum Variants:**
   - Enhance member tracking for variants with fields
   - Low priority unless needed for specific use case

## Updated Language Coverage Matrix

| Method | JS | TS | Python | Rust | Priority |
|--------|----|----|--------|------|----------|
| `add_property_signature_to_interface` | N/A | ✅ | ⚠️ Add Protocol support | ⚠️ OK (associated types different) | Medium |
| `add_enum` | N/A | ✅ | ❌ **Add Enum support** | ✅ | **HIGH** |
| `add_enum_member` | N/A | ✅ | ❌ **Add members** | ⚠️ Partial (enhance?) | **HIGH** |
| `add_namespace` | N/A | ✅ | ✅ OK (files are namespaces) | ✅ | ✅ OK |
| `add_decorator_to_target` | ⚠️ Future | ✅ | ❌ **Already in 11.108.4** | N/A | **HIGH** |

## Task Impact

This audit reveals **two new critical gaps for Python:**

1. **Enum support** - Not addressed in current tasks
2. **Protocol property support** - Not addressed in current tasks

These should be added to task 11.108.4.
