# Task 11.74: Wire and Consolidate Unwired Modules

## Status: Created
**Priority**: CRITICAL
**Type**: Architecture Rectification
**Parent**: Epic 11 - Codebase Restructuring

## Summary

Rectify the lack of coordination between modules by wiring 24 unwired modules into the processing pipeline, consolidating duplicated functionality, and deprecating redundant implementations. This addresses the critical finding that 65% of implemented modules are not integrated into the main processing flow.

## Context

The MODULE_INVENTORY analysis revealed a significant architectural gap:
- **35% wired**: Only 13 of 37 modules are integrated into the processing pipeline
- **65% unwired**: 24 complete modules sit dormant, including critical type analysis features
- **Duplication**: Multiple modules implement overlapping functionality
- **Gaps**: No active caching, no incremental processing, no error collection

This represents a massive untapped potential - most of the hard implementation work is done, but the modules aren't connected to deliver value.

## Problem Statement

The codebase suffers from organic growth without coordination:
1. Modules were created in isolation without clear integration plans
2. Multiple teams/iterations solved similar problems differently
3. The processing pipeline (`code_graph.ts` and `file_analyzer.ts`) cherry-picks functionality
4. Critical features like generic type resolution are complete but unused
5. Performance optimizations (caching, incremental updates) exist but aren't wired

## Success Criteria

### Must Have
- [ ] All critical type analysis modules wired into appropriate pipeline phases
- [ ] Duplicated functionality consolidated into single implementations
- [ ] Deprecated modules removed from codebase
- [ ] Updated PROCESSING_PIPELINE.md reflecting actual implementation

### Should Have
- [ ] Error collection wired throughout pipeline
- [ ] Storage/caching layer activated
- [ ] Consistent use of module index.ts exports

### Could Have
- [ ] Incremental processing enabled
- [ ] Query API layer activated
- [ ] Project manager as alternative entry point

## Technical Approach

### Phase 1: Wire Critical Features (11.74.1-5)
Wire complete but unused type analysis capabilities into the pipeline.

### Phase 2: Consolidate Duplications (11.74.6-8)
Merge overlapping functionality into single, canonical implementations.

### Phase 3: Remove Deprecated (11.74.9-11)
Delete modules whose functionality is covered elsewhere.

### Phase 4: Infrastructure (11.74.12-14)
Enable performance and diagnostic capabilities.

## Sub-Tasks

### Critical Type Features (Immediate Priority)
- 11.74.1: Wire generic type resolution into Layer 7
- 11.74.2: Wire type propagation into Layer 7
- 11.74.3: Wire parameter type inference into Layer 3
- 11.74.4: Wire return type inference into Layer 3
- 11.74.5: Wire namespace resolution into Layer 7

### Consolidation (High Priority)
- 11.74.6: Merge variable_analysis into scope_tree
- 11.74.7: Merge definition_finder into symbol_resolution
- 11.74.8: Standardize enrichment pattern vs call_resolution

### Deprecation (Medium Priority)
- 11.74.9: Remove definition_extraction module
- 11.74.10: Remove type_resolution stub module
- 11.74.11: Clean up redundant direct imports

### Infrastructure (Lower Priority)
- 11.74.12: Wire error_collection throughout pipeline
- 11.74.13: Activate caching layer for performance
- 11.74.14: Implement incremental processing

## Dependencies

- Requires understanding of PROCESSING_PIPELINE.md architecture
- Must maintain backward compatibility with existing API
- Should coordinate with any in-progress feature work

## Risks

1. **Integration Complexity**: Wiring modules may reveal interface mismatches
2. **Performance Impact**: Adding more processing layers could slow analysis
3. **Test Coverage**: Many unwired modules may lack integration tests
4. **Hidden Dependencies**: Modules may have undocumented cross-dependencies

## Implementation Notes

### Module Wiring Locations

**file_analyzer.ts Layer 3 additions:**
```typescript
// Add to analyze_local_types()
const parameter_types = infer_parameter_types(root_node, source_code, language);
const return_types = infer_function_return_types(root_node, source_code, language);
```

**code_graph.ts Layer 7 additions:**
```typescript
// Add after type_registry building
const resolved_generics = resolve_generic_types(type_registry, analyses);
const propagated_types = propagate_types(type_registry, modules, analyses);
const resolved_namespaces = resolve_namespaces(modules, exports);
```

### Consolidation Strategy

1. **Identify overlap**: Map duplicate functionality
2. **Choose winner**: Select more complete/integrated implementation
3. **Migrate features**: Port unique capabilities to winner
4. **Update imports**: Redirect all imports to consolidated module
5. **Delete loser**: Remove redundant module

## Testing Requirements

- Integration tests for each newly wired module
- Performance benchmarks before/after wiring
- Regression tests for existing functionality
- Cross-file type resolution test suite
- Caching effectiveness metrics

## Estimated Effort

- **Total**: 15-20 days
- **Critical wiring**: 5 days (1 day per module)
- **Consolidation**: 5 days
- **Deprecation**: 2 days
- **Infrastructure**: 3-5 days
- **Testing**: 3-5 days

## Notes

This is a critical architectural rectification that will:
1. Unlock significant latent capabilities
2. Reduce maintenance burden through consolidation
3. Improve performance through caching
4. Enable future incremental analysis

The MODULE_INVENTORY.md should be updated after each sub-task to track progress.