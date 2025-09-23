# task-epic-11.95.4 - Implement Rust Pattern Matching

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `M`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for Rust pattern matching constructs including match expressions, pattern destructuring, and control flow patterns.

## Current Failing Tests
- `should parse pattern matching constructs` - match scopes not detected

## Specific Issues to Fix

### Match Expressions Not Detected
```rust
fn pattern_example(value: Option<i32>) {
    match value {
        Some(x) if x > 0 => println!("Positive: {}", x),
        Some(x) => println!("Non-positive: {}", x),
        None => println!("No value"),
    }
}
```
- **Expected**: Match scopes captured with `match_type: "match"` modifier
- **Current**: 0 match scopes found

### Missing Pattern Constructs
- Match arms and guards not captured
- Destructuring patterns not detected
- Pattern variables not identified
- If-let and while-let patterns missing

## Implementation Details

### Tree-sitter Patterns Needed
1. **Match Expressions**: `match expr { ... }`
2. **Match Arms**: Individual pattern => expression pairs
3. **Pattern Guards**: `if condition` in match arms
4. **Destructuring Patterns**: Struct, tuple, enum destructuring
5. **If-let Expressions**: `if let pattern = expr`
6. **While-let Expressions**: `while let pattern = expr`
7. **Pattern Variables**: Variables bound in patterns

### Query Patterns to Add to rust.scm
```scheme
; Match expressions
(match_expression
  value: (_) @match.value
  body: (match_block) @match.body) @match.expression

; Match arms
(match_arm
  pattern: (_) @pattern.definition
  value: (_) @pattern.value) @pattern.match_arm

; Match arms with guards
(match_arm
  pattern: (_) @pattern.definition
  condition: (match_condition) @pattern.guard
  value: (_) @pattern.value) @pattern.guarded_match_arm

; Pattern variables
(identifier_pattern
  (identifier) @variable.pattern) @variable.pattern_binding

; Destructuring patterns
(struct_pattern
  type: (type_identifier) @pattern.type
  (field_pattern
    field_name: (field_identifier) @pattern.field
    pattern: (_) @pattern.field_value)*) @pattern.struct_destructure

; If-let expressions
(if_expression
  condition: (let_condition
    pattern: (_) @pattern.if_let
    value: (_) @pattern.if_let_value)) @control_flow.if_let

; While-let expressions
(while_expression
  condition: (let_condition
    pattern: (_) @pattern.while_let
    value: (_) @pattern.while_let_value)) @control_flow.while_let

; Tuple patterns
(tuple_pattern
  (_) @pattern.tuple_element) @pattern.tuple_destructure
```

### Modifier Support Needed
- `match_type`: "match" | "if_let" | "while_let"
- `has_guard`: boolean for match arms with conditions
- `pattern_type`: "identifier" | "struct" | "tuple" | "enum" | "literal"
- `destructures_type`: type being destructured
- `bound_variables`: list of variables bound by pattern

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add pattern matching patterns
- `src/semantic_index/capture_types.ts` - Add pattern matching modifiers

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for match expressions and pattern destructuring
- Test fixtures - Add comprehensive Rust pattern matching examples including complex match scenarios

### Processing Module Integration
- `src/semantic_index/control_flow/` - Update to handle match expression control flow
- `src/semantic_index/symbol_extraction/` - Ensure pattern-bound variables are properly extracted
- `src/semantic_index/scope_analysis/` - Process pattern scopes and variable bindings

### Symbol Resolution Integration
- `src/symbol_resolution/definition_finder/` - Update to resolve pattern-bound variables
- `src/symbol_resolution/scope_analysis/` - Handle pattern variable scoping and shadowing
- `src/symbol_resolution/type_resolution/` - Support type inference through pattern matching
- `src/symbol_resolution/control_flow/` - Track control flow through match branches

## Acceptance Criteria
- [ ] Match expressions captured with proper scope information
- [ ] Match arms detected with pattern and value components
- [ ] Pattern guards (if conditions) captured
- [ ] Destructuring patterns for structs, tuples, enums detected
- [ ] If-let and while-let expressions captured
- [ ] Pattern-bound variables identified
- [ ] Failing test passes
- [ ] No regression in existing Rust parsing

## Call Graph Detection Benefits

This implementation enhances call graph analysis by:

1. **Branch-Aware Call Tracking**: Enables tracking method calls within match branches
   - Different match arms may call different methods based on pattern
   - Call graph can model conditional call paths through pattern matching

2. **Pattern-Bound Variable Methods**: Supports method calls on pattern-extracted values
   - `if let Some(value) = option { value.method() }` calls become trackable
   - Method resolution works on destructured values

3. **Enum Variant Method Resolution**: Enables calls on specific enum variants
   - Match patterns expose specific enum variant methods
   - Call graph can track variant-specific method calls

4. **Guard Condition Call Analysis**: Tracks function calls within pattern guards
   - Guard expressions may contain function calls that affect control flow
   - Call graph includes guard-based conditional calls

5. **Destructuring Call Chains**: Handles method calls on destructured data
   - Struct field destructuring enables field method calls
   - Tuple destructuring allows element method calls

6. **Control Flow Method Tracking**: Foundation for tracking calls across pattern branches
   - Different match arms create different call graph paths
   - Enables comprehensive call analysis for pattern-based control flow

**End-to-End Flow**: Tree-sitter captures pattern constructs → Semantic index tracks match scopes → Symbol resolution handles pattern bindings → Call graph tracks pattern-conditional method calls

## Technical Approach
1. **Analyze Pattern AST**: Study tree-sitter representation of match constructs
2. **Implement Match Core**: Start with basic match expression detection
3. **Add Pattern Types**: Handle different pattern types (struct, tuple, etc.)
4. **Capture Variables**: Ensure pattern-bound variables are detected
5. **Handle Control Flow**: Implement if-let and while-let patterns

## Dependencies
- Understanding of Rust pattern matching system
- Knowledge of destructuring and binding semantics
- Tree-sitter patterns for complex nested structures

## Success Metrics
- 1 failing test becomes passing
- Match expressions properly scoped and categorized
- All pattern types detected and classified
- Pattern-bound variables correctly identified
- Integration with scope analysis system

## Notes
- Pattern matching is fundamental to Rust control flow
- Pattern variables need to be integrated with scope analysis
- Consider interaction with enum and struct definitions
- Guards and complex patterns may require sophisticated query patterns