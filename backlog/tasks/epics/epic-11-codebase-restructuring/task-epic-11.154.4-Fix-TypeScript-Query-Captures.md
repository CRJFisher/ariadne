# Task Epic 11.154.4: Fix TypeScript Query Captures

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 2 days

---

## Objective

Refactor TypeScript query file to eliminate duplicate captures and conform to canonical schema.

---

## Scope

**File**: `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

**Changes needed** (from validation report):

1. Remove `@reference.call.full`, `.chained`, `.deep` captures
2. Use single `@reference.call` on `call_expression` only
3. Ensure all required captures present
4. Fix any naming convention violations

---

## Implementation

### Before (Problematic)

```scheme
; Method calls with receiver tracking
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier) @reference.call    ; DUPLICATE 1
  )
) @reference.call.full                                 ; DUPLICATE 2

; Chained method calls
(call_expression
  function: (member_expression
    object: (member_expression
      object: (_) @reference.variable.base
      property: (property_identifier) @reference.property.prop1
    )
    property: (property_identifier) @reference.call.chained  ; DUPLICATE
  )
) @reference.call.chained                              ; DUPLICATE
```

### After (Clean)

```scheme
; Method calls - single capture
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call

; Method name extracted via extractors.extract_call_name()
; Call type determined via extractors.is_method_call()
```

---

## Steps

1. **Run validation** to get baseline errors
2. **Remove duplicate patterns** systematically
3. **Verify extractors work** - ensure `extract_call_name()` handles all cases
4. **Run tests** - all TypeScript semantic index tests must pass
5. **Verify entry points** - re-run Project analysis
6. **Run validation again** - must pass with 0 errors

---

## Acceptance Criteria

- [ ] Validation passes: `npm run validate:captures -- --lang=typescript`
- [ ] Zero prohibited captures
- [ ] All required captures present
- [ ] TypeScript semantic index tests pass: `npm test -- typescript`
- [ ] Project entry points correctly detected (all 4 methods)
- [ ] No false self-references in call graph

---

## Dependencies

- Task 11.154.2 (schema)
- Task 11.154.3 (validation)

---

## Time: 2 days
