# Refactoring

## Planning Process

- When refactoring, start by adding a sub-task that will hold the refactoring plan.
  - The planning should always consider the @rules/coding.md file.
  - Update the task doc with the refactoring plan and create a list of sub-tasks.
  - Typically, the final refactoring sub-tasks will be:
    - Check the @rules/language-support.md file if there are any language-specific features that need to be considered
    - Check the @rules/testing.md
    - **NEW**: Follow @rules/folder-structure-migration.md for code organization

## Core Principles

- Generally, we don't support backwards compatibility, so don't leave old patterns around - move boldly forwards with new patterns. This is a very new library and we don't want to be tied to old patterns that will litter the codebase.
- When you touch a feature, consider migrating it to the new structure
- All new features MUST follow the new folder structure from the start
