---
id: task-5
title: Add Go language support
status: To Do
assignee: []
created_date: '2025-07-08'
labels:
  - feature
  - language-support
dependencies: []
---

## Description

Implement Go language support for the tree-sitter code intelligence system. Go is a statically typed language with unique features like goroutines and channels.

## Acceptance Criteria

- [ ] Install tree-sitter-go parser
- [ ] Create Go language configuration
- [ ] Copy scope queries from bloop server
- [ ] Handle Go-specific features: goroutines and channels
- [ ] Handle Go-specific features: interfaces and type embedding
- [ ] Handle Go-specific features: package system
- [ ] Handle Go-specific features: defer statements
- [ ] Handle Go-specific features: multiple return values
- [ ] Add full test coverage. Include the test cases the relevant language bloop server code (mod.rs)
- [ ] Update documentation
