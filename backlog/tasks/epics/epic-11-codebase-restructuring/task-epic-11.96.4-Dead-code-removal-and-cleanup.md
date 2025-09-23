# Task: Dead Code Removal and Cleanup

**Task ID**: task-epic-11.96.4
**Parent**: task-epic-11.96
**Status**: Open
**Priority**: Medium
**Created**: 2025-01-22
**Estimated Effort**: 0.5-1 day

## Problem Statement

After consolidating type resolution implementations, the `type_resolution.ts` file contains significant dead code including:
- Unused main function (`resolve_all_types`) with bugs
- Empty stub functions with TODO comments
- Helper functions only used by removed code
- Outdated exports and imports

This dead code creates maintenance burden and confusion for developers.

## Objective

Remove all unused, duplicate, and stub code from the type resolution module while ensuring no impact on working functionality.

## Dead Code Analysis

### 1. Unused Main Function
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:58-120`

**Function**: `resolve_all_types`
- **Status**: Never called, contains bugs
- **Issue**: Passes `new Map()` instead of imports to inheritance resolution
- **LOC**: ~62 lines
- **Dependencies**: Uses helper functions that will also be removed

### 2. Empty Stub Functions
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:199-222`

**Functions to Remove**:
```typescript
// Lines 199-210: Empty constructor finder
function find_constructors(
  registry: GlobalTypeRegistry,
  functions: FunctionResolutionMap
): Map<TypeId, SymbolId> {
  const constructors = new Map<TypeId, SymbolId>();
  // TODO: Implement constructor finding logic
  return constructors;
}

// Lines 214-222: Undefined local type finder
function find_local_type(
  type_name: SymbolName,
  file_path: FilePath
): TypeId | undefined {
  // TODO: Implement local type lookup
  return undefined;
}
```

### 3. Helper Functions (Only Used by Removed Code)
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:244-375`

**Functions to Remove**:
- `prepare_imports_for_flow` (lines 244-270) - 27 lines
- `prepare_functions_for_flow` (lines 272-290) - 19 lines
- `convert_flows_for_analysis` (lines 294-375) - 82 lines

**Note**: These were moved to the integration module in task-epic-11.96.2

### 4. Additional Unused Code
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:173-195`

**Unused interfaces and functions**:
```typescript
// Lines 173-176: Unused interface
export interface TypeRegistryResult {
  registry: FileTypeRegistry;
  symbol_type_annotations: Map<SymbolId, TypeId>;
}

// Lines 178-195: Unused enhanced function
export function build_file_type_registry_with_annotations(...)
```

## Removal Plan

### 1. Remove Unused Main Function

#### 1.1 Delete resolve_all_types Function
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:58-120`

**Action**: Remove entire function and its documentation

**Before**:
```typescript
/**
 * Main type resolution entry point
 */
export function resolve_all_types(
  local_types: LocalTypeExtraction,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap,
  file_indices: Map<FilePath, any> // SemanticIndex type
): ResolvedTypes {
  // ... 62 lines of implementation
}
```

**After**: Complete removal

### 2. Remove Stub Functions

#### 2.1 Delete find_constructors Function
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:199-210`

**Action**: Remove function and comments

#### 2.2 Delete find_local_type Function
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:214-222`

**Action**: Remove function and comments

### 3. Remove Helper Functions

#### 3.1 Delete Flow Preparation Functions
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:244-375`

**Functions to Remove**:
- Remove `prepare_imports_for_flow` function
- Remove `prepare_functions_for_flow` function
- Remove `convert_flows_for_analysis` function

**Verification**: Ensure these functions are properly implemented in the integration module from task-epic-11.96.2

### 4. Remove Additional Unused Code

#### 4.1 Delete Unused Interface and Function
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts:173-195`

**Action**: Remove `TypeRegistryResult` interface and `build_file_type_registry_with_annotations` function

### 5. Update Module Exports

#### 5.1 Clean Up index.ts Exports
**File**: `packages/core/src/symbol_resolution/type_resolution/index.ts:50-55`

**Remove These Exports**:
```typescript
export {
  resolve_all_types,                                    // ← DELETE
  build_file_type_registry,                            // ← DELETE
  build_file_type_registry_with_annotations,           // ← DELETE
  type TypeRegistryResult                              // ← DELETE
} from "./type_resolution";
```

**Keep These Exports** (from existing functionality):
```typescript
export {
  // Keep existing working exports
  build_file_type_registry_with_annotations, // Only if actually used
} from "./type_resolution";
```

### 6. Clean Up Unused Imports

#### 6.1 Remove Unused Import Statements
**File**: `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts`

**Review and Remove**:
- Any imports only used by deleted functions
- Type imports for deleted interfaces
- Unused utility imports

**Example cleanup**:
```typescript
// Before - may have unused imports
import type {
  LocalTypeFlowData,        // ← Check if still used
  LocalAssignmentFlow,      // ← Check if still used
  LocalReturnFlow,          // ← Check if still used
  LocalConstructorCall,     // ← Check if still used
  LocalCallAssignment,      // ← Check if still used
  FlowSource,              // ← Check if still used
} from "../../semantic_index/references/type_flow_references";

