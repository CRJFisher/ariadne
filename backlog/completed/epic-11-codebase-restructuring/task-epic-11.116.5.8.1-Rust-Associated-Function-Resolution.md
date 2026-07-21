# Task epic-11.116.5.8.1: Rust Associated Function Resolution

**Status:** Completed
**Parent:** task-epic-11.116.5.8
**Priority:** High
**Created:** 2025-10-20

## Overview

Rust associated function calls (e.g., `Product::new()`) are not being resolved. The references are captured but lack the context needed to resolve them to the correct method definitions in impl blocks.

## Problem

When parsing Rust code like:

```rust
impl Product {
    fn new(name: String) -> Self {
        Product { name }
    }
}

fn main() {
    let product = Product::new(String::from("test"));  // <-- This call
}
```

The call to `Product::new()` is captured as a reference with:
- `type`: "call"
- `call_type`: "function"
- `name`: "new"
- `scope_id`: (scope of main function)

**BUT** it has no `context` field indicating it's called on the `Product` type.

Resolution tries to resolve "new" in the scope of `main`, which fails because:
1. There's no function named "new" in scope
2. The resolver doesn't know this is `Product::new()` (associated function call on Product type)
3. Associated functions are stored as methods of the Product class, not as standalone functions

## Expected Behavior

The reference should include context similar to method calls:

```typescript
{
  "type": "call",
  "call_type": "function",  // or maybe "associated_function"?
  "name": "new",
  "context": {
    "receiver_type": "Product",  // or receiver_location pointing to Product type
    "call_style": "associated"   // to distinguish from method calls
  }
}
```

Then the resolver can:
1. Look up the Product type
2. Find the "new" method in Product's type members
3. Resolve to the correct symbol_id

## Root Cause

The issue is in the reference capture phase during semantic indexing. The Rust query file or reference processor needs to:

1. Detect `::` call syntax (scoped identifier)
2. Extract the type name (left side of `::`)
3. Store it in the reference context

Likely files to check:
- `packages/core/src/index_single_file/queries/rust_queries.scm` - Tree-sitter queries
- `packages/core/src/index_single_file/references/reference_processor.ts` - Reference building
- Rust-specific reference handling code

## Test Case

From `constructor_workflow.rs`:

```rust
// This call should resolve:
let mut product = Product::new(
    String::from("Laptop"),
    1000.0,
    String::from("Electronics"),
);
```

Currently:
- Reference is captured: ✓
- Resolution returns: `null` ✗

Expected:
- Resolution returns: `method:/Users/.../constructor_workflow.rs:14:5:21:5:new` ✓

## Implementation Notes

This may require:

1. **Update tree-sitter query** - Capture scoped identifiers with both type and method name
2. **Update reference builder** - Extract type information from scoped calls
3. **Update resolver** - Handle associated function resolution (look up type members)

Similar to how TypeScript handles `Math.abs()` or Python handles `str.upper()` - static method calls.

## Success Criteria

- [x] `Product::new()` calls resolve to the `new` method in the impl block
- [x] All associated function calls resolve correctly
- [x] Integration tests pass for "should resolve associated function calls (::new)"
- [ ] Cross-module associated function calls also work (blocked by Rust module declarations)

## Estimated Effort

**3-4 hours**
- 1 hour: Investigation and understanding tree-sitter captures
- 1.5 hours: Implementation (queries + reference builder + resolver)
- 1 hour: Testing and edge cases
- 30 min: Documentation

## Related

This is a Rust-specific issue. Similar languages might have similar patterns (C++ static methods, etc.) but they would need separate handling.

## Implementation Details

### Changes Made

1. **[reference_builder.ts](file:///packages/core/src/index_single_file/references/reference_builder.ts)** (lines 253-266, 285-291, 466-472)
   - Extract receiver_location for FUNCTION_CALL (not just METHOD_CALL)
   - Extract property_chain for FUNCTION_CALL
   - Use language-specific extractor to extract call name

2. **[rust.scm](file:///packages/core/src/index_single_file/query_code_tree/queries/rust.scm)** (lines 969-976)
   - Capture whole call_expression for associated functions to get full context

3. **[resolution_registry.ts](file:///packages/core/src/resolve_references/resolution_registry.ts)** (lines 243-259)
   - Route function calls with receiver_location through method resolution

4. **[method_resolver.ts](file:///packages/core/src/resolve_references/call_resolution/method_resolver.ts)** (lines 104-117, 133-140)
   - Check if receiver is a type (class/interface/enum) directly
   - Fallback to DefinitionRegistry for member lookup (TypeRegistry isn't populated during resolution phase)

### Root Cause

Associated function calls like `Product::new()` were classified as FUNCTION_CALL but needed type-aware resolution like METHOD_CALL. The solution treats the type name as the receiver and looks up methods on the type itself.

### Cross-Module Limitation

Cross-module test is skipped because Rust module declarations (`mod user_mod;`) are not fully implemented. This is a separate issue - see task-epic-11.116.5.8.2 (to be created). The associated function resolution logic works correctly; the issue is that import resolution fails for Rust modules.
