# Task: Update TypeScript Query File

## Status: Created
## Parent Task: task-epic-11.102.2

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.2-Update-TypeScript-capture-logic.md`
2. Read the complete "TypeScript Feature → NormalizedCapture Mapping Plan" section
3. Pay special attention to "TypeScript-Specific Rules" section
4. Remove all type-only captures as specified

## File
`packages/core/src/parse_and_query_code/queries/typescript.scm`

## Implementation Checklist
- [ ] Remove type parameter captures (`<T>`)
- [ ] Remove type assertion captures
- [ ] Remove conditional type captures
- [ ] Remove parameter_name captures (captured in symbol_name instead)
- [ ] Remove return_type captures (replace with type_name)
- [ ] Keep visibility modifier captures
- [ ] Keep abstract keyword captures
- [ ] Filter type-only imports/exports
- [ ] Keep type annotation captures (for type_name field)
- [ ] Simplify to essential captures only

## Key Query Changes
```scheme
; Remove
(type_parameters) @type.params
(type_assertion) @type.assertion
@parameter.name  ; Parameters now in symbol_name
@return.type     ; Replace with @type.name

; Keep
(abstract_method_signature) @method.abstract
["public" "private" "protected"] @visibility
@type.name       ; Generic type field
```