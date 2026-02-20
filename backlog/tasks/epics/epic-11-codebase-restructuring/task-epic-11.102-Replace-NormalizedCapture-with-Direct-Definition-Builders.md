# Task: Replace NormalizedCapture with Direct Definition Builders

## Status: Created

## 🔴 BREAKING CHANGE STRATEGY

**This is a BREAKING CHANGE with NO backwards compatibility:**

- We are DELETING NormalizedCapture entirely, not deprecating
- Direct creation of Definition objects from tree-sitter captures
- ALL code must be updated at once
- Tests will break until migration is complete

## Problem Statement

Currently we have a double representation problem:

```typescript
// Tree-sitter capture → NormalizedCapture → Definition objects
QueryCapture → NormalizedCapture → (multi-pass) → ClassDefinition/FunctionDefinition/etc.
```

This creates:

- **Conceptual overhead**: Two parallel type hierarchies representing the same information
- **Nullable field problem**: Definitions built piecemeal have nullable fields that shouldn't be
- **Maintenance burden**: Keeping two representations in sync
- **Unclear data flow**: Hard to understand the transformation pipeline

## Solution: Direct Definition Creation with Functional Builders

Replace the intermediate NormalizedCapture with direct creation of Definition objects using a functional builder approach:

```typescript
// NEW: Two-pass direct creation with builders
QueryCapture → ScopeBuilder → Scope context
QueryCapture + Scope context → DefinitionBuilder → Definition objects
QueryCapture + Scope context → ReferenceBuilder → Reference objects
```

**Critical: Scopes must be processed FIRST** - Every definition and reference needs a scope-id

## Architecture

### Core Types

```typescript
// Minimal capture info from tree-sitter
interface RawCapture {
  category: SemanticCategory; // What kind of capture (DEFINITION, REFERENCE, etc.)
  node_location: Location; // Where in file
  symbol_name: SymbolName; // The identifier
  node: SyntaxNode; // Raw tree-sitter node
  capture_name: string; // The @name from query
}

// Mapping from tree-sitter to builders
interface CaptureMapping {
  category: SemanticCategory;
  entity: SemanticEntity;
  // Process capture directly into builder
  process: (capture: RawCapture, builder: DefinitionBuilder) => void;
}
```

### Functional Builder Pattern

```typescript
// Builder accumulates definitions functionally
class DefinitionBuilder {
  private readonly definitions = new Map<SymbolId, BuilderState>();

  // Functional approach: each capture flows through and enriches the builder
  process(capture: RawCapture): DefinitionBuilder {
    const mapping = get_mapping(capture.capture_name);

    return mapping.entity.match({
      CLASS: () => this.add_class(capture),
      METHOD: () => this.add_method(capture),
      FUNCTION: () => this.add_function(capture),
      PARAMETER: () => this.add_parameter(capture),
      // ...
    });
  }

  // Build final non-nullable definitions
  build(): Definitions {
    return {
      classes: this.build_classes(), // Non-null arrays
      functions: this.build_functions(), // Even if empty
      // ...
    };
  }

  private add_class(capture: RawCapture): DefinitionBuilder {
    const id = symbol_id(capture.symbol_name, capture.node_location);

    this.definitions.update(id, (state) => ({
      ...state,
      base: extract_class_info(capture),
      methods: state?.methods || [],
      properties: state?.properties || [],
    }));

    return this;
  }

  private add_method(capture: RawCapture): DefinitionBuilder {
    const class_id = find_containing_class(capture);

    this.definitions.update(class_id, (state) => ({
      ...state,
      methods: [...(state?.methods || []), extract_method_info(capture)],
    }));

    return this;
  }
}
```

### Functional Pipeline

```typescript
// Two-pass processing: scopes first, then definitions/references
function process_file(captures: QueryCapture[]): SemanticIndex {
  const raw_captures = captures.map(to_raw_capture);

  // PASS 1: Create scopes directly (MUST be first, single pass)
  const scopes = process_scopes(raw_captures);

  // Create context with scope information
  const context = { scopes };

  // PASS 2: Build definitions and references with scope context
  const definition_builder = raw_captures
    .filter(is_definition_capture)
    .reduce(
      (builder, capture) => builder.process(capture),
      new DefinitionBuilder(context)
    );

  const reference_builder = raw_captures
    .filter(is_reference_capture)
    .reduce(
      (builder, capture) => builder.process(capture),
      new ReferenceBuilder(context)
    );

  return {
    scopes: Array.from(scopes.values()),
    definitions: definition_builder.build(),
    references: reference_builder.build(),
  };
}
```

