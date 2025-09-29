# Task: Audit and Remove Unnecessary Semantic Modifiers and CaptureContext Fields

## Status: Created

## 🔴 BREAKING CHANGE STRATEGY

**This is a BREAKING CHANGE with NO backwards compatibility:**
- We are updating types IN-PLACE, not creating new ones
- NO transitional interfaces (no MinimalXxx types)
- NO deprecation warnings or gradual migration
- ALL code must be updated at once
- Tests may break until all changes are complete

## Critical Clarification

This task is about reducing **semantic modifiers** (60+ boolean/enum attributes) AND **CaptureContext fields** (100+ fields), NOT about removing core capture categories. We must maintain:

### Important: Parameter Capture Strategy

**Individual Parameter Captures**: Since tree-sitter captures individual nodes (not arrays), each function parameter will be captured as a separate `NormalizedCapture`:
- The parameter name will be in `symbol_name` field of the capture
- The parameter type (if present) will be in `context.type_name`
- Each parameter generates its own capture with `entity: PARAMETER`
- Aggregation into parameter lists happens at a higher level (semantic index)

Example: `function foo(a: string, b: number)` generates:

1. Function capture: `{ symbol_name: "foo", entity: FUNCTION, context: { type_name: undefined } }`
2. Parameter capture: `{ symbol_name: "a", entity: PARAMETER, context: { type_name: "string" } }`
3. Parameter capture: `{ symbol_name: "b", entity: PARAMETER, context: { type_name: "number" } }`


### Core Capture Infrastructure (KEEP ALL)

1. **Definitions**: function, class, method, constructor, property, parameter, variable, constant, interface, enum, type, namespace, module
2. **Imports**: import statements with path, original_name, import type
3. **Exports**: export declarations with symbol, export type, aliases
4. **References**: function calls, method calls, variable usage, type references, returns
5. **Scopes**: scope boundaries, nesting, scope types (function, class, block, module)

### Semantic Modifiers (REDUCE from 60+ to 6)

These are the boolean/enum attributes that modify the core captures. This is what we're optimizing.

## Objective

Dramatically simplify the capture system by:

1. **Merging** `SemanticModifiers` and `CaptureContext` into a single unified `context` object
2. Reducing total context fields from 160+ to 15 essential attributes
3. Removing redundant fields from `NormalizedCapture`
4. Making `context` non-nullable in `NormalizedCapture`

This reduces total capture size from 165+ fields to 19 fields (4 main + 15 context) while maintaining all functionality needed for call-graph detection.

## Working with Existing Types

### Current Structure → Target Structure

```typescript
// BEFORE: 5 fields with separate modifiers and context
export interface NormalizedCapture {
  category: SemanticCategory;
  entity: SemanticEntity;
  node_location: Location;
  symbol_name: SymbolName;
  modifiers: SemanticModifiers; // 60+ fields
  context?: CaptureContext; // 100+ fields
}

// AFTER: 4 fields with unified context
export interface NormalizedCapture {
  category: SemanticCategory; // ✅ Keep - what kind of capture
  entity: SemanticEntity; // ✅ Keep - specific entity type
  node_location: Location; // ✅ Keep - where in file
  symbol_name: SymbolName; // ✅ Keep - the identifier
  context: CaptureContext; // ✅ UNIFIED - all metadata (15 fields, non-null)
}
```

### Target Structure: Unified Context (15 fields total)

