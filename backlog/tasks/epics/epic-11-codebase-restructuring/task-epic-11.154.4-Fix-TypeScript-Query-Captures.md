# Task Epic 11.154.4: Fix TypeScript Query Captures

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 2 days

---

## Objective

Refactor TypeScript query file to use complete captures (not fragments) and conform to canonical schema's positive validation approach.

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

## Implementation Steps

### Step 1: Run Baseline Validation (0.25 day)

```bash
npm run validate:captures -- --lang=typescript
```

Document current errors and warnings to track progress.

### Step 2: Update Query File (0.5 day)

**File**: `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

**Changes**:

1. Remove `@reference.call.full`, `@reference.call.chained`, `@reference.call.deep` captures
2. Move `@reference.call` from `property_identifier` to parent `call_expression`
3. Keep `@reference.variable` captures for receiver tracking
4. Ensure all patterns capture complete nodes

**Example change**:

```scheme
# Remove this entire pattern:
(call_expression
  function: (member_expression
    property: (property_identifier) @reference.call
  )
) @reference.call.full

# Keep only this:
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call
```

### Step 3: Verify/Update Extractors (0.5 day)

**File**: `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_metadata.ts`

**Verify these extractors work with complete captures**:

```typescript
// Must extract method name from call_expression node
extract_call_name(node: SyntaxNode): SymbolName | undefined {
  if (node.type === "call_expression") {
    const functionNode = node.childForFieldName("function");
    if (functionNode?.type === "member_expression") {
      const propertyNode = functionNode.childForFieldName("property");
      return propertyNode?.text as SymbolName;  // Extract from complete node
    }
  }
}

// Must determine if call_expression is a method call
is_method_call(node: SyntaxNode): boolean {
  if (node.type === "call_expression") {
    const functionNode = node.childForFieldName("function");
    return functionNode?.type === "member_expression";
  }
}
```

If extractors need updates, modify them to handle complete captures.

### Step 4: Update Builder Config (0.25 day)

**File**: `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`

Verify builder handlers work with new capture patterns. May need to update capture name handling if queries changed.

### Step 5: Update Tests (0.25 day)

**File**: `packages/core/src/index_single_file/semantic_index.typescript.test.ts`

Update test expectations:

- Remove expectations for `.full`, `.chained`, `.deep` captures
- Verify complete captures produce same semantic output
- Ensure reference resolution still works

**File**: `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_metadata.test.ts`

Add/update tests for extractors working with complete captures.

### Step 6: Run Full Test Suite (0.25 day)

```bash
npm test -- typescript
npm test -- semantic_index.typescript
```

All tests must pass.

### Step 7: Verify Entry Point Detection (0.25 day)

```bash
npx tsx top-level-nodes-analysis/triage_false_negative_entrypoints.ts
```

Verify all 4 Project methods now detected as entry points.

### Step 8: Final Validation (0.25 day)

```bash
npm run validate:captures -- --lang=typescript
```

Must show:
- ✅ 0 errors
- ✅ 0 warnings (no fragment captures)

---

## Acceptance Criteria

### Query File

- [ ] `typescript.scm` has no duplicate captures (no `.full`, `.chained`, `.deep`)
- [ ] All captures target complete nodes (call_expression, not property_identifier)
- [ ] All captures are in required/optional schema lists

### Extractors/Builders

- [ ] `typescript_metadata.ts` extractors work with complete captures
- [ ] `extract_call_name()` extracts method name from call_expression
- [ ] `is_method_call()` works with call_expression nodes
- [ ] Builder config handles new capture patterns

### Tests

- [ ] All TypeScript semantic index tests pass
- [ ] Metadata extractor tests pass
- [ ] Test expectations updated (no `.full`, `.chained`, `.deep`)
- [ ] Reference resolution tests pass

### Validation

- [ ] Validation passes: `npm run validate:captures -- --lang=typescript`
- [ ] Zero schema violations (errors)
- [ ] Zero fragment warnings
- [ ] All required captures present

### Bug Fix Verification

- [ ] Project entry points correctly detected (all 4 methods)
- [ ] No false self-references in call graph
- [ ] Entry point detection improved

---

## Dependencies

- Task 11.154.2 (schema)
- Task 11.154.3 (validation)

---

## Files Modified

- `queries/typescript.scm` - Remove duplicate/fragment captures
- `language_configs/typescript_metadata.ts` - Verify/update extractors
- `language_configs/typescript_builder_config.ts` - Verify builder handlers
- `semantic_index.typescript.test.ts` - Update test expectations
- `typescript_metadata.test.ts` - Test extractors with complete captures

---

## Time Breakdown

- Query file updates: 0.5 day
- Extractor verification/updates: 0.5 day
- Builder config review: 0.25 day
- Test updates: 0.25 day
- Testing and validation: 0.5 day

**Total: 2 days**
