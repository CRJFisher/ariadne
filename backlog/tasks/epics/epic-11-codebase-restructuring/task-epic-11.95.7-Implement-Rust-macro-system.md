# task-epic-11.95.7 - Implement Rust Macro System

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `M`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for Rust macro system including macro definitions, macro invocations, and procedural macros.

## Current Failing Tests
- `should capture macro definitions and invocations` - macro constructs not found

## Specific Issues to Fix

### Macro Definitions Not Detected
```rust
macro_rules! vec_of_strings {
    ($($x:expr),*) => {
        vec![$($x.to_string()),*]
    };
}

macro_rules! debug_print {
    ($val:expr) => {
        println!("{}: {:?}", stringify!($val), $val);
    };
}
```
- **Expected**: Macro definitions captured with pattern information
- **Current**: 0 macro definitions found

### Macro Invocations Missing
```rust
let names = vec_of_strings!["Alice", "Bob", "Charlie"];
debug_print!(names);
println!("Hello, {}!", name);
```
- **Expected**: Macro invocations captured with macro name and arguments
- **Current**: 0 macro invocations found

### Missing Macro Constructs
- Declarative macros (macro_rules!) not detected
- Procedural macros and attributes missing
- Built-in macros (println!, vec!, etc.) not captured
- Macro pattern matching and repetition not analyzed

## Implementation Details

### Tree-sitter Patterns Needed
1. **Macro Definitions**: `macro_rules! name { ... }`
2. **Macro Invocations**: `macro_name!(args)`
3. **Attribute Macros**: `#[derive(Debug)]`, `#[macro_use]`
4. **Built-in Macros**: `println!`, `vec!`, `panic!`, etc.
5. **Macro Patterns**: Pattern matching within macro definitions
6. **Macro Arguments**: Tokens and expressions passed to macros

### Query Patterns to Add to rust.scm
```scheme
; Macro definitions (declarative)
(macro_definition
  "macro_rules" @macro.keyword
  "!" @macro.exclamation
  name: (identifier) @macro.name
  body: (macro_rule*) @macro.rules) @macro.definition

; Macro rules within definitions
(macro_rule
  left: (token_tree) @macro.pattern
  "=>" @macro.arrow
  right: (token_tree) @macro.replacement) @macro.rule

; Macro invocations
(macro_invocation
  macro: (identifier) @call.macro_name
  "!" @call.exclamation
  token_tree: (_) @call.arguments) @call.macro_invocation

; Built-in macro invocations
(macro_invocation
  macro: (identifier) @call.builtin_macro
  "!" @call.exclamation
  token_tree: (_) @call.arguments) @call.builtin_macro_invocation
  (#match? @call.builtin_macro "^(println|eprintln|print|eprint|vec|panic|assert|debug_assert|format|write|writeln)$")

; Attribute macros
(attribute_item
  "#" @attribute.hash
  "[" @attribute.open
  (attribute) @attribute.content
  "]" @attribute.close) @attribute.macro

; Derive macros
(attribute_item
  (attribute
    (identifier) @derive.name
    arguments: (token_tree
      (identifier) @derive.trait)*) @derive.attribute
  (#eq? @derive.name "derive"))

; Procedural macro usage
(attribute_item
  (attribute
    (scoped_identifier
      path: (identifier) @proc_macro.crate
      name: (identifier) @proc_macro.name)) @proc_macro.attribute)
```

### Modifier Support Needed
- `is_macro_definition`: boolean for macro_rules! definitions
- `is_macro_invocation`: boolean for macro calls
- `is_builtin_macro`: boolean for standard library macros
- `is_procedural_macro`: boolean for proc macros
- `macro_type`: "declarative" | "procedural" | "attribute" | "derive"
- `macro_patterns`: pattern matching rules for declarative macros
- `derive_traits`: list of traits for derive macros

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add macro patterns
- `src/semantic_index/capture_types.ts` - Add macro modifiers

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for macro definitions and invocations
- Test fixtures - Add comprehensive Rust macro examples including declarative and procedural macros

### Processing Module Integration
- `src/semantic_index/macro_analysis/` - Process macro definitions and expansion patterns
- `src/semantic_index/symbol_extraction/` - Ensure macro symbols are properly extracted
- `src/semantic_index/expression_analysis/` - Handle macro invocations as special expressions

### Symbol Resolution Integration
- `src/symbol_resolution/macro_resolution/` - Handle macro name resolution and expansion scoping
- `src/symbol_resolution/definition_finder/` - Support macro definition lookup and hygiene
- `src/symbol_resolution/scope_analysis/` - Update macro scoping rules and hygiene boundaries
- `src/symbol_resolution/import_resolution/` - Handle macro imports and use statements

## Acceptance Criteria
- [ ] Macro definitions (macro_rules!) captured with pattern information
- [ ] Macro invocations detected with name and arguments
- [ ] Built-in macros (println!, vec!, etc.) identified
- [ ] Derive macros and attributes properly captured
- [ ] Procedural macro usage detected
- [ ] Macro pattern matching rules analyzed
- [ ] Failing test passes
- [ ] No regression in existing Rust parsing

## Call Graph Detection Benefits

This implementation enhances call graph analysis by:

1. **Macro-Generated Call Tracking**: Enables tracking calls within macro expansions
   - `println!("Debug: {}", value)` calls become trackable
   - Call graph can model macro-generated function calls

2. **Built-in Macro Call Analysis**: Supports resolution of standard library macro calls
   - `vec![]`, `format!()`, `assert!()` calls become analyzable
   - Enables call graph construction for macro-heavy code

3. **Derive Macro Method Generation**: Tracks method calls on derived trait implementations
   - `#[derive(Debug)]` generates `.fmt()` methods that become trackable
   - Call graph includes auto-generated trait method calls

4. **Procedural Macro Call Resolution**: Handles calls to proc macro generated code
   - Custom derive macros and attribute macros generate callable code
   - Call graph can track proc macro generated function calls

5. **Macro Invocation Call Chains**: Tracks function calls within macro arguments
   - `macro_name!(function_call())` patterns become analyzable
   - Call graph includes calls passed as macro arguments

6. **Metaprogramming Call Analysis**: Foundation for tracking dynamically generated calls
   - Macro-generated call patterns become visible in call graph
   - Enables analysis of metaprogramming-heavy Rust codebases

**End-to-End Flow**: Tree-sitter captures macro patterns → Semantic index tracks macro definitions/invocations → Symbol resolution handles macro hygiene → Call graph tracks macro-generated and macro-invoked calls

## Technical Approach
1. **Study Macro AST**: Analyze tree-sitter representation of macro constructs
2. **Implement Definitions**: Start with basic macro_rules! detection
3. **Add Invocations**: Capture macro calls and built-in macros
4. **Handle Attributes**: Implement attribute and derive macro detection
5. **Pattern Analysis**: Extract macro pattern matching information

## Dependencies
- Understanding of Rust macro system (declarative and procedural)
- Knowledge of common built-in macros and derive traits
- Tree-sitter patterns for token tree matching

## Success Metrics
- 1 failing test becomes passing
- Complete macro ecosystem captured (definitions, invocations, attributes)
- Built-in macros properly identified and categorized
- Macro pattern information available for analysis

## Notes
- Macros are fundamental to Rust metaprogramming and code generation
- Built-in macro detection helps with understanding standard patterns
- Derive macros are crucial for trait implementation analysis
- Consider performance impact of complex token tree patterns
- Procedural macros may require special handling for external crates