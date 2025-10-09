# Task: Update Method Resolver to Use Location-Based Lookup

**Parent Task**: 11.136 - Implement Method Call Type Tracking Resolution
**Epic**: 11 - Codebase Restructuring
**Status**: TODO
**Priority**: High
**Estimated Effort**: 0.25 days

## Context

Method resolution currently uses name-based receiver lookup via `extract_receiver_name()` which relies on `property_chain`. This fails when property_chain is missing.

We need to switch to location-based lookup using the new `get_type_at_location()` method from task 11.136.1.

### Current Implementation

```typescript
// method_resolver.ts:resolve_single_method_call()
function resolve_single_method_call(...) {
  const receiver_loc = call_ref.context?.receiver_location;
  if (!receiver_loc) return null;

  // ❌ Problem: Uses property_chain which may be missing
  const receiver_name = extract_receiver_name(call_ref);
  const receiver_symbol = resolver_index.resolve(scope_id, receiver_name, cache);

  const receiver_type = type_context.get_symbol_type(receiver_symbol);
  const method_symbol = type_context.get_type_member(receiver_type, call_ref.name);

  return method_symbol;
}
```

### New Implementation

```typescript
function resolve_single_method_call(
  call_ref: SymbolReference,
  index: SemanticIndex,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  type_context: TypeContext
): SymbolId | null {
  // Extract receiver location from context
  const receiver_loc = call_ref.context?.receiver_location;
  if (!receiver_loc) return null;

  // NEW: Get receiver type directly from location
  const receiver_type = type_context.get_type_at_location(
    receiver_loc,
    call_ref.scope_id
  );

  if (!receiver_type) {
    // No type information at this location
    return null;
  }

  // Look up method on that type
  const method_symbol = type_context.get_type_member(
    receiver_type,
    call_ref.name
  );

  return method_symbol;
}
```

## Implementation

### File: `method_resolver.ts`

1. **Update `resolve_single_method_call()`:**
   - Remove call to `extract_receiver_name()`
   - Remove name-based resolution with `resolver_index.resolve()`
   - Replace with direct `type_context.get_type_at_location()` call
   - Keep namespace member check (it still needs receiver_symbol)

2. **Keep namespace resolution:**
   ```typescript
   // For namespace member access (utils.helper), we still need symbol-based lookup
   const receiver_name = extract_receiver_name(call_ref);
   const receiver_symbol = resolver_index.resolve(scope_id, receiver_name, cache);

   // Check if receiver is a namespace import
   const namespace_member = type_context.get_namespace_member(
     receiver_symbol,
     call_ref.name
   );
   if (namespace_member) return namespace_member;

   // Then try type-based method resolution...
   ```

3. **Can remove `extract_receiver_name()`?**
   - Only if namespace resolution doesn't need it
   - Check if we can use receiver_location for namespace lookup too

## Acceptance Criteria

- [ ] `resolve_single_method_call()` uses `get_type_at_location()`
- [ ] Method resolution no longer depends on `property_chain`
- [ ] Namespace member resolution still works
- [ ] Existing method resolver unit tests still pass (14 tests)
- [ ] No regressions in functionality

## Testing Strategy

Existing tests should pass:
- `method_resolver.test.ts` - 14 unit tests should still pass
- Run integration tests to verify no regressions

## Dependencies

**Requires:** Task 11.136.1 (Location-based type lookup must be implemented first)

## Notes

- This is a refactoring - behavior should remain the same
- The change makes resolution more robust by not depending on optional metadata
- `receiver_location` is always populated by metadata extractors (unlike property_chain)
