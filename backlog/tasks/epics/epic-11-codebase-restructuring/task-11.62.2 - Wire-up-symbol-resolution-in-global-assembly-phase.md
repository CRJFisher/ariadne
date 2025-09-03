# Task 11.62.2: Wire up symbol resolution in global assembly phase

**Status:** Draft
**Parent:** task-11.62
**Epic:** epic-11
**Priority:** High

## Summary

Integrate symbol resolution into the global assembly phase (Layer 8) of the processing pipeline. This will enable cross-file symbol resolution, building a global symbol table, and resolving references to their definitions across the entire codebase.

## Problem

The symbol resolution module exists but is not wired into the code_graph.ts processing pipeline. This means:
- No global symbol table is built
- Cross-file references cannot be resolved
- Imports/exports are not connected to their definitions
- The enrichment phase cannot use resolved symbols

According to PROCESSING_PIPELINE.md, Layer 8 (Global Symbol Resolution) should:
- Build global symbol table
- Resolve symbol references across files
- Handle import/export aliases
- Track symbol visibility and accessibility

## Requirements

### Functional Requirements

1. **Global Symbol Table Construction**
   - Collect all symbols from all file analyses
   - Build a unified symbol table mapping SymbolId → Definition
   - Track symbol visibility (public/private/protected)
   - Handle export/import relationships

2. **Cross-File Resolution**
   - Resolve imported symbols to their export definitions
   - Handle namespace imports and re-exports
   - Track symbol aliases and renames
   - Support different module systems (ES6, CommonJS)

3. **Integration Points**
   - Add after Layer 7 (Cross-File Type Resolution)
   - Use module graph from Layer 5
   - Use type registry from Layer 6
   - Feed into enrichment phase

### Technical Requirements

- Use existing symbol_resolution module
- Leverage module_graph for import/export connections
- Maintain language-specific resolution rules
- Support incremental updates for performance

## Solution Design

### 1. Add Global Symbol Resolution to code_graph.ts

```typescript
// After type resolution (Layer 7)
async function generate_code_graph(options: CodeGraphOptions): Promise<CodeGraph> {
  // ... existing layers ...
  
  // LAYER 8: GLOBAL SYMBOL RESOLUTION
  const global_symbols = await build_global_symbol_table(
    enriched_analyses,
    modules,  // From Layer 5
    type_registry  // From Layer 6
  );
  
  // Resolve all references
  const resolved_symbols = await resolve_all_symbols(
    enriched_analyses,
    global_symbols,
    modules
  );
  
  // ... continue to enrichment ...
}
```

### 2. Build Global Symbol Table

```typescript
async function build_global_symbol_table(
  analyses: FileAnalysis[],
  module_graph: ModuleGraph,
  type_registry: TypeRegistry
): Promise<GlobalSymbolTable> {
  const { build_symbol_table } = await import(
    './scope_analysis/symbol_resolution/global_symbol_table'
  );
  
  return build_symbol_table({
    analyses,
    module_graph,
    type_registry,
    resolve_imports: true,
    track_visibility: true
  });
}
```

### 3. Resolve All Symbols

```typescript
async function resolve_all_symbols(
  analyses: FileAnalysis[],
  symbol_table: GlobalSymbolTable,
  module_graph: ModuleGraph
): Promise<Map<SymbolId, ResolvedSymbol>> {
  const resolved = new Map<SymbolId, ResolvedSymbol>();
  
  for (const analysis of analyses) {
    const context = create_resolution_context(
      analysis.scopes,
      analysis.language,
      analysis.file_path,
      undefined,  // root_node not needed for table lookup
      undefined,  // source_code not needed
      analysis.imports,
      analysis.exports
    );
    
    // Resolve all symbols in this file
    for (const [symbol_id, _] of analysis.symbol_registry) {
      const resolved_symbol = resolve_symbol_with_language(
        symbol_id,
        analysis.scopes.root_id,
        context,
        analysis.language,
        analysis.imports,
        module_graph
      );
      
      if (resolved_symbol) {
        resolved.set(symbol_id, resolved_symbol);
      }
    }
  }
  
  return resolved;
}
```

