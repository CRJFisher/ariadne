# Task: Improve Method Resolution Using Rich Semantic Index Data

**Status:** In Progress
**Priority:** High
**Epic:** Epic 11 - Codebase Restructuring

## Overview

Currently, method resolution in `method_resolution_simple` uses a processed `LocalTypeContext` that loses valuable type information during transformation. The semantic index contains richer type tracking data that could significantly improve method call resolution accuracy.

## Current State Analysis

### Data Available but Underutilized

The semantic index provides four rich sources of type information:

1. **`local_type_flow: LocalTypeFlowData`** - Direct AST captures with rigorous scope tracking
   - Constructor calls with exact locations
   - Assignment flows between variables
   - Return statements and their values
   - Function call results assigned to variables

2. **`local_type_tracking: LocalTypeTracking`** - Variable and assignment patterns
   - Variable/parameter type annotations (raw text)
   - Variable declarations with initializers
   - Assignment patterns for type inference
   - All with proper scope IDs

3. **`local_type_annotations: LocalTypeAnnotation[]`** - Type syntax extraction
   - Raw annotation text for variables, parameters, returns
   - Cast expressions for explicit typing
   - Generic constraints and bounds
   - Proper location mapping

4. **`local_types: LocalTypeInfo[]`** - Type definitions with members
   - Direct member listings for classes/interfaces
   - Extends/implements clauses (unresolved names)
   - Generic type parameters and constraints

### Current Limitations

The current `LocalTypeContext` in `local_type_context.ts`:
- Attempts resolution too early, losing context
- Applies risky heuristics (e.g., `getUser()` → `User` type)
- Works from already-processed SemanticIndex data
- Loses precise location and scope information during transformation

The method resolver (`heuristic_resolver.ts`) only uses:
- `expression_types` map (location → type)
- `variable_types` map (name → type)
- `constructor_calls` array
- Basic type guards

## Proposed Improvements

### Phase 1: Direct Semantic Data Usage

Replace the intermediate `LocalTypeContext` processing with direct use of semantic index data:

```typescript
interface EnhancedMethodResolutionContext {
  // Direct semantic index data
  type_flow: LocalTypeFlowData;        // From semantic_index
  type_tracking: LocalTypeTracking;    // From semantic_index
  type_annotations: LocalTypeAnnotation[];  // From semantic_index
  local_types: LocalTypeInfo[];        // From semantic_index

  // Resolution helpers (built once, used many times)
  annotation_map: Map<LocationKey, TypeAnnotation>;  // Quick lookup
  initializer_map: Map<SymbolName, InitializerInfo>; // Variable → init
  assignment_chain: Map<SymbolName, AssignmentFlow[]>; // Track flows
}
```

### Phase 2: Enhanced Type Hint Detection

Improve `find_class_hint()` to use richer data sources:

1. **Type Annotations** - Check `local_type_tracking.annotations`
   ```typescript
   // Current: Only checks processed variable_types map
   // Improved: Check raw annotations for exact type
   const annotation = find_annotation_for_variable(var_name, type_tracking);
   if (annotation) {
     return resolve_type_from_annotation(annotation.annotation_text);
   }
   ```

2. **Initializer Analysis** - Use `local_type_tracking.declarations`
   ```typescript
   // Track: const user = new User();
   const declaration = type_tracking.declarations.find(
     d => d.name === var_name && d.initializer
   );
   if (declaration?.initializer?.startsWith('new ')) {
     return extract_constructor_type(declaration.initializer);
   }
   ```

3. **Assignment Flow** - Use `local_type_flow.assignments`
   ```typescript
   // Track: user = getUserFromDB();
   const assignments = type_flow.assignments.filter(
     a => a.target === var_name
   );
   // Trace through assignment chain to find type source
   ```

4. **Return Type Tracking** - Use `local_type_flow.returns`
   ```typescript
   // If method call is in return position, use function's return type
   const containing_function = find_containing_function(location);
   const return_annotation = find_return_annotation(containing_function);
   ```

### Phase 3: Scope-Aware Resolution

Leverage proper scope IDs from semantic data:

```typescript
function find_variable_type_in_scope(
  var_name: SymbolName,
  scope_id: ScopeId,
  type_tracking: LocalTypeTracking
): TypeInfo | null {
  // Check declarations in current scope
  const declaration = type_tracking.declarations.find(
    d => d.name === var_name && d.scope_id === scope_id
  );

  // Check assignments that affect this scope
  const assignments = type_tracking.assignments.filter(
    a => a.target === var_name && is_visible_in_scope(a.scope_id, scope_id)
  );

  // Use most recent assignment or declaration
  return resolve_from_scope_chain(declaration, assignments);
}
```

### Phase 4: Multi-Stage Resolution Strategy

Implement a more sophisticated resolution pipeline:

```typescript
enum DetailedStrategy {
  EXPLICIT_ANNOTATION = "explicit_annotation",     // let x: User
  EXPLICIT_CAST = "explicit_cast",                // x as User
  CONSTRUCTOR_DIRECT = "constructor_direct",       // new User()
  CONSTRUCTOR_ASSIGNED = "constructor_assigned",   // x = new User()
  INITIALIZER_LITERAL = "initializer_literal",    // x = { name: "foo" }
  ASSIGNMENT_CHAIN = "assignment_chain",          // x = y; y = new User()
  RETURN_TYPE_ANNOTATION = "return_type",         // getUser(): User
  PARAMETER_TYPE = "parameter_type",              // function(user: User)
  // ... existing strategies as fallbacks
}
```

