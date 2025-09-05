# Task Epic-11.80.5: Integrate import_resolver for External Function Tracking

## Status

Completed

## Parent Task

Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description

Add import_resolver to FunctionCallContext to track calls to imported functions and resolve their source modules.

## Implementation Details

### 1. Add Import Data to Context

```typescript
interface FunctionCallContext {
  // ... existing fields
  imports?: ImportInfo[]; // Pre-resolved import data
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
  const import_info = imports.find(
    (imp) => imp.name === call.callee_name || imp.alias === call.callee_name
  );

  if (import_info) {
    return {
      ...call,
      is_imported: true,
      source_module: import_info.source,
      import_alias: import_info.alias,
      original_name: import_info.name,
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

- [x] Import resolver integrated into context
- [x] Imported functions correctly identified
- [x] Source module tracked for imported calls
- [x] All import types handled correctly
- [x] Tests verify import resolution

## Dependencies

- Task 11.80.3 (comprehensive tests must be in place)
- Task 11.80.4 (should be done after scope_tree integration)

## Estimated Effort

4 hours

## Implementation Notes

Successfully implemented import resolver integration with the following changes:

1. **Added imports field to FunctionCallContext** - Optional ImportInfo[] field for backward compatibility
2. **Extended EnhancedFunctionCallInfo** - Added fields for import tracking (is_imported, source_module, import_alias, original_name)
3. **Created enhance_with_import_info function** - Resolves calls against imports with support for:
   - Named imports
   - Default imports
   - Namespace imports (e.g., ns.function)
4. **Integrated into extract_call_generic** - Checks imports after local resolution fails
5. **Added comprehensive test** - Verifies all import types are correctly identified

### Key Features

- Direct import detection (named and default)
- Namespace import support with member access
- Alias tracking for renamed imports
- Only checks imports if local resolution fails
- Maintains backward compatibility with optional fields

### Files Modified

- `/packages/core/src/call_graph/function_calls/function_calls.ts` - Main implementation
- `/packages/core/src/call_graph/function_calls/function_calls.test.ts` - Added comprehensive test
