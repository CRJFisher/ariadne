# Task Epic-11.97.4: Python Language Support Validation

## Status
Pending

## Description
Comprehensive validation and fixing of Python language support to ensure all tree-sitter captures in the .scm file are properly configured and tested, and that all tests pass.

## Context
The Python language configuration and semantic index tests are currently failing (35 failed tests in language config, 18 failed tests in semantic index). There are mismatches between:
1. Captures defined in `packages/core/src/semantic_index/queries/python.scm`
2. Language configuration mappings in `language_configs/python.test.ts`
3. Semantic index integration tests in `semantic_index.python.test.ts`

## Requirements

### Core Objectives
1. **Audit .scm File**: Identify all capture patterns in `python.scm`
2. **Validate Configuration**: Ensure every capture has proper LanguageCaptureConfig mapping
3. **Verify Tests**: Ensure tests cover all capture types without testing unsupported captures
4. **Fix Failures**: Resolve all test failures to achieve 100% pass rate

### Python-Specific Captures to Validate
Based on `python.scm` analysis, key capture categories include:
- **Scopes**: `scope.module`, `scope.function`, `scope.lambda`, `scope.class`, `scope.method`, `scope.block`, `scope.comprehension`
- **Definitions**: `def.function`, `def.function.async`, `def.class`, `def.method`, `def.constructor`, `def.property`, `def.variable`, `def.param`
- **Method Types**: Static methods, class methods, property decorators
- **Assignments**: Variable assignments, annotated assignments, tuple unpacking, multiple assignments
- **Imports/Exports**: Import statements, from imports, relative imports, __all__ definitions
- **References**: Function calls, method calls, attribute access, decorators
- **Python Features**: Classes, decorators, async/await, comprehensions, generators, exception handling

## Implementation Plan

### Phase 1: .scm File Analysis
1. Parse `python.scm` to extract all capture patterns
2. Categorize captures by semantic type (scope, definition, reference, etc.)
3. Document Python-specific patterns (decorators, comprehensions, async/await)

### Phase 2: Configuration Validation
1. Review `PYTHON_CAPTURE_CONFIG` map in `language_configs/python.ts`
2. Ensure every .scm capture has corresponding configuration
3. Verify semantic categories and entities are correct
4. Add missing configurations

### Phase 3: Test Alignment
1. Review `language_configs/python.test.ts` for configuration coverage
2. Review `semantic_index.python.test.ts` for integration coverage
3. Remove tests for unsupported captures
4. Add tests for missing capture types
5. Update test fixtures as needed

### Phase 4: Failure Resolution
1. Run tests and identify specific failures
2. Debug and fix each failure systematically
3. Ensure Python-specific features are properly handled
4. Validate against real Python code samples

## Known Problem Areas
Based on test failures observed:
- Class context detection and method scoping
- Decorator handling (staticmethod, classmethod, property)
- Async function definitions and await expressions
- Comprehension variable scoping
- Import patterns (from imports, relative imports)
- Exception handling (try/except/finally)
- Multiple assignment and tuple unpacking
- Property and method decorators

## Acceptance Criteria
- [ ] All captures in `python.scm` have configuration mappings
- [ ] No configuration exists for captures not in .scm file
- [ ] All language configuration tests pass (python.test.ts)
- [ ] All semantic index integration tests pass (semantic_index.python.test.ts)
- [ ] Python-specific features work correctly (decorators, async/await, comprehensions)
- [ ] Test coverage includes all major Python language constructs
- [ ] Performance is acceptable for typical Python files

## Sub-Tasks
- **Task Epic-11.97.4.1**: Fix Python language configuration tests
- **Task Epic-11.97.4.2**: Fix Python semantic index integration tests

## Dependencies
- Tree-sitter-python parser functionality
- Base semantic index infrastructure
- Test fixtures and utilities

## Estimated Effort
- .scm analysis: 3 hours
- Configuration validation: 4 hours
- Test alignment: 6 hours
- Failure resolution: 8 hours
- Validation: 3 hours

Total: ~24 hours

## Related Tasks
- Task Epic-11.97.1: TypeScript language support validation
- Task Epic-11.97.2: JavaScript language support validation
- Task Epic-11.97.3: Rust language support validation