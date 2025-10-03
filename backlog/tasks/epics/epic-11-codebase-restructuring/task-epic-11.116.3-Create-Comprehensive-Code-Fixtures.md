# Task epic-11.116.3: Create Comprehensive Code Fixtures

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.1
**Priority:** Medium
**Created:** 2025-10-03

## Overview

Audit existing code fixtures, reorganize them into the new folder structure, identify gaps in language feature coverage, and create missing fixtures. This ensures comprehensive test coverage across all supported languages.

## Objectives

1. Audit and reorganize existing TypeScript fixtures
2. Audit and reorganize existing Python fixtures
3. Audit and reorganize existing Rust fixtures
4. Audit and reorganize existing JavaScript fixtures
5. Identify gaps in language feature coverage
6. Create missing code fixtures

## Sub-tasks

### 116.3.1: Audit and Organize Existing TypeScript Fixtures

**Current fixtures location**: `packages/core/tests/fixtures/typescript/`

**Current fixtures** (from earlier investigation):
- generics.ts
- other-module.ts
- specific-module.ts
- classes.ts
- comprehensive_types.ts
- modules.ts
- comprehensive_decorators.ts
- comprehensive_enums.ts
- comprehensive_definitions.ts
- types.ts
- comprehensive_generics.ts
- comprehensive_interfaces.ts
- comprehensive_modules.ts
- comprehensive_classes.ts
- interfaces.ts

**Actions:**
1. Review each fixture file
2. Categorize into feature groups:
   - `code/classes/` - class-related features
   - `code/interfaces/` - interface definitions
   - `code/types/` - type aliases, type parameters
   - `code/generics/` - generic classes/functions
   - `code/modules/` - module imports/exports
   - `code/functions/` - function declarations
   - `code/enums/` - enum definitions
   - `code/decorators/` - decorator usage
3. Split "comprehensive_*.ts" files into focused test cases
4. Rename files to be descriptive (e.g., `basic_class.ts`, `inheritance.ts`)
5. Move to new structure

**Deliverables:**
- [ ] All TypeScript fixtures reorganized into new structure
- [ ] Each fixture focuses on specific language feature
- [ ] Feature coverage matrix documented

### 116.3.2: Audit and Organize Existing Python Fixtures

**Current fixtures** (from earlier investigation):
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

**Categories for Python:**
- `code/classes/` - class definitions, inheritance, methods
- `code/functions/` - function definitions, decorators
- `code/types/` - type hints, type aliases
- `code/modules/` - imports, exports
- `code/scope/` - scope-related features

**Actions:**
1. Review and categorize fixtures
2. Split comprehensive files
3. Add focused test cases for:
   - Async functions
   - Dataclasses
   - Context managers
   - Generators
   - Property decorators

**Deliverables:**
- [ ] All Python fixtures reorganized
- [ ] Coverage gaps identified and documented

### 116.3.3: Audit and Organize Existing Rust Fixtures

**Current fixtures:**
- module_edge_cases.rs
- ownership_and_patterns.rs
- ownership_and_references.rs
- patterns_and_error_handling.rs
- advanced_constructs_comprehensive.rs

**Categories for Rust:**
- `code/structs/` - struct definitions, impl blocks
- `code/enums/` - enum definitions, pattern matching
- `code/traits/` - trait definitions and implementations
- `code/modules/` - mod, use statements
- `code/functions/` - fn definitions, closures
- `code/generics/` - generic types and functions
- `code/ownership/` - ownership and borrowing patterns

**Actions:**
1. Review and categorize fixtures
2. Create focused test cases for core Rust features
3. Ensure coverage of Rust-specific constructs

**Deliverables:**
- [ ] All Rust fixtures reorganized
- [ ] Rust feature matrix documented

### 116.3.4: Audit and Organize Existing JavaScript Fixtures

**Note**: May have fewer fixtures currently - check existing test files

**Categories for JavaScript:**
- `code/classes/` - ES6 classes
- `code/functions/` - function declarations, arrow functions
- `code/modules/` - CommonJS and ES6 imports/exports
- `code/objects/` - object literals, destructuring
- `code/async/` - promises, async/await

**Actions:**
1. Check for existing JavaScript fixtures
2. Create basic fixture set if missing
3. Ensure JS-specific features covered (prototypes, CommonJS, etc.)

**Deliverables:**
- [ ] JavaScript fixtures organized
- [ ] Basic coverage established

### 116.3.5: Identify Gaps in Language Feature Coverage

Create a **Language Feature Coverage Matrix** documenting which features are tested for each language:

