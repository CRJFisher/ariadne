# Task 11.167: Resolve Polymorphic Factory Pattern Calls

## Status: Completed

## Parent: epic-11-codebase-restructuring

## Overview

Method calls through interface-typed variables obtained from factory functions are not being tracked. The call graph doesn't resolve through the factory to connect interface method calls to concrete class implementations.

## False Positive Groups Addressed

This task addresses the following false positive group from `top-level-nodes-analysis/results/false_positive_groups.json`:

1. **factory-pattern-polymorphic-calls-not-tracked** (5 entries)
   - Interface method calls via factory-obtained references not tracked
   - Examples:
     - `extractor.extract_boundaries()` where `extractor: ScopeBoundaryExtractor` from `get_scope_boundary_extractor()`
     - Concrete implementations: `PythonScopeBoundaryExtractor`, `TypeScriptScopeBoundaryExtractor`, etc.

## Root Cause Analysis

The call graph system currently handles direct method calls on concrete types but fails when:

1. The receiver variable is typed as an interface
2. The actual value is obtained from a factory function
3. The factory returns different concrete implementations based on runtime parameters

```typescript
// scope_processor.ts:164-165
const extractor = get_scope_boundary_extractor(file.lang);  // Returns ScopeBoundaryExtractor interface
extractor.extract_boundaries(node, scope_type, file_path);  // Call not resolved to concrete implementations
```

## Solution Approaches

### Option A: Factory Return Type Analysis (Recommended)

Analyze factory function return statements to determine all possible concrete return types:

1. Find the factory function (`get_scope_boundary_extractor`)
2. Analyze its return statements
3. Collect all possible concrete types
4. When resolving interface method calls, check all concrete implementations

### Option B: Interface Implementation Tracking

Track which classes implement which interfaces:

1. Build `interface → [implementing classes]` map during semantic indexing
2. When calling interface method, resolve to all implementing class methods

### Option C: Conservative Over-Approximation

Mark interface method calls as calling ALL implementations of that interface.

## Implementation Plan

### 11.167.1: Build Interface Implementation Registry

Track which classes/objects implement which interfaces:

```typescript
interface InterfaceImplementationRegistry {
  // interface_id → [implementing class/object ids]
  implementations: Map<SymbolId, SymbolId[]>;
}
```

### 11.167.2: Analyze Factory Return Types

For factory functions, analyze return statements:

```typescript
function analyze_factory_returns(
  factory_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolId[] {
  // Find all return statements in factory body
  // Extract types of returned values
  // Return list of possible concrete types
}
```

### 11.167.3: Resolve Interface Method Calls

When resolving a method call on an interface-typed receiver:

1. Get all known implementations of the interface
2. Resolve method on each implementation
3. Record all as potential call targets

### 11.167.4: Update Call Graph Structure

Modify call graph to support multi-target edges:

```typescript
interface CallEdge {
  call_site: Location;
  possible_targets: SymbolId[];  // Multiple targets for polymorphic calls
  resolution_kind: 'direct' | 'polymorphic';
}
```

## Files to Modify

- `packages/core/src/resolve_references/call_resolution/method_resolver.ts`
- `packages/core/src/resolve_references/registries/type_registry.ts`
- `packages/core/src/index_single_file/definitions/definition_builder.ts`

## Success Criteria

1. All 5 false positive entries are eliminated
2. Interface method calls resolve to concrete implementations
3. Factory return types are analyzed
4. All tests pass

## Dependencies

- Requires type hierarchy information from type resolution
- Requires interface implementation tracking
- Complements Task 11.163 (this/super calls)
- Complements Task 11.164 (property method calls)

## Related Work

Task 11.91.3 (Enhance method and constructor resolution) mentions "Interface method implementation" as a language-specific enhancement. This task provides the foundation for that work.

## Priority

Medium - 5 entries, requires more complex type analysis. Important for OOP codebases.

## Technical Notes

### Challenge: Dynamic Dispatch

Static analysis cannot always determine which concrete type will be used at runtime. The solution must accept some over-approximation (connecting to all possible implementations).

### Challenge: Recursive Factories

Factories might call other factories. Need to handle transitive factory analysis.

### Challenge: External Implementations

Some implementations might come from node_modules. For now, focus on in-project implementations.

## Implementation Notes (2026-01-09)

### Implemented: Return Type Inference (Option C from Plan)

Added type inference from function return types to enable polymorphic method resolution:

**Files Modified:**

1. `packages/types/src/symbol_definitions.ts`
   - Added `initialized_from_call?: SymbolName` to `VariableDefinition`
   - Tracks when a variable is initialized from a function call

2. `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts`
   - Added `extract_call_initializer_name()` function
   - Extracts called function name from call expression initializers