## Implementation Plan

### Step 1: Create Enhanced Context Builder
- [ ] Build annotation lookup maps from `local_type_annotations`
- [ ] Create initializer analysis from `local_type_tracking`
- [ ] Build assignment flow graph from `local_type_flow`
- [ ] Index local type members from `local_types`

### Step 2: Enhance Type Hint Detection
- [ ] Implement direct annotation lookup
- [ ] Add initializer pattern matching
- [ ] Create assignment chain traversal
- [ ] Add return type tracking

### Step 3: Integrate with Method Resolver
- [ ] Replace `LocalTypeContext` with `EnhancedMethodResolutionContext`
- [ ] Update `find_class_hint()` to use new data sources
- [ ] Add detailed strategy tracking for debugging
- [ ] Preserve existing heuristics as fallbacks

### Step 4: Testing and Validation
- [ ] Create test cases for each new resolution strategy
- [ ] Verify no regressions in existing tests
- [ ] Add benchmarks to ensure performance
- [ ] Document resolution strategy precedence

## Benefits

1. **Higher Accuracy** - Use exact AST data instead of processed/heuristic data
2. **Better Scope Handling** - Proper lexical scope tracking from semantic index
3. **Rich Type Information** - Access to annotations, initializers, and flow patterns
4. **Reduced False Positives** - Less reliance on naming convention heuristics
5. **Debugging Support** - Clear strategy tracking shows why resolution succeeded

## Risks and Mitigations

- **Risk**: Increased memory usage from additional data structures
  - **Mitigation**: Build lookup maps lazily, clear after resolution phase

- **Risk**: Slower initial processing
  - **Mitigation**: Cache enhanced contexts, reuse across multiple resolutions

- **Risk**: Complexity in assignment chain traversal
  - **Mitigation**: Limit traversal depth, add cycle detection

## Success Metrics

- Increase method resolution accuracy from ~95% to ~99%
- Reduce false positive resolutions by 50%
- Maintain or improve resolution performance
- Pass all existing tests plus new edge cases

## Dependencies

- Semantic index must provide complete `local_type_flow` data
- Type annotation extraction must be language-agnostic
- Assignment tracking must handle all assignment operators

## Notes

The key insight is that `type_flow_references.ts` provides the rigorous AST-based extraction we need, while `local_type_context.ts` attempts too much processing too early. By using the raw semantic data directly, we can make more informed resolution decisions with full context available.

## Implementation Notes (2024-09-27)

### Completed Components

1. **Enhanced Context Builder** (`enhanced_context.ts`)
   - Created `EnhancedMethodResolutionContext` interface with direct semantic data access
   - Built helper maps for efficient lookup:
     - `annotation_map`: Location -> Type annotation
     - `initializer_map`: Variable -> Initializer info
     - `assignment_chain`: Variable -> Assignment flows
     - `constructor_map`: Variable -> Constructor calls
     - `return_type_map`: Scope -> Return statements
   - Implemented `build_enhanced_context()` to create context from semantic index

2. **Enhanced Heuristic Resolver** (`enhanced_heuristic_resolver.ts`)
   - Implemented `resolve_method_enhanced()` with detailed strategy tracking
   - Added new resolution strategies:
     - Direct type annotations/casts
     - Variable type resolution with full chain following
     - Enhanced constructor tracking
     - Return type inference
   - Improved confidence scoring for each strategy

3. **Enhanced Method Resolution** (`enhanced_method_resolution.ts`)
   - Created `resolve_methods_enhanced()` as main entry point
   - Integrated enhanced context builder and resolver
   - Added comparison helper to validate improvements
   - Improved constructor resolution with local type info

4. **Test Suite** (`enhanced_method_resolution.test.ts`)
   - Added comprehensive tests for TypeScript, Python, and JavaScript
   - Tests for explicit annotations, constructor tracking, assignment chains
   - Edge case handling for same-named methods and unique methods
   - Comparison tests with original resolution

### Key Improvements

1. **Direct Semantic Data Usage**: Bypasses lossy intermediate processing
2. **Rich Type Information**: Access to annotations, initializers, and flow patterns
3. **Better Scope Handling**: Proper lexical scope tracking from semantic index
4. **Detailed Strategy Tracking**: Clear indication of why resolution succeeded
5. **Reduced False Positives**: Less reliance on naming convention heuristics

### Limitations Discovered

1. **LocalTypeInfo Missing SymbolId**: The `LocalTypeInfo` interface doesn't include a `symbol_id` field, making it harder to directly resolve types. This requires looking up symbols by name instead.

2. **Type Guards Not Directly Available**: Type guard information is not directly available in `LocalTypeTracking`. Would need extraction from semantic index references.

3. **Return Type Annotations**: Return type annotations are not directly available in `LocalTypeTracking`. These are in `LocalTypeAnnotation[]` but need special handling.

### Next Steps

1. **Add SymbolId to LocalTypeInfo**: Update the type extraction to include symbol IDs for direct resolution
2. **Implement Type Guard Extraction**: Add type guard tracking to `LocalTypeTracking`
3. **Enhance Return Type Tracking**: Better extraction and tracking of return type annotations
4. **Performance Optimization**: Profile and optimize the enhanced resolution for large codebases
5. **Integration**: Replace the current method resolution with the enhanced version after thorough testing
