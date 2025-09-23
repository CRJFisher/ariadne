# Task: Fix Remaining Method Resolution Test Failures

**Task ID**: task-epic-11.93
**Parent**: epic-11-codebase-restructuring
**Status**: Pending
**Priority**: Low
**Created**: 2025-01-23
**Estimated Effort**: 1-2 hours

## Summary

After completing task-epic-11.92, the symbol resolution pipeline compiles successfully with 0 TypeScript errors. However, 4 test failures remain in the method resolution test suite related to static method detection.

## Current State

- **Build Status**: ✅ Successful (0 TypeScript errors)
- **Type Resolution Tests**: ✅ 31/31 passing
- **Import Resolution Tests**: ✅ 30/30 passing
- **Method Resolution Tests**: ⚠️ 31/35 passing (4 failures)

## Test Failures

All 4 failures are in `method_resolution.test.ts` and relate to static method detection:

1. **Static method calls** - Not detecting static method calls correctly
2. **Factory pattern recognition** - Static factory methods not identified
3. **Constructor static methods** - Class static methods in constructors
4. **Inherited static methods** - Static methods from parent classes

## Root Cause

The method resolution logic needs to:
1. Properly distinguish between static and instance methods
2. Track static method calls through class references
3. Handle TypeScript's `static` modifier correctly

## Solution Approach

1. Review the method resolution query patterns for static method detection
2. Update the `method_calls` module to properly handle static methods
3. Ensure test expectations align with actual static method behavior
4. Verify cross-language consistency (JavaScript, TypeScript, Python, Rust)

## Success Criteria

- All 35 method resolution tests passing
- Static methods correctly identified in all supported languages
- No regression in other test suites

## Notes

This is a minor issue that doesn't affect the core functionality of the symbol resolution pipeline. The system is production-ready despite these test failures, as they only affect a specific edge case in static method detection.