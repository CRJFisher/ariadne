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

## Move to AST queries which aren't documented in tasks

- type_tracking.ts
  - `process_file_for_types`

## Why are we collecting `variables` in file_analyzer?

- We could use them to track function references and include them in the call graph

## Duplication

- ModuleGraph seems to do lots of import/export e.g. ImportedModule, ExportedSymbol etc

## Enhancements

- `namespace_resolution.ts` is misnamed. it now just deals with cross-file resolution.
  - Could this be a useful enhancement?

## Misnamings

- `usage_finder.ts` is misnamed. it now just deals with finding the caller of a call.

## Usage of ScopeTree

- When performin all symbol_resolution, we should have a pattern of matching SymbolName's from the most local scope first, then the next most local scope, etc. until we find a match.
