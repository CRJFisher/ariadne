---
id: task-epic-11.62.11
title: Wire Global Assembly Enrichment Functions - CRITICAL INTEGRATION
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, integration, critical, global-assembly]
dependencies: [task-epic-11.62.5, task-epic-11.62.6, task-epic-11.62.7]
parent_task_id: task-epic-11.62
---

## 🚨 CRITICAL INTEGRATION TASK 🚨

**This task wires up ALL the enrichment functions created in previous tasks.** Without this, the enrichment pattern we've carefully built remains unused, and cross-file validation/resolution stays broken.

## Description

Wire the Global Assembly enrichment functions that were created in tasks 11.62.5, 11.62.6, and 11.62.7. These functions exist but are never called, leaving a gap between Per-File Analysis and Global Assembly phases.

## Current State Analysis

### What We Have Built

1. **Method Call Enrichment** (task 11.62.5):
   - `enrich_method_calls_with_hierarchy()` in `/packages/core/src/call_graph/method_calls/method_hierarchy_resolver.ts`
   - Validates method calls against class hierarchy
   - Resolves inherited methods

2. **Constructor Call Enrichment** (task 11.62.6):
   - `enrich_constructor_calls_with_types()` in `/packages/core/src/call_graph/constructor_calls/constructor_type_resolver.ts`
   - Validates constructor calls against type registry
   - Resolves imported constructors

3. **Bidirectional Type Flow** (task 11.62.7):
   - `find_constructor_calls_with_types()` in `/packages/core/src/call_graph/constructor_calls/index.ts`
   - `merge_constructor_types()` for combining type maps
   - Enables constructor calls to inform type tracking

### Where They Should Be Called

In `/packages/core/src/code_graph.ts`:

1. **Lines 169-177**: TODO for method hierarchy enrichment
2. **Lines 179-191**: TODO for constructor type validation  
3. **Lines 330-337**: TODO for bidirectional flow

## Acceptance Criteria

### 1. Enable Bidirectional Type Flow (Per-File Phase)

- [ ] Replace basic `find_constructor_calls()` with enhanced version:

```typescript
// code_graph.ts, around line 338
// BEFORE:
const constructor_calls = find_constructor_calls(constructor_call_context);

// AFTER:
import { find_constructor_calls_with_types, merge_constructor_types } from './call_graph/constructor_calls';

const constructor_result = find_constructor_calls_with_types(constructor_call_context);
const constructor_calls = constructor_result.calls;

// Merge constructor-discovered types into the type map
const enriched_type_map = merge_constructor_types(
  type_tracker.variable_types,
  constructor_result.type_assignments
);
```

- [ ] Update subsequent code to use `enriched_type_map` instead of `type_tracker.variable_types`

### 2. Build Type Registry (Global Assembly Phase)

- [ ] Implement type registry builder after all files are processed:

```typescript
// code_graph.ts, after line 150 (after all files processed)
async function build_type_registry(
  analyses: Map<string, FileAnalysis>
): Promise<TypeRegistry> {
  const { create_type_registry, register_class } = await import('./type_analysis/type_registry');
  const registry = create_type_registry();
  
  // Register all classes from all files
  for (const [file_path, analysis] of analyses) {
    for (const class_def of analysis.classes) {
      register_class(registry, {
        name: class_def.name,
        file_path,
        location: class_def.location,
        methods: class_def.methods,
        properties: class_def.properties,
        base_classes: class_def.base_classes,
        is_abstract: class_def.is_abstract,
        type_parameters: class_def.type_parameters,
        language: analysis.language
      });
    }
    
    // Register exported types for cross-file resolution
    for (const export_def of analysis.exports) {
      if (export_def.kind === 'class' || export_def.kind === 'type') {
        registry.register_export(file_path, export_def.name, export_def);
      }
    }
  }
  
  return registry;
}
```

### 3. Build Class Hierarchy (Global Assembly Phase)

- [ ] Implement class hierarchy builder:

