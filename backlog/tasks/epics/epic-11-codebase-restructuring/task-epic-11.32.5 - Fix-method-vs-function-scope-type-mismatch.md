---
id: task-epic-11.32.5
title: Fix method vs function scope type mismatch
status: To Do
assignee: []
created_date: '2025-08-26'
labels: [types, scope-analysis, graph-builder, epic-11]
dependencies: [task-epic-11.32]
parent_task_id: task-epic-11.32
---

## Description

Fix the mismatch between ScopeType definition and graph_builder usage where graph_builder checks for both 'function' and 'method' scope types, but ScopeType enum only defines 'function'.

## Context

In scope_tree.ts, the ScopeType is defined as:
```typescript
export type ScopeType = 
  | 'global'      // Top-level file scope
  | 'module'      // Module/namespace scope
  | 'class'       // Class/struct scope
  | 'function'    // Function/method scope  <-- Note: comment says "Function/method"
  | 'block'       // Block scope
  | 'parameter'   // Function parameter scope
  | 'local';      // Local/let/const scope
```

But in graph_builder.ts:
```typescript
for (const [_, scope] of scopes.nodes.entries()) {
  if (scope.type === "function" || scope.type === "method") {  // <-- Checks for 'method'
    nodes.push({
      type: scope.type === "method" ? "method" : "function",  // <-- Differentiates
      // ...
    });
  }
}
```

This creates a logic bug where methods will never be detected because ScopeType doesn't include 'method'.

## Investigation Required

1. **Are methods semantically different from functions in scope analysis?**
   - Do methods have different scoping rules?
   - Do they need different handling for 'this'/'self' binding?
   - Are they linked to their parent class scope differently?

2. **How do other languages handle this?**
   - JavaScript/TypeScript: Methods are functions in class context
   - Python: Methods receive 'self' as first parameter
   - Rust: Methods are functions with 'self' receiver

3. **What information is needed to distinguish methods from functions?**
   - Parent scope type (is it a class?)
   - Presence of 'this'/'self' parameter
   - Language-specific rules

## Tasks

### Phase 1: Research & Design
- [ ] Analyze how each language represents methods in AST
- [ ] Determine if methods need separate scope type
- [ ] Check if parent scope (class) is sufficient context
- [ ] Review how inheritance affects method scoping

### Phase 2: Decision & Implementation

#### Option A: Add 'method' to ScopeType
- [ ] Add 'method' to ScopeType enum
- [ ] Update scope_tree builders to detect methods
- [ ] Ensure all languages properly classify methods

#### Option B: Use function with metadata
- [ ] Keep only 'function' in ScopeType
- [ ] Add metadata.is_method or metadata.method_of_class
- [ ] Update graph_builder to check metadata instead

#### Option C: Infer from parent scope
- [ ] Keep only 'function' in ScopeType
- [ ] Check if parent scope is 'class' to determine if method
- [ ] Update graph_builder to use parent scope context

### Phase 3: Update graph_builder
- [ ] Fix the scope type checking logic
- [ ] Ensure methods are properly identified
- [ ] Test with all supported languages

### Phase 4: Testing
- [ ] Test method detection in JavaScript/TypeScript classes
- [ ] Test method detection in Python classes
- [ ] Test method detection in Rust impl blocks
- [ ] Verify static methods vs instance methods

## Acceptance Criteria

- [ ] Methods are correctly identified in graph_builder
- [ ] No TypeScript errors from mismatched types
- [ ] All language-specific method patterns detected
- [ ] Clear distinction between functions and methods in graph
- [ ] Tests pass for all languages

## Technical Considerations

### Language-Specific Method Detection

**JavaScript/TypeScript:**
```javascript
class Foo {
  method() {}        // Instance method
  static method() {} // Static method
}
```

**Python:**
```python
class Foo:
    def method(self):       # Instance method
    @staticmethod
    def static_method():    # Static method
    @classmethod
    def class_method(cls):  # Class method
```

**Rust:**
```rust
impl Foo {
    fn method(&self) {}     // Instance method
    fn associated() {}      // Associated function (static)
}
```

## Recommendation

Recommend **Option B** (use metadata) because:
1. Methods ARE functions with special context
2. Keeps ScopeType enum simpler
3. Allows capturing additional method-specific info (static, async, etc.)
4. More flexible for language-specific variations

## Notes

- This affects graph visualization (methods should be shown differently)
- May impact call graph analysis (method calls vs function calls)
- Consider impact on inheritance analysis
- Related to how class/trait/interface scopes are handled