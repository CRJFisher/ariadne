# Task 11.105: Extract Type Data for Method Resolution

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 7-10 hours
**Parent:** epic-11
**Dependencies:** None
**Used By:** task-epic-11.109.3 (TypeContext)

## Objective

Extract and preprocess type information during semantic indexing to enable scope-aware method resolution in task 11.109. This task focuses exclusively on **data extraction** - not resolution. Resolution happens in 11.109 using lexical scope walking.

## Background

To resolve method calls like `obj.method()`, we need:
1. The type of `obj` (from annotations, constructors, or return types)
2. Which type defines `method` (from class/interface member lists)
3. Type alias metadata (TypeAliasDefinition support)

This type data should be extracted once during indexing and stored in `SemanticIndex` for efficient lookup during resolution.

## Architecture

### Location

`packages/core/src/index_single_file/type_preprocessing/`

**Why in index_single_file?**
- Preprocessing happens during indexing
- Results stored in SemanticIndex
- Available to all resolution phases

### Module Structure

```
packages/core/src/index_single_file/type_preprocessing/
├── index.ts                      # Public API
├── type_bindings.ts              # Extract type annotations (105.1)
├── constructor_tracking.ts       # Track constructor assignments (105.2)
├── member_extraction.ts          # Extract type members (105.3)
├── alias_extraction.ts           # Extract type alias metadata (105.4)
└── tests/
    ├── type_bindings.test.ts
    ├── constructor_tracking.test.ts
    ├── member_extraction.test.ts
    └── alias_extraction.test.ts
```

### Enhanced SemanticIndex

```typescript
interface SemanticIndex {
  // ... existing fields ...

  /**
   * Type bindings: location → type name
   * Extracted from annotations, constructors, return types
   */
  readonly type_bindings: ReadonlyMap<LocationKey, SymbolName>;

  /**
   * Type members: type → methods/properties
   * Extracted from classes, interfaces
   */
  readonly type_members: ReadonlyMap<SymbolId, TypeMemberInfo>;

  /**
   * Type alias metadata: alias → type_expression string
   * Extracted from TypeAliasDefinition (NOT resolved - that's 11.109.3's job)
   */
  readonly type_alias_metadata: ReadonlyMap<SymbolId, string>;
}

interface TypeMemberInfo {
  readonly methods: ReadonlyMap<SymbolName, SymbolId>;
  readonly properties: ReadonlyMap<SymbolName, SymbolId>;
  readonly constructor?: SymbolId;
  readonly extends: readonly SymbolName[];
}
```

## Sub-Tasks

### 11.105.1: Extract Type Annotations (1-2 hours)

Extract type names from explicit annotations.

**Sources:**
- `VariableDefinition.type`
- `ParameterDefinition.type`
- `FunctionDefinition.return_type`

**Output:** `Map<LocationKey, SymbolName>`

---

### 11.105.2: Extract Constructor Bindings (1-2 hours)

Track constructor → variable assignments.

**Sources:**
- `SymbolReference` with `call_type === "constructor"`
- `ref.context.construct_target`

**Output:** `Map<LocationKey, SymbolName>`

---

### 11.105.3: Build Type Member Index (2 hours)

Extract members from type definitions.

**Sources:**
- `ClassDefinition.methods`, `properties`, `constructor`
- `InterfaceDefinition.methods`, `properties`

**Output:** `Map<SymbolId, TypeMemberInfo>`

---

### 11.105.4: Extract Type Alias Metadata (30 minutes)

Extract raw type alias data (NOT resolved).

**Sources:**
- `TypeAliasDefinition.type_expression`

**Output:** `Map<SymbolId, string>` (strings, not SymbolIds!)

**Important:** Resolution (string → SymbolId) happens in 11.109.3 using ScopeResolver.

---

### 11.105.5: Integrate into SemanticIndex (1 hour)

Add extraction to indexing pipeline.

**Changes:**
1. Add new fields to `SemanticIndex` interface
2. Update `build_semantic_index()` to call extractors
3. Store results in returned index

---

### 11.105.6: Comprehensive Testing (2-3 hours)

Test all extraction across 4 languages (JS, TS, Python, Rust).

**Coverage Goals:**
- Line coverage: >90%
- Branch coverage: >85%
- Function coverage: 100%

## Integration with Task 11.109

### Consumed By 11.109.3 (TypeContext)

