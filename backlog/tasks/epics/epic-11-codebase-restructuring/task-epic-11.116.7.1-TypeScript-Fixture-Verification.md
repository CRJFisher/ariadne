# Task epic-11.116.7.1: TypeScript Fixture Verification

**Status:** Not Started
**Parent:** task-epic-11.116.7
**Depends On:** task-epic-11.116.5.1
**Priority:** Medium
**Created:** 2025-10-16

## Overview

Verify that all TypeScript semantic index JSON fixtures correctly represent their source code files. TypeScript has the most comprehensive fixture coverage with 42+ fixtures across 8 categories.

## Fixture Categories to Verify

### 1. Classes (4 fixtures)
- `basic_class` - Basic class with constructor and methods
- `inheritance` - Class inheritance and super calls
- `methods` - Various method types (static, private, async)
- `properties` - Property declarations and initializers

### 2. Enums (2 fixtures)
- `basic_enum` - Numeric enum
- `string_enum` - String enum

### 3. Functions (5 fixtures)
- `arrow_functions` - Arrow function expressions
- `async_functions` - Async/await patterns
- `basic_functions` - Regular function declarations
- `call_chains` - Function call chains
- `recursive` - Recursive function calls

### 4. Generics (2 fixtures)
- `generic_classes` - Generic class definitions
- `generic_functions` - Generic function definitions

### 5. Integration (6 fixtures)
- `constructor_method_chain` - Constructor calling methods
- `main_shadowing` - Variable shadowing scenarios
- `main_uses_types` - Using types from other modules
- `nested_scopes` - Nested scope hierarchies
- `types` - Type definitions
- `utils` - Utility functions

### 6. Interfaces (2 fixtures)
- `basic_interface` - Interface definitions
- `extends` - Interface inheritance

### 7. Modules (2 fixtures)
- `exports` - Export patterns
- `imports` - Import patterns

### 8. Types (2 fixtures)
- `type_aliases` - Type alias definitions
- `unions` - Union type definitions

## Verification Approach

For each fixture:

1. **Read source code file** from `packages/core/tests/fixtures/typescript/code/{category}/{name}.ts`
2. **Read JSON fixture** from `packages/core/tests/fixtures/typescript/semantic_index/{category}/{name}.json`
3. **Verify semantic elements**:
   - All definitions (classes, functions, methods, interfaces, types, enums) are captured
   - Scope hierarchy matches lexical structure
   - Function calls and references are accurate
   - Type information is preserved
   - Source locations are precise
   - Imported/exported symbols are correct

4. **Document findings**:
   - List verified elements for each fixture
   - Create issue sub-tasks for any discrepancies
   - Note patterns that apply across fixtures

## Issue Sub-Task Creation

When discrepancies are found, create sub-tasks under this task:
- `task-epic-11.116.7.1.1-Fix-{Issue-Name}.md`
- `task-epic-11.116.7.1.2-Fix-{Issue-Name}.md`
- etc.

Each issue sub-task should:
- Describe the discrepancy (expected vs actual)
- Identify the root cause (indexing logic vs fixture generation)
- Propose a fix
- Reference the specific fixture file(s) affected

## Verification Checklist

### Classes Category
- [ ] `basic_class.json` - Verify class definition, constructor, methods captured
- [ ] `inheritance.json` - Verify parent class references, super calls
- [ ] `methods.json` - Verify static, private, async methods
- [ ] `properties.json` - Verify property declarations and types

### Enums Category
- [ ] `basic_enum.json` - Verify enum members and numeric values
- [ ] `string_enum.json` - Verify string enum members

### Functions Category
- [ ] `arrow_functions.json` - Verify arrow function captures
- [ ] `async_functions.json` - Verify async function markers
- [ ] `basic_functions.json` - Verify function declarations
- [ ] `call_chains.json` - Verify call reference chains
- [ ] `recursive.json` - Verify recursive call detection

### Generics Category
- [ ] `generic_classes.json` - Verify type parameters on classes
- [ ] `generic_functions.json` - Verify type parameters on functions

### Integration Category
- [ ] `constructor_method_chain.json` - Verify constructor→method calls
- [ ] `main_shadowing.json` - Verify shadowed variable scopes
- [ ] `main_uses_types.json` - Verify cross-module type references
- [ ] `nested_scopes.json` - Verify scope depth and hierarchy
- [ ] `types.json` - Verify type definitions
- [ ] `utils.json` - Verify utility function structure

### Interfaces Category
- [ ] `basic_interface.json` - Verify interface members
- [ ] `extends.json` - Verify interface inheritance

### Modules Category
- [ ] `exports.json` - Verify exported symbols
- [ ] `imports.json` - Verify imported symbols and sources

### Types Category
- [ ] `type_aliases.json` - Verify type alias definitions
- [ ] `unions.json` - Verify union type structure

## Deliverables

- [ ] All 42+ TypeScript fixtures verified
- [ ] Verification notes documenting semantic accuracy
- [ ] Issue sub-tasks created for any discrepancies (if needed)
- [ ] Summary of TypeScript-specific patterns observed

## Success Criteria

- ✅ All fixture categories verified
- ✅ Semantic accuracy confirmed for all TypeScript language features
- ✅ Any issues documented as sub-tasks
- ✅ Verification approach documented for reuse in other languages

## Estimated Effort

**4-5 hours**
- Setup and first few fixtures: 1 hour
- Systematic verification: 2-3 hours
- Issue documentation: 0.5-1 hour
- Summary and patterns: 0.5 hour

## Notes

- Start with simpler categories (classes, functions) to establish verification patterns
- Document reusable verification approaches for JavaScript, Python, Rust sub-tasks
- Focus on semantic correctness, not exact JSON structure
- TypeScript has the richest type system - pay special attention to type capture
