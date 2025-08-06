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

## Naming Rules

- Use pythonic naming conventions- snake_case for all typescript names (variables, functions, files, etc.) other than class names which should be PascalCase.
