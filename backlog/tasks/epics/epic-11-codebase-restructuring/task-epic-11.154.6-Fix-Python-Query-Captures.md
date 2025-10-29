# Task Epic 11.154.6: Fix Python Query Captures

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 2 days

---

## Objective

Refactor Python query file to use complete captures (call node, not identifier), accounting for Python-specific AST nodes (`attribute` vs `member_expression`, `call` vs `call_expression`).

---

## Scope

**File**: `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

**Python-specific considerations:**

- Uses `attribute` instead of `member_expression`
- Uses `call` instead of `call_expression`
- Uses `identifier` for attribute names (not `property_identifier`)

### Before

```scheme
(call
  function: (attribute
    attribute: (identifier) @reference.call              ; DUPLICATE 1
  )
) @reference.call.full                                   ; DUPLICATE 2
```

### After

```scheme
(call
  function: (attribute
    object: (_) @reference.variable
    attribute: (identifier)
  )
) @reference.call
```

---

## Acceptance Criteria

- [ ] Validation passes
- [ ] Python semantic index tests pass
- [ ] Method calls resolved correctly
- [ ] Class/instance method differentiation works

---

## Dependencies

- Task 11.154.2 (schema)
- Task 11.154.3 (validation)

---

## Time: 2 days
