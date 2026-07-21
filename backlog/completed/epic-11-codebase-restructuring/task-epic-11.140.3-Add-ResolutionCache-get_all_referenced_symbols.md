# Sub-Task 11.140.3: Add ResolutionCache.get_all_referenced_symbols()

**Parent Task**: task-epic-11.140
**Status**: Not Started  
**Priority**: Medium
**Estimated Effort**: 1 hour

---

## Goal

Add method to ResolutionCache that returns all SymbolIds that are referenced. This enables entry point detection (functions not in this set are entry points).

---

## Changes Required

**File**: `packages/core/src/project/resolution_cache.ts`

Add method:

```typescript
/**
 * Get all SymbolIds that are referenced anywhere in the codebase.
 * Used for entry point detection - functions NOT in this set are entry points.
 * 
 * @returns Set of all SymbolIds that appear as resolution targets
 */
get_all_referenced_symbols(): Set<SymbolId> {
  const referenced = new Set<SymbolId>();
  
  // Iterate all resolutions and collect target symbol IDs
  for (const symbol_id of this.resolutions.values()) {
    referenced.add(symbol_id);
  }
  
  return referenced;
}
```

---

## Testing

**File**: `packages/core/src/project/resolution_cache.test.ts`

```typescript
describe('ResolutionCache.get_all_referenced_symbols', () => {
  it('should return all unique referenced symbols', () => {
    const cache = new ResolutionCache();
    
    cache.set(ref_id1, symbol_A, file1);
    cache.set(ref_id2, symbol_B, file1);
    cache.set(ref_id3, symbol_A, file2);  // Duplicate
    
    const referenced = cache.get_all_referenced_symbols();
    
    expect(referenced.size).toBe(2);
    expect(referenced.has(symbol_A)).toBe(true);
    expect(referenced.has(symbol_B)).toBe(true);
  });
  
  it('should return empty set when no resolutions', () => {
    const cache = new ResolutionCache();
    const referenced = cache.get_all_referenced_symbols();
    expect(referenced.size).toBe(0);
  });
});
```

---

## Acceptance Criteria

- [ ] Method added to ResolutionCache
- [ ] Returns Set<SymbolId> with all unique referenced symbols
- [ ] Unit tests pass
- [ ] No performance issues (O(n) is acceptable)

---

## Dependencies

**Depends on**: None (independent)
**Blocks**: 11.140.6 (detect_entry_points needs this)
