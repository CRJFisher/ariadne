# task-epic-11.95.3 - Implement Rust Ownership and References

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `M`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for Rust ownership constructs including references, dereferencing, and smart pointer types. These are fundamental to Rust's memory safety system.

## Current Failing Tests
- `should parse references and dereferences` - reference operators not captured
- `should parse smart pointer types` - smart pointer types not detected

## Specific Issues to Fix

### Reference Operators Not Captured
```rust
fn borrow_example() {
    let x = 5;
    let y = &x;      // Reference
    let z = &mut x;  // Mutable reference
    let val = *y;    // Dereference
}
```
- **Expected**: Reference (`&`) and dereference (`*`) operations captured
- **Current**: 0 reference operators found

### Smart Pointer Types Missing
```rust
use std::rc::Rc;
use std::sync::Arc;

struct Data {
    boxed: Box<i32>,
    shared: Rc<String>,
    atomic: Arc<Mutex<i32>>,
}
```
- **Expected**: `Box`, `Rc`, `Arc` types detected with smart pointer metadata
- **Current**: Smart pointer types not recognized

## Implementation Details

### Tree-sitter Patterns Needed
1. **Reference Expressions**: `&expr`, `&mut expr`
2. **Dereference Expressions**: `*expr`
3. **Reference Types**: `&T`, `&mut T`
4. **Smart Pointer Types**: `Box<T>`, `Rc<T>`, `Arc<T>`, `RefCell<T>`
5. **Pointer Method Calls**: `box.as_ref()`, `rc.clone()`

### Query Patterns to Add to rust.scm
```scheme
; Reference expressions
(reference_expression
  "&" @reference.operator
  value: (_) @reference.target) @reference.expression

; Mutable reference expressions
(reference_expression
  "&" @reference.operator
  "mut" @reference.mutability
  value: (_) @reference.target) @reference.expression

; Dereference expressions
(unary_expression
  operator: "*" @dereference.operator
  argument: (_) @dereference.target) @dereference.expression

; Reference types
(reference_type
  "&" @type.reference_modifier
  type: (_) @type.inner) @type.reference

; Smart pointer types
(generic_type
  type: (type_identifier) @type.name
  type_arguments: (type_arguments) @type.args) @type.smart_pointer
  (#match? @type.name "^(Box|Rc|Arc|RefCell|Weak)$")

; Box allocation
(call_expression
  function: (scoped_identifier
    path: (identifier) @box.module
    name: (identifier) @box.function) @box.call
  (#eq? @box.module "Box")
  (#eq? @box.function "new"))
```

### Modifier Support Needed
- `is_reference`: boolean for reference expressions
- `is_mutable_reference`: boolean for mutable references
- `is_dereference`: boolean for dereference operations
- `is_smart_pointer`: boolean for smart pointer types
- `pointer_type`: string indicating type (Box, Rc, Arc, etc.)
- `reference_mutability`: "immutable" | "mutable"

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add ownership patterns
- `src/semantic_index/capture_types.ts` - Add ownership modifiers

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for reference operations and smart pointer detection
- Test fixtures - Add comprehensive Rust ownership examples including complex borrowing scenarios

### Processing Module Integration
- `src/semantic_index/type_tracking/` - Update to handle reference types and smart pointers
- `src/semantic_index/symbol_extraction/` - Ensure reference operations are properly extracted
- `src/semantic_index/expression_analysis/` - Process reference and dereference expressions

### Symbol Resolution Integration
- `src/symbol_resolution/definition_finder/` - Update to resolve through references and smart pointers
- `src/symbol_resolution/type_resolution/` - Handle reference type resolution and smart pointer unwrapping
- `src/symbol_resolution/scope_analysis/` - Update to track borrowed values and ownership transfer
- `src/symbol_resolution/method_resolution/` - Enable method resolution on smart pointer types

## Acceptance Criteria
- [ ] Reference expressions (`&x`, `&mut x`) captured with proper modifiers
- [ ] Dereference expressions (`*x`) captured and marked
- [ ] Reference types (`&T`, `&mut T`) properly identified
- [ ] Smart pointer types (Box, Rc, Arc, RefCell) detected
- [ ] Mutability information preserved for references
- [ ] Both failing tests pass
- [ ] No regression in existing Rust parsing

## Call Graph Detection Benefits

This implementation enhances call graph analysis by:

1. **Reference Chain Tracking**: Enables tracking method calls through borrowed references
   - `borrowed_data.method()` calls can be resolved to original data methods
   - Call graph can follow method chains through reference indirection

2. **Smart Pointer Method Resolution**: Supports method calls on smart pointer types
   - `box.as_ref().method()` calls become trackable through pointer unwrapping
   - Enables call graph construction for smart pointer method chains

3. **Ownership Transfer Analysis**: Tracks function calls that transfer ownership
   - Function calls that consume `Box<T>` or move semantics become analyzable
   - Call graph can model ownership flow between functions

4. **Deref Coercion Tracking**: Handles implicit dereferencing in method calls
   - Smart pointer method calls through deref coercion become resolvable
   - Enables tracking of calls through automatic dereferencing

5. **Mutability-Aware Analysis**: Distinguishes between mutable and immutable method calls
   - Mutable reference method calls can be tracked separately from immutable ones
   - Call graph can model state mutation patterns

6. **Cross-Reference Call Resolution**: Foundation for tracking calls across ownership boundaries
   - Function calls with borrowed parameters become trackable
   - Enables call graph analysis of ownership-safe code patterns

**End-to-End Flow**: Tree-sitter captures ownership patterns → Semantic index tracks references/smart pointers → Symbol resolution handles ownership semantics → Call graph tracks ownership-aware method calls

## Technical Approach
1. **Study Ownership AST**: Analyze tree-sitter representation of ownership constructs
2. **Implement References**: Start with basic reference/dereference patterns
3. **Add Smart Pointers**: Detect common smart pointer types
4. **Handle Mutability**: Ensure mutable vs immutable references are distinguished
5. **Test Scenarios**: Verify complex ownership patterns work

## Dependencies
- Understanding of Rust ownership and borrowing system
- Knowledge of smart pointer ecosystem (std::rc, std::sync, etc.)
- Tree-sitter patterns for expression and type matching

## Success Metrics
- 2 failing tests become passing
- Reference and dereference operations properly tracked
- Smart pointer types detected across standard library types
- Mutability information correctly captured

## Notes
- Ownership tracking is fundamental to understanding Rust code flow
- Consider integration with lifetime analysis (task 11.95.1)
- Smart pointer detection helps with memory pattern analysis
- May need to handle custom smart pointer types in addition to standard ones