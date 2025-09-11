# Task 11.100.3.1: Test Overhaul for export_detection

## Parent Task

11.100.3 - Transform export_detection to Tree-sitter Queries

## Overview

Comprehensive test overhaul for the export_detection module transformation to ensure 100% test coverage and zero test failures before and after the Tree-sitter query implementation.

**Module Location**: `src/import_export/export_detection/`

## Test Overhaul Requirements

### Comprehensive Test Suite Implementation

- [ ] **Achieve 100% Test Coverage**
  - All export patterns (named, default, re-exports) must have tests
  - All language-specific query patterns (.scm files) must be tested
  - All edge cases (export *, destructured exports) must be validated
  - All module systems (ES6, CommonJS, Python, Rust) must be tested

- [ ] **Language-Specific Test Files**
  - `export_detection.javascript.test.ts` - ES6 exports, CommonJS exports/module.exports
  - `export_detection.typescript.test.ts` - TS export types, interfaces, namespaces
  - `export_detection.python.test.ts` - Python __all__, implicit exports, packages
  - `export_detection.rust.test.ts` - Rust pub visibility, use re-exports, crate exports

- [ ] **Test Categories (All Languages)**
  - Named exports (export { name })
  - Default exports (export default)
  - Declaration exports (export function, export class)
  - Re-exports (export { name } from 'module')
  - Namespace exports (export * from)
  - Conditional exports
  - Dynamic exports
  - Export aliases and renaming

- [ ] **Edge Case Testing**
  - Circular re-exports
  - Export shadowing
  - Mixed module systems
  - Computed export names
  - Export with side effects
  - Invalid export patterns

- [ ] **Query Pattern Validation**
  - Test each .scm query pattern independently
  - Verify export name extraction accuracy
  - Test re-export source resolution
  - Validate export type classification

- [ ] **Integration Testing**
  - Test with real-world modules from corpus/
  - Verify cross-file export resolution
  - Performance benchmarks vs manual detection
  - Module dependency graph accuracy

### Success Criteria (Testing)
- **100% test coverage** (no exceptions)
- **All tests passing** (zero failures, zero skips)
- **Export detection accuracy >99%** (validated against known exports)
- **Performance improvement demonstrated** (queries faster than manual)

## Dependencies

- Must be completed BEFORE task 11.100.3 implementation begins
- Works in parallel with task 11.100.3.2 (TypeScript compliance)
- Validates the transformation will not break existing functionality

## Notes

- This task ensures transformation safety through comprehensive testing
- 100% test coverage is non-negotiable
- All tests must pass before transformation begins
- Test suite will validate query-based implementation matches manual implementation
