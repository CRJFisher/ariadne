---
id: task-56
title: Add class inheritance and interface analysis to core
status: To Do
assignee: []
created_date: '2025-07-30'
labels: []
dependencies: []
---

## Description

Add APIs to analyze class inheritance chains (extends) and interface implementations. This would enable MCP tools to provide complete class relationship information including parent classes, implemented interfaces, and inheritance hierarchies.

## Acceptance Criteria

- [ ] API to get parent class for a class definition
- [ ] API to get implemented interfaces for a class
- [ ] API to find all classes extending a given class
- [ ] API to find all classes implementing a given interface
- [ ] Tests for inheritance analysis across languages
