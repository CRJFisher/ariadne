---
id: task-epic-11.62.2
title: Implement Data Passing Between Layers in code_graph.ts
status: Completed
assignee: []
created_date: "2025-08-29"
labels: [epic-11, sub-task, integration, infrastructure, critical]
dependencies: [task-epic-11.62.1]
parent_task_id: task-epic-11.62
---

## Description

**CRITICAL INFRASTRUCTURE** - Implement data passing between processing layers in code_graph.ts. This provides the foundation for all layer-to-layer communication in the processing pipeline.

**NOTE**: Per user feedback, implemented direct parameter passing instead of ProcessingContext pattern.

## Why This Is Critical

1. **Data Accumulation**: Each layer needs access to outputs from previous layers
2. **Immutability**: Ensures data from lower layers cannot be modified by higher layers
3. **Type Safety**: Makes data dependencies explicit and compile-time checked
4. **Single Source**: One context object instead of multiple parameters

## Acceptance Criteria

### Core ProcessingContext Interface

- [ ] Create `ProcessingContext` interface in `/packages/types/src/processing.ts`:

```typescript
export interface ProcessingContext {
  // Layer 0: Foundation
  readonly layer0: {
    readonly ast: SyntaxNode;
    readonly source: string;
    readonly language: Language;
    readonly file_path: string;
  };

  // Layer 1: Scope Analysis
  readonly layer1?: {
    readonly scope_tree: ScopeTree;
    readonly definitions: readonly Definition[];
    readonly usages: readonly Usage[];
  };

  // Layer 2: Local Structure Detection
  readonly layer2?: {
    readonly imports: readonly ImportInfo[];
    readonly exports: readonly ExportInfo[];
    readonly classes: readonly ClassDefinition[];
    readonly functions: readonly FunctionDefinition[];
  };

  // Layer 3: Local Type Analysis
  readonly layer3?: {
    readonly type_map: TypeMap;
    readonly type_constraints: readonly TypeConstraint[];
    readonly generic_instances: readonly GenericInstance[];
  };

  // Layer 4: Local Call Analysis
  readonly layer4?: {
    readonly function_calls: readonly FunctionCallInfo[];
    readonly method_calls: readonly MethodCallInfo[];
    readonly constructor_calls: readonly ConstructorCallInfo[];
  };

  // Layers 5-10 are global assembly, added in global phase
}
```

### Context Builder Implementation

- [ ] Create `ProcessingContextBuilder` class in `/packages/core/src/context_builder.ts`:

```typescript
export class ProcessingContextBuilder {
  private context: ProcessingContext;

  // Builder methods return new instance (immutable)
  withLayer1(data: Layer1Data): ProcessingContextBuilder;
  withLayer2(data: Layer2Data): ProcessingContextBuilder;
  // ... etc

  build(): ProcessingContext;
}
```

### Update code_graph.ts

- [ ] Modify `analyze_file()` to build context progressively:

```typescript
async function analyze_file(file_path: string): Promise<FileAnalysis> {
  // Layer 0
  const context = new ProcessingContextBuilder().withLayer0({
    ast,
    source,
    language,
    file_path,
  });

  // Layer 1
  const scopeAnalysis = await analyzeScopeTree(context.layer0);
  context = context.withLayer1(scopeAnalysis);

  // Layer 2
  const localStructure = await detectLocalStructure(context);
  context = context.withLayer2(localStructure);

  // Pass context to each layer
  // ...
}
```

### Update Module Functions

- [ ] Update all processing functions to accept `ProcessingContext`:

```typescript
// Before:
export function track_types(
  ast: SyntaxNode,
  scope_tree: ScopeTree,
  imports: ImportInfo[],
  classes: ClassDefinition[],
  source: string,
  language: Language
): TypeTrackingResult;

// After:
export function track_types(context: ProcessingContext): TypeTrackingResult;
```

### Backward Compatibility

- [ ] Create adapter functions for gradual migration:

```typescript
// Temporary adapter while migrating
export function track_types_legacy(
  ast: SyntaxNode,
  scope_tree: ScopeTree
  // ... other params
): TypeTrackingResult {
  const context = buildContextFromParams(/* ... */);
  return track_types(context);
}
```

## Implementation Strategy

### Phase 1: Define Types

