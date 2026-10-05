# Task: Extract DerivedData from SemanticIndex

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Not Started
**Priority**: High
**Complexity**: Medium

## Overview

Extract derived indexing structures from `SemanticIndex` into a separate `DerivedData` interface. This creates a clear separation between raw parsing output (SemanticIndex) and indexed lookup structures (DerivedData).

## Goals

1. Create new `DerivedData` interface containing:
   - `type_bindings`: Map<SymbolId, TypeInfo>
   - `type_members`: Map<SymbolId, Member[]>
   - `type_alias_metadata`: Map<SymbolId, TypeAliasInfo>
   - `exported_symbols`: Set<SymbolId>
   - `scope_to_definitions`: Map<ScopeId, SymbolId[]>

2. Implement `build_derived_data()` function that constructs DerivedData from SemanticIndex

3. Remove these fields from SemanticIndex interface

4. Update all code that accesses these fields

## Current State

`SemanticIndex` currently contains:
```typescript
interface SemanticIndex {
  definitions: Definition[]
  references: Reference[]
  scopes: Scope[]

  // These should be extracted:
  type_bindings: Map<SymbolId, TypeInfo>
  type_members: Map<SymbolId, Member[]>
  type_alias_metadata: Map<SymbolId, TypeAliasInfo>
  exported_symbols: Set<SymbolId>
  scope_to_definitions: Map<ScopeId, SymbolId[]>
}
```

## Detailed Implementation Plan

### Step 1: Create DerivedData Interface

**File**: `packages/core/src/index_single_file/derived_data.ts` (new file)

```typescript
import type { SymbolId, ScopeId, FileId } from '@ariadnejs/types'
import type { TypeInfo, Member, TypeAliasInfo } from '../types'

/**
 * Derived indexing structures computed from SemanticIndex.
 * These structures enable fast lookups but are derived from the
 * raw parsing output (definitions, references, scopes).
 */
export interface DerivedData {
  /** The file this data was derived from */
  file_id: FileId

  /** Symbol → its declared or inferred type */
  type_bindings: Map<SymbolId, TypeInfo>

  /** Type SymbolId → its members (for classes, interfaces, structs, etc.) */
  type_members: Map<SymbolId, Member[]>

  /** Type alias SymbolId → what it resolves to */
  type_alias_metadata: Map<SymbolId, TypeAliasInfo>

  /** Symbols that this file exports (for import resolution) */
  exported_symbols: Set<SymbolId>

  /** Scope → symbols defined directly in that scope */
  scope_to_definitions: Map<ScopeId, SymbolId[]>
}
```

### Step 2: Implement build_derived_data() Function

**File**: `packages/core/src/index_single_file/derived_data.ts`

```typescript
import type { SemanticIndex } from './semantic_index'

/**
 * Build derived indexing structures from a SemanticIndex.
 *
 * This function extracts and indexes:
 * - Type bindings from definitions
 * - Type members from class/interface/struct definitions
 * - Type aliases and their resolved types
 * - Exported symbols (based on export statements)
 * - Scope → definition mapping for fast lookup
 *
 * @param semantic_index - The raw parsing output
 * @returns Indexed structures for fast lookups
 */
export function build_derived_data(semantic_index: SemanticIndex): DerivedData {
  const type_bindings = new Map<SymbolId, TypeInfo>()
  const type_members = new Map<SymbolId, Member[]>()
  const type_alias_metadata = new Map<SymbolId, TypeAliasInfo>()
  const exported_symbols = new Set<SymbolId>()
  const scope_to_definitions = new Map<ScopeId, SymbolId[]>()

  // Extract type bindings from definitions
  // (This logic currently exists in semantic_index.ts)
  for (const def of semantic_index.definitions) {
    // Extract type annotation if present
    if (def.type_annotation) {
      type_bindings.set(def.symbol_id, def.type_annotation)
    }

    // Extract members for classes, interfaces, etc.
    if (def.entity_type === 'class' ||
        def.entity_type === 'interface' ||
        def.entity_type === 'struct') {
      if (def.members && def.members.length > 0) {
        type_members.set(def.symbol_id, def.members)
      }
    }

    // Extract type alias metadata
    if (def.entity_type === 'type_alias') {
      if (def.resolved_type) {
        type_alias_metadata.set(def.symbol_id, {
          alias_id: def.symbol_id,
          resolved_type: def.resolved_type,
          location: def.location
        })
      }
    }

    // Track scope → definitions
    if (!scope_to_definitions.has(def.scope_id)) {
      scope_to_definitions.set(def.scope_id, [])
    }
    scope_to_definitions.get(def.scope_id)!.push(def.symbol_id)
  }

  // Extract exported symbols
  // (This logic may need to be extracted from semantic_index.ts)
  // Look for export statements, exported definitions, etc.
  for (const def of semantic_index.definitions) {
    if (def.is_exported) {
      exported_symbols.add(def.symbol_id)
    }
  }

  return {
    file_id: semantic_index.file_id,
    type_bindings,
    type_members,
    type_alias_metadata,
    exported_symbols,
    scope_to_definitions
  }
}
```

