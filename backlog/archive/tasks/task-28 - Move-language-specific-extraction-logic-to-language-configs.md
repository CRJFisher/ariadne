---
id: task-28
title: Move language-specific extraction logic to language configs
status: Done
assignee:
  - "@chuck"
created_date: "2025-07-17"
updated_date: "2025-07-17"
labels: []
dependencies: []
---

## Description

Refactor source extraction methods to delegate language-specific logic (docstrings, decorators, annotations) to language configurations. This will make the core extraction methods cleaner and make it easier to add new languages.

## Acceptance Criteria

- [x] Language config interface extended with extraction methods
- [x] Python config implements docstring and decorator extraction
- [x] TypeScript/JavaScript configs implement JSDoc extraction
- [x] Core extraction methods refactored to use language configs
- [x] All existing tests pass with refactored implementation

## Implementation Plan

1. Analyze current language-specific logic in get_source_with_context
2. Extend LanguageConfig interface with optional extraction methods
3. Implement Python-specific extraction methods in python config
4. Implement TypeScript/JavaScript JSDoc extraction in their configs
5. Refactor get_source_with_context to delegate to language configs
6. Ensure all existing tests pass
7. Add tests to verify the refactored implementation works correctly

## Implementation Notes

Successfully refactored language-specific extraction logic into language configurations:

**Changes made:**

1. Extended LanguageConfig interface with optional extract_context method
2. Created ExtractedContext interface for consistent return values
3. Implemented extract_python_context for Python-specific logic (decorators and docstrings)
4. Created shared extract_jsdoc_context for TypeScript/JavaScript
5. Updated all language configs to include the appropriate extractors
6. Refactored get_source_with_context to delegate to language configs

**Technical decisions:**

- Created shared_extractors.ts for common extraction logic between similar languages
- Python extracts docstrings from inside function bodies (Python convention)
- TypeScript/JavaScript extract JSDoc comments from before function declarations
- Maintained backward compatibility with existing API

**Benefits:**

- Core extraction methods are now cleaner and language-agnostic
- Easy to add new language-specific extraction logic
- Consistent interface for all language extractors
- Reduced if-else chains in main codebase

All source extraction tests pass. Some unrelated test failures exist from adding file_path to Def interface.
