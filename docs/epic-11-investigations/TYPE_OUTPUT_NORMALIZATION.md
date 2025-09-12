# Type Output Normalization Investigation

## Problem Statement

AST processing modules currently return internal types (`TrackedType`) that don't match the public API types (`TypeInfo`) expected by `FileAnalysis`. This forces us to write conversion code that:
- Is error-prone and brittle
- Loses information during conversion
- Adds unnecessary complexity
- Violates the principle of keeping AST processing details internal

## Root Cause Analysis

### Current Architecture

```typescript
// Internal AST processing type (in type_tracking)
interface TrackedType {
  symbol_id: SymbolId;
  tracked_type: Resolution<TypeDefinition>;
  flow_source: TypeFlowSource;
  narrowed_from?: SymbolId;
}

// Public API type (in types package)
interface TypeInfo {
  type_name: TypeName;
  type_kind: TypeKind;
  location: Location;
  confidence: "explicit" | "inferred" | "assumed";
  source?: TypeSource;
}
```

These types serve different purposes:
- `TrackedType`: Rich internal representation for type flow analysis
- `TypeInfo`: Simplified public representation for consumers

### The Real Problem

The issue isn't just the type mismatch - it's that we're exposing internal AST processing details through our public API. With the move to tree-sitter queries, most of `TrackedType`'s complexity becomes irrelevant.

## Proposed Solution: Output-Oriented Processing

### Core Concept

AST processing modules should directly produce the public types needed by the API, not internal representations that need conversion.

### Option 1: Direct TypeInfo Generation

Modify `type_tracking.ts` to build `TypeInfo` directly:

```typescript
// type_tracking.ts
export interface FileTypeTracker {
  // Change from TrackedType to TypeInfo
  variable_types: Map<SymbolId, TypeInfo>;
  
  // Keep internal tracking separate if needed
  private _internal_tracking?: Map<SymbolId, InternalTypeData>;
}

export function process_file_for_types(
  root: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  const types = new Map<SymbolId, TypeInfo>();
  
  // Build TypeInfo directly from AST
  for (const capture of typeQuery.captures(root)) {
    const symbol = extractSymbol(capture);
    const typeInfo: TypeInfo = {
      type_name: extractTypeName(capture),
      type_kind: determineTypeKind(capture),
      location: capture.node.location,
      confidence: determineConfidence(capture),
      source: extractSource(capture)
    };
    types.set(symbol, typeInfo);
  }
  
  return { variable_types: types };
}
```

### Option 2: Dual-Output Pattern

Maintain both internal and external representations:

```typescript
export interface FileTypeTracker {
  // Public API output
  public_types: ReadonlyMap<SymbolId, TypeInfo>;
  
  // Internal representation (not exposed)
  internal_types: Map<SymbolId, TrackedType>;
}

export function process_file_for_types(
  root: SyntaxNode,
  context: TypeTrackingContext  
): FileTypeTracker {
  const internal = new Map<SymbolId, TrackedType>();
  const public_types = new Map<SymbolId, TypeInfo>();
  
  // Process once, output both
  for (const capture of typeQuery.captures(root)) {
    const symbol = extractSymbol(capture);
    
    // Build internal representation
    const tracked = buildTrackedType(capture);
    internal.set(symbol, tracked);
    
    // Build public representation
    const info = buildTypeInfo(capture);
    public_types.set(symbol, info);
  }
  
  return { 
    public_types,
    internal_types: internal 
  };
}
```

### Option 3: Transform at Module Boundary

Create a clear transformation layer at module boundaries:

```typescript
// type_tracking/index.ts (public interface)
export { process_types } from './public_api';

// type_tracking/public_api.ts
import { process_file_for_types_internal } from './type_tracking';

export function process_types(
  root: SyntaxNode,
  context: TypeTrackingContext
): Map<SymbolId, TypeInfo> {
  const internal = process_file_for_types_internal(root, context);
  return transform_to_public_types(internal);
}

// Transform once at module boundary
function transform_to_public_types(
  tracker: InternalTypeTracker
): Map<SymbolId, TypeInfo> {
  const result = new Map<SymbolId, TypeInfo>();
  
  for (const [symbol, tracked] of tracker.variable_types) {
    result.set(symbol, {
      type_name: tracked.getTypeName(),
      type_kind: tracked.getTypeKind(),
      location: tracked.location,
      confidence: tracked.getConfidence(),
      source: tracked.getSource()
    });
  }
  
  return result;
}
```