```typescript
// In task 11.109.3:
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver
): TypeContext {
  // 1. Resolve type bindings from 11.105
  const symbol_types = new Map<SymbolId, SymbolId>();

  for (const [file_path, index] of indices) {
    for (const [location_key, type_name] of index.type_bindings) {
      // Use ScopeResolver to resolve type_name → SymbolId
      const scope_id = get_scope_at_location(location_key);
      const type_symbol = scope_resolver.resolve_in_scope(type_name, scope_id);

      if (type_symbol) {
        const var_symbol = get_symbol_at_location(location_key, index);
        symbol_types.set(var_symbol, type_symbol);
      }
    }
  }

  // 2. Use preprocessed type_members from 11.105
  // Already in index.type_members

  // 3. RESOLVE type aliases using ScopeResolver
  const type_aliases = new Map<SymbolId, SymbolId>();
  for (const [alias_id, type_expression] of index.type_alias_metadata) {
    const scope_id = get_scope_for_symbol(alias_id);
    const target_id = scope_resolver.resolve_in_scope(type_expression, scope_id);
    if (target_id) {
      type_aliases.set(alias_id, target_id);
    }
  }

  return new TypeContext(symbol_types, index.type_members, type_aliases);
}
```

## Key Design Decisions

### 1. Preprocessing, Not Resolution

**Do:**
- ✅ Extract type names from source (strings)
- ✅ Build lookup indexes
- ✅ Store in SemanticIndex

**Don't:**
- ❌ Resolve type names to SymbolIds (requires scope-aware lookup → 11.109)
- ❌ Resolve receivers (requires scope + types → 11.109.5)
- ❌ Resolve method calls (requires scope + types → 11.109.5)

### 2. Store Names, Not Symbols

Store `SymbolName` (strings), not `SymbolId`:
- Type name resolution is scope-aware (handles imports, shadowing)
- Must be done by 11.109's ScopeResolver
- Can't resolve during indexing (don't have scope context)

### 3. Type Alias Metadata Only

Task 11.105.4 extracts `type_expression` strings, does NOT resolve them.

**Example:**
```typescript
// file1.ts
export class User {}

// file2.ts
import { User } from './file1';
type MyUser = User;

// 11.105.4 extracts: {MyUser SymbolId → "User"}
// 11.109.3 resolves: "User" → User SymbolId (via import resolution!)
```

### 4. Leverage SymbolReference

SymbolReference already captures type information:
- `construct_target` - constructor assignments
- `type_info` - type annotations
- `return_type` - return types

Just extract and organize this data.

## Success Criteria

### Functional
- ✅ Type annotations extracted correctly
- ✅ Constructor bindings extracted correctly
- ✅ Type members indexed correctly
- ✅ Type alias metadata extracted correctly (strings, not resolved)
- ✅ All 4 languages supported

### Integration
- ✅ Fields added to SemanticIndex
- ✅ Data format matches 11.109.3's expectations
- ✅ Efficient lookup structures

### Testing
- ✅ Unit tests for each extractor
- ✅ Integration tests with semantic index
- ✅ All languages tested
- ✅ >90% code coverage

### Code Quality
- ✅ Pythonic naming (`snake_case`)
- ✅ Full JSDoc documentation
- ✅ Type-safe implementation
- ✅ No performance regressions

## Dependencies

**Uses (already available):**
- SemanticIndex with definitions and references
- SymbolReference with type context
- TypeAliasDefinition
- BuilderResult

**Consumed by:**
- task-epic-11.109.3 (TypeContext)
- task-epic-11.109.5 (Method resolution, indirectly)

## Timeline

**Total: 7-10 hours**

| Task | Effort | Dependencies |
|------|--------|--------------|
| 105.1 | 1-2h   | None         |
| 105.2 | 1-2h   | None         |
| 105.3 | 2h     | None         |
| 105.4 | 30min  | None         |
| 105.5 | 1h     | 105.1-105.4  |
| 105.6 | 2-3h   | 105.1-105.5  |

## Next Steps

After completion:
1. Task 11.109.1 implements ScopeResolver
2. Task 11.109.3 builds TypeContext using this data + ScopeResolver
3. Task 11.109.5 uses TypeContext for method resolution
4. Enhanced data enables accurate method call resolution

## Non-Goals

- ❌ Type name resolution (that's 11.109.1's job with ScopeResolver)
- ❌ Receiver resolution (that's 11.109.5's job)
- ❌ Method resolution (that's 11.109.5's job)
- ❌ Full type inference (future work)
- ❌ Generic type resolution (future work)

## References

- **Coordination doc:** See task-epic-11.105-COORDINATION-WITH-11.109.md for architecture
- **Task 11.109:** Uses this extracted data for resolution
- **Task 11.109.3:** TypeContext consumes this data
- **SymbolReference:** Source of type information
- **TypeAliasDefinition:** Integrated for type alias metadata
