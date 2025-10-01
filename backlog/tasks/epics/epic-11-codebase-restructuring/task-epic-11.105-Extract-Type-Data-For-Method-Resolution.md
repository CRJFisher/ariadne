# Task Epic 11.105: Extract Type Data for Method Resolution

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 7-10 hours
**Dependencies:** None
**Used By:** task-epic-11.109.3 (TypeContext)

## Overview

Extract and preprocess type information during semantic indexing so it's ready for scope-aware resolution in task 11.109. This task focuses exclusively on DATA EXTRACTION - not resolution. Resolution happens in 11.109 using lexical scope walking.

## Problem Statement

To resolve method calls like `obj.method()`, we need:
1. The type of `obj` (from annotations, constructors, or return types)
2. Which type defines `method` (from class/interface member lists)
3. Type alias resolution (TypeAliasDefinition support)

This type data should be extracted once during indexing and stored in `SemanticIndex` for efficient lookup during resolution.

## Solution: Type Data Extraction

Add new fields to `SemanticIndex` containing preprocessed type information:

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
```

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
├── type_bindings.ts              # Extract type annotations
├── constructor_tracking.ts       # Track constructor assignments
├── member_extraction.ts          # Extract type members
├── alias_extraction.ts           # Extract type aliases
└── tests/
    ├── type_bindings.test.ts
    ├── constructor_tracking.test.ts
    ├── member_extraction.test.ts
    └── alias_extraction.test.ts
```

### Data Structures

```typescript
/**
 * Type member information
 */
export interface TypeMemberInfo {
  /** Methods by name */
  readonly methods: ReadonlyMap<SymbolName, SymbolId>;

  /** Properties by name */
  readonly properties: ReadonlyMap<SymbolName, SymbolId>;

  /** Constructor (if any) */
  readonly constructor?: SymbolId;

  /** Types this extends (for inheritance) */
  readonly extends: readonly SymbolName[];
}
```

## Sub-Tasks

### 105.1: Extract Type Annotations (1-2 hours)

Extract type names from explicit annotations:

**Sources:**
- `VariableDefinition.type` → `const x: User`
- `ParameterDefinition.type` → `function f(x: User)`
- `FunctionDefinition.return_type` → `function f(): User`

**Output:** `Map<LocationKey, SymbolName>`

**Example:**
```typescript
// Input: const user: User = getUser();
// Output: {location of 'user' → "User"}
```

### 105.2: Extract Constructor Bindings (1-2 hours)

Extract type associations from constructor calls:

**Sources:**
- `SymbolReference` with `call_type === "constructor"`
- `ref.context.construct_target` → assignment location
- `ref.name` → class name

**Output:** `Map<LocationKey, SymbolName>`

**Example:**
```typescript
// Input: const user = new User();
// Output: {location of 'user' → "User"}
```

### 105.3: Build Type Member Index (2 hours)

Extract members from type definitions:

**Sources:**
- `ClassDefinition.methods` → method names
- `ClassDefinition.properties` → property names
- `ClassDefinition.constructor` → constructor
- `InterfaceDefinition.methods` → method signatures
- `InterfaceDefinition.properties` → property signatures

**Output:** `Map<SymbolId, TypeMemberInfo>`

**Example:**
```typescript
// Input: class User { getName() {} email: string; }
// Output: {
//   User class SymbolId → {
//     methods: {"getName" → getName SymbolId},
//     properties: {"email" → email SymbolId}
//   }
// }
```

### 105.4: Extract Type Alias Metadata (30 minutes)

Extract raw type alias data (NOT resolved):

**Sources:**
- `TypeAliasDefinition.name` → alias name
- `TypeAliasDefinition.type_expression` → target type name (string)

**Output:** `Map<SymbolId, string>` (alias SymbolId → type_expression string)

**Example:**
```typescript
// Input: type UserId = string;
// Output: {UserId SymbolId → "string"}

// Input (imported):
//   import { User } from './user';
//   type MyUser = User;
// Output: {MyUser SymbolId → "User"}
// NOTE: "User" is not resolved to SymbolId here - that's 11.109.3's job!
```

**Important:** This task does NOT resolve type names to SymbolIds. Resolution requires scope-aware lookup (handles imports, shadowing) which is done by 11.109.3 using ScopeResolver.

### 105.5: Integrate into SemanticIndex (1 hour)

Update semantic index:

**Changes:**
1. Add new fields to `SemanticIndex` interface
2. Update `build_semantic_index()` to call extractors
3. Store results in returned index

