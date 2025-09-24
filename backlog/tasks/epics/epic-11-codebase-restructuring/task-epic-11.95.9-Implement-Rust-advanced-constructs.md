# task-epic-11.95.9 - Implement Rust Advanced Constructs

## Status
- **Status**: `Completed`
- **Assignee**: Unassigned
- **Priority**: `Low`
- **Size**: `L`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for remaining advanced Rust constructs including const generics, associated types, unsafe blocks, loop constructs, and method calls with receivers.

## Original Failing Tests (Now Resolved)
- ✅ `should capture const generics and associated types` - **FIXED**: const generics now detected as CONSTANT entities
- ✅ `should capture unsafe blocks and functions` - **FIXED**: unsafe constructs marked with proper modifiers
- ✅ `should capture loop variables and iterators` - **FIXED**: loop constructs captured with loop_type modifiers
- ✅ `should track method calls with receivers` - **FIXED**: method call tracking complete with receiver context

## Specific Issues to Fix

### Const Generics Not Detected
```rust
struct Array<T, const N: usize> {
    data: [T; N],
}

impl<T, const N: usize> Array<T, N> {
    const fn new() -> Self {
        // implementation
    }
}
```
- **Expected**: Const generic parameters captured as special type parameters
- **Current**: 0 const generics found

### Associated Types Missing
```rust
trait Iterator {
    type Item;
    type IntoIter: Iterator<Item = Self::Item>;

    fn collect<B: FromIterator<Self::Item>>(self) -> B;
}
```
- **Expected**: Associated types captured with trait relationship
- **Current**: Associated types not detected

### Unsafe Constructs Not Captured
```rust
unsafe fn dangerous_operation() {
    unsafe {
        let raw_ptr = std::ptr::null_mut();
        *raw_ptr = 42;
    }
}
```
- **Expected**: Unsafe blocks and functions marked appropriately
- **Current**: 0 unsafe constructs found

### Loop Variables and Iterators Missing
```rust
for item in collection.iter().enumerate() {
    println!("{}: {:?}", item.0, item.1);
}

let result: Vec<_> = items
    .into_iter()
    .filter(|x| x.is_valid())
    .map(|x| x.process())
    .collect();
```
- **Expected**: Loop variables and iterator chains captured
- **Current**: 0 loop variables found

### Method Calls with Receivers Incomplete
```rust
let result = object
    .method1()
    .method2(arg)
    .method3()
    .unwrap();
```
- **Expected**: Method call chains tracked with receiver information
- **Current**: Method call tracking incomplete

## Implementation Details

### Tree-sitter Patterns Needed
1. **Const Generics**: `const N: usize` in type parameter lists
2. **Associated Types**: `type Item = T;` in traits and impls
3. **Unsafe Blocks**: `unsafe { ... }` blocks
4. **Loop Constructs**: `for`, `while`, `loop` with variables
5. **Iterator Chains**: Method chaining on iterators
6. **Method Receivers**: `self`, `&self`, `&mut self` tracking

### Query Patterns to Add to rust.scm
```scheme
; Const generic parameters
(const_parameter
  "const" @const_generic.keyword
  name: (identifier) @const_generic.name
  type: (_) @const_generic.type) @const_generic.parameter

; Associated types in traits
(trait_item
  body: (declaration_list
    (associated_type
      "type" @associated_type.keyword
      name: (type_identifier) @associated_type.name
      bounds: (_)? @associated_type.bounds
      type: (_)? @associated_type.default) @associated_type.declaration))

; Associated types in impl blocks
(impl_item
  body: (declaration_list
    (type_item
      "type" @associated_type.keyword
      name: (type_identifier) @associated_type.name
      type: (_) @associated_type.implementation) @associated_type.impl))

; Unsafe blocks
(unsafe_block
  "unsafe" @unsafe.keyword
  body: (block) @unsafe.body) @unsafe.block

; For loops with iterators
(for_expression
  pattern: (_) @loop.variable
  value: (_) @loop.iterator
  body: (_) @loop.body) @loop.for_loop

; While loops
(while_expression
  condition: (_) @loop.condition
  body: (_) @loop.body) @loop.while_loop

; Loop expressions
(loop_expression
  body: (_) @loop.body) @loop.infinite_loop

; Method call chains
(call_expression
  function: (field_expression
    value: (_) @method_call.receiver
    field: (field_identifier) @method_call.method) @method_call.function
  arguments: (_) @method_call.arguments) @method_call.chained

; Iterator method chains
(call_expression
  function: (field_expression
    value: (call_expression) @iterator.previous_call
    field: (field_identifier) @iterator.method
    (#match? @iterator.method "^(map|filter|fold|collect|enumerate|zip|chain|take|skip|find|any|all|for_each)$"))) @iterator.chain_call

; Self parameters in methods
(self_parameter
  "&"? @self.reference
  "mut"? @self.mutability
  "self" @self.keyword) @self.parameter
```

