---
id: task-155
title: Fix property chain resolution for method calls
status: To Do
assignee: []
created_date: '2025-10-23 13:12'
labels: []
dependencies: []
priority: high
---

## Description

Implement full property chain resolution to detect calls like this.definitions.update_file() and reduce false entry points from ~135 to expected ~10-20
