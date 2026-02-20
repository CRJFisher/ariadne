# Task: Make Parameters First-Class Definitions in DefinitionRegistry

**Epic**: 11 - Codebase Restructuring
**Status**: TODO
**Priority**: High
**Estimated Effort**: 1-2 days

## Context

Method calls on parameters with type annotations are NOT being resolved, causing 20-40 false positive entry points in call graph analysis.

### Current Problem

```typescript
private resolve_type_metadata(definitions: DefinitionRegistry, ...): void {
  const symbol_id = definitions.get_symbol_at_location(loc_key);
  // ↑ Appears as unresolved entry point even though 'definitions' has type annotation
}
```

**Root Cause**: Parameters are NOT in DefinitionRegistry's `location_to_symbol` index, so TypeRegistry cannot create type bindings for them.

### Resolution Chain Failure

1. ✅ **Semantic Index** - Parameter has `type: 'DefinitionRegistry'`
2. ✅ **Type Bindings Extraction** - `extract_type_bindings()` creates binding for parameter location
3. ✗ **TypeRegistry.resolve_type_metadata() FAILS** at line 183:
   ```typescript
   const symbol_id = definitions.get_symbol_at_location(loc_key);
   // Returns undefined! Parameters not in location index.
   ```
4. ✗ Type binding never created in TypeRegistry
5. ✗ Method call unresolved → appears as entry point

### Why Parameters Aren't in DefinitionRegistry

