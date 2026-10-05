# Task: Simplify type_members to Extract Only Direct Members

**Task ID**: task-epic-11.90.2
**Parent**: task-epic-11.90
**Status**: Created
**Priority**: High
**Created**: 2024-01-19
**Estimated Effort**: 4 hours

## Objective

Simplify the `semantic_index/type_members` module to extract only direct, locally-defined members without attempting any cross-file resolution or inheritance processing.

## Current Problem

The module currently tries to:

- Resolve base class/interface references
- Follow inheritance chains
- Merge inherited members

This requires information not available during single-file analysis.

## Implementation

### 1. Update type_members.ts

```typescript
// Remove all inheritance resolution logic
export interface LocalTypeMembers {
  readonly type_name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly location: Location;
  readonly direct_members: Map<SymbolName, LocalMemberInfo>;

  // Keep these as unresolved names only
  readonly extends_clause?: SymbolName[];
  readonly implements_clause?: SymbolName[];
}

export interface LocalMemberInfo {
  readonly name: SymbolName;
  readonly kind: "property" | "method" | "getter" | "setter";
  readonly location: Location;
  readonly is_static?: boolean;
  readonly is_optional?: boolean;
  readonly type_annotation?: string; // Just the raw annotation text
}
```

### 2. Simplify extract_type_members Function

```typescript
export function extract_type_members(
  captures: NormalizedCapture[],
  file_path: FilePath
): LocalTypeMembers[] {
  const types: LocalTypeMembers[] = [];

  // Process only direct member captures
  for (const capture of captures) {
    if (capture.category === SemanticCategory.TYPE_DEFINITION) {
      const members = extract_direct_members_only(capture);
      types.push({
        type_name: capture.text as SymbolName,
        kind: determine_type_kind(capture),
        location: capture.node_location,
        direct_members: members,
        extends_clause: extract_extends_names(capture),
        implements_clause: extract_implements_names(capture),
      });
    }
  }

  return types;
}
```

### 3. Remove Functions

Delete these functions entirely:

- `resolve_inherited_members()`
- `follow_inheritance_chain()`
- `merge_member_maps()`
- `resolve_base_type()`

### 4. Update Tests

Focus tests on:

- Extracting direct members only
- Capturing extends/implements clause names (not resolving them)
- Handling various member types (properties, methods, etc.)

## Testing

```typescript
describe("extract_type_members", () => {
  it("should extract direct members only", () => {
    const code = `
      class Child extends Parent {
        childMethod() {}
      }
    `;
    const members = extract_type_members(captures, filePath);

    // Should only have childMethod, not Parent's members
    expect(members[0].direct_members.size).toBe(1);
    expect(members[0].direct_members.has("childMethod")).toBe(true);

    // Should capture parent name without resolving
    expect(members[0].extends_clause).toEqual(["Parent"]);
  });
});
```

## Acceptance Criteria

1. Module only extracts members directly defined in the type
2. No attempts to resolve imports or base types
3. Extends/implements clauses captured as string names only
4. All existing tests updated to reflect new behavior
5. No cross-file dependencies in the module

## Dependencies

- None - can be done independently

## Notes

This simplification is critical for the phase separation. The full member resolution with inheritance will be implemented in `symbol_resolution/type_resolution/resolve_members.ts` in a later task.
