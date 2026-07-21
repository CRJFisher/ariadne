# Task: Implement find_references Tool

**Status**: To Do
**Epic**: epic-11.147 - Overhaul MCP Package for Call Graph Analysis
**Created**: 2025-10-22
**Priority**: Medium
**Dependencies**: task-epic-11.147.1

## Overview

Create MCP tool that finds all references to a given callable definition.

## Tool Specification

**Tool Name**: `find_references`

**Input Schema**:
```typescript
{
  symbol_name: string;      // Required - Name of the callable
  file_path: string;        // Required - File where callable is defined
  line_number?: number;     // Optional - Line number to disambiguate overloads
}
```

**Output Format**:
```
References to validate_input:

1. src/main.ts:42:10
   process_data() calls validate_input(data)

2. src/api.ts:50:15
   quick_validate() calls validate_input(input)

3. src/batch.ts:75:8
   batch_process() calls validate_input(item)

Total: 3 references
```

## Algorithm

1. **Resolve Symbol**:
   - Use `project.definitions` to find definition by name + file_path
   - If line_number provided, filter to exact line
   - Get the SymbolId

2. **Find All References**:
   - Query `project.resolutions` for all CallReferences where `symbol_id` matches
   - Use `resolutions.get_all_referenced_symbols()` to get reference map
   - Filter to references that resolve to our SymbolId

3. **Build Context**:
   - For each reference:
     - Extract location (file:line:column)
     - Get containing function from `scope_id`
     - Get source code line via `project.get_source_code()`
     - Build context string

4. **Format Output**:
   - Group references by file
   - Sort by line number within each file
   - Number references sequentially
   - Show containing function and call context

## Implementation Notes

### Using ResolutionRegistry

```typescript
// Get all call references
const all_refs = project.resolutions.get_all_references();

// Filter to our symbol
const matching_refs = all_refs.filter(ref => ref.symbol_id === target_symbol_id);
```

### Building Context

```typescript
// Get containing function
const containing_scope = project.scopes.get(ref.scope_id);
const containing_function = find_enclosing_callable(containing_scope);

// Get source line
const line_def = {
  range: {
    start: { row: ref.location.start_line - 1, column: 0 },
    end: { row: ref.location.start_line - 1, column: 999 }
  }
};
const context_line = project.get_source_code(line_def, ref.location.file_path);
```

## Edge Cases

1. **Symbol Not Found**: Return clear error with suggestions
2. **Multiple Overloads**: Require line_number parameter
3. **Zero References**: Show "No references found" message
4. **Unresolved References**: Include count of unresolved calls (where symbol_id is null)

## Testing

### Unit Tests

- Symbol resolution (by name + file)
- Symbol resolution (by name + file + line)
- Reference filtering
- Context extraction
- Output formatting

### Integration Tests

- Find references in TypeScript
- Find references in JavaScript
- Find references in Python
- Find references in Rust
- Find references with overloads
- Find references with zero results

### Test Fixtures

Create test cases with:
- Single file with multiple references
- Multi-file references
- Method calls vs function calls
- Constructor calls

## Acceptance Criteria

- [ ] Tool registered in MCP server with correct schema
- [ ] Resolves symbol by name + file_path
- [ ] Handles optional line_number for disambiguation
- [ ] Finds all call references via resolutions registry
- [ ] Shows file:line:column for each reference
- [ ] Shows containing function context
- [ ] Shows source code context for each reference
- [ ] Groups by file, sorts by line number
- [ ] Returns clear error for unknown symbol
- [ ] Handles zero references gracefully
- [ ] Tested with all 4 languages

## Related Files

- [project.ts](../../../../packages/core/src/project/project.ts)
- [resolution_registry.ts](../../../../packages/core/src/resolve_references/resolution_registry.ts)
- [definition_registry.ts](../../../../packages/core/src/resolve_references/registries/definition_registry.ts)
