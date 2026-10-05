# Task epic-11.116.7.2: JavaScript Fixture Verification

**Status:** Not Started
**Parent:** task-epic-11.116.7
**Depends On:** task-epic-11.116.5.2
**Priority:** Medium
**Created:** 2025-10-16

## Overview

Verify that all JavaScript semantic index JSON fixtures correctly represent their source code files. JavaScript fixtures cover ES6 and CommonJS patterns with 21+ fixtures across 3 categories.

## Fixture Categories to Verify

### 1. Classes (5 fixtures)
- `basic_class` - ES6 class with constructor and methods
- `constructor_workflow` - Constructor calling other methods
- `dynamic_access` - Dynamic property access patterns
- `object_literals` - Object literal patterns
- `prototype_methods` - Prototype-based method definitions

### 2. Functions (7 fixtures)
- `basic_functions` - Function declarations and expressions
- `callbacks` - Callback patterns
- `closures` - Closure and lexical scope
- `factory_patterns` - Factory function patterns
- `iife_patterns` - Immediately Invoked Function Expressions
- `nested_scopes` - Nested function scopes
- `variable_shadowing` - Variable shadowing scenarios

### 3. Modules (9 fixtures)
- `main_commonjs` - CommonJS require/exports
- `main_es6` - ES6 import/export
- `shadowing` - Module-level shadowing
- `user_class` - Class in module
- `uses_user` - Importing and using classes
- `utils_commonjs` - CommonJS utility module
- `utils_es6` - ES6 utility module

## Verification Approach

For each fixture:

1. **Read source code file** from `packages/core/tests/fixtures/javascript/code/{category}/{name}.js`
2. **Read JSON fixture** from `packages/core/tests/fixtures/javascript/semantic_index/{category}/{name}.json`
3. **Verify semantic elements**:
   - All definitions (classes, functions, methods, variables) are captured
   - Scope hierarchy matches lexical structure
   - Function calls and references are accurate
   - Closures and captured variables are identified
   - Source locations are precise
   - CommonJS vs ES6 module patterns are distinguished
   - Prototype-based patterns are handled correctly

4. **Document findings**:
   - List verified elements for each fixture
   - Create issue sub-tasks for any discrepancies
   - Note JavaScript-specific patterns (prototypes, IIFE, etc.)

## Issue Sub-Task Creation

When discrepancies are found, create sub-tasks under this task:
- `task-epic-11.116.7.2.1-Fix-{Issue-Name}.md`
- `task-epic-11.116.7.2.2-Fix-{Issue-Name}.md`
- etc.

Each issue sub-task should:
- Describe the discrepancy (expected vs actual)
- Identify the root cause (indexing logic vs fixture generation)
- Propose a fix
- Reference the specific fixture file(s) affected

## Verification Checklist

### Classes Category
- [ ] `basic_class.json` - Verify ES6 class definition
- [ ] `constructor_workflow.json` - Verify constructor→method calls
- [ ] `dynamic_access.json` - Verify dynamic property access
- [ ] `object_literals.json` - Verify object literal patterns
- [ ] `prototype_methods.json` - Verify prototype-based methods

### Functions Category
- [ ] `basic_functions.json` - Verify function declarations/expressions
- [ ] `callbacks.json` - Verify callback patterns
- [ ] `closures.json` - Verify closure captures
- [ ] `factory_patterns.json` - Verify factory function patterns
- [ ] `iife_patterns.json` - Verify IIFE scoping
- [ ] `nested_scopes.json` - Verify nested function scopes
- [ ] `variable_shadowing.json` - Verify shadowing resolution

### Modules Category
- [ ] `main_commonjs.json` - Verify CommonJS imports
- [ ] `main_es6.json` - Verify ES6 imports
- [ ] `shadowing.json` - Verify module shadowing
- [ ] `user_class.json` - Verify class exports
- [ ] `uses_user.json` - Verify class imports
- [ ] `utils_commonjs.json` - Verify CommonJS exports
- [ ] `utils_es6.json` - Verify ES6 exports

## Deliverables

- [ ] All 21+ JavaScript fixtures verified
- [ ] Verification notes documenting semantic accuracy
- [ ] Issue sub-tasks created for any discrepancies (if needed)
- [ ] Summary of JavaScript-specific patterns (prototypes, IIFE, CommonJS/ES6)

## Success Criteria

- ✅ All fixture categories verified
- ✅ Semantic accuracy confirmed for JavaScript language features
- ✅ CommonJS and ES6 module patterns correctly distinguished
- ✅ Dynamic patterns (prototypes, closures) properly captured
- ✅ Any issues documented as sub-tasks

## Estimated Effort

**3-4 hours**
- Setup and first few fixtures: 0.5 hour
- Systematic verification: 2-2.5 hours
- Issue documentation: 0.5 hour
- Summary and patterns: 0.5 hour

## Notes

- JavaScript has dynamic patterns that TypeScript doesn't (prototypes, IIFE)
- Pay special attention to CommonJS vs ES6 module handling
- Closures and variable captures are critical for call graph analysis
- Document how dynamic patterns are represented in semantic index
