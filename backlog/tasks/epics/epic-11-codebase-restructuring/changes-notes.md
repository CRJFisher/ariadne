# Changes Notes

## What do we actually need?

- CodeGraph with list of top-level nodes (Call-able entities which aren't referenced by other entities)
  - Functions, Classes, Modules

## Duplication issues

- SymbolIndex vs GlobalSymbolRegistry

## Refactors to make

- resolve_references_to_symbols
  - The `ResolutionResult` usage of `Location` -> `ResolvedReference` seems weird.
  - Do we need this extra `ResolvedReference` type?

## Move to AST queries which aren't documented in tasks:

- type_tracking.ts
  - `process_file_for_types`
