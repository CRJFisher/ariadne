---
id: task-71
title: Support CommonJS property assignment exports
status: To Do
assignee: []
created_date: '2025-08-02'
updated_date: '2025-08-04 13:29'
labels: []
dependencies:
  - task-30
---

## Description

Add support for CommonJS export pattern `module.exports.name = value` where exports are assigned as properties rather than as an object literal. This pattern is commonly used in Node.js modules but is not currently detected by our export detection system.

## Acceptance Criteria

- [ ] Detect `module.exports.propertyName = identifier` patterns
- [ ] Match the exported property name to the corresponding definition
- [ ] Handle mixed patterns (both object literal and property assignment in same file)
- [ ] Support both `module.exports.x` and `exports.x` patterns
- [ ] Maintain performance - avoid O(n²) reference-to-definition matching


## Implementation Notes

Moved to epic task-100.9 as part of validation accuracy improvements. Needed for better export detection.
## Technical Context

Currently, we detect:

- `module.exports = { func1, func2 }` ✓
- `exports.func1 = func1` ✓

We need to also detect:

- `module.exports.func1 = func1` ✗

The challenge is that the property assignment creates a reference that needs to be matched with the definition by name, which requires cross-reference resolution beyond what tree-sitter queries can express.

## Potential Approaches

1. **Post-processing pass**: After collecting exports, match reference names to definition names
2. **Enhanced scope queries**: Capture the full assignment and extract both sides
3. **Code-based analysis**: Parse the assignment AST nodes directly

## Test Case

```javascript
function helper() {}
function utility() {}

module.exports.helper = helper;
module.exports.utility = utility;
```

Both `helper` and `utility` should be marked as exported.
