# Task 11.105.5: Integrate into SemanticIndex

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1 hour
**Parent:** task-epic-11.105
**Dependencies:** 105.1, 105.2, 105.3, 105.4

## Objective

Add the extracted type data fields to `SemanticIndex` interface and update `build_semantic_index()` to call the extraction functions. This makes the type data available to task 11.109 for resolution.

## Implementation

### File Changes

**Files to modify:**
1. `packages/core/src/index_single_file/semantic_index.ts` - Interface + builder
2. `packages/core/src/index_single_file/type_preprocessing/index.ts` - Public API

### Step 1: Update SemanticIndex Interface

In `semantic_index.ts`:

```typescript
/**
 * Semantic Index - Single-file analysis results with type preprocessing
 */
export interface SemanticIndex {
  // ... existing fields (file_path, language, scopes, etc.) ...

  /** Symbol definitions by type */
  readonly functions: ReadonlyMap<SymbolId, FunctionDefinition>;
  readonly classes: ReadonlyMap<SymbolId, ClassDefinition>;
  readonly variables: ReadonlyMap<SymbolId, VariableDefinition>;
  readonly interfaces: ReadonlyMap<SymbolId, InterfaceDefinition>;
  readonly enums: ReadonlyMap<SymbolId, EnumDefinition>;
  readonly namespaces: ReadonlyMap<SymbolId, NamespaceDefinition>;
  readonly types: ReadonlyMap<SymbolId, TypeAliasDefinition>;
  readonly imported_symbols: ReadonlyMap<SymbolId, ImportDefinition>;

  /** All symbol references */
  readonly references: readonly SymbolReference[];

  /** Quick lookup: name -> symbols with that name */
  readonly symbols_by_name: ReadonlyMap<SymbolName, readonly SymbolId[]>;

  // NEW: Type preprocessing fields for task 11.109
  /**
   * Type bindings: location → type name
   *
   * Maps variable/parameter locations to their type names (strings).
   * Extracted from type annotations and constructor calls.
   *
   * Resolution (string → SymbolId) happens in task 11.109.3 using ScopeResolver.
   */
  readonly type_bindings: ReadonlyMap<LocationKey, SymbolName>;

  /**
   * Type members: type SymbolId → methods/properties
   *
   * Maps class/interface SymbolIds to their members for efficient
   * method lookup during resolution.
   *
   * Used by task 11.109.3 (TypeContext) for method resolution.
   */
  readonly type_members: ReadonlyMap<SymbolId, TypeMemberInfo>;

  /**
   * Type alias metadata: alias SymbolId → type_expression string
   *
   * Maps type aliases to their target type names (strings, not resolved).
   * Resolution happens in task 11.109.3 using ScopeResolver.
   *
   * Example: type MyUser = User → {MyUser id → "User" string}
   */
  readonly type_alias_metadata: ReadonlyMap<SymbolId, string>;
}
```

### Step 2: Update build_semantic_index()

In `semantic_index.ts`:

```typescript
export function build_semantic_index(
  file: ParsedFile,
  tree: Tree,
  language: Language
): SemanticIndex {
  // PASS 1: Query tree-sitter for captures
  const captures: QueryCapture[] = query_tree(language, tree);
  const capture_nodes: CaptureNode[] = /* ... convert ... */;

  // PASS 2: Build scope tree
  const scopes = process_scopes(capture_nodes, file);
  const context = create_processing_context(scopes, capture_nodes);

  // PASS 3: Process definitions with language-specific config
  const language_config = get_language_config(language);
  const builder_result = process_definitions(context, language_config);

  // PASS 4: Process references with language-specific metadata extractors
  const metadata_extractors = get_metadata_extractors(language);
  const all_references = process_references(
    context,
    metadata_extractors,
    file.file_path
  );

  // PASS 5: Build name index
  const symbols_by_name = build_name_index(builder_result);

  // PASS 6: Extract type data (NEW)
  const {
    type_bindings,
    type_members,
    type_alias_metadata
  } = extract_type_data(builder_result, all_references);

  // Return complete semantic index
  return {
    file_path: file.file_path,
    language,
    root_scope_id: context.root_scope_id,
    scopes: context.scopes,
    functions: builder_result.functions,
    classes: builder_result.classes,
    variables: builder_result.variables,
    interfaces: builder_result.interfaces,
    enums: builder_result.enums,
    namespaces: builder_result.namespaces,
    types: builder_result.types,
    imported_symbols: builder_result.imports,
    references: all_references,
    symbols_by_name,
    // NEW: Type preprocessing fields
    type_bindings,
    type_members,
    type_alias_metadata,
  };
}
```

### Step 3: Create extract_type_data() helper

In `semantic_index.ts`:

```typescript
import {
  extract_type_annotations,
  extract_constructor_bindings,
  extract_type_members,
  extract_type_alias_metadata,
} from "./type_preprocessing";

/**
 * Extract all type data for method resolution
 *
 * Combines extraction from multiple sources into unified data structures.
 * This data will be used by task 11.109.3 (TypeContext) for method resolution.
 */
function extract_type_data(
  builder_result: BuilderResult,
  references: readonly SymbolReference[]
): {
  type_bindings: ReadonlyMap<LocationKey, SymbolName>;
  type_members: ReadonlyMap<SymbolId, TypeMemberInfo>;
  type_alias_metadata: ReadonlyMap<SymbolId, string>;
} {
  // Extract type annotations from definitions (105.1)
  const type_annotations = extract_type_annotations(builder_result);

  // Extract constructor bindings from references (105.2)
  const constructor_bindings = extract_constructor_bindings(references);

  // Merge annotations and constructor bindings
  // Constructor bindings take precedence (more specific)
  const type_bindings = new Map<LocationKey, SymbolName>([
    ...type_annotations,
    ...constructor_bindings,
  ]);

  // Extract type members from class/interface definitions (105.3)
  const type_members = extract_type_members(builder_result);

  // Extract type alias metadata from type definitions (105.4)
  const type_alias_metadata = extract_type_alias_metadata(builder_result.types);

  return {
    type_bindings,
    type_members,
    type_alias_metadata,
  };
}
```

### Step 4: Create public API in type_preprocessing/index.ts

```typescript
/**
 * Type Preprocessing for Method Resolution
 *
 * Extracts type information during semantic indexing for use by
 * task 11.109 (scope-aware resolution).
 *
 * This module does DATA EXTRACTION only - not resolution.
 * Resolution happens in task 11.109 using lexical scope walking.
 */

export { extract_type_annotations } from "./type_bindings";
export { extract_constructor_bindings } from "./constructor_tracking";
export {
  extract_type_members,
  type TypeMemberInfo,
} from "./member_extraction";
export { extract_type_alias_metadata } from "./alias_extraction";
```

## Test Coverage

### Integration Test

Create `semantic_index.type_preprocessing.test.ts`:

```typescript
import { describe, test, expect } from "vitest";
import { build_semantic_index } from "./semantic_index";
import { parse_file } from "./file_utils";

describe("SemanticIndex type preprocessing", () => {
  test("includes type bindings from annotations", () => {
    const code = `
      class User {}
      const user: User = getUser();
    `;

    const file = parse_file("test.ts", code);
    const index = build_semantic_index(file, file.tree, "typescript");

    // Should have type binding for user variable
    expect(index.type_bindings.size).toBeGreaterThan(0);

    // Find user variable location and check binding
    const user_binding = Array.from(index.type_bindings.entries())
      .find(([loc, type]) => type === "User");

    expect(user_binding).toBeDefined();
  });

  test("includes type bindings from constructors", () => {
    const code = `
      class User {}
      const user = new User();
    `;

    const file = parse_file("test.ts", code);
    const index = build_semantic_index(file, file.tree, "typescript");

    // Should have binding from constructor
    const user_binding = Array.from(index.type_bindings.entries())
      .find(([loc, type]) => type === "User");

    expect(user_binding).toBeDefined();
  });

  test("includes type members", () => {
    const code = `
      class User {
        getName() { return ""; }
        email: string;
      }
    `;

    const file = parse_file("test.ts", code);
    const index = build_semantic_index(file, file.tree, "typescript");

    // Find User class
    const user_class = Array.from(index.classes.values())
      .find(c => c.name === "User");

    expect(user_class).toBeDefined();

    // Should have type members for User class
    const user_members = index.type_members.get(user_class.symbol_id);

    expect(user_members).toBeDefined();
    expect(user_members.methods.has("getName")).toBe(true);
    expect(user_members.properties.has("email")).toBe(true);
  });

  test("includes type alias metadata", () => {
    const code = `
      class User {}
      type MyUser = User;
    `;

    const file = parse_file("test.ts", code);
    const index = build_semantic_index(file, file.tree, "typescript");

    // Find MyUser type alias
    const myuser_alias = Array.from(index.types.values())
      .find(t => t.name === "MyUser");

    expect(myuser_alias).toBeDefined();

    // Should have metadata (string, not resolved)
    const alias_metadata = index.type_alias_metadata.get(myuser_alias.symbol_id);

    expect(alias_metadata).toBe("User");
  });

  test("complete type preprocessing pipeline", () => {
    const code = `
      class User {
        getName(): string { return ""; }
        email: string;
      }

      type MyUser = User;

      const user1: User = getUser();
      const user2 = new User();
      const user3: MyUser = getUser();
    `;

    const file = parse_file("test.ts", code);
    const index = build_semantic_index(file, file.tree, "typescript");

    // All type preprocessing fields should be populated
    expect(index.type_bindings.size).toBeGreaterThan(0);
    expect(index.type_members.size).toBeGreaterThan(0);
    expect(index.type_alias_metadata.size).toBeGreaterThan(0);
  });
});
```

## Success Criteria

### Functional
- ✅ New fields added to SemanticIndex interface
- ✅ build_semantic_index() calls all extractors
- ✅ Type data correctly stored in index
- ✅ No breaking changes to existing code

### Testing
- ✅ Integration test verifies all fields populated
- ✅ All existing tests still pass
- ✅ Type checking passes

### Code Quality
- ✅ Clear JSDoc on new fields
- ✅ Well-structured extraction helper
- ✅ Public API exported cleanly

## Dependencies

**Uses:**
- Tasks 105.1, 105.2, 105.3, 105.4 (extraction functions)
- Existing SemanticIndex structure

**No external dependencies**

## Next Steps

After completion:
- Task 11.105.6 adds comprehensive tests
- Task 11.109.3 consumes this data to build TypeContext
- Type data enables method resolution in 11.109.5

## Technical Notes

### Binding Precedence

When both annotation and constructor exist:
```typescript
const user: User = new User();
```

Constructor binding overwrites annotation binding (more specific). This is achieved by spreading constructor_bindings after type_annotations in the Map constructor.

### Performance

Type extraction adds ~5-10% overhead to semantic indexing (acceptable).

### Backwards Compatibility

Existing code not using type fields continues to work unchanged. The new fields are additive only.