In [project.ts:181-200](packages/core/src/project/project.ts#L181-L200):
```typescript
const all_definitions: AnyDefinition[] = [
  ...Array.from(semantic_index.variables.values()),
  ...Array.from(semantic_index.functions.values()),
  ...Array.from(semantic_index.classes.values()),
  // ... etc ...
];
// ❌ Parameters NOT included!
```

Parameters exist in semantic index but are **nested** inside:
- `function.signature.parameters[]`
- `class.methods[].parameters[]`
- `class.constructor[].parameters[]`
- `interface.methods[].parameters[]`

They are not in a top-level Map, so they never get added to DefinitionRegistry.

## Implementation Plan

### Phase 1: Create Parameter Extraction Utility (0.5 days)

**File**: Create `packages/core/src/project/extract_parameters.ts`

```typescript
import type {
  SemanticIndex,
  ParameterDefinition,
  FunctionDefinition,
  ClassDefinition,
  InterfaceDefinition,
} from "@ariadnejs/types";

/**
 * Extract all parameters from a semantic index as first-class definitions.
 *
 * Parameters are nested in function/method/constructor definitions, but need to be
 * available in DefinitionRegistry for type resolution to work correctly.
 *
 * @param semantic_index - The semantic index containing all definitions
 * @returns Array of all parameter definitions
 */
export function extract_all_parameters(
  semantic_index: SemanticIndex
): ParameterDefinition[] {
  const params: ParameterDefinition[] = [];

  // Extract from standalone functions
  for (const func of semantic_index.functions.values()) {
    if (func.signature?.parameters) {
      params.push(...func.signature.parameters);
    }
  }

  // Extract from class methods and constructors
  for (const class_def of semantic_index.classes.values()) {
    // From methods
    for (const method of class_def.methods) {
      if (method.parameters) {
        params.push(...method.parameters);
      }
    }

    // From constructors
    for (const ctor of class_def.constructor || []) {
      if (ctor.parameters) {
        params.push(...ctor.parameters);
      }
    }
  }

  // Extract from interface methods
  for (const interface_def of semantic_index.interfaces.values()) {
    for (const method of interface_def.methods) {
      if (method.parameters) {
        params.push(...method.parameters);
      }
    }
  }

  return params;
}
```

### Phase 2: Update Project.update_file() (0.25 days)

**File**: `packages/core/src/project/project.ts`

**Line 181-200**: Update `all_definitions` array to include parameters:

```typescript
import { extract_all_parameters } from "./extract_parameters";

// In update_file() method:
const all_definitions: AnyDefinition[] = [
  ...Array.from(semantic_index.variables.values()),
  ...Array.from(semantic_index.functions.values()),
  ...extract_all_parameters(semantic_index),  // ← ADD THIS
  ...Array.from(semantic_index.classes.values()),
  ...Array.from(semantic_index.namespaces.values()),
  ...Array.from(semantic_index.types.values()),
  ...Array.from(semantic_index.interfaces.values()),
  ...Array.from(semantic_index.enums.values()),
  ...Array.from(semantic_index.imported_symbols.values()),
];
```

### Phase 3: Verify Type Resolution Works (0.5 days)

Create test to verify the fix:

**File**: `packages/core/src/project/parameter_type_resolution.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { Project } from "./project";
import type { FilePath } from "@ariadnejs/types";

describe("Parameter Type Resolution", () => {
  it("should resolve method calls on parameters with type annotations", async () => {
    const code = `
class Foo {
  bar(): void {}
}

class TypeRegistry {
  private process(definitions: Foo): void {
    definitions.bar();  // Should resolve!
  }
}
    `;

    const project = new Project();
    (project as any).root_folder = "/tmp/test" as FilePath;
    project.update_file("/tmp/test/test.ts" as FilePath, code);

    // Check if method call was resolved
    const calls = project.resolutions.get_file_calls("/tmp/test/test.ts" as FilePath);
    const bar_call = calls.find(c => c.name === "bar");

    expect(bar_call).toBeDefined();
    expect(bar_call?.target).toBeDefined();

    if (bar_call?.target) {
      const resolved_def = project.definitions.get(bar_call.target);
      expect(resolved_def?.kind).toBe("method");
      expect(resolved_def?.name).toBe("bar");
    }
  });

  it("should resolve method calls on function parameters", async () => {
    const code = `
class Database {
  query(): void {}
}

function process(db: Database): void {
  db.query();  // Should resolve!
}
    `;

    const project = new Project();
    (project as any).root_folder = "/tmp/test" as FilePath;
    project.update_file("/tmp/test/test.ts" as FilePath, code);

    const calls = project.resolutions.get_file_calls("/tmp/test/test.ts" as FilePath);
    const query_call = calls.find(c => c.name === "query");

    expect(query_call).toBeDefined();
    expect(query_call?.target).toBeDefined();
  });
});
```

### Phase 4: Run analyze_self.ts and Verify Impact (0.25 days)

```bash
npx tsx analyze_self.ts
```

**Expected Result**: Entry points should reduce from ~116 to ~76-96 (20-40 entry points resolved).

### Phase 5: Integration Testing (0.25 days)

1. Run full test suite to ensure no regressions
2. Check that existing parameter-related tests still pass
3. Verify DefinitionRegistry size increases appropriately
4. Confirm type resolution works for all parameter types

## Acceptance Criteria

- [ ] `extract_all_parameters()` utility created and tested
- [ ] Project.update_file() includes parameters in all_definitions
- [ ] Parameters appear in DefinitionRegistry.location_to_symbol index
- [ ] TypeRegistry successfully creates type bindings for typed parameters
- [ ] Method calls on typed parameters resolve correctly
- [ ] Entry points reduced by 20-40 (116 → 76-96)
- [ ] All existing tests pass
- [ ] New tests verify parameter type resolution works
- [ ] No performance regression

## Testing Strategy

### Unit Tests

1. **test extract_all_parameters()**:
   - Extracts from function parameters
   - Extracts from method parameters
   - Extracts from constructor parameters
   - Extracts from interface method parameters
   - Returns empty array when no parameters exist

2. **test parameter in DefinitionRegistry**:
   - Parameter location added to location_to_symbol map
   - Parameter accessible via get_symbol_at_location()
   - Parameter symbol_id matches semantic index

3. **test parameter type resolution**:
   - TypeRegistry creates type binding for typed parameter
   - Method call on typed parameter resolves to correct method
   - Works for all parameter contexts (function, method, constructor)

### Integration Tests

1. **test parameter_type_resolution.test.ts** (from Phase 3)
2. **test existing tests still pass**:
   - All definition registry tests
   - All type registry tests
   - All resolution registry tests
   - All project integration tests

### Performance Tests

- Measure DefinitionRegistry size increase (should be proportional to parameter count)
- Verify no slowdown in resolution time
- Check memory usage remains acceptable

## Dependencies

**Depends on**: Task 11.136 (Method Call Type Tracking Resolution) - **COMPLETED**

**Blocks**: None, but significantly improves call graph accuracy

## Impact Analysis

### Estimated Entry Point Reduction

**Current**: 116 entry points
**Expected after fix**: 76-96 entry points
**Reduction**: 20-40 entry points (17-34% improvement)

### Affected Code

**Files to modify**:
1. Create: `packages/core/src/project/extract_parameters.ts` (new file)
2. Modify: `packages/core/src/project/project.ts` (lines 181-200)
3. Create: `packages/core/src/project/parameter_type_resolution.test.ts` (new test)

**Minimal changes required** - only extraction logic, no semantic index structure changes.

### Benefits Beyond Entry Point Reduction

Making parameters first-class definitions enables:
- ✅ Parameter renaming refactoring
- ✅ Parameter type tracking across codebase
- ✅ Parameter reference finding (find all uses of a parameter)
- ✅ Better IDE support for parameters
- ✅ Call graph analysis can track data flow through parameters

## Notes

### Why This Works

Once parameters are in DefinitionRegistry:
1. `get_symbol_at_location(param_location)` returns parameter symbol_id ✓
2. TypeRegistry.resolve_type_metadata() can resolve parameter type bindings ✓
3. Method calls on typed parameters can be resolved ✓
4. Entry points correctly identified ✓

### Alternative Approaches Considered

**Option 1: Add parameters to semantic index as top-level Map** ❌
- **Rejected**: Too invasive, affects entire codebase structure

**Option 2: Special-case parameter lookup in TypeRegistry** ❌
- **Rejected**: Hacky, doesn't solve general problem

**Option 3: Extract parameters in Project.update_file()** ✅
- **Selected**: Minimal changes, clean extraction logic

### Discovered During

- **Task 11.136 investigation** (2025-10-24)
- **Debug test**: packages/core/src/debug_param_type.test.ts (created during investigation, removed)
- **Analysis file**: Documented in task-epic-11.136 implementation notes

### Examples of Affected False Positives

Real examples from analyze_self.ts output:
1. `definitions.get_symbol_at_location()` in type_registry.ts:183
2. `resolutions.resolve()` in type_registry.ts:191
3. `scopes.get_file_root_scope()` in resolution_registry.ts:118
4. Many more method calls on typed parameters throughout the codebase

All of these should resolve once parameters become first-class definitions.
