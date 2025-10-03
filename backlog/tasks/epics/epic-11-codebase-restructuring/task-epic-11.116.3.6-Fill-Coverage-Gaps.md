# Task epic-11.116.3.6: Fill Coverage Gaps

**Status:** Not Started
**Parent:** task-epic-11.116.3
**Depends On:** 116.3.5
**Priority:** Medium
**Estimated Effort:** 2 hours

## Objective

Create missing code fixtures to fill the high-priority gaps identified in the Feature Coverage Matrix (116.3.5). This ensures comprehensive language feature coverage before generating JSON fixtures.

## Tasks

### 1. Review Coverage Matrix

Review the gap analysis from 116.3.5 and extract the high-priority missing fixtures.

### 2. Create Missing TypeScript Fixtures

Based on gaps identified in 116.3.5, create missing fixtures:

**High Priority:**
- [ ] `async/async_generators.ts` - Async generator functions
- [ ] `types/conditional_types.ts` - Conditional type expressions
- [ ] `types/mapped_types.ts` - Mapped type definitions
- [ ] `types/template_literal_types.ts` - Template literal types
- [ ] `modules/type_only_imports.ts` - Type-only imports

**Medium Priority:**
- [ ] `functions/generator_functions.ts` - Generator functions with yield
- [ ] `types/infer_keyword.ts` - infer in conditional types
- [ ] `modules/dynamic_imports.ts` - Dynamic import()

### 3. Create Missing Python Fixtures

**High Priority:**
- [ ] `classes/dataclasses.py` - @dataclass usage
- [ ] `classes/properties.py` - @property decorator
- [ ] `async/async_def.py` - Async function definitions
- [ ] `async/async_generators.py` - Async generators
- [ ] `types/protocol.py` - Protocol (structural typing)

**Medium Priority:**
- [ ] `classes/multiple_inheritance.py` - Multiple inheritance
- [ ] `functions/decorators_with_args.py` - Parameterized decorators
- [ ] `types/type_guards.py` - TypeGuard usage

### 4. Create Missing Rust Fixtures

**High Priority:**
- [ ] `traits/trait_definition.rs` - Trait definitions
- [ ] `traits/trait_implementation.rs` - Implementing traits
- [ ] `traits/trait_bounds.rs` - Trait bounds on generics
- [ ] `impl_blocks/basic_impl.rs` - Basic impl blocks
- [ ] `modules/pub_use.rs` - Re-exports with pub use

**Medium Priority:**
- [ ] `generics/lifetime_generics.rs` - Lifetime parameters
- [ ] `traits/associated_types.rs` - Associated types in traits
- [ ] `patterns/pattern_guards.rs` - Match pattern guards

### 5. Create Missing JavaScript Fixtures

**High Priority:**
- [ ] `async/promises.js` - Promise creation and usage
- [ ] `async/promise_chains.js` - Promise chaining
- [ ] `prototypes/constructor_functions.js` - Pre-ES6 constructors
- [ ] `prototypes/prototype_chain.js` - Prototype inheritance
- [ ] `modules/mixed_modules.js` - CommonJS + ES6 mix

**Medium Priority:**
- [ ] `functions/iife.js` - Immediately Invoked Function Expressions
- [ ] `variables/hoisting.js` - var hoisting examples
- [ ] `objects/computed_properties.js` - Computed property names

## Fixture Creation Guidelines

### Fixture Quality Standards

Each new fixture must:
1. **Focus on one feature**: Don't combine multiple features
2. **Be realistic**: Use practical code examples, not just syntax
3. **Include comments**: Explain what's being tested
4. **Be concise**: Keep under 50 lines where possible
5. **Be valid code**: Must parse without errors

### Example: TypeScript Async Generator

```typescript
// fixtures/typescript/code/async/async_generators.ts
/**
 * Tests async generator functions with yield and await
 */

async function* fetchPages(urls: string[]) {
  for (const url of urls) {
    const response = await fetch(url);
    const data = await response.json();
    yield data;
  }
}

async function* generateNumbers(max: number) {
  for (let i = 0; i < max; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    yield i;
  }
}

export { fetchPages, generateNumbers };
```

### Example: Python Dataclass

```python
# fixtures/python/code/classes/dataclasses.py
"""
Tests @dataclass decorator for automatic __init__ generation
"""

from dataclasses import dataclass
from typing import Optional

@dataclass
class Animal:
    name: str
    age: int

@dataclass
class Dog(Animal):
    breed: str
    owner: Optional[str] = None

    def bark(self) -> str:
        return f"{self.name} says woof!"

__all__ = ['Animal', 'Dog']
```

### Example: Rust Trait Implementation

```rust
// fixtures/rust/code/traits/trait_implementation.rs
/// Tests trait definition and implementation

trait Speak {
    fn speak(&self) -> String;
}

struct Dog {
    name: String,
}

impl Speak for Dog {
    fn speak(&self) -> String {
        format!("{} says woof!", self.name)
    }
}

pub use Dog;
pub use Speak;
```

### Example: JavaScript Promises

```javascript
// fixtures/javascript/code/async/promises.js
/**
 * Tests Promise creation and usage patterns
 */

function fetchData(url) {
  return new Promise((resolve, reject) => {
    // Simulate async operation
    setTimeout(() => {
      if (url) {
        resolve({ data: 'success' });
      } else {
        reject(new Error('Invalid URL'));
      }
    }, 100);
  });
}

function processData(data) {
  return new Promise((resolve) => {
    const processed = { ...data, processed: true };
    resolve(processed);
  });
}

module.exports = { fetchData, processData };
```

## Validation

After creating each fixture:
1. **Syntax check**: Ensure it parses correctly
2. **Feature check**: Verify it demonstrates the intended feature
3. **Quality check**: Review against fixture quality standards
4. **Categorization**: Ensure it's in the correct category folder

## Deliverables

- [ ] All high-priority TypeScript gaps filled
- [ ] All high-priority Python gaps filled
- [ ] All high-priority Rust gaps filled
- [ ] All high-priority JavaScript gaps filled
- [ ] All fixtures follow quality guidelines
- [ ] Fixtures are valid and parseable
- [ ] Coverage matrix updated to reflect new fixtures

## Acceptance Criteria

- [ ] High-priority gaps from 116.3.5 are filled
- [ ] All new fixtures are valid code
- [ ] Fixtures follow naming and quality standards
- [ ] Coverage matrix shows improved percentages
- [ ] Ready for JSON generation in 116.4

## Notes

- Focus on high-priority gaps first
- Medium/low priority gaps can be addressed later
- Coordinate with 116.4 to validate fixtures generate correctly
- Some fixtures may reveal implementation gaps
