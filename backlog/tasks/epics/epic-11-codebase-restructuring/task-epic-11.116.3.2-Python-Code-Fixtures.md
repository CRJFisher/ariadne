# Task epic-11.116.3.2: Python Code Fixtures - Audit and Reorganization

**Status:** Not Started
**Parent:** task-epic-11.116.3
**Language:** Python
**Priority:** High
**Estimated Effort:** 1.5 hours

## Objective

Audit existing Python fixtures, reorganize them into the new folder structure, and ensure comprehensive coverage of Python-specific language features.

## Current State

**Location:** `packages/core/tests/fixtures/python/`

**Existing fixtures:**
- functions.py
- types.py
- implicit_exports.py
- comprehensive_type_hints.py
- imports.py
- comprehensive_definitions.py
- classes.py
- comprehensive_exports.py
- scope_hierarchy.py
- decorators.py

## Tasks

### 1. Audit Existing Fixtures

Review each fixture file and categorize by language feature.

### 2. Create Category Structure

Create new folder structure:
```
fixtures/python/code/
├── classes/
├── functions/
├── types/
├── modules/
├── decorators/
├── scope/
└── async/
```

### 3. Reorganize Fixtures

#### Classes Category
- `basic_class.py` - Simple class definition
- `inheritance.py` - Class inheritance
- `methods.py` - Instance and class methods
- `static_methods.py` - @staticmethod
- `class_methods.py` - @classmethod
- `dataclasses.py` - @dataclass usage
- `properties.py` - @property decorator

From existing:
- Split `classes.py` → focused files

#### Functions Category
- `function_definition.py` - Basic function def
- `lambda_functions.py` - Lambda expressions
- `decorators.py` - Function decorators (keep from existing)
- `generators.py` - Generator functions
- `args_kwargs.py` - *args and **kwargs

From existing:
- Split `functions.py` → focused files

#### Types Category
- `type_hints.py` - Basic type hints
- `type_aliases.py` - Type aliases (TypeAlias)
- `union_types.py` - Union types
- `optional_types.py` - Optional types
- `generic_types.py` - Generic[T] usage

From existing:
- Split `types.py` → focused files
- Split `comprehensive_type_hints.py` → focused files

#### Modules Category
- `basic_imports.py` - Import statements
- `from_imports.py` - from ... import
- `relative_imports.py` - Relative imports
- `star_imports.py` - from ... import *
- `exports.py` - __all__ exports

From existing:
- Split `imports.py` → focused files
- Use `implicit_exports.py` and `comprehensive_exports.py`

#### Decorators Category
- Keep `decorators.py` but may split if comprehensive
- `function_decorators.py` - Function decorators
- `class_decorators.py` - Class decorators
- `decorator_with_args.py` - Decorators with arguments

#### Scope Category
- Keep `scope_hierarchy.py` or split:
- `function_scope.py` - Function scoping
- `class_scope.py` - Class scoping
- `module_scope.py` - Module-level variables
- `nested_scope.py` - Nested function scopes

#### Async Category (NEW)
- `async_def.py` - Async function definitions
- `await_expressions.py` - Await usage
- `async_generators.py` - Async generators
- `async_context_managers.py` - Async with

### 4. Create Missing Fixtures

Python-specific features that may need new fixtures:
- [ ] `classes/dataclasses.py` - @dataclass
- [ ] `classes/properties.py` - @property
- [ ] `async/async_def.py` - async/await
- [ ] `functions/generators.py` - yield statements
- [ ] `types/generic_types.py` - Generic types
- [ ] `decorators/decorator_with_args.py` - Parameterized decorators

### 5. File Naming Convention

Use descriptive, snake_case names (natural for Python):
- ✓ `basic_class.py`
- ✓ `class_inheritance.py`
- ✓ `async_def.py`

### 6. Fixture Quality Guidelines

Each fixture should:
- Focus on ONE specific Python feature
- Follow PEP 8 style guidelines
- Include docstrings where appropriate
- Be concise and focused
- Include type hints where relevant

**Example:**
```python
# fixtures/python/code/classes/inheritance.py
"""
Tests class inheritance and method overriding in Python
"""

class Animal:
    def __init__(self, name: str):
        self.name = name

    def speak(self) -> str:
        return "Some sound"

class Dog(Animal):
    def __init__(self, name: str, breed: str):
        super().__init__(name)
        self.breed = breed

    # Override parent method
    def speak(self) -> str:
        return "Woof!"

    # New method
    def fetch(self) -> None:
        print(f"{self.name} is fetching")

__all__ = ['Animal', 'Dog']
```

## Deliverables

- [ ] All existing Python fixtures reviewed and categorized
- [ ] New folder structure created: `fixtures/python/code/{category}/`
- [ ] All fixtures reorganized into appropriate categories
- [ ] Large "comprehensive_*" files split into focused fixtures
- [ ] Missing high-priority fixtures created
- [ ] All fixtures follow Python style guidelines
- [ ] Python feature coverage documented

## Feature Coverage Checklist

Python-specific features to ensure coverage:

### Type System
- [ ] Basic type hints (int, str, etc.)
- [ ] Type aliases (TypeAlias)
- [ ] Union types
- [ ] Optional types
- [ ] Generic types
- [ ] Protocol (structural typing)

### Classes
- [ ] Basic class definition
- [ ] Inheritance
- [ ] Multiple inheritance
- [ ] @staticmethod
- [ ] @classmethod
- [ ] @property
- [ ] @dataclass
- [ ] __init__ methods

### Functions
- [ ] def statements
- [ ] Lambda expressions
- [ ] Decorators
- [ ] *args and **kwargs
- [ ] Generators (yield)
- [ ] Type-annotated functions

### Modules
- [ ] import statements
- [ ] from ... import
- [ ] Relative imports
- [ ] __all__ exports
- [ ] Implicit exports

### Scope
- [ ] Module scope
- [ ] Function scope
- [ ] Class scope
- [ ] Nested scopes
- [ ] global and nonlocal

### Async
- [ ] async def
- [ ] await expressions
- [ ] Async generators
- [ ] Async context managers

### Decorators
- [ ] Function decorators
- [ ] Class decorators
- [ ] Decorators with arguments
- [ ] Built-in decorators (@property, @staticmethod, etc.)

## Acceptance Criteria

- [ ] All Python fixtures reorganized into new structure
- [ ] No "comprehensive_*" files remain (all split)
- [ ] Feature coverage checklist 100% complete
- [ ] All fixtures follow PEP 8 style
- [ ] Documentation of Python coverage complete

## Notes

- Python doesn't have interfaces - use Protocol or abstract classes
- Focus on Python 3.9+ features (match/case may be optional)
- Ensure proper __all__ exports where appropriate
