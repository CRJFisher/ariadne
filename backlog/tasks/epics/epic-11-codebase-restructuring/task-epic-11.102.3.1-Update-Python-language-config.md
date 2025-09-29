# Task: Update Python Language Config

## Status: Created
## Parent Task: task-epic-11.102.3

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.3-Update-Python-capture-logic.md`
2. Read the complete "Python Feature → NormalizedCapture Mapping Plan" section
3. Pay special attention to visibility inference from naming conventions
4. Note that decorators go in context, NOT modifiers

## File
`packages/core/src/parse_and_query_code/language_configs/python.ts`

## Implementation Checklist
- [ ] Map naming to visibility (_private, __private)
- [ ] Handle decorators (@staticmethod, @classmethod, @abstractmethod)
- [ ] Map Protocol/ABC to trait_type
- [ ] Remove __all__ specific handling and other deprecated fields (parameter_name, return_type)
- [ ] Replace return_type with generic type_name field
- [ ] Simplify import/from/as handling to 9 context fields (4 import + 3 export + 2 definition)
- [ ] Add async/generator detection
- [ ] Ensure parameter names captured in symbol_name, not context

## Key Mappings
```typescript
// Visibility from naming
visibility: name.startsWith('__') ? 'private' :
           name.startsWith('_') ? 'internal' : 'public'

// Decorator handling
is_abstract: hasDecorator(node, 'abstractmethod')
// @staticmethod/@classmethod handled via inference

// Type annotation handling
type_name: extractTypeHint(node) // For return types, parameters, variables
```