---
id: task-159
title: Handle Python __all__ declaration for wildcard import resolution
status: To Do
assignee: []
created_date: '2025-11-05 13:30'
labels: []
dependencies: []
priority: medium
---

## Description

Python's __all__ module-level variable controls which symbols are exported during wildcard imports (from module import *). Currently, our reference resolution may not respect this constraint.

When a module defines __all__ = ["foo", "bar"], only those symbols should be resolved when another module does `from module import *`.

This affects:
- Reference resolution in resolve_references.ts
- Symbol visibility and export tracking
- Call graph accuracy when wildcard imports are used
