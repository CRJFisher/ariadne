# Task: Type Flow Integration and Initial Consolidation

**Task ID**: task-epic-11.96.2
**Parent**: task-epic-11.96
**Status**: Open
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 1-2 days

## Problem Statement

The `symbol_resolution.ts::phase3_resolve_types` has a placeholder for type flow analysis, while `type_resolution.ts::resolve_all_types` contains a working type flow implementation. We need to extract the working implementation and integrate it into the consolidated approach.

## Objective

Extract and integrate the working type flow analysis from `type_resolution.ts` into `symbol_resolution.ts`, creating the initial consolidated type resolution implementation.

## Current State Analysis

### Working Implementation Location
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:89-120`

**Working Components**:
```typescript
// Lines 89-97: Type flow preparation and analysis
const prepared_imports = prepare_imports_for_flow(imports);
const prepared_functions = prepare_functions_for_flow(functions);
const prepared_flows = convert_flows_for_analysis(local_types.type_flows);
const type_flow_results = analyze_type_flow(
  prepared_flows, prepared_imports, prepared_functions, type_registry
);

// Lines 99-108: Results integration
for (const [symbol_id, type_id] of type_flow_results.inferred_types) {
  symbol_types.set(symbol_id, type_id);
}
// ... more result processing
```

### Placeholder Location
**File**: `packages/core/src/symbol_resolution/symbol_resolution.ts:235-240`

**Placeholder Code**:
```typescript
// Current placeholder - needs replacement
const type_flow = {
  assignment_types: new Map<Location, TypeId>(),
  flow_edges: [],
};
```

## Implementation Requirements

### 1. Extract Type Flow Components

#### 1.1 Extract Helper Functions
**Source**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:244-375`

**Functions to Extract**:
- `prepare_imports_for_flow` (lines 244-270)
- `prepare_functions_for_flow` (lines 272-290)
- `convert_flows_for_analysis` (lines 294-375)

#### 1.2 Create Type Flow Module (Temporary)
**File**: Create `packages/core/src/symbol_resolution/type_resolution/type_flow_integration.ts`

**Content**:
```typescript
import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import type { FunctionResolutionMap, GlobalTypeRegistry } from "./types";
import type { LocalTypeFlowPattern } from "./types";
import { analyze_type_flow } from "./type_flow";

export interface TypeFlowIntegrationResult {
  assignment_types: Map<Location, TypeId>;
  inferred_types: Map<SymbolId, TypeId>;
  constructor_types: Map<Location, TypeId>;
  return_types: Map<SymbolId, TypeId>;
}

export function integrate_type_flow(
  type_flows: Map<FilePath, LocalTypeFlowPattern[]>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap,
  type_registry: GlobalTypeRegistry
): TypeFlowIntegrationResult {
  // Implementation extracted from type_resolution.ts
}

// Helper functions extracted from type_resolution.ts
function prepare_imports_for_flow(...) { /* extracted */ }
function prepare_functions_for_flow(...) { /* extracted */ }
function convert_flows_for_analysis(...) { /* extracted */ }
```

### 2. Integrate into Symbol Resolution

#### 2.1 Replace Placeholder in symbol_resolution.ts
**File**: `packages/core/src/symbol_resolution/symbol_resolution.ts:218-240`

**Current Code**:
```typescript
// Step 7: Analyze type flow
// Convert type_flows from array format to single flow
const type_flows_map = new Map<FilePath, TypeResolutionFlow>();
for (const [file_path, flows] of local_extraction.type_flows) {
  if (flows && flows.length > 0) {
    type_flows_map.set(file_path, flows[0]);
  }
}

// Note: analyze_type_flow expects different parameters than what we have
// This is a temporary workaround until the interfaces are aligned
const type_flow = {
  assignment_types: new Map<Location, TypeId>(),
  flow_edges: [],
};
```

**New Integration**:
```typescript
// Step 7: Analyze type flow using extracted implementation
import { integrate_type_flow } from "./type_resolution/type_flow_integration";

const type_flow_results = integrate_type_flow(
  local_extraction.type_flows,
  imports,
  functions,
  type_registry
);
```

#### 2.2 Update Result Processing
**File**: `packages/core/src/symbol_resolution/symbol_resolution.ts:246-266`

**Update Integration Logic**:
```typescript
// Populate symbol_types from type_tracking AND type_flow
if (type_tracking && type_tracking.variable_types) {
  for (const [symbol_id, type_id] of type_tracking.variable_types) {
    symbol_types.set(symbol_id, type_id);
  }
}

// Add type flow inferred types
if (type_flow_results.inferred_types) {
  for (const [symbol_id, type_id] of type_flow_results.inferred_types) {
    symbol_types.set(symbol_id, type_id);
  }
}

// Populate reference_types from resolved_annotations AND type_flow
if (resolved_annotations) {
  for (const [loc_key, type_id] of resolved_annotations) {
    // TODO: Parse location key back to Location if needed
    // For now just skip since the types don't match
  }
}

// Add type flow assignment types
if (type_flow_results.assignment_types) {
  for (const [loc, type_id] of type_flow_results.assignment_types) {
    reference_types.set(location_key(loc), type_id);
  }
}

// Add constructor types
if (type_flow_results.constructor_types) {
  for (const [loc, type_id] of type_flow_results.constructor_types) {
    reference_types.set(location_key(loc), type_id);
  }
}
```

