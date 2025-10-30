# Task Epic 11.154.8.3: Fix Rust Cross-Module Resolution

**Parent Task**: 11.154.8
**Test Impact**: 4 tests
**Time**: 1-2 hours

---

## Failing Tests

1. "should resolve associated functions and methods in Rust"
2. "should resolve imported modules in Rust"
3. "should extract nested/grouped imports" (HashMap missing)
4. "should handle multiple structs from the same module"

---

## Solution

**FIX**: Rust builder logic for use_list extraction (Task 11.154.7.1 will handle this)
**FIX**: Cross-module resolution in ResolutionRegistry

**NO new captures** - use existing `@definition.import` on complete nodes

---

## Approach

Builder extracts HashMap from:
```rust
use std::collections::{Ordering, HashMap, File};
```

By traversing use_list children in the complete use_declaration node.

---

## Time: 1-2 hours (may overlap with 11.154.7.1)
