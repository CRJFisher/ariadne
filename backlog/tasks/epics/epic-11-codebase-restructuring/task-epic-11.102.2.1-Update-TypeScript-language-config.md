# Task: Update TypeScript Language Config

## Status: Created
## Parent Task: task-epic-11.102.2

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.2-Update-TypeScript-capture-logic.md`
2. Read the complete "TypeScript Feature → NormalizedCapture Mapping Plan" section
3. Keep the mapping tables open for reference during implementation
4. Follow the mappings EXACTLY as specified - do not deviate

## File
`packages/core/src/parse_and_query_code/language_configs/typescript.ts`

## Implementation Checklist
- [ ] Remove type system modifiers (generics, type parameters, etc.)
- [ ] Map visibility keywords to enum (public/private/protected)
- [ ] Map abstract keyword to is_abstract
- [ ] Map interface methods to trait_type: 'interface'
- [ ] Remove type-only import/export handling
- [ ] Simplify context to 9 fields (4 import + 3 export + 2 definition)
- [ ] Remove parameter_name field (captured in symbol_name instead)
- [ ] Replace return_type with generic type_name field
- [ ] Add static method inference logic

## Key Changes
```typescript
// Remove these modifiers and context fields
is_generic, is_type_only, type_parameters, is_const_generic, parameter_name, return_type

// Add visibility mapping
visibility: node.has('private') ? 'private' :
           node.has('protected') ? 'protected' : 'public'

// Add trait detection
trait_type: isInterface(node) ? 'interface' : null

// Replace return_type with generic type_name
type_name: extractTypeInfo(node) // For return types, parameter types, variable types
```