3. `packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.typescript.ts`
4. `packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.javascript.ts`
   - Updated to call `extract_call_initializer_name()` and pass to `add_variable()`

5. `packages/core/src/index_single_file/definitions/definitions.ts`
   - Updated `add_variable()` to accept `initialized_from_call` parameter

6. `packages/core/src/resolve_references/registries/type.ts`
   - Added `call_initializers` to `ExtractedTypeData`
   - Added STEP 1.5 to `resolve_type_metadata()` to infer variable types from function return types

**Verification:**

- Unit tests show type inference and polymorphic resolution work correctly for single-file cases
- Variable `h = createHandler()` correctly gets type `Handler` from function return type
- Method call `h.process()` correctly resolves to all implementations (HandlerA.process, HandlerB.process)

**Remaining Issue:**

The `extract_boundaries` methods still appear as entry points. Investigation shows:

1. Type inference IS working - verified in test
2. Polymorphic resolution IS working - verified in test
3. The specific `extract_boundaries` case may be affected by:
   - The for-loop body tracking issue (Task 11.162) - call is inside a for-loop
   - Cross-file type resolution for type-only imports

### Root Cause Found (2026-01-09 - continued)

The return type inference is working correctly:

- `extractor` variable in `scopes.ts` has `initialized_from_call: "get_scope_boundary_extractor"`
- TypeRegistry correctly infers its type as `ScopeBoundaryExtractor` interface

The actual issue is **`implements` clause extraction** in TypeScript classes:

**Bug Location:** `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts` - `extract_extends()`

**Problem:**

1. The function uses `node.childForFieldName("heritage")` which returns `null` for TypeScript class declarations
2. TypeScript uses `class_heritage` as a **child node** (not a field), containing `extends_clause` and/or `implements_clause`
3. The `implements_clause` is never extracted, so `ClassDefinition.extends` doesn't include implemented interfaces

**Evidence:**

```typescript
// PythonScopeBoundaryExtractor in semantic index:
extends (raw): [ 'ScopeBoundaryExtractor' ]  // Incorrectly populated
implements (raw): undefined                   // Should be ['ScopeBoundaryExtractor']
```

**Impact:**

- `ScopeBoundaryExtractor` interface has only 1 subtype: `CommonScopeBoundaryExtractor` (the base class)
- Language-specific extractors (`PythonScopeBoundaryExtractor`, etc.) are NOT registered as subtypes
- Polymorphic resolution doesn't find the concrete implementations

**Fix Required:**

Update `extract_extends()` to:

1. Find `class_heritage` as a child node (not field)
2. Extract from both `extends_clause` and `implements_clause`
3. Return all type names from both clauses

This is a **separate bug** that should be tracked as its own task (e.g., Task 11.168).

### Fixes Applied (2026-01-09)

All issues have been resolved. The entry point count decreased from 87 to 63 (-24, 31.6% improvement).

**Fix 1: TypeScript `implements` clause extraction**

File: `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts`

Updated `extract_extends()` to handle TypeScript's `class_heritage` node structure with both `extends_clause` and `implements_clause`. Previously only the `heritage` field was checked, which doesn't exist for TypeScript classes.

**Fix 2: Cross-file type inheritance resolution**

File: `packages/core/src/resolve_references/registries/definition.ts`

Added `resolve_cross_file_type_inheritance()` method that uses ResolutionRegistry to resolve imported parent type names to SymbolIds. The existing `register_type_inheritance()` runs during Phase 2 (before name resolution) and could only resolve local types. The new method runs after Phase 3 (name resolution) to handle cross-file imports like:

```typescript
import { ScopeBoundaryExtractor } from "../boundary_base";
export class PythonScopeBoundaryExtractor implements ScopeBoundaryExtractor {...}
```

**Fix 3: Transitive subtype resolution in polymorphic method lookup**

File: `packages/core/src/resolve_references/call_resolution/method_lookup.ts`

Added `get_transitive_subtypes()` function and updated `resolve_polymorphic_method()` to traverse the full inheritance tree. Previously only direct subtypes were checked, missing multi-level inheritance chains like:

```
ScopeBoundaryExtractor (interface)
  └─ CommonScopeBoundaryExtractor (class)
       └─ JavaScriptTypeScriptScopeBoundaryExtractor (class)
            └─ TypeScriptScopeBoundaryExtractor (class)
```

**Fix 4: Project phase ordering**

File: `packages/core/src/project/project.ts`

Added Phase 3.5 (cross_file_inheritance) between name resolution and type resolution to call the new `resolve_cross_file_type_inheritance()` method.

### Results

- **Before:** 87 entry points
- **After:** 63 entry points
- **Change:** -24 entry points (31.6% of gap closed)
- `extract_boundaries` implementations no longer appear as false positive entry points
- All tests pass
