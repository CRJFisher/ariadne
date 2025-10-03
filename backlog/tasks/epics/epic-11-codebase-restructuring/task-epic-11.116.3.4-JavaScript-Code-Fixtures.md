# Task epic-11.116.3.4: JavaScript Code Fixtures - Audit and Reorganization

**Status:** Not Started
**Parent:** task-epic-11.116.3
**Language:** JavaScript
**Priority:** High
**Estimated Effort:** 1 hour

## Objective

Audit existing JavaScript fixtures (if any), reorganize them into the new folder structure, and create comprehensive coverage of JavaScript-specific language features.

## Current State

**Location:** `packages/core/tests/fixtures/javascript/` (may not exist yet)

**Note:** JavaScript may have fewer existing fixtures compared to other languages. This task will focus on creating a solid baseline.

## Tasks

### 1. Check for Existing Fixtures

Determine what JavaScript fixtures currently exist.

### 2. Create Category Structure

Create new folder structure:
```
fixtures/javascript/code/
├── classes/
├── functions/
├── modules/
├── objects/
├── async/
└── prototypes/
```

### 3. Create Core Fixtures

#### Classes Category (ES6)
- `basic_class.js` - ES6 class definition
- `inheritance.js` - Class extends
- `static_methods.js` - Static methods
- `getters_setters.js` - Getter and setter methods

**Example:**
```javascript
// basic_class.js
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return "Some sound";
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name);
    this.breed = breed;
  }

  speak() {
    return "Woof!";
  }

  fetch() {
    console.log(`${this.name} is fetching`);
  }
}

module.exports = { Animal, Dog };
```

#### Functions Category
- `function_declaration.js` - Function declarations
- `function_expression.js` - Function expressions
- `arrow_functions.js` - Arrow function syntax
- `iife.js` - Immediately Invoked Function Expressions
- `callbacks.js` - Callback pattern
- `higher_order_functions.js` - Functions returning functions

#### Modules Category
- `commonjs_exports.js` - module.exports
- `commonjs_require.js` - require()
- `es6_exports.js` - export statements
- `es6_imports.js` - import statements
- `default_export.js` - export default
- `mixed_modules.js` - CommonJS + ES6 (if supported)

#### Objects Category
- `object_literal.js` - Object literals
- `destructuring.js` - Object destructuring
- `spread_operator.js` - Spread syntax
- `computed_properties.js` - Computed property names
- `object_methods.js` - Methods in objects

#### Async Category
- `promises.js` - Promise usage
- `async_await.js` - Async/await
- `async_functions.js` - Async function declarations
- `promise_chains.js` - Promise chaining

#### Prototypes Category (JS-specific)
- `prototype_methods.js` - Prototype-based methods
- `prototype_chain.js` - Prototype inheritance
- `constructor_functions.js` - Pre-ES6 constructors

### 4. Create Missing Fixtures

JavaScript-specific features to create:
- [ ] `classes/basic_class.js` - ES6 classes
- [ ] `functions/arrow_functions.js` - Arrow functions
- [ ] `modules/commonjs_exports.js` - CommonJS modules
- [ ] `modules/es6_exports.js` - ES6 modules
- [ ] `async/async_await.js` - Async/await
- [ ] `objects/destructuring.js` - Destructuring
- [ ] `prototypes/constructor_functions.js` - Prototype pattern

### 5. File Naming Convention

Use descriptive, snake_case names:
- ✓ `basic_class.js`
- ✓ `arrow_functions.js`
- ✓ `async_await.js`

### 6. Fixture Quality Guidelines

Each fixture should:
- Focus on ONE specific JavaScript feature
- Use modern ES6+ syntax where appropriate
- Include both CommonJS and ES6 module examples
- Be concise and focused
- Be valid JavaScript

**Example:**
```javascript
// fixtures/javascript/code/functions/arrow_functions.js
/**
 * Tests arrow function syntax and behavior
 */

// Arrow function with explicit return
const add = (a, b) => {
  return a + b;
};

// Arrow function with implicit return
const multiply = (a, b) => a * b;

// Arrow function with single parameter (no parentheses)
const square = x => x * x;

// Arrow function in callback
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);

module.exports = { add, multiply, square, doubled };
```

## Deliverables

- [ ] JavaScript fixtures directory created if not exists
- [ ] New folder structure created: `fixtures/javascript/code/{category}/`
- [ ] Core JavaScript fixtures created
- [ ] Both CommonJS and ES6 module patterns covered
- [ ] All fixtures are valid JavaScript
- [ ] JavaScript feature coverage documented

## Feature Coverage Checklist

JavaScript-specific features to ensure coverage:

### Classes (ES6)
- [ ] Basic class definition
- [ ] Class inheritance (extends)
- [ ] Static methods
- [ ] Getters and setters
- [ ] Constructor functions

### Functions
- [ ] Function declarations
- [ ] Function expressions
- [ ] Arrow functions
- [ ] IIFE
- [ ] Callbacks
- [ ] Higher-order functions

### Modules
- [ ] CommonJS (require/module.exports)
- [ ] ES6 imports (import)
- [ ] ES6 exports (export)
- [ ] Default exports
- [ ] Named exports

### Objects
- [ ] Object literals
- [ ] Destructuring
- [ ] Spread operator
- [ ] Computed properties
- [ ] Shorthand methods

### Async
- [ ] Promises
- [ ] Async/await
- [ ] Promise chaining
- [ ] Async function declarations

### Prototypes (JS-specific)
- [ ] Prototype methods
- [ ] Prototype chain
- [ ] Constructor functions (pre-ES6)
- [ ] Object.create()

### Variables
- [ ] var declarations
- [ ] let declarations
- [ ] const declarations
- [ ] Hoisting examples

## Acceptance Criteria

- [ ] JavaScript fixtures created with new structure
- [ ] Both CommonJS and ES6 modules covered
- [ ] Feature coverage checklist 100% complete
- [ ] All fixtures are valid JavaScript
- [ ] Documentation of JavaScript coverage complete

## Notes

- JavaScript may have smaller test suite than TypeScript
- Focus on features unique to JavaScript (prototypes, hoisting)
- Include both old-style (var, function) and modern (let/const, arrow) patterns
- Some fixtures may demonstrate CommonJS vs ES6 module differences
