---
id: task-7
title: Add C++ language support
status: To Do
assignee: []
created_date: '2025-07-08'
labels:
  - feature
  - language-support
dependencies: []
---

## Description

Implement C++ language support for the tree-sitter code intelligence system. C++ extends C with object-oriented features, templates, and modern language constructs.

## Acceptance Criteria

- [ ] Install tree-sitter-cpp parser
- [ ] Create C++ language configuration
- [ ] Copy scope queries from bloop server
- [ ] Handle C++-specific features: classes and inheritance
- [ ] Handle C++-specific features: templates and template specialization
- [ ] Handle C++-specific features: namespaces
- [ ] Handle C++-specific features: operator overloading
- [ ] Handle C++-specific features: references and rvalue references
- [ ] Add full test coverage. Include the test cases the relevant language bloop server code (mod.rs)
- [ ] Update documentation
