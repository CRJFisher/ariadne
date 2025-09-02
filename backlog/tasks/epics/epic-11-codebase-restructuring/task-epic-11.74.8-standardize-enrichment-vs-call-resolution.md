# Task 11.74.8: Standardize Enrichment Pattern vs Call Resolution

## Status: Created
**Priority**: HIGH
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Module Consolidation

## Summary

Standardize on the enrichment pattern used in `code_graph.ts` and remove/integrate the redundant `call_graph/call_resolution` module. Both solve the same problem of resolving calls using global context, but enrichment is already wired and working.

## Context

We have two approaches to the same problem:
- **Enrichment functions** (wired): `enrich_method_calls_with_hierarchy()`, `enrich_constructor_calls_with_types()`
- **Call resolution module** (not wired): `resolve_method_calls()`, `resolve_constructor_calls()`

The enrichment pattern is superior because:
1. It's already integrated and working
2. It follows a clear pattern (raw data → global context → enriched data)
3. It's more maintainable and testable

## Problem Statement

Having two approaches causes:
```typescript
// Current duplication:
// Enrichment (used):
const enriched = enrich_method_calls_with_hierarchy(calls, hierarchy);

// Call resolution (unused):
const resolved = resolve_method_calls(calls, hierarchy);
```

Both do the same thing - use global context to enhance call information.

## Success Criteria

- [ ] Call resolution features merged into enrichment functions
- [ ] Enrichment pattern documented as standard
- [ ] Direct imports of enrichment functions removed
- [ ] call_resolution module integrated or deleted
- [ ] Consistent enrichment API for all call types

## Technical Approach

### Standardization Strategy

1. **Audit call_resolution** for unique features
2. **Enhance enrichment** functions with missing features
3. **Create consistent enrichment API**
4. **Wire through proper module structure**
5. **Delete or repurpose call_resolution**

### Implementation Steps

1. **Analyze call_resolution features**:
```typescript
// Unique features to preserve:
- Polymorphic call resolution
- Virtual method dispatch tracking
- Interface method resolution
- Call target ranking/scoring
```

2. **Enhance enrichment functions**:
```typescript
// In call_graph/method_calls/method_hierarchy_resolver.ts

export function enrich_method_calls_with_hierarchy(
  calls: MethodCallInfo[],
  hierarchy: ClassHierarchy,
  options?: EnrichmentOptions  // NEW
): EnrichedMethodCall[] {
  const enriched = [];
  
  for (const call of calls) {
    const enriched_call = {
      ...call,
      // Existing enrichments
      defining_class_resolved: find_defining_class(call, hierarchy),
      is_override: is_overridden_method(call, hierarchy),
      
      // NEW: From call_resolution
      possible_targets: resolve_polymorphic_targets(call, hierarchy),
      dispatch_type: determine_dispatch_type(call, hierarchy),
      confidence_score: calculate_resolution_confidence(call, hierarchy),
      interface_implementations: find_interface_implementations(call, hierarchy)
    };
    
    enriched.push(enriched_call);
  }
  
  return enriched;
}

// Port polymorphic resolution from call_resolution
function resolve_polymorphic_targets(
  call: MethodCallInfo,
  hierarchy: ClassHierarchy
): ResolvedTarget[] {
  // Implementation from call_resolution module
  const receiver_type = call.receiver_type;
  const method_name = call.method_name;
  
  // Find all possible classes this could dispatch to
  const targets = [];
  
  // Check the declared class and all subclasses
  const base_class = hierarchy.classes.get(receiver_type);
  if (base_class) {
    // Add base class method if it exists
    if (has_method(base_class, method_name)) {
      targets.push({
        class: base_class.name,
        method: method_name,
        is_override: false,
        confidence: 1.0
      });
    }
    
    // Check all subclasses for overrides
    for (const subclass of base_class.all_descendants) {
      if (has_method(subclass, method_name)) {
        targets.push({
          class: subclass.name,
          method: method_name,
          is_override: true,
          confidence: calculate_dispatch_probability(call, subclass)
        });
      }
    }
  }
  
  return targets;
}
```

