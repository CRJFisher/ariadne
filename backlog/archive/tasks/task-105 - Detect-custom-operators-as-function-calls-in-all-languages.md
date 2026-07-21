---
id: task-105
title: Detect custom operators as function calls in all languages
status: To Do
assignee: []
created_date: "2025-08-12 21:01"
labels: []
dependencies: []
---

## Description

Ensure that custom operators (like Python's `__add__`, `__mul__`, etc.) are properly detected and tracked as function calls in the codebase analysis. This includes operator overloading in various languages.

## Context

Custom operators and operator overloading are important parts of many programming languages. In Python, operations like `a + b` actually call `a.__add__(b)` under the hood. These operator methods should be tracked as function calls for complete code analysis, but may currently be missed.

## Requirements

- Identify all custom operator patterns in supported languages:
  - Python: `__add__`, `__sub__`, `__mul__`, `__div__`, `__eq__`, `__lt__`, etc.
  - JavaScript/TypeScript: `Symbol.toPrimitive`, `valueOf`, `toString` (when used in operations)
  - Rust: trait implementations for `Add`, `Sub`, `Mul`, etc.
  - Other languages as applicable
- Detect when these operators are:
  - Defined (as methods/functions)
  - Called implicitly through operator usage (e.g., `+` calling `__add__`)
- Track both explicit calls (`obj.__add__(other)`) and implicit calls (`obj + other`)

## Technical Approach

1. Research operator overloading patterns in each supported language
2. Update tree-sitter queries to capture operator definitions
3. Add logic to detect implicit operator calls from operator usage
4. Map operators to their corresponding method names:
   - `+` → `__add__` (Python)
   - `-` → `__sub__` (Python)
   - `*` → `__mul__` (Python)
   - etc.
5. Test with real-world examples of operator overloading
6. Ensure cross-file tracking works for custom operators

## Acceptance Criteria

- [ ] Document all custom operator patterns for each language
- [ ] Update parsers to detect operator method definitions
- [ ] Implement implicit call detection for operator usage
- [ ] Add tests for Python dunder methods (`__add__`, `__mul__`, etc.)
- [ ] Add tests for operator overloading in other supported languages
- [ ] Verify cross-file tracking works for custom operators
- [ ] Ensure performance is not significantly impacted

## Implementation Notes

[Notes added during implementation]

### Python Examples to Test

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):  # Should be detected as function definition
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar):  # Should be detected as function definition
        return Vector(self.x * scalar, self.y * scalar)

# These should be detected as calls to __add__ and __mul__
v1 = Vector(1, 2)
v2 = Vector(3, 4)
v3 = v1 + v2  # Implicit call to v1.__add__(v2)
v4 = v1 * 2   # Implicit call to v1.__mul__(2)
```

### Key Operator Methods to Track

- Arithmetic: `__add__`, `__sub__`, `__mul__`, `__div__`, `__mod__`, `__pow__`
- Comparison: `__eq__`, `__ne__`, `__lt__`, `__le__`, `__gt__`, `__ge__`
- Bitwise: `__and__`, `__or__`, `__xor__`, `__lshift__`, `__rshift__`
- Unary: `__neg__`, `__pos__`, `__abs__`, `__invert__`
- Container: `__getitem__`, `__setitem__`, `__delitem__`, `__contains__`
- Context managers: `__enter__`, `__exit__`
- Iteration: `__iter__`, `__next__`
