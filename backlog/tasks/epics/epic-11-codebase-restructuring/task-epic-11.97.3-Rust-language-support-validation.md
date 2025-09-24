# Task Epic-11.97.3: Rust Language Support Validation

## Status
Pending

## Description
Comprehensive validation and fixing of Rust language support to ensure all tree-sitter captures in the .scm file are properly configured and tested, and that all tests pass.

## Context
The Rust language configuration and semantic index tests are currently failing heavily (54 failed tests in language config, 20 failed tests in semantic index). There are mismatches between:
1. Captures defined in `packages/core/src/semantic_index/queries/rust.scm`
2. Language configuration mappings in `language_configs/rust.test.ts`
3. Semantic index integration tests in `semantic_index.rust.test.ts`

## Requirements

### Core Objectives
1. **Audit .scm File**: Identify all capture patterns in `rust.scm`
2. **Validate Configuration**: Ensure every capture has proper LanguageCaptureConfig mapping
3. **Verify Tests**: Ensure tests cover all capture types without testing unsupported captures
4. **Fix Failures**: Resolve all test failures to achieve 100% pass rate

### Rust-Specific Captures to Validate
Based on `rust.scm` analysis, key capture categories include:
- **Scopes**: `scope.module`, `scope.function`, `scope.closure`, `scope.struct`, `scope.enum`, `scope.trait`, `scope.impl`, `scope.block`, `scope.block.unsafe`, `scope.block.async`
- **Definitions**: `def.struct`, `def.enum`, `def.enum_variant`, `def.function`, `def.method`, `def.trait`, `def.type_alias`, `def.const`, `def.static`, `def.module`, `def.macro`
- **Generics & Lifetimes**: `def.type_param`, `lifetime.param`, `lifetime.ref`
- **Imports/Exports**: Use declarations, pub use, extern crate, wildcard imports
- **References**: Function calls, method calls, field access, macro invocations
- **Rust Features**: Ownership, lifetimes, pattern matching, async/await, unsafe blocks

## Implementation Plan

### Phase 1: .scm File Analysis
1. Parse `rust.scm` to extract all capture patterns
2. Categorize captures by semantic type (scope, definition, reference, etc.)
3. Document Rust-specific patterns (ownership, lifetimes, traits, impl blocks)

### Phase 2: Configuration Validation
1. Review `RUST_CAPTURE_CONFIG` map in `language_configs/rust.ts`
2. Ensure every .scm capture has corresponding configuration
3. Verify semantic categories and entities are correct
4. Add missing configurations

### Phase 3: Test Alignment
1. Review `language_configs/rust.test.ts` for configuration coverage
2. Review `semantic_index.rust.test.ts` for integration coverage
3. Remove tests for unsupported captures
4. Add tests for missing capture types
5. Update test fixtures as needed

### Phase 4: Failure Resolution
1. Run tests and identify specific failures
2. Debug and fix each failure systematically
3. Ensure Rust-specific features are properly handled
4. Validate against real Rust code samples

## Known Problem Areas
Based on test failures observed:
- Module context detection (crate root vs non-root)
- Closure handling and scope detection
- Impl block context and method resolution
- Trait parsing and implementation tracking
- Function definitions and async functions
- Import/export patterns (use statements, pub use)
- Lifetime annotations and pattern matching
- Method calls with receivers
- Macro definitions and invocations

## Acceptance Criteria
- [ ] All captures in `rust.scm` have configuration mappings
- [ ] No configuration exists for captures not in .scm file
- [ ] All language configuration tests pass (rust.test.ts)
- [ ] All semantic index integration tests pass (semantic_index.rust.test.ts)
- [ ] Rust-specific features work correctly (traits, impl blocks, lifetimes, ownership)
- [ ] Test coverage includes all major Rust language constructs
- [ ] Performance is acceptable for typical Rust files

## Sub-Tasks
- **Task Epic-11.97.3.1**: Fix Rust language configuration tests
- **Task Epic-11.97.3.2**: Fix Rust semantic index integration tests

## Dependencies
- Tree-sitter-rust parser functionality
- Base semantic index infrastructure
- Test fixtures and utilities

## Estimated Effort
- .scm analysis: 3 hours
- Configuration validation: 4 hours
- Test alignment: 6 hours
- Failure resolution: 10 hours
- Validation: 3 hours

Total: ~26 hours

## Related Tasks
- Task Epic-11.97.1: TypeScript language support validation
- Task Epic-11.97.2: JavaScript language support validation
- Task Epic-11.97.4: Python language support validation