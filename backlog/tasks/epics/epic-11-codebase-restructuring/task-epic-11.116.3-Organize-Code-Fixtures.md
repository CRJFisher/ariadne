# Task epic-11.116.3: Organize Code Fixtures

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.1
**Priority:** Medium
**Created:** 2025-10-14

## Overview

Organize existing code fixtures and create any missing ones to ensure comprehensive coverage of language features. Code fixtures are the source files from which semantic index JSON will be generated.

## Current State

Code fixtures already exist in `packages/core/tests/fixtures/` but need to be:
1. Reorganized into feature categories
2. Reviewed for completeness
3. Expanded where gaps exist

## Objectives

1. Reorganize existing fixtures into category directories
2. Review coverage of language features
3. Create missing fixtures for uncovered features
4. Ensure fixtures represent realistic code patterns

## Folder Structure (Target)

```
packages/core/tests/fixtures/
├── typescript/
│   └── code/
│       ├── classes/           # Class-related features
│       ├── functions/         # Function-related features
│       ├── interfaces/        # Interface features
│       ├── types/             # Type aliases, unions, etc.
│       ├── generics/          # Generic types and functions
│       ├── modules/           # Import/export patterns
│       ├── enums/             # Enum definitions
│       └── decorators/        # Decorator usage
├── python/
│   └── code/
│       ├── classes/           # Classes, inheritance
│       ├── functions/         # Functions, decorators
│       └── modules/           # Import patterns
├── rust/
│   └── code/
│       ├── functions/         # Functions, closures
│       ├── structs/           # Struct definitions
│       ├── enums/             # Enum definitions
│       ├── traits/            # Trait definitions
│       ├── impls/             # Impl blocks
│       └── modules/           # Module imports
└── javascript/
    └── code/
        ├── classes/           # ES6 classes
        ├── functions/         # Functions, arrows
        └── modules/           # CommonJS and ES6
```

## Tasks by Language

### TypeScript (Primary Focus)

**Review existing fixtures:**
```bash
find packages/core/tests/fixtures/typescript -name "*.ts" -type f
```

**Required categories and examples:**

1. **classes/**
   - `basic_class.ts` - Simple class with constructor
   - `inheritance.ts` - Class extending another class
   - `methods.ts` - Instance and static methods
   - `properties.ts` - Public, private, protected properties
   - `abstract_class.ts` - Abstract class and methods

2. **functions/**
   - `basic_functions.ts` - Simple function declarations
   - `arrow_functions.ts` - Arrow function expressions
   - `async_functions.ts` - Async/await patterns
   - `call_chains.ts` - Function calling other functions
   - `recursive.ts` - Recursive function calls
   - `closures.ts` - Nested functions and closures

3. **interfaces/**
   - `basic_interface.ts` - Simple interface
   - `extends.ts` - Interface extending other interfaces
   - `implements.ts` - Class implementing interfaces

4. **types/**
   - `type_aliases.ts` - Type alias definitions
   - `unions.ts` - Union types
   - `intersections.ts` - Intersection types

5. **generics/**
   - `generic_functions.ts` - Generic function parameters
   - `generic_classes.ts` - Generic class definitions
   - `constraints.ts` - Generic constraints

6. **modules/**
   - `exports.ts` - Various export patterns
   - `imports.ts` - Various import patterns
   - `re_exports.ts` - Re-exporting from other files

7. **enums/**
   - `basic_enum.ts` - Simple enum
   - `string_enum.ts` - String enum values

### Python

**Required categories:**

1. **classes/**
   - `basic_class.py` - Simple class
   - `inheritance.py` - Class inheritance
   - `methods.py` - Instance, class, and static methods
   - `decorators.py` - Class and method decorators

2. **functions/**
   - `basic_functions.py` - Function definitions
   - `decorators.py` - Function decorators
   - `generators.py` - Generator functions

3. **modules/**
   - `imports.py` - Import patterns
   - `from_imports.py` - From imports

### Rust

**Required categories:**

1. **functions/**
   - `basic_functions.rs` - Function definitions
   - `closures.rs` - Closure usage

2. **structs/**
   - `basic_struct.rs` - Struct definitions
   - `tuple_struct.rs` - Tuple structs

3. **enums/**
   - `basic_enum.rs` - Enum definitions

4. **traits/**
   - `basic_trait.rs` - Trait definitions

5. **impls/**
   - `impl_methods.rs` - Impl blocks with methods
   - `trait_impl.rs` - Trait implementation

### JavaScript

**Required categories:**

1. **classes/**
   - `basic_class.js` - ES6 class
   - `inheritance.js` - Class inheritance

2. **functions/**
   - `basic_functions.js` - Function declarations
   - `arrow_functions.js` - Arrow functions
   - `callbacks.js` - Callback patterns

3. **modules/**
   - `commonjs.js` - CommonJS require/exports
   - `es6_modules.js` - ES6 import/export

## Implementation Steps

### 1. Audit Existing Fixtures (1 hour)

```bash
# Create inventory of existing fixtures
cd packages/core/tests/fixtures
find . -name "*.ts" -o -name "*.py" -o -name "*.rs" -o -name "*.js" | sort > /tmp/existing_fixtures.txt

# Compare against required list
# Identify gaps
```

### 2. Reorganize Existing Fixtures (1-2 hours)

Move files into appropriate category directories:

```bash
# Example moves
mv typescript/classes.ts typescript/code/classes/basic_class.ts
mv typescript/comprehensive_classes.ts typescript/code/classes/comprehensive.ts
# ... etc
```

### 3. Create Missing Fixtures (1-2 hours)

For each gap identified, create a minimal but realistic code file:

**Example - `typescript/code/functions/call_chains.ts`:**
```typescript
export function main() {
  const result = processData();
  return result;
}

function processData() {
  const data = fetchData();
  return transformData(data);
}

function fetchData() {
  return { value: 42 };
}

function transformData(data: any) {
  return data.value * 2;
}
```

**Characteristics of good fixtures:**
- Realistic code patterns (not just minimal syntax)
- Demonstrates the feature clearly
- Includes enough complexity to test call graph detection
- Not too large (50-100 lines max)

### 4. Verify Coverage (0.5 hours)

Create checklist and verify all features are covered.

## Deliverables

- [ ] All existing fixtures reorganized into category directories
- [ ] Missing fixtures created for gaps
- [ ] Coverage checklist completed
- [ ] All fixture files follow naming conventions
- [ ] Fixtures are realistic and representative
- [ ] README.md in fixtures/ explaining organization

## Success Criteria

- ✅ All required categories have at least 1 fixture
- ✅ High-priority features have multiple fixtures (e.g., classes, functions)
- ✅ Fixtures demonstrate realistic code patterns
- ✅ No duplicate or redundant fixtures
- ✅ Organization matches schema from 116.1

## Estimated Effort

**2-3 hours**
- 1 hour: Audit existing fixtures
- 1 hour: Reorganize into categories
- 0.5-1 hour: Create missing fixtures
- 0.5 hour: Documentation and review

## Next Steps

After completion:
- Proceed to **116.4**: Generate JSON fixtures from organized code
- These fixtures become the input for all integration tests

## Notes

- Focus on TypeScript first (most mature support)
- Python, Rust, JavaScript can have minimal fixture sets initially
- Can expand fixture coverage over time as needed
- Fixtures should be self-contained (no external dependencies)
- Aim for quality over quantity - better to have 20 good fixtures than 100 minimal ones
