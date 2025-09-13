---
id: task-epic-11.100.0.5.19.23
title: Fix SymbolId branding issues
status: To Do
assignee: []
created_date: "2025-01-13"
labels: ["type-system", "branded-types"]
dependencies: ["task-epic-11.100.0.5.19.2"]
parent_task_id: task-epic-11.100.0.5.19.2
priority: high
---

## Description

Fix type errors where raw strings are being used where SymbolId branded types are expected, and resolve related type incompatibilities.

## Current Errors

### 1. String to SymbolId Assignment
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'SymbolId'.
error TS2345: Argument of type 'Map<string, Set<string>>' is not assignable to parameter of type 'Map<SymbolId, Set<SymbolId>>'.
```

### 2. SymbolId to Reference Type Mismatches
```
error TS2345: Argument of type 'SymbolId' is not assignable to parameter of type 'ResolvedReference'.
error TS2345: Argument of type 'ResolvedReference' is not assignable to parameter of type 'SymbolId'.
```

### 3. VariableName vs SymbolId Incompatibility
```
error TS2322: Type 'SymbolId' is not assignable to type 'VariableName'.
```

## Files to Update

### 1. call_chain_analysis.ts
File: `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts`

Fix string to SymbolId conversions:
```typescript
// Lines 79, 81: Convert strings to SymbolId
const symbolId = function_symbol(rawString, filePath, location);

// Line 99: Convert Map<string, Set<string>> to Map<SymbolId, Set<SymbolId>>
const symbolMap = new Map<SymbolId, Set<SymbolId>>();
for (const [key, values] of stringMap) {
  const keySymbol = function_symbol(key, filePath, location);
  const valueSymbols = new Set<SymbolId>();
  for (const value of values) {
    valueSymbols.add(function_symbol(value, filePath, location));
  }
  symbolMap.set(keySymbol, valueSymbols);
}

// Lines 488, 509: Handle SymbolId/ResolvedReference conversions
```

### 2. type_tracking.ts
File: `packages/core/src/type_analysis/type_tracking/type_tracking.ts`

Fix SymbolId to VariableName assignment:
```typescript
// Line 1343: Convert SymbolId to VariableName or change type expectation
const variableName = extractVariableName(symbolId); // Helper function needed

// Line 1355: Fix Map type compatibility
const qualifiedMap = new Map<QualifiedName, VariableType>();
// Convert from Map<string, VariableType> appropriately
```

## Solution Approaches

### Option 1: Convert Using Factory Functions
Use symbol utility functions to create proper SymbolId instances:
```typescript
import { function_symbol, variable_symbol } from '@ariadnejs/types';

const symbolId = function_symbol(name, filePath, location);
```

### Option 2: Add Type Conversion Utilities
Create helper functions for common conversions:
```typescript
export function stringToSymbolId(str: string, context: SymbolContext): SymbolId;
export function symbolIdToVariableName(symbolId: SymbolId): VariableName;
```

### Option 3: Update Type Expectations
Change function signatures to accept the actual types being passed:
```typescript
// Instead of expecting SymbolId, accept string and convert internally
function processSymbol(name: string, context: FileContext): void;
```

## Acceptance Criteria

- [ ] All string to SymbolId assignment errors resolved
- [ ] SymbolId/ResolvedReference type mismatches fixed
- [ ] VariableName/SymbolId compatibility issues resolved
- [ ] call_chain_analysis module compiles without branding errors
- [ ] type_tracking module compiles without type assignment errors
- [ ] Proper use of branded type factory functions throughout codebase

## Implementation Priority

1. **High Priority**: call_chain_analysis branding errors (blocking call analysis)
2. **Medium Priority**: type_tracking SymbolId/VariableName issues
3. **Low Priority**: Reference type conversions (may be addressed in separate tasks)

## Related Types

- `SymbolId` - Universal symbol identifier
- `VariableName` - Legacy variable name type
- `ResolvedReference` - Symbol reference with metadata
- `QualifiedName` - Qualified symbol name type