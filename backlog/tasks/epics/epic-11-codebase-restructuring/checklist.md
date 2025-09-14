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
  - Make sure all tests use the standard `.scm` files in `packages/core/src/scope_analysis/scope_tree/queries/` so that we're checking
- Types
  - For constructed string types (e.g. symbols etc) use 'branded' types e.g. `type Symbol = string & { __brand: 'Symbol' }` and include creator and parser functions for the type
- AST parsing
  - Position/Location
    - use `node_to_location` to convert tree-sitter node positions to Location (which is 1-indexed)

## Checks

- Run linter / compiler to check for errors
- Remove all files that aren't connected to the top-level functionality - a lot of functions have been gradually added in but are just technical debt
- Make sure all publically visible types are defined in the `types` package

## Epic 11 specific

- The file naming is a bit off - `.bespoke` and `.generic` suffixes are being used but should be dropped
- So many redundant functions. These need to be removed.
  - We could first get the tool working again and then use the tool to help with these refactorings.

```
please now work on task 11.94 - perform the refactoring as per                     │
│   @backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md.\        │
│   ensure comprehensive test coverage and that by the end, all tests pass for this    │
│   module -- ultrathink

please now verify:\                                                                │
│   - the tsx compilation shows everything is working in all the files in this         │
│   module\                                                                            │
│   - there aren't any extra functions that we don't need. every function should be    │
│   ultimately being used by a top-level module (code_graph.ts or file_analyzer.ts or  │
│   another module).\                                                                  │
│   - for the remaining, used functions, there should be comprehensive testing and     │
│   the tests should pass 100%\                                                        │
│   ultrathink

the file namings are wrong - please check this spec and make sure they conform to  │
│   it - there should be no `.bespoke` or `.generic` -- ultrathink
don't create that naming convention file. instead create a file at                 │
│   rules/folder-structure-migration.md that describes this folder structure and also  │
│   add a summary to @CLAUDE.md by where it mentions                                   │
│   rules/folder-structure-migration.md

this file is full of functions that aren't actually used outside of the module -   │
│   why did you create all these unnecessary functions? they are a big nuisance and    │
│   add a lot of technical debt. please fix this and then add a section to @CLAUDE.md  │
│   to remind you to never create "extra" functions that _might_ be useful one day -   │
│   all functions should be ultimately be called by a top-level function/module --     │
│   ultrathink

please double check all the language-specific tests are comprehensive and passing  │
│   100%

please continue to work on fixing the code/tests until *all* tests are passing --  │
│   ultrathink
```
