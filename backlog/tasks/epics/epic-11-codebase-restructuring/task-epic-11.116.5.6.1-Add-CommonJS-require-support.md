# Task epic-11.116.5.6.1: Add CommonJS require() support to JavaScript semantic index

**Status:** To Do
**Parent:** task-epic-11.116.5.6
**Priority:** Medium
**Created:** 2025-10-16

## Overview

The JavaScript semantic index query file (`javascript.scm`) currently only captures ES6 module imports (import/export) but does not capture CommonJS imports using `require()` calls.

This causes CommonJS imports to not be tracked in the `imported_symbols` map, preventing cross-file resolution for CommonJS modules.

## Problem

When running JavaScript integration tests, CommonJS module tests fail with:

```
FAIL: should resolve require() imports
  expected 0 to be greater than 0
  (imports.length === 0)

FAIL: should resolve cross-file function calls in CommonJS
  expected undefined to be defined
  (resolved_def is undefined)
```

Root cause: The query file [javascript.scm:188-206](../../packages/core/src/index_single_file/query_code_tree/queries/javascript.scm#L188-L206) only has patterns for ES6 imports:

```scheme
; Named imports
(import_specifier
  name: (identifier) @definition.import
)

; Default imports
(import_clause
  (identifier) @definition.import
)
```

But no patterns for CommonJS `require()` calls.

## Required Patterns

Need to add tree-sitter patterns to capture:

1. **Destructured require**:
   ```javascript
   const { helper, processData } = require('./utils');
   ```

2. **Simple require**:
   ```javascript
   const utils = require('./utils');
   ```

3. **Direct require call** (less common):
   ```javascript
   require('./utils').helper();
   ```

## Acceptance Criteria

- [ ] Add query patterns to capture `require()` calls as import definitions
- [ ] Handle destructured require: `const { helper } = require('./utils')`
- [ ] Handle simple require: `const utils = require('./utils')`
- [ ] Handle require with member access: `require('./utils').helper`
- [ ] Update import processor to handle CommonJS-style imports
- [ ] Verify CommonJS imports appear in `imported_symbols` map
- [ ] All CommonJS integration tests pass

## Implementation Approach

### 1. Add Query Patterns

Add to `javascript.scm` after the ES6 import section:

```scheme
;; ==============================================================================
;; COMMONJS IMPORTS
;; ==============================================================================

; Destructured require: const { foo, bar } = require('./module')
(variable_declarator
  name: (object_pattern
    (shorthand_property_identifier_pattern) @definition.import.require
  )
  value: (call_expression
    function: (identifier) @import.require.function
    (#eq? @import.require.function "require")
    arguments: (arguments
      (string) @import.require.source
    )
  )
)

; Simple require: const utils = require('./module')
(variable_declarator
  name: (identifier) @definition.import.require.simple
  value: (call_expression
    function: (identifier) @import.require.function
    (#eq? @import.require.function "require")
    arguments: (arguments
      (string) @import.require.source.simple
    )
  )
)
```

### 2. Update Import Processor

May need to update `import_processor.ts` to:
- Recognize CommonJS import patterns
- Extract module path from `require()` argument
- Create appropriate `ImportDefinition` objects

### 3. Test Files

The following fixtures already exist and should work after the fix:
- `packages/core/tests/fixtures/javascript/code/modules/utils_commonjs.js`
- `packages/core/tests/fixtures/javascript/code/modules/main_commonjs.js`

Tests in `project.javascript.integration.test.ts`:
- "should resolve require() imports"
- "should resolve cross-file function calls in CommonJS"
- "should handle module.exports patterns"

## Estimated Effort

**2-3 hours**
- 1 hour: Add and test query patterns
- 1 hour: Update import processor if needed
- 1 hour: Verify all tests pass

## Related Files

- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm` - Add patterns here
- `packages/core/src/index_single_file/import_processor.ts` - May need updates
- `packages/core/src/project/project.javascript.integration.test.ts` - Tests to verify
