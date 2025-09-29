# Task: Update Rust Query File

## Status: Created
## Parent Task: task-epic-11.102.4

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.4-Update-Rust-capture-logic.md`
2. Read the complete "Rust Feature → NormalizedCapture Mapping Plan" section
3. See section 4 "What to SKIP" for all captures to remove
4. Keep self parameter detection for method vs function

## File
`packages/core/src/parse_and_query_code/queries/rust.scm`

## Implementation Checklist
- [ ] Remove lifetime captures ('a, 'static)
- [ ] Remove borrow captures (&, &mut)
- [ ] Remove smart pointer captures
- [ ] Keep visibility captures (pub, pub(crate))
- [ ] Keep trait impl captures
- [ ] Remove parameter_name captures (captured in symbol_name instead)
- [ ] Remove return_type captures (replace with type_name)
- [ ] Keep self parameter detection
- [ ] Keep type annotation captures (for type_name field)
- [ ] Simplify to essentials

## Key Queries
```scheme
; Remove
(lifetime) @lifetime
(reference_type) @borrow
@parameter.name  ; Parameters now in symbol_name
@return.type     ; Replace with @type.name

; Keep
(visibility_modifier) @visibility
(self_parameter) @method.self
(trait_implementation) @trait.impl
@type.name       ; Generic type field
```