### Step 3: Update SemanticIndex Interface

**File**: `packages/core/src/index_single_file/semantic_index.ts`

**Remove** the following fields from `SemanticIndex`:
- `type_bindings`
- `type_members`
- `type_alias_metadata`
- `exported_symbols`
- `scope_to_definitions`

**Updated interface**:
```typescript
export interface SemanticIndex {
  file_id: FileId
  definitions: Definition[]
  references: Reference[]
  scopes: Scope[]
  imports: Import[]  // ensure this exists
}
```

**Update `build_semantic_index()` return statement**:
```typescript
export function build_semantic_index(
  file_id: FileId,
  content: string
): SemanticIndex {
  // ... existing parsing logic ...

  return {
    file_id,
    definitions,
    references,
    scopes,
    imports
    // REMOVED: type_bindings, type_members, etc.
  }
}
```

### Step 4: Update All Code That Accesses Removed Fields

**Files to update**:
1. `packages/core/src/resolve_references/symbol_resolution.ts`
   - Currently accesses `semantic_index.type_bindings`, etc.
   - For now, call `build_derived_data()` at the top of `resolve_symbols()`
   - Later (in sub-task 138.9), this will be refactored to use registries

2. `packages/core/src/index_single_file/semantic_index.*.test.ts` (all language tests)
   - Tests that check `semantic_index.type_bindings`
   - Update to use `derived_data = build_derived_data(semantic_index)`
   - Check `derived_data.type_bindings` instead

**Example refactor for symbol_resolution.ts**:
```typescript
import { build_derived_data } from '../index_single_file/derived_data'

export function resolve_symbols(
  semantic_index: SemanticIndex,
  // ... other params ...
): Map<ReferenceId, SymbolId> {
  // TEMPORARY: Build derived data here
  // This will be removed in sub-task 138.9 when we accept registries
  const derived = build_derived_data(semantic_index)

  // Use derived.type_bindings instead of semantic_index.type_bindings
  // ...
}
```

**Example test update**:
```typescript
// Before:
const semantic_index = build_semantic_index(file_id, code)
expect(semantic_index.type_bindings.get(symbol_id)).toEqual(expected_type)

// After:
const semantic_index = build_semantic_index(file_id, code)
const derived = build_derived_data(semantic_index)
expect(derived.type_bindings.get(symbol_id)).toEqual(expected_type)
```

### Step 5: Update Type Definitions

**File**: `packages/core/src/types/index.ts` (or wherever TypeAliasInfo is defined)

Ensure `TypeAliasInfo` is properly exported if it's used in DerivedData:
```typescript
export interface TypeAliasInfo {
  alias_id: SymbolId
  resolved_type: TypeInfo
  location: Location
}
```

## Testing Strategy

### Unit Tests for build_derived_data()