## Recommended Approach: Query-Driven Simplification

With the move to tree-sitter queries, we should take this opportunity to simplify:

### 1. Eliminate Internal Types

Since queries give us direct access to type information, we don't need complex internal representations:

```typescript
// New simplified approach
export function extract_type_info(
  tree: Parser.Tree,
  source: string,
  language: Language
): Map<SymbolId, TypeInfo> {
  const query = loadTypeQuery(language);
  const types = new Map<SymbolId, TypeInfo>();
  
  for (const match of query.matches(tree.rootNode)) {
    const symbol = getSymbolFromCapture(match.captures, 'symbol');
    const typeName = getTextFromCapture(match.captures, 'type');
    
    types.set(symbol, {
      type_name: typeName,
      type_kind: inferTypeKind(typeName),
      location: getLocationFromCapture(match.captures),
      confidence: hasTypeAnnotation(match) ? 'explicit' : 'inferred',
      source: getSourceFromCapture(match.captures)
    });
  }
  
  return types;
}
```

### 2. Delete TrackedType Entirely

With queries, `TrackedType` becomes unnecessary:
- Type flow analysis → Handled by query patterns
- Resolution tracking → Captured in query matches
- Narrowing → Detected via query predicates

### 3. Align Module Output with API Needs

Each module should produce exactly what the API needs:

```typescript
// Module outputs match FileAnalysis fields exactly
export interface TypeAnalysisOutput {
  type_info: ReadonlyMap<SymbolId, TypeInfo>; // Matches FileAnalysis.type_info
}

export interface ParameterAnalysisOutput {
  parameters: ReadonlyMap<SymbolId, ParameterType[]>; // Direct API type
}

export interface ReturnAnalysisOutput {
  returns: ReadonlyMap<SymbolId, ReturnType>; // Direct API type
}
```

## Implementation Strategy

### Phase 1: Add Query-Based Extractors
- Create new query-based type extraction functions
- Return TypeInfo directly
- Keep old code for compatibility

### Phase 2: Update Module Interfaces
- Change return types to match API expectations
- Remove internal type exports from public interfaces
- Move internal types to implementation files

### Phase 3: Remove Conversions
- Update file_analyzer.ts to use new interfaces
- Remove type conversion code
- Delete deprecated internal types

### Phase 4: Clean Up Types Package
- Remove TrackedType and related types
- Keep only public API types
- Simplify type hierarchy

## Benefits

1. **Simplicity**: No conversion code needed
2. **Performance**: No redundant transformations
3. **Maintainability**: Clear separation between internal and public
4. **Type Safety**: API types enforced at module boundaries
5. **Query Alignment**: Outputs match query capture groups

## Example: Fixed file_analyzer.ts

```typescript
function build_file_analysis(
  // ... parameters ...
  type_info: Map<SymbolId, TypeInfo>, // Directly from type_tracking
  // ... more parameters ...
): FileAnalysis {
  return {
    // ... other fields ...
    type_info, // Direct assignment, no conversion!
  };
}

// In analyze_local_types
function analyze_local_types(
  // ... parameters ...
): {
  type_info: Map<SymbolId, TypeInfo>; // Changed from FileTypeTracker
  // ... other returns ...
} {
  // Extract types directly as TypeInfo
  const type_info = extract_type_info(tree, source_code, language);
  
  return {
    type_info, // Already in the right format
    // ... other returns ...
  };
}
```

## Conclusion

By aligning module outputs with API expectations and leveraging tree-sitter queries, we can:
- Eliminate all type conversion code
- Simplify the type system significantly
- Improve performance and maintainability
- Make the codebase more understandable

The key insight is that with queries, we can extract exactly what we need in the format we need it, making complex internal representations unnecessary.