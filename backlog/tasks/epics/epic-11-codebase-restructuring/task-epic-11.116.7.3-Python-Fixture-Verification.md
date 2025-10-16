# Task epic-11.116.7.3: Python Fixture Verification

**Status:** Not Started
**Parent:** task-epic-11.116.7
**Depends On:** task-epic-11.116.5.3
**Priority:** Medium
**Created:** 2025-10-16

## Overview

Verify that all Python semantic index JSON fixtures correctly represent their source code files. Python fixtures cover classes, functions, and modules with 17+ fixtures across 3 categories.

## Fixture Categories to Verify

### 1. Classes (5 fixtures)
- `advanced_oop` - Advanced OOP features (properties, class methods)
- `basic_class` - Basic class with `__init__` and methods
- `constructor_workflow` - Constructor calling methods
- `inheritance` - Class inheritance and super()
- `method_types` - Instance, class, and static methods

### 2. Functions (5 fixtures)
- `basic_functions` - Function definitions
- `closures` - Nested functions and closures
- `language_features` - Python-specific features (decorators, comprehensions)
- `nested_scopes` - Nested function scopes
- `variable_shadowing` - Variable shadowing scenarios

### 3. Modules (7 fixtures)
- `import_patterns` - Various import styles
- `imports` - Basic import statements
- `main` - Main entry point module
- `shadowing` - Module-level shadowing
- `user_class` - Class definition module
- `uses_user` - Module using imported class
- `utils` - Utility functions module

## Verification Approach

For each fixture:

1. **Read source code file** from `packages/core/tests/fixtures/python/code/{category}/{name}.py`
2. **Read JSON fixture** from `packages/core/tests/fixtures/python/semantic_index/{category}/{name}.json`
3. **Verify semantic elements**:
   - All definitions (classes, functions, methods) are captured
   - `__init__`, `__str__`, and other magic methods are identified
   - Decorators are captured
   - Scope hierarchy matches indentation structure
   - Function calls and references are accurate
   - Import patterns (from...import, import...as) are distinguished
   - Source locations are precise

4. **Document findings**:
   - List verified elements for each fixture
   - Create issue sub-tasks for any discrepancies
   - Note Python-specific patterns (decorators, magic methods, indentation-based scoping)

## Issue Sub-Task Creation

When discrepancies are found, create sub-tasks under this task:
- `task-epic-11.116.7.3.1-Fix-{Issue-Name}.md`
- `task-epic-11.116.7.3.2-Fix-{Issue-Name}.md`
- etc.

Each issue sub-task should:
- Describe the discrepancy (expected vs actual)
- Identify the root cause (indexing logic vs fixture generation)
- Propose a fix
- Reference the specific fixture file(s) affected

## Verification Checklist

### Classes Category
- [ ] `advanced_oop.json` - Verify @property, @classmethod decorators
- [ ] `basic_class.json` - Verify class, `__init__`, methods
- [ ] `constructor_workflow.json` - Verify `__init__`→method calls
- [ ] `inheritance.json` - Verify parent class, super() calls
- [ ] `method_types.json` - Verify instance/class/static methods

### Functions Category
- [ ] `basic_functions.json` - Verify function definitions
- [ ] `closures.json` - Verify nested function captures
- [ ] `language_features.json` - Verify decorators, comprehensions
- [ ] `nested_scopes.json` - Verify nested function scopes
- [ ] `variable_shadowing.json` - Verify shadowing resolution

### Modules Category
- [ ] `import_patterns.json` - Verify from...import, import...as
- [ ] `imports.json` - Verify basic imports
- [ ] `main.json` - Verify if __name__ == "__main__"
- [ ] `shadowing.json` - Verify module shadowing
- [ ] `user_class.json` - Verify class exports
- [ ] `uses_user.json` - Verify class imports
- [ ] `utils.json` - Verify function exports

## Deliverables

- [ ] All 17+ Python fixtures verified
- [ ] Verification notes documenting semantic accuracy
- [ ] Issue sub-tasks created for any discrepancies (if needed)
- [ ] Summary of Python-specific patterns (decorators, magic methods, indentation)

## Success Criteria

- ✅ All fixture categories verified
- ✅ Semantic accuracy confirmed for Python language features
- ✅ Decorators and magic methods properly captured
- ✅ Indentation-based scoping correctly represented
- ✅ Any issues documented as sub-tasks

## Estimated Effort

**3-4 hours**
- Setup and first few fixtures: 0.5 hour
- Systematic verification: 2-2.5 hours
- Issue documentation: 0.5 hour
- Summary and patterns: 0.5 hour

## Notes

- Python uses indentation for scoping - verify scope boundaries are correct
- Magic methods (`__init__`, `__str__`, etc.) are critical for OOP
- Decorators modify function/method behavior - ensure they're captured
- Python's import system has many patterns - verify all are handled
- Focus on scope boundary extraction from indentation