```typescript
// BEFORE: 160+ fields across two interfaces
export interface SemanticModifiers {
  is_static?: boolean;
  is_async?: boolean;
  is_generator?: boolean;
  is_private?: boolean;
  is_protected?: boolean;
  is_abstract?: boolean;
  // ... 54+ more modifier fields
}

export interface CaptureContext {
  source_module?: string;
  import_alias?: string;
  export_type?: string;
  receiver_node?: SyntaxNode;
  // ... 96+ more context fields
}

// AFTER: Single unified context with 15 essential fields
export interface CaptureContext {
  // Import fields (4)
  source?: string; // Module/file imported from
  imported_symbol?: string; // Original name in source
  local_name?: string; // Local alias if different
  import_type?: "default" | "named" | "namespace" | "side-effect";

  // Export fields (3)
  exported_as?: string; // Export name/alias
  export_type?: "default" | "named" | "reexport";
  reexport_source?: string; // Source for reexports

  // Definition attributes (6)
  visibility?: "public" | "private" | "protected" | "internal";
  is_abstract?: boolean;
  is_async?: boolean;
  is_generator?: boolean;
  is_awaited?: boolean; // For await expressions
  is_iterated?: boolean; // For for...of loops

  // Definition relationships (2)
  extends?: string; // Single base class/interface
  type_name?: SymbolName; // Type annotation
}
```

## Why Merge Modifiers and Context?

There's no fundamental semantic difference between "modifiers" and "context":

1. **Arbitrary division**: Why is `visibility` a modifier but `extends` context? Both describe the definition.
2. **Same purpose**: Both provide additional information about the captured entity.
3. **Simpler mental model**: One place for all metadata instead of two.
4. **Cleaner interface**: 4 fields on NormalizedCapture instead of 5.
5. **Easier to extend**: Add new fields without deciding which object they belong to.

## What We're Removing (145+ fields)

### From SemanticModifiers (54+ fields removed)
- `is_static` - Infer from receiver (Class.method = static)
- `is_method`, `is_constructor` - Already in entity type
- `is_closure` - Infer from AST structure
- `is_exported`, `is_default` - Moved to export_type
- `is_private`, `is_protected` - Consolidated to visibility enum
- `is_generic`, `is_function_pointer` - Too complex for call-graph
- `is_readonly`, `is_optional`, `is_mutable` - Property modifiers not needed
- `is_unsafe`, `is_const`, `is_pure` - Annotations that don't affect resolution
- Rust-specific: lifetimes, borrows, move semantics
- TypeScript-specific: type parameters, constraints, bounds

### From CaptureContext (90+ fields removed)
- AST details: `receiver_node`, `source_node`, `target_node`
- Complex resolution: `property_chain`, `type_arguments`, `is_computed`
- Type system: `annotation_type`, `type_params`, `constraint_type`
- Language-specific: `decorator_name`, `all_contents`, `is_pub_use`
- Redundant: `is_call`, `method_name`, `constructor_name` (in entity)
- Unimplemented: fields marked "Unused" or "Not captured"

## Key Insights

1. **Most modifiers can be inferred**: Static vs instance from receiver type, method vs function from context
2. **Arbitrary division**: No semantic difference between "modifiers" and "context" - both are metadata
3. **Language-specific cruft**: Most fields only apply to one language, not cross-language
4. **Over-engineering**: Complex type system features not needed for call-graph detection

## Final Target Structure

```typescript
export interface NormalizedCapture {
  category: SemanticCategory; // What kind of capture
  entity: SemanticEntity; // Specific entity type
  node_location: Location; // Where in file
  symbol_name: SymbolName; // The identifier
  context: CaptureContext; // All metadata (15 fields, non-null)
}

// Total: 4 main fields + 15 context fields = 19 fields max
// Down from: 5 main + 60+ modifiers + 100+ context = 165+ fields
```

## Implementation Plan

### Phase 1: Delete SemanticModifiers & Update Types

