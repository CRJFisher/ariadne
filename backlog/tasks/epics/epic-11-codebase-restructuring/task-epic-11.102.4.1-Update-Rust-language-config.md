# Task: Update Rust Language Config

## Status: Created
## Parent Task: task-epic-11.102.4

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.4-Update-Rust-capture-logic.md`
2. Read the complete "Rust Feature → NormalizedCapture Mapping Plan" section
3. Focus on REMOVING all Rust complexity (lifetimes, borrows, etc.)
4. Note method vs associated function detection via self parameter

## File
`packages/core/src/parse_and_query_code/language_configs/rust.ts`

## Implementation Checklist
- [ ] Remove lifetime/borrow/smart pointer handling
- [ ] Map visibility (pub, pub(crate), pub(super))
- [ ] Detect trait methods for trait_type
- [ ] Distinguish methods (has self) from associated functions
- [ ] Remove unsafe/const modifiers and deprecated context fields (parameter_name, return_type)
- [ ] Replace return_type with generic type_name field
- [ ] Simplify use/mod handling to 9 context fields (4 import + 3 export + 2 definition)
- [ ] Ensure parameter names captured in symbol_name, not context

## Key Changes
```typescript
// Visibility mapping
visibility: node.has('pub') ?
  (node.has('crate') ? 'internal' :
   node.has('super') ? 'module' : 'public') : 'private'

// Method vs associated function
// Has self parameter = method, no self = associated function

// Type annotation handling
type_name: extractTypeInfo(node) // For return types, parameters, variables
```

## Files to Update
- rust.ts (main config)
- rust_core.ts (if it has modifier mappings)
- rust_functions.ts (if it has modifier mappings)
- rust_patterns.ts (if it has modifier mappings)