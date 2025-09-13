---
id: task-epic-11.100.0.5.15.1
title: Fix missing is_type_only properties
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['bug-fix', 'type-safety', 'compilation-error']
dependencies: ['task-epic-11.100.0.5.15']
parent_task_id: task-epic-11.100.0.5.15
priority: high
---

## Description

During TypeScript compilation after the Export type migration, multiple Export objects are missing the required `is_type_only` property that's defined as non-optional in the Export interfaces.

## Background

The migration from ExportInfo to Export types introduced discriminated unions with strict type requirements. All Export interfaces require an `is_type_only` boolean property, but the migration missed adding this property in several locations in export_extraction.ts.

## Specific Compilation Errors

```
packages/core/src/import_export/export_detection/export_extraction.ts(368,15): error TS2741: Property 'is_type_only' is missing in type '{ kind: "default"; symbol: any; is_declaration: boolean; location: Location; language: "javascript"; node_type: string; }' but required in type 'DefaultExport'.

packages/core/src/import_export/export_detection/export_extraction.ts(403,29): error TS2741: Property 'is_type_only' is missing in type '{ local_name: any; export_name: any; }' but required in type 'NamedExportItem'.

packages/core/src/import_export/export_detection/export_extraction.ts(417,29): error TS2741: Property 'is_type_only' is missing in type '{ source_name: any; export_name: any; }' but required in type 'ReExportItem'.
```

## Acceptance Criteria

- [ ] All Export type creations include the `is_type_only` property
- [ ] Default to `false` for most cases, detect `true` for TypeScript type exports
- [ ] TypeScript compilation succeeds without `is_type_only` errors
- [ ] Language-specific type detection works correctly for TypeScript
- [ ] No functional regression in export detection behavior

## Implementation Strategy

1. **Audit export_extraction.ts** for all Export object creations
2. **Add is_type_only property** with appropriate default values:
   - `false` for JavaScript, Python, Rust exports
   - Detect type exports for TypeScript (look for `type` keyword, interface declarations)
3. **Update helper functions** to consistently handle is_type_only parameter
4. **Test compilation** to ensure all errors resolved

## Files to Modify

- `packages/core/src/import_export/export_detection/export_extraction.ts`

## Testing

- Verify TypeScript compilation passes
- Test type-only export detection for TypeScript files
- Ensure no behavioral changes for existing export detection logic