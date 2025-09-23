# task-epic-11.95.10 - Fix Rust Type System Integration

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `High`
- **Size**: `M`
- **Parent**: task-epic-11.95

## Description
Fix Rust type system integration to ensure proper type registry functionality and method member registration for Rust types.

## Current Failing Tests
- `should build type registry with Rust types` - method members not properly registered

## Specific Issues to Fix

### Type Registry Method Members Missing
```rust
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    fn distance(&self, other: &Point) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
}
```
- **Expected**: `pointType.direct_members.has("new")` and `pointType.direct_members.has("distance")` should be true
- **Current**: Type registry not properly linking methods to types

### Root Cause Analysis
The issue appears to be in the integration between:
1. **Semantic Index**: Rust types and methods are captured
2. **Type Registry**: Types are registered but methods aren't linked
3. **Type Resolution**: Method member mapping incomplete

## Implementation Details

### Areas to Investigate
1. **Type Registry Construction**: How Rust types are added to registry
2. **Method Member Linking**: How impl block methods are associated with types
3. **Symbol Resolution**: How Rust symbols are resolved to types
4. **Type Member Maps**: Proper construction of type member relationships

### Potential Fixes Needed
1. **Enhanced Type Processing**: Ensure Rust impl blocks link methods to types
2. **Member Registration**: Fix method registration in type registry
3. **Symbol Mapping**: Proper SymbolId to TypeId mapping for Rust
4. **Integration Testing**: Verify end-to-end type system functionality

### Files to Investigate

### Primary Implementation
- `src/symbol_resolution/type_resolution/type_registry.ts` - Type registry implementation
- `src/symbol_resolution/type_resolution/type_member_processing.ts` - Member linking

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for type registry integration
- Test files - Understand expected vs actual behavior and add comprehensive type system tests

### Processing Module Integration
- `src/semantic_index/type_tracking/` - Type tracking for Rust
- `src/semantic_index/symbol_extraction/` - Ensure Rust type symbols are properly extracted
- `src/semantic_index/interface_analysis/` - Process Rust struct and trait type definitions

### Symbol Resolution Integration
- `src/symbol_resolution/type_resolution/` - Complete Rust type resolution pipeline
- `src/symbol_resolution/method_resolution/` - Ensure Rust method resolution integrates with type registry
- `src/symbol_resolution/definition_finder/` - Support Rust type and method definition lookup
- `src/symbol_resolution/scope_analysis/` - Update type scoping for Rust modules

## Technical Approach
1. **Debug Current Behavior**: Add logging to understand what's happening
2. **Trace Type Registration**: Follow Rust type through registration process
3. **Fix Member Linking**: Ensure impl block methods link to structs
4. **Test Integration**: Verify type registry functionality end-to-end
5. **Validate Symbols**: Ensure proper SymbolId generation and mapping

## Dependencies
- **Prerequisites**: Basic Rust semantic index functionality
- Understanding of type registry architecture
- Knowledge of Rust impl block semantics

## Acceptance Criteria
- [ ] Rust struct types properly registered in type registry
- [ ] Impl block methods linked to their struct types
- [ ] `direct_members` map contains expected method names
- [ ] Type registry integration test passes
- [ ] No regression in existing type system functionality

## Call Graph Detection Benefits

This implementation is critical for call graph analysis by:

1. **Rust Method Call Resolution**: Enables proper method resolution on Rust types
   - `point.distance(&other)` calls become resolvable through type registry
   - Call graph can track method calls on Rust struct types

2. **Impl Block Method Tracking**: Links impl block methods to their types for call resolution
   - Methods defined in `impl Point` blocks become callable on Point instances
   - Call graph includes all methods available on Rust types

3. **Type Member Call Analysis**: Supports method calls through type member relationships
   - Type registry enables lookup of available methods for call resolution
   - Call graph can model complete method availability per type

4. **Cross-Language Type Integration**: Ensures Rust types integrate with existing type system
   - Rust method calls work consistently with TypeScript/JavaScript method resolution
   - Call graph maintains consistent behavior across languages

5. **Struct Method Call Foundation**: Essential foundation for all Rust method call tracking
   - Without type registry integration, Rust method calls cannot be resolved
   - This task enables all other Rust call graph functionality

6. **Type-Driven Call Graph Construction**: Enables comprehensive type-aware call analysis
   - Type registry provides the foundation for method resolution across all Rust constructs
   - Call graph can accurately model Rust's type-safe method dispatch

**End-to-End Flow**: Semantic index captures Rust types → Type registry integrates Rust type members → Symbol resolution uses type registry for method lookup → Call graph tracks Rust method calls

## Success Metrics
- 1 failing test becomes passing
- Rust type system fully integrated with symbol resolution
- Method resolution works for Rust types
- Type registry contains complete Rust type information

## Files to Modify
Based on investigation:
- Type registry and member processing files
- Rust-specific type resolution logic
- Integration between semantic index and type registry

## Notes
- This task focuses on integration rather than new feature implementation
- May require coordination with other Rust tasks for complete functionality
- Important for enabling method resolution and call graph analysis for Rust
- Should be implemented after basic Rust semantic index features are working