# Ultra-Deep Analysis: Can We Make O(n) Loops Become O(1)?

## The Question

In `build_type_context()`, we have three passes that iterate over data. Can we eliminate these loops by pre-computing the results in registries?

## TL;DR: Only Pass 2 Can Be Optimized to O(1)

- ❌ **Pass 1**: Cannot pre-compute (needs `resolver_index` which isn't available yet)
- ✅ **Pass 2**: CAN pre-compute (just flattening, no dependencies)
- ❌ **Pass 3**: Cannot pre-compute (needs `resolver_index` which isn't available yet)

## Detailed Analysis

### Pass 1: Build Symbol → Type Mappings

**Current Code:**
```typescript
for (const [loc_key, type_name] of types.get_all_type_bindings()) {  // O(n)
  const symbol_id = definitions.get_symbol_at_location(loc_key);  // O(1) ✅
  const scope_id = definitions.get_symbol_scope(symbol_id);  // O(1) ✅
  const type_symbol = resolver_index.resolve(scope_id, type_name, cache);  // O(1) ✅
  if (type_symbol) {
    symbol_types.set(symbol_id, type_symbol);
  }
}
```

**Dependencies:**
- ✅ `type_bindings` - Available in TypeRegistry during `update_file()`
- ✅ `definitions.get_symbol_at_location()` - Available in DefinitionRegistry
- ✅ `definitions.get_symbol_scope()` - Available in DefinitionRegistry
- ❌ `resolver_index.resolve()` - **NOT available until `resolve_symbols()` is called!**

**Can We Pre-Compute?** NO

**Why Not?**
The `resolver_index` doesn't exist during file indexing. It's built at the start of `resolve_symbols()` after all files are indexed. This is fundamental to the architecture:

```
Project.update_file()
├─ Build semantic_index
├─ Update registries (definitions, types, scopes)
└─ ❌ No resolver_index yet!

Later, when resolution is needed:
resolve_symbols()
├─ Build resolver_index       ← First time resolver exists!
├─ Build type_context          ← ONLY NOW can we resolve type names
└─ Resolve calls
```

**Optimization Status:** ✅ **Already Optimal**
- Inner operations are O(1) via hash maps
- We can't eliminate the loop itself because we're BUILDING the result map
- This is as good as it gets without changing the architecture

### Pass 2: Flatten Type Members

**Current Code:**
```typescript
for (const [type_id, member_info] of types.get_all_type_members()) {  // O(m)
  const members = new Map<SymbolName, SymbolId>();

  for (const [method_name, method_id] of member_info.methods) {  // O(k)
    members.set(method_name, method_id);
  }

  for (const [prop_name, prop_id] of member_info.properties) {  // O(p)
    members.set(prop_name, prop_id);
  }

  type_members_map.set(type_id, members);
}
```

**Dependencies:**
- ✅ `type_members` - Available in TypeRegistry during `update_file()`
- ✅ No external dependencies! Just flattening a structure.

**Can We Pre-Compute?** YES! ✅

**How:**
```typescript
class TypeRegistry {
  private flattened_members: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();

  update_file(file_path: FilePath, index: SemanticIndex): void {
    // ... existing code that builds type_members ...

    // Pre-flatten ONCE during indexing
    for (const [type_id, members] of type_members) {
      const flat = new Map<SymbolName, SymbolId>();
      for (const [name, id] of members.methods) flat.set(name, id);
      for (const [name, id] of members.properties) flat.set(name, id);
      this.flattened_members.set(type_id, flat);
    }
  }

  get_flattened_members(): Map<SymbolId, Map<SymbolName, SymbolId>> {
    return new Map(this.flattened_members);
  }
}
```

**Then Pass 2 becomes:**
```typescript
// OLD: O(m * (k + p))
for (const [type_id, member_info] of types.get_all_type_members()) { /* ... */ }

// NEW: O(1) - just retrieve!
const type_members_map = types.get_flattened_members();
```

**Optimization Status:** ⚠️ **Can Be Optimized** - See Option A in task doc

### Pass 3: Resolve Inheritance Chains

**Current Code:**
```typescript
for (const [type_id, member_info] of types.get_all_type_members()) {  // O(m)
  const scope_id = definitions.get_symbol_scope(type_id);  // O(1) ✅

  if (member_info.extends && member_info.extends.length > 0) {
    const parent_ids: SymbolId[] = [];

    for (const parent_name of member_info.extends) {  // O(e) - usually 1-2
      const parent_id = resolver_index.resolve(scope_id, parent_name, cache);  // O(1)
      if (parent_id) parent_ids.push(parent_id);
    }

    if (parent_ids.length > 0) {
      parent_classes.set(type_id, parent_ids[0]);
      if (parent_ids.length > 1) {
        implemented_interfaces.set(type_id, parent_ids.slice(1));
      }
    }
  }
}
```

**Dependencies:**
- ✅ `type_members.extends` - Available in TypeRegistry
- ✅ `definitions.get_symbol_scope()` - Available in DefinitionRegistry
- ❌ `resolver_index.resolve()` - **NOT available until `resolve_symbols()` is called!**

**Can We Pre-Compute?** NO

**Why Not?**
Same reason as Pass 1 - we need `resolver_index` to resolve parent class names to SymbolIds.

**Optimization Status:** ✅ **Already Optimal**
- Inner operation `get_symbol_scope()` is O(1) via hash map
- The resolve operation is O(1) with caching
- Loop complexity O(m * e) where e is usually 1-2, so practically O(m)
- Can't eliminate without changing architecture

## The Fundamental Limitation

**Why can't we pre-compute Passes 1 & 3?**

The resolution process has a dependency order:

```
1. File Indexing Phase (Project.update_file)
   ├─ Parse file → SemanticIndex
   ├─ Extract definitions → DefinitionRegistry
   ├─ Extract types → TypeRegistry
   ├─ Extract scopes → ScopeRegistry
   └─ We have: definitions, types, scopes
       But NOT: ability to resolve names to symbols across files

2. Resolution Phase (resolve_symbols)
   ├─ Build resolver_index (needs ALL files indexed first!)
   ├─ NOW we can resolve "User" → "SymbolId(User, file.ts, 1:0)"
   └─ Build type_context using resolver
```

**The chicken-and-egg problem:**
- To build resolver_index, we need all scopes from all files
- To resolve type names in Pass 1, we need resolver_index
- Therefore: Pass 1 MUST happen after all files are indexed

**Could we change this?**
Theoretically yes, but it would require a major architectural shift:
1. Build resolver_index incrementally during file indexing
2. Allow partial resolution with later re-resolution
3. Track dependencies for cache invalidation

This is **way** beyond the scope of the current task.

## Summary: What Can We Optimize?

### Already Optimized ✅
- **Pass 1**: Inner operations are O(1) via DefinitionRegistry indexes
- **Pass 3**: Inner operations are O(1) via DefinitionRegistry indexes

### Can Be Optimized ⚠️
- **Pass 2**: Pre-flatten in TypeRegistry.update_file()
  - Complexity: ~1,500 operations → 0 operations
  - Memory cost: Minimal (duplicate pointers)
  - **Recommendation: Do it!**

### Cannot Be Optimized Without Major Architecture Change ❌
- **Pass 1 & 3**: Require resolver_index which is late-binding
  - Would need incremental resolution architecture
  - Out of scope for this task

## Actionable Next Step

Implement **Option A: Pre-Flatten Type Members** as described in the task doc.

This is the only remaining low-hanging fruit. The other passes are already as optimal as they can be given the current architecture.

```typescript
// Add to TypeRegistry
private flattened_members: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();

get_flattened_members(): Map<SymbolId, Map<SymbolName, SymbolId>> {
  return new Map(this.flattened_members);
}

// Update build_type_context
const type_members_map = types.get_flattened_members();  // O(1)!
// Remove entire Pass 2 loop
```

**Estimated effort:** 1-2 hours
**Impact:** Eliminate ~1,500 operations per resolution
**Risk:** Very low - just moving computation to indexing time
