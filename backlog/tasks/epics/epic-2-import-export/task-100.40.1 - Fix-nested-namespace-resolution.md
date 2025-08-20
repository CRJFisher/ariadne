---
id: task-100.40.1
title: Fix nested namespace resolution through re-exports
status: To Do
assignee: []
created_date: '2025-08-20 11:40'
labels: [bug, namespace-imports, javascript]
dependencies: []
parent_task_id: task-100.40
---

## Description

Nested namespace resolution fails when accessing members through re-exported namespaces. The resolution returns `<builtin>` file path instead of the actual source file.

## Reproduction Scenario

```javascript
// utils/string.js
export function capitalize(str) { 
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// utils/index.js  
import * as string from './string';
export { string };

// app.js
import * as utils from './utils';
function format(text) {
  return utils.string.capitalize(text);  // Should resolve to utils/string.js
}
```

## Current Behavior
- The `capitalize` function is found but shows `file_path: '<builtin>'`
- The resolution doesn't properly follow the chain through the re-exported namespace

## Expected Behavior
- Should resolve to `file_path: 'utils/string.js'`
- Should properly trace through the re-export chain

## Acceptance Criteria

- [ ] Nested namespace member access resolves to the correct source file
- [ ] Re-exported namespaces are properly traced through intermediate files
- [ ] Test `JavaScript Namespace Imports > Resolves nested namespace member access` passes

## Implementation Notes

The issue is likely in `resolve_common_nested_namespace` in `namespace_imports.ts`. It needs to:
1. Recognize when a namespace is actually a re-export
2. Follow the re-export chain to find the actual implementation
3. Maintain the correct file path through the resolution chain

## Test Location
`packages/core/src/import_resolution/namespace_imports.javascript.test.ts` - currently skipped