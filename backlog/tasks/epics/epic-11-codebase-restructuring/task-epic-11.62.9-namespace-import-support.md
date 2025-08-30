---
id: task-epic-11.62.9
title: Add Namespace Import Detection and Resolution
status: Complete
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

- [x] Update ImportInfo type usage to include namespace imports:
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

- [x] **JavaScript/TypeScript** (`import_extraction.ts`):
  - Detect `import * as name from 'module'`
  - Extract namespace binding name
  - Mark import kind as 'namespace'
  
- [x] **Python** (`import_extraction.ts`):
  - Detect `import module` (implicit namespace)
  - Detect `from package import module` (explicit namespace)
  - Handle `import module as alias`
  
- [x] **Rust** (`import_extraction.ts`):
  - Detect `use module::*` (glob imports)
  - Detect `use module::{self}` (module as namespace)
  - Handle `use module as alias`

### Namespace Member Resolution

- [x] Add helper function to check if identifier is namespace access:
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

- [x] Add function to resolve namespace members:
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

- [x] Test namespace import detection for all languages
- [x] Test aliased namespace imports
- [x] Test nested namespace access (ns1.ns2.member)
- [x] Test namespace member resolution
- [x] Test mixed import types in same file
- [x] Test that existing import detection still works

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

## Implementation Notes

### Key Implementation Decisions

1. **Import Extraction Already Existed**: During implementation, discovered that namespace import detection was already implemented in `import_extraction.ts` (which was moved from symbol_resolution in task 11.62.8). The basic detection logic was already handling:
   - JavaScript/TypeScript: `import * as name from 'module'`
   - Python: Module imports treated as namespaces
   - Rust: Glob imports (`use module::*`)

2. **Python Namespace Fix**: Enhanced Python import extraction to properly mark module imports as namespaces:
   ```python
   import os  # Now correctly marked as kind: 'namespace'
   ```
   This aligns with Python's semantics where module imports create namespace bindings.

3. **Created Helper Functions**: Added `namespace_helpers.ts` with utilities for:
   - Detecting namespace access patterns (`utils.helper`)
   - Resolving namespace members to their source modules
   - Supporting nested namespace access (`os.path.join`)
   - Expanding namespace imports when module graph is available

4. **Test Coverage**: Created comprehensive test suite covering:
   - Basic namespace access detection
   - Nested namespace patterns
   - Module graph integration
   - Python-specific module namespaces
   - Namespace binding identification

### Files Created/Modified

- **Created**: `packages/core/src/import_export/import_resolution/namespace_helpers.ts`
  - Helper functions for namespace detection and resolution
  - Supports all language-specific patterns

- **Created**: `packages/core/src/import_export/import_resolution/namespace_helpers.test.ts`
  - Comprehensive test coverage for all helper functions
  - Tests pass successfully

- **Modified**: `packages/core/src/import_export/import_resolution/import_extraction.ts`
  - Fixed Python to correctly mark module imports as namespaces
  - Already had basic namespace detection from task 11.62.8

- **Modified**: `packages/core/src/import_export/import_resolution/index.ts`
  - Added exports for namespace helper functions
  - Maintains clean API surface

## Notes

- Namespace imports are fundamental to module systems
- Python treats all imports as potential namespaces
- Rust glob imports are similar but not identical to namespaces
- This enables proper cross-file member resolution
- The implementation leverages existing ImportInfo type from @ariadnejs/types
- Helper functions support integration with module graph for full resolution