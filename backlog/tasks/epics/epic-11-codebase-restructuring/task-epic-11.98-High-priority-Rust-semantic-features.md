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

This task implements the most essential missing Rust features:

1. **Function Modifiers** - Capture function attributes (async, unsafe, const)
2. **Closure Detection** - Identify and track closure expressions
3. **Higher-Order Functions** - Detect functions accepting/returning functions
4. **Function Pointer Types** - Parse and capture `fn()` type syntax
5. **Smart Pointer Detection** - Support Box, Rc, Arc type recognition
6. **Extern Crate Handling** - Improve external dependency import processing

## Acceptance Criteria

- [ ] Function modifiers (`async`, `unsafe`, `const`) captured in SymbolDefinition
- [ ] Closure expressions detected and `is_closure` flag set appropriately
- [ ] Higher-order functions identified with `is_higher_order` flag
- [ ] Function pointer types (`fn(param) -> return`) fully captured in semantic index
- [ ] Smart pointer types (Box, Rc, Arc) detected and tracked properly
- [ ] Extern crate declarations processed with proper aliasing support
- [ ] All related test cases pass
- [ ] No performance regression from new patterns
- [ ] Integration with existing type system maintained

## Implementation Plan

### 1. Function Modifiers

Add tree-sitter queries to capture function attributes:
```rust
async fn process_data() -> Result<()> { }
unsafe fn raw_memory_access() { }
const fn compile_time_compute() -> i32 { }
pub unsafe async fn complex_function() { }
```

### 2. Closure Detection

Identify and mark closure expressions:
```rust
let closure = |x: i32| x + 1;
let async_closure = async |data| process(data).await;
let capturing_closure = |x| x + captured_var;
```

### 3. Higher-Order Functions

Detect functions that accept or return functions:
```rust
fn apply<F>(f: F) -> i32 where F: Fn(i32) -> i32 { }
fn create_handler() -> impl Fn(&str) -> Result<()> { }
fn compose<F, G>(f: F, g: G) -> impl Fn(i32) -> i32
where F: Fn(i32) -> i32, G: Fn(i32) -> i32 { }
```

### 4. Function Pointer Types

Add tree-sitter queries and mappings for:
```rust
type Handler = fn(&str) -> Result<(), Error>;
let callback: fn(i32) -> bool = |x| x > 0;
```

### 5. Smart Pointer Detection

Enhance type recognition for:
```rust
let data: Box<dyn Display> = Box::new(42);
let shared: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(vec![]));
let thread_safe: Arc<Mutex<HashMap<K, V>>> = Arc::new(Mutex::new(HashMap::new()));
```

### 6. Extern Crate Handling

Improve external dependency processing:
```rust
extern crate serde;
extern crate tokio as async_runtime;
```

## Files to Modify

- `packages/types/src/semantic_index.ts` - Add modifier fields to SymbolDefinition
- `src/semantic_index/queries/rust.scm` - Add new query patterns for modifiers
- `src/semantic_index/language_configs/rust_core.ts` - Add capture mappings
- `src/symbol_resolution/function_resolution/function_resolver.ts` - Handle new modifiers
- `src/semantic_index/semantic_index.rust.test.ts` - Add test cases
- Test fixtures - Create comprehensive test cases

## Success Metrics

- Function modifiers correctly captured and accessible in SymbolDefinition
- Closure detection tests pass with `is_closure` flag set
- Higher-order function detection works with `is_higher_order` flag
- Function pointer type tests pass
- Smart pointer detection tests pass
- Extern crate handling tests pass
- Overall Rust test passing rate increases from 74.4% to >85%
- No regression in existing functionality

## Notes

These features are absolutely fundamental to Rust development and appear in virtually every significant Rust codebase. Function modifiers (async, unsafe, const), closures, and higher-order functions are core to idiomatic Rust code. Implementing them will provide immediate value for real-world Rust analysis and ensure compatibility with the symbol resolution system.