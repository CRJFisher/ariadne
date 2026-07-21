# task-epic-11.95.1 - Implement Rust Generics and Lifetimes

## Status
- **Status**: `Completed`
- **Assignee**: Assistant
- **Priority**: `High`
- **Size**: `L`
- **Parent**: task-epic-11.95
- **Completed**: 2025-01-15

## Description
Implement tree-sitter query patterns for Rust generics and lifetime annotations. This is foundational for other Rust features and should be implemented first.

## Current Failing Tests
- `should parse generic types and constraints` - generic structs not marked with `is_generic`
- `should parse lifetime annotations` - lifetime parameters not captured

## Specific Issues to Fix

### Generic Types Not Detected
```rust
struct Stack<T> {
    items: Vec<T>,
}
```
- **Expected**: Struct `Stack` should have `is_generic: true` modifier
- **Current**: Generic structs not detected or marked

### Lifetime Parameters Missing
```rust
struct BorrowedData<'a> {
    data: &'a str,
}
```
- **Expected**: Lifetime `'a` captured as TYPE_PARAMETER entity with `is_lifetime: true`
- **Current**: 0 lifetime parameters found

## Implementation Details

### Tree-sitter Patterns Needed
1. **Generic Type Parameters**: `<T, U, V>` in struct/enum/function definitions
2. **Lifetime Parameters**: `<'a, 'b>` annotations
3. **Generic Constraints**: `where T: Clone + Debug`
4. **Lifetime Bounds**: `where T: 'a`
5. **Associated Types**: `type Item = T;`

### Query Patterns to Add to rust.scm
```scheme
; Generic type parameters
(type_parameters
  (type_identifier) @type_parameter.name) @type_parameter.definition

; Lifetime parameters
(lifetime_parameters
  (lifetime) @type_parameter.name) @type_parameter.definition

; Generic structs/enums
(struct_item
  name: (type_identifier) @class.name
  type_parameters: (type_parameters) @class.generic_params) @class.definition

; Generic functions
(function_item
  name: (identifier) @function.name
  type_parameters: (type_parameters) @function.generic_params) @function.definition

; Where clauses
(where_clause
  (where_predicate) @constraint.definition)
```

### Modifier Support Needed
- `is_generic`: boolean flag for generic types/functions
- `is_lifetime`: boolean flag for lifetime parameters
- `generic_params`: list of type parameter names
- `constraints`: where clause information

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add generic/lifetime patterns
- `src/semantic_index/capture_types.ts` - Add new modifiers if needed

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for generic and lifetime detection
- Test fixtures - Add comprehensive Rust examples with generics and lifetimes

### Processing Module Integration
- `src/semantic_index/type_tracking/` - Update type processing to handle generic markers
- `src/semantic_index/symbol_extraction/` - Ensure generic symbols are properly extracted

### Symbol Resolution Integration
- `src/symbol_resolution/definition_finder/` - Update to resolve generic type parameters
- `src/symbol_resolution/type_resolution/` - Handle generic type instantiation
- `src/symbol_resolution/scope_analysis/` - Update scope tracking for generic contexts

## Acceptance Criteria
- [x] Generic structs are marked with `is_generic: true`
- [x] Generic functions detected and marked appropriately
- [x] Lifetime parameters captured as TYPE_PARAMETER entities
- [x] Lifetime parameters have `is_lifetime: true` modifier
- [x] Where clauses and constraints are captured
- [x] Both failing tests pass
- [x] No regression in existing Rust parsing

## Implementation Results

### ✅ Successfully Completed
Successfully implemented comprehensive Rust generics and lifetimes support in the semantic index.

### 🧪 Test Results
**Target Tests - Both Now Passing:**
- ✅ `should parse generic types and constraints` - **PASSING**
- ✅ `should parse lifetime annotations` - **PASSING**

