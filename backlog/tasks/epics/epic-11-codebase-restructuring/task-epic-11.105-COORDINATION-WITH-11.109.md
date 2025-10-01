# Coordination: Tasks 11.105 and 11.109

## Overview

Tasks 11.105 and 11.109 work together to enable method call resolution:

- **11.105**: Type data extraction layer (lower level)
- **11.109**: Scope-aware resolution using extracted data (higher level)

## Architecture Split

### Task 11.105: Type Data Extraction (Preprocessing)

**Purpose:** Extract and organize type information from `SemanticIndex` so it's ready for resolution.

**Location:** `packages/core/src/index_single_file/type_preprocessing/`

**Responsibilities:**

1. Extract type annotations from definitions (variables, parameters, returns)
2. Extract constructor-type associations from references
3. Build type→members indexes from classes/interfaces
4. Build type alias maps from TypeAliasDefinition
5. Prepare data structures for efficient lookup

**Output:** Enhanced data structures added to `SemanticIndex`:

```typescript
interface SemanticIndex {
  // ... existing fields ...

  // NEW from 11.105:
  readonly type_bindings: ReadonlyMap<LocationKey, SymbolName>;
  readonly type_members: ReadonlyMap<SymbolId, TypeMemberInfo>;
  readonly type_aliases: ReadonlyMap<SymbolId, SymbolId>;
}
```

**Does NOT:**

