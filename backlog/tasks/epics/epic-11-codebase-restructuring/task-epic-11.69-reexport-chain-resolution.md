---
id: task-epic-11.69
title: Implement Re-export Chain Resolution
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, layer-5, module-graph, import-export]
dependencies: []
parent_task_id: epic-11
---

## Description

Implement re-export chain resolution in the module_graph layer to trace through re-exports and find the actual source definitions. This is critical for resolving types and symbols that are re-exported through multiple modules.

## Context

From PROCESSING_PIPELINE.md Layer 5 (Module Graph Construction):
- Module graph needs to resolve re-export chains
- Many libraries use barrel exports (index files that re-export from other files)
- Type registry depends on knowing the actual source of types

### Current Problem

When a module re-exports symbols from other modules, we need to trace through the chain to find the original definition:

```typescript
// math/add.ts
export function add(a: number, b: number) { return a + b; }

// math/index.ts
export { add } from './add';

// lib/index.ts
export * from '../math';

// app.ts
import { add } from './lib';  // Need to resolve to math/add.ts
```

## Acceptance Criteria

### Core Functionality

- [ ] Implement `resolve_reexport_chain()` function in module_graph:
```typescript
export function resolve_reexport_chain(
  symbol_name: string,
  from_module: FilePath,
  module_graph: ModuleGraph
): { 
  source_module: FilePath;
  original_name: string;
  chain: FilePath[];
} | undefined
```

### Re-export Patterns to Support

- [ ] **Named re-exports**: `export { foo } from './bar'`
- [ ] **Renamed re-exports**: `export { foo as bar } from './baz'`
- [ ] **Namespace re-exports**: `export * from './module'`
- [ ] **Partial namespace re-exports**: `export * as utils from './utils'`
- [ ] **Default re-exports**: `export { default } from './module'`
- [ ] **Barrel exports**: Index files that aggregate exports

### Circular Reference Handling

- [ ] Detect circular re-export chains
- [ ] Return partial resolution with cycle information
- [ ] Log warnings for circular dependencies

### Language-Specific Support

- [ ] **JavaScript/TypeScript**:
  - CommonJS re-exports: `module.exports = require('./other')`
  - ES6 re-export syntax
  - Mixed CommonJS/ES6 patterns

- [ ] **Python**:
  - `from .module import *` in __init__.py
  - `__all__` declarations for controlled exports
  - Relative imports in packages

- [ ] **Rust**:
  - `pub use` statements
  - Module re-exports: `pub use self::module::*`
  - External crate re-exports

## Implementation Notes

### Algorithm

1. Start with the importing module and symbol name
2. Check if symbol is directly exported
3. If re-exported, follow the chain:
   - Track visited modules to detect cycles
   - Build chain of modules traversed
   - Find original definition
4. Cache results for performance

### Data Structures

```typescript
interface ReexportCache {
  // "module#symbol" -> resolution result
  cache: Map<string, ReexportResolution>;
}

interface ReexportResolution {
  source_module: FilePath;
  original_name: string;
  chain: FilePath[];
  is_circular?: boolean;
}
```

### Integration Points

- **Consumed by**: Type registry (to find actual type definitions)
- **Consumed by**: Symbol resolution (to resolve imported symbols)
- **Depends on**: Export detection (to know what's exported)
- **Depends on**: Import resolution (to follow import chains)

## Testing Requirements

- [ ] Test simple re-export chains (2-3 levels)
- [ ] Test deep re-export chains (5+ levels)
- [ ] Test circular re-export detection
- [ ] Test namespace re-exports
- [ ] Test renamed re-exports
- [ ] Test mixed CommonJS/ES6 patterns
- [ ] Test performance with large module graphs

## Success Metrics

- Can resolve re-exports through arbitrary depth
- Correctly handles all re-export patterns
- Detects and reports circular dependencies
- Performance: < 10ms for typical re-export chains
- Cache hit rate > 80% for repeated resolutions

## References

- Module graph: `/packages/core/src/import_export/module_graph/`
- Export detection: `/packages/core/src/import_export/export_detection/`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 5)
- Related: Type registry uses this for type resolution

## Notes

- This is a complex feature that's essential for real-world codebases
- Many popular libraries use extensive re-exporting
- Performance is critical as this may be called frequently
- Consider lazy evaluation to avoid unnecessary chain traversal