// After - only keep used imports
```

## Implementation Steps

### Step 1: Preparation and Validation
1. **Verify integration**: Ensure task-epic-11.96.2 completed successfully
2. **Test baseline**: Run existing tests to establish working state
3. **Backup**: Create backup branch before deletion

### Step 2: Function Removal
1. **Remove main function**: Delete `resolve_all_types` (lines 58-120)
2. **Remove stubs**: Delete `find_constructors` and `find_local_type`
3. **Remove helpers**: Delete the three flow preparation functions

### Step 3: Interface and Export Cleanup
1. **Remove unused interface**: Delete `TypeRegistryResult`
2. **Remove unused exports**: Clean up `index.ts` exports
3. **Update module interface**: Ensure exports match remaining functionality

### Step 4: Import Cleanup
1. **Identify unused imports**: Check each import statement
2. **Remove unused imports**: Delete imports only used by removed code
3. **Validate compilation**: Ensure no import errors

### Step 5: Validation
1. **Compile check**: Ensure TypeScript compilation succeeds
2. **Test execution**: Run all tests to ensure no regressions
3. **Reference audit**: Search for any remaining references to deleted code

## Testing and Validation

### 1. Pre-Removal Validation
```bash
# Ensure working state before removal
npm run typecheck
npm test packages/core/src/symbol_resolution/
```

### 2. Reference Auditing
```bash
# Check for references to functions being removed
rg "resolve_all_types" --type ts packages/core/src/
rg "find_constructors" --type ts packages/core/src/
rg "find_local_type" --type ts packages/core/src/
rg "prepare_imports_for_flow" --type ts packages/core/src/
rg "prepare_functions_for_flow" --type ts packages/core/src/
rg "convert_flows_for_analysis" --type ts packages/core/src/
rg "TypeRegistryResult" --type ts packages/core/src/
rg "build_file_type_registry_with_annotations" --type ts packages/core/src/
```

### 3. Post-Removal Validation
```bash
# Ensure no compilation errors after removal
npm run typecheck
npm test packages/core/src/symbol_resolution/
npm run lint packages/core/src/symbol_resolution/
```

### 4. Dead Code Verification Test
**File**: Create temporary test file to verify removal

```typescript
// Test file to ensure deleted functions are truly gone
describe('Dead Code Removal Verification', () => {
  test('deleted functions are no longer accessible', () => {
    // These should cause compilation errors if functions still exist
    expect(() => {
      // @ts-expect-error - Function should be deleted
      resolve_all_types();
    }).toThrow();

    expect(() => {
      // @ts-expect-error - Function should be deleted
      find_constructors();
    }).toThrow();
  });
});
```

## Acceptance Criteria

### Removal Requirements
- [ ] All identified dead code is completely removed
- [ ] No stub functions with TODO comments remain
- [ ] All unused helper functions are deleted
- [ ] Module exports are cleaned up
- [ ] Unused imports are removed

### Quality Requirements
- [ ] TypeScript compilation succeeds after removal
- [ ] All existing tests continue to pass
- [ ] No linting errors introduced
- [ ] No references to deleted code remain in codebase

### Validation Requirements
- [ ] Reference audit shows no remaining usage of deleted functions
- [ ] Module interface is clean and focused
- [ ] File size is significantly reduced
- [ ] Code complexity is reduced

## Expected Impact

### Lines of Code Reduction
- **resolve_all_types**: ~62 lines
- **Stub functions**: ~24 lines
- **Helper functions**: ~128 lines
- **Unused interfaces**: ~18 lines
- **Total reduction**: ~232 lines (~40% of file)

### Complexity Reduction
- Remove 6 unused functions
- Remove 1 unused interface
- Simplify module exports
- Reduce import dependencies

### Maintenance Benefits
- Fewer functions to maintain
- No confusing stub/TODO functions
- Clear module purpose and scope
- Reduced cognitive load for developers

## Risk Assessment

### Low Risk
- **Dead code removal**: Code is confirmed unused
- **Stub function removal**: Functions are empty/non-functional

### Minimal Risk
- **Import cleanup**: May require careful verification

### Mitigation Strategies
- **Comprehensive testing**: Run full test suite before and after
- **Reference auditing**: Use search tools to verify no usage
- **Incremental approach**: Remove code in small batches
- **Backup strategy**: Keep backup branch until validation complete

## Success Metrics

1. **Size reduction**: File size reduced by ~40%
2. **Complexity reduction**: Function count reduced by 6
3. **Quality**: No compilation errors or test failures
4. **Cleanliness**: No TODO comments or stub functions remain

## Next Steps

After completion:
- **Validate**: Ensure all tests pass and no regressions
- **Document**: Update any documentation referencing removed functions
- **Proceed to**: task-epic-11.96.5 (Module Restructuring Implementation)

This cleanup creates a focused, maintainable type resolution module.