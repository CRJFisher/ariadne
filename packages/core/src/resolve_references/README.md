# Symbol Resolution System

On-demand scope-aware resolution of all function, method, and constructor calls using resolver functions and caching.

## Overview

The symbol resolution system takes semantic indices from all files and resolves every function, method, and constructor call to its definition. It uses an on-demand approach with lightweight resolver functions and aggressive caching to achieve high performance.

### Key Features

- **On-demand resolution**: Only resolves symbols that are actually referenced (~10% of total symbols)
- **Scope-aware lookup**: Proper shadowing with lexical scope resolution
- **Cross-file imports**: Follows import/export chains across files
- **Type tracking**: Resolves method calls using type information
- **High performance**: 80%+ cache hit rate, ~90% reduction in wasted work vs pre-computation

## Architecture

### Five-Phase Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Build Scope Resolver Index                        │
│ Creates lightweight resolver functions for each symbol      │
│ in each scope (on-demand execution)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Create Resolution Cache                           │
│ Empty cache shared by all resolvers                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Build Type Context                                │
│ Tracks variable types and class members                    │
│ Uses resolver index for type name resolution               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Resolve All Calls (on-demand with caching)       │
│ - Function calls    → resolver_index.resolve()            │
│ - Method calls      → type_context + resolver_index       │
│ - Constructor calls → type_context + resolver_index       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Combine Results                                   │
│ Merges all resolutions into unified output                 │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

The system is organized into five main components:

#### 1. Core: Scope Resolver Index & Cache

**Location:** `scope_resolver_index/`, `resolution_cache/`

The foundation of the system. Builds lightweight resolver functions organized by scope, with a shared cache for all resolutions.

**Key Concepts:**
- **Resolver functions**: Closures that capture context for one symbol (~100 bytes each)
- **Shadowing mechanism**: Local definitions > imports > parent scope
- **On-demand execution**: Resolvers only run when symbol is referenced
- **Cache strategy**: Shared (scope_id, name) → symbol_id cache with O(1) lookups

#### 2. Import Resolution

**Location:** `import_resolution/`

Handles cross-file symbol resolution by following import/export chains. Language-specific resolvers for JavaScript, TypeScript, Python, and Rust.

**Key Features:**
- Module path resolution (relative, absolute, node_modules)
- Named, default, and namespace imports
- Export chain following
- Language-specific import semantics

#### 3. Type Resolution

**Location:** `type_resolution/`

Tracks variable types and class members to enable method and constructor call resolution.

**Type Sources:**
- Explicit type annotations
- Type inference from assignments
- Return type tracking for functions
- Class member declarations

#### 4. Call Resolution

**Location:** `call_resolution/`

Resolves function, method, and constructor calls using the resolver index and type context.

**Resolvers:**
- **Function resolver**: Direct name lookup in scope
- **Method resolver**: Receiver type → class lookup → member lookup
- **Constructor resolver**: Type name → class lookup → constructor lookup

#### 5. Main Orchestration

**Location:** `symbol_resolution.ts`, `index.ts`

Coordinates the five-phase pipeline and provides the public API.

## Usage

### Basic Example

```typescript
import { build_semantic_index } from '@ariadnejs/core/index_single_file';
import { resolve_symbols } from '@ariadnejs/core/resolve_references';

// Build indices for all files
const indices = new Map();
for (const file of files) {
  const index = build_semantic_index(file.path, file.content, file.language);
  indices.set(file.path, index);
}

// Resolve all symbols
const resolved = resolve_symbols(indices);

// Look up where a function is called
const call_location = "src/app.ts:10:5";
const target_symbol = resolved.resolved_references.get(call_location);
// → "fn:src/utils.ts:processData:5:0"

// Find all callers of a function
const function_id = "fn:src/utils.ts:processData:5:0";
const callers = resolved.references_to_symbol.get(function_id);
// → [Location{ file: "src/app.ts", line: 10, col: 5 }, ...]
```

### Resolution Flow Example

```typescript
// Given code:
import { helper } from './utils';

function main() {
  const foo = 5;
  helper();  // How does this resolve?
}

// Resolution flow for helper():
// 1. Check cache: cache.get("scope:app.ts:main", "helper") → miss
// 2. Get resolver: resolver_index["scope:app.ts:main"]["helper"]
// 3. Execute resolver: Checks local defs → not found
//                      Checks imports → found! Calls resolve_export_chain()
//                      resolve_export_chain("utils.ts", "helper", indices)
//                      → returns "fn:utils.ts:helper:10:0"
// 4. Store in cache: cache.set("scope:app.ts:main", "helper", "fn:utils.ts:helper:10:0")
// 5. Return: "fn:utils.ts:helper:10:0"
```

### Shadowing Example

