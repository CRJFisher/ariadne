# Task: Implement find_definition Tool

**Status**: To Do
**Epic**: epic-11.147 - Overhaul MCP Package for Call Graph Analysis
**Created**: 2025-10-22
**Priority**: Medium
**Dependencies**: task-epic-11.147.1

## Overview

Create MCP tool that finds the definition for a given reference symbol-name at a specific location.

This is the "Go to Definition" tool - given a symbol reference in source code, find where it's defined.

## Tool Specification

**Tool Name**: `find_definition`

**Input Schema**:
```typescript
{
  symbol_name: string;      // Required - Name of symbol at reference site
  file_path: string;        // Required - File containing the reference
  line_number: number;      // Required - Line number of reference
  column_number?: number;   // Optional - Column for precise matching
}
```

**Output Format**:
```
Definition for validate_input:

Defined in: src/validators.ts:10:8

function validate_input(data: InputData): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  return check_required_fields(data);
}

Type: function
Signature: (data: InputData) => boolean
Exported: yes
```

## Algorithm

1. **Find Reference at Location**:
   - Use `project.references.get_references_in_file(file_path)`
   - Filter to references at the specified line (and column if provided)
   - Match by symbol_name

2. **Resolve Reference**:
   - Get the reference's `scope_id`
   - Look up resolution in `project.resolutions`
   - Get the resolved SymbolId

3. **Get Definition**:
   - Use `project.get_definition(symbol_id)` to get AnyDefinition
   - Extract definition metadata (type, location, signature)

4. **Extract Source Code**:
   - Use `project.get_source_code(definition, file_path)` to get implementation
   - Include full function/class/variable definition

5. **Format Output**:
   - Show definition location (file:line:column)
   - Show source code with syntax
   - Show type information
   - Show export status
   - Show signature for callables

## Implementation Notes

### Finding Reference at Location

```typescript
// Get all references in file
const file_refs = project.references.get_references_in_file(file_path);

// Filter by location and name
const matching_ref = file_refs.find(ref =>
  ref.name === symbol_name &&
  ref.location.start_line === line_number &&
  (!column_number || ref.location.start_column === column_number)
);
```

### Resolving to Definition

```typescript
// Build location key
const location_key = `${file_path}:${matching_ref.location.start_line}:${matching_ref.location.start_column}`;

// Look up resolution
const symbol_id = project.resolutions.get_resolution(location_key);

// Get definition
const definition = project.get_definition(symbol_id);
```

### Building Signature

For functions/methods:
```typescript
const params = definition.parameters.map(p =>
  `${p.name}: ${p.type_annotation || 'any'}`
).join(', ');

const return_type = definition.return_type_annotation || 'unknown';

const signature = `(${params}) => ${return_type}`;
```

## Edge Cases

1. **Reference Not Found**: "No reference at specified location"
2. **Unresolved Reference**: "Symbol could not be resolved (possibly external)"
3. **Multiple References**: Pick closest match by column
4. **Built-in Symbol**: Show "Built-in symbol (no source available)"

## Testing

### Unit Tests

- Find reference by location
- Resolve reference to symbol_id
- Get definition by symbol_id
- Extract source code
- Build signatures
- Format output

### Integration Tests

- Find function definition (TypeScript)
- Find class definition (JavaScript)
- Find method definition (Python)
- Find struct definition (Rust)
- Handle unresolved references
- Handle built-in symbols

### Test Fixtures

Create test cases with:
- Local function call -> definition
- Imported function call -> definition
- Method call -> method definition
- Constructor call -> class definition
- Variable reference -> variable definition

## Acceptance Criteria

- [ ] Tool registered in MCP server with correct schema
- [ ] Finds reference at specified location
- [ ] Handles optional column_number for precision
- [ ] Resolves reference to SymbolId via resolutions
- [ ] Gets definition via project.get_definition()
- [ ] Shows definition location (file:line:column)
- [ ] Shows source code implementation
- [ ] Shows type information for callables
- [ ] Shows signature for functions/methods
- [ ] Shows export status
- [ ] Returns clear error when reference not found
- [ ] Returns clear error when resolution fails
- [ ] Handles built-in symbols gracefully
- [ ] Tested with all 4 languages

## Related Files

- [project.ts](../../../../packages/core/src/project/project.ts)
- [resolution_registry.ts](../../../../packages/core/src/resolve_references/resolution_registry.ts)
- [reference_registry.ts](../../../../packages/core/src/resolve_references/registries/reference_registry.ts)
- [definition_registry.ts](../../../../packages/core/src/resolve_references/registries/definition_registry.ts)