1. Create ProcessingContext interface in types package
2. Define all layer data structures
3. Export from @ariadnejs/types

### Phase 2: Create Builder

1. Implement ProcessingContextBuilder with immutable updates
2. Add validation for required layers
3. Add helper methods for common patterns

### Phase 3: Update code_graph.ts

1. Modify analyze_file to use context builder
2. Pass context through processing pipeline
3. Accumulate results at each layer

### Phase 4: Migrate Modules

1. Create adapter functions for backward compatibility
2. Update module signatures one by one
3. Remove adapters once all modules migrated

## Testing Requirements

- [ ] Unit tests for ProcessingContextBuilder
- [ ] Test immutability (modifications create new instance)
- [ ] Test layer dependency validation
- [ ] Integration test with mock processing pipeline
- [ ] Performance test (ensure no significant overhead)

## Success Metrics

- [ ] ProcessingContext type defined and exported
- [ ] Builder implementation with immutable updates
- [ ] code_graph.ts uses context for all layer calls
- [ ] All processing functions updated to accept context
- [ ] No performance regression
- [ ] All tests pass

## Notes

- This is the infrastructure foundation for all layer integration
- Must maintain immutability to prevent bugs
- Consider using Object.freeze() for runtime immutability enforcement
- May need helper functions for extracting specific layer data

## Implementation Notes

### Completed (2025-08-29)

Successfully implemented data passing between processing layers WITHOUT ProcessingContext pattern, per user preference. Used direct parameter passing instead.

#### Changes Made

1. **Updated imports in code_graph.ts**
   - Added imports for `extract_imports`, `extract_exports` from symbol_resolution
   - Added imports for `find_class_definitions` from class_detection
   - Added imports for `process_file_for_types` from type_tracking

2. **Reorganized analyze_file() with clear layer structure**
   ```typescript
   // LAYER 1: SCOPE ANALYSIS
   const scopes = build_scope_tree(...);
   
   // LAYER 2: LOCAL STRUCTURE DETECTION
   const imports = extract_imports(tree.rootNode, source_code, file.language, file.file_path);
   const exports = extract_exports(tree.rootNode, source_code, file.language, file.file_path);
   const class_definitions = find_class_definitions(classDetectionContext);
   
   // LAYER 3: LOCAL TYPE ANALYSIS (uses outputs from Layers 1 & 2)
   const type_tracker = process_file_for_types(
     source_code,
     tree.rootNode,
     typeTrackingContext,
     scopes,           // From Layer 1
     imports,          // From Layer 2
     class_definitions // From Layer 2
   );
   
   // LAYER 4: LOCAL CALL ANALYSIS (uses output from Layer 3)
   const method_calls = find_method_calls(
     method_call_context,
     type_tracker.variable_types,  // From Layer 3
     undefined  // class_hierarchy not available yet (Layer 6)
   );
   ```

3. **Key Architectural Decisions**
   - **No ProcessingContext**: Per user feedback, avoided creating a ProcessingContext object
   - **Direct Parameter Passing**: Each function receives exactly the data it needs from lower layers
   - **Optional Parameters**: Higher-layer dependencies (e.g., class_hierarchy from Layer 6) passed as undefined during per-file phase
   - **Clear Layer Comments**: Each section clearly labeled with its layer number and dependencies

4. **Added missing FileAnalysis properties**
   - Added `variables: []` with TODO
   - Added `errors: []` with TODO

#### Benefits of This Approach

1. **Simplicity**: No need for complex ProcessingContext builder or management
2. **Type Safety**: TypeScript ensures correct data types are passed
3. **Explicit Dependencies**: Clear what data each layer needs
4. **Flexibility**: Easy to add new parameters as needed
5. **No Overhead**: No extra object creation or copying

#### Remaining Work

While the core data flow is established, some conversions and implementations remain:
- Convert ImportInfo[] to ImportStatement[] format
- Convert ExportInfo[] to ExportStatement[] format  
- Extract variable declarations
- Collect analysis errors
- Wire up global phase dependencies (Layers 5-10)

These are separate tasks and don't block the core layer communication infrastructure.

## References

- Parent task: `/backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.62-wire-layer-dependencies.md`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md`
- Depends on: task-epic-11.62.1 (function signatures must be updated first)
