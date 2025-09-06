# Task 11.82.4: Implement Missing Helper Functions

## Parent Task
11.82 - Refactor constructor_calls to Configuration-Driven Pattern

## Overview
Implement missing helper functions that are used by constructor_type_extraction but not currently defined.

## Missing Functions

### 1. `walk_tree(node, callback)`
Currently defined internally but not exported from constructor_calls.ts

**Current Location**: constructor_calls.ts (line 210)
**Required**: Export it for use by other modules

### 2. `is_property_assignment(node, target, language)`
Determines if an assignment is to a property (this.prop, self.prop)

**Required Implementation**:
```typescript
function is_property_assignment(
  node: SyntaxNode,
  target: string,
  language: Language
): boolean {
  // Check if target starts with 'this.' (JS/TS)
  // Check if target starts with 'self.' (Python)
  // Check if target contains '.' indicating property access
}
```

### 3. `is_return_value(node)`
Determines if a constructor call is being returned from a function

**Required Implementation**:
```typescript
function is_return_value(node: SyntaxNode): boolean {
  // Walk up the AST to check if parent is return_statement
  // Handle different return patterns per language
}
```

### 4. Fix TypeInfo interface
The TypeInfo interface needs an `is_return_value` field as used by tests

**Location**: packages/core/src/type_analysis/type_tracking
**Required**: Add `is_return_value?: boolean` field

## Acceptance Criteria
- [ ] Export `walk_tree` function from constructor_calls.ts
- [ ] Implement `is_property_assignment()` in constructor_type_extraction.ts
- [ ] Implement `is_return_value()` in constructor_type_extraction.ts
- [ ] Add `is_return_value` field to TypeInfo interface
- [ ] Add `is_property_assignment` field to TypeInfo interface
- [ ] All helper functions have appropriate type signatures
- [ ] Functions handle all supported languages (JS, TS, Python, Rust)
- [ ] Related tests pass

## Implementation Details

### is_property_assignment Logic
- JavaScript/TypeScript: Check for `this.` prefix
- Python: Check for `self.` prefix  
- Rust: Check for struct field access patterns
- General: Any target containing '.' indicates property

### is_return_value Logic
- Check if immediate parent is `return_statement`
- Check if parent is arrow function with implicit return
- Handle language-specific return patterns

## Technical Notes
- These functions are critical for type tracking
- Must work across all supported languages
- Should be well-tested with edge cases

## Priority
HIGH - Blocking test failures in constructor_type_extraction