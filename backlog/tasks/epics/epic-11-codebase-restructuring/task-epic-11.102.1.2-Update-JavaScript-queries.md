# Task: Update JavaScript Query File

## Status: Created

## Parent Task
task-epic-11.102.1 - Update JavaScript Capture Logic for Unified Context

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.1-Update-JavaScript-capture-logic.md`
2. Read the complete "JavaScript Feature → NormalizedCapture Mapping Plan" section
3. Keep the mapping tables open for reference during implementation
4. Follow the mappings EXACTLY as specified - do not deviate

## Objective
Update the JavaScript tree-sitter query file to ensure all data needed for the unified context approach is properly captured.

## File
`packages/core/src/parse_and_query_code/queries/javascript.scm`

## Implementation Checklist

### Expected Changes (Minimal)
Since we're merging modifiers into context rather than changing what we capture, most queries should remain the same. Only remove captures that were exclusively used by the old modifiers function.

### Remove Modifiers-Only Captures
- [ ] Remove any @modifier captures that were ONLY used by the modifiers function
- [ ] Keep captures needed for the unified context function

### Ensure Context Data is Captured
- [ ] Async/generator keywords (for is_async, is_generator in context)
- [ ] Visibility markers like '#' prefix (for visibility in context)
- [ ] Import statements with source and specifiers (for import context fields)
- [ ] Export statements with exported names (for export context fields)
- [ ] Type annotations (for type_name field in context)
- [ ] Base class information (for extends field in context)
- [ ] Await expressions (for is_awaited in context)
- [ ] For...of loops (for is_iterated in context)

### Query Examples
```scheme
; These patterns should mostly stay the same
(function_declaration
  name: (identifier) @function.name)

; Async detection (needed for context)
(function_declaration
  "async" @async
  name: (identifier) @function.name)

; Generator detection (needed for context)
(generator_function_declaration
  name: (identifier) @function.name)

; Import patterns (needed for context)
(import_statement
  source: (string) @import.source)

(import_specifier
  (identifier) @import.name
  alias: (identifier)? @import.alias)

; Export patterns (needed for context)
(export_statement
  declaration: (function_declaration
    name: (identifier) @export.name))

; Private method detection (# prefix for visibility in context)
(method_definition
  "#" @private
  name: (property_identifier) @method.name)
```

## Testing Notes
- Queries should be mostly unchanged since we're reorganizing captured data usage, not what we capture
- Verify async/generator detection still works (now used in context)
- Test private method detection (# prefix for visibility in context)
- Ensure import/export patterns still capture necessary data