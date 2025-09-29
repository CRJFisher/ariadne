# Task: Update Rust Tests

## Status: Created
## Parent Task: task-epic-11.102.4

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.4-Update-Rust-capture-logic.md`
2. Read the complete "Rust Feature → NormalizedCapture Mapping Plan" section
3. Use the Rust-specific rules as test cases
4. Ensure all Rust complexity is removed from tests

## File
`packages/core/src/parse_and_query_code/language_configs/rust.test.ts`

## Implementation Checklist
- [ ] Remove tests for lifetimes/borrows/smart pointers and deprecated fields (parameter_name, return_type)
- [ ] Add tests for type_name field (return types, parameter types, variable types)
- [ ] Test visibility mapping (pub variants)
- [ ] Test trait method detection
- [ ] Test method vs associated function
- [ ] Test async fn detection
- [ ] Test Iterator return as generator
- [ ] Verify non-null context (9 fields: 4 import + 3 export + 2 definition)
- [ ] Verify parameter names captured in symbol_name, not context
- [ ] 100% coverage

## Key Test Cases
```typescript
// Visibility
expect(pubFn.modifiers.visibility).toBe('public');
expect(pubCrateFn.modifiers.visibility).toBe('internal');

// Method vs associated
expect(newFn.entity).toBe(SemanticEntity.FUNCTION); // No self
expect(methodFn.entity).toBe(SemanticEntity.METHOD); // Has self
```