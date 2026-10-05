# Task Epic-11.97.1: TypeScript Language Support Validation

## Status
Pending

## Description
Comprehensive validation and fixing of TypeScript language support to ensure all tree-sitter captures in the .scm file are properly configured and tested, and that all tests pass.

## Context
The TypeScript language configuration and semantic index tests need to be verified against the actual tree-sitter query patterns in `typescript.scm`. Currently there may be mismatches between:
1. Captures defined in `packages/core/src/semantic_index/queries/typescript.scm`
2. Language configuration mappings in `language_configs/typescript.test.ts`
3. Semantic index integration tests in `semantic_index.typescript.test.ts`

## Requirements

### Core Objectives
1. **Audit .scm File**: Identify all capture patterns in `typescript.scm`
2. **Validate Configuration**: Ensure every capture has proper LanguageCaptureConfig mapping
3. **Verify Tests**: Ensure tests cover all capture types without testing unsupported captures
4. **Fix Failures**: Resolve all test failures to achieve 100% pass rate

### TypeScript-Specific Captures to Validate
Based on `typescript.scm` analysis, key capture categories include:
- **Scopes**: `scope.module`, `scope.function`, `scope.class`, `scope.interface`, `scope.enum`, `scope.namespace`, `scope.block`
- **Definitions**: `def.function`, `def.class`, `def.interface`, `def.type_alias`, `def.enum`, `def.namespace`, `def.method`, `def.field`, `def.param`, `def.constructor`
- **Type System**: `def.type_param`, type annotations, generics, access modifiers
- **Imports/Exports**: Named, default, namespace imports/exports, re-exports
- **References**: Function calls, method calls, property access, type references, generics
- **TypeScript Features**: Interfaces, enums, namespaces, decorators, access modifiers

## Implementation Plan

### Phase 1: .scm File Analysis
1. Parse `typescript.scm` to extract all capture patterns
2. Categorize captures by semantic type (scope, definition, reference, etc.)
3. Document TypeScript-specific patterns not in JavaScript

### Phase 2: Configuration Validation
1. Review `TYPESCRIPT_CAPTURE_CONFIG` map in `language_configs/typescript.ts`
2. Ensure every .scm capture has corresponding configuration
3. Verify semantic categories and entities are correct
4. Add missing configurations

### Phase 3: Test Alignment
1. Review `language_configs/typescript.test.ts` for configuration coverage
2. Review `semantic_index.typescript.test.ts` for integration coverage
3. Remove tests for unsupported captures
4. Add tests for missing capture types
5. Update test fixtures as needed

### Phase 4: Failure Resolution
1. Run tests and identify specific failures
2. Debug and fix each failure systematically
3. Ensure TypeScript-specific features are properly handled
4. Validate against real TypeScript code samples

## Acceptance Criteria
- [ ] All captures in `typescript.scm` have configuration mappings
- [ ] No configuration exists for captures not in .scm file
- [ ] All language configuration tests pass (typescript.test.ts)
- [ ] All semantic index integration tests pass (semantic_index.typescript.test.ts)
- [ ] TypeScript-specific features work correctly (interfaces, enums, generics, decorators)
- [ ] Test coverage includes all major TypeScript language constructs
- [ ] Performance is acceptable for typical TypeScript files

## Sub-Tasks
- **Task Epic-11.97.1.1**: Fix TypeScript language configuration tests
- **Task Epic-11.97.1.2**: Fix TypeScript semantic index integration tests

## Dependencies
- Tree-sitter-typescript parser functionality
- Base semantic index infrastructure
- Test fixtures and utilities

## Estimated Effort
- .scm analysis: 2 hours
- Configuration validation: 3 hours
- Test alignment: 4 hours
- Failure resolution: 6 hours
- Validation: 2 hours

Total: ~17 hours

## Related Tasks
- Task Epic-11.97.2: JavaScript language support validation
- Task Epic-11.97.3: Rust language support validation
- Task Epic-11.97.4: Python language support validation