# Checklist

## General Patterns

- Language feature path splitting patterns.
  - Decide between / combine:
    - Language-specific identifiers + generic processing
    - Language needs specialised processing
- Coding
  - Move to immutable object creation
  - Remove optional fields where possible (lots are marked as optional but are actually always present)
  - Snake case module, function, variable names. Some pascal case has crept in.
- Testing
  - Make sure all tests use the standard `.scm` files in `packages/core/src/scope_queries` so that we're checking 
- Types
  - For constructed string types (e.g. symbols etc) use 'branded' types e.g. `type Symbol = string & { __brand: 'Symbol' }` and include creator and parser functions for the type

## Points to resolve

- There are a lot of strings that are constructed in certain, specific ways. We could have type aliases for these but the type linkage seems weak. Is there some way to strengthen the typing e.g. make it a class with the necessary fields and have a methods to construct and parse them? E.g. `const namespace_key = "${call.location.file_path}:${namespace}";` happens deep in the code. It's meaning is then lost on the downstream code.
  - Use branded types

## Configuration-Driven Refactoring Tasks

### Overview

Complete refactoring of 18 modules from language-specific implementations to configuration-driven pattern, following the recipe established in function_calls refactoring.

### Completed

- [x] **task-epic-11.80**: function_calls refactoring (70% code reduction achieved)
- [x] Create refactoring-recipe.md guide
- [x] Update Architecture.md with configuration-driven pattern
- [x] Create individual task files for all modules requiring refactoring


### High Priority - Call Graph Modules

- [ ] **task-epic-11.81**: Refactor method_calls module
- [ ] **task-epic-11.82**: Refactor constructor_calls module


### High Priority - Import/Export Modules
  
- [ ] **task-epic-11.83**: Refactor import_resolution module
- [ ] **task-epic-11.84**: Refactor export_detection module
- [ ] **task-epic-11.87**: Refactor namespace_resolution module


### Medium Priority - Inheritance Modules

- [ ] **task-epic-11.86**: Refactor class_detection module
- [ ] **task-epic-11.88**: Refactor class_hierarchy module
- [ ] **task-epic-11.89**: Refactor interface_implementation module
- [ ] **task-epic-11.90**: Refactor method_override module


### Medium Priority - Scope Analysis

- [ ] **task-epic-11.85**: Refactor scope_tree module
- [ ] **task-epic-11.91**: Refactor symbol_resolution module


### Lower Priority - Type Analysis

- [ ] **task-epic-11.92**: Refactor return_type_inference module
- [ ] **task-epic-11.93**: Refactor type_tracking module
- [ ] **task-epic-11.94**: Refactor parameter_type_inference module
- [ ] **task-epic-11.95**: Refactor type_propagation module
- [ ] **task-epic-11.96**: Refactor generic_resolution module


### Lower Priority - AST Utilities

- [ ] **task-epic-11.97**: Refactor member_access module


### Success Metrics

- [ ] Each module achieves 50%+ code reduction
- [ ] All tests pass after refactoring
- [ ] No functionality lost
- [ ] Consistent file structure across all modules
- [ ] Clear separation between configuration and bespoke logic
