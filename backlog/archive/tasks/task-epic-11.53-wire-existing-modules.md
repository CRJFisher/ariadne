# Task: Wire Up Existing Working Modules

**Epic**: Epic 11 - Codebase Restructuring  
**Priority**: CRITICAL  
**Status**: Not Started  
**Dependencies**: None - these modules already work!

## Problem Statement

The FOLDER_STRUCTURE_REVIEW.md revealed that we have complete, working implementations that aren't being used in the new CodeGraph architecture. Most critically, `/inheritance_analysis/class_hierarchy/` has full language-specific implementations but code_graph.ts returns an empty stub.

## Success Criteria

- [ ] Wire up `/inheritance_analysis/class_hierarchy/` to build ClassHierarchy
- [ ] Wire up `/scope_analysis/symbol_resolution/` to build SymbolIndex  
- [ ] Wire up `/call_graph/call_chain_analysis/` to populate call chains
- [ ] Wire up `/import_export/namespace_resolution/` for namespace handling
- [ ] Delete duplicate `/inheritance/class_detection/` placeholder
- [ ] Rename `/inheritance_analysis/` to `/inheritance/`

## Implementation Plan

### 1. Class Hierarchy (MOST CRITICAL)
```typescript
// In code_graph.ts, replace the stub:
import { build_class_hierarchy } from './inheritance_analysis/class_hierarchy';

// In Stage 2 assembly:
const classes = build_class_hierarchy(
  analyses.map(a => ({
    file_path: a.file_path,
    classes: a.classes,
    // ... other needed data
  }))
);
```

The existing implementation already handles:
- JavaScript ES6 classes
- TypeScript classes and interfaces
- Python classes with inheritance
- Rust structs and traits

### 2. Symbol Resolution
```typescript
import { resolve_symbols } from './scope_analysis/symbol_resolution';

// Use to build SymbolIndex with proper cross-file resolution
```

### 3. Call Chain Analysis
```typescript
import { analyze_call_chains } from './call_graph/call_chain_analysis';

// After building initial CallGraph:
const call_chains = analyze_call_chains(calls);
```

### 4. Namespace Resolution
```typescript
import { resolve_namespace_imports } from './import_export/namespace_resolution';

// During module graph building for namespace imports
```

## Why This Is Critical

We're currently:
1. Creating empty stubs for functionality that already exists
2. Planning to reimplement code that's already written and tested
3. Missing out on language-specific handling that's already done

The `/inheritance_analysis/class_hierarchy/` module alone has:
- 12KB of core logic
- 9KB of JavaScript-specific handling
- 11KB of Python-specific handling  
- 11KB of Rust-specific handling
- 15KB of tests

This is production-ready code sitting unused!

## Testing

All these modules already have tests. After wiring:
1. Run existing tests to ensure compatibility
2. Update integration tests in code_graph.test.ts
3. Verify the CodeGraph output includes the new data

## Notes

- No new code needs to be written for basic functionality
- Focus on integration, not implementation
- These modules follow the marshaling pattern already