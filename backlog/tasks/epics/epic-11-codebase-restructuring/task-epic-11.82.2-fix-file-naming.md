# Task 11.82.2: Fix File Naming to Match Recipe Pattern

## Parent Task
11.82 - Refactor constructor_calls to Configuration-Driven Pattern

## Overview
Rename bespoke handler files to match the pattern specified in the refactoring recipe. Current naming violates the established pattern.

## Current State
Files are incorrectly named with ".bespoke" suffix:
- `constructor_calls.javascript.bespoke.ts`
- `constructor_calls.typescript.bespoke.ts`
- `constructor_calls.python.bespoke.ts`
- `constructor_calls.rust.bespoke.ts`

Test files:
- `constructor_calls.javascript.bespoke.test.ts`

## Target State
According to refactoring recipe section 3:
```
module_name.typescript.ts  # TypeScript bespoke features only
module_name.python.ts      # Python bespoke features only
module_name.rust.ts        # Rust bespoke features only
```

## Acceptance Criteria
- [x] Rename `constructor_calls.javascript.bespoke.ts` → `constructor_calls.javascript.ts`
- [x] Rename `constructor_calls.typescript.bespoke.ts` → `constructor_calls.typescript.ts`
- [x] Rename `constructor_calls.python.bespoke.ts` → `constructor_calls.python.ts`
- [x] Rename `constructor_calls.rust.bespoke.ts` → `constructor_calls.rust.ts`
- [x] Rename test file accordingly
- [x] Update all imports in index.ts
- [x] Update all imports in tests
- [x] Verify all tests still pass after renaming

## Technical Notes
- This is a simple rename operation but requires updating all import statements
- Git should track the rename as a move operation
- No functional changes required

## Priority
HIGH - Compliance with architecture patterns

## Implementation Notes
COMPLETE:
- Renamed all 4 bespoke handler files to remove `.bespoke` suffix
- Renamed test file from `constructor_calls.javascript.bespoke.test.ts` to `constructor_calls.javascript.test.ts`  
- Updated imports in index.ts to use new file names
- Updated import in constructor_calls.javascript.test.ts
- Verified tests still run (82/86 passing - same 4 failures as before)