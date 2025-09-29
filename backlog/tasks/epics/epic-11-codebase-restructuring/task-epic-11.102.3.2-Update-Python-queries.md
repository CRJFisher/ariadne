# Task: Update Python Query File

## Status: Created
## Parent Task: task-epic-11.102.3

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.3-Update-Python-capture-logic.md`
2. Read the complete "Python Feature → NormalizedCapture Mapping Plan" section
3. Focus on capturing decorators and naming patterns
4. Remember @staticmethod/@classmethod don't set modifiers

## File
`packages/core/src/parse_and_query_code/queries/python.scm`

## Implementation Checklist
- [ ] Capture decorator names for modifier detection
- [ ] Capture function/method names for visibility inference
- [ ] Simplify import/from patterns
- [ ] Remove __all__ specific queries and deprecated captures (parameter_name, return_type)
- [ ] Add type annotation captures (for type_name field)
- [ ] Keep async def and yield detection
- [ ] Ensure parameter names captured in symbol_name, not separate captures

## Key Queries
```scheme
(decorator (identifier) @decorator.name)
(function_definition name: (identifier) @function.name)
(import_from_statement module: (dotted_name) @import.source)
(type_annotation (type) @type.name)    ; For type_name field
; Remove: @parameter.name (now in symbol_name)
; Remove: @return.type (replaced with @type.name)
```