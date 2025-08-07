---
id: task-epic-10-language-expansion.1
title: Create Language-Feature-Testing Matrix Framework
status: To Do
assignee: []
created_date: "2025-08-06 14:36"
labels:
  - refactoring
  - framework
  - languages
dependencies: []
parent_task_id: task-epic-10-language-expansion
---

## Description

Design and implement a systematic framework for adding new language support with consistent feature coverage and testing. This matrix approach will ensure all languages support the same core features with comprehensive test coverage.

## Acceptance Criteria

- [ ] Language configuration architecture designed
- [ ] Feature capability matrix defined (Language × Feature × Test) - `src/feature_registry.ts`
- [ ] Language addition template created
- [ ] Testing requirements documented per feature - Started with namespace imports
- [ ] Existing languages analyzed for patterns - See `docs/FEATURE_MATRIX_MIGRATION.md`
- [ ] Automated compliance validator created
- [ ] Document the new folder structure in a new @rules/folder-structure.md file
- [ ] Document the new testing framework in a new @rules/testing.md file

## Implementation Notes

### Progress (Started 2025-08-06)

Initial implementation begun with simpler approach - no registry needed:

- Created `src/import_resolution/namespace_imports/` - Example of new structure for namespace import feature
- Created `docs/FEATURE_MATRIX_MIGRATION.md` - Migration plan and gap analysis
- Created `scripts/discover_features.ts` - Script to scan folder structure and generate matrices
- Created `rules/folder-structure-migration.md` - Complete guidelines for the new structure

Key insight: The folder structure IS the registry - test file existence indicates language support. No separate registry to maintain!

### Folder Structure

### Case 1

Most features will be supported by every language and so these follow the structure:

- /src/[feature]/[sub-feature]
  - .../[sub-sub-feature].ts // the main feature file covering all the multi-language functionality
  - .../[sub-sub-feature].javascript.ts // the language-specific implementation for javascript
  - .../[sub-sub-feature].python.ts // the language-specific implementation for python
  - .../[sub-sub-feature].rust.ts // the language-specific implementation for rust
  - .../[sub-sub-feature].test.ts // this test file defines all the main cases we should cover for this feature, exported as an interface that the language-specific test files will implement
  - .../[sub-sub-feature].python.test.ts // the language-specific test file for python
  - .../[sub-sub-feature].javascript.test.ts // the language-specific test file for javascript
  - .../[sub-sub-feature].rust.test.ts // the language-specific test file for rust
  - ...

#### Questions

- Main code:
  - How to 'override'/intercept the feature processing with a language-specific implementation?
- Testing:
  - How to ensure that the language-specific test files are covering all the cases?

### Case 2

This will allow us to run a script to generate the language-specific test files from the main test file and then quickly measure the test coverage for each feature and language.

For highly language-specific features, we will have a folder structure like this:

- /src/[feature]/[sub-feature]/[language]
  - .../[sub-sub-feature].ts
  - .../[sub-sub-feature].test.ts
  - ...

So when adding support for a new feature, it's important to consider if it's common to all languages or if it's language-specific.

> N.B. - the above should be inlcuded in the output documentation, rules etc
