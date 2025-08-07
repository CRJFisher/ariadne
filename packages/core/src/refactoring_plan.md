# Refactoring Plan for project_call_graph.ts

## Current Situation
- `project_call_graph.ts`: 60KB (way over 32KB limit)
- Other large files close to limit:
  - `index.ts`: 28KB (near limit, should watch)
  - `scope_resolution.ts`: 21KB
  - `function_metadata.ts`: 18KB

## Proposed New Structure

### 1. Create New Directory: `call_graph/`
Create a dedicated directory for call graph functionality:
```
packages/core/src/call_graph/
├── index.ts              (main export, ~5KB)
├── type_tracking.ts      (~10KB)
├── import_export.ts      (~10KB)
├── call_analysis.ts      (~20KB)
├── graph_builder.ts      (~12KB)
└── types.ts              (~2KB)
```

### 2. Module Breakdown

#### `call_graph/type_tracking.ts` (~10KB)
- `FileTypeTracker` class
- `LocalTypeTracker` class
- `ProjectTypeRegistry` class
- Related interfaces and types

#### `call_graph/import_export.ts` (~10KB)
- Export detection logic (from `detectFileExports`)
- Import initialization (from `initializeFileImports`)
- Language-specific export detection:
  - Python export detection
  - Rust export detection
  - JavaScript/TypeScript export detection
  - CommonJS export detection

#### `call_graph/call_analysis.ts` (~20KB)
- Module-level call detection (`get_module_level_calls`)
- Definition call analysis (`get_calls_from_definition`)
- Constructor call detection
- Method call resolution
- Cross-file call resolution
- Helper: `trackImplicitInstanceParameter`

#### `call_graph/graph_builder.ts` (~12KB)
- Call graph extraction (`extract_call_graph`)
- Call graph building (`get_call_graph`)
- Depth filtering (`apply_max_depth_filter`)
- Node and edge creation logic

#### `call_graph/types.ts` (~2KB)
- Shared interfaces specific to call graph
- Type definitions used across modules

#### `call_graph/index.ts` (~5KB)
- `ProjectCallGraph` class (slim coordinator)
- Delegation setup
- Module coordination
- Re-exports public API

### 3. Benefits of This Structure

1. **Modular**: Each module has a clear, single responsibility
2. **Under Limit**: All files well under 32KB (largest ~20KB)
3. **Maintainable**: Related functionality grouped together
4. **Testable**: Each module can be tested independently
5. **Scalable**: Easy to add new features without hitting size limits

### 4. Migration Strategy

1. **Phase 1**: Create directory structure and type definitions
2. **Phase 2**: Extract type tracking classes (least coupled)
3. **Phase 3**: Extract import/export detection
4. **Phase 4**: Extract call analysis (most complex)
5. **Phase 5**: Extract graph building
6. **Phase 6**: Refactor ProjectCallGraph to use modules
7. **Phase 7**: Update all imports in other files
8. **Phase 8**: Test thoroughly

### 5. Import Updates Required

Files that will need import updates:
- `index.ts` (imports ProjectCallGraph)
- Any test files testing call graph functionality

### 6. Risk Mitigation

- Each phase can be tested independently
- Git commits after each successful phase
- Keep original file until migration complete
- Run validation tests after each phase

## Alternative Approach (If Directory Not Preferred)

If we want to keep flat structure:
- `project_call_graph.ts` → `call_graph.ts` (main, ~5KB)
- `call_graph_type_tracking.ts` (~10KB)
- `call_graph_import_export.ts` (~10KB)  
- `call_graph_analysis.ts` (~20KB)
- `call_graph_builder.ts` (~12KB)

But directory approach is cleaner and more scalable.