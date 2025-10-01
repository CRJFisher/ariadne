# Task 11.105: Type Data Extraction - README

## Quick Start

**Purpose:** Extract type data during indexing for use by task 11.109's scope-aware resolution.

**Read These In Order:**

1. **[COORDINATION-WITH-11.109.md](task-epic-11.105-COORDINATION-WITH-11.109.md)** - How 11.105 and 11.109 work together
2. **[Extract-Type-Data-For-Method-Resolution.md](task-epic-11.105-Extract-Type-Data-For-Method-Resolution.md)** - Main task description
3. **[SUB-TASKS-REVISED.md](task-epic-11.105-SUB-TASKS-REVISED.md)** - Detailed implementation plan

## TL;DR

**What:** Extract type information during semantic indexing
**Where:** `packages/core/src/index_single_file/type_preprocessing/`
**Why:** Prepare data for 11.109's scope-aware method resolution
**Time:** 7-10 hours

**What We Extract:**

1. Type annotations (`const x: User`)
2. Constructor bindings (`const x = new User()`)
3. Type members (class methods/properties)
4. Type alias metadata (`type UserId = string` → stores "string", NOT resolved)

**What We DON'T Do:**

- ❌ Resolve type names to symbols (that's 11.109.1's job)
- ❌ Resolve receivers (that's 11.109.5's job)
- ❌ Resolve method calls (that's 11.109.5's job)

**Output:** Enhanced `SemanticIndex` with new fields:

```typescript
interface SemanticIndex {
  readonly type_bindings: ReadonlyMap<LocationKey, SymbolName>;
  readonly type_members: ReadonlyMap<SymbolId, TypeMemberInfo>;
  readonly type_alias_metadata: ReadonlyMap<SymbolId, string>;  // NOT resolved
}
```

## Task Split: 11.105 vs 11.109

```
┌─────────────────────────────────────────────────┐
│ INDEXING PHASE (11.105)                         │
│ Extract type data, store in SemanticIndex       │
│                                                  │
│ 105.1: Type annotations                         │
│ 105.2: Constructor bindings                     │
│ 105.3: Type members                             │
│ 105.4: Type alias metadata                      │
│ 105.5: Integration                              │
│                                                  │
│ Output: SemanticIndex with type data            │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ RESOLUTION PHASE (11.109)                       │
│ Use extracted data for scope-aware resolution   │
│                                                  │
│ 109.1: ScopeResolver (name → symbol)            │
│ 109.3: TypeContext (uses 11.105's data)         │
│ 109.5: Method resolution (uses both)            │
│                                                  │
│ Output: Resolved references                     │
└─────────────────────────────────────────────────┘
```

## Architecture Decision

**Original Design (WRONG):**

- Complete standalone resolution system
- Had its own TypeContext, receiver resolver, method resolver
- Overlapped with 11.109's scope-aware resolution
- Would create two parallel resolution systems

**Revised Design (CORRECT):**

- **11.105**: Data extraction layer (lower level)

  - Extract type data during indexing
  - Store in SemanticIndex
  - No resolution logic

- **11.109**: Resolution layer (higher level)
  - Use ScopeResolver for name resolution
  - Use TypeContext (built from 11.105's data)
  - Resolve method calls using both

**Benefits:**

- ✅ No duplication
- ✅ Clear separation of concerns
- ✅ Preprocessing done once, used many times
- ✅ Works with scope-aware resolution

## Implementation Order

1. **11.105** (7-10 hours) - Extract type data
2. **11.109.1** (3-4 days) - ScopeResolver
3. **11.109.3** (5-6 days) - TypeContext (uses 11.105's data)
4. **11.109.5** (4-5 days) - Method resolution (uses both)

## Files to Read

### Essential

- [COORDINATION-WITH-11.109.md](task-epic-11.105-COORDINATION-WITH-11.109.md) - **START HERE**
- [Extract-Type-Data-For-Method-Resolution.md](task-epic-11.105-Extract-Type-Data-For-Method-Resolution.md)
- [SUB-TASKS-REVISED.md](task-epic-11.105-SUB-TASKS-REVISED.md)

### For Context

- [task-epic-11.109.3-Implement-Type-Context.md](task-epic-11.109.3-Implement-Type-Context.md) - Consumes our data
- [task-epic-11.109.5-Implement-Method-Call-Resolution.md](task-epic-11.109.5-Implement-Method-Call-Resolution.md) - Uses our data indirectly

## Quick Reference

### Data Structures

```typescript
// Type bindings: where → what type
type TypeBindings = Map<LocationKey, SymbolName>;

// Type members: type → its methods/properties
interface TypeMemberInfo {
  methods: ReadonlyMap<SymbolName, SymbolId>;
  properties: ReadonlyMap<SymbolName, SymbolId>;
  constructor?: SymbolId;
  extends: readonly SymbolName[];
}
type TypeMembers = Map<SymbolId, TypeMemberInfo>;

// Type alias metadata: alias → type_expression string (NOT resolved)
type TypeAliasMetadata = Map<SymbolId, string>;
```

### Sub-Tasks

1. **105.1** - Extract type annotations (1-2h)
2. **105.2** - Extract constructor bindings (1-2h)
3. **105.3** - Build type member index (2h)
4. **105.4** - Extract type alias metadata (30min)
5. **105.5** - Integrate into SemanticIndex (1h)
6. **105.6** - Testing (2-3h)

**Total: 7-10 hours**

## Success Criteria

- ✅ Type data extracted correctly
- ✅ Added to SemanticIndex
- ✅ Format matches 11.109.3's expectations
- ✅ All 4 languages supported
- ✅ Comprehensive tests
- ✅ >90% code coverage
- ✅ No performance regression

## Questions?

Read the COORDINATION document first - it explains the full architecture and how 11.105 and 11.109 work together.
