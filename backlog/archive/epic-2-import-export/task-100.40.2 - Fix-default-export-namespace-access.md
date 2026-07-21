---
id: task-100.40.2
title: Fix default export access through namespace imports
status: To Do
assignee: []
created_date: '2025-08-20 11:40'
labels: [bug, namespace-imports, javascript, es6-modules]
dependencies: []
parent_task_id: task-100.40
---

## Description

When importing a module with namespace syntax (`import * as module`), the default export should be accessible as `module.default`. Currently, this resolution fails.

## Reproduction Scenario

```javascript
// defaultExport.js
export default function defaultFunc() { 
  return 'default'; 
}
export function namedFunc() { 
  return 'named'; 
}

// app.js
import * as module from './defaultExport';
function use() {
  module.default();   // Should resolve to defaultFunc
  module.namedFunc(); // This works correctly
}
```

## Current Behavior
- `module.namedFunc()` resolves correctly
- `module.default()` fails to resolve to `defaultFunc`
- The test cannot find the default export function when accessed through the namespace

## Expected Behavior
- `module.default` should resolve to the default export function
- The function name should be correctly identified as `defaultFunc`

## Acceptance Criteria

- [ ] Default exports are accessible as the `default` property of namespace imports
- [ ] The actual function name is preserved in resolution
- [ ] Test `JavaScript-specific features > handles default export accessed through namespace` passes

## Implementation Notes

This is a JavaScript/TypeScript-specific feature. The issue is likely in:
1. `resolve_javascript_namespace_exports` in `namespace_imports.javascript.ts` - may not be mapping default exports correctly
2. The function needs to handle the special case where `default` is accessed as a property name

ES6 Module Specification: When using namespace imports, the default export becomes available as the `default` property of the namespace object.

## Test Location
`packages/core/src/import_resolution/namespace_imports.javascript.test.ts` - currently skipped