```typescript
// code_graph.ts, after type registry
async function build_class_hierarchy_from_analyses(
  analyses: Map<string, FileAnalysis>
): Promise<ClassHierarchy> {
  const { build_class_hierarchy } = await import('./inheritance/class_hierarchy');
  
  // Collect all class definitions
  const all_classes: ClassDefinition[] = [];
  for (const [file_path, analysis] of analyses) {
    for (const class_def of analysis.classes) {
      all_classes.push({
        ...class_def,
        file_path,
        language: analysis.language
      });
    }
  }
  
  return build_class_hierarchy(all_classes);
}
```

### 4. Wire Method Call Enrichment

- [ ] Call the enrichment function after hierarchy is built:

```typescript
// code_graph.ts, replace TODO at lines 169-177
const { enrich_method_calls_with_hierarchy } = await import('./call_graph/method_calls');

// Build class hierarchy first
const class_hierarchy = await build_class_hierarchy_from_analyses(analyses);

// Enrich all method calls with hierarchy information
for (const [file_path, analysis] of analyses) {
  analysis.method_calls = enrich_method_calls_with_hierarchy(
    analysis.method_calls,
    class_hierarchy,
    analysis.classes  // Local classes for context
  );
}
```

### 5. Wire Constructor Call Enrichment

- [ ] Call the enrichment function after type registry is built:

```typescript
// code_graph.ts, replace TODO at lines 179-191
const { enrich_constructor_calls_with_types } = await import('./call_graph/constructor_calls');

// Build type registry first
const type_registry = await build_type_registry(analyses);

// Create imports map for cross-file resolution
const imports_by_file = new Map<string, ImportInfo[]>();
for (const [file_path, analysis] of analyses) {
  imports_by_file.set(file_path, analysis.imports);
}

// Enrich all constructor calls with type validation
for (const [file_path, analysis] of analyses) {
  analysis.constructor_calls = enrich_constructor_calls_with_types(
    analysis.constructor_calls,
    type_registry,
    imports_by_file.get(file_path)
  );
}
```

### 6. Update Return Type Structure

- [ ] Ensure the CodeGraph includes enriched data:

```typescript
return {
  // ... existing fields ...
  
  // Add new global structures
  type_registry,
  class_hierarchy,
  
  // Analyses now have enriched calls
  files: analyses, // Contains enriched method_calls and constructor_calls
  
  // Statistics about enrichment
  stats: {
    ...existing_stats,
    validated_constructors: count_validated_constructors(analyses),
    resolved_methods: count_resolved_methods(analyses),
    cross_file_resolutions: count_cross_file_resolutions(analyses)
  }
};
```

## Implementation Order

1. **First**: Build type registry and class hierarchy (infrastructure)
2. **Second**: Wire bidirectional type flow (per-file enhancement)
3. **Third**: Wire method call enrichment (uses hierarchy)
4. **Fourth**: Wire constructor call enrichment (uses registry)
5. **Fifth**: Add statistics and debugging info

## Testing Requirements

### Integration Tests

- [ ] Create integration test that verifies full pipeline:

```typescript
// test/integration/enrichment_pipeline.test.ts
describe('Global Assembly Enrichment Pipeline', () => {
  it('should enrich method calls with hierarchy', async () => {
    const code_graph = await generate_code_graph({
      root_path: 'test/fixtures/inheritance',
      include_patterns: ['**/*.ts']
    });
    
    // Find a method call to an inherited method
    const child_file = code_graph.files.get('Child.ts');
    const parent_method_call = child_file.method_calls.find(
      call => call.method_name === 'parentMethod'
    );
    
    // Should be validated and resolved
    expect(parent_method_call.is_valid).toBe(true);
    expect(parent_method_call.resolved_class).toBe('Parent');
    expect(parent_method_call.is_inherited).toBe(true);
  });
  
  it('should validate constructor calls against type registry', async () => {
    const code_graph = await generate_code_graph({
      root_path: 'test/fixtures/constructors',
      include_patterns: ['**/*.ts']
    });
    
    const file = code_graph.files.get('main.ts');
    const valid_constructor = file.constructor_calls.find(
      call => call.class_name === 'MyClass'
    );
    const invalid_constructor = file.constructor_calls.find(
      call => call.class_name === 'NonExistent'
    );
    
    expect(valid_constructor.is_valid).toBe(true);
    expect(invalid_constructor.is_valid).toBe(false);
  });
  
  it('should capture types from constructor calls', async () => {
    const code_graph = await generate_code_graph({
      root_path: 'test/fixtures/type_flow',
      include_patterns: ['**/*.ts']
    });
    
    const file = code_graph.files.get('constructors.ts');
    
    // Variable 'foo' should have type 'Foo' from constructor
    const foo_type = file.type_info.get('foo');
    expect(foo_type).toBeDefined();
    expect(foo_type[0].type_name).toBe('Foo');
    expect(foo_type[0].source).toBe('constructor');
  });
});
```

