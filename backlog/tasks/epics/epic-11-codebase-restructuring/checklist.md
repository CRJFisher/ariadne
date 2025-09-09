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
