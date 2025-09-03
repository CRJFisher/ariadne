# Task 11.74.15: Wire Interface Implementation Module

**Status:** Ready
**Priority:** High
**Size:** Small

## Summary

Wire the complete but unused `inheritance/interface_implementation` module into the class hierarchy building phase to track which classes implement which interfaces.

## Context

The interface implementation module is complete and tested but not wired into the main processing pipeline. It should be integrated alongside class hierarchy building in Layer 6 of the Global Assembly Phase.

## Acceptance Criteria

- [ ] Import and use `track_interface_implementations` in `code_graph.ts` 
- [ ] Call it after/alongside `build_class_hierarchy` with appropriate context
- [ ] Store interface implementation data in the ClassHierarchy or separate structure
- [ ] Verify interface tracking works for TypeScript interfaces
- [ ] Verify interface tracking works for Rust traits
- [ ] Update integration tests to verify interface implementations are tracked

## Technical Details

### Current State
- Module exists at `/inheritance/interface_implementation/`
- Has complete implementation with language dispatchers
- Not imported or used in code_graph.ts

### Integration Point
In `code_graph.ts` around line 865 after building class hierarchy:
```typescript
// Build the hierarchy using the updated implementation
const hierarchy = build_class_hierarchy(class_definitions, contexts);

// NEW: Track interface implementations
const interface_implementations = track_interface_implementations(
  class_definitions,
  contexts
);
```

### Files to Modify
- `packages/core/src/code_graph.ts` - Wire the module
- `packages/core/src/inheritance/interface_implementation/index.ts` - Ensure proper exports
- Integration tests to verify interface tracking

## Dependencies
- Requires class hierarchy to be built first
- Should coordinate with method override detection (11.74.16)

## Implementation Notes
- Check if interface data should be stored in ClassHierarchy or separately
- Consider how interface implementations affect method resolution
- Ensure language-specific interface/trait semantics are preserved

## Test Requirements
- Test TypeScript interface implementation tracking
- Test Rust trait implementation tracking  
- Test multiple interface implementations
- Test interface inheritance chains
- Verify cross-file interface resolution works

## Related Tasks
- Parent: Task 11.74 (Module consolidation)
- Related: Task 11.74.16 (Wire method override detection)