**Overall Test Suite Status:**
- 11/28 tests passing (39% pass rate)
- 17 tests still failing (unrelated to this task's scope)
- No regressions introduced - all previously passing tests remain passing

### 📁 Files Modified

**Core Implementation:**
- `packages/core/src/semantic_index/queries/rust.scm` - Added/improved query patterns for:
  - Generic type parameters with proper ordering
  - Lifetime parameters in multiple contexts
  - Where clauses and constraint patterns
  - Generic arguments and trait bounds

- `packages/core/src/semantic_index/language_configs/rust.ts` - Added modifiers and mappings:
  - `is_generic: true` for generic structs, enums, functions
  - `is_lifetime: true` for lifetime parameters
  - Constraint entity mappings for TYPE_CONSTRAINT

### 🔧 Technical Implementation Details

**Generic Type Support:**
- Generic structs: `struct Stack<T>` → marked with `is_generic: true`
- Generic enums: `enum Option<T>` → marked with `is_generic: true`
- Generic functions: `fn swap<T>()` → marked with `is_generic: true`

**Lifetime Parameter Support:**
- Type parameters: `<'a>` → captured as TYPE_PARAMETER with `is_lifetime: true`
- Reference types: `&'a str` → lifetime references captured
- Trait bounds: `T: 'a` → lifetime bounds captured

**Where Clause Support:**
- Where clauses: `where T: Clone` → captured as TYPE_CONSTRAINT
- Type constraints: trait bounds properly mapped
- Lifetime constraints: lifetime bounds in where clauses

### ⚠️ Issues Encountered

**Tree-sitter Query Syntax:**
- Initial patterns used invalid node types (`!type_parameters`, `generic_arguments`)
- Required AST structure analysis to identify correct node types (`type_arguments`)
- Query order matters - more specific patterns must come before general ones

**Entity Mapping:**
- Had to add comprehensive constraint mappings to language config
- Required distinction between lifetime parameters and type parameters

### 🎯 Functional Verification

**Generic Detection Working:**
```rust
// Now properly detected with is_generic: true
struct Stack<T: Clone> { items: Vec<T> }
enum Result<T, E> { Ok(T), Err(E) }
fn swap<T>(a: &mut T, b: &mut T) { ... }
```

**Lifetime Detection Working:**
```rust
// Lifetimes captured as TYPE_PARAMETER with is_lifetime: true
struct Book<'a> { title: &'a str }
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str { ... }
```

**Constraint Detection Working:**
```rust
// Where clauses and bounds captured as TYPE_CONSTRAINT
fn process<T, U>() where T: Display + Clone, U: Debug { ... }
```

## 🔄 Follow-on Work Needed

While this task's specific goals are complete, the Rust test suite reveals additional areas needing attention:

### Remaining Test Failures (17/28)
These failures are outside this task's scope but should be addressed in follow-up work:

**High Priority:**
- Trait method detection: `should parse trait definitions and implementations`
- Method call tracking: `should track method calls with receivers`
- Import resolution: `should parse use statements and imports`

**Medium Priority:**
- Closure parameter capture
- Pattern matching constructs
- Reference/dereference operations
- Visibility modifier handling

**Low Priority:**
- Macro definitions and invocations
- Loop variable tracking
- Unsafe block detection

### Recommended Next Tasks
1. **task-epic-11.95.2**: Fix trait method detection and implementation parsing
2. **task-epic-11.95.3**: Implement method call tracking and receiver resolution
3. **task-epic-11.95.4**: Fix import/export statement parsing

### Architecture Notes
The generics and lifetimes foundation is now solid. Future Rust improvements can build on this implementation without requiring changes to the core generic detection logic.

## Call Graph Detection Benefits

This implementation directly enhances call graph analysis by:

1. **Generic Method Resolution**: Enables proper resolution of method calls on generic types
   - `Vec<T>::push()` calls can be tracked to specific implementations
   - Generic struct methods become trackable in call graphs

2. **Lifetime-Aware Flow Analysis**: Supports tracking of borrowed data flow
   - Method calls on borrowed references can be properly resolved
   - Enables detection of call chains involving lifetime-constrained data

3. **Type Parameter Tracking**: Enables symbol resolution for generic contexts
   - Function calls with generic parameters become resolvable
   - Template instantiation tracking for call graph construction

4. **Cross-Module Generic Calls**: Foundation for tracking generic function calls across files
   - Import resolution can handle generic type imports
   - Call graph can trace generic function calls between modules

**End-to-End Flow**: Tree-sitter captures generic patterns → Semantic index marks generic symbols → Symbol resolution handles generic contexts → Call graph tracks generic method/function calls

## Technical Approach
1. **Study AST Structure**: Use tree-sitter playground to understand Rust generic syntax
2. **Write Queries**: Add patterns to rust.scm for generic constructs
3. **Test Incrementally**: Run specific tests to validate patterns
4. **Add Modifiers**: Implement new modifier support if needed
5. **Validate Coverage**: Ensure all generic patterns are covered

## Dependencies
- Understanding of Rust generic system
- Tree-sitter query syntax for Rust
- Knowledge of semantic capture system

## Success Metrics
- 2 failing tests become passing
- Generic detection works for structs, enums, functions, impl blocks
- Lifetime annotations properly captured across all contexts

## Notes
- ✅ **COMPLETED**: This foundational task is now complete - other features can build on generic support
- ✅ **IMPACT**: Both target tests now pass, providing solid foundation for Rust language support
- ✅ **PERFORMANCE**: Generic patterns perform well with no observed performance degradation

## Summary
This task successfully implemented comprehensive Rust generics and lifetimes support. The two failing tests mentioned in the requirements are now passing:
- `should parse generic types and constraints` ✅
- `should parse lifetime annotations` ✅

The implementation provides a solid foundation for advanced Rust features and call graph analysis of generic code.