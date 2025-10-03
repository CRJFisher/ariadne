# Task epic-11.116.3.1: TypeScript Code Fixtures - Audit and Reorganization

**Status:** Not Started
**Parent:** task-epic-11.116.3
**Language:** TypeScript
**Priority:** High
**Estimated Effort:** 2 hours

## Objective

Audit existing TypeScript fixtures, reorganize them into the new folder structure, and ensure comprehensive coverage of TypeScript-specific language features.

## Current State

**Location:** `packages/core/tests/fixtures/typescript/`

**Existing fixtures:**
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

## Tasks

### 1. Audit Existing Fixtures

Review each fixture file and categorize:
- What language features does it cover?
- Is it focused or comprehensive?
- Should it be split or reorganized?

### 2. Create Category Structure

Create new folder structure:
```
fixtures/typescript/code/
├── classes/
├── interfaces/
├── types/
├── generics/
├── modules/
├── functions/
├── enums/
├── decorators/
└── async/
```

### 3. Reorganize Fixtures

#### Classes Category
- `basic_class.ts` - Simple class definition
- `inheritance.ts` - Class inheritance and extends
- `static_members.ts` - Static properties and methods
- `class_methods.ts` - Instance methods
- `class_properties.ts` - Public/private/protected properties
- `abstract_classes.ts` - Abstract classes and methods

From existing:
- Split `classes.ts` → multiple focused files
- Split `comprehensive_classes.ts` → focused examples

#### Interfaces Category
- `basic_interface.ts` - Simple interface
- `interface_extension.ts` - Interface extends
- `interface_implementation.ts` - Class implements interface

From existing:
- Split `interfaces.ts` → focused files
- Split `comprehensive_interfaces.ts` → focused files

#### Types Category
- `type_aliases.ts` - Type alias definitions
- `union_types.ts` - Union types
- `intersection_types.ts` - Intersection types
- `conditional_types.ts` - Conditional types
- `mapped_types.ts` - Mapped types

From existing:
- Split `types.ts` → focused files
- Split `comprehensive_types.ts` → focused files

#### Generics Category
- `generic_functions.ts` - Generic function definitions
- `generic_classes.ts` - Generic class definitions
- `generic_constraints.ts` - Generic type constraints
- `generic_inference.ts` - Type parameter inference

From existing:
- Split `generics.ts` → focused files
- Split `comprehensive_generics.ts` → focused files

#### Modules Category
- `basic_exports.ts` - Export statements
- `basic_imports.ts` - Import statements
- `re_exports.ts` - Re-export patterns
- `default_exports.ts` - Default exports
- `namespace_imports.ts` - import * as

From existing:
- Split `modules.ts` → focused files
- Split `comprehensive_modules.ts` → focused files
- Keep `other-module.ts` and `specific-module.ts` for multi-file tests

#### Functions Category
- `function_declaration.ts` - Function declarations
- `arrow_functions.ts` - Arrow function syntax
- `function_overloads.ts` - Function overloading
- `optional_params.ts` - Optional and default parameters
- `rest_params.ts` - Rest parameters

From existing:
- Extract from `comprehensive_definitions.ts`

#### Enums Category
- `basic_enum.ts` - Basic enum
- `string_enum.ts` - String enums
- `const_enum.ts` - Const enums

From existing:
- Split `comprehensive_enums.ts` → focused files

#### Decorators Category
- `class_decorators.ts` - Class decorators
- `method_decorators.ts` - Method decorators
- `property_decorators.ts` - Property decorators
- `parameter_decorators.ts` - Parameter decorators

From existing:
- Split `comprehensive_decorators.ts` → focused files

#### Async Category (NEW)
- `async_await.ts` - Async/await patterns
- `promises.ts` - Promise usage
- `async_generators.ts` - Async generators

### 4. Create Missing Fixtures

Identify gaps and create new fixtures:
- [ ] `async/async_await.ts` - Currently missing
- [ ] `types/conditional_types.ts` - Currently missing
- [ ] `types/mapped_types.ts` - Currently missing
- [ ] `modules/re_exports.ts` - Currently missing
- [ ] `functions/function_overloads.ts` - May be missing

### 5. File Naming Convention

Use descriptive, snake_case names:
- ✓ `basic_class.ts`
- ✓ `class_inheritance.ts`
- ✓ `interface_extension.ts`
- ✗ `comprehensive_*.ts` (too broad)

### 6. Fixture Quality Guidelines

Each fixture should:
- Focus on ONE specific feature
- Include realistic code (not just syntax examples)
- Have comments explaining what's being tested
- Be concise (prefer multiple small over one large)
- Include edge cases where relevant

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

## Deliverables

- [ ] All existing TypeScript fixtures reviewed and categorized
- [ ] New folder structure created: `fixtures/typescript/code/{category}/`
- [ ] All fixtures reorganized into appropriate categories
- [ ] Large "comprehensive_*" files split into focused fixtures
- [ ] Missing high-priority fixtures created
- [ ] All fixtures follow naming and quality guidelines
- [ ] TypeScript feature coverage documented

## Feature Coverage Checklist

TypeScript-specific features to ensure coverage:

### Type System
- [ ] Type annotations
- [ ] Type aliases
- [ ] Union types
- [ ] Intersection types
- [ ] Literal types
- [ ] Conditional types
- [ ] Mapped types
- [ ] Template literal types

### Classes
- [ ] Basic class definition
- [ ] Inheritance (extends)
- [ ] Abstract classes
- [ ] Static members
- [ ] Access modifiers (public/private/protected)
- [ ] Parameter properties
- [ ] Getters/setters

### Interfaces
- [ ] Basic interface
- [ ] Interface extension
- [ ] Interface implementation (implements)
- [ ] Index signatures
- [ ] Call signatures

### Generics
- [ ] Generic functions
- [ ] Generic classes
- [ ] Generic constraints
- [ ] Type parameter inference
- [ ] Default type parameters

### Modules
- [ ] Named imports/exports
- [ ] Default imports/exports
- [ ] Namespace imports (import * as)
- [ ] Re-exports
- [ ] Type-only imports

### Functions
- [ ] Function declarations
- [ ] Arrow functions
- [ ] Function overloads
- [ ] Optional parameters
- [ ] Default parameters
- [ ] Rest parameters

### Enums
- [ ] Numeric enums
- [ ] String enums
- [ ] Const enums

### Decorators
- [ ] Class decorators
- [ ] Method decorators
- [ ] Property decorators
- [ ] Parameter decorators

### Async
- [ ] Async/await
- [ ] Promises
- [ ] Async generators

## Acceptance Criteria

- [ ] All TypeScript fixtures reorganized into new structure
- [ ] No "comprehensive_*" files remain (all split into focused fixtures)
- [ ] Feature coverage checklist 100% complete
- [ ] All fixtures follow quality guidelines
- [ ] Documentation of TypeScript coverage complete

## Notes

- This can be done in parallel with other languages (116.3.2, 116.3.3, 116.3.4)
- Coordinate with 116.3.5 (Feature Coverage Matrix) for coverage tracking
- Some fixtures may be useful for cross-file resolution tests
