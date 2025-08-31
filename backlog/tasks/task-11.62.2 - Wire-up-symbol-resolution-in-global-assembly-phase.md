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

- [ ] Global symbol table contains all file symbols
- [ ] Imports resolve to their export definitions
- [ ] Re-exports are properly traced
- [ ] Namespace imports work correctly
- [ ] Symbol visibility is tracked
- [ ] Cross-file references are resolved
- [ ] Resolution works for all supported languages
- [ ] Enrichment phase can access resolved symbols

## Dependencies

- Requires task 11.62.1 (symbols must be created first)
- Needs module graph from Layer 5
- Uses type registry from Layer 6
- Must complete before enrichment uses symbols

## Notes

This is the critical layer that connects all per-file analyses into a unified view. The global symbol table enables:
- IDE features like go-to-definition across files
- Accurate call graph construction
- Type flow analysis across module boundaries
- Dead code detection
- Refactoring support