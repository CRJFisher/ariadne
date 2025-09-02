# Task 11.62.27.4: Update All Consumers to Use New API

**Status**: 🔴 Not Started  
**Assignee**: Unassigned  
**Estimated effort**: 2-3 hours  
**Actual effort**: Not recorded  
**Priority**: P1 (High)  
**Tags**: #api #refactoring #breaking-change

## Context

Sub-task of 11.62.27. Update all code that consumes import/export types to use the new `symbol_name` field instead of `symbol_names` array, and handle the consolidated types.

## Requirements

1. **Update type adapters**
   - Fix `convert_import_info_to_statement()` to use `symbol_name`
   - Fix `convert_export_info_to_statement()` to use `symbol_name`
   - Ensure default exports include entity name or 'default'
   - Handle namespace imports correctly (undefined symbol_name)

2. **Update all consumers of symbol_names**
   - Find all references to `.symbol_names`
   - Change array access to single value access
   - Remove array iteration where used
   - Update any array methods (map, filter, etc.)

3. **Update tests**
   - Fix all test assertions expecting arrays
   - Update test data structures
   - Add new tests for edge cases

## Code Patterns to Fix

### Before:
```typescript
// Array access
const firstSymbol = stmt.symbol_names[0];
for (const symbol of stmt.symbol_names) { ... }
if (stmt.symbol_names.length > 0) { ... }
stmt.symbol_names.includes('foo')
```

### After:
```typescript
// Single value access
const symbol = stmt.symbol_name;
if (stmt.symbol_name) { ... }
if (stmt.symbol_name === 'foo') { ... }
```

## Files to Search

- All files using ImportStatement or ExportStatement
- Symbol resolution code
- Module graph builders
- Type tracking code
- All test files
- Documentation examples

## Implementation Checklist

- [ ] Update convert_import_info_to_statement()
- [ ] Update convert_export_info_to_statement()
- [ ] Search for all `.symbol_names` references
- [ ] Update each consumer to use `.symbol_name`
- [ ] Fix default export handling (include name)
- [ ] Fix namespace import handling
- [ ] Update all test assertions
- [ ] Update test fixtures
- [ ] Run all tests
- [ ] Update any documentation/examples
- [ ] Verify no references to symbol_names remain

## Success Criteria

- [ ] No references to `symbol_names` array remain
- [ ] All consumers use `symbol_name` field
- [ ] Default exports preserve entity names
- [ ] All tests pass
- [ ] No runtime errors

## Dependencies

- Depends on 11.62.27.3 (remove duplicate types)
- Final implementation task

## Notes

This completes the consolidation. After this, the codebase will have:
1. Single source of truth for import/export types
2. Cleaner API that matches the data model
3. No duplicate or conflicting type definitions

The main risk is missing some consumers, but TypeScript should catch most issues at compile time.