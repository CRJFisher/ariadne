# Changes Notes

## TypeScript Compilation Status (2025-10-01)

✅ **All packages compile cleanly with no TypeScript errors**

- `@ariadnejs/types`: ✅ Passing typecheck
- `@ariadnejs/core`: ✅ Passing typecheck
- `@ariadnejs/mcp`: ✅ Passing typecheck

Added `typecheck` script to root package.json for convenience.

Test coverage verification:
- TypeScript semantic_index tests: 25/25 passing (100%)
- All packages build successfully
- No regressions introduced

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

- When performing all symbol_resolution, we should have a pattern of matching SymbolName's from the most local scope first, then the next most local scope, etc. until we find a match.
- The 'visibility' defined in semantic_index processing should be limited to any 'extra' attributes present in the language e.g. TS `export` and Rust `pub`. The symbol_resolution should have some language-specific code to determine which symbols are export-able in each file (based on scope + visibility attributes and language visibility rules).

## Query Capture naming convention

- The first two parts of the capture name are category and entity. That's followed by any further parts which are used for additional context.
  - TODO: this isn't enforced yet but it is essential
