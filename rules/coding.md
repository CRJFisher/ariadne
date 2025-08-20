# Coding Standards

## File Organization

- **Keep files small and focused** - each file should support a single piece of functionality
- **Hard limit: 32KB per file** - tree-sitter cannot parse larger files
- **Split large modules** - prefer multiple small files over monolithic ones
- **Group related functionality** - use directories to organize related files

## Coding Style

- Prefer a functional style of coding.
- Classes should be for holding immutable data. Functions should be for performing actions.
- _Never_ use stateful classes.
- Prefer short, focussed functions. As soon as there control flow with multi-line processing, consider splitting the function into multiple smaller functions.

## Naming Rules

- Use pythonic naming conventions- snake_case for all typescript names (variables, functions, files, etc.) other than class names which should be PascalCase.

## Call Graph clarity

- We should avoid invoking function references dynamically i.e. based on some runtime variable. Instead, we should use regular control flow to invoke functions directly.
  - E.g. we shouldn't use a map with string keys to function references, then get function refs from this map based on some string variable.
