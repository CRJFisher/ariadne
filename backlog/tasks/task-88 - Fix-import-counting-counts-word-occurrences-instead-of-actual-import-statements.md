---
id: task-88
title: >-
  Fix import counting - counts word occurrences instead of actual import
  statements
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The import counting in file summaries is fundamentally broken. It counts occurrences of the word 'import' rather than actual import statements. For example, graph.ts shows 27 imports but only has 2 actual import statements.

## Acceptance Criteria

- [ ] Import count matches actual import statements in files
- [ ] Only counts import declarations not word occurrences
- [ ] File summaries show accurate import counts

## Implementation Notes

Test cases from validation:
- src/graph.ts: Reports 27 imports but only has 2 actual import statements (lines 1-2)
- src/types.ts: Reports 10 imports but only has 2 actual import statements
- The system is counting occurrences of the word 'import' in comments and strings rather than actual import declarations

Example from graph.ts:
Line 1: import { Tree } from 'tree-sitter';
Line 2: import { Point, SimpleRange, Edit, LanguageConfig } from './types';
Total actual imports: 2
Reported imports: 27
