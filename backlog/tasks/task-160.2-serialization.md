---
id: task-160.2
title: Serialization for cached data
status: To Do
assignee: []
created_date: '2025-11-24'
labels: [performance, architecture]
dependencies: [task-160.1]
parent_task_id: task-160
---

## Description

Implement serialization and deserialization functions for `SemanticIndex` and resolution data. This enables caching to persistent storage (filesystem, database) and ensures data integrity through roundtrip consistency.

## Challenge

The `SemanticIndex` and resolution data use TypeScript `Map` and `Set` types, which don't serialize to JSON directly. We need to convert these to arrays for storage and back to Maps/Sets on load.

Additionally, we use branded types (`SymbolId`, `ScopeId`, `FilePath`) which are strings at runtime but have type-level branding. These serialize naturally but need proper typing on deserialization.

## Deliverables

### 1. Semantic Index Serialization

```typescript
// packages/core/src/cache/serialization.ts

import type { SemanticIndex } from '../index_single_file/semantic_index'
import type { SerializedSemanticIndex } from './cache_types'

/**
 * Serialize a SemanticIndex to a JSON-compatible format.
 */
export function serialize_semantic_index(index: SemanticIndex): SerializedSemanticIndex {
  return {
    file_path: index.file_path,
    language: index.language,
    root_scope_id: index.root_scope_id,
    scopes: serialize_map(index.scopes, serialize_scope),
    functions: serialize_map(index.functions),
    classes: serialize_map(index.classes),
    variables: serialize_map(index.variables),
    interfaces: serialize_map(index.interfaces),
    enums: serialize_map(index.enums),
    namespaces: serialize_map(index.namespaces),
    types: serialize_map(index.types),
    imported_symbols: serialize_map(index.imported_symbols),
    references: index.references,
  }
}

/**
 * Deserialize a SerializedSemanticIndex back to a SemanticIndex.
 */
export function deserialize_semantic_index(data: SerializedSemanticIndex): SemanticIndex {
  return {
    file_path: data.file_path as FilePath,
    language: data.language as Language,
    root_scope_id: data.root_scope_id as ScopeId,
    scopes: deserialize_map(data.scopes, deserialize_scope),
    functions: deserialize_map(data.functions),
    classes: deserialize_map(data.classes),
    variables: deserialize_map(data.variables),
    interfaces: deserialize_map(data.interfaces),
    enums: deserialize_map(data.enums),
    namespaces: deserialize_map(data.namespaces),
    types: deserialize_map(data.types),
    imported_symbols: deserialize_map(data.imported_symbols),
    references: data.references,
  }
}
```

### 2. Resolution Serialization

```typescript
/**
 * Serialize name resolutions (Map<ScopeId, Map<SymbolName, SymbolId>>).
 */
export function serialize_name_resolutions(
  resolutions: Map<ScopeId, Map<SymbolName, SymbolId>>
): SerializedNameResolutions {
  const resolutions_by_scope: Array<[string, Array<[string, string]>]> = []

  for (const [scope_id, name_map] of resolutions) {
    const names: Array<[string, string]> = []
    for (const [name, symbol_id] of name_map) {
      names.push([name, symbol_id])
    }
    resolutions_by_scope.push([scope_id, names])
  }

  return { resolutions_by_scope }
}

/**
 * Deserialize name resolutions.
 */
export function deserialize_name_resolutions(
  data: SerializedNameResolutions
): Map<ScopeId, Map<SymbolName, SymbolId>> {
  const result = new Map<ScopeId, Map<SymbolName, SymbolId>>()

  for (const [scope_id, names] of data.resolutions_by_scope) {
    const name_map = new Map<SymbolName, SymbolId>()
    for (const [name, symbol_id] of names) {
      name_map.set(name as SymbolName, symbol_id as SymbolId)
    }
    result.set(scope_id as ScopeId, name_map)
  }

  return result
}

/**
 * Serialize call references (already JSON-compatible, just pass through).
 */
export function serialize_call_resolutions(calls: CallReference[]): SerializedCallReferences {
  return { calls }
}

/**
 * Deserialize call references.
 */
export function deserialize_call_resolutions(data: SerializedCallReferences): CallReference[] {
  return data.calls as CallReference[]
}
```

### 3. Helper Functions

```typescript
/**
 * Convert Map to array of [key, value] pairs.
 */
function serialize_map<K, V, S = V>(
  map: Map<K, V>,
  serialize_value?: (v: V) => S
): Array<[string, S]> {
  const result: Array<[string, S]> = []
  for (const [key, value] of map) {
    const serialized = serialize_value ? serialize_value(value) : (value as unknown as S)
    result.push([String(key), serialized])
  }
  return result
}

/**
 * Convert array of [key, value] pairs back to Map.
 */
function deserialize_map<K extends string, V, S = V>(
  entries: Array<[string, S]>,
  deserialize_value?: (s: S) => V
): Map<K, V> {
  const result = new Map<K, V>()
  for (const [key, value] of entries) {
    const deserialized = deserialize_value ? deserialize_value(value) : (value as unknown as V)
    result.set(key as K, deserialized)
  }
  return result
}

/**
 * Serialize LexicalScope (convert children Set to array).
 */
function serialize_scope(scope: LexicalScope): SerializedLexicalScope {
  return {
    scope_id: scope.scope_id,
    parent_scope_id: scope.parent_scope_id,
    scope_type: scope.scope_type,
    location: scope.location,
    children: Array.from(scope.children),
  }
}

/**
 * Deserialize LexicalScope.
 */
function deserialize_scope(data: SerializedLexicalScope): LexicalScope {
  return {
    scope_id: data.scope_id as ScopeId,
    parent_scope_id: data.parent_scope_id as ScopeId | null,
    scope_type: data.scope_type as ScopeType,
    location: data.location as Location,
    children: new Set(data.children.map(c => c as ScopeId)),
  }
}
```

## Files to Modify

- `packages/core/src/cache/serialization.ts` (create)
- `packages/core/src/cache/index.ts` (add exports)

## Acceptance Criteria

- [ ] `serialize_semantic_index()` / `deserialize_semantic_index()` implemented
- [ ] `serialize_name_resolutions()` / `deserialize_name_resolutions()` implemented
- [ ] `serialize_call_resolutions()` / `deserialize_call_resolutions()` implemented
- [ ] All Map/Set types properly converted to/from arrays
- [ ] Branded types properly cast on deserialization
- [ ] Functions exported from barrel

## Testing

- [ ] Roundtrip test: `deserialize(serialize(index))` equals original
- [ ] Test with empty maps/sets
- [ ] Test with nested maps (scopes contain children)
- [ ] Test with various definition types
- [ ] Test with real semantic index from test fixtures
