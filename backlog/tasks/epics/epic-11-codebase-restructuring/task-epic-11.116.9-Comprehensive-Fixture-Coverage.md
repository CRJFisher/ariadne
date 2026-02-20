# Task epic-11.116.9: Comprehensive Fixture Coverage for All Languages

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.3, task-epic-11.116.4
**Priority:** Medium (Quality improvement - current coverage functional but minimal for non-TypeScript)
**Created:** 2025-10-15

## Overview

Expand fixture coverage to comprehensively test all language features across all supported languages. Currently, TypeScript has 19 fixtures with comprehensive coverage while Python (4), Rust (2), and JavaScript (2) have minimal baseline coverage.

## Current State

### Coverage as of 2025-10-15

**TypeScript** ✅ Comprehensive (19 fixtures)
- Classes (4): properties, inheritance, methods, basic_class
- Functions (5): basic, arrow, call_chains, async, recursive
- Interfaces (2): basic_interface, extends
- Types (2): type_aliases, unions
- Generics (2): generic_functions, generic_classes
- Modules (2): exports, imports
- Enums (2): basic_enum, string_enum

**Python** ⚠️ Minimal (4 fixtures)
- Classes (2): basic_class, inheritance
- Functions (1): basic_functions
- Modules (1): imports

**Rust** ⚠️ Minimal (2 fixtures)
- Functions (1): basic_functions
- Structs (1): basic_struct

**JavaScript** ⚠️ Minimal (2 fixtures)
- Classes (1): basic_class
- Functions (1): basic_functions

## Objectives

1. Expand Python fixtures to match comprehensive testing philosophy
2. Expand Rust fixtures to cover all major language features
3. Expand JavaScript fixtures to cover ES6+ features
4. Ensure semantic indexer correctly handles all language constructs
5. Maintain focus on quality over quantity (realistic, focused fixtures)

## Target Coverage

### Python (Target: ~15 fixtures)

**Classes (5 fixtures):**
- ✅ basic_class.py - Already exists
- ✅ inheritance.py - Already exists
- ➕ methods.py - Instance methods, class methods, static methods, `@classmethod`, `@staticmethod`
- ➕ decorators.py - Class decorators, method decorators
- ➕ properties.py - `@property`, getters/setters, private/public conventions

**Functions (5 fixtures):**
- ✅ basic_functions.py - Already exists (but expand)
- ➕ decorators.py - Function decorators, decorator chains, `@functools.wraps`
- ➕ generators.py - Generator functions with `yield`, generator expressions
- ➕ async_functions.py - `async def`, `await`, `async for`, `async with`
- ➕ call_chains.py - Function calling functions (for call graph)

**Modules (3 fixtures):**
- ✅ imports.py - Already exists
- ➕ from_imports.py - `from X import Y`, `from X import *`, `from . import`
- ➕ exports.py - `__all__`, module-level definitions

**Additional (2 fixtures):**
- ➕ comprehensions.py - List/dict/set comprehensions
- ➕ context_managers.py - `with` statements, `__enter__`/`__exit__`

### Rust (Target: ~12 fixtures)

**Functions (3 fixtures):**
- ✅ basic_functions.rs - Already exists
- ➕ closures.rs - Closure syntax, move semantics, Fn/FnMut/FnOnce
- ➕ async_functions.rs - `async fn`, `.await`, futures

**Structs (3 fixtures):**
- ✅ basic_struct.rs - Already exists
- ➕ tuple_struct.rs - Tuple structs, unit structs
- ➕ generic_struct.rs - Generic structs, lifetime parameters

**Enums (2 fixtures):**
- ➕ basic_enum.rs - Simple enums, enum variants
- ➕ enum_with_data.rs - Enums with associated data, pattern matching

**Traits (2 fixtures):**
- ➕ basic_trait.rs - Trait definitions, default methods
- ➕ trait_bounds.rs - Generic trait bounds, `where` clauses

**Impls (2 fixtures):**
- ➕ impl_methods.rs - `impl` blocks with methods
- ➕ trait_impl.rs - Implementing traits for types

### JavaScript (Target: ~12 fixtures)

**Classes (3 fixtures):**
- ✅ basic_class.js - Already exists
- ➕ inheritance.js - Class extension, `super`, prototype chain
- ➕ private_fields.js - Private fields/methods with `#`

**Functions (4 fixtures):**
- ✅ basic_functions.js - Already exists (but expand)
- ➕ arrow_functions.js - Arrow functions, implicit returns, lexical `this`
- ➕ async_functions.js - `async`/`await`, Promise chains
- ➕ callbacks.js - Callback patterns, higher-order functions

**Modules (3 fixtures):**
- ➕ commonjs.js - `require()`, `module.exports`, `exports`
- ➕ es6_modules.js - `import`/`export`, default exports, named exports
- ➕ dynamic_imports.js - `import()` dynamic imports

