---
id: task-epic-11.62.9
title: Add Namespace Import Detection and Resolution
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, sub-task, layer-2, import-export, integration]
dependencies: [task-epic-11.62.1]
parent_task_id: task-epic-11.62
---

## Description

Add support for detecting and extracting namespace imports (`import * as name from 'module'`) in the import_resolution module. This is essential for proper type resolution when accessing members through namespace imports.

## Context

From PROCESSING_PIPELINE.md Layer 2 (Local Structure Detection):
- Import resolution extracts import declarations during per-file analysis
- Namespace imports are common in TypeScript and Python
- Type registry needs namespace information for member resolution

### Current Problem

Namespace imports create a local namespace binding that provides access to all exports from a module:

```typescript
// utils.ts
export function helper1() {}
export function helper2() {}
export const CONFIG = {};

// app.ts
import * as utils from './utils';
utils.helper1();  // Need to resolve utils.helper1 to utils.ts#helper1
utils.CONFIG;     // Need to resolve utils.CONFIG to utils.ts#CONFIG
```

## Acceptance Criteria

### Core Import Detection

- [ ] Update ImportInfo type usage to include namespace imports:
```typescript
// Already defined in @ariadnejs/types
export interface ImportInfo {
  name: string;
  source: string;
  kind: 'named' | 'default' | 'namespace' | 'dynamic';
  namespace_name?: string;  // For namespace imports
  // ...
}
```

### Language-Specific Namespace Detection

- [ ] **JavaScript/TypeScript** (`import_resolution.javascript.ts`):
  - Detect `import * as name from 'module'`
  - Extract namespace binding name
  - Mark import kind as 'namespace'
  
- [ ] **Python** (`import_resolution.python.ts`):
  - Detect `import module` (implicit namespace)
  - Detect `from package import module` (explicit namespace)
  - Handle `import module as alias`
  
- [ ] **Rust** (`import_resolution.rust.ts`):
  - Detect `use module::*` (glob imports)
  - Detect `use module::{self}` (module as namespace)
  - Handle `use module as alias`

### Namespace Member Resolution

- [ ] Add helper function to check if identifier is namespace access:
```typescript
export function is_namespace_access(
  identifier: string,
  imports: ImportInfo[]
): { 
  is_namespace: boolean;
  namespace_name?: string;
  member_name?: string;
} {
  // Check if identifier is "namespace.member" pattern
}
```

- [ ] Add function to resolve namespace members:
```typescript
export function resolve_namespace_member(
  namespace_name: string,
  member_name: string,
  imports: ImportInfo[],
  module_graph?: ModuleGraph
): {
  source_module: string;
  export_name: string;
} | undefined {
  // Find namespace import and resolve member
}
```

## Implementation Notes

### AST Patterns to Detect

**TypeScript/JavaScript:**
```
import_statement
  namespace_import
    "*" as identifier
```

**Python:**
```
import_statement
  dotted_name (module)
  
import_from_statement
  module_name
  import_list?
```

**Rust:**
```
use_declaration
  use_tree
    glob ("*")
    self
```

### Integration with Type Registry

The type registry will use namespace information to:
1. Resolve member access (e.g., `Math.PI`)
2. Track which types come from which namespaces
3. Support IntelliSense-like features

### Data Flow

1. import_resolution detects namespace imports (Layer 2)
2. Stores in ImportInfo with kind='namespace'
3. Type registry consumes this for member resolution (Layer 6)
4. Symbol resolution uses for identifier resolution (Layer 8)

## Testing Requirements

- [ ] Test namespace import detection for all languages
- [ ] Test aliased namespace imports
- [ ] Test nested namespace access (ns1.ns2.member)
- [ ] Test namespace member resolution
- [ ] Test mixed import types in same file
- [ ] Test that existing import detection still works

## Success Metrics

- All namespace import patterns detected correctly
- ImportInfo properly populated with namespace information
- No regression in existing import detection
- Clear distinction between namespace and named imports
- Integration tests pass with type registry

## References

- Import resolution: `/packages/core/src/import_export/import_resolution/`
- ImportInfo type: `/packages/types/src/modules.ts`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 2)
- Consumed by: Type registry (task 11.61), Symbol resolution

## Notes

- Namespace imports are fundamental to module systems
- Python treats all imports as potential namespaces
- Rust glob imports are similar but not identical to namespaces
- This enables proper cross-file member resolution