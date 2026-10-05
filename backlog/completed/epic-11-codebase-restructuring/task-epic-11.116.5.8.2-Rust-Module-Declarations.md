# Task epic-11.116.5.8.2: Rust Module Declarations

**Status:** Completed
**Parent:** task-epic-11.116.5.8
**Priority:** Medium
**Created:** 2025-10-20
**Completed:** 2025-10-20

## Overview

Rust module declarations (`mod module_name;`) are not being resolved correctly, preventing cross-module imports and associated function calls from working.

## Problem

When parsing Rust code with module declarations:

```rust
// In uses_user.rs
mod user_mod;  // <-- This declaration

use user_mod::User;  // <-- This import fails

fn main() {
    let user = User::new(...);  // Cannot resolve because User import fails
}
```

The `mod user_mod;` declaration should link to `user_mod.rs`, but this isn't happening. As a result:
1. Import resolution fails for `User`
2. Associated function calls like `User::new()` cannot be resolved
3. Method calls on imported types work in the single file but fail across modules

Error message:
```
Debug: No body scope found for mod user_mod; at .../uses_user.rs:4
```

## Root Cause

The semantic indexer doesn't fully handle Rust module declarations. It needs to:
1. Parse `mod module_name;` declarations
2. Resolve the file path (module_name.rs or module_name/mod.rs)
3. Create appropriate import graph entries
4. Link the scopes correctly

## Impact

This blocks:
- Cross-module symbol resolution
- Associated function calls across modules
- Full Rust multi-file project support

## Related

- Blocked by: None
- Blocks: task-epic-11.116.5.8.1 (cross-module test)

## Test Case

From `project.rust.integration.test.ts`:

```typescript
it.skip("should resolve associated function calls across modules", async () => {
  // This test is currently skipped due to this issue
  // user_mod.rs defines User class
  // uses_user.rs has: mod user_mod; use user_mod::User;
  // Should be able to resolve User::new()
});
```

## Success Criteria

- [x] `mod module_name;` declarations are parsed and linked
- [x] Cross-module imports resolve correctly
- [x] Associated function calls work across modules
- [x] Integration test "should resolve associated function calls across modules" passes

## Implementation Details

### Root Causes

1. **Tree-sitter query issue**: External mod declarations (`mod user_mod;`) were tagged as `@definition.function`, causing the system to look for a non-existent body scope
2. **Module resolution**: `resolve_module_path_rust` only handled `crate::`, `super::`, `self::` prefixes, not local modules
3. **File existence check**: `file_exists()` expected relative paths but received absolute paths

### Changes Made

1. **[rust.scm](file:///packages/core/src/index_single_file/query_code_tree/queries/rust.scm:447-466)**
   - Removed `@definition.function` tag from external mod declarations
   - Split public mod query into with-body and without-body variants

2. **[import_resolver.rust.ts](file:///packages/core/src/resolve_references/import_resolution/import_resolver.rust.ts:64-82)**
   - Added handling for local module names (no prefix)
   - Resolve relative to current directory for `use user_mod::User` patterns

3. **[import_resolver.rust.ts](file:///packages/core/src/resolve_references/import_resolution/import_resolver.rust.ts:15-35)**
   - Fixed `file_exists()` to convert absolute paths to relative paths
   - Use `path.sep` instead of hardcoded `/` for cross-platform compatibility

### Test Results

All 12 Rust integration tests pass, including cross-module resolution.