### 4. Create Global Symbol Table Module

```typescript
// New file: packages/core/src/scope_analysis/symbol_resolution/global_symbol_table.ts

export interface GlobalSymbolTable {
  symbols: Map<SymbolId, SymbolDefinition>;
  exports: Map<string, Map<string, SymbolId>>;  // file → export name → symbol
  imports: Map<string, Map<string, SymbolId>>;  // file → import name → symbol
  visibility: Map<SymbolId, SymbolVisibility>;
}

export function build_symbol_table(options: SymbolTableOptions): GlobalSymbolTable {
  // Implementation
}
```

## Implementation Steps

1. Create global_symbol_table.ts module
2. Add symbol table building logic
3. Integrate into code_graph.ts after Layer 7
4. Create symbol resolution pass
5. Store resolved symbols in FileAnalysis
6. Update enrichment functions to use resolved symbols
7. Add tests for cross-file resolution

## Files to Modify

- `packages/core/src/code_graph.ts` - Add Layer 8 integration
- `packages/core/src/scope_analysis/symbol_resolution/global_symbol_table.ts` - NEW
- `packages/core/src/scope_analysis/symbol_resolution/cross_file_resolver.ts` - NEW
- `packages/core/src/scope_analysis/symbol_resolution/index.ts` - Export new functions

## Testing

- Test symbol resolution across multiple files
- Verify import/export resolution
- Test namespace and re-export handling
- Validate visibility tracking
- Check performance with large codebases

## Acceptance Criteria

- [x] Global symbol table contains all file symbols
- [x] Imports resolve to their export definitions
- [ ] Re-exports are properly traced (partial)
- [ ] Namespace imports work correctly (not yet)
- [x] Symbol visibility is tracked
- [x] Cross-file references are resolved
- [x] Resolution works for all supported languages
- [x] Enrichment phase can access resolved symbols

## Dependencies

- Requires task 11.62.1 (symbols must be created first)
- Needs module graph from Layer 5
- Uses type registry from Layer 6
- Must complete before enrichment uses symbols

## Implementation Notes

### Completed Implementation (2025-08-31)

1. **Created global_symbol_table.ts** - Core module for building unified symbol table
   - `GlobalSymbolTable` interface with symbols, exports, imports, visibility
   - `SymbolDefinition` type for storing symbol metadata
   - `build_symbol_table()` function to process all file analyses
   - Visibility tracking (public/private/protected/internal)
   - Export/import resolution and connection

2. **Integrated into code_graph.ts** - Added as Layer 8 in processing pipeline
   - Builds global symbol table after module graph (Layer 5)
   - Uses type registry from Layer 6
   - Enhanced symbol index to use global symbols
   - Symbol table passed to enrichment functions

3. **Symbol Processing** - Extracts and indexes all symbols
   - Functions with async/generator metadata
   - Classes with abstract status
   - Methods with visibility and static status
   - Variables with export tracking
   - Proper file path and location tracking

4. **Cross-file Resolution** - Basic import/export connections
   - Maps exports by file and name
   - Resolves imports to exported symbols
   - Tracks symbol visibility across files
   - Helper functions for visibility checking

### Known Limitations

- Re-export chains not fully traced yet
- Namespace imports need additional work
- Type mismatch issues with readonly types from @ariadnejs/types
- Import path resolution simplified (needs full module resolution logic)

### Notes

This is the critical layer that connects all per-file analyses into a unified view. The global symbol table enables:
- IDE features like go-to-definition across files
- Accurate call graph construction
- Type flow analysis across module boundaries
- Dead code detection
- Refactoring support

### Next Steps

- Implement full re-export tracing
- Add namespace import resolution
- Enhance import path resolution with aliases and bundler configs
- Add incremental update support for performance