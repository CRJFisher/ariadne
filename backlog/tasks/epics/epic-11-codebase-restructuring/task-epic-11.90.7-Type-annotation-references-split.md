# Task: Simplify type_annotation_references to Syntax Extraction Only

**Task ID**: task-epic-11.90.7
**Parent**: task-epic-11.90
**Status**: Completed
**Priority**: High
**Created**: 2024-01-19
**Estimated Effort**: 5 hours

## Objective

Simplify the `semantic_index/references/type_annotation_references` module to extract only the syntax of type annotations without attempting any resolution or cross-file analysis.

## Current Problem

The module currently attempts to:

1. Create TypeInfo objects with resolution
2. Build type hierarchies (requires resolving imported base types)
3. Resolve generic type parameters and constraints
4. Determine if a name refers to a class, interface, or type alias
5. Process type aliases that may reference imported types

These operations require cross-file knowledge not available during semantic_index phase.

## Implementation Plan

### 1. Define New Local-Only Interface

```typescript
// semantic_index/references/type_annotation_references/type_annotation_references.ts

/**
 * Local type annotation - just syntax extraction
 */
export interface LocalTypeAnnotation {
  /** Location of the annotation */
  readonly location: Location;

  /** Raw annotation text as written in code */
  readonly annotation_text: string; // "string", "Foo<Bar>", "A | B", etc.

  /** What this annotation is for */
  readonly annotation_kind:
    | "variable" // let x: string
    | "parameter" // (x: string) =>
    | "return" // (): string =>
    | "property" // { prop: string }
    | "generic" // <T extends Foo>
    | "cast"; // x as string

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** For parameters: whether optional */
  readonly is_optional?: boolean;

  /** For generics: constraint text (unresolved) */
  readonly constraint_text?: string; // "extends Foo", "implements Bar"

  /** What this annotation applies to */
  readonly annotates_location: Location;
}
```

### 2. Simplify Main Processing Function

```typescript
export function process_type_annotations(
  type_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): LocalTypeAnnotation[] {
  const annotations: LocalTypeAnnotation[] = [];

  for (const capture of type_captures) {
    if (!is_valid_capture(capture)) continue;

    const scope = find_containing_scope(
      capture.node_location,
      root_scope,
      scopes
    );

    if (!scope) continue;

    // Just extract syntax, don't resolve
    annotations.push({
      location: capture.node_location,
      annotation_text: capture.text, // Raw text
      annotation_kind: determine_annotation_kind(capture),
      scope_id: scope.id,
      is_optional: capture.modifiers?.is_optional,
      constraint_text: extract_constraint_text(capture),
      annotates_location:
        capture.context?.target_location || capture.node_location,
    });
  }

  return annotations;
}
```

### 3. Remove These Functions Entirely

Delete all resolution-related functions:

- `create_type_annotation_reference()` - Creates TypeInfo
- `build_type_hierarchy()` - Needs import resolution
- `find_generic_parameters()` - Resolves generic constraints
- `find_type_aliases()` - Resolves alias targets
- `resolve_type_references()` - Explicit resolution
- `build_type_annotation_map()` - Creates TypeInfo map

### 4. Simplify Helper Functions

Keep only syntax extraction helpers:

```typescript
// KEEP: Just determines syntax kind
function determine_annotation_kind(capture: NormalizedCapture): AnnotationKind {
  // Based on capture context, not resolution
}

// KEEP: Extracts raw constraint text
function extract_constraint_text(
  capture: NormalizedCapture
): string | undefined {
  // Just extract "extends Foo", don't resolve Foo
}

// DELETE: All TypeInfo creation
// DELETE: All hierarchy building
// DELETE: All resolution logic
```

### 5. Update Tests

```typescript
describe("process_type_annotations", () => {
  it("should extract annotation syntax without resolution", () => {
    const code = `
      let x: MyClass;
      function foo(param: string): Promise<number> {}
    `;

    const annotations = process_type_annotations(captures, root, scopes, path);

    // Should capture text, not resolve types
    expect(annotations[0].annotation_text).toBe("MyClass");
    expect(annotations[0].annotation_kind).toBe("variable");

    expect(annotations[1].annotation_text).toBe("string");
    expect(annotations[1].annotation_kind).toBe("parameter");

    expect(annotations[2].annotation_text).toBe("Promise<number>");
    expect(annotations[2].annotation_kind).toBe("return");
  });

  it("should not attempt to resolve imported types", () => {
    const code = `
      import { ImportedType } from './other';
      let x: ImportedType;
    `;

    const annotations = process_type_annotations(captures, root, scopes, path);

    // Should just capture "ImportedType" as text
    expect(annotations[0].annotation_text).toBe("ImportedType");
    // No TypeInfo, no TypeId, no resolution
  });
});
```

## Acceptance Criteria

1. Module only extracts annotation syntax as strings
2. No TypeInfo objects created
3. No type hierarchy building
4. No attempts to resolve type names to definitions
5. No cross-file dependencies
6. All tests updated to verify syntax extraction only

## Dependencies

- Depends on: TypeId removal from TypeInfo (completed)
- Blocks: task-epic-11.90.34 (annotation resolution in symbol_resolution)

## Notes

This is a critical simplification that enforces the architectural boundary. The full annotation resolution will be implemented in `symbol_resolution/type_resolution/resolve_annotations.ts` where it has access to:

- Resolved imports
- TypeId generation capability
- Complete type registry
- Cross-file type definitions

The semantic_index phase should only capture "what's written" not "what it means".

## Implementation Summary

### Completed 2025-01-20

1. **New LocalTypeAnnotation Interface**: Replaced TypeAnnotationReference with a simpler interface that only contains:
   - `annotation_text`: Raw type text as written (e.g., "string", "Foo<Bar>", "A | B")
   - `annotation_kind`: Category (variable, parameter, return, property, generic, cast)
   - `constraint_text`: Unresolved constraint syntax (e.g., "extends Foo", "implements Bar")
   - Location and scope information

2. **Removed Resolution Functions**:
   - `create_type_annotation_reference()` - Was creating TypeInfo objects
   - `build_type_hierarchy()` - Required import resolution
   - `find_generic_parameters()` - Resolved generic constraints
   - `find_type_aliases()` - Resolved alias targets
   - `resolve_type_references()` - Explicit resolution
   - All TypeInfo creation and hierarchy building logic

3. **Simplified Processing**:
   - `process_type_annotations()` now only extracts syntax
   - Helper functions only deal with text extraction
   - No cross-file dependencies
   - No type resolution attempts

4. **Test Updates**:
   - Main test file: 16 tests passing (syntax extraction)
   - Integration tests: 4 tests passing (updated expectations)
   - Bugfix tests: 19 tests passing, 10 skipped (removed functions)
   - Total: 39 tests passing

5. **Backwards Compatibility**:
   - Aliased LocalTypeAnnotation as TypeAnnotationReference
   - Aliased process_type_annotations as process_type_annotation_references
   - No changes needed in consuming modules

The module now properly follows the architectural principle: semantic_index extracts syntax, symbol_resolution performs resolution.
