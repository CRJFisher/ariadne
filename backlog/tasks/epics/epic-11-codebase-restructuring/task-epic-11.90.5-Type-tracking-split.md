# Task: Type Tracking Split

**Task ID**: task-epic-11.90.5
**Parent**: task-epic-11.90
**Status**: Created
**Priority**: High
**Created**: 2024-01-19
**Estimated Effort**: 5 hours
**Phase**: 5 - Type Tracking Split

## Objective

Split the `semantic_index/references/type_tracking` module into:

1. **Local extraction** (stays in semantic_index): Extract type annotation syntax only
2. **Resolution** (moves to symbol_resolution): Resolve type references to TypeIds

## Background

The type_tracking module currently attempts to:

- Create TypeInfo objects with resolution
- Track variable types through imports
- Resolve type annotations to actual types
- Build type flow graphs

These operations require cross-file knowledge not available during semantic_index phase. We need to split the module so semantic_index only extracts what's written, while symbol_resolution determines what it means.

## Implementation

### 1. Simplify type_tracking in Semantic Index

Update `packages/core/src/semantic_index/references/type_tracking/type_tracking.ts`:

```typescript
/**
 * Type Tracking - Local extraction only
 *
 * Extracts type annotations and tracks variable declarations
 * without attempting any resolution.
 */

export interface LocalTypeTracking {
  /** Variable/parameter type annotations (unresolved) */
  readonly annotations: LocalVariableAnnotation[];

  /** Variable declarations and their patterns */
  readonly declarations: LocalVariableDeclaration[];

  /** Assignment patterns for type inference */
  readonly assignments: LocalAssignment[];
}

export interface LocalVariableAnnotation {
  /** Variable or parameter name */
  readonly name: SymbolName;

  /** Location of the annotation */
  readonly location: Location;

  /** Raw annotation text */
  readonly annotation_text: string; // "string", "MyClass", "Array<number>"

  /** Context */
  readonly kind: "variable" | "parameter" | "const" | "let";

  /** Containing scope */
  readonly scope_id: ScopeId;
}

export interface LocalVariableDeclaration {
  /** Variable name */
  readonly name: SymbolName;

  /** Declaration location */
  readonly location: Location;

  /** Declaration kind */
  readonly kind: "const" | "let" | "var" | "parameter";

  /** Optional type annotation (raw text) */
  readonly type_annotation?: string;

  /** Initializer expression (for inference) */
  readonly initializer?: ExpressionInfo;
}

export interface LocalAssignment {
  /** Target variable */
  readonly target: SymbolName;

  /** Assignment location */
  readonly location: Location;

  /** Source expression */
  readonly source: ExpressionInfo;

  /** Assignment operator */
  readonly operator: "=" | "+=" | "-=" | "*=" | "/=";
}

/**
 * Extract type tracking info without resolution
 */
export function extract_type_tracking(
  captures: NormalizedCapture[],
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): LocalTypeTracking {
  const annotations: LocalVariableAnnotation[] = [];
  const declarations: LocalVariableDeclaration[] = [];
  const assignments: LocalAssignment[] = [];

  for (const capture of captures) {
    switch (capture.category) {
      case SemanticCategory.TYPE_ANNOTATION:
        // Just extract the text, don't resolve
        annotations.push({
          name: extract_annotated_name(capture),
          location: capture.node_location,
          annotation_text: capture.text,
          kind: determine_annotation_kind(capture),
          scope_id: find_containing_scope(capture, scopes),
        });
        break;

      case SemanticCategory.VARIABLE_DECLARATION:
        declarations.push(extract_declaration_info(capture));
        break;

      case SemanticCategory.ASSIGNMENT:
        assignments.push(extract_assignment_info(capture));
        break;
    }
  }

  return { annotations, declarations, assignments };
}
```

### 2. Remove Resolution Logic

Delete these functions from type_tracking:

- `resolve_type_annotation()` - Attempts to resolve types
- `create_type_info()` - Creates resolved TypeInfo
- `track_variable_type()` - Tracks resolved types
- `infer_type_from_value()` - Complex type inference
- `build_type_flow_graph()` - Requires resolved types

### 3. Create Resolution Module in Symbol Resolution

Create `packages/core/src/symbol_resolution/type_resolution/track_types.ts`:

