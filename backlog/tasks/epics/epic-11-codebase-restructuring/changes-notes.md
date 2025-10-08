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

- When performing all symbol_resolution, we should have a pattern of matching SymbolName's from the most local scope first, then the next most local scope, etc. until we find a match.
- The 'visibility' defined in semantic_index processing should be limited to any 'extra' attributes present in the language e.g. TS `export` and Rust `pub`. The symbol_resolution should have some language-specific code to determine which symbols are export-able in each file (based on scope + visibility attributes and language visibility rules).

## Query Capture naming convention

- The first two parts of the capture name are category and entity. That's followed by any further parts which are used for additional context.
  - TODO: this isn't enforced yet but it is essential

## Code that breaks call-graph detection

- Language config objects that are a map to a function can't be resolved into a call graph since the function ref->def resolution depends on runtime variables.
- Is there a better way to do this?
- Can we create a linter to detect this and fail the build?
- On the other hand, maybe this isn't actually a problem. As long as we can resolve the function references to their definitions via an assignment trail, we can still resolve them. Unfortunately (for simplicity) in these cases, there is just an explosion in downstream 'called' functions from a node which uses this pattern, but that is the truth of the code, and it shouldn't be verboten to have code like this.

## Improvements to Agent interactions

- Pre-audit the planning docs to see if there are any decision points that can be made up front or if there is a lack of specificity about which files should be edited etc
- Need to make knock-on consequences of editing a file explicit. Like a work hook.

### Work Hooks

#### Updating .scm files

- verify that the additions are in fact aligned with the core intention tree and aren't just adding 'extra' functionality for some unanticipated future use case
  - what is the 'target' object that you're adding to in the SemanticIndex (definition, reference, scope)?
  - does the addition of this language feature to the target object _directly_ align with the core intention tree?
- update the relevant .scm file for the language. make sure the capture naming convention is followed: `@category.entity.additional.qualifiers` - `category` is of type `SemanticCategory` and `entity` is of type `SemanticEntity`.
- update the relevant `language_configs/<language>_builder.ts` file to match the new capture names.
- add tests to `language_configs/<language>_builder.test.ts` to verify that the new capture names are parsed correctly.
- _if_ the capture is adding a new property to a target object, we need to make sure there is a plan for _using_ it in the downstream processing, typically in the `packages/core/src/resolve_references` module.

## 3rd party function calls

- How does our call-graph detection handle function references being passed to 3rd party functions which call them? E.g. pd.DataFrame.pipe(our_function_def) - `our_function_def` wouldn't be marked as being called but it certainly is.
  - Maybe we could treat function references being passed to 3rd party functions which call them as a special case. We could assume they are called and treat them as such.

## Large-scale refactoring

- Re-add `project` level objects to control overall lifecycle of processing the code, enabling files to be updated individually, re-processing only the changed files / symbols.
  - Re-processing should be debounded and somewhat lazy i.e. don't bother processing a file while its being edited unless a request comes in, at which point we should process the file and update the cache before returning the result.
- Analyse how we can add persistance to the processing pipeline, caching the results and then invalidating the cache when the code changes.
- Create a 3rd, middle layer of processing which handles preparing the raw, semantic-index data for the symbol_resolution phase.
  - the 3 type processing steps currently in semantic_index
  - the helper maps e.g. scope->symbol-name->symbol-id (scope_to_definitions)
  - ...
- Rewrite MCP server
