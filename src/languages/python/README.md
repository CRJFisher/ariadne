# Python Language Support

This module provides Python language support for the ast-climber code intelligence engine using tree-sitter-python.

## Features

- **Function definitions and references**
- **Class definitions and methods**
- **Variable and constant definitions**
- **Import tracking** (both `import` and `from ... import` statements)
- **Type annotations** (including generic types like `List[int]`)
- **Python-specific constructs**:
  - Lambda functions
  - List/dict/set comprehensions
  - Generator expressions
  - Decorators
  - Global and nonlocal keywords
  - Walrus operator (`:=`)
  - Pattern matching (destructuring assignments)
  - With statements
  - Default parameters

## Scope Rules

Python's scoping follows the LEGB rule (Local, Enclosing, Global, Built-in):

1. **Module scope**: The top-level scope of a Python file
2. **Function scope**: Created by function definitions (including lambdas)
3. **Class scope**: Created by class definitions
4. **Comprehension scope**: List/dict/set comprehensions and generator expressions create their own scopes
5. **Block scope**: `with` and `for` statements create new scopes

## Symbol Types

The following symbol types are recognized:

### Functions and Classes
- `function`: Regular function definitions
- `async_function`: Async function definitions
- `method`: Class methods
- `async_method`: Async methods
- `class`: Class definitions
- `generator`: Generator functions
- `async_generator`: Async generator functions
- `decorator`: Decorator definitions

### Variables
- `variable`: Variable assignments
- `constant`: Constant assignments (by convention)
- `parameter`: Function/method parameters
- `attribute`: Class attributes
- `property`: Properties
- `global`: Global variable declarations
- `nonlocal`: Nonlocal variable declarations

## Special Handling

### Imports
Python imports are tracked specially:
- `import module` imports the module name
- `from module import name` imports the specific name
- Aliased imports (`import x as y`) track the alias

### Type Annotations
Type annotations create references to type names:
- Simple types: `x: int`
- Generic types: `x: List[int]`
- Return types: `def foo() -> str:`

### Global and Nonlocal
The `global` and `nonlocal` keywords create variable definitions that can modify variables in outer scopes.

### Hoisted Definitions
Function definitions in Python are hoisted to their containing scope, allowing forward references within the same scope.

## Example

```python
from typing import List, Optional

class Calculator:
    """A simple calculator class."""
    
    def __init__(self, name: str):
        self.name = name
        self.history: List[float] = []
    
    def add(self, a: float, b: float) -> float:
        """Add two numbers and record in history."""
        result = a + b
        self.history.append(result)
        return result
    
    def get_last_result(self) -> Optional[float]:
        """Get the last calculation result."""
        return self.history[-1] if self.history else None

# Global function using the Calculator
def process_calculations(values: List[tuple[float, float]]) -> List[float]:
    calc = Calculator("processor")
    return [calc.add(a, b) for a, b in values]
```

In this example:
- `List` and `Optional` are imported from `typing`
- `Calculator` is defined as a class with methods
- Type annotations create references to imported types
- The list comprehension creates its own scope for `a` and `b`
- `self` is a special parameter that references instance attributes

## Implementation Notes

### Changes from Bloop Server Implementation

Our `scopes.scm` file is based on the bloop server's Python implementation with the following enhancements:

1. **Added support for generic types in type annotations** - The original bloop implementation only captured simple type identifiers (e.g., `T`, `int`), but didn't handle generic types like `List[T]` or `Dict[str, int]`. We added three additional patterns to capture identifiers within generic types:
   - Generic type parameters in function parameters: `def foo(a: List[T])`
   - Generic return types: `def foo() -> List[T]:`
   - Generic types in variable annotations: `var: List[T] = init()`

These additions ensure that type identifiers nested within generic type constructs are properly tracked as references, which is essential for comprehensive type analysis in modern Python code that makes heavy use of type hints from the `typing` module.
