# Task: Make Properties and Methods First-Class Definitions

**Status**: Open
**Epic**: epic-11 - Codebase Restructuring
**Priority**: High
**Estimated Effort**: 2-3 days
**Dependencies**: Builds on task-epic-11.150 (property type extraction)
**Created**: 2025-10-23

## Problem

Properties and methods have `SymbolId`s and need to be looked up in the DefinitionRegistry, but they are **not stored as first-class definitions**. This creates an architectural inconsistency that requires hacky workarounds.

### The Hacky Code

In [definition_registry.ts:161-208](packages/core/src/resolve_references/registries/definition_registry.ts#L161-L208), the `get_symbol_scope()` method contains 40+ lines of string-parsing code to handle property/method symbols:

```typescript
get_symbol_scope(symbol_id: SymbolId): ScopeId | undefined {
  const def = this.by_symbol.get(symbol_id);
  if (def) {
    return def.defining_scope_id;
  }

  // HACK: Properties/methods not in by_symbol, must parse symbol ID
  if (symbol_id.startsWith("property:") || symbol_id.startsWith("method:")) {
    const parts = symbol_id.split(":");
    // Extract file path by finding first numeric part...
    let file_path_parts = [];
    for (let i = 1; i < parts.length; i++) {
      if (/^\d+$/.test(parts[i])) break;
      file_path_parts.push(parts[i]);
    }
    const file_path = file_path_parts.join(":");

    // Search ALL classes in file to find containing one...
    const file_symbols = this.by_file.get(file_path as FilePath);
    if (file_symbols) {
      for (const class_symbol_id of file_symbols) {
        const class_def = this.by_symbol.get(class_symbol_id);
        if (class_def && (class_def.kind === "class" || class_def.kind === "interface")) {
          // Linear search through properties/methods...
          const has_property = class_def.properties.some(p => p.symbol_id === symbol_id);
          const has_method = class_def.methods.some(m => m.symbol_id === symbol_id);
          if (has_property || has_method) {
            return class_def.defining_scope_id;
          }
        }
      }
    }
  }

  return undefined;
}
```

**Issues**:
- ❌ String parsing to extract file paths
- ❌ O(n) file-wide search through all classes
- ❌ O(m) linear search through class members
- ❌ Fragile: breaks if symbol ID format changes
- ❌ Not maintainable: special-case code proliferates
- ❌ Poor performance: ~O(n*m) for each lookup

### Recent Context

This hack was added while fixing property type binding resolution (2025-10-23). The proper fix is to make properties/methods first-class entities.

**What triggered this:**
- Property types were being extracted (`imports: ImportGraph`)
- Type binding resolution failed because `get_symbol_at_location()` couldn't find properties
- Added properties to `location_to_symbol` map (partial fix)
- Type resolution then failed because `get_symbol_scope()` couldn't find property scopes
- Added hacky string-parsing workaround

**Result**: Property chain resolution now works (`this.imports.update_file()` resolves correctly), but the code is unmaintainable.

## Root Cause Analysis

### Current Architecture

**Properties and methods are second-class citizens:**

1. **Not in `by_symbol` map**
   ```typescript
   // Only top-level definitions registered
   for (const def of definitions) {
     this.by_symbol.set(def.symbol_id, def);  // ✅ Classes, functions
     // ❌ Properties/methods NOT added
   }
   ```

2. **Not directly accessible**
   ```typescript
   // Stored only as nested arrays
   class_def.properties: PropertyDefinition[]
   class_def.methods: MethodDefinition[]
   ```

3. **Missing scope information**
   ```typescript
   interface PropertyDefinition {
     symbol_id: SymbolId;
     name: string;
     location: Location;
     type?: string;
     // ❌ defining_scope_id is MISSING
   }
   ```

### Why This Is Wrong

**Principle violated**: If something has a `SymbolId`, it should be queryable as a first-class definition.

All other definitions work this way:
```typescript
const def = registry.get_definition(symbol_id);  // O(1) lookup
const scope = registry.get_symbol_scope(symbol_id);  // O(1) lookup
```

Properties and methods should too.

## Proposed Solution

**Core principle**: If something has a SymbolId, it should be first-class in the registry.

### Changes Overview

1. ✅ **Add `defining_scope_id` to property/method types** (upstream in @ariadnejs/types)
2. ✅ **Set `defining_scope_id` when building properties/methods** (all language builders)
3. ✅ **Register properties/methods in `by_symbol` map** (DefinitionRegistry)
4. ✅ **Simplify `get_symbol_scope()`** to simple map lookup
5. ✅ **Remove 40+ lines of hacky code**

### After Refactoring

```typescript
get_symbol_scope(symbol_id: SymbolId): ScopeId | undefined {
  const def = this.by_symbol.get(symbol_id);
  return def?.defining_scope_id;
}
```

**That's it.** No special cases. No string parsing. O(1) lookup.

### Benefits

✅ **O(1) lookups** instead of O(n*m) string parsing
✅ **Architectural consistency** - all symbols work the same way
✅ **Better performance** - no file-wide searches
✅ **Type safety** - PropertyDefinition/MethodDefinition have complete metadata
✅ **Easier to maintain** - one code path for all definitions
✅ **No special cases** - properties/methods work like any other symbol

### Trade-offs

**Denormalization**: Properties/methods stored in TWO places:
1. In `by_symbol` map (for fast lookup)
2. In `class.properties` array (for type member queries)

**Why this is acceptable:**
- Read-heavy workload (lookups >> writes)
- Memory overhead is minimal (just references, not copies)
- Common pattern in databases (denormalized indexes)
- Consistency is easy to maintain (both set in same place)
- Performance gain justifies minor duplication

## Implementation Steps

### Step 1: Update Type Definitions

**File**: `packages/types/src/semantic_index.ts`

Add `defining_scope_id` to property and method types:

```typescript
interface PropertyDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;  // ← ADD THIS
  type?: string;
  modifiers?: string[];
}

interface MethodDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;  // ← ADD THIS
  parameters: ParameterDefinition[];
  return_type?: string;
  modifiers?: string[];
  is_async?: boolean;
  is_static?: boolean;
  is_abstract?: boolean;
}
```

### Step 2: Update Language Builders

Set `defining_scope_id` when creating property/method definitions.

**Key insight**: Properties and methods are defined in the **class body scope**, which is the same as the class's `defining_scope_id`.

#### TypeScript Builder

**File**: `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`

```typescript
// When building properties (around line 584)
function extract_property_type(node: SyntaxNode): string | undefined {
  // ... existing code ...
}

function build_property(
  node: SyntaxNode,
  class_def: ClassDefinition,
  context: BuildContext
): PropertyDefinition {
  return {
    symbol_id: property_symbol(...),
    name: property_name,
    location: property_location,
    defining_scope_id: class_def.defining_scope_id,  // ← ADD THIS
    type: extract_property_type(node),
  };
}

// Similarly for methods
function build_method(
  node: SyntaxNode,
  class_def: ClassDefinition,
  context: BuildContext
): MethodDefinition {
  return {
    symbol_id: method_symbol(...),
    name: method_name,
    location: method_location,
    defining_scope_id: class_def.defining_scope_id,  // ← ADD THIS
    parameters: extract_parameters(node),
    return_type: extract_return_type(node),
    // ... other fields
  };
}
```

**Repeat for**:
- `javascript_builder.ts` (same pattern)
- `python_builder.ts` (same pattern)
- `rust_metadata.ts` (same pattern, but for structs/traits)

### Step 3: Update DefinitionRegistry

**File**: `packages/core/src/resolve_references/registries/definition_registry.ts`

Register properties and methods as first-class definitions:

```typescript
update_file(file_id: FilePath, definitions: AnyDefinition[]): void {
  this.remove_file(file_id);
  const symbol_ids = new Set<SymbolId>();

  for (const def of definitions) {
    // Register top-level definition
    this.by_symbol.set(def.symbol_id, def);
    this.location_to_symbol.set(location_key(def.location), def.symbol_id);
    symbol_ids.add(def.symbol_id);

    // Add to scope index (existing code)
    if (def.kind !== "import") {
      const scope_id = def.defining_scope_id;
      if (!this.by_scope.has(scope_id)) {
        this.by_scope.set(scope_id, new Map());
      }
      this.by_scope.get(scope_id)!.set(def.name as SymbolName, def.symbol_id);
    }

    // Register nested members as first-class definitions
    if (def.kind === "class" || def.kind === "interface") {
      const flat_members = new Map<SymbolName, SymbolId>();

      // Register methods
      for (const method of def.methods) {
        // ← ADD: Register as first-class definition
        this.by_symbol.set(method.symbol_id, method);
        this.location_to_symbol.set(location_key(method.location), method.symbol_id);
        // Note: Don't add to by_file or by_scope (methods belong to class)

        flat_members.set(method.name, method.symbol_id);
      }

      // Register properties
      for (const prop of def.properties) {
        // ← ADD: Register as first-class definition
        this.by_symbol.set(prop.symbol_id, prop);
        this.location_to_symbol.set(location_key(prop.location), prop.symbol_id);
        // Note: Don't add to by_file or by_scope (properties belong to class)

        flat_members.set(prop.name, prop.symbol_id);
      }

      this.member_index.set(def.symbol_id, flat_members);
    }
  }

  this.by_file.set(file_id, symbol_ids);
  this.scope_to_definitions_index.set(file_id, this.build_scope_to_definitions_index(definitions));
}
```

**Note**: Property/method location cleanup in `remove_file()` is already done (from previous fix).

### Step 4: Simplify get_symbol_scope()

**File**: `packages/core/src/resolve_references/registries/definition_registry.ts`

Replace the entire hacky section (lines 161-208) with:

```typescript
/**
 * Get the defining scope for a symbol.
 * Fast O(1) lookup that finds the definition and returns its defining_scope_id.
 *
 * @param symbol_id - The symbol to look up
 * @returns The ScopeId where this symbol is defined, or undefined if not found
 */
get_symbol_scope(symbol_id: SymbolId): ScopeId | undefined {
  const def = this.by_symbol.get(symbol_id);
  return def?.defining_scope_id;
}
```

**Delete**: Lines 167-205 (the string-parsing hack)

### Step 5: Run Tests

```bash
# Run all tests
npm test

# Specifically verify:
npm test -- definition_registry.test.ts
npm test -- typescript_builder.test.ts
npm test -- javascript_builder.test.ts
npm test -- python_builder.test.ts
npm test -- rust_metadata.test.ts

# Run integration tests
npm test -- semantic_index.test.ts

# Verify property type resolution still works
npx tsx analyze_self.ts
# Should show 120 entry points (same as before)
```

## Files to Modify

### Core Type Definitions
1. **`packages/types/src/semantic_index.ts`**
   - Add `defining_scope_id: ScopeId` to PropertyDefinition
   - Add `defining_scope_id: ScopeId` to MethodDefinition

### Language Builders (Set defining_scope_id)
2. **`packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`**
   - Update property building to set `defining_scope_id`
   - Update method building to set `defining_scope_id`

3. **`packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`**
   - Update property building to set `defining_scope_id`
   - Update method building to set `defining_scope_id`

4. **`packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts`**
   - Update property building to set `defining_scope_id`
   - Update method building to set `defining_scope_id`

5. **`packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts`**
   - Update struct field building to set `defining_scope_id`
   - Update method building to set `defining_scope_id`

### Registry Changes
6. **`packages/core/src/resolve_references/registries/definition_registry.ts`**
   - Update `update_file()` to register properties/methods in `by_symbol`
   - Simplify `get_symbol_scope()` to remove string-parsing hack (lines 167-205)

## Validation

### Automated Tests

All existing tests must pass:
- ✅ 21 definition_registry tests
- ✅ All language builder tests
- ✅ All semantic_index integration tests
- ✅ Property type resolution tests (from task 11.150.1)

### Manual Validation

1. **Verify property chain resolution still works**:
   ```bash
   npx tsx analyze_self.ts
   # Entry points should be 120 (not increase)
   # update_file methods should NOT appear
   ```

2. **Verify code simplicity**:
   - Check `get_symbol_scope()` is < 10 lines
   - No special-case code for properties/methods
   - No string parsing

3. **Verify performance**:
   ```bash
   time npm test
   # Should be same or faster than before
   ```

## Acceptance Criteria

- [ ] PropertyDefinition has `defining_scope_id` field
- [ ] MethodDefinition has `defining_scope_id` field
- [ ] All language builders set `defining_scope_id` when building properties/methods
- [ ] Properties registered in DefinitionRegistry.by_symbol
- [ ] Methods registered in DefinitionRegistry.by_symbol
- [ ] `get_symbol_scope()` simplified to < 10 lines
- [ ] No string-parsing code for symbol lookups
- [ ] All existing tests pass (no regressions)
- [ ] Entry point count stays at 120
- [ ] Property chain resolution still works

## Success Metrics

**Before**:
- `get_symbol_scope()`: 48 lines with string parsing
- Property/method lookups: O(n*m) worst case
- Special-case code: 40+ lines
- Technical debt: HIGH

**After**:
- `get_symbol_scope()`: 3 lines, O(1) lookup
- Property/method lookups: O(1)
- Special-case code: 0 lines
- Technical debt: LOW

**Impact**:
- ✅ Cleaner architecture
- ✅ Better performance
- ✅ Easier to maintain
- ✅ Foundation for future features

## Notes

### Why Not Add to by_file?

Properties and methods should NOT be added to `by_file` index because:
- They logically belong to their containing class
- File-level queries should return top-level definitions only
- Prevents duplicate results when querying file symbols

### Why Denormalization Is OK

This is a classic database indexing pattern:
- **Normalized storage**: Class definition owns properties/methods
- **Denormalized indexes**: Properties/methods also in by_symbol for fast lookup
- **Consistency**: Both updated in same transaction (update_file)
- **Read optimization**: Lookups are O(1) instead of O(n)

### Migration Strategy

This is a **breaking change** to the type definitions. However:
1. All language builders are in the same monorepo
2. TypeScript will catch all missing fields at compile time
3. No external API changes (Project API unchanged)
4. Safe to deploy: old code won't compile, forcing fixes

## Related Tasks

- **task-epic-11.150**: Property type extraction (provides the types)
- **task-epic-11.133**: Method resolution metadata (provides receiver_location)
- **task-epic-11.136**: Method call resolution (will benefit from clean architecture)

## Future Work

After this refactoring, we could consider:
1. Adding constructor parameters as first-class definitions
2. Adding enum members as first-class definitions
3. Unifying all nested definition patterns

But those are optional. This task focuses on the most pressing issue: properties and methods.
