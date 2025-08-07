---
id: task-10
title: Add Ruby language support
status: To Do
assignee: []
created_date: '2025-07-08'
labels:
  - feature
  - language-support
dependencies: []
---

## Description

Implement Ruby language support for the tree-sitter code intelligence system. Ruby is a dynamic language with focus on simplicity and productivity, featuring blocks and metaprogramming.

## Acceptance Criteria

- [ ] Install tree-sitter-ruby parser
- [ ] Create Ruby language configuration
- [ ] Copy scope queries from bloop server
- [ ] Handle Ruby-specific features: blocks and procs
- [ ] Handle Ruby-specific features: modules and mixins
- [ ] Handle Ruby-specific features: metaprogramming
- [ ] Handle Ruby-specific features: symbols
- [ ] Handle Ruby-specific features: class reopening
- [ ] Add full test coverage. Include the test cases the relevant language bloop server code (mod.rs)
- [ ] Update documentation
