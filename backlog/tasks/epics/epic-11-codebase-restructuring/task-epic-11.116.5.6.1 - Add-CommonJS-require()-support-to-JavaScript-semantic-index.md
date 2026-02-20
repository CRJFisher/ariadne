---
id: task-epic-11.116.5.6.1
title: Add CommonJS require() support to JavaScript semantic index
status: Done
assignee: []
created_date: '2025-10-16 15:51'
updated_date: '2025-10-20 15:55'
labels: []
dependencies: []
parent_task_id: task-epic-11.116.5.6
priority: medium
---

## Description

The JavaScript semantic index query file (javascript.scm) currently only captures ES6 module imports (import/export) but does not capture CommonJS imports using require() calls.

This causes CommonJS imports to not be tracked in the imported_symbols map, preventing cross-file resolution for CommonJS modules.

Acceptance Criteria:
- [ ] Add tree-sitter query patterns to capture require() calls as import definitions
- [ ] Handle destructured require: const { helper } = require('./utils')
- [ ] Handle simple require: const utils = require('./utils')
- [ ] Handle require with member access: require('./utils').helper
- [ ] Update tests to verify CommonJS imports are captured
- [ ] Verify cross-file resolution works for CommonJS modules

Implementation Notes:
- Need to add patterns like:
  (call_expression
    function: (identifier) @import.require
    (#eq? @import.require "require")
    arguments: (arguments (string) @import.require.source)
  )
- Handle destructuring in variable_declarator with require call as value
- May need updates to import_processor.ts to handle require-style imports
