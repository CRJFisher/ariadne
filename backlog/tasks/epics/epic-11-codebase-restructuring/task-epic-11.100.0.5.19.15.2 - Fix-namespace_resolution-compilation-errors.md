---
id: task-epic-11.100.0.5.19.15.2
title: Fix compilation errors in namespace_resolution module
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['bug-fix', 'typescript', 'compilation']
dependencies: ['task-epic-11.100.0.5.19.15']
parent_task_id: task-epic-11.100.0.5.19.15
priority: high
---

## Description

Fix TypeScript compilation errors in the namespace_resolution module that prevent clean builds.

## Current Errors (19 errors)

### Type Import Issues
1. `ImportStatement` should be `Import`
2. `Def` doesn't exist - should use proper definition types
3. `TypeRegistry` doesn't exist - needs correct import

### Property Mismatches
4. Missing properties in Export/Import types
5. `symbol_name` vs correct property names
6. `is_namespace_import` property missing
7. `namespace_name` property missing

### Branded Type Issues
8. String assignments to `SymbolId`, `FilePath` branded types
9. Iterator type issues with Map.values()

## Specific Error Locations

```
src/import_export/namespace_resolution/namespace_resolution.ts:10:3 - ImportStatement as Import
src/import_export/namespace_resolution/namespace_resolution.ts:11:3 - Def
src/import_export/namespace_resolution/namespace_resolution.ts:19:3 - TypeRegistry
src/import_export/namespace_resolution/namespace_resolution.ts:240:52 - Type predicate issue
src/import_export/namespace_resolution/namespace_resolution.ts:272:30 - Property 'config' missing
src/import_export/namespace_resolution/namespace_resolution.ts:400:24 - Iterator issue
src/import_export/namespace_resolution/namespace_resolution.ts:520:21 - symbol_name property
src/import_export/namespace_resolution/namespace_resolution.ts:567:23 - is_namespace_import property
```

## Required Fixes

### 1. Update Imports
```typescript
// OLD
import {
  Language,
  ImportStatement as Import,
  Def,
  TypeRegistry,
  ...
} from '@ariadnejs/types';

// NEW
import {
  Language,
  Import,
  Export,
  SymbolId,
  ...
} from '@ariadnejs/types';
```

### 2. Fix Property Access
```typescript
// OLD
if (export_stmt.symbol_name && !export_stmt.is_default) {
  exports.set(export_stmt.symbol_name, {
    name: export_stmt.symbol_name,
    ...
  });
}

// NEW
if (export_stmt.kind === 'named') {
  for (const item of export_stmt.exports) {
    exports.set(item.local_name, {
      name: item.local_name,
      ...
    });
  }
}
```

### 3. Handle Branded Types
```typescript
// OLD
const namespace_key = `${analysis.file_path}:${import_stmt.namespace_name}`;

// NEW
const namespace_key = `${analysis.file_path}:${import_stmt.kind === 'namespace' ? import_stmt.namespace_name : ''}` as FilePath;
```

### 4. Fix Type Guards
```typescript
// OLD
function is_reexport(exp: NamespaceExport): exp is { is_namespace_reexport: true; target_module: string } {

// NEW
function is_reexport(exp: NamespaceExport): boolean {
  return exp.kind === 'namespace' && !!exp.source;
}
```

## Implementation Strategy

### Phase 1: Import and Type Fixes
- [ ] Update all imports to use correct types from @ariadnejs/types
- [ ] Remove references to non-existent types (Def, TypeRegistry)
- [ ] Add proper type guards for discriminated unions

### Phase 2: Property Access Updates
- [ ] Update Export property access to use discriminated union
- [ ] Update Import property access to use discriminated union
- [ ] Fix all symbol_name references

### Phase 3: Branded Type Integration
- [ ] Properly handle SymbolId branded types
- [ ] Properly handle FilePath branded types
- [ ] Fix string-to-branded-type assignments

### Phase 4: Iterator and Modern TS
- [ ] Fix Map.values() iteration
- [ ] Update to modern TypeScript patterns
- [ ] Ensure strict mode compliance

## Testing Requirements

- [ ] All existing tests continue to pass
- [ ] No TypeScript compilation errors
- [ ] No TypeScript warnings in strict mode
- [ ] Runtime behavior unchanged

## Success Criteria

- [ ] Zero TypeScript compilation errors
- [ ] Zero TypeScript warnings
- [ ] All existing functionality preserved
- [ ] Tests pass without modification
- [ ] Clean build with `npm run build`