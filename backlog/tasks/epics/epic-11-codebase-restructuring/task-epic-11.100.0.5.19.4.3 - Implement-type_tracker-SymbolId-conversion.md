---
id: task-epic-11.100.0.5.19.4.3
title: Implement type_tracker to SymbolId conversion in file_analyzer
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['type-system', 'enhancement']
dependencies: ['task-epic-11.100.0.5.19.4']
parent_task_id: task-epic-11.100.0.5.19.4
priority: medium
---

## Description

Implement proper conversion of type_tracker.variable_types to Map<SymbolId, TypeInfo> in file_analyzer.ts build_file_analysis function.

## Current Issue

The file_analyzer currently has a placeholder comment:
```typescript
// Convert type_tracker.variable_types to Map<SymbolId, TypeInfo>
const public_type_info = new Map<SymbolId, TypeInfo>();
// Note: type_tracker.variable_types needs to be converted to use SymbolId keys
```

## Changes Required

### 1. Analyze FileTypeTracker Structure
- Understand current type_tracker.variable_types format
- Identify how variable names map to TypeInfo

### 2. Implement Conversion Logic
- Convert variable names to SymbolId using variable_symbol()
- Map existing TypeInfo to new Map structure
- Handle edge cases (anonymous variables, scope-qualified names)

### 3. Update Variable Symbol Creation
- Ensure consistency between variable extraction and type tracking
- Use same SymbolId generation strategy for variables

### 4. Test Conversion
- Verify type information is preserved
- Test with various variable types and scopes

## Acceptance Criteria

- [ ] type_tracker.variable_types properly converted to Map<SymbolId, TypeInfo>
- [ ] Variable names correctly mapped to SymbolId keys
- [ ] TypeInfo data preserved during conversion
- [ ] No compilation errors in type_info usage
- [ ] Tests verify type information accuracy