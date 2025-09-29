# Task: Update Python Tests

## Status: Created
## Parent Task: task-epic-11.102.3

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.3-Update-Python-capture-logic.md`
2. Read the complete "Python Feature → NormalizedCapture Mapping Plan" section
3. Use the Python-specific rules as test cases
4. Test visibility inference from naming conventions

## File
`packages/core/src/parse_and_query_code/language_configs/python.test.ts`

## Implementation Checklist
- [ ] Remove tests for deprecated fields (parameter_name, return_type, __all__ handling)
- [ ] Add tests for type_name field (return types, parameter types, variable types)
- [ ] Test visibility from naming conventions
- [ ] Test decorator-based modifiers
- [ ] Test Protocol/ABC trait_type
- [ ] Test async/generator detection
- [ ] Test import patterns (9 fields: 4 import + 3 export + 2 definition)
- [ ] Verify non-null context
- [ ] Verify parameter names captured in symbol_name, not context
- [ ] 100% coverage