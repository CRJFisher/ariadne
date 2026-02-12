---
id: task-185
title: 'Fix Category C false positives: Type[X] generic instantiation'
status: To Do
assignee: []
created_date: '2026-02-12 16:44'
labels: []
dependencies: []
---

## Description

1 false positive where a constructor parameter Type[X] is instantiated (e.g., uploader_class(profile).upload_to_qb()). Requires generic type parameter support to resolve the receiver type.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Type[X] generic parameters resolve to the correct class type,uploader_class(profile).upload_to_qb() resolves correctly
<!-- AC:END -->
