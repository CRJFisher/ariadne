---
id: task-epic-11.62
title: Wire Processing Layer Dependencies
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, integration, architecture, high-priority]
dependencies: [task-epic-11.60, task-epic-11.61]
parent_task_id: epic-11
---

## Description

Wire up the proper dependencies between processing layers according to the architecture defined in PROCESSING_PIPELINE.md. Many modules have TODO comments for integrations but lack actual connections, causing incomplete analysis and broken cross-file resolution.

## Context

From PROCESSING_PIPELINE.md (Critical Dependencies That Need Wiring):
1. Type Tracking → Import Resolution (has TODO, no actual dependency)
2. Method Calls → Type Tracking (missing dependency)
3. Method Calls → Class Hierarchy (missing dependency)
4. Constructor Calls → Type Tracking (no bidirectional flow)
5. Type Propagation → Call Graph (needs all call types)
6. Symbol Resolution → Import Resolution (currently duplicates extraction)

From ARCHITECTURE_ISSUES.md:
- Modules work in isolation but don't share data
- Cross-file analysis is broken due to missing connections
- Type flow stops at module boundaries

## Acceptance Criteria

### Phase 1: Type System Wiring
- [ ] Wire type_tracking to consume ImportInfo from import_resolution:
  ```typescript
  // In type_tracking, consume imports instead of parsing them
  import { get_imports } from '../import_export/import_resolution';
  ```
- [ ] Wire type_tracking to consume ScopeTree from scope_tree:
  ```typescript
  // Use scope chains for variable resolution
  import { get_scope_at_position } from '../scope_analysis/scope_tree';
  ```
- [ ] Wire type_tracking to register types with type_registry:
  ```typescript
  // Register discovered types
  import { register_type } from '../type_analysis/type_registry';
  ```

### Phase 2: Call Analysis Wiring
- [ ] Wire method_calls to consume type information:
  ```typescript
  // Get receiver type to resolve method
  import { get_variable_type } from '../type_analysis/type_tracking';
  ```
- [ ] Wire method_calls to use class_hierarchy:
  ```typescript
  // Resolve virtual methods through inheritance
  import { resolve_method } from '../inheritance/class_hierarchy';
  ```
- [ ] Wire constructor_calls to update type_tracking:
  ```typescript
  // After detecting constructor, update type map
  import { set_variable_type } from '../type_analysis/type_tracking';
  ```

### Phase 3: Module Graph Integration
- [ ] Wire method_calls to use module_graph for cross-file calls:
  ```typescript
  import { resolve_import } from '../import_export/module_graph';
  ```
- [ ] Wire constructor_calls to use module_graph for imported classes
- [ ] Wire type_resolution to use module_graph for type imports

### Phase 4: Symbol Resolution Cleanup
- [ ] Remove `extract_imports()` from symbol_resolution
- [ ] Change symbol_resolution to consume ImportInfo[] from import_resolution:
  ```typescript
  // Don't duplicate import extraction
  import { ImportInfo } from '@ariadnejs/types';
  import { get_imports } from '../import_export/import_resolution';
  ```
- [ ] Update tests to provide ImportInfo instead of raw AST

### Phase 5: Data Flow Patterns
- [ ] Implement LayerContext pattern for passing data between layers:
  ```typescript
  interface ProcessingContext {
    readonly layer0?: ParsedFile;
    readonly layer1?: ScopeAnalysis;
    readonly layer2?: LocalStructure;
    // ... accumulate results
  }
  ```
- [ ] Update code_graph.ts to build and pass context through layers
- [ ] Ensure immutability of layer outputs

### Testing
- [ ] Integration tests for cross-layer data flow
- [ ] Test type tracking with imported types
- [ ] Test method resolution through inheritance
- [ ] Test constructor type updates
- [ ] Test symbol resolution without import extraction
- [ ] Performance tests to ensure no regression

## Implementation Notes

### Wiring Patterns

**Read-Only Dependencies:**
```typescript
// Layer N reads from Layer N-1
const lowerLayerOutput = getLowerLayerResult();
const thisLayerOutput = processWithInput(lowerLayerOutput);
```

**Event-Based Updates (for bidirectional):**
```typescript
// Constructor calls -> Type tracking
eventBus.on('constructor.detected', (info) => {
  typeTracking.updateType(info.variable, info.type);
});
```

### Common Pitfalls to Avoid
- Don't create circular imports between modules
- Don't modify lower layer outputs (immutability)
- Don't skip layers (e.g., Layer 6 shouldn't directly access Layer 1)
- Don't duplicate functionality that exists in lower layers

### Migration Order
1. Start with read-only dependencies (safer)
2. Add event system for bidirectional updates
3. Remove duplicated functionality
4. Update tests for new data flow

### Type Safety
All shared data must use types from `@ariadnejs/types`:
- ImportInfo, ExportInfo for module structure
- TypeInfo for type information
- ScopeTree for scope analysis
- MethodCallInfo, ConstructorCallInfo for calls

## Success Metrics
- All TODO comments for integration are resolved
- Cross-file type resolution works
- Method calls resolve through inheritance
- Constructor calls update type maps
- No duplicate import extraction
- All integration tests pass
- No performance regression

## References
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Critical Dependencies section)
- Architecture issues: `/packages/core/ARCHITECTURE_ISSUES.md` (Issues #1-4, #7)
- Layer interfaces: `/packages/core/LAYER_INTERFACES.md`
- Example modules with TODOs:
  - `/type_analysis/type_tracking/type_tracking.ts` (lines 10-15)
  - `/scope_analysis/symbol_resolution/` (duplicates imports)

## Notes
This is a high-priority integration task that unblocks many other features. Should be done incrementally with careful testing at each step.