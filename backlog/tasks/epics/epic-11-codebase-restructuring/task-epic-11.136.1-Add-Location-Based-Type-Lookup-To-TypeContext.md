# Task: Add Location-Based Type Lookup to TypeContext

**Parent Task**: 11.136 - Implement Method Call Type Tracking Resolution
**Epic**: 11 - Codebase Restructuring
**Status**: TODO
**Priority**: High
**Estimated Effort**: 0.5 days

## Context

Method resolution currently uses name-based receiver lookup which fails when `property_chain` is missing. We need location-based type lookup to directly query "what type is at this location?"

### Current Problem

```typescript
// method_resolver.ts extract_receiver_name() does:
const receiver_name = extract_receiver_name(call_ref); // "user" from property_chain
const receiver_symbol = resolver_index.resolve(scope_id, receiver_name, cache);
// ❌ Fails when property_chain is missing
```

### Solution

Add direct location-based type lookup to TypeContext:

```typescript
interface TypeContext {
  get_symbol_type(symbol_id: SymbolId): SymbolId | null; // existing
  get_type_at_location(location: Location, scope_id: ScopeId): SymbolId | null; // NEW
}
```

## Implementation

### File: `type_context.ts`

Add method to TypeContext interface and implementation:

```typescript
/**
 * Get the type at a specific location
 *
 * Uses type_bindings to look up the type at a location, then resolves
 * the type name to a SymbolId using scope-aware resolution.
 *
 * @param location - Source location to check
 * @param scope_id - Scope for resolving type names
 * @returns SymbolId of the type, or null if no type found
 *
 * @example
 * // Given: const user: User = new User();
 * //        user.getName(); // ← receiver_location points to "user" at line 2
 * const type = get_type_at_location(receiver_location, scope_id);
 * // → returns User class SymbolId
 */
get_type_at_location(location: Location, scope_id: ScopeId): SymbolId | null;
```

**Implementation approach:**

1. Create location key from the location
2. Look up in `type_bindings` map (already contains both explicit types and constructor bindings)
3. If found, resolve type name using `resolver_index.resolve(scope_id, type_name, cache)`
4. Return resolved type SymbolId

### Update `build_type_context()`

The implementation will need access to:
- `indices` - to find the index containing the location
- `resolver_index` - to resolve type names to SymbolIds
- `cache` - for cached resolution

These are already parameters to `build_type_context()`.

## Acceptance Criteria

- [ ] `get_type_at_location()` added to TypeContext interface
- [ ] Implementation correctly resolves types from explicit annotations
- [ ] Implementation correctly resolves types from constructor assignments
- [ ] Unit tests verify location-based lookup works
- [ ] Method is exported and available for use in method_resolver.ts

## Testing Strategy

Add tests to verify:

```typescript
describe("get_type_at_location", () => {
  it("resolves type from explicit annotation", () => {
    // const user: User = ...
    // type at user's location should be User class
  });

  it("resolves type from constructor assignment", () => {
    // const user = new User();
    // type at user's location should be User class
  });

  it("returns null for untyped variables", () => {
    // const x = 42;
    // no type binding exists
  });
});
```

## Dependencies

None - all infrastructure exists.

## Notes

- `type_bindings` already merges explicit types and constructor bindings (see semantic_index.ts:169-173)
- This is a pure addition - no existing code needs to change
- The method will be consumed by task 11.136.2 (method resolver update)
