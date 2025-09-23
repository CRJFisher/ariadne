# task-epic-11.95.2 - Implement Rust Trait System

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `High`
- **Size**: `L`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for Rust trait definitions, implementations, and associated items. This covers the core object-oriented features of Rust.

## Current Failing Tests
- `should parse trait definitions and implementations` - trait methods not detected with `is_trait_method` modifier

## Specific Issues to Fix

### Trait Methods Not Detected
```rust
trait Drawable {
    fn draw(&self);
    fn area(&self) -> f64 { 0.0 }
}

trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}
```
- **Expected**: Methods `draw` and `next` should have `is_trait_method: true` modifier
- **Current**: Trait methods not detected or marked properly

### Missing Trait Constructs
- Trait definitions not captured as interface entities
- Associated types and constants not detected
- Default implementations not distinguished
- Trait bounds and supertrait relationships missing

## Implementation Details

### Tree-sitter Patterns Needed
1. **Trait Definitions**: `trait TraitName { ... }`
2. **Trait Methods**: Function signatures within traits
3. **Associated Types**: `type Item = T;`
4. **Associated Constants**: `const VALUE: usize;`
5. **Default Implementations**: Method bodies in traits
6. **Trait Implementations**: `impl TraitName for TypeName`
7. **Trait Bounds**: `where T: Clone + Debug`

### Query Patterns to Add to rust.scm
```scheme
; Trait definitions
(trait_item
  name: (type_identifier) @interface.name
  body: (declaration_list) @interface.body) @interface.definition

; Trait methods
(trait_item
  body: (declaration_list
    (function_signature_item
      name: (identifier) @method.name) @method.definition))

; Associated types
(trait_item
  body: (declaration_list
    (associated_type
      name: (type_identifier) @type.name) @type.definition))

; Trait implementations
(impl_item
  trait: (type_identifier) @implementation.trait
  type: (type_identifier) @implementation.type) @implementation.definition

; Impl block methods
(impl_item
  body: (declaration_list
    (function_item
      name: (identifier) @method.name) @method.definition))
```

### Modifier Support Needed
- `is_trait_method`: boolean flag for methods defined in traits
- `is_trait_impl`: boolean flag for trait implementation methods
- `trait_name`: name of the trait being implemented
- `has_default_impl`: boolean for methods with default implementations
- `associated_items`: list of associated types/constants

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add trait patterns
- `src/semantic_index/capture_types.ts` - Add trait-specific modifiers

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for trait definitions and implementations
- Test fixtures - Add comprehensive Rust trait examples including generic traits

### Processing Module Integration
- `src/semantic_index/type_tracking/` - Update to handle trait types and associated items
- `src/semantic_index/symbol_extraction/` - Ensure trait symbols are properly extracted
- `src/semantic_index/interface_analysis/` - Process trait definitions as interfaces

### Symbol Resolution Integration
- `src/symbol_resolution/definition_finder/` - Update to resolve trait methods and associated types
- `src/symbol_resolution/type_resolution/` - Handle trait bounds and implementations
- `src/symbol_resolution/method_resolution/` - Enable trait method resolution and dispatch
- `src/symbol_resolution/scope_analysis/` - Update scope tracking for trait contexts

## Acceptance Criteria
- [ ] Trait definitions captured as interface entities
- [ ] Trait methods marked with `is_trait_method: true`
- [ ] Associated types and constants captured
- [ ] Default implementations distinguished from signatures
- [ ] Trait implementations properly linked to traits and types
- [ ] Impl block methods marked appropriately
- [ ] Failing test passes
- [ ] No regression in existing Rust parsing

## Call Graph Detection Benefits

This implementation is crucial for call graph analysis by:

1. **Dynamic Dispatch Tracking**: Enables resolution of trait method calls through dynamic dispatch
   - `drawable.draw()` calls can be resolved to multiple implementations
   - Call graph can track all possible execution paths through trait objects

2. **Interface Method Resolution**: Foundation for polymorphic call tracking
   - Trait method calls become resolvable to concrete implementations
   - Enables tracking of calls across trait boundaries

3. **Associated Type Resolution**: Supports complex type-dependent call resolution
   - Methods returning associated types can be properly tracked
   - Enables call graph construction for complex generic trait patterns

4. **Trait Bound Analysis**: Enables constraint-aware call resolution
   - Function calls with trait bounds become trackable
   - Where clauses enable precise method resolution in generic contexts

5. **Cross-Crate Trait Calls**: Foundation for tracking trait method calls across modules
   - Import resolution can handle trait imports and re-exports
   - Call graph can trace trait method calls between crates

**End-to-End Flow**: Tree-sitter captures trait patterns → Semantic index identifies trait methods → Symbol resolution handles trait dispatch → Call graph tracks polymorphic method calls

## Technical Approach
1. **Analyze Trait AST**: Study tree-sitter AST for trait constructs
2. **Write Core Queries**: Start with basic trait and impl patterns
3. **Add Method Detection**: Ensure trait methods get proper modifiers
4. **Handle Associated Items**: Capture associated types/constants
5. **Test Integration**: Verify trait system works end-to-end

## Dependencies
- **Prerequisite**: task-epic-11.95.1 (generics support for generic traits)
- Understanding of Rust trait system
- Tree-sitter query patterns for complex nested structures

## Success Metrics
- 1 failing test becomes passing
- Trait methods properly identified and marked
- Complete trait ecosystem captured (definitions, impls, associated items)
- Integration with type system for trait bounds

## Notes
- Trait system is core to Rust OOP - high impact on type resolution
- Should be implemented after generics since traits often use generics
- Consider interaction with method resolution system