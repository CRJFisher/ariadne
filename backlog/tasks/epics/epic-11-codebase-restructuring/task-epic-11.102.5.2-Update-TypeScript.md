# Task: Update TypeScript for Direct Definition Builders

## Status: Created

## Parent Task

task-epic-11.102.5 - Update Language Configs

## Objective

Update TypeScript language support to use the new direct definition builder system, removing all NormalizedCapture dependencies.

## Sub-tasks

1. **Update Language Config** (102.5.2.1)
   - Convert to builder pattern
   - Handle TypeScript-specific features (interfaces, types, generics)
   - Direct Definition creation

2. **Update Query File** (102.5.2.2)
   - Clean up typescript.scm
   - Add interface and type captures
   - Handle decorators and generics

3. **Update Tests** (102.5.2.3)
   - Fix language config tests
   - Test TypeScript-specific features
   - Ensure comprehensive field coverage

## TypeScript-Specific Requirements

- **Interfaces** - Full interface definitions with methods and properties
- **Type aliases** - Type definitions and aliases
- **Enums** - Enum definitions with members
- **Namespaces** - Module/namespace definitions
- **Decorators** - Class, method, property decorators
- **Generics** - Type parameters on classes, functions, interfaces
- **Access modifiers** - public, private, protected, readonly
- **Abstract classes** - Abstract class and method definitions

## Success Criteria

- [ ] TypeScript config uses builder pattern
- [ ] All TypeScript-specific features captured
- [ ] Query file contains only necessary captures
- [ ] All TypeScript tests pass
- [ ] 100% coverage of processed fields

## Dependencies

- task-epic-11.102.1, 102.2, 102.3 (Builder systems exist)
- task-epic-11.102.4 (Old types removed)

## Estimated Effort

~4 hours total (more complex than JavaScript)