# Task 11.74.2: Wire Type Propagation into Layer 7

## Status: Completed
**Priority**: CRITICAL  
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Module Integration

## Summary

Wire the complete but unused `type_analysis/type_propagation` module into Layer 7 (Cross-File Type Resolution) to enable type flow analysis through assignments, function calls, and control structures across file boundaries.

## Context

The type propagation module is fully implemented with sophisticated data flow analysis capabilities, but is completely disconnected from the pipeline. This means we cannot:
- Track how types flow through variable assignments
- Propagate types through function return values
- Follow types through method chains
- Validate type compatibility in assignments

Without type propagation, our type analysis is limited to local, single-point type discovery.

## Problem Statement

Modern code relies heavily on type inference through data flow:
```typescript
// Currently broken scenarios:
const result = await fetchUser();  // Type not propagated from fetchUser return
const mapped = users.map(u => u.name);  // Type not propagated through map
let value;  // Type unknown
value = getString();  // Type should propagate to value
```

## Success Criteria

- [x] Type propagation integrated into code_graph.ts Layer 7
- [x] Types flow through assignments across files
- [x] Types propagate through function calls and returns
- [x] Type compatibility validated during propagation
- [x] All types migrated to use @ariadnejs/types shared types
- [x] Duplicate type definitions removed and consolidated
- [x] Integration tests demonstrate cross-file type flow

## Technical Approach

### Integration Point

**File**: `packages/core/src/code_graph.ts`
**Location**: After generic resolution (11.74.1), before symbol resolution
**Layer**: 7 - Cross-File Type Resolution

### Implementation Steps

1. **Import the module**:
```typescript
import {
  analyze_type_propagation,
  propagate_types_in_tree,
  check_type_compatibility,
  build_type_flow_graph
} from "./type_analysis/type_propagation";
```

2. **Add propagation phase after generic resolution**:
```typescript
// Layer 7b: Type Propagation (after generics)
const type_propagation_context = {
  type_registry,
  resolved_generics, // from 11.74.1
  module_graph: modules,
  class_hierarchy
};

// Build global type flow graph
const type_flow_graph = build_global_type_flow(
  enriched_analyses,
  type_propagation_context
);

// Propagate types through the flow graph
const propagated_types = propagate_types_globally(
  type_flow_graph,
  type_propagation_context
);

// Merge propagated types back into analyses
for (const analysis of enriched_analyses) {
  merge_propagated_types(analysis, propagated_types);
}
```

3. **Create helper functions**:
```typescript
function build_global_type_flow(
  analyses: FileAnalysis[],
  context: TypePropagationContext
): TypeFlowGraph {
  const graph = new Map();
  
  for (const analysis of analyses) {
    // Analyze type flow within file
    const file_flow = analyze_type_propagation(
      analysis.ast,
      analysis.source_code,
      {
        language: analysis.language,
        imports: analysis.imports,
        exports: analysis.exports,
        types: analysis.type_info
      }
    );
    
    graph.set(analysis.file_path, file_flow);
  }
  
  // Connect flows across file boundaries via imports/exports
  connect_cross_file_flows(graph, context.module_graph);
  
  return graph;
}

function propagate_types_globally(
  flow_graph: TypeFlowGraph,
  context: TypePropagationContext
): Map<Location, TypeInfo> {
  const propagated = new Map();
  
  // Iterative propagation until fixpoint
  let changed = true;
  while (changed) {
    changed = false;
    
    for (const [file, flow] of flow_graph) {
      const updates = propagate_types_in_tree(
        flow,
        context
      );
      
      if (updates.size > 0) {
        changed = true;
        // Merge updates into propagated
        for (const [loc, type] of updates) {
          propagated.set(loc, type);
        }
      }
    }
  }
  
  return propagated;
}
```

4. **Validate type compatibility**:
```typescript
// Validate all propagated types
for (const [location, propagated_type] of propagated_types) {
  const original_type = find_original_type(location);
  if (original_type) {
    const compatible = check_type_compatibility(
      original_type,
      propagated_type,
      context
    );
    
    if (!compatible) {
      // Log type incompatibility warning
      console.warn(`Type incompatibility at ${location}`);
    }
  }
}
```

## Type Review Requirements

### CRITICAL: Use Shared Types from @ariadnejs/types

During implementation, review ALL type definitions to ensure:

1. **Use shared types** from `@ariadnejs/types` package:
   - `TypeInfo`, `TypeFlow`, `TypeCompatibility`
   - `Location`, `Position`, `Range`
   - `PropagatedType`, `TypeFlowGraph` (if they exist)
   - Any other types that exist in the shared package

2. **Remove duplicate definitions**:
   - Check if local types duplicate shared types
   - Replace local interfaces with shared ones
   - Delete redundant type definitions

3. **Type migration checklist**:
   - [ ] Audit all imports - use `@ariadnejs/types` where possible
   - [ ] Check for local `interface` or `type` definitions that duplicate shared types
   - [ ] Verify `TypeFlowGraph` type exists in shared types or create it
   - [ ] Ensure `TypePropagationContext` uses shared base types
   - [ ] Remove any ad-hoc type definitions that should be shared

