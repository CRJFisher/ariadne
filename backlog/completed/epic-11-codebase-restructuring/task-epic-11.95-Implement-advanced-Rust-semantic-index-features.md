# task-epic-11.95 - Implement Advanced Rust Semantic Index Features

## Status
- **Status**: `In Progress`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `XL`

## Description
Implement comprehensive Rust semantic index support for advanced language features. Significant progress made - 87 of 117 Rust tests now passing (up from 85 initially). 30 tests still failing, primarily related to advanced features.

## Current Failing Tests (30 remaining)
### Functions and Closures (1 failure)
- `should parse function pointer types` - function pointer type references not captured

### Modules and Visibility (4 failures)
- `should comprehensively parse all module and visibility features` - extern crates not captured
- `should handle edge cases in module and visibility patterns` - complex import patterns
- `should validate specific module system semantics` - nested re-exports
- `should handle complex edge cases and corner cases` - self imports

### Ownership and References (4 failures)
- `should parse comprehensive ownership patterns` - reference/dereference operators
- `should parse reference types in function signatures` - function parameter references
- `should parse Box smart pointers comprehensively` - Box type detection
- `should parse Rc smart pointers with cloning` - Rc/Arc smart pointer types

### Generics and Associated Types (7 failures)
- Const generics with complex parameters
- Associated types with complex bounds
- Associated types and constants in traits
- Trait implementations with associated types
- Supertrait relationships
- Operator overloading through traits
- Associated type implementations

### Async/Await (14 failures)
- Async closures and complex closure patterns
- Tokio spawn and task creation patterns
- Additional async-related patterns

## Progress Made
- ✅ Basic trait definitions and implementations working
- ✅ Generic functions and types properly detected
- ✅ Import statements and aliased imports working
- ✅ Re-exports and pub use statements fixed
- ✅ Basic lifetime annotations working
- ✅ Pattern matching constructs captured
- ✅ Macro definitions and invocations working
- ✅ Visibility modifiers properly detected
- ✅ Unsafe blocks and functions captured
- ✅ Loop constructs and iterators working

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