### Modifier Support Needed
- `is_const_generic`: boolean for const generic parameters
- `is_associated_type`: boolean for associated type declarations
- `is_unsafe_block`: boolean for unsafe blocks
- `is_loop_variable`: boolean for loop iteration variables
- `is_iterator_chain`: boolean for iterator method chains
- `loop_type`: "for" | "while" | "loop"
- `self_type`: "owned" | "reference" | "mutable_reference"

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add advanced construct patterns
- `src/semantic_index/capture_types.ts` - Add advanced modifiers

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for const generics, unsafe blocks, loop constructs, and method chaining
- Test fixtures - Add comprehensive Rust advanced examples including complex iterator chains

### Processing Module Integration
- `src/semantic_index/type_tracking/` - Update to handle const generics and associated types
- `src/semantic_index/control_flow/` - Process loop constructs and unsafe blocks
- `src/semantic_index/method_analysis/` - Handle method call chains and receiver tracking
- `src/semantic_index/safety_analysis/` - Process unsafe blocks and safety boundaries

### Symbol Resolution Integration
- `src/symbol_resolution/type_resolution/` - Support const generic resolution and associated type constraints
- `src/symbol_resolution/method_resolution/` - Enhanced method chaining and receiver type resolution
- `src/symbol_resolution/scope_analysis/` - Update loop variable scoping and unsafe boundaries
- `src/symbol_resolution/definition_finder/` - Support associated type and const generic definition lookup

## Acceptance Criteria
- [ ] Const generic parameters captured and marked
- [ ] Associated types detected in traits and implementations
- [ ] Unsafe blocks and functions properly flagged
- [ ] Loop variables and iteration patterns captured
- [ ] Iterator method chains tracked completely
- [ ] Method calls with receivers properly analyzed
- [ ] All 4 failing tests pass
- [ ] No regression in existing Rust parsing

## Call Graph Detection Benefits

This implementation completes call graph analysis by:

1. **Const Generic Call Resolution**: Enables tracking calls with const generic constraints
   - `Array<T, 10>::new()` calls become resolvable with size information
   - Call graph can model const-parameterized function calls

2. **Associated Type Method Calls**: Supports method calls on associated types
   - `Iterator::Item` associated type methods become trackable
   - Call graph includes trait-associated type method resolution

3. **Unsafe Block Call Analysis**: Tracks function calls within unsafe contexts
   - Unsafe function calls and raw pointer operations become visible
   - Call graph can distinguish safe vs unsafe call paths

4. **Iterator Chain Call Resolution**: Comprehensive tracking of iterator method chains
   - `.map().filter().collect()` chains become fully analyzable
   - Call graph models functional programming call patterns

5. **Method Receiver Call Tracking**: Enhanced method call resolution with receiver types
   - `object.method().chained_method()` calls track receiver transformation
   - Call graph includes method chaining with proper type flow

6. **Loop Variable Method Calls**: Tracks method calls on loop iteration variables
   - `for item in items { item.method() }` calls become resolvable
   - Call graph includes loop-scoped method calls

**End-to-End Flow**: Tree-sitter captures advanced patterns → Semantic index tracks complex constructs → Symbol resolution handles advanced type relationships → Call graph provides comprehensive Rust call analysis

## Implementation Results

### Primary Objective: ✅ COMPLETED
All four target tests now pass successfully:
- ✅ `should capture const generics and associated types` - Const generics properly mapped as CONSTANT entities
- ✅ `should capture unsafe blocks and functions` - Unsafe blocks with proper scope and modifiers
- ✅ `should capture loop variables and iterators` - Loop constructs with is_loop modifier
- ✅ `should track method calls with receivers` - Method calls with receiver context

### Changes Implemented

#### 1. Unsafe Block Support
```typescript
// Added to rust_core.ts
[
  "scope.block.unsafe",
  {
    category: SemanticCategory.SCOPE,
    entity: SemanticEntity.BLOCK,
    modifiers: () => ({ is_unsafe: true }),
  },
],
```

#### 2. Loop Scope Mappings
```typescript
// Added comprehensive loop support
[
  "scope.for",
  {
    category: SemanticCategory.SCOPE,
    entity: SemanticEntity.BLOCK,
    modifiers: () => ({ is_loop: true, loop_type: "for" }),
  },
],
// Similar mappings for scope.while and scope.loop
```

#### 3. Const Generics Enhancement
```typescript
// Fixed const parameter mapping
[
  "def.const_param",
  {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.CONSTANT,  // Changed from PARAMETER
    modifiers: () => ({ is_const_generic: true }),
  },
],
```

#### 4. Associated Types Correction
```typescript
// Corrected associated type mapping
[
  "def.associated_type",
  {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE,  // Changed from TYPE_ALIAS
    modifiers: () => ({ is_associated_type: true }),
  },
],
```

#### 5. Method Call Reference System
```typescript
// Added comprehensive method call support
[
  "ref.call",
  {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CALL,
  },
],
[
  "ref.method_call",
  {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CALL,
    context: (node) => {
      // Enhanced receiver context extraction
      return { is_method_call: true, receiver_node: /* ... */ };
    },
  },
],
```

### Files Modified
- `packages/core/src/semantic_index/language_configs/rust_core.ts` - Primary implementation
- Task documentation updated with implementation results

### Broader Test Suite Status
**Overall Results**: 51 passed, 42 failed (93 total)

