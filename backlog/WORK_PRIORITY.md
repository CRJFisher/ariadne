# Work Priority Guide

## Current Status: Near-Complete Test Suite

Major test fixes completed! Down to only 2 failing tests for unimplemented features.

### Recent Progress

- ✅ **get_source_code regression fixed** - Now returns full function bodies
- ✅ **Recursive call detection fixed** - Tests were using wrong comparison
- ✅ **Test comparisons corrected** - Fixed id vs name comparisons in edge case tests
- ✅ **Rust self parameter tracking fixed** - Methods with outgoing calls now included
- ✅ **Python/Rust import resolution fixed** - Non-relative imports now supported

### Test Status

- **490 tests passing** ✅ (was 484)
- **2 tests failing** 🔧 (was 8)
- **21 tests skipped** 📋

## Completed Tasks ✅

1. **Fix Rust Cross-file Method Resolution (task-100.37)** - COMPLETED
2. **Fix Variable Reassignment Type Tracking (task-100.42)** - COMPLETED  
3. **Fix get_source_code regression (task-100.28)** - COMPLETED
4. **Fix Recursive/Self-referential Call Tracking (task-100.38)** - COMPLETED
5. **Add Graceful Error Handling for Missing Imports (task-100.41)** - COMPLETED
6. **Fix Python/Rust Import Resolution** - COMPLETED
7. **Fix Rust self parameter tracking** - COMPLETED

## Remaining Work: Feature Implementation

### 1. Support Method Chaining and Return Type Tracking (task-100.39)

**Priority**: MEDIUM

- Complex chains like `api.request().get().send()` not fully resolved
- Only first level of calls tracked
- Need return type tracking for fluent APIs

### 2. Add Namespace Import Resolution (task-100.40)

**Priority**: MEDIUM

- `import * as namespace` patterns not resolved
- `namespace.function()` calls fail
- Common in TypeScript projects

## Optional Enhancements

### 3. Fix JavaScript Scope Hoisting Issues (task-100.43)

**Priority**: LOW

- Function declarations not hoisted correctly
- `var` declarations not hoisted to function scope
- Affects scope resolution accuracy

### 4. Fix TypeScript TSX Reference Tracking (task-100.44)

**Priority**: LOW

- JSX elements and component references not tracked
- React-specific patterns need support
- Props and hooks tracking incomplete

### 5. Add Support for .mts/.cts TypeScript Extensions (task-100.45)

**Priority**: LOW

- New TypeScript module extensions not recognized
- `.mts` for ES modules, `.cts` for CommonJS
- Increasingly common in modern projects

## Current Test Failures

### Only 2 Tests Failing (Both Unimplemented Features)

1. **Method Chaining** - `tracks multi-level method calls across files`
   - Feature not yet implemented (task-100.39)
   
2. **Namespace Imports** - `handles namespace imports with nested access`
   - Feature not yet implemented (task-100.40)

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

## Summary

From 8 failing tests down to 2! Both remaining failures are for unimplemented features (method chaining and namespace imports), not bugs.

### Major Fixes Completed
- ✅ Cross-file call tracking restored
- ✅ Recursive call detection working
- ✅ Source code extraction returning full functions
- ✅ Rust methods properly included in call graph
- ✅ Python/Rust import resolution working
- ✅ Test comparisons corrected

### Next Steps
The 2 remaining failing tests require new feature implementation:
1. Method chaining with return type tracking
2. Namespace import resolution

These are non-trivial features that would benefit from dedicated design and implementation effort.

## Notes

The refactoring successfully eliminated NavigationService and QueryService, fixing the primary cross-file tracking issues. The remaining work is primarily edge cases and advanced features that can be implemented incrementally without architectural changes.
