# Task 11.74.16: Wire Method Override Detection Module

**Status:** Ready
**Priority:** High
**Size:** Small

## Summary

Wire the complete but unused `inheritance/method_override` module into the class hierarchy building phase to detect and track method overrides in inheritance chains.

## Context

The method override module is complete but not wired into the processing pipeline. It should be integrated alongside class hierarchy building in Layer 6 to identify which methods override parent class methods.

## Acceptance Criteria

- [ ] Import and use `detect_method_overrides` in `code_graph.ts`
- [ ] Call it after building class hierarchy with hierarchy context
- [ ] Enhance ClassHierarchy with override information
- [ ] Verify override detection for JavaScript/TypeScript classes
- [ ] Verify override detection for Python classes
- [ ] Ensure override chains are properly tracked

## Technical Details

### Current State
- Module exists at `/inheritance/method_override/`
- Has complete implementation
- Some overlap with class hierarchy's existing override tracking
- Not imported or used in code_graph.ts

### Integration Point
In `code_graph.ts` after building class hierarchy:
```typescript
// Build the hierarchy using the updated implementation
const hierarchy = build_class_hierarchy(class_definitions, contexts);

// NEW: Detect method overrides
const method_overrides = detect_method_overrides(
  hierarchy,
  class_definitions
);

// Merge override information into hierarchy
enhance_hierarchy_with_overrides(hierarchy, method_overrides);
```

### Considerations
- Class hierarchy already has some override tracking
- Need to reconcile or merge the two approaches
- Override information is critical for polymorphic call resolution

### Files to Modify
- `packages/core/src/code_graph.ts` - Wire the module
- `packages/core/src/inheritance/method_override/index.ts` - Ensure exports
- `packages/core/src/inheritance/class_hierarchy/` - Possibly enhance with override data

## Dependencies
- Requires class hierarchy to be built first
- Should coordinate with interface implementation (11.74.15)
- Override data needed by enrichment phase

## Implementation Notes
- Determine if override data should enhance existing hierarchy or be separate
- Consider how override chains affect virtual method dispatch
- Ensure language-specific override semantics (super calls, etc.)

## Test Requirements
- Test simple method overrides
- Test override chains (grandparent -> parent -> child)
- Test multiple inheritance override resolution (Python)
- Test interface method implementations vs overrides
- Test static method "overrides" (shadowing)
- Verify cross-file override detection

## Related Tasks
- Parent: Task 11.74 (Module consolidation)
- Related: Task 11.74.15 (Wire interface implementation)