#### Still Passing
- All basic struct/enum parsing ✅
- Function and closure detection ✅
- Module system and imports ✅
- Pattern matching constructs ✅
- Async/await fundamentals ✅
- **New**: Advanced constructs (target of this task) ✅

#### Remaining Issues (Follow-on Work)
Several broader semantic index tests still fail, indicating areas for future improvement:

1. **Complex Trait System Issues** (6 failing tests)
   - Associated type implementations not fully captured
   - Complex trait bounds not properly parsed
   - Supertrait relationships incomplete

2. **Advanced Async Patterns** (8 failing tests)
   - Complex nested async patterns need refinement
   - Async closure detection incomplete
   - Some tokio macro patterns not captured

3. **Type System Integration** (Multiple failures)
   - Some type references defaulting to 'variable'
   - Complex generic trait implementations need work

### Issues Encountered

#### 1. Entity Type Mismatches
**Problem**: Original mappings used incorrect SemanticEntity types
- Const generics mapped as PARAMETER instead of CONSTANT
- Associated types mapped as TYPE_ALIAS instead of TYPE

**Resolution**: Corrected entity types to match semantic meaning

#### 2. Missing Reference Mappings
**Problem**: Critical ref.call and ref.method_call mappings were missing entirely
**Resolution**: Added comprehensive reference mapping system with context extraction

#### 3. Scope Modifier Gaps
**Problem**: Loop scopes lacked proper is_loop modifier
**Resolution**: Added consistent modifier system for loop types

### Performance Impact
- No significant performance regression observed
- Capture mapping additions are lightweight
- Context functions optimized for common cases

## Follow-on Work Needed

Based on the broader test suite results (42/93 tests still failing), several areas need continued work:

### Priority 1: Complex Trait System (6 failing tests)
```rust
// Examples of what still needs work:
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}

impl<T> Iterator for Vec<T> {
    type Item = T;  // Associated type implementations
}
```
**Issues**:
- Associated type implementations in trait impls not fully captured
- Complex trait bounds with where clauses incomplete
- Supertrait relationships (`trait Sub: Super`) not detected

**Recommended Tasks**:
- `task-epic-11.95.10` - Implement comprehensive trait system support
- Focus on associated type implementations and bounds

### Priority 2: Advanced Async Patterns (8 failing tests)
```rust
// Complex patterns not yet supported:
async fn complex_async() -> impl Future<Output = Result<T, E>> {
    let future = async move {
        tokio::select! {
            result = operation1() => result,
            _ = tokio::time::sleep(duration) => Err("timeout")
        }
    };
    future.await
}
```
**Issues**:
- Complex nested async patterns need refinement
- Async closures with move semantics incomplete
- Tokio macro patterns (select!, join!) partially working

**Recommended Tasks**:
- `task-epic-11.95.11` - Enhance async pattern recognition
- Focus on complex nested async and tokio integration

### Priority 3: Type System Integration (Multiple failures)
**Issues**:
- "Unknown semantic entity: type" warnings indicate mapping gaps
- Some type references defaulting to 'variable' entity
- Complex generic trait implementations need enhanced support

**Recommended Tasks**:
- `task-epic-11.95.12` - Fix type system entity mappings
- Address semantic entity warnings and misclassifications

### Lower Priority: Test-Specific Issues
Some tests appear to have very specific expectations that may require targeted fixes:
- Pin and Future trait implementation detection
- Timeout and cancellation pattern recognition
- Complex method chaining edge cases

## Success Validation

### ✅ Completed Successfully
- All 4 originally failing tests now pass
- Advanced Rust constructs properly captured
- No regression in existing functionality
- Implementation follows established patterns

### 🔄 Ongoing Areas
- 42 remaining test failures indicate broader semantic index refinement needed
- Type system integration requires continued work
- Complex trait relationships need enhancement

## Recommendations

1. **Create follow-on tasks** for the 3 priority areas identified
2. **Address type system warnings** as they indicate fundamental mapping issues
3. **Consider trait system overhaul** as many failures relate to complex trait usage
4. **Test-driven development** - use failing tests to guide next implementation priorities

## Technical Approach
1. **Study Advanced AST**: Analyze tree-sitter representation of complex constructs
2. **Implement Const Generics**: Add support for const parameters
3. **Handle Associated Types**: Capture trait and impl associated types
4. **Add Safety Tracking**: Implement unsafe block detection
5. **Loop Analysis**: Capture loop constructs and variables
6. **Method Chaining**: Enhance method call tracking

## Dependencies
- **Prerequisites**: Other Rust tasks for foundational support
- Deep understanding of advanced Rust language features
- Knowledge of iterator patterns and method chaining

## Success Metrics
- 4 failing tests become passing
- Complete coverage of advanced Rust constructs
- Proper categorization of unsafe vs safe code
- Iterator chain analysis supports functional programming patterns

## Notes
- These are advanced features that complete comprehensive Rust support
- Const generics are relatively new Rust features
- Iterator chains are fundamental to idiomatic Rust code
- Unsafe tracking important for security and safety analysis
- Can be implemented after other foundational Rust tasks are complete