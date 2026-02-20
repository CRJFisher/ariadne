# Task 11.106.2: Remove Non-Extractable Type Attributes

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 30 minutes
**Parent:** task-epic-11.106
**Dependencies:** task-epic-11.106.1 (context evaluation complete)

## Objective

Remove `SymbolReference` attributes that cannot be extracted from tree-sitter AST:
- `type_flow.source_type` - Requires type inference
- `type_flow.is_narrowing` - Requires control flow analysis
- `type_flow.is_widening` - Requires type system knowledge

These require semantic analysis beyond tree-sitter's syntactic capabilities.

## Rationale

### Why These Can't Be Extracted

**source_type** - Where a value came from:
```typescript
const x = getValue(); // What's the return type of getValue?
```
- Requires inter-procedural analysis
- Needs to track through function calls
- Beyond AST-local information

**is_narrowing/is_widening** - Type constraint changes:
```typescript
if (typeof x === "string") {
  // x narrowed from string|number to string
}
```
- Requires control flow analysis
- Needs type system understanding
- Requires tracking state across branches

### Method Resolution Impact

None of these attributes help resolve `obj.method()`:
- We don't need to know where a type came from
- We don't need to track narrowing/widening
- We only need the **current explicit type** (which we keep in `type_info`)

## Changes Required

### 1. Update SymbolReference Interface

**File:** `packages/types/src/semantic_index.ts`

Remove three fields from `type_flow`:

```typescript
readonly type_flow?: {
  source_type?: TypeInfo;      // ❌ REMOVE
  target_type?: TypeInfo;      // ✅ Keep (for now)
  is_narrowing: boolean;       // ❌ REMOVE
  is_widening: boolean;        // ❌ REMOVE
}
```

After:
```typescript
readonly type_flow?: {
  target_type?: TypeInfo;      // Only this remains
}
```

### 2. Remove Implementation Code

**File:** `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`

Remove assignments to deleted fields (no code audit needed, just delete).

## Verification Steps

1. **TypeScript compilation:**
   ```bash
   npx tsc --noEmit
   ```
   Expected: 0 errors

2. **Update tests:** Remove assertions on deleted fields

## Success Criteria

- ✅ Three fields removed from interface
- ✅ Implementation code updated
- ✅ No compilation errors
- ✅ Tests updated (assertions removed)

## Notes

**Blinkered approach:** Don't search for existing usages. Simply remove the fields and fix compilation errors. If code was depending on these (which it shouldn't be, since they're always undefined/false), compilation will fail and we'll address it then.

**Next step:** Task 11.106.3 will simplify the remaining `type_flow.target_type` to `assignment_type`.