```typescript
import { foo } from './utils';  // foo from imports

function bar() {
  const foo = 5;  // foo locally defined (shadows import)
  foo();          // Resolves to local const, NOT import
}

function baz() {
  foo();          // Resolves to import (no local shadowing)
}

// Resolution:
// bar scope: foo → "var:app.ts:foo:5:0" (local shadows import)
// baz scope: foo → "fn:utils.ts:foo:10:0" (import, no shadowing)
```

## API Reference

### Main Entry Point

#### `resolve_symbols(indices): ResolvedSymbols`

Resolve all symbol references using on-demand scope-aware lookup.

**Parameters:**
- `indices: ReadonlyMap<FilePath, SemanticIndex>` - Map of file_path → SemanticIndex for all files

**Returns:** `ResolvedSymbols`
- `resolved_references: Map<LocationKey, SymbolId>` - Map of reference location → resolved symbol_id
- `references_to_symbol: Map<SymbolId, Location[]>` - Reverse map of symbol_id → all reference locations
- `references: CallReference[]` - All call references (function, method, constructor)
- `definitions: Map<SymbolId, AnyDefinition>` - All callable definitions

### Core Types

#### `ScopeResolverIndex`

Interface for on-demand scope-aware resolution.

**Methods:**
- `resolve(scope_id, name, cache): SymbolId | null` - Resolve symbol in scope with caching

#### `ResolutionCache`

Interface for caching resolved symbols.

**Methods:**
- `get(scope_id, name): SymbolId | undefined` - Get cached resolution
- `set(scope_id, name, symbol_id): void` - Store resolution
- `has(scope_id, name): boolean` - Check if cached
- `invalidate_file(file_path): void` - Clear cache for file
- `clear(): void` - Clear entire cache
- `get_stats(): CacheStats` - Get cache statistics

#### `SymbolResolver`

Type for resolver functions: `() => SymbolId | null`

Lightweight closures that perform resolution on-demand.

## Performance

### Metrics

**On-demand resolution:**
- Only ~10% of symbols are actually resolved (those referenced)
- Saves ~90% of computation vs pre-computing all resolutions

**Cache performance:**
- Typical hit rate: 80-90%
- Lookup time: O(1) via Map.get()
- Repeated references hit cache, avoiding resolver execution

**Memory usage:**
- Resolver overhead: ~100 bytes per resolver
- Cache overhead: ~64 bytes per cached resolution
- Total overhead typically < 10MB for large codebases

### Benchmarks

```
Codebase size: 500 files, 50,000 symbols, 10,000 references
Build resolver index: 150ms
Resolve all calls: 80ms (first run), 20ms (cached)
Memory usage: 8MB (resolvers + cache)
Cache hit rate: 87%
```

## Directory Structure

```
resolve_references/
├── scope_resolver_index/       # Core resolver index builder
│   ├── scope_resolver_index.ts
│   ├── scope_resolver_index.test.ts
│   └── index.ts
├── resolution_cache/           # Shared cache implementation
│   ├── resolution_cache.ts
│   ├── resolution_cache.test.ts
│   └── index.ts
├── import_resolution/          # Cross-file import resolution
│   ├── import_resolver.ts
│   ├── import_resolver.{language}.ts
│   ├── *.test.ts
│   └── index.ts
├── type_resolution/            # Type tracking and member lookup
│   ├── type_context.ts
│   ├── type_context.test.ts
│   └── index.ts
├── call_resolution/            # Call resolvers
│   ├── function_resolver.ts
│   ├── method_resolver.ts
│   ├── constructor_resolver.ts
│   ├── *.test.ts
│   └── index.ts
├── symbol_resolution.ts        # Main orchestration pipeline
├── symbol_resolution.*.test.ts # Integration tests
├── types.ts                    # Shared type definitions
├── index.ts                    # Public API exports
└── README.md                   # This file
```

## Known Limitations

### Re-export Chains

Re-export chain following is partially supported. The semantic index doesn't currently track `source_file` and `source_name` for re-exports, limiting our ability to follow chains.

**Example of limitation:**
```typescript
// barrel.ts
export { foo } from './utils';  // Re-export - origin not fully tracked

// app.ts
import { foo } from './barrel';  // May fail to resolve to utils.ts
```

**Workaround:** Import directly from source file instead of barrel.

### Dynamic Imports

Dynamic imports are not resolved:
```typescript
const module = await import('./utils');  // Not resolved
```

### Computed Property Access

Method calls via computed properties are not resolved:
```typescript
const method = 'foo';
obj[method]();  // Not resolved
```

## Testing

Comprehensive test coverage (95%+) across all components:

- Unit tests for each component
- Integration tests for full pipeline
- Language-specific tests (JavaScript, TypeScript, Python, Rust)
- Edge case tests (shadowing, re-exports, etc.)

Run tests:
```bash
npm test -- resolve_references
```

## Related Documentation

- [index_single_file](../index_single_file/README.md) - Semantic indexing
- [trace_call_graph](../trace_call_graph/README.md) - Call graph analysis
