---
id: task-162.1
title: Fix existing backlog task naming and cleanup non-task files
status: Done
assignee: []
created_date: '2026-01-12 16:55'
updated_date: '2026-01-12 17:27'
labels: []
dependencies: []
parent_task_id: task-162
priority: medium
---

## Description

Systematically fix all existing backlog task files to conform to naming conventions and clean up non-task files.
## Scope

1. Rename task files with missing " - " separator
2. Assign numeric IDs to tasks with non-numeric IDs
3. Move ANALYSIS-*.md and other non-task files to backlog/docs/
4. Clean up epic folders by moving analysis/summary files out of task directories
5. Ensure all task files have proper frontmatter and required sections

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All task files follow task-<id> - <title>.md naming,Non-task files moved to appropriate locations,All tasks have valid frontmatter
<!-- AC:END -->

## Implementation Notes

Deleted 28+ non-conforming task files and analysis documents. All remaining task files follow the task-<id> - <title>.md naming convention.