| Feature Category | TypeScript | Python | Rust | JavaScript |
|-----------------|------------|--------|------|------------|
| **Classes** |
| Basic class definition | ✓ | ✓ | ✓ (struct) | ✓ |
| Inheritance | ✓ | ✓ | ✗ | ✓ |
| Methods | ✓ | ✓ | ✓ (impl) | ✓ |
| Static members | ✓ | ✓ | ✗ | ✓ |
| Properties | ✓ | ✓ | ✓ | ✓ |
| **Functions** |
| Function declaration | ✓ | ✓ | ✓ | ✓ |
| Arrow/lambda | ✓ | ✓ (lambda) | ✓ (closure) | ✓ |
| Async functions | ? | ? | ? | ? |
| Generators | ? | ? | ✗ | ? |
| **Types** |
| Type annotations | ✓ | ✓ | ✓ | ✗ |
| Generics | ✓ | ✓ | ✓ | ✗ |
| Interfaces/Traits | ✓ | ✗ | ✓ | ✗ |
| ... | ... | ... | ... | ... |

**Actions:**
1. Review existing fixtures against comprehensive feature list
2. Mark which features are covered (✓), missing (✗), or unclear (?)
3. Prioritize missing features by importance
4. Document gaps for 116.3.6

**Deliverables:**
- [ ] Feature coverage matrix completed
- [ ] Gap analysis document with priorities
- [ ] List of fixtures to create in 116.3.6

### 116.3.6: Create Missing Code Fixtures

Based on gaps identified in 116.3.5, create new code fixtures:

**High Priority Fixtures** (examples):
- TypeScript:
  - `async/async_await.ts` - async/await patterns
  - `types/conditional_types.ts` - conditional and mapped types
  - `modules/re_exports.ts` - re-export patterns

- Python:
  - `async/async_functions.py` - async def, await
  - `classes/dataclasses.py` - @dataclass usage
  - `classes/properties.py` - @property decorator

- Rust:
  - `traits/trait_implementation.rs` - trait impl
  - `generics/generic_traits.rs` - generic traits
  - `modules/pub_use.rs` - pub use re-exports

- JavaScript:
  - `modules/commonjs.js` - require/module.exports
  - `modules/es6_mixed.js` - mixed import/export
  - `async/promises.js` - Promise patterns

**Fixture Quality Guidelines:**
- Each fixture should be **focused** (one feature category)
- Include **realistic code** (not just syntax examples)
- Add **comments** explaining what's being tested
- Keep **concise** (prefer multiple small fixtures over large comprehensive ones)
- Include **edge cases** where relevant

**Example:**
```typescript
// fixtures/typescript/code/classes/inheritance.ts
/**
 * Tests class inheritance and method overriding
 */

class Animal {
  constructor(public name: string) {}

  speak(): string {
    return "Some sound";
  }
}

class Dog extends Animal {
  constructor(name: string, public breed: string) {
    super(name);
  }

  // Override parent method
  speak(): string {
    return "Woof!";
  }

  // New method
  fetch(): void {
    console.log(`${this.name} is fetching`);
  }
}

export { Animal, Dog };
```

**Deliverables:**
- [ ] All high-priority missing fixtures created
- [ ] Fixtures follow quality guidelines
- [ ] Each fixture documented with purpose

## Organization Principles

### File Naming Convention

Use descriptive, snake_case names:
- `basic_class.ts` - simplest example
- `class_inheritance.ts` - specific feature
- `class_static_members.ts` - specific variation
- `class_complex.ts` - complex example combining features

### Folder Categories

Standard categories across languages (adjust per language):
- `classes/` - class/struct definitions
- `functions/` - function declarations
- `interfaces/` - interfaces/protocols/traits
- `types/` - type definitions and annotations
- `modules/` - import/export patterns
- `generics/` - generic/parametric types
- `async/` - asynchronous programming
- `enums/` - enumeration types
- `scope/` - scoping and visibility

### Fixture Size

**Prefer multiple small fixtures over large comprehensive ones:**
- ✓ `classes/basic_class.ts` + `classes/inheritance.ts` + `classes/static_members.ts`
- ✗ `classes/comprehensive_classes.ts` (with all features combined)

**Rationale:**
- Easier to understand what's being tested
- Easier to debug when tests fail
- Better organization and navigation
- Can test features in isolation

## Acceptance Criteria

- [ ] All existing fixtures reorganized into new structure
- [ ] Feature coverage matrix complete
- [ ] High-priority gaps filled with new fixtures
- [ ] All fixtures follow naming and quality guidelines
- [ ] Documentation updated with fixture organization

## Estimated Effort

- **TypeScript audit and reorganization**: 2 hours
- **Python audit and reorganization**: 1.5 hours
- **Rust audit and reorganization**: 1.5 hours
- **JavaScript audit and reorganization**: 1 hour
- **Feature coverage analysis**: 1 hour
- **Creating missing fixtures**: 2 hours
- **Total**: ~9 hours

## Notes

- Can be done incrementally (one language at a time)
- Should coordinate with 116.4 (can generate JSON as fixtures are ready)
- Consider adding fixture README in each category explaining what's covered
