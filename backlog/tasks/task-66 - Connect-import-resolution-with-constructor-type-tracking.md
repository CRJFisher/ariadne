---
id: task-66
title: Connect import resolution with constructor type tracking
status: To Do
assignee: []
created_date: '2025-08-02'
labels:
  - enhancement
  - call-graph
  - import-resolution
dependencies:
  - task-65
---

## Description

Integrate the import resolution system with variable type tracking so that when a variable is assigned new ImportedClass(), the system knows it's an instance of the imported class. Currently, import information and type tracking are completely separate systems.

## Acceptance Criteria

- [ ] Constructor calls on imported classes are tracked with correct type
- [ ] Type information includes source file of the class definition
- [ ] Imported class types are resolved across file boundaries
- [ ] Works with renamed imports (import { Foo as Bar })
- [ ] Tests verify import-aware type tracking
- [ ] Documentation updated with new capability