### Performance Tests

- [ ] Verify no significant performance regression:

```typescript
it('should process large codebases efficiently', async () => {
  const start = Date.now();
  
  const code_graph = await generate_code_graph({
    root_path: 'test/fixtures/large_codebase',
    include_patterns: ['**/*.ts']
  });
  
  const duration = Date.now() - start;
  
  // Should complete within reasonable time
  expect(duration).toBeLessThan(5000); // 5 seconds for test codebase
  
  // Verify enrichment happened
  const enrichment_stats = code_graph.stats;
  expect(enrichment_stats.validated_constructors).toBeGreaterThan(0);
  expect(enrichment_stats.resolved_methods).toBeGreaterThan(0);
});
```

### Error Handling Tests

- [ ] Test graceful handling when dependencies are missing:

```typescript
it('should handle missing type registry gracefully', async () => {
  // Simulate partial pipeline
  const analyses = new Map();
  // ... setup test data ...
  
  // Should not throw even if registry is undefined
  const enriched = enrich_constructor_calls_with_types(
    constructor_calls,
    undefined, // Missing registry
    imports
  );
  
  // Calls should be unchanged but not crash
  expect(enriched).toEqual(constructor_calls);
});
```

## Success Metrics

- [ ] All enrichment functions are actually called during code graph generation
- [ ] Cross-file method resolution works (inherited methods found)
- [ ] Cross-file constructor validation works (imported classes validated)
- [ ] Bidirectional type flow works (constructor types appear in type map)
- [ ] No performance regression (< 10% slower than without enrichment)
- [ ] All existing tests continue to pass
- [ ] New integration tests demonstrate end-to-end enrichment

## Debugging Support

Add debug logging to track enrichment:

```typescript
const DEBUG = process.env.DEBUG_ENRICHMENT;

if (DEBUG) {
  console.log(`[Enrichment] Building type registry from ${analyses.size} files`);
  console.log(`[Enrichment] Registered ${type_registry.size} types`);
  console.log(`[Enrichment] Building class hierarchy`);
  console.log(`[Enrichment] Found ${class_hierarchy.classes.size} classes`);
  console.log(`[Enrichment] Enriching method calls`);
  console.log(`[Enrichment] Enriching constructor calls`);
}
```

## Error Cases to Handle

1. **Circular Dependencies**: Registry/hierarchy might have cycles
2. **Missing Imports**: Files might reference non-existent imports
3. **Partial Analysis**: Some files might fail to parse
4. **Large Codebases**: Memory/performance considerations
5. **Language Mixing**: Different languages in same project

## Implementation Notes

### Why This Order Matters

1. **Type Registry First**: Needed by constructor validation
2. **Class Hierarchy Second**: Needed by method resolution
3. **Bidirectional Flow Early**: Enhances type map for later stages
4. **Enrichments Last**: Use all available global data

### Key Files to Modify

- `/packages/core/src/code_graph.ts` - Main integration point
- `/packages/core/src/types.ts` - May need interface updates
- `/packages/core/test/integration/` - New integration tests

### Gotchas to Avoid

1. Don't call enrichment before dependencies are built
2. Don't mutate shared data structures (create new ones)
3. Handle undefined/null gracefully (partial analysis)
4. Consider memory usage with large codebases
5. Maintain language-agnostic interfaces

## Follow-Up Considerations

After this task:
1. Add caching for repeated lookups
2. Add parallel processing where possible
3. Add incremental update support
4. Add detailed performance metrics
5. Consider lazy evaluation for large codebases

## References

- Enrichment functions created in: 11.62.5, 11.62.6, 11.62.7
- Architecture guide: `/docs/Architecture.md`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md`
- Parent task: task-epic-11.62