---
id: task-100.20
title: Create dedicated ImportResolver service
status: To Do
assignee: []
created_date: '2025-08-05 21:16'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Extract all import resolution logic into a dedicated service to clarify ownership and eliminate circular dependencies. Currently import resolution logic is scattered across QueryService and NavigationService, leading to unclear responsibilities and potential circular dependencies between services.

## Acceptance Criteria

- [ ] New ImportResolver service created with clear interface
- [ ] All import resolution logic moved from QueryService/NavigationService to ImportResolver
- [ ] Clear interface with methods: resolveImport()
- [ ] getImportsWithDefinitions()
- [ ] resolveModulePath()
- [ ] No circular dependencies between services after refactoring
- [ ] ImportResolver service properly injected into dependent services
