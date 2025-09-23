# task-epic-11.95.8 - Implement Rust Functions and Closures

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `M`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for Rust function definitions and closure expressions, including generic functions and closure parameter detection.

## Current Failing Tests
- `should parse function definitions` - generic functions not detected
- `should parse closures` - closure parameters not captured

## Specific Issues to Fix

### Generic Functions Not Detected
```rust
fn swap<T>(a: &mut T, b: &mut T) {
    std::mem::swap(a, b);
}

fn process_items<T, F>(items: Vec<T>, processor: F)
where
    F: Fn(T) -> T
{
    // implementation
}
```
- **Expected**: Function `swap` should have `is_generic: true` modifier
- **Current**: Generic functions not marked as generic

### Closure Parameters Missing
```rust
let closure = |x: i32, y: i32| x + y;
let processor = |item| item.to_string();
let async_closure = async |data| process(data).await;
```
- **Expected**: Closure parameters captured as PARAMETER entities with `is_closure_param: true`
- **Current**: 0 closure parameters found

### Missing Function Constructs
- Higher-order functions not analyzed
- Function pointers and trait objects missing
- Method syntax vs function syntax distinction
- Const functions and unsafe functions

## Implementation Details

### Tree-sitter Patterns Needed
1. **Generic Functions**: Functions with type parameters
2. **Closure Expressions**: `|args| body` syntax
3. **Closure Parameters**: Parameter lists in closures
4. **Function Pointers**: `fn(T) -> U` types
5. **Trait Objects**: `dyn Fn(T) -> U` types
6. **Const Functions**: `const fn name() { ... }`
7. **Unsafe Functions**: `unsafe fn name() { ... }`

### Query Patterns to Add to rust.scm
```scheme
; Generic functions (already handled in 11.95.1, but ensure detection)
(function_item
  name: (identifier) @function.name
  type_parameters: (type_parameters) @function.generic_params
  body: (_) @function.body) @function.generic_definition

; Closure expressions
(closure_expression
  parameters: (closure_parameters) @closure.params
  body: (_) @closure.body) @closure.definition

; Closure parameters
(closure_parameters
  (closure_parameter
    pattern: (identifier) @parameter.name
    type: (_)? @parameter.type) @parameter.closure_param)

; Simple closure parameters (no types)
(closure_parameters
  (identifier) @parameter.name) @parameter.closure_param

; Function pointer types
(function_type
  "fn" @type.function_keyword
  parameters: (parameters) @type.function_params
  return_type: (_)? @type.function_return) @type.function_pointer

; Trait object function types
(trait_object
  "dyn" @type.dyn_keyword
  type: (type_identifier) @type.trait_name
  (#match? @type.trait_name "^(Fn|FnMut|FnOnce)$")) @type.function_trait_object

; Const functions
(function_item
  "const" @function.const_modifier
  name: (identifier) @function.name
  body: (_) @function.body) @function.const_definition

; Unsafe functions
(function_item
  "unsafe" @function.unsafe_modifier
  name: (identifier) @function.name
  body: (_) @function.body) @function.unsafe_definition

; Higher-order function calls
(call_expression
  function: (field_expression
    value: (_) @call.receiver
    field: (field_identifier) @call.method
    (#match? @call.method "^(map|filter|fold|for_each|find|any|all)$"))) @call.higher_order
```

### Modifier Support Needed
- `is_closure`: boolean for closure expressions
- `is_closure_param`: boolean for closure parameters
- `is_higher_order`: boolean for higher-order function calls
- `is_const`: boolean for const functions
- `is_unsafe`: boolean for unsafe functions
- `closure_type`: "sync" | "async" | "move"
- `function_traits`: list of implemented function traits (Fn, FnMut, FnOnce)

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add function/closure patterns
- `src/semantic_index/capture_types.ts` - Add function modifiers

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for generic functions and closure parameters
- Test fixtures - Add comprehensive Rust function examples including closures and higher-order functions

### Processing Module Integration
- `src/semantic_index/function_analysis/` - Update to handle closure expressions and generic function metadata
- `src/semantic_index/symbol_extraction/` - Ensure closure parameters are properly extracted
- `src/semantic_index/type_tracking/` - Handle function pointer types and closure types

### Symbol Resolution Integration
- `src/symbol_resolution/function_resolution/` - Support closure resolution and higher-order function calls
- `src/symbol_resolution/type_resolution/` - Handle function trait bounds (Fn, FnMut, FnOnce)
- `src/symbol_resolution/scope_analysis/` - Update closure capture scoping and parameter binding
- `src/symbol_resolution/method_resolution/` - Enable method calls on function traits and closures

## Acceptance Criteria
- [ ] Generic functions properly marked with `is_generic: true`
- [ ] Closure expressions captured as function-like entities
- [ ] Closure parameters detected with `is_closure_param: true`
- [ ] Function pointers and trait objects identified
- [ ] Const and unsafe functions properly flagged
- [ ] Higher-order function patterns detected
- [ ] Both failing tests pass
- [ ] No regression in existing Rust parsing

## Call Graph Detection Benefits

This implementation enhances call graph analysis by:

1. **Closure Call Tracking**: Enables tracking calls to and through closures
   - `closure(args)` calls become resolvable to closure definitions
   - Call graph can model closure-based call patterns

2. **Higher-Order Function Analysis**: Supports tracking calls in functional programming patterns
   - `items.map(|x| x.method())` chains become analyzable
   - Call graph includes function calls within closure arguments

3. **Generic Function Call Resolution**: Handles calls to generic functions with type inference
   - `swap(&mut a, &mut b)` calls become trackable across generic instantiations
   - Call graph supports generic function call resolution

4. **Function Trait Method Calls**: Tracks method calls on function trait objects
   - `fn_trait.call(args)` calls become resolvable
   - Enables call graph construction for dynamic function dispatch

5. **Closure Capture Call Analysis**: Handles calls on captured variables within closures
   - Variables captured in closures maintain their callable properties
   - Call graph tracks method calls on captured data

6. **Iterator Chain Call Resolution**: Foundation for tracking calls in iterator patterns
   - `.map().filter().collect()` chains with closure calls become fully analyzable
   - Enables comprehensive call analysis for functional Rust patterns

**End-to-End Flow**: Tree-sitter captures function/closure patterns → Semantic index tracks closures and parameters → Symbol resolution handles closure scopes → Call graph tracks closure calls and higher-order function patterns

## Technical Approach
1. **Study Function AST**: Analyze tree-sitter representation of function constructs
2. **Implement Generics**: Ensure generic function detection works (coordinate with 11.95.1)
3. **Add Closures**: Capture closure expressions and parameters
4. **Handle Modifiers**: Implement const/unsafe function detection
5. **Function Types**: Add support for function pointers and trait objects

## Dependencies
- **Prerequisite**: task-epic-11.95.1 (generic support for generic functions)
- Understanding of Rust function system and closure semantics
- Knowledge of function traits (Fn, FnMut, FnOnce)

## Success Metrics
- 2 failing tests become passing
- Complete function and closure ecosystem captured
- Generic function detection integrated with generic type system
- Higher-order function patterns properly identified

## Notes
- Closures are fundamental to functional programming patterns in Rust
- Function traits integration important for type system analysis
- Consider interaction with async system for async closures
- Higher-order functions common in iterator chains and need special handling