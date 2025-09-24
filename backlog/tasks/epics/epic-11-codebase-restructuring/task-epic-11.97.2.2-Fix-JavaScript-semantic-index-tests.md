# Task Epic-11.97.2.2: Fix JavaScript Semantic Index Integration Tests

## Status
Pending

## Description
Fix all failing tests in `semantic_index.javascript.test.ts` by ensuring the integration tests properly validate JavaScript code parsing using real code fixtures and the corrected query patterns.

## Context
This sub-task focuses specifically on the semantic index integration test file `src/semantic_index/semantic_index.javascript.test.ts`. These tests validate that:
1. JavaScript code is correctly parsed using tree-sitter
2. Query patterns extract expected semantic information
3. Real JavaScript language constructs are properly captured
4. Integration between parser, queries, and semantic index works

## Requirements

### Primary Objectives
1. **Review Test Fixtures**: Ensure JavaScript fixtures cover all language features
2. **Fix Capture Expectations**: Align test expectations with actual .scm patterns
3. **Add Missing Coverage**: Test JavaScript-specific features not currently covered
4. **Remove Invalid Tests**: Remove tests for patterns not supported in .scm
5. **Validate Real Code**: Ensure tests work with realistic JavaScript examples

### JavaScript Features to Test

#### Core Language Constructs
- Functions (regular, arrow, async, generator)
- Classes (constructor, methods, static methods, private fields)
- Variables (let, const, var with destructuring)
- Control flow and block scopes

#### Modern JavaScript Features
- Arrow functions and their assignment patterns
- Destructuring (object, array, nested)
- Template literals and tagged templates
- Async/await and Promises
- ES6 modules (import/export patterns)

#### Object and Class Features
- Class inheritance and method overrides
- Static methods and fields
- Private fields and methods (#private)
- Getter and setter methods
- Constructor patterns

#### Function and Call Patterns
- Method chaining (2+ levels deep)
- Function calls vs method calls
- Constructor calls (new expressions)
- Higher-order functions
- Callback patterns

#### JSX Support (if enabled)
- JSX component references
- JSX element patterns
- Component props and children

## Implementation Steps

### Step 1: Audit Current Test Coverage
1. Review existing test cases in `semantic_index.javascript.test.ts`
2. Identify which JavaScript features are tested
3. Compare with captures available in `javascript.scm`
4. Document gaps in coverage

### Step 2: Review Test Fixtures
1. Examine JavaScript fixture files in `fixtures/javascript/`
2. Ensure fixtures include comprehensive JavaScript examples
3. Add missing language constructs if needed
4. Verify fixtures are valid JavaScript

### Step 3: Fix Failing Tests
1. Run current tests and identify specific failures
2. Debug each failure:
   - Check if capture pattern exists in .scm
   - Verify expected semantic entity types
   - Validate test logic and expectations
3. Fix or remove tests based on actual .scm support

### Step 4: Add Missing Test Coverage
1. Add tests for JavaScript features not currently covered
2. Focus on JavaScript-specific constructs:
   - Arrow function assignments
   - Destructuring patterns
   - Class private fields/methods
   - Method chaining
   - Async/await patterns

### Step 5: Validate Integration
1. Test with realistic JavaScript code samples
2. Verify cross-reference between definitions and references
3. Ensure proper scope tracking for JavaScript constructs
4. Test performance with larger JavaScript files

## Test Categories to Address

### Definition Tests
- Function definitions (regular vs arrow)
- Class definitions with inheritance
- Method definitions (regular, static, private)
- Variable definitions with destructuring
- Parameter definitions (regular, rest, default)

### Reference Tests
- Function calls vs method calls
- Chained method calls (2+ levels)
- Property access (dot notation, bracket notation)
- Constructor calls
- JSX component references

### Scope Tests
- Module scope
- Function scope vs block scope
- Class scope
- Method scope

### Assignment Tests
- Variable assignments
- Arrow function assignments
- Constructor assignments
- Member property assignments

### Import/Export Tests
- Named imports/exports
- Default imports/exports
- Namespace imports
- Re-exports with aliases

## Acceptance Criteria
- [ ] All tests in `semantic_index.javascript.test.ts` pass
- [ ] Test coverage includes all major JavaScript language features
- [ ] Tests validate against realistic JavaScript code samples
- [ ] No tests exist for unsupported capture patterns
- [ ] Integration between queries and semantic index works correctly
- [ ] Performance is acceptable for typical JavaScript files
- [ ] Test fixtures are comprehensive and valid JavaScript

## Deliverables
1. Fixed test cases in `semantic_index.javascript.test.ts`
2. Updated or new JavaScript test fixtures
3. Comprehensive test coverage documentation
4. 100% test pass rate for semantic index integration

## Dependencies
- Task Epic-11.97.2.1 completion (fixed language configuration)
- JavaScript test fixtures
- Working tree-sitter JavaScript parser
- Semantic index infrastructure

## Estimated Effort
- Test audit: 2 hours
- Fixture review: 1 hour
- Test fixes: 3 hours
- Coverage additions: 3 hours
- Integration validation: 2 hours

Total: ~11 hours

## Parent Task
Task Epic-11.97.2: JavaScript Language Support Validation