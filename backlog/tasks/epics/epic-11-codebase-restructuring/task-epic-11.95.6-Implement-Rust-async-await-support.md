# task-epic-11.95.6 - Implement Rust Async/Await Support

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `M`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for Rust async/await constructs including async functions, async blocks, and await expressions.

## Current Failing Tests
- `should capture async functions and blocks` - async constructs not captured
- `should capture try expressions and await` - await expressions missing

## Specific Issues to Fix

### Async Functions Not Detected
```rust
async fn fetch_data() -> Result<String, Error> {
    let response = client.get("/data").await?;
    Ok(response.text().await?)
}
```
- **Expected**: Async functions marked with `is_async: true`
- **Current**: 0 async functions found

### Async Blocks Missing
```rust
let future = async {
    let data = fetch_data().await;
    process(data)
};
```
- **Expected**: Async blocks captured as async scope constructs
- **Current**: Async blocks not detected

### Await Expressions Not Captured
```rust
let result = some_future.await;
let value = complex_async_call().await?;
```
- **Expected**: Await expressions captured with target information
- **Current**: 0 await expressions found

## Implementation Details

### Tree-sitter Patterns Needed
1. **Async Functions**: `async fn name() { ... }`
2. **Async Blocks**: `async { ... }` and `async move { ... }`
3. **Await Expressions**: `expr.await`
4. **Try Expressions**: `expr?` (error propagation)
5. **Async Closures**: `async |args| { ... }`
6. **Future Types**: Return types containing Future traits

### Query Patterns to Add to rust.scm
```scheme
; Async functions
(function_item
  "async" @function.async_modifier
  name: (identifier) @function.name
  body: (_) @function.body) @function.async_definition

; Async blocks
(async_block
  "async" @block.async_modifier
  body: (block) @block.body) @block.async

; Async move blocks
(async_block
  "async" @block.async_modifier
  "move" @block.move_modifier
  body: (block) @block.body) @block.async_move

; Await expressions
(await_expression
  value: (_) @await.target
  "." @await.operator
  "await" @await.keyword) @await.expression

; Try expressions (error propagation)
(try_expression
  value: (_) @try.target
  "?" @try.operator) @try.expression

; Async closures
(closure_expression
  "async" @closure.async_modifier
  parameters: (_) @closure.params
  body: (_) @closure.body) @closure.async

; Future return types
(function_item
  return_type: (type_identifier) @function.return_type
  (#match? @function.return_type "Future|Pin|Box<.*Future.*>"))
```

### Modifier Support Needed
- `is_async`: boolean for async functions/blocks/closures
- `is_move`: boolean for move closures/blocks
- `is_await`: boolean for await expressions
- `is_try`: boolean for try expressions (error propagation)
- `await_target`: expression being awaited
- `future_type`: specific Future type information

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add async/await patterns
- `src/semantic_index/capture_types.ts` - Add async modifiers

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for async functions, blocks, and await expressions
- Test fixtures - Add comprehensive Rust async examples including complex async patterns

### Processing Module Integration
- `src/semantic_index/control_flow/` - Update to handle async control flow patterns
- `src/semantic_index/function_analysis/` - Process async function metadata
- `src/semantic_index/expression_analysis/` - Handle await and try expressions

### Symbol Resolution Integration
- `src/symbol_resolution/function_resolution/` - Support async function resolution and Future return types
- `src/symbol_resolution/method_resolution/` - Enable method calls on Future types and await expressions
- `src/symbol_resolution/type_resolution/` - Handle Future trait bounds and async type inference
- `src/symbol_resolution/control_flow/` - Track async control flow and await points

## Acceptance Criteria
- [ ] Async functions marked with `is_async: true`
- [ ] Async blocks captured as async scope constructs
- [ ] Await expressions detected with target information
- [ ] Try expressions (?) captured for error propagation
- [ ] Async move blocks distinguished from regular async blocks
- [ ] Async closures properly identified
- [ ] Both failing tests pass
- [ ] No regression in existing Rust parsing

## Call Graph Detection Benefits

This implementation enhances call graph analysis by:

1. **Async Function Call Tracking**: Enables tracking calls to and from async functions
   - `async fn handler()` calls become trackable in async contexts
   - Call graph can model async function call chains

2. **Await Point Call Resolution**: Supports method calls on awaited values
   - `future.await.method()` call chains become resolvable
   - Call graph tracks method calls after async resolution

3. **Future Method Call Analysis**: Handles method calls on Future types
   - Future trait methods like `.map()`, `.then()` become trackable
   - Enables call graph construction for async combinator patterns

4. **Try Operator Call Propagation**: Tracks function calls in error propagation chains
   - `async_call().await?.method()` chains become analyzable
   - Call graph includes error-path function calls

5. **Async Block Call Isolation**: Handles calls within async block scopes
   - Function calls inside `async { }` blocks are properly scoped
   - Call graph maintains async boundary information

6. **Cross-Async-Context Calls**: Foundation for tracking calls across async boundaries
   - Calls from sync to async contexts and vice versa become trackable
   - Enables comprehensive call analysis for mixed sync/async codebases

**End-to-End Flow**: Tree-sitter captures async patterns → Semantic index tracks async constructs → Symbol resolution handles Future types → Call graph tracks async function calls and await points

## Technical Approach
1. **Study Async AST**: Analyze tree-sitter representation of async constructs
2. **Implement Functions**: Start with basic async function detection
3. **Add Blocks**: Capture async blocks and async move blocks
4. **Handle Await**: Implement await expression tracking
5. **Error Propagation**: Add try expression (?) support

## Dependencies
- Understanding of Rust async/await system and Future trait
- Knowledge of async runtime ecosystem (tokio, async-std, etc.)
- Tree-sitter patterns for modifier and expression matching

## Success Metrics
- 2 failing tests become passing
- Complete async construct detection across functions, blocks, closures
- Proper tracking of await points for async analysis
- Error propagation patterns (?) correctly captured

## Notes
- Async/await is crucial for modern Rust concurrency analysis
- Consider integration with method resolution for Future trait methods
- Try expressions (?) are important for error handling flow analysis
- May need to handle complex nested async patterns