```typescript
// In packages/core/src/parse_and_query_code/capture_types.ts

// 1. DELETE SemanticModifiers interface entirely
// 2. UPDATE NormalizedCapture
export interface NormalizedCapture {
  category: SemanticCategory;
  entity: SemanticEntity;
  node_location: Location;
  symbol_name: SymbolName;
  context: CaptureContext; // Non-null, contains ALL metadata
}

// 3. UPDATE CaptureContext with unified fields (15 total)
export interface CaptureContext {
  // Import (4)
  source?: string;
  imported_symbol?: string;
  local_name?: string;
  import_type?: "default" | "named" | "namespace" | "side-effect";

  // Export (3)
  exported_as?: string;
  export_type?: "default" | "named" | "reexport";
  reexport_source?: string;

  // Attributes (6)
  visibility?: "public" | "private" | "protected" | "internal";
  is_abstract?: boolean;
  is_async?: boolean;
  is_generator?: boolean;
  is_awaited?: boolean;
  is_iterated?: boolean;

  // Relationships (2)
  extends?: string;
  type_name?: SymbolName;
}

// 4. UPDATE CaptureMapping interface
export interface CaptureMapping {
  category: SemanticCategory;
  entity: SemanticEntity;
  context?: (node: SyntaxNode) => CaptureContext; // ONLY context function
}
```

### Phase 2: Update All Language Configs

1. Remove ALL `modifiers` functions from capture mappings
2. Merge modifier logic into single `context` function
3. Ensure context is always non-null (use {} if empty)

### Phase 3: Update Consumers

1. Change all `capture.modifiers.X` to `capture.context.X`
2. Remove any code that handles modifiers separately
3. Add inference for static/instance from receiver type

## Example: Before and After

### Before (Current - 165+ fields)

```typescript
const capture: NormalizedCapture = {
  category: SemanticCategory.DEFINITION,
  entity: SemanticEntity.FUNCTION,
  node_location: { start: 10, end: 20 },
  symbol_name: "processData",
  modifiers: {
    is_static: false,
    is_async: true,
    is_generator: false,
    is_private: false,
    is_protected: false,
    is_exported: true,
    is_default: false,
    is_generic: true,
    is_unsafe: false,
    // ... 50+ more modifier fields
  },
  context: {
    export_alias: "processData",
    export_type: "named",
    source_module: undefined,
    receiver_node: undefined,
    // ... 96+ more context fields
  },
};
```

### After (Unified - 19 fields total)

```typescript
const capture: NormalizedCapture = {
  category: SemanticCategory.DEFINITION,
  entity: SemanticEntity.FUNCTION,
  node_location: { start: 10, end: 20 },
  symbol_name: "processData",
  context: {  // All metadata in one place
    // Export info
    export_type: "named",
    exported_as: "processData",
    // Definition attributes (from modifiers)
    is_async: true,
    visibility: "public",
    // Type info
    type_name: "Promise<Result>",
  },
};
```

## Testing Strategy

### Must Pass

1. All definitions still captured
2. All imports/exports still work
3. All references still tracked
4. All scopes still identified
5. Cross-file resolution works

### Should Improve

1. Memory usage (fewer attributes)
2. Processing speed (less data)
3. Code clarity (clear separation)

## Success Metrics

1. **Core functionality**: 100% of existing captures still work
2. **Field reduction**: From 165+ to 19 fields (88% reduction)
3. **Unified context**: Single object for all metadata (15 fields)
4. **NormalizedCapture**: 4 main fields + non-null context
5. **Memory**: >85% reduction in capture object size
6. **Clarity**: Single, unified metadata model

## Key Insights

1. **SemanticModifiers**: Most can be inferred from context (e.g., static from receiver type)
2. **CaptureContext**: Most fields are language-specific implementation details
3. **Text field**: Not needed - the entity and context provide all necessary info
4. **Non-null context**: Every capture needs some context, even if empty object

## Final Target Structure

```typescript
export interface NormalizedCapture {
  category: SemanticCategory; // What kind of capture
  entity: SemanticEntity; // Specific entity type
  node_location: Location; // Where in file
  symbol_name: SymbolName; // The identifier
  context: CaptureContext; // 15 fields max, non-null (unified metadata)
}

// Total fields: 4 main + 15 context = 19 fields max
// Down from: 5 main + 60+ modifiers + 100+ context = 165+ fields
```

## Estimated Effort

- Update capture types: 2 hours
- Merge interfaces: 1 hour
- Update language configs: 3 hours
- Update consumers: 2 hours
- Add inference logic: 2 hours
- Testing: 2 hours
- Total: ~1.5 days
