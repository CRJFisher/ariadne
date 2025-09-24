# Task Epic-11.97.3.2: Fix Rust Semantic Index Integration Tests

## Status
Pending

## Description
Fix all failing tests in `semantic_index.rust.test.ts` by ensuring the integration tests properly validate Rust code parsing using real code fixtures and the corrected query patterns. Currently 20 out of 28 tests are failing.

## Context
This sub-task focuses specifically on the semantic index integration test file `src/semantic_index/semantic_index.rust.test.ts`. These tests validate that:
1. Rust code is correctly parsed using tree-sitter
2. Query patterns extract expected semantic information
3. Real Rust language constructs are properly captured
4. Integration between parser, queries, and semantic index works

The high failure rate (20/28 tests failing) indicates significant issues with query patterns, test expectations, or fixture content.

## Requirements

### Primary Objectives
1. **Review Test Fixtures**: Ensure Rust fixtures cover all language features and compile
2. **Fix Capture Expectations**: Align test expectations with actual .scm patterns
3. **Add Missing Coverage**: Test Rust-specific features not currently covered
4. **Remove Invalid Tests**: Remove tests for patterns not supported in .scm
5. **Validate Real Code**: Ensure tests work with realistic Rust examples

### Rust Features to Test

#### Basic Constructs
- Struct definitions (regular, tuple, unit structs)
- Enum definitions and variants
- Function definitions (regular, async, generic)
- Implementation blocks (inherent and trait impls)

#### Advanced Type System
- Trait definitions and implementations
- Generic types with constraints
- Associated types and functions
- Lifetime parameters and annotations

#### Ownership and Control Flow
- References and borrowing
- Pattern matching (match expressions, if let)
- Loop constructs (for, while, loop)
- Error handling (Result, Option, try operator)

#### Module System
- Module declarations and structure
- Use statements and imports
- Visibility modifiers (pub, pub(crate), etc.)
- Re-exports (pub use)

#### Advanced Features
- Closure expressions and captures
- Async functions and blocks
- Unsafe code blocks
- Macro definitions and invocations

## Known Problem Areas
Based on current test failures:

### Trait and Generic Issues
- Trait definition parsing
- Generic type constraint handling
- Associated type definitions
- Trait implementation tracking

### Function and Method Resolution
- Function vs method distinction
- Associated function calls vs method calls
- Self parameter handling
- Async function detection

### Import/Export Patterns
- Use statement parsing
- Re-export detection (pub use)
- Module structure understanding
- External crate imports

### Advanced Language Features
- Closure parameter and body capture
- Lifetime annotation parsing
- Pattern matching variable binding
- Macro invocation detection

## Implementation Steps

### Step 1: Audit Current Test Coverage
1. Review existing test cases in `semantic_index.rust.test.ts`
2. Identify which Rust features are tested vs available captures
3. Analyze the 20 failing tests to understand root causes
4. Document gaps in coverage

### Step 2: Review and Fix Test Fixtures
1. Examine Rust fixture files in `fixtures/rust/`
2. Ensure fixtures compile with rustc
3. Add missing language constructs if needed
4. Verify fixtures cover all major Rust features

### Step 3: Debug and Fix Failing Tests
1. Run tests individually to isolate failures
2. For each failure, debug:
   - Query pattern existence in `rust.scm`
   - Expected vs actual semantic entities
   - Fixture code validity
   - Test logic correctness
3. Fix or remove tests based on actual .scm support

### Step 4: Add Missing Test Coverage
1. Add tests for Rust features not currently covered:
   - Trait definitions and implementations
   - Generic type parameters
   - Lifetime annotations
   - Async/await patterns
   - Closure expressions
   - Macro definitions and calls

### Step 5: Validate Integration
1. Test with realistic Rust code samples
2. Verify cross-reference between definitions and references
3. Ensure proper scope tracking for Rust constructs
4. Test performance with larger Rust files

## Test Categories to Address

### Definition Tests
- Struct definitions: `SemanticEntity.CLASS`
- Enum definitions: `SemanticEntity.ENUM`
- Trait definitions: `SemanticEntity.INTERFACE`
- Function definitions: `SemanticEntity.FUNCTION`
- Method definitions: `SemanticEntity.METHOD`
- Type parameters: `SemanticEntity.TYPE_PARAMETER`

### Reference Tests
- Function calls vs method calls
- Associated function calls (Type::function)
- Field access and struct construction
- Trait method calls
- Macro invocations

### Scope Tests
- Module scopes
- Function and closure scopes
- Impl block scopes
- Trait definition scopes
- Block scopes (including unsafe/async)

### Import/Export Tests
- Use declarations
- Pub use re-exports
- External crate imports
- Module visibility

### Advanced Feature Tests
- Lifetime parameter definitions and references
- Generic type constraints
- Pattern matching variable bindings
- Async function and await expressions

## Acceptance Criteria
- [ ] All tests in `semantic_index.rust.test.ts` pass (currently 20 failing)
- [ ] Test coverage includes all major Rust language features
- [ ] Tests validate against realistic, compilable Rust code samples
- [ ] No tests exist for unsupported capture patterns
- [ ] Integration between queries and semantic index works correctly
- [ ] Performance is acceptable for typical Rust files
- [ ] Test fixtures are comprehensive and valid Rust code

## Deliverables
1. Fixed test cases in `semantic_index.rust.test.ts`
2. Updated or new Rust test fixtures that compile
3. Comprehensive test coverage documentation
4. Analysis of removed tests and reasoning
5. 100% test pass rate for semantic index integration

## Dependencies
- Task Epic-11.97.3.1 completion (fixed language configuration)
- Rust test fixtures that compile with rustc
- Working tree-sitter Rust parser
- Semantic index infrastructure

## Estimated Effort
- Test audit and failure analysis: 3 hours
- Fixture review and fixes: 2 hours
- Test debugging and fixes: 6 hours
- Coverage additions: 4 hours
- Integration validation: 3 hours

Total: ~18 hours

## Parent Task
Task Epic-11.97.3: Rust Language Support Validation