# Task Epic 11.154.7: Fix Rust Query Captures

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 2 days

---

## Objective

Refactor Rust query file to use complete captures (call_expression, not field_identifier), handling both `.` method calls and `::` associated functions.

---

## Scope

**File**: `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`

**Rust-specific considerations:**

- Uses `field_expression` for method calls (`self.method()`)
- Uses `scoped_identifier` for associated functions (`Type::function()`)
- Trait methods need special handling

### Before

```scheme
(call_expression
  function: (field_expression
    field: (field_identifier) @reference.call            ; DUPLICATE 1
  )
) @reference.call.method                                 ; DUPLICATE 2
```

### After

```scheme
; Method call (dot syntax)
(call_expression
  function: (field_expression
    value: (_) @reference.variable
    field: (field_identifier)
  )
) @reference.call

; Associated function (double-colon syntax)
(call_expression
  function: (scoped_identifier
    path: (_) @reference.type
    name: (identifier)
  )
) @reference.call
```

---

## Acceptance Criteria

- [ ] Validation passes
- [ ] Rust semantic index tests pass
- [ ] Both `.` and `::` calls handled
- [ ] Trait method resolution works

---

## Dependencies

- Task 11.154.2 (schema)
- Task 11.154.3 (validation)

---

## Time: 2 days
