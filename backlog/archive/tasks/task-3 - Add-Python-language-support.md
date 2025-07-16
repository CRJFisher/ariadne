---
id: task-3
title: Add Python language support
status: Done
assignee:
  - '@chuck'
created_date: '2025-07-08'
updated_date: '2025-07-09'
labels:
  - feature
  - enhancement
dependencies: []
---

## Description

Implement Python language support following the language configuration guide. Python is a widely-used language and would demonstrate the multi-language capabilities of the system.

## Acceptance Criteria

- [x] Install tree-sitter-python parser
- [x] Create Python language configuration
- [x] Write comprehensive scope queries for Python
- [x] Handle Python-specific features: indentation-based scoping
- [x] Handle Python-specific features: class definitions and inheritance
- [x] Handle Python-specific features: decorators
- [x] Handle Python-specific features: import system
- [x] Handle Python-specific features: global and nonlocal keywords
- [x] Add full test coverage. Include the test cases the relevant language bloop server code (mod.rs)
- [x] Update documentation


## Implementation Plan

1. Install tree-sitter-python parser dependency
2. Create Python language configuration with basic metadata
3. Implement Python-specific scope query rules:
   - Handle indentation-based scoping  
   - Support class definitions and inheritance
   - Handle decorators properly
   - Implement import system scoping
   - Support global/nonlocal keywords
4. Test with Python code samples from bloop server
5. Add comprehensive unit tests
6. Update documentation with Python example
## Implementation Notes

Reference implementation sketch is already in the language configuration documentation. This will be a good test of the language abstraction. Key differences from TypeScript: indentation-based syntax, dynamic typing, different import system, special scoping rules (global, nonlocal), everything is an object.

Successfully implemented Python language support with comprehensive scope query rules. Added support for all major Python constructs including functions, classes, imports, type annotations, comprehensions, decorators, and Python-specific features like global/nonlocal keywords and the walrus operator. All acceptance criteria have been met with full test coverage. Updated README to reflect Python as a supported language.
