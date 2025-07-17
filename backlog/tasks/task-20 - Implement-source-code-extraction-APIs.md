---
id: task-20
title: Implement source code extraction APIs
status: To Do
assignee: []
created_date: '2025-07-17'
labels: []
dependencies: []
---

## Description

Add methods to extract source code for definitions, including context like docstrings and decorators. This enables Code Charter to send accurate function implementations to LLMs for summarization.

## Acceptance Criteria

- [ ] Project.get_source_code() returns exact source for a definition
- [ ] Project.get_source_with_context() returns source with docstring and decorators
- [ ] Context extraction handles Python docstrings correctly
- [ ] Context extraction handles Python decorators correctly
- [ ] Methods handle malformed or missing source gracefully
- [ ] Unit tests verify source extraction accuracy

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
