---
id: task-72
title: Support ES6 exports in .js files and new TypeScript extensions
status: To Do
assignee: []
created_date: '2025-08-02'
updated_date: '2025-08-04 13:29'
labels: []
dependencies:
  - task-30
---

## Description

Add support for ES6 export syntax in .js files and recognize new TypeScript file extensions like .mts (ES modules) and .cts (CommonJS modules). Currently, .js files are parsed with the JavaScript parser which doesn't recognize ES6 export syntax, and .mts/.cts extensions are not recognized at all.

## Acceptance Criteria

- [ ] Detect ES6 `export` syntax in .js files
- [ ] Support .mts extension (TypeScript ES modules)
- [ ] Support .cts extension (TypeScript CommonJS modules)
- [ ] Support .mjs extension (JavaScript ES modules)
- [ ] Support .cjs extension (JavaScript CommonJS modules)
- [ ] Maintain backward compatibility with existing .js parsing
- [ ] Choose appropriate parser based on file content or configuration


## Implementation Notes

Moved to epic task-100.9 as part of validation accuracy improvements. Needed for ES6 export support in .js files.
## Technical Context

Current limitations:

- .js files use JavaScript parser (no ES6 export support)
- .mts/.cts extensions not recognized
- No dynamic parser selection based on syntax

File extension meanings:

- .mts - TypeScript ES module
- .cts - TypeScript CommonJS module  
- .mjs - JavaScript ES module
- .cjs - JavaScript CommonJS module

## Potential Approaches

1. **Syntax detection**: Analyze file content to detect ES6 syntax and switch parsers
2. **Configuration-based**: Add project/file configuration to specify module type
3. **Extension mapping**: Map new extensions to appropriate parsers
4. **Unified parser**: Use TypeScript parser for all JavaScript (may have compatibility issues)

## Test Cases

```javascript
// test.js - should detect ES6 exports
export function modernJS() {}
export const value = 42;

// test.mts - should parse as TypeScript
export function typeScriptModule(): string {
  return "mts file";
}

// test.mjs - should parse as ES module
export default class ESModule {}
```

## Risks

- Breaking changes to existing JavaScript parsing
- Performance impact of syntax detection
- Complexity of maintaining multiple parser configurations