### 3. Add Import and Export Updates

#### 3.1 Update Imports in symbol_resolution.ts
**File**: `packages/core/src/symbol_resolution/symbol_resolution.ts`

**Add Import**:
```typescript
import { integrate_type_flow } from "./type_resolution/type_flow_integration";
```

#### 3.2 Update Exports in type_resolution index.ts
**File**: `packages/core/src/symbol_resolution/type_resolution/index.ts`

**Add Export**:
```typescript
export { integrate_type_flow, type TypeFlowIntegrationResult } from "./type_flow_integration";
```

### 4. Basic Integration Testing

#### 4.1 Create Integration Test
**File**: Create `packages/core/src/symbol_resolution/type_resolution/type_flow_integration.test.ts`

**Test Categories**:
- **Extraction Tests**: Verify helper functions work correctly
- **Integration Tests**: Verify type flow results integrate properly
- **Data Consistency**: Verify results match expected formats
- **Edge Cases**: Test with empty data, malformed inputs

**Sample Test Structure**:
```typescript
describe('Type Flow Integration', () => {
  describe('Helper Functions', () => {
    test('prepare_imports_for_flow converts import maps correctly', () => {
      // Test conversion logic
    });

    test('prepare_functions_for_flow extracts function signatures', () => {
      // Test function preparation
    });

    test('convert_flows_for_analysis transforms flow patterns', () => {
      // Test flow conversion
    });
  });

  describe('Integration', () => {
    test('integrate_type_flow returns expected result format', () => {
      // Test main integration function
    });

    test('integration results work with symbol_resolution', () => {
      // Test end-to-end integration
    });
  });

  describe('Edge Cases', () => {
    test('handles empty type flows gracefully', () => {
      // Test empty inputs
    });

    test('handles malformed flow patterns', () => {
      // Test error cases
    });
  });
});
```

## Implementation Steps

### Step 1: Extract and Create Integration Module
1. Copy helper functions from `type_resolution.ts` to new `type_flow_integration.ts`
2. Create `integrate_type_flow` function that orchestrates the process
3. Ensure proper TypeScript types and imports

### Step 2: Update Symbol Resolution
1. Replace placeholder code in `symbol_resolution.ts`
2. Add proper result integration logic
3. Update imports and function calls

### Step 3: Test Integration
1. Create comprehensive test suite
2. Run existing tests to ensure no regression
3. Validate type flow results are properly integrated

### Step 4: Validate Compilation
1. Ensure TypeScript compilation passes
2. Fix any type mismatches or import issues
3. Run linting and type checking

## Acceptance Criteria

### Functional Requirements
- [ ] Type flow analysis is successfully extracted from `type_resolution.ts`
- [ ] Working type flow implementation replaces placeholder in `symbol_resolution.ts`
- [ ] All type flow results (assignments, inferences, constructors, returns) are integrated
- [ ] No compilation errors after integration

### Quality Requirements
- [ ] Integration module has clear, focused interface
- [ ] Helper functions are properly typed and documented
- [ ] Test coverage for all integration paths
- [ ] No performance regression from integration

### Validation Requirements
- [ ] Existing symbol resolution tests still pass
- [ ] New integration tests validate type flow functionality
- [ ] End-to-end type resolution works correctly
- [ ] Memory usage is reasonable (no major leaks)

## Risk Assessment

### Low Risk
- **Helper function extraction**: Well-contained, working code
- **Test creation**: No impact on existing functionality

### Medium Risk
- **Integration complexity**: Different data structures between implementations
- **Type mismatches**: May need interface adjustments during integration

### Mitigation Strategies
- **Incremental approach**: Test each extracted component separately
- **Type validation**: Use TypeScript strict mode to catch interface issues
- **Rollback plan**: Keep original code until integration is validated

## Success Metrics

1. **Functionality**: Type flow analysis works in consolidated implementation
2. **Performance**: No significant slowdown from integration
3. **Maintainability**: Clean separation between flow logic and integration
4. **Testing**: Comprehensive coverage of integration paths

## Next Steps

After completion:
- **Validate**: Ensure all existing tests pass with new integration
- **Document**: Update any relevant documentation
- **Proceed to**: task-epic-11.96.3 (Comprehensive Testing Infrastructure)

This creates the foundation for the consolidated type resolution implementation.