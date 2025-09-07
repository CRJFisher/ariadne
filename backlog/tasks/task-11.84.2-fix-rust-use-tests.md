# Task 11.84.2: Fix Failing Rust Use Declaration Tests

## Overview

Fix 2 failing tests in `export_detection.rust.bespoke.test.ts` related to `pub use` declarations with aliases and lists.

## Failing Tests

1. **should detect pub use with alias**
   - Error: `expected 'Short' to be 'LongName'`
   - Line: `src/import_export/export_detection/export_detection.rust.bespoke.test.ts:114`
   - Issue: `original_name` field has incorrect value

2. **should detect pub use with list**
   - Error: `expected 0 to be greater than 0`
   - Line: `src/import_export/export_detection/export_detection.rust.bespoke.test.ts:139`
   - Issue: Not detecting any exports from use lists

## Test Cases

### Alias Test
```rust
pub use crate::module::LongName as Short;
pub use super::parent::Item as MyItem;
```
Expected:
- Export name: 'Short' with original_name: 'LongName'
- Export name: 'MyItem' with original_name: 'Item'

Currently getting:
- Export name: 'Short' with original_name: 'Short' (incorrect)

### List Test
```rust
pub use crate::module::{Item1, Item2, Item3};
pub use std::{io, fs, path::Path};
```
Expected:
- Should detect Item1, Item2, Item3, io, fs, Path

Currently getting:
- No exports detected (empty array)

## Root Cause Analysis

### Alias Issue
The `parse_use_tree_recursive` function is incorrectly mapping names and aliases:
```typescript
// Current buggy code
items.push({
  name: children[0].text,  // This is the original name
  path: path_prefix + children[0].text,
  alias: children[1].text,  // This is the alias
  is_glob: false
});
```

The export push in `handle_pub_use_reexports` then uses:
```typescript
name: use_item.alias || use_item.name,
original_name: use_item.alias ? use_item.name : undefined,
```

This logic is inverted - when there's an alias, `name` should be the alias and `original_name` should be the original.

### List Issue
The use list parsing is not correctly handling the `use_tree` structure for lists like `{Item1, Item2, Item3}`. The AST structure needs to be properly traversed to extract individual items from the list.

## Implementation Notes

### Fix for Alias Handling
```typescript
// In parse_use_tree_recursive for use_as_clause
items.push({
  name: children[1].text,  // Alias (what it's imported as)
  path: path_prefix + children[0].text,
  alias: children[1].text,
  original_name: children[0].text,  // Original name
  is_glob: false
});

// In handle_pub_use_reexports
exports.push({
  name: use_item.alias || use_item.name,  // Use alias if present
  source: use_item.path,
  kind: use_item.is_glob ? 'namespace' : 'named',
  location: node_to_location(node),
  original_name: use_item.original_name,  // Pass through original
  visibility,
  is_reexport: true
});
```

### Fix for List Handling
Need to properly parse the use_tree structure:
1. Identify `use_list` nodes
2. Extract individual identifiers from the list
3. Handle nested paths like `path::Path`

## Acceptance Criteria

- [ ] Alias test correctly identifies original_name vs alias
- [ ] List test detects all items in use lists
- [ ] Both simple and complex use patterns work
- [ ] No regression in other Rust tests

## Test Verification

Run focused tests:
```bash
npm test -- src/import_export/export_detection/export_detection.rust.bespoke.test.ts \
  -t "should detect pub use with"
```

## Priority

HIGH - Core Rust re-export functionality must work correctly for module analysis