**Additional (2 fixtures):**
- ➕ destructuring.js - Object/array destructuring in various contexts
- ➕ generators.js - Generator functions, `yield`, iterators

## Implementation Strategy

### Phase 1: Python Expansion (3-4 hours)

Priority order:
1. **decorators.py** (functions) - Important for Python idioms
2. **methods.py** (classes) - Critical for OOP testing
3. **async_functions.py** - Modern Python feature
4. **call_chains.py** - Needed for call graph testing

### Phase 2: Rust Expansion (3-4 hours)

Priority order:
1. **closures.rs** - Fundamental Rust feature
2. **basic_trait.rs** - Core to Rust's type system
3. **basic_enum.rs** - Essential Rust feature
4. **impl_methods.rs** - Common pattern

### Phase 3: JavaScript Expansion (3-4 hours)

Priority order:
1. **es6_modules.js** - Modern JS standard
2. **arrow_functions.js** - Ubiquitous in modern JS
3. **async_functions.js** - Critical for async code
4. **inheritance.js** - OOP patterns

### Phase 4: Generate and Verify (1-2 hours)

```bash
# Generate all new fixtures
npm run generate-fixtures:all

# Verify all fixtures valid
npm run verify-fixtures

# Manual review of key fixtures
# - Check Python decorators captured correctly
# - Check Rust trait definitions parsed
# - Check JS module imports/exports
```

## Fixture Guidelines

Each fixture should:

1. **Focus on specific feature** - Don't mix unrelated features
2. **Be realistic** - Real-world code patterns, not just minimal syntax
3. **Be self-contained** - No external dependencies
4. **Be appropriately sized** - 30-100 lines ideal
5. **Include test cases** - Code that exercises the feature for call graphs
6. **Have clear documentation** - Header comment explaining what's tested

**Example fixture structure:**

```python
"""
Function decorators
Tests: decorator syntax, decorator chains, functools.wraps
"""

import functools

def log_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@log_calls
def greet(name: str) -> str:
    return f"Hello, {name}"

# Call to test call graph
result = greet("World")
```

## Deliverables

- [ ] 11 new Python fixtures created
- [ ] 10 new Rust fixtures created
- [ ] 10 new JavaScript fixtures created
- [ ] All fixtures pass generation without errors
- [ ] All fixtures pass verification (npm run verify-fixtures)
- [ ] fixtures/README.md updated with new fixture inventory
- [ ] Manual review completed for representative samples
- [ ] All new fixtures committed to version control

## Success Criteria

- ✅ Python has 15+ fixtures covering all major language features
- ✅ Rust has 12+ fixtures covering structs, enums, traits, impls
- ✅ JavaScript has 12+ fixtures covering ES6+ features
- ✅ All fixtures generate valid JSON
- ✅ Fixtures demonstrate realistic code patterns
- ✅ Feature coverage documented in README
- ✅ No gaps in critical language constructs

## Estimated Effort

**10-14 hours total**

- 1 hour: Planning and fixture design
- 3-4 hours: Python fixtures (11 new files)
- 3-4 hours: Rust fixtures (10 new files)
- 3-4 hours: JavaScript fixtures (10 new files)
- 1-2 hours: Generation, verification, and review
- 1 hour: Documentation and commit

## Phasing

This task can be done incrementally:

**Phase 1 (High priority):**
- Python: decorators, methods, async, call_chains
- Rust: closures, traits, enums, impls
- JavaScript: es6_modules, arrow_functions, async

**Phase 2 (Medium priority):**
- Python: properties, generators, from_imports
- Rust: tuple_struct, generic_struct, trait_bounds
- JavaScript: inheritance, callbacks, private_fields

**Phase 3 (Nice to have):**
- Python: comprehensions, context_managers, exports
- Rust: async_functions, enum_with_data
- JavaScript: commonjs, destructuring, generators

## Dependencies

**Blocked by:**
- None (can start immediately)

**Blocks:**
- More comprehensive integration testing
- Language feature compatibility matrix
- Call graph detection for non-TypeScript features

## Notes

- This addresses the imbalance identified in task 116.4 review
- Current minimal coverage is functional but insufficient for confidence
- Comprehensive coverage critical for production use
- TypeScript coverage serves as model for other languages
- Focus on quality over quantity - 12-15 good fixtures > 50 minimal ones
- Can expand coverage incrementally over time

## Related Tasks

- **116.3**: Organize Code Fixtures (completed - created initial structure)
- **116.4**: Generate Initial JSON Fixtures (completed - minimal baseline)
- **116.5**: Registry Integration Tests (would benefit from more fixtures)
- **116.6**: Call Graph Integration Tests (needs call_chains.py/.rs/.js)
