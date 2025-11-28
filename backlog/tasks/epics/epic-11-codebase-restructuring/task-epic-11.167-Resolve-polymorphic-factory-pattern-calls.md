# Task 11.167: Resolve Polymorphic Factory Pattern Calls

## Status: Planning

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