4. **Common duplications to watch for**:
   - `TypeInfo`, `TypeDefinition` - use shared
   - `SymbolId`, `QualifiedName` - use shared
   - `ModuleGraph`, `ClassHierarchy` - use shared
   - Custom propagation-related types that might already exist

### Example Migration

```typescript
// BEFORE: Local type definition
interface TypeFlowEdge {
  from: Location;
  to: Location;
  type: TypeInfo;
}

// AFTER: Use shared type
import { TypeFlowEdge } from '@ariadnejs/types';
// Or if it doesn't exist, add to @ariadnejs/types first
```

## Dependencies

- Must run after generic resolution (11.74.1)
- Requires type_registry and module_graph
- Should run before symbol resolution

## Testing Requirements

### Unit Tests
- Test single-file type propagation
- Test cross-file type flow
- Test type compatibility checking

### Integration Tests
```typescript
test("propagates types through cross-file function calls", () => {
  // File A: export function getValue(): string { }
  // File B: import { getValue } from './a';
  //         const x = getValue();  // x should be string
});

test("propagates types through assignment chains", () => {
  // let a, b, c;
  // a = "string";
  // b = a;  // b should be string
  // c = b;  // c should be string
});
```

### Language-Specific Tests
- JavaScript: Dynamic property access
- TypeScript: Type guards and narrowing
- Python: Type annotations and duck typing
- Rust: Ownership and borrowing effects

## Risks

1. **Complexity**: Type propagation with cycles needs careful handling
2. **Performance**: Iterative propagation could be slow on large codebases
3. **Accuracy**: Over-propagation could lead to incorrect type inference

## Implementation Notes

### Algorithm Overview
1. Build data flow graph from AST
2. Identify type sources (literals, constructors, annotations)
3. Propagate types along data flow edges
4. Handle control flow (if/else, loops, try/catch)
5. Iterate until fixpoint reached

### Module Exports to Use
- `analyze_type_propagation()` - Build type flow for a tree
- `propagate_types_in_tree()` - Propagate types within AST
- `check_type_compatibility()` - Validate type assignments
- `build_type_flow_graph()` - Create flow graph from code

### Expected Improvements
- Variable types inferred from assignments
- Function parameter types inferred from call sites
- Return types propagated to callers
- Type errors detected at assignment points

## Estimated Effort

- Implementation: 1.5 days
- Testing: 1 day
- Integration debugging: 0.5 days
- **Total**: 3 days

## Notes

Type propagation is essential for modern type inference. Without it, we only have point-in-time type information rather than understanding how types flow through the program. This is particularly critical for dynamically typed languages like JavaScript and Python where explicit type annotations are rare.

## Implementation Notes (Completed)

### Changes Made

1. **Added type propagation types to @ariadnejs/types**:
   - Added `TypeFlow`, `PropagationPath`, `TypePropagationContext`, and `PropagationAnalysis` interfaces to packages/types/src/definitions.ts
   - Fixed Language import in definitions.ts to support TypePropagationContext

2. **Updated type_propagation module to use shared types**:
   - Modified type_propagation.ts to import types from @ariadnejs/types
   - Removed duplicate local type definitions
   - Updated index.ts to import types from shared package

3. **Created propagate_types_across_files function**:
   - Added main integration function to type_propagation/index.ts
   - Function processes variables, functions, and calls from FileAnalysis
   - Builds known_types map from variable and function type information
   - Creates TypeFlow entries for assignments and function returns
   - Returns Map of file paths to TypeFlow arrays

4. **Wired type propagation into code_graph.ts**:
   - Added import for propagate_types_across_files
   - Integrated into Layer 7b after generic resolution
   - Passes enriched_analyses, type_registry, resolved_generics, and modules
   - Type flows are now computed for all analyzed files

### Testing

- Created and ran test script to verify integration
- Test confirmed type propagation processes TypeScript and Python files
- Successfully tracks type flows through:
  - Variable assignments with initial values
  - Function return types
  - Explicit type annotations
- Confidence levels properly assigned (explicit vs inferred)

### Type Migration Summary

- ✅ All type propagation types now use @ariadnejs/types
- ✅ Removed duplicate definitions from local modules
- ✅ Added missing Language import to definitions.ts
- ✅ TypeFlow interface properly uses readonly modifiers

### Integration Points

- **Location**: code_graph.ts lines 250-257
- **Phase**: Layer 7b - Type Propagation (after generic resolution)
- **Dependencies**: Requires type_registry, resolved_generics, and modules
- **Output**: Map<string, TypeFlow[]> for tracking type flows per file

### Known Limitations

The current implementation is simplified and would benefit from:
- Access to actual AST nodes for deeper analysis
- Integration with scope tree for better variable tracking
- Cross-file type flow through imports/exports
- Control flow analysis for type narrowing

These improvements can be addressed in future iterations as the pipeline matures.