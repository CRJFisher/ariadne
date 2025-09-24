# task-151 - Advanced Rust Semantic Features

## Status

- **Status**: `Not Started`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `L`

## Description

Implement advanced Rust semantic features that appear in medium-to-large codebases and specialized use cases. These features provide comprehensive coverage for sophisticated Rust patterns.

## Dependencies

- **Prerequisites**: task-epic-11.96 (High Priority Rust Semantic Features)
- Core Rust semantic features implemented
- Rust test passing rate >80%

## Scope

This task implements remaining Rust semantic features across three priority levels:

### Medium Priority Features
- **Advanced Generics** - Complex const generics, associated type bounds
- **Ownership Operators** - Reference/dereference operator capture (`&`, `*`)
- **Module Edge Cases** - Self imports, complex visibility patterns

### Lower Priority Features
- **Async Tokio Integration** - Pin, Future, async trait patterns
- **Performance Optimization** - Query efficiency improvements
- **Documentation** - Rust semantic index feature documentation

## Acceptance Criteria

### Medium Priority
- [ ] Complex const generics with bounds captured properly
- [ ] Associated type bounds in where clauses processed
- [ ] Reference/dereference operators tracked in expressions
- [ ] Self imports and complex module patterns handled
- [ ] Advanced visibility patterns (pub(crate), pub(super)) working

### Lower Priority
- [ ] Async trait patterns recognized
- [ ] Pin and Future type patterns captured
- [ ] Tokio-specific patterns supported
- [ ] Query performance optimized for large files
- [ ] Rust semantic index documentation completed

## Implementation Plan

### Phase 1: Advanced Generics & Operators
```rust
// Complex const generics
struct Matrix<T, const ROWS: usize, const COLS: usize>
where
    T: Copy + Default,
    [(); ROWS * COLS]:,
{
    data: [T; ROWS * COLS],
}

// Reference operators
let value = *reference;
let ref_value = &mut data;
```

### Phase 2: Module Edge Cases
```rust
// Self imports
use std::fmt::{self, Display, Debug};
use crate::{self as current_crate};

// Complex visibility
pub(in crate::utils) fn internal_helper() {}
```

### Phase 3: Async Integration
```rust
#[async_trait]
trait AsyncProcessor {
    type Item;
    async fn process(&mut self) -> Pin<Box<dyn Future<Output = Self::Item>>>;
}
```

## Files to Modify

- `src/semantic_index/queries/rust.scm` - Extensive query pattern additions
- `src/semantic_index/language_configs/rust_core.ts` - Advanced capture mappings
- `src/semantic_index/semantic_index.rust.test.ts` - Comprehensive test coverage
- Documentation files - Rust feature documentation

## Success Metrics

- All remaining Rust semantic index tests pass (117/117)
- Advanced Rust patterns correctly analyzed
- Performance impact <10% for large files
- Comprehensive documentation available
- Real-world Rust codebases fully supported

## Notes

These features target sophisticated Rust usage patterns. While not universally needed, they're essential for comprehensive analysis of complex Rust projects using async, advanced generics, or intricate module systems.