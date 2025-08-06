# Coding Standards

## Coding Style

- I prefer a functional style of coding.
- Classes should be for holding immutable data. Functions should be for performing actions.
- _Never_ use stateful classes.

## Refactoring ethos

- Generally, we don't support backwards compatibility, so don't leave old patterns around - move boldly forwards with new patterns. This is a very new library and we don't want to be tied to old patterns that will litter the codebase.

## Naming Rules

- Use pythonic naming conventions- snake_case for all typescript names (variables, functions, files, etc.) other than class names which should be PascalCase.
