---
id: task-epic-11.100.0.5.15.2
title: Fix location context and file paths
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['context-management', 'location-tracking', 'api-improvement']
dependencies: ['task-epic-11.100.0.5.15']
parent_task_id: task-epic-11.100.0.5.15
priority: medium
---

## Description

The node_to_location functions currently use placeholder empty file_path fields. Need proper context passing for complete Location objects that downstream code can rely on.

## Background

During the Export type migration, the Location interface requirements were updated to include:
- `file_path: FilePath`
- `line: number`
- `column: number`
- `end_line: number`
- `end_column: number`

The current node_to_location implementations use `file_path: '' as any` as a placeholder, which breaks downstream code that depends on accurate location information.

## Current Issues

- `node_to_location()` in both export_detection.ts and export_extraction.ts use placeholder file_path
- Location interface requires valid file_path for proper operation
- Downstream code (symbol resolution, navigation) may depend on accurate location information
- Type safety is compromised by using `as any` casting

## Acceptance Criteria

- [ ] Update extract_exports() signatures to accept optional file_path parameter
- [ ] Pass file_path context through to node_to_location calls
- [ ] Ensure all Location objects have valid file_path when available
- [ ] Maintain backward compatibility with existing callers
- [ ] Remove `as any` type assertions where possible
- [ ] Document when file_path may be unavailable and how consumers should handle it

## Implementation Strategy

### Phase 1: Update Function Signatures
1. **Update extract_exports() functions** to accept optional file_path parameter:
   ```typescript
   export function extract_exports(
     root_node: SyntaxNode,
     source_code: string,
     language: Language,
     file_path?: string  // Add this parameter
   ): Export[]
   ```

2. **Update language-specific extractors** with file_path parameter

### Phase 2: Update node_to_location
1. **Modify node_to_location functions** to accept file_path parameter:
   ```typescript
   function node_to_location(node: SyntaxNode, file_path?: string): Location {
     return {
       file_path: file_path ? buildFilePath(file_path) : buildFilePath(''),
       line: node.startPosition.row + 1,
       column: node.startPosition.column + 1,
       end_line: node.endPosition.row + 1,
       end_column: node.endPosition.column + 1
     };
   }
   ```

### Phase 3: Update Call Sites
1. **Thread file_path through call hierarchy**
2. **Update callers to provide file_path when available**
3. **Graceful degradation when file_path unavailable**

## Files to Modify

- `packages/core/src/import_export/export_detection/export_extraction.ts`
- `packages/core/src/import_export/export_detection/export_detection.ts`
- Any callers of extract_exports functions

## Backward Compatibility

- Make file_path parameter optional to maintain compatibility
- Provide sensible defaults when file_path unavailable
- Document the importance of providing file_path for accurate location tracking

## Testing

- Verify Location objects have proper file_path when provided
- Test backward compatibility with existing callers
- Ensure no functional regressions in export detection
- Test that downstream location-dependent features work correctly