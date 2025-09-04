# Task Epic-11.80.4: Integrate import_resolver for External Function Tracking

## Status
Pending

## Parent Task
Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description
Add import_resolver to FunctionCallContext to track calls to imported functions and resolve their source modules.

## Implementation Details

### 1. Add Import Data to Context
```typescript
interface FunctionCallContext {
  // ... existing fields
  imports?: ImportInfo[];  // Pre-resolved import data
}
```

### 2. Track Imported Function Calls
```typescript
// Direct lookup in import data, no function calls
function enhance_call_with_import_info(
  call: FunctionCallInfo,
  imports: ImportInfo[]
): EnhancedFunctionCallInfo {
  // Direct array search, no dynamic dispatch
  const import_info = imports.find(imp => 
    imp.name === call.callee_name || 
    imp.alias === call.callee_name
  );
  
  if (import_info) {
    return {
      ...call,
      is_imported: true,
      source_module: import_info.source,
      import_alias: import_info.alias,
      original_name: import_info.name
    };
  }
  
  return call;
}
```

### 3. Handle Different Import Types
- Named imports: `import { func } from 'module'`
- Default imports: `import func from 'module'`
- Namespace imports: `import * as ns from 'module'`
- Dynamic imports: `await import('module')`

## Benefits
- Track cross-module dependencies
- Identify external vs internal calls
- Enable cross-file call graph construction
- Support for "find references" across files

## Acceptance Criteria
- [ ] Import resolver integrated into context
- [ ] Imported functions correctly identified
- [ ] Source module tracked for imported calls
- [ ] All import types handled correctly
- [ ] Tests verify import resolution

## Dependencies
- Task 11.80.3 (should be done after scope_tree integration)

## Estimated Effort
4 hours