**File**: `packages/core/src/index_single_file/derived_data.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest'
import { build_semantic_index } from './semantic_index'
import { build_derived_data } from './derived_data'
import { file_id } from '@ariadnejs/types'

describe('build_derived_data', () => {
  it('should extract type bindings from definitions', () => {
    const code = `
      const x: number = 5
      function foo(y: string): boolean { return true }
    `
    const semantic_index = build_semantic_index(file_id('test.ts'), code)
    const derived = build_derived_data(semantic_index)

    // Should have type binding for x and foo
    expect(derived.type_bindings.size).toBeGreaterThan(0)
  })

  it('should extract type members from classes', () => {
    const code = `
      class MyClass {
        prop: number
        method(): void {}
      }
    `
    const semantic_index = build_semantic_index(file_id('test.ts'), code)
    const derived = build_derived_data(semantic_index)

    // Should have members for MyClass
    const class_def = semantic_index.definitions.find(d => d.name === 'MyClass')
    expect(class_def).toBeDefined()
    expect(derived.type_members.has(class_def!.symbol_id)).toBe(true)
    expect(derived.type_members.get(class_def!.symbol_id)!.length).toBe(2)
  })

  it('should extract type alias metadata', () => {
    const code = `
      type MyType = string | number
    `
    const semantic_index = build_semantic_index(file_id('test.ts'), code)
    const derived = build_derived_data(semantic_index)

    const alias_def = semantic_index.definitions.find(d => d.name === 'MyType')
    expect(alias_def).toBeDefined()
    expect(derived.type_alias_metadata.has(alias_def!.symbol_id)).toBe(true)
  })

  it('should extract exported symbols', () => {
    const code = `
      export const x = 5
      export function foo() {}
      const y = 10  // not exported
    `
    const semantic_index = build_semantic_index(file_id('test.ts'), code)
    const derived = build_derived_data(semantic_index)

    // Should have x and foo, not y
    const x_def = semantic_index.definitions.find(d => d.name === 'x')
    const foo_def = semantic_index.definitions.find(d => d.name === 'foo')
    const y_def = semantic_index.definitions.find(d => d.name === 'y')

    expect(derived.exported_symbols.has(x_def!.symbol_id)).toBe(true)
    expect(derived.exported_symbols.has(foo_def!.symbol_id)).toBe(true)
    expect(derived.exported_symbols.has(y_def!.symbol_id)).toBe(false)
  })

  it('should build scope to definitions mapping', () => {
    const code = `
      const global_var = 1
      function outer() {
        const local_var = 2
      }
    `
    const semantic_index = build_semantic_index(file_id('test.ts'), code)
    const derived = build_derived_data(semantic_index)

    // Module scope should have global_var and outer
    // Function scope should have local_var
    const module_scope = semantic_index.scopes.find(s => s.scope_type === 'module')
    expect(module_scope).toBeDefined()

    const module_defs = derived.scope_to_definitions.get(module_scope!.scope_id)
    expect(module_defs).toBeDefined()
    expect(module_defs!.length).toBeGreaterThanOrEqual(2)
  })
})
```

### Update Existing Tests

Run all existing tests and update any that reference the removed fields:
```bash
npm test -- semantic_index.typescript.test.ts
npm test -- semantic_index.python.test.ts
npm test -- semantic_index.rust.test.ts
npm test -- symbol_resolution.typescript.test.ts
```

For each failing test:
1. Add `const derived = build_derived_data(semantic_index)` after building the index
2. Replace `semantic_index.field` with `derived.field`
3. Ensure test still validates the same behavior

## Acceptance Criteria

- [x] `DerivedData` interface created with all 5 fields
- [x] `build_derived_data()` function implemented and tested
- [x] SemanticIndex interface no longer contains derived fields
- [x] `build_semantic_index()` no longer computes/returns derived fields
- [x] All code updated to use `build_derived_data()` instead
- [x] All existing tests pass
- [x] New unit tests for `build_derived_data()` cover all field types
- [x] No regression in test coverage

## Dependencies

- None (this is the first sub-task)

## Estimated Effort

- Implementation: 3-4 hours
- Testing: 2-3 hours
- Total: 5-7 hours

## Notes

- This is a pure refactoring task - no behavior changes
- The separation enables later sub-tasks to aggregate derived data into registries
- Keep the extraction logic simple for now; optimization can happen later
- Ensure `build_derived_data()` is a pure function (no side effects)

## Implementation Notes

(To be filled in during implementation)
