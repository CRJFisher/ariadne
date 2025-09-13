---
id: task-epic-11.100.0.5.19.16.4
title: Update downstream code using build_module_graph
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['integration', 'api-migration']
dependencies: ['task-epic-11.100.0.5.19.16.1']
parent_task_id: task-epic-11.100.0.5.19.16
priority: medium
---

## Description

Several files import and use `build_module_graph` expecting the old Map-based interface. These need to be updated to use the correct function variant.

## Files Requiring Updates

### 1. code_graph.ts
**Current usage**:
```typescript
import { build_module_graph } from "./import_export/module_graph";

const modules = build_module_graph(file_data, {
  root_path: options.root_path,
  include_external: false,
});
```

**Required change**: Update import to use `build_module_graph_from_files` since it uses the Map-based interface.

### 2. type_propagation.ts
- **File**: `src/type_analysis/type_propagation/type_propagation.ts`
- **Check**: Verify usage and update if needed

### 3. generic_resolution.ts
- **File**: `src/type_analysis/generic_resolution/generic_resolution.ts`
- **Check**: Verify usage and update if needed

## Implementation Strategy

1. **Audit Usage**: Review each file to understand how `build_module_graph` is used
2. **Determine Correct Function**: Decide which function variant each caller should use:
   - `build_module_graph_from_files` - for Map-based file analysis
   - `build_module_graph` - for simple imports/exports arrays
3. **Update Imports**: Change import statements to use the correct function
4. **Test Changes**: Ensure all changes work correctly

## Acceptance Criteria

- [ ] All downstream files compile without errors
- [ ] Imports updated to use correct function variant
- [ ] Function calls use appropriate signatures
- [ ] Integration tests pass
- [ ] No breaking changes to public APIs