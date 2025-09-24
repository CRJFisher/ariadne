# Task Epic-11.97.2: JavaScript Language Support Validation

## Status
Pending

## Description
Comprehensive validation and fixing of JavaScript language support to ensure all tree-sitter captures in the .scm file are properly configured and tested, and that all tests pass.

## Context
The JavaScript language configuration and semantic index tests need to be verified against the actual tree-sitter query patterns in `javascript.scm`. Currently there may be mismatches between:
1. Captures defined in `packages/core/src/semantic_index/queries/javascript.scm`
2. Language configuration mappings in `language_configs/javascript.test.ts`
3. Semantic index integration tests in `semantic_index.javascript.test.ts`

## Requirements

### Core Objectives
1. **Audit .scm File**: Identify all capture patterns in `javascript.scm`
2. **Validate Configuration**: Ensure every capture has proper LanguageCaptureConfig mapping
3. **Verify Tests**: Ensure tests cover all capture types without testing unsupported captures
4. **Fix Failures**: Resolve all test failures to achieve 100% pass rate

### JavaScript-Specific Captures to Validate
Based on `javascript.scm` analysis, key capture categories include:
- **Scopes**: `scope.module`, `scope.function`, `scope.class`, `scope.block`
- **Definitions**: `def.function`, `def.class`, `def.method`, `def.field`, `def.variable`, `def.param`, `def.constructor`
- **Assignments**: Variable assignments, destructuring, arrow functions
- **Imports/Exports**: Named, default, namespace imports/exports, re-exports
- **References**: Function calls, method calls, property access, chained calls
- **JavaScript Features**: Classes, arrow functions, generators, async/await, destructuring, JSX

## Implementation Plan

### Phase 1: .scm File Analysis
1. Parse `javascript.scm` to extract all capture patterns
2. Categorize captures by semantic type (scope, definition, reference, etc.)
3. Document JavaScript-specific patterns (arrow functions, destructuring, JSX)

### Phase 2: Configuration Validation
1. Review `JAVASCRIPT_CAPTURE_CONFIG` map in `language_configs/javascript.ts`
2. Ensure every .scm capture has corresponding configuration
3. Verify semantic categories and entities are correct
4. Add missing configurations

### Phase 3: Test Alignment
1. Review `language_configs/javascript.test.ts` for configuration coverage
2. Review `semantic_index.javascript.test.ts` for integration coverage
3. Remove tests for unsupported captures
4. Add tests for missing capture types
5. Update test fixtures as needed

### Phase 4: Failure Resolution
1. Run tests and identify specific failures
2. Debug and fix each failure systematically
3. Ensure JavaScript-specific features are properly handled
4. Validate against real JavaScript code samples

## Acceptance Criteria
- [ ] All captures in `javascript.scm` have configuration mappings
- [ ] No configuration exists for captures not in .scm file
- [ ] All language configuration tests pass (javascript.test.ts)
- [ ] All semantic index integration tests pass (semantic_index.javascript.test.ts)
- [ ] JavaScript-specific features work correctly (arrow functions, classes, destructuring, JSX)
- [ ] Test coverage includes all major JavaScript language constructs
- [ ] Performance is acceptable for typical JavaScript files

## Sub-Tasks
- **Task Epic-11.97.2.1**: Fix JavaScript language configuration tests
- **Task Epic-11.97.2.2**: Fix JavaScript semantic index integration tests

## Dependencies
- Tree-sitter-javascript parser functionality
- Base semantic index infrastructure
- Test fixtures and utilities

## Estimated Effort
- .scm analysis: 2 hours
- Configuration validation: 3 hours
- Test alignment: 4 hours
- Failure resolution: 5 hours
- Validation: 2 hours

Total: ~16 hours

## Related Tasks
- Task Epic-11.97.1: TypeScript language support validation
- Task Epic-11.97.3: Rust language support validation
- Task Epic-11.97.4: Python language support validation