**Code:**
```typescript
export function build_semantic_index(
  file: ParsedFile,
  tree: Tree,
  language: Language
): SemanticIndex {
  // ... existing passes ...

  // NEW: Extract type data
  const type_bindings = extract_type_bindings(
    builder_result,
    all_references
  );
  const type_members = extract_type_members(builder_result);
  const type_alias_metadata = extract_type_alias_metadata(builder_result.types);

  return {
    // ... existing fields ...
    type_bindings,
    type_members,
    type_alias_metadata,
  };
}
```

### 105.6: Testing (2-3 hours)

Comprehensive tests for all extraction:

**Test Categories:**
- Type annotation extraction (variables, parameters, returns)
- Constructor binding extraction
- Member index building (classes, interfaces)
- Type alias extraction
- Integration with semantic index

**Languages:**
- JavaScript
- TypeScript
- Python
- Rust

## Integration with Task 11.109

### Consumed By 11.109.3 (TypeContext)

```typescript
// In task 11.109.3:
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver
): TypeContext {

  const symbol_types = new Map<SymbolId, SymbolId>();

  for (const [file_path, index] of indices) {
    // USE 11.105's type_bindings
    for (const [location_key, type_name] of index.type_bindings) {
      // Resolve type_name to SymbolId using ScopeResolver
      const type_symbol = scope_resolver.resolve_in_scope(
        type_name,
        get_scope_at_location(location_key)
      );

      // Store symbol → type mapping
      if (type_symbol) {
        const var_symbol = get_symbol_at_location(location_key, index);
        symbol_types.set(var_symbol, type_symbol);
      }
    }
  }

  // USE 11.105's type_members
  // RESOLVE type aliases here using ScopeResolver!
  const type_aliases = new Map<SymbolId, SymbolId>();
  for (const [alias_id, type_expression] of index.type_alias_metadata) {
    const scope_id = get_scope_for_symbol(alias_id);
    const target_id = scope_resolver.resolve_in_scope(type_expression, scope_id);
    if (target_id) {
      type_aliases.set(alias_id, target_id);
    }
  }

  return new TypeContext(
    symbol_types,
    index.type_members,
    type_aliases  // Resolved by 11.109.3, not by 11.105!
  );
}
```

### Used By 11.109.5 (Method Resolution)

Indirectly through TypeContext:

```typescript
// Method resolver uses TypeContext
// TypeContext uses 11.105's extracted data
const method_symbol = type_context.get_type_member(receiver_type, method_name);
```

## Key Design Decisions

### 1. Preprocessing, Not Resolution

**Do:**
- ✅ Extract type names from source
- ✅ Build lookup indexes
- ✅ Store in SemanticIndex

**Don't:**
- ❌ Resolve type names to SymbolIds (that's scope-aware, done by 11.109)
- ❌ Resolve receivers (done by 11.109.5)
- ❌ Resolve method calls (done by 11.109.5)

### 2. Location in index_single_file/

Type data is file-specific and extracted during indexing, so it lives with other indexing code.

### 3. Store Names, Not Symbols

Store `SymbolName` (strings), not `SymbolId`:
- Type name resolution is scope-aware
- Must be done by 11.109's ScopeResolver
- Can't resolve during indexing (don't have scope context)

### 4. Leverage SymbolReference

SymbolReference already has rich context:
- `construct_target` - constructor assignments
- `type_info` - type annotations
- `return_type` - return types

Just extract and organize this data.

### 5. Integrate TypeAliasDefinition

`TypeAliasDefinition` from `definition_builder.ts` is now properly integrated into type resolution pipeline.

## Benefits

### Clear Separation
- **11.105**: Data extraction (indexing phase)
- **11.109**: Resolution (analysis phase)

### Performance
- Extract once, use many times
- Cached in SemanticIndex
- No re-extraction during resolution

### Testability
- Test extraction independently
- Mock data for resolution tests
- Clear interfaces

### Maintainability
- Small, focused functions
- Single responsibility
- Easy to enhance

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

## Non-Goals

- ❌ Type name resolution (that's 11.109.1's job)
- ❌ Receiver resolution (that's 11.109.5's job)
- ❌ Method resolution (that's 11.109.5's job)
- ❌ Full type inference (future work)
- ❌ Generic type resolution (future work)

## Timeline

**Total: 7-10 hours**
- 105.1: Type annotations (1-2h)
- 105.2: Constructor bindings (1-2h)
- 105.3: Member indexing (2h)
- 105.4: Type alias metadata (30min)
- 105.5: Integration (1h)
- 105.6: Testing (2-3h)

## Related Work

- **task-epic-11.109**: Uses this extracted data for resolution
- **task-epic-11.109.3**: TypeContext consumes this data
- **SymbolReference**: Source of type information
- **TypeAliasDefinition**: Integrated for type aliases

## Next Steps

After completion:
1. Task 11.109.3 builds TypeContext using this data
2. Task 11.109.5 uses TypeContext for method resolution
3. Enhanced data enables accurate method call resolution
