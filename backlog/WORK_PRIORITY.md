# Work Priority Guide

## Current Status: Post-Refactoring Test Fixes

Major refactoring completed (NavigationService/QueryService eliminated). Now focusing on fixing remaining test failures and implementing edge case support.

### Recent Progress

- ✅ **Rust cross-file method resolution fixed** - All language cross-file tests now passing
- ✅ **CommonJS export detection improved** - module.exports patterns now detected
- ✅ **Virtual file system support added** - Enables proper testing of cross-file features

### Test Status

- **484 tests passing** ✅
- **8 tests failing** 🔧
- **21 tests skipped** 📋

## Phase 1: Critical Bug Fixes (Immediate)

### ~~1. Fix Rust Cross-file Method Resolution (task-100.37)~~ ✅ COMPLETED

**Priority**: HIGH

- ✅ Rust method calls on imported structs now resolving correctly
- ✅ Instance methods working (logger.log, logger.get_logs)
- ✅ Private methods filtered from call graph when uncalled

### ~~2. Fix Variable Reassignment Type Tracking (task-100.42)~~ ✅ COMPLETED

**Priority**: HIGH

- ✅ Variable reassignment tracking was already working correctly!
- ✅ Test was incorrectly counting unresolved calls as bugs
- ✅ System correctly tracks type changes and resolves methods based on current type

## Phase 2: Core Functionality Gaps (Next)

### 3. Add Recursive/Self-referential Call Tracking (task-100.38)

**Priority**: MEDIUM

- Functions calling themselves not tracked
- Affects both same-file and cross-file patterns
- Common pattern in many codebases

### 4. Support Method Chaining and Return Type Tracking (task-100.39)

**Priority**: MEDIUM

- Complex chains like `api.request().get().send()` not fully resolved
- Only first level of calls tracked
- Need return type tracking for fluent APIs

### 5. Add Namespace Import Resolution (task-100.40)

**Priority**: MEDIUM

- `import * as namespace` patterns not resolved
- `namespace.function()` calls fail
- Common in TypeScript projects

## Phase 3: Robustness & Error Handling

### 6. Add Graceful Error Handling for Missing Imports (task-100.41)

**Priority**: MEDIUM

- Missing files cause analysis failures
- Non-existent exports not handled gracefully
- Should continue analyzing valid code

### 7. Fix JavaScript Scope Hoisting Issues (task-100.43)

**Priority**: LOW

- Function declarations not hoisted correctly
- `var` declarations not hoisted to function scope
- Affects scope resolution accuracy

### 8. Fix TypeScript TSX Reference Tracking (task-100.44)

**Priority**: LOW

- JSX elements and component references not tracked
- React-specific patterns need support
- Props and hooks tracking incomplete

## Phase 4: File Format Support

### 9. Add Support for .mts/.cts TypeScript Extensions (task-100.45)

**Priority**: LOW

- New TypeScript module extensions not recognized
- `.mts` for ES modules, `.cts` for CommonJS
- Increasingly common in modern projects

## Success Metrics

### Failing Tests to Fix

1. **Edge Cases (5 tests)**

   - Self-referential imports
   - Multi-level method calls
   - Recursive function calls
   - Namespace imports
   - Missing file handling

2. **Cross-file Tests (1 test)**

   - Rust method resolution

3. **Other Failures (2 tests)**
   - Variable reassignment tracking
   - Specific language edge cases

### Skipped Tests to Enable

- Inheritance tracking (broken by refactoring)
- Source code extraction (get_source_code broken)
- Multi-file builtin tracking (internals changed)
- Comprehensive reassignment tests
- Various edge case scenarios

## Implementation Strategy

1. **Fix Critical Bugs First**: Focus on failing tests that represent core functionality
2. **Enable Skipped Tests Gradually**: As underlying issues are fixed
3. **Document Limitations**: For complex edge cases that may remain unsupported
4. **Add Regression Tests**: For each fix to prevent future breakage

## Definition of Done

- All 8 failing tests pass OR are documented as intentional limitations
- Skipped tests reviewed and either:
  - Enabled and passing
  - Deleted if obsolete
  - Documented as future work
- Test coverage maintained above 80%
- No regression in currently passing tests

## Notes

The refactoring successfully eliminated NavigationService and QueryService, fixing the primary cross-file tracking issues. The remaining work is primarily edge cases and advanced features that can be implemented incrementally without architectural changes.
