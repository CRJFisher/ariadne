# Task: Fix type_resolution Object Literals

**Task ID**: task-epic-11.92.8.1
**Parent**: task-epic-11.92.8
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Fix TS2739/2740 errors in type_resolution.comprehensive.test.ts where object literals are missing required properties.

## Problem

Multiple object literals in tests are missing required properties, causing:
- TS2739: Type missing properties
- TS2740: Type missing properties from target type

These are "quick win" fixes as they typically just require adding missing properties to object literals.

## Common Missing Properties

Based on error analysis:
1. LocalTypeDefinition missing: `file_path`, `direct_members`, `extends_names`, etc.
2. TypeInfo missing: `category`, `location`, `members`
3. SemanticIndex missing: `local_types`, `local_type_annotations`, etc.
4. Various test data objects missing required fields

## Solution Approach

1. **Add missing properties with defaults**
   ```typescript
   const type_def: LocalTypeDefinition = {
     name: "MyClass" as SymbolName,
     kind: "class",
     location: someLocation,
     // Add missing required properties:
     file_path: "test.ts" as FilePath,
     direct_members: new Map(),
     extends_names: [],
     implements_names: [],
     is_exported: false
   };
   ```

2. **Use spread operator for common defaults**
   ```typescript
   const DEFAULT_TYPE_DEF = {
     direct_members: new Map(),
     extends_names: [],
     implements_names: [],
     is_exported: false,
     generic_parameters: []
   };

   const type_def: LocalTypeDefinition = {
     ...DEFAULT_TYPE_DEF,
     name: "MyClass" as SymbolName,
     kind: "class",
     location: someLocation,
     file_path: "test.ts" as FilePath
   };
   ```

## Implementation Steps

1. **Identify all object literal errors** (20 min)
   - Find all TS2739/2740 errors
   - Group by object type
   - List missing properties

2. **Create default objects** (30 min)
   - Define defaults for common types
   - Ensure type compliance
   - Make reusable

3. **Fix object literals** (1 hour)
   - Add missing properties
   - Use appropriate default values
   - Maintain test semantics

4. **Verify** (10 min)
   - Run type check
   - Ensure tests still validate correctly

## Example Fixes

```typescript
// Before - missing properties
const mock_index = {
  file_path: "test.ts" as FilePath,
  language: "typescript",
  scopes: new Map(),
  symbols: new Map()
};

// After - all required properties
const mock_index: SemanticIndex = {
  file_path: "test.ts" as FilePath,
  language: "typescript",
  root_scope_id: "scope_0" as ScopeId,
  scopes: new Map(),
  symbols: new Map(),
  references: {
    calls: [],
    returns: [],
    member_accesses: [],
    type_annotations: []
  },
  imports: [],
  exports: [],
  file_symbols_by_name: new Map(),
  local_types: [],
  local_type_annotations: [],
  local_type_tracking: {
    declarations: [],
    assignments: [],
    annotations: []
  },
  local_type_flow: []
};
```

## Success Criteria

- [ ] All TS2739/2740 errors in file resolved
- [ ] Object literals have all required properties
- [ ] Default values semantically appropriate
- [ ] Tests maintain original validation logic
- [ ] Reusable defaults created

## Files to Modify

- `src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts`

## Testing

```bash
# Check remaining errors
npm run build 2>&1 | grep -E "TS2739|TS2740.*type_resolution.comprehensive"

# Verify compilation
npm run build

# Run tests
npx vitest run src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts
```

## Dependencies

- Related to task-epic-11.92.6.4 (interface alignment)
- Can use helpers from task-epic-11.92.9.1 if available

## Notes

- This is a quick win - straightforward property additions
- Focus on completeness over optimization
- Extract common patterns for reuse
- Document any non-obvious default values