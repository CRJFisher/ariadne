# task-epic-11.95 - Implement Advanced Rust Semantic Index Features

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `XL`

## Description
Implement comprehensive Rust semantic index support for advanced language features. Currently 20 of 28 Rust tests are failing due to missing tree-sitter query patterns for Rust-specific constructs.

## Current Failing Tests
### Traits and Generics (2 failures)
- `should parse trait definitions and implementations` - trait methods not detected
- `should parse generic types and constraints` - generic structs not marked with `is_generic`

### Functions and Closures (2 failures)
- `should parse function definitions` - generic functions not detected
- `should parse closures` - closure parameters not captured

### Modules and Visibility (2 failures)
- `should parse use statements and imports` - "Display" import not found
- `should parse re-exports and pub use statements` - pub use captures missing

### Ownership and Pattern Matching (3 failures)
- `should parse lifetime annotations` - lifetime parameters not captured
- `should parse pattern matching constructs` - match scopes not detected
- `should parse references and dereferences` - reference operators not captured

### Advanced Features (10 failures)
- Smart pointer types not detected
- Method calls with receivers missing
- Async functions and blocks not captured
- Const generics and associated types missing
- Macro definitions and invocations not found
- Extern crate declarations missing
- Try expressions and await not captured
- Visibility modifiers not detected
- Unsafe blocks and functions missing
- Loop variables and iterators not captured

### Type System Integration (1 failure)
- `should build type registry with Rust types` - method members not properly registered

## Root Cause Analysis
The failures indicate missing tree-sitter query patterns in `src/semantic_index/queries/rust.scm` for:

1. **Trait System**: trait definitions, implementations, associated types
2. **Generics & Lifetimes**: lifetime parameters, generic constraints, where clauses
3. **Pattern Matching**: match expressions, pattern destructuring
4. **Ownership**: references (&), dereferencing (*), smart pointers (Box, Rc, Arc)
5. **Async/Await**: async functions, await expressions, async blocks
6. **Macros**: macro definitions (macro_rules!), macro invocations
7. **Modules**: pub use re-exports, extern crate, visibility modifiers
8. **Safety**: unsafe blocks, unsafe functions
9. **Control Flow**: try expressions (?), loop constructs with iterators

## Acceptance Criteria
- [ ] All 28 Rust semantic index tests pass
- [ ] Trait methods are captured with `is_trait_method` modifier
- [ ] Generic types are marked with `is_generic` modifier
- [ ] Lifetime parameters are captured as TYPE_PARAMETER entities
- [ ] Pattern matching constructs are captured with proper match_type
- [ ] Reference and dereference operations are captured
- [ ] Async/await constructs are properly identified
- [ ] Macro definitions and invocations are captured
- [ ] Visibility modifiers are detected and stored
- [ ] Type registry properly handles Rust type members

## Subtasks

This large task has been broken down into the following subtasks:

### Core Language Features
- **task-epic-11.95.1** - Implement Rust Generics and Lifetimes (Size: L, Priority: High)
- **task-epic-11.95.2** - Implement Rust Trait System (Size: L, Priority: High)
- **task-epic-11.95.8** - Implement Rust Functions and Closures (Size: M, Priority: Medium)

### Ownership & Memory Safety
- **task-epic-11.95.3** - Implement Rust Ownership and References (Size: M, Priority: Medium)
- **task-epic-11.95.4** - Implement Rust Pattern Matching (Size: M, Priority: Medium)

### Module & Code Organization
- **task-epic-11.95.5** - Implement Rust Module and Visibility System (Size: M, Priority: Medium)
- **task-epic-11.95.7** - Implement Rust Macro System (Size: M, Priority: Medium)

### Concurrency & Advanced Features
- **task-epic-11.95.6** - Implement Rust Async/Await Support (Size: M, Priority: Medium)
- **task-epic-11.95.9** - Implement Rust Advanced Constructs (Size: L, Priority: Low)

### Integration & Testing
- **task-epic-11.95.10** - Fix Rust Type System Integration (Size: M, Priority: High)
- **task-epic-11.95.11** - Rust Implementation Integration and Testing (Size: S, Priority: Medium)

## Implementation Order
1. **11.95.1** - Generics and Lifetimes (foundational)
2. **11.95.2** - Trait System (depends on generics)
3. **11.95.10** - Type System Integration (enables method resolution)
4. **11.95.3** - Ownership and References (memory safety)
5. **11.95.4** - Pattern Matching (control flow)
6. **11.95.5** - Module and Visibility (code organization)
7. **11.95.8** - Functions and Closures (functional patterns)
8. **11.95.6** - Async/Await Support (concurrency)
9. **11.95.7** - Macro System (metaprogramming)
10. **11.95.9** - Advanced Constructs (comprehensive coverage)
11. **11.95.11** - Integration and Testing (validation)

## Files to Modify
- `src/semantic_index/queries/rust.scm` - Primary file requiring extensive additions
- `src/semantic_index/capture_types.ts` - May need new modifiers and entity types
- Test fixtures - May need to add more comprehensive Rust examples

## Implementation Strategy
1. **Incremental Development**: Implement one category at a time
2. **Test-Driven**: Focus on making one test pass at a time
3. **AST Analysis**: Use tree-sitter playground to understand Rust AST structure
4. **Reference Implementation**: Look at tree-sitter-rust grammar for guidance

## Dependencies
- Deep understanding of Rust language features
- Tree-sitter query syntax expertise
- Rust AST structure knowledge
- Understanding of semantic capture system

## Success Metrics
- 20 failing tests reduced to 0
- No regression in existing 8 passing tests
- Comprehensive Rust language support matching TypeScript/JavaScript coverage

## Notes
- This is a large task that should be broken into subtasks
- Consider implementing in order of test complexity (basic → advanced)
- Some advanced features may require new entity types or modifiers
- Performance impact should be considered for complex patterns