---
id: task-20
title: Implement source code extraction APIs
status: Done
assignee:
  - '@chuck'
created_date: '2025-07-17'
updated_date: '2025-07-17'
labels: []
dependencies: []
---

## Description

Add methods to extract source code for definitions, including context like docstrings and decorators. This enables Code Charter to send accurate function implementations to LLMs for summarization.

## Acceptance Criteria

- [x] Project.get_source_code() returns exact source for a definition
- [x] Project.get_source_with_context() returns source with docstring and decorators
- [x] Context extraction handles Python docstrings correctly
- [x] Context extraction handles Python decorators correctly
- [x] Methods handle malformed or missing source gracefully
- [x] Unit tests verify source extraction accuracy

## Proposed API from Enhancement Proposal

```typescript
class Project {
    // Get source code for a definition
    get_source_code(def: Def): string;
    
    // Get source with context (includes docstring before function)
    get_source_with_context(def: Def, context_lines?: number): {
        source: string;
        docstring?: string;
        decorators?: string[];
    };
}
```

## Code Charter Use Cases

- **LLM Summarization**: Extract exact function implementations to send to language models
- **Docstring Extraction**: Get documentation to provide context for summarization
- **Decorator Analysis**: In Python, understand function behavior modifications

## Implementation Plan

1. Add get_source_code() method to extract exact source for a definition
2. Implement source extraction using definition ranges
3. Add get_source_with_context() method for extended extraction
4. Implement docstring detection logic for different languages
5. Implement decorator detection for Python
6. Handle edge cases (missing files, invalid ranges)
7. Write comprehensive unit tests for all scenarios

## Implementation Notes

Implemented both source extraction methods with comprehensive functionality:

**get_source_code(def: Def, file_path: string): string**
- Modified to accept file_path as parameter since Def interface doesn't include it
- Uses tree-sitter AST traversal to find enclosing function/method nodes
- Handles function declarations, method definitions, arrow functions, and generators
- Extracts exact source code including full function body
- Returns empty string for missing files or invalid ranges

**get_source_with_context(def: Def, file_path: string, context_lines?: number)**
- Returns object with source, docstring, and decorators
- Python docstring extraction: Handles both single-line and multi-line docstrings inside functions
- JSDoc extraction: Parses /** */ comments before TypeScript/JavaScript functions
- Python decorator extraction: Collects all @decorator lines before function definitions
- Context lines feature: Includes surrounding code based on context_lines parameter
- Gracefully handles edge cases with empty returns

**Technical Decisions:**
- Used AST node traversal instead of simple range extraction to get full function bodies
- Implemented language-specific docstring/decorator detection logic
- Added file_path parameter to both methods for consistency
- Comprehensive test suite with 14 tests covering all scenarios

All tests passing in source_extraction.test.ts.
