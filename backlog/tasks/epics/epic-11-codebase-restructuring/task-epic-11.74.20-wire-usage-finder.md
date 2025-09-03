# Task 11.74.20: Wire Usage Finder Module

**Status:** Ready  
**Priority:** Low
**Size:** Small

## Summary

Wire the complete but unused `scope_analysis/usage_finder` module into Layer 1 (Scope Analysis) to track symbol usages alongside definitions for complete reference tracking.

## Context

The usage finder module is complete but not wired. While scope_tree finds definitions, usage_finder specifically tracks where symbols are used/referenced, which is crucial for features like "find all references" and dead code detection.

## Acceptance Criteria

- [ ] Import and use `find_usages` in file_analyzer.ts Layer 1
- [ ] Call it alongside scope tree building
- [ ] Store usage information in FileAnalysis
- [ ] Track both local and cross-file usages
- [ ] Ensure usages have accurate locations
- [ ] Connect usages to their definitions via symbols

## Technical Details

### Current State
- Module exists at `/scope_analysis/usage_finder/`
- Complete implementation
- Partially covered by scope_tree but not comprehensively
- Not imported in file_analyzer.ts

### Integration Point
In `file_analyzer.ts` Layer 1:
```typescript
function analyze_scopes(
  tree: Parser.Tree,
  source_code: string,
  language: Language,
  file_path: string
): Layer1Results {
  const scopes = build_scope_tree(
    tree.rootNode,
    source_code,
    language,
    file_path
  );
  
  // NEW: Find all symbol usages
  const usages = find_usages(
    tree.rootNode,
    source_code,
    language,
    scopes
  );
  
  return { scopes, usages };
}
```

### What It Provides
- Complete list of symbol references/usages
- Distinguishes definitions from usages
- Enables "find all references" functionality
- Helps identify unused symbols
- Critical for refactoring tools

### Use Cases
- Find all references to a function
- Identify unused variables
- Track symbol popularity/importance
- Support rename refactoring
- Dead code detection

### Files to Modify
- `packages/core/src/file_analyzer.ts` - Wire in Layer 1
- `packages/core/src/scope_analysis/usage_finder/index.ts` - Verify exports
- FileAnalysis type to include usages
- Symbol index to connect usages to definitions

## Dependencies
- Requires scope tree for context
- Should be done alongside scope analysis
- Enhances symbol resolution

## Implementation Notes
- Consider memory impact of tracking all usages
- Usages should reference symbol IDs not names
- Track usage context (read, write, call, etc.)
- Consider adding usage type enum

## Test Requirements
- Test variable usage tracking
- Test function call as usage
- Test method reference as usage
- Test class instantiation as usage
- Test import as usage
- Test property access as usage
- Verify usage locations are accurate
- Test cross-file usage tracking

## Related Tasks
- Parent: Task 11.74 (Module consolidation)
- Enhances: Symbol resolution and indexing
- Enables: Find references, dead code detection