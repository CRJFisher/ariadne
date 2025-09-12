---
id: task-epic-11.100.0.5.19.5
title: Update code_graph.ts to use new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['downstream-consumer', 'type-system']
dependencies: ['task-epic-11.100.0.5.19.4']
parent_task_id: task-epic-11.100.0.5.19
priority: high
---

## Description

Update code_graph.ts to use the new type system directly, ensuring all graph construction uses the reorganized types.

## Changes Required

### 1. Update Import Statements
```typescript
// Remove old type imports
// Add new type imports from reorganized files
import type { 
  Import, Export, CallInfo,
  SymbolDefinition, ScopeDefinition,
  TypeDefinition, TrackedType,
  FilePath, SymbolId, ModulePath
} from '@ariadne/types';
```

### 2. Update GraphNode Type Definitions
- Update node types to use new type definitions
- Ensure proper discriminated union types
- Update any type guards

### 3. Update Graph Construction Functions
- build_import_graph: Use new Import types
- build_call_graph: Use new CallInfo types
- build_type_graph: Use new TypeDefinition types
- build_scope_graph: Use new ScopeDefinition types

### 4. Update Edge Construction
- Ensure edges use proper branded types
- Update relationship mappings
- Use new type guards and validators

### 5. Remove Legacy Conversions
- Remove any type conversion code
- Clean up adapter patterns
- Simplify data flow

## Acceptance Criteria

- [ ] code_graph.ts uses only new types
- [ ] All graph builders use new type definitions
- [ ] No references to old type names
- [ ] No adapter imports or conversions
- [ ] Module compiles without errors
- [ ] Graph generation works correctly