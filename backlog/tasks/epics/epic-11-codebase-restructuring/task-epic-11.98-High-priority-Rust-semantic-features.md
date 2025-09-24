# task-epic-11.98 - High Priority Rust Semantic Features

## Status

- **Status**: `Not Started`
- **Assignee**: Unassigned
- **Priority**: `High`
- **Size**: `M`
- **Parent**: epic-11-codebase-restructuring

## Description

Implement the most critical Rust semantic features that appear in nearly every Rust codebase. These are fundamental language constructs that must be supported for comprehensive Rust analysis.

## Dependencies

- **Prerequisites**: task-epic-11.95.11 (Rust Implementation Integration and Testing)
- Rust semantic index foundation established (87/117 tests passing)

## Scope

This task implements the three most essential missing Rust features:

1. **Function Pointer Types** - Parse and capture `fn()` type syntax
2. **Smart Pointer Detection** - Support Box, Rc, Arc type recognition
3. **Extern Crate Handling** - Improve external dependency import processing

## Acceptance Criteria

- [ ] Function pointer types (`fn(param) -> return`) fully captured in semantic index
- [ ] Smart pointer types (Box, Rc, Arc) detected and tracked properly
- [ ] Extern crate declarations processed with proper aliasing support
- [ ] All related test cases pass
- [ ] No performance regression from new patterns
- [ ] Integration with existing type system maintained

## Implementation Plan

### 1. Function Pointer Types

Add tree-sitter queries and mappings for:
```rust
type Handler = fn(&str) -> Result<(), Error>;
let callback: fn(i32) -> bool = |x| x > 0;
```

### 2. Smart Pointer Detection

Enhance type recognition for:
```rust
let data: Box<dyn Display> = Box::new(42);
let shared: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(vec![]));
let thread_safe: Arc<Mutex<HashMap<K, V>>> = Arc::new(Mutex::new(HashMap::new()));
```

### 3. Extern Crate Handling

Improve external dependency processing:
```rust
extern crate serde;
extern crate tokio as async_runtime;
```

## Files to Modify

- `src/semantic_index/queries/rust.scm` - Add new query patterns
- `src/semantic_index/language_configs/rust_core.ts` - Add capture mappings
- `src/semantic_index/semantic_index.rust.test.ts` - Add test cases
- Test fixtures - Create comprehensive test cases

## Success Metrics

- Function pointer type tests pass
- Smart pointer detection tests pass
- Extern crate handling tests pass
- Overall Rust test passing rate increases from 74.4% to >80%
- No regression in existing functionality

## Notes

These three features are absolutely fundamental to Rust development and appear in virtually every significant Rust codebase. Implementing them will provide immediate value for real-world Rust analysis.