- ❌ Resolve names to symbols (that's scope-aware, done by 11.109.1)
- ❌ Resolve receivers (done by 11.109.5)
- ❌ Resolve method calls (done by 11.109.5)

### Task 11.109: Scope-Aware Resolution (Runtime)

**Purpose:** Resolve all references using lexical scope walking + type information.

**Location:** `packages/core/src/resolve_references/`

**Responsibilities:**

1. **11.109.1**: ScopeResolver - Universal name→symbol resolution
2. **11.109.2**: ImportResolver - Cross-file resolution
3. **11.109.3**: TypeContext - Consume 11.105's data + use ScopeResolver
4. **11.109.5**: MethodResolver - Use ScopeResolver + TypeContext

**Uses 11.105's Output:**

- Type bindings for determining variable types
- Type members for method lookup
- Type aliases for type name resolution

## Data Flow

```
Phase 1: Indexing (11.105)
─────────────────────────
Parse file → SemanticIndex (base)
↓
Extract type annotations → type_bindings
Extract type members → type_members
Extract type aliases → type_aliases
↓
SemanticIndex (enhanced with type data)

Phase 2: Resolution (11.109)
─────────────────────────────
SemanticIndex (enhanced) → Build ScopeResolver (11.109.1)
SemanticIndex (enhanced) → Build ImportResolver (11.109.2)
SemanticIndex (enhanced) + ScopeResolver → Build TypeContext (11.109.3)
↓
References + ScopeResolver + TypeContext
↓
Resolve method calls (11.109.5):
  1. Resolve receiver name using ScopeResolver → receiver SymbolId
  2. Get receiver type from TypeContext → type SymbolId
  3. Look up method in type_members → method SymbolId
```

## Task 11.105 Redesign

**Old Design (Incorrect):**

- Complete standalone resolution system
- Had its own TypeContext
- Did receiver resolution
- Did method resolution
- Overlapped with 11.109.3 and 11.109.5

**New Design (Correct):**

- **Data extraction only**
- Preprocesses type information during indexing
- Adds type data to SemanticIndex
- Used by 11.109's resolution phases

### New 11.105 Sub-Tasks

**105.1**: Extract Type Annotations (1-2h)

- From VariableDefinition.type
- From ParameterDefinition.type
- From FunctionDefinition.return_type
- Output: `Map<LocationKey, SymbolName>`

**105.2**: Extract Constructor Bindings (1-2h)

- From constructor call references
- Track construct_target → class name
- Output: `Map<LocationKey, SymbolName>`

**105.3**: Build Type Member Index (2h)

- From ClassDefinition (methods, properties)
- From InterfaceDefinition (methods, properties)
- Track inheritance chains
- Output: `Map<SymbolId, TypeMemberInfo>`

**105.4**: Extract Type Alias Metadata (30min)

- From TypeAliasDefinition
- Extract type_expression strings
- Store raw alias data (NOT resolved)
- Output: `Map<SymbolId, SymbolName>` (alias → type_expression SymbolName)

**105.5**: Integrate into SemanticIndex (1h)

- Add new fields to interface
- Update build_semantic_index()
- Add to semantic index builder

**105.6**: Testing (2-3h)

- Test type annotation extraction
- Test constructor binding extraction
- Test member indexing
- Test type alias extraction

**Total: 7-10 hours** (type alias resolution moved to 11.109.3)

## Task 11.109.3: TypeContext

**Consumes 11.105's Output:**

```typescript
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver
): TypeContext {
  // 1. Resolve type bindings from 11.105
  const symbol_types = new Map<SymbolId, SymbolId>();

  for (const [file_path, index] of indices) {
    // Resolve type names to type SymbolIds using ScopeResolver
    for (const [location_key, type_name] of index.type_bindings) {
      const scope_id = get_scope_at_location(location_key);
      const type_symbol = scope_resolver.resolve_in_scope(type_name, scope_id);
      if (type_symbol) {
        const var_symbol = get_symbol_at_location(location_key, index);
        if (var_symbol) {
          symbol_types.set(var_symbol, type_symbol);
        }
      }
    }
  }

  // 2. Use preprocessed type members from 11.105
  // Already in index.type_members

  // 3. RESOLVE type aliases (NOT in 11.105!)
  const type_aliases = new Map<SymbolId, SymbolId>();
  for (const [file_path, index] of indices) {
    // index.type_alias_metadata has alias → type_expression string
    for (const [alias_id, type_expression] of index.type_alias_metadata) {
      // Resolve type_expression using ScopeResolver
      const scope_id = get_scope_for_symbol(alias_id, index);
      const target_id = scope_resolver.resolve_in_scope(type_expression, scope_id);
      if (target_id) {
        type_aliases.set(alias_id, target_id);
      }
    }
  }

  return new TypeContext(symbol_types, index.type_members, type_aliases);
}
```

## Task 11.109.5: Method Resolution

**Uses both:**

```typescript
export function resolve_method_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver, // From 11.109.1
  type_context: TypeContext // From 11.109.3 (which uses 11.105)
): MethodCallMap {
  for (const call_ref of method_calls) {
    // Step 1: Resolve receiver using ScopeResolver
    const receiver_symbol = scope_resolver.resolve_in_scope(
      extract_receiver_name(call_ref),
      call_ref.scope_id
    );

    // Step 2: Get receiver type using TypeContext
    const receiver_type = type_context.get_symbol_type(receiver_symbol);

    // Step 3: Look up method using TypeContext
    const method_symbol = type_context.get_type_member(
      receiver_type,
      call_ref.name
    );

    // Method symbol resolved!
  }
}
```

## Benefits of This Split

### Clear Separation

- **11.105**: Data extraction (happens during indexing)
- **11.109**: Resolution (happens during analysis)

### No Duplication

- Only one ScopeResolver (11.109.1)
- Only one TypeContext (11.109.3)
- Only one method resolver (11.109.5)

### Proper Layering

```
Level 1: SemanticIndex (base definitions + references)
Level 2: Type data extraction (11.105) → Enhanced SemanticIndex
Level 3: Scope + Import resolution (11.109.1, 11.109.2)
Level 4: Type context (11.109.3) uses Level 2 + Level 3
Level 5: Call resolution (11.109.5) uses Level 3 + Level 4
```

### Testability

- 11.105: Test data extraction independently
- 11.109.1: Test scope walking independently
- 11.109.3: Test TypeContext with mocked data
- 11.109.5: Test method resolution end-to-end

### Performance

- 11.105: Done once during indexing, cached in SemanticIndex
- 11.109: Uses preprocessed data, no re-extraction

## Implementation Order

1. **11.105 first** (8-11 hours)

   - Extract type data
   - Add to SemanticIndex
   - Ready for 11.109 to consume

2. **11.109.1** (3-4 days)

   - ScopeResolver
   - Foundation for name resolution

3. **11.109.2** (3-4 days)

   - Import resolution
   - Uses ScopeResolver

4. **11.109.3** (5-6 days)

   - TypeContext
   - Uses 11.105's data + ScopeResolver

5. **11.109.4** (2-3 days)

   - Function call resolution
   - Uses ScopeResolver

6. **11.109.5** (4-5 days)

   - Method call resolution
   - Uses ScopeResolver + TypeContext

7. **11.109.6-9** (remaining tasks)

## Success Criteria

### 11.105

- ✅ Type data extracted correctly
- ✅ Added to SemanticIndex
- ✅ Efficient data structures
- ✅ All languages supported
- ✅ Comprehensive tests

### 11.109

- ✅ ScopeResolver uses lexical scoping
- ✅ TypeContext consumes 11.105's data
- ✅ Method resolution uses both correctly
- ✅ All tests pass
- ✅ Proper integration

### Integration

- ✅ 11.105's output format matches 11.109.3's expectations
- ✅ No duplication between tasks
- ✅ Clear data flow
- ✅ Well-documented interfaces