3. **Create standardized enrichment module**:
```typescript
// NEW: call_graph/enrichment/index.ts

export interface EnrichmentContext {
  type_registry: TypeRegistry;
  class_hierarchy: ClassHierarchy;
  module_graph: ModuleGraph;
  resolved_generics?: Map<string, ResolvedGeneric>;
  propagated_types?: Map<Location, TypeInfo>;
}

export interface EnrichmentOptions {
  resolve_polymorphic?: boolean;
  track_interfaces?: boolean;
  include_confidence?: boolean;
}

// Standardized enrichment API
export function enrich_all_calls(
  analysis: FileAnalysis,
  context: EnrichmentContext,
  options?: EnrichmentOptions
): EnrichedFileAnalysis {
  return {
    ...analysis,
    function_calls: enrich_function_calls(
      analysis.function_calls,
      context,
      options
    ),
    method_calls: enrich_method_calls(
      analysis.method_calls,
      context,
      options
    ),
    constructor_calls: enrich_constructor_calls(
      analysis.constructor_calls,
      context,
      options
    )
  };
}
```

4. **Update code_graph.ts to use standardized API**:
```typescript
// In code_graph.ts

import { 
  enrich_all_calls,
  EnrichmentContext
} from "./call_graph/enrichment";

// Replace individual enrichment calls
const enrichment_context: EnrichmentContext = {
  type_registry,
  class_hierarchy: local_hierarchy,
  module_graph: modules,
  resolved_generics,  // from 11.74.1
  propagated_types    // from 11.74.2
};

const enriched_analyses = analyses.map(analysis => 
  enrich_all_calls(analysis, enrichment_context, {
    resolve_polymorphic: true,
    track_interfaces: true,
    include_confidence: true
  })
);
```

5. **Integrate or remove call_resolution**:
```typescript
// Option A: Repurpose as internal implementation
// Move to call_graph/enrichment/resolution.ts

// Option B: Delete if fully redundant
// rm -rf packages/core/src/call_graph/call_resolution/
```

## Dependencies

- Must preserve polymorphic resolution capabilities
- Should maintain backward compatibility
- Enrichment pattern must be consistent

## Testing Requirements

### Standardization Tests
```typescript
test("enrichment handles polymorphic calls", () => {
  const calls = [/* method calls */];
  const enriched = enrich_all_calls(analysis, context);
  
  expect(enriched.method_calls[0].possible_targets).toHaveLength(3);
  expect(enriched.method_calls[0].dispatch_type).toBe('virtual');
});

test("enrichment preserves all call_resolution features", () => {
  // Test that all features from call_resolution work
  const enriched = enrich_method_calls(calls, hierarchy, {
    resolve_polymorphic: true
  });
  
  expect(enriched[0].interface_implementations).toBeDefined();
  expect(enriched[0].confidence_score).toBeGreaterThan(0);
});
```

## Risks

1. **Feature Loss**: Missing call_resolution capabilities
2. **Performance**: Enrichment might become too heavy
3. **API Changes**: Consumers expecting call_resolution API

## Implementation Notes

### Enrichment Pattern Benefits

1. **Progressive Enhancement**: Raw → Enriched
2. **Clear Separation**: Local analysis vs Global enrichment
3. **Testability**: Each enrichment phase is isolated
4. **Flexibility**: Options control enrichment level

### Features to Port

From call_resolution:
- Polymorphic target resolution
- Virtual dispatch analysis
- Interface method tracking
- Confidence scoring
- Call disambiguation

### Final Architecture

```
Per-File Analysis → Global Assembly → Enrichment
                                       ↑
                              All enhancement here
```

## Estimated Effort

- Audit call_resolution: 0.5 days
- Enhance enrichment functions: 1 day
- Create standardized API: 0.5 days
- Update imports: 0.5 days
- Testing: 0.5 days
- **Total**: 3 days

## Notes

This standardization is important for maintainability. Having two patterns for the same problem (enrichment vs resolution) creates confusion. The enrichment pattern has proven successful and should be the standard approach for enhancing per-file data with global context. This also sets a clear architectural pattern for future enhancements.