```typescript
/**
 * Type Tracking Resolution - Phase 3
 *
 * Resolves variable types using full cross-file context.
 */

import type { TypeId, SymbolId, Location } from "@ariadnejs/types";
import type { LocalTypeTracking } from "../../semantic_index/references/type_tracking";
import type { ImportResolutionMap, TypeRegistry } from "../types";

export interface ResolvedTypeTracking {
  /** Variable to type mappings */
  readonly variable_types: Map<SymbolId, TypeId>;

  /** Location to type mappings for all expressions */
  readonly expression_types: Map<Location, TypeId>;

  /** Type flow graph */
  readonly type_flows: TypeFlowGraph;
}

/**
 * Resolve all type tracking with full context
 */
export function resolve_type_tracking(
  local_tracking: Map<FilePath, LocalTypeTracking>,
  imports: ImportResolutionMap,
  type_registry: TypeRegistry,
  function_signatures: FunctionResolutionMap
): ResolvedTypeTracking {
  const variable_types = new Map<SymbolId, TypeId>();
  const expression_types = new Map<Location, TypeId>();
  const type_flows = new TypeFlowGraph();

  // Phase 1: Resolve explicit annotations
  for (const [file_path, tracking] of local_tracking) {
    for (const annotation of tracking.annotations) {
      const type_id = resolve_annotation_to_type(
        annotation.annotation_text,
        file_path,
        imports,
        type_registry
      );

      if (type_id) {
        const symbol_id = variable_symbol(
          annotation.name,
          file_path,
          annotation.location
        );
        variable_types.set(symbol_id, type_id);
        expression_types.set(annotation.location, type_id);
      }
    }
  }

  // Phase 2: Infer types from initializers
  for (const [file_path, tracking] of local_tracking) {
    for (const declaration of tracking.declarations) {
      if (!declaration.type_annotation && declaration.initializer) {
        const inferred_type = infer_expression_type(
          declaration.initializer,
          file_path,
          variable_types,
          function_signatures,
          type_registry
        );

        if (inferred_type) {
          const symbol_id = variable_symbol(
            declaration.name,
            file_path,
            declaration.location
          );
          variable_types.set(symbol_id, inferred_type);
        }
      }
    }
  }

  // Phase 3: Track type flow through assignments
  for (const [file_path, tracking] of local_tracking) {
    for (const assignment of tracking.assignments) {
      track_assignment_flow(assignment, file_path, variable_types, type_flows);
    }
  }

  return { variable_types, expression_types, type_flows };
}

/**
 * Resolve an annotation string to a TypeId
 */
function resolve_annotation_to_type(
  annotation: string,
  file_path: FilePath,
  imports: ImportResolutionMap,
  registry: TypeRegistry
): TypeId | undefined {
  // Parse the annotation (e.g., "Array<string>")
  const parsed = parse_type_annotation(annotation);

  // Resolve base type
  const base_type = resolve_type_reference(
    parsed.base,
    file_path,
    imports,
    registry
  );

  // Handle generics if present
  if (parsed.generics) {
    return resolve_generic_type(
      base_type,
      parsed.generics,
      file_path,
      imports,
      registry
    );
  }

  return base_type;
}
```

### 4. Update Tests

#### Semantic Index Tests (Local Only)

```typescript
describe("extract_type_tracking", () => {
  it("should extract annotations without resolution", () => {
    const code = `
      let x: MyClass = new MyClass();
      const y: string = "hello";
    `;

    const tracking = extract_type_tracking(captures, scopes, filePath);

    // Should capture annotation text only
    expect(tracking.annotations[0].annotation_text).toBe("MyClass");
    expect(tracking.annotations[0].name).toBe("x");

    expect(tracking.annotations[1].annotation_text).toBe("string");
    expect(tracking.annotations[1].name).toBe("y");

    // No TypeInfo, no resolution
    expect(tracking.type_info).toBeUndefined();
  });
});
```

#### Symbol Resolution Tests (With Resolution)

```typescript
describe("resolve_type_tracking", () => {
  it("should resolve types using imports", () => {
    const local_tracking = create_mock_tracking();
    const imports = create_resolved_imports();
    const registry = create_type_registry();

    const resolved = resolve_type_tracking(
      local_tracking,
      imports,
      registry,
      functions
    );

    // Should have resolved TypeIds
    const x_type = resolved.variable_types.get(variable_symbol("x"));
    expect(x_type).toBe("class:MyClass:file.ts:1:0");
  });
});
```

## Success Criteria

1. ✅ Type tracking in semantic_index only extracts syntax
2. ✅ No TypeInfo creation in semantic_index
3. ✅ Resolution logic moved to symbol_resolution
4. ✅ All variable types resolved with full context
5. ✅ Type inference works with resolved function signatures
6. ✅ Tests updated for both modules

## Dependencies

- **Depends on**:
  - task-epic-11.90.1: Infrastructure
  - task-epic-11.90.3: Type registry
  - task-epic-11.90.4: Type resolution
- **Blocks**:
  - Method call resolution
  - Type-based completions

## Risks and Mitigations

### Risk 1: Breaking Variable Type Tracking

**Mitigation**: Keep both implementations temporarily, switch gradually

### Risk 2: Complex Type Inference

**Mitigation**: Start with simple cases, add complexity incrementally

## Next Steps

After this task:

- Phase 6: Type flow references split
- Phase 8: Integration testing

## Notes

This split is crucial for maintaining architectural boundaries. The semantic_index phase should only capture "what's written in the code" while symbol_resolution determines "what it actually means" using cross-file context.

Key insight: Variable type tracking is fundamentally a cross-file operation since variables often get their types from imported classes or functions.
