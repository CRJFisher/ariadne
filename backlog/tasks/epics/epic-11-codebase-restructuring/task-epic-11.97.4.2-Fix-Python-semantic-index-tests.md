# Task Epic-11.97.4.2: Fix Python Semantic Index Integration Tests

## Status
Pending

## Description
Fix all failing tests in `semantic_index.python.test.ts` by ensuring the integration tests properly validate Python code parsing using real code fixtures and the corrected query patterns. Currently 18 out of 28 tests are failing.

## Context
This sub-task focuses specifically on the semantic index integration test file `src/semantic_index/semantic_index.python.test.ts`. These tests validate that:
1. Python code is correctly parsed using tree-sitter
2. Query patterns extract expected semantic information
3. Real Python language constructs are properly captured
4. Integration between parser, queries, and semantic index works

The failure rate (18/28 tests failing) indicates significant issues with query patterns, test expectations, or fixture content.

## Requirements

### Primary Objectives
1. **Review Test Fixtures**: Ensure Python fixtures cover all language features and are valid
2. **Fix Capture Expectations**: Align test expectations with actual .scm patterns
3. **Add Missing Coverage**: Test Python-specific features not currently covered
4. **Remove Invalid Tests**: Remove tests for patterns not supported in .scm
5. **Validate Real Code**: Ensure tests work with realistic Python examples

### Python Features to Test

#### Core Language Constructs
- Function definitions (regular, async, lambda)
- Class definitions with inheritance
- Method definitions (regular, static, class methods)
- Variable assignments (simple, multiple, annotated)

#### Object-Oriented Features
- Class hierarchies and inheritance
- Method overriding and super() calls
- Property decorators and descriptors
- Static methods and class methods
- Private attributes and methods

#### Decorators and Annotations
- Function decorators (@decorator)
- Class decorators
- Built-in decorators (@property, @staticmethod, @classmethod)
- Type annotations and hints
- Multiple decorators on single function

#### Control Flow and Scoping
- Comprehensions (list, dict, set, generator)
- Exception handling (try/except/finally/else)
- Context managers (with statements)
- Loop constructs (for, while) with else clauses

#### Import System
- Standard imports (import module)
- From imports (from module import name)
- Relative imports (from .module import name)
- Star imports (from module import *)
- Import aliases and renaming

#### Advanced Features
- Async/await functionality
- Generator functions and yield
- Context managers and with statements
- Metaclasses and __new__/__init__
- Magic methods and operators

## Known Problem Areas
Based on current test failures:

### Class and Method Issues
- Method vs function distinction
- Constructor (__init__) identification
- Static method and class method detection
- Property decorator handling

### Import/Export Patterns
- From import statement parsing
- Relative import detection
- Star import handling
- Module alias resolution

### Async and Generator Features
- Async function detection
- Await expression parsing
- Generator function identification
- Async comprehensions

### Decorator and Annotation Handling
- Decorator application detection
- Multiple decorator chains
- Type annotation parsing
- Property setter/getter patterns

### Comprehension and Scoping
- Comprehension variable capture
- Nested comprehension handling
- Variable scope in different contexts
- Exception variable binding

## Implementation Steps

### Step 1: Audit Current Test Coverage
1. Review existing test cases in `semantic_index.python.test.ts`
2. Identify which Python features are tested vs available captures
3. Analyze the 18 failing tests to understand root causes
4. Document gaps in coverage

### Step 2: Review and Fix Test Fixtures
1. Examine Python fixture files in `fixtures/python/`
2. Ensure fixtures are valid Python code (syntax check)
3. Add missing language constructs if needed
4. Verify fixtures cover all major Python features

### Step 3: Debug and Fix Failing Tests
1. Run tests individually to isolate failures
2. For each failure, debug:
   - Query pattern existence in `python.scm`
   - Expected vs actual semantic entities
   - Fixture code validity
   - Test logic correctness
3. Fix or remove tests based on actual .scm support

### Step 4: Add Missing Test Coverage
1. Add tests for Python features not currently covered:
   - Async function definitions and await
   - Comprehension variables and scopes
   - Exception handling constructs
   - Property decorators
   - Import patterns (relative, star imports)

### Step 5: Validate Integration
1. Test with realistic Python code samples
2. Verify cross-reference between definitions and references
3. Ensure proper scope tracking for Python constructs
4. Test performance with larger Python files

## Test Categories to Address

### Definition Tests
- Function definitions: `SemanticEntity.FUNCTION`
- Class definitions: `SemanticEntity.CLASS`
- Method definitions: `SemanticEntity.METHOD`
- Property definitions: `SemanticEntity.PROPERTY`
- Variable definitions: `SemanticEntity.VARIABLE`

### Reference Tests
- Function calls vs method calls
- Property access and attribute references
- Decorator references
- Super() calls and inheritance
- Import references

### Scope Tests
- Module scopes
- Function and method scopes
- Class scopes
- Comprehension scopes
- Exception handler scopes

### Assignment Tests
- Simple variable assignments
- Multiple assignments (a, b = 1, 2)
- Annotated assignments (var: int = 5)
- Augmented assignments (+=, -=, etc.)

### Import/Export Tests
- Standard imports
- From imports with aliases
- Relative imports
- Star imports
- __all__ definitions

### Advanced Feature Tests
- Async function definitions
- Generator functions with yield
- Context manager usage
- Exception handling patterns
- Decorator chains

## Acceptance Criteria
- [ ] All tests in `semantic_index.python.test.ts` pass (currently 18 failing)
- [ ] Test coverage includes all major Python language features
- [ ] Tests validate against realistic, valid Python code samples
- [ ] No tests exist for unsupported capture patterns
- [ ] Integration between queries and semantic index works correctly
- [ ] Performance is acceptable for typical Python files
- [ ] Test fixtures are comprehensive and valid Python code

## Deliverables
1. Fixed test cases in `semantic_index.python.test.ts`
2. Updated or new Python test fixtures that are valid Python
3. Comprehensive test coverage documentation
4. Analysis of removed tests and reasoning
5. 100% test pass rate for semantic index integration

## Dependencies
- Task Epic-11.97.4.1 completion (fixed language configuration)
- Python test fixtures that are valid Python code
- Working tree-sitter Python parser
- Semantic index infrastructure

## Estimated Effort
- Test audit and failure analysis: 3 hours
- Fixture review and fixes: 2 hours
- Test debugging and fixes: 5 hours
- Coverage additions: 4 hours
- Integration validation: 3 hours

Total: ~17 hours

## Parent Task
Task Epic-11.97.4: Python Language Support Validation