# Task epic-11.116.1: Design Semantic Index JSON Schema

**Status:** Completed
**Parent:** task-epic-11.116
**Priority:** High (blocks all subsequent tasks)
**Created:** 2025-10-14

## Overview

Design the JSON schema for serializing `SemanticIndex` objects. This is the foundation for the entire fixture system - we only create JSON for semantic index outputs, not for registries or call graphs.

## Objectives

1. Design JSON representation of SemanticIndex type
2. Define folder structure for fixtures
3. Create TypeScript types for JSON schema
4. Document design decisions and rationale

## Scope

The fixture system uses JSON for semantic index outputs. These fixtures serve as inputs for registry and call graph integration tests.

**Scope boundaries:**

- JSON fixtures represent semantic index outputs only
- Registry and call graph outputs are verified with code assertions
- Folder structure: `fixtures/{language}/code/` and `fixtures/{language}/semantic_index/`
- Serialization strategy converts Maps to Objects

## Detailed Design

### 1. Folder Structure

```
packages/core/tests/fixtures/
├── typescript/
│   ├── code/                          # Source .ts files
│   │   ├── classes/
│   │   │   ├── basic_class.ts
│   │   │   ├── inheritance.ts
│   │   │   └── methods.ts
│   │   ├── functions/
│   │   │   ├── call_chains.ts
│   │   │   ├── recursive.ts
│   │   │   └── async.ts
│   │   └── modules/
│   │       ├── exports.ts
│   │       ├── imports.ts
│   │       └── re_exports.ts
│   └── semantic_index/                # Generated JSON
│       ├── classes/
│       │   ├── basic_class.json       ← SemanticIndex JSON
│       │   ├── inheritance.json
│       │   └── methods.json
│       ├── functions/
│       │   ├── call_chains.json
│       │   ├── recursive.json
│       │   └── async.json
│       └── modules/
│           ├── exports.json
│           ├── imports.json
│           └── re_exports.json
├── python/ (same structure)
├── rust/ (same structure)
└── javascript/ (same structure)
```

**Naming convention:**

- Code files: `{feature}.{ext}` (e.g., `basic_class.ts`)
- JSON files: `{feature}.json` (e.g., `basic_class.json`)
- Match names between code/ and semantic_index/ directories

### 2. JSON Schema Design

**Core principle:** JSON must be a faithful, complete representation of `SemanticIndex`.

**SemanticIndex type:**

The schema serializes the `SemanticIndex` interface from [semantic_index.ts:52-72](../../../packages/core/src/index_single_file/semantic_index.ts#L52-L72):

```typescript
export interface SemanticIndex {
  readonly file_path: FilePath;
  readonly language: Language;
  readonly root_scope_id: ScopeId;

  /** Scope data */
  readonly scopes: ReadonlyMap<ScopeId, LexicalScope>;

  /** Definitions */
  readonly functions: ReadonlyMap<SymbolId, FunctionDefinition>;
  readonly classes: ReadonlyMap<SymbolId, ClassDefinition>;
  readonly variables: ReadonlyMap<SymbolId, VariableDefinition>;
  readonly interfaces: ReadonlyMap<SymbolId, InterfaceDefinition>;
  readonly enums: ReadonlyMap<SymbolId, EnumDefinition>;
  readonly namespaces: ReadonlyMap<SymbolId, NamespaceDefinition>;
  readonly types: ReadonlyMap<SymbolId, TypeAliasDefinition>;
  readonly imported_symbols: ReadonlyMap<SymbolId, ImportDefinition>;

  /** References */
  readonly references: readonly SymbolReference[];
}
```

**JSON representation:**

```json
{
  "file_path": "test.ts",
  "language": "typescript",
  "root_scope_id": "scope:test.ts:module",
  "scopes": {
    "scope:test.ts:module": {
      "id": "scope:test.ts:module",
      "type": "module",
      "parent_id": null,
      "name": null,
      "location": {
        "file_path": "test.ts",
        "start_line": 1,
        "start_column": 0,
        "end_line": 10,
        "end_column": 0
      },
      "child_ids": ["scope:test.ts:function:foo"]
    }
  },
  "functions": {
    "function:test.ts:foo:1:0": {
      "kind": "function",
      "symbol_id": "function:test.ts:foo:1:0",
      "name": "foo",
      "scope_id": "scope:test.ts:module",
      "defining_scope_id": "scope:test.ts:module",
      "body_scope_id": "scope:test.ts:function:foo",
      "location": {
        "file_path": "test.ts",
        "start_line": 1,
        "start_column": 0,
        "end_line": 3,
        "end_column": 1
      },
      "parameters": [],
      "is_exported": true,
      "signature": {
        "parameters": []
      }
    }
  },
  "classes": {},
  "variables": {},
  "interfaces": {},
  "enums": {},
  "namespaces": {},
  "types": {},
  "imported_symbols": {},
  "references": [
    {
      "type": "call",
      "call_type": "function",
      "name": "bar",
      "location": {
        "file_path": "test.ts",
        "start_line": 2,
        "start_column": 2,
        "end_line": 2,
        "end_column": 7
      },
      "scope_id": "scope:test.ts:function:foo"
    }
  ]
}
```

**Key design decisions:**

1. **ReadonlyMaps → Objects:** Serialize ReadonlyMap<K, V> as `{ [key: string]: V }`

   - Rationale: Human-readable, diffable, standard JSON
   - Trade-off: Keys must be strings (they are - SymbolId, ScopeId are string brands)
   - Note: JSON has no concept of readonly; deserialization will restore ReadonlyMap

2. **Keep branded types as strings:** SymbolId, ScopeId, FilePath, Language stay as strings

   - Rationale: Simple, readable, no special deserialization logic
   - Branded types are just string types at runtime

3. **Preserve all fields:** Every field from SemanticIndex must be in JSON (13 fields total)

   - file_path, language, root_scope_id
   - 8 definition maps (functions, classes, variables, interfaces, enums, namespaces, types, imported_symbols)
   - scopes map
   - references array
   - Rationale: Complete representation, no information loss

4. **Empty collections as `{}`/`[]`:** Show structure even when empty

   - Rationale: Makes schema clear, easier to understand fixture structure

5. **Formatting:** Pretty-print with 2-space indentation

   - Rationale: Readable diffs, easy manual inspection

6. **Readonly arrays:** `readonly SymbolReference[]` serializes as regular JSON array
   - JSON has no readonly concept; deserialization restores readonly

### 3. TypeScript Types

The `SemanticIndexJSON` interface in [semantic_index_json.ts](../../../packages/core/tests/fixtures/semantic_index_json.ts) represents the JSON schema:

```typescript
/**
 * JSON representation of SemanticIndex
 * ReadonlyMaps are converted to objects with string keys
 */
export interface SemanticIndexJSON {
  file_path: string;
  language: string;
  root_scope_id: string;
  scopes: Record<string, LexicalScope>;
  functions: Record<string, FunctionDefinition>;
  classes: Record<string, ClassDefinition>;
  variables: Record<string, VariableDefinition>;
  interfaces: Record<string, InterfaceDefinition>;
  enums: Record<string, EnumDefinition>;
  namespaces: Record<string, NamespaceDefinition>;
  types: Record<string, TypeAliasDefinition>;
  imported_symbols: Record<string, ImportDefinition>;
  references: SymbolReference[];
}
```

### 4. Feature Categories

Fixtures are organized by language feature:

**TypeScript:**

- `classes/` - Classes, inheritance, methods, properties
- `functions/` - Functions, arrow functions, async/await
- `interfaces/` - Interface definitions, extends
- `types/` - Type aliases, unions, intersections
- `generics/` - Generic functions, classes, constraints
- `modules/` - Imports, exports, re-exports
- `enums/` - Enum definitions
- `decorators/` - Class/method/property decorators

**Python:**

- `classes/` - Classes, inheritance, methods
- `functions/` - Functions, decorators
- `modules/` - Imports, from imports

**Rust:**

- `functions/` - Functions, closures
- `structs/` - Struct definitions
- `enums/` - Enum definitions
- `traits/` - Trait definitions
- `impls/` - Impl blocks
- `modules/` - Module imports

**JavaScript:**

- `classes/` - ES6 classes
- `functions/` - Functions, arrow functions
- `modules/` - CommonJS and ES6 modules

## Deliverables

- [x] Document finalized folder structure
- [x] Define JSON schema with example
- [x] Create `SemanticIndexJSON` TypeScript type
- [x] List feature categories for each language
- [x] Document design rationale
- [x] Get approval on schema before implementation

## Success Criteria

- ✅ Schema covers all SemanticIndex fields
- ✅ JSON is human-readable and diffable
- ✅ Maps have clear conversion strategy
- ✅ Folder structure mirrors code organization
- ✅ TypeScript types match JSON structure

## Estimated Effort

**2-3 hours**

- 1 hour: Design and document JSON schema
- 0.5 hours: Define folder structure
- 0.5 hours: Create TypeScript types
- 0.5-1 hour: Review and refinement

## Next Steps

After completion:

- Proceed to **116.2**: Implement serialization/deserialization
- The schema designed here becomes the contract for all tooling

## Notes

- Schema stability is critical - changes require fixture regeneration
- JSON files are version controlled alongside code
- Scope is limited to semantic index only

## Implementation Notes

**Completed:** 2025-10-15

### Implementation Summary

Created the JSON schema infrastructure in [semantic_index_json.ts](../../../packages/core/tests/fixtures/semantic_index_json.ts):

**Core functions:**

- `semantic_index_to_json()` - Convert SemanticIndex to JSON object
- `json_to_semantic_index()` - Convert JSON object back to SemanticIndex
- `semantic_index_to_json_string()` - Serialize to formatted JSON string
- `json_string_to_semantic_index()` - Deserialize from JSON string

**Folder structure:**

Each language has two parallel directories:

- `code/{category}/` - Source code files organized by feature
- `semantic_index/{category}/` - Corresponding JSON fixture outputs

Implemented categories: TypeScript (8), Python (3), JavaScript (3), Rust (6).

**Serialization approach:**

- ReadonlyMap → Record<string, V> using `Object.fromEntries()`
- Record<string, V> → ReadonlyMap using `new Map(Object.entries())`
- Branded types remain as strings (no special handling)
- Readonly arrays serialize as regular JSON arrays
- 2-space indentation for readable git diffs

**Next task:** 116.2 (Implement serialization/deserialization utilities and tests)
