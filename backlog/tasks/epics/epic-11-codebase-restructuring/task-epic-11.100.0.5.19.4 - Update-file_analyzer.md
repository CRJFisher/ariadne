---
id: task-epic-11.100.0.5.19.4
title: Update file_analyzer.ts to use new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['downstream-consumer', 'type-system']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: high
---

## Description

Update file_analyzer.ts to use the new type system directly without any adapters or intermediate conversions.

## Changes Required

### 1. Update Import Statements
```typescript
// Remove old type imports
// Add new type imports from reorganized files
import type { 
  Import, Export, CallInfo, 
  SymbolDefinition, ScopeDefinition,
  TypeDefinition, TrackedType 
} from '@ariadne/types';
```

### 2. Update analyze_file Function
- Ensure all AST processing modules return new types
- Remove any adapter calls or conversions
- Use new types in FileAnalysisResult

### 3. Update Type References Throughout
- Replace any old type references with new ones
- Ensure proper type imports from reorganized files
- Update any type assertions or guards

### 4. Remove Legacy Support
- Remove any backward compatibility code for old types
- Clean up unused imports
- Simplify data flow

## Acceptance Criteria

- [ ] file_analyzer.ts uses only new types
- [ ] No references to old type names remain
- [ ] No adapter imports or calls
- [ ] All imports from reorganized type files
- [ ] Module compiles without errors
- [ ] Tests pass with new types