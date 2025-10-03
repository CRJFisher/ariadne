# Task epic-11.112.37: Remove availability Field

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** Multiple files modified
**Dependencies:** task-epic-11.112.36

## Objective

Remove the deprecated `availability` field from all definition types and update all builder configs to stop populating it. This is a breaking change that completes the migration to the visibility system.

## Files

### MODIFIED
- `packages/ariadne-types/src/semantic_index.ts`
- All builder configs
- All test files

## Implementation Steps

### 1. Remove from Type Definitions (20 min)

```typescript
// In semantic_index.ts

// Before:
export interface FunctionDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;
  availability: Availability;  // ← REMOVE THIS
  visibility: VisibilityKind;
  parameters: ParameterDefinition[];
  return_type?: TypeReference;
}

// After:
export interface FunctionDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;
  visibility: VisibilityKind;  // Only this remains
  parameters: ParameterDefinition[];
  return_type?: TypeReference;
}
```

Apply to all definition types:
- FunctionDefinition
- ClassDefinition
- InterfaceDefinition
- EnumDefinition
- VariableDefinition
- MethodDefinition
- ParameterDefinition
- PropertyDefinition
- TypeAliasDefinition

### 2. Remove Availability Type (5 min)

Delete the deprecated type:

```typescript
// DELETE THIS:
export type Availability = "local" | "file" | "file-export";
```

### 3. Update Builder Configs (30 min)

Remove `availability` from all definition builders:

```typescript
// Before:
builder.add_class({
  symbol_id: class_id,
  name: capture.text,
  location: capture.location,
  defining_scope_id: context.get_defining_scope_id(capture.location),
  availability: determine_availability(capture.node),  // ← REMOVE
  visibility: determine_visibility(availability),
});

// After:
builder.add_class({
  symbol_id: class_id,
  name: capture.text,
  location: capture.location,
  defining_scope_id: context.get_defining_scope_id(capture.location),
  visibility: determine_visibility_directly(capture.node),  // ← Direct determination
});
```

Update in all builder configs:
- javascript_builder_config.ts
- typescript_builder_config.ts
- python_builder_config.ts
- rust_builder_config.ts

### 4. Update determine_availability Function (15 min)

Rename and update the helper function:

```typescript
// Before:
export function determine_availability(node: TreeNode): Availability {
  // ... returns "local" | "file" | "file-export"
}

export function determine_visibility(
  availability: Availability,
  is_parameter: boolean = false
): VisibilityKind {
  // ... converts availability to visibility
}

// After:
export function determine_visibility_directly(
  node: TreeNode,
  is_parameter: boolean = false
): VisibilityKind {
  // Directly determine visibility from node
  if (is_exported(node)) {
    const export_name = get_export_name(node);
    return exported_visibility({ kind: "named", export_name });
  }

  if (is_at_file_scope(node)) {
    return file_visibility();
  }

  // Local scope
  return is_parameter ? scope_children_visibility() : scope_local_visibility();
}
```

### 5. Update Tests (30 min)

Remove all test assertions on `.availability`:

```typescript
// Before:
expect(class_def.availability).toBe("file");

// After:
expect(class_def.visibility.kind).toBe("file");
```

Search and update:
```bash
# Find all test assertions on availability
grep -r "\.availability" packages/core/src/ --include="*.test.ts"
```

### 6. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

Expected: Type errors if any code still references `availability`.

### 7. Fix Any Remaining References (15 min)

If type checker finds references:
```bash
# Find them
grep -r "availability" packages/core/src/ --include="*.ts"
```

Update to use `visibility`.

### 8. Run Full Test Suite (10 min)

```bash
npm test
```

Expected: All tests pass.

### 9. Update CHANGELOG (5 min)

```markdown
## [v2.0.0] - YYYY-MM-DD

### BREAKING CHANGES

- **Removed `availability` field from all definition types**
  - Use `visibility` instead
  - See migration guide: [link to docs]

### Migration

```typescript
// Before (v1.x):
if (definition.availability === "file-export") {
  // exported
}

// After (v2.0):
if (definition.visibility.kind === "exported") {
  // exported
}
```

For full migration guide, see documentation.
```

### 10. Update Documentation (5 min)

Ensure all docs reference `visibility` instead of `availability`:
- README
- API documentation
- Architecture docs
- Migration guides

## Success Criteria

- ✅ `availability` field removed from all types
- ✅ `Availability` type deleted
- ✅ Builder configs only populate `visibility`
- ✅ Helper functions updated
- ✅ All tests updated
- ✅ Type checker passes
- ✅ All tests pass
- ✅ CHANGELOG updated
- ✅ Documentation updated

## Outputs

- Fully migrated codebase using only `visibility`
- Breaking change documented

## Next Task

**task-epic-11.112.38** - Run comprehensive integration tests