## Benefits

1. **Single source of truth**: Definition types ARE the types
2. **Non-nullable fields**: Final definitions have proper non-null guarantees
3. **Clear data flow**: capture → builder → definition
4. **Less code**: No intermediate type system to maintain
5. **Functional composition**: Natural ordering through code flow
6. **Type safety**: TypeScript ensures we build valid definitions

## Implementation Plan

### Phase 1: Create New Builder System

```typescript
// packages/core/src/parse_and_query_code/definition_builder.ts
export class DefinitionBuilder { ... }

// packages/core/src/parse_and_query_code/capture_mapper.ts
export function mapCapture(capture: RawCapture): BuilderAction { ... }
```

### Phase 2: Delete Old Types

```typescript
// DELETE these files entirely:
// - packages/core/src/parse_and_query_code/capture_types.ts (NormalizedCapture)
// - packages/core/src/parse_and_query_code/capture_normalizer.ts
// - All SemanticModifiers/CaptureContext types
```

### Phase 3: Update Language Configs

```typescript
// Update mappings to use builder functions
export const JAVASCRIPT_MAPPING: Map<string, CaptureMapping> = new Map([
  [
    "def.class",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS,
      process: (capture, builder) => {
        builder.add_class({
          symbol_id: create_symbol_id(capture),
          name: capture.symbol_name,
          location: capture.node_location,
          extends: extract_extends(capture.node),
          // ...
        });
      },
    },
  ],
]);
```

## Migration Strategy

1. **Create builder system alongside existing** (can coexist temporarily)
2. **Route one language through builders** as proof of concept
3. **Delete NormalizedCapture** and all related types
4. **Update all languages** to use builders
5. **Remove old pipeline** completely

## Success Metrics

1. **Zero intermediate types**: No NormalizedCapture or similar
2. **Non-null definition fields**: Methods, properties arrays always present
3. **Reduced code**: Fewer type definitions and transformations
4. **Clear pipeline**: capture → builder → definition (no multi-pass confusion)
5. **Type safety**: All definitions properly typed with non-null guarantees

## Example: Before and After

### Before (with NormalizedCapture)

```typescript
// Multiple representations of the same thing
const capture: NormalizedCapture = {
  category: DEFINITION,
  entity: CLASS,
  modifiers: { ... },
  context: { extends: "Base" }
};

// Later, multi-pass aggregation
const classDef: ClassDefinition = {
  methods: methods || [],  // Nullable during construction
  extends: [capture.context.extends],
  // ...
};
```

### After (Direct Builders)

```typescript
// Single representation, built directly
builder.process({
  category: DEFINITION,
  symbol_name: "MyClass",
  node_location: location,
  node: syntaxNode
});

// Builder ensures non-null
const classDef: ClassDefinition = {
  methods: [...],  // Always non-null array
  extends: [...],  // Always non-null array
  // ...
};
```

## Sub-tasks

### 1. Create Direct Scope Processing

- Migrate to direct scope creation (single pass, no builder)
- Process scopes FIRST before definitions/references
- Handle nested scopes correctly
- Every capture needs scope-id

### 2. Create Definition Builder System

- Implement DefinitionBuilder class
- Create functional processing pipeline
- Ensure non-null field guarantees
- Include imports, exports, and types as definitions

### 3. Create Reference Builder System

- Implement ReferenceBuilder class
- Use scope context from ScopeBuilder
- Handle all reference types
- Preserve context for resolution

### 4. Delete Intermediate Types

- Remove NormalizedCapture
- Remove SemanticModifiers
- Remove CaptureContext
- Delete capture_normalizer.ts

### 5. Update Language Configs

- Convert JavaScript to builder pattern
- Convert TypeScript to builder pattern
- Convert Python to builder pattern
- Convert Rust to builder pattern

### 6. Update Tests

- Test builder creates valid definitions
- Test non-null field guarantees
- Test functional pipeline ordering

## Dependencies

- Definitions from @ariadnejs/types must be stable
- Tree-sitter query system must remain unchanged

## Estimated Effort

- Create direct scope processing: 2 hours
- Create definition builder: 3 hours
- Create reference builder: 3 hours
- Delete old types: 1 hour
- Update languages: 4 hours
- Update tests: 2 hours
- Total: ~2 days
