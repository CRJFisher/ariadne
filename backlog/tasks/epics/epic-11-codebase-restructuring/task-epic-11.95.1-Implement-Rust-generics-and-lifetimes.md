# task-epic-11.95.1 - Implement Rust Generics and Lifetimes

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `High`
- **Size**: `L`
- **Parent**: task-epic-11.95

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
- [ ] Generic structs are marked with `is_generic: true`
- [ ] Generic functions detected and marked appropriately
- [ ] Lifetime parameters captured as TYPE_PARAMETER entities
- [ ] Lifetime parameters have `is_lifetime: true` modifier
- [ ] Where clauses and constraints are captured
- [ ] Both failing tests pass
- [ ] No regression in existing Rust parsing

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
- This task is foundational - other features depend on generic support
- Should be implemented first in the Rust enhancement sequence
- Consider performance impact of complex generic patterns