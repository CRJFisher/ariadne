# Task: Update TypeScript Tests

## Status: Created
## Parent Task: task-epic-11.102.2

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.2-Update-TypeScript-capture-logic.md`
2. Read the complete "TypeScript Feature → NormalizedCapture Mapping Plan" section
3. Use the mapping examples as test cases
4. Ensure type-only imports are filtered in tests

## File
`packages/core/src/parse_and_query_code/language_configs/typescript.test.ts`

## Implementation Checklist
- [ ] Remove tests for type system features and deprecated fields (parameter_name, return_type)
- [ ] Add tests for type_name field (return types, parameter types, variable types)
- [ ] Add visibility enum tests (public/private/protected)
- [ ] Add abstract method tests
- [ ] Add interface trait_type tests
- [ ] Verify type-only imports filtered
- [ ] Test non-null context (9 fields: 4 import + 3 export + 2 definition)
- [ ] Verify parameter names captured in symbol_name, not context
- [ ] Achieve 100% coverage