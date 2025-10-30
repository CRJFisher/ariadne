# Task Epic 11.154.8.2: Fix JavaScript CommonJS Module Resolution

**Parent Task**: 11.154.8 - Final Integration
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 1-2 hours
**Test Impact**: Fixes 6 tests

---

## Objective

Add builder logic to detect `require()` calls as imports and handle CommonJS default exports.

**PRINCIPLE**: Use existing `@reference.call` captures on complete nodes, detect require() via builder pattern matching.

---

## Failing Tests (6 total)

File: `src/project/project.javascript.integration.test.ts`

1. "should resolve require() imports"
2. "should resolve cross-file function calls in CommonJS"
3. "should handle default exports"
4. "should follow re-export chains"
5. "should resolve aliased imports"
6. "should resolve aliased class constructor calls"

---

## Root Cause

CommonJS `require()` is not detected as an import:
```javascript
const foo = require('./module');  // Not creating import definition
```

---

## Solution Approach

### DO NOT add new captures ❌

The require() call is already captured as `@reference.call` (complete node).

### ADD builder logic ✅

Detect require() pattern and create import definition:

```typescript
// In javascript_builder.ts or javascript_builder_config.ts

// When processing @reference.call or @assignment.variable:
if (is_require_call(capture.node)) {
  const module_path = extract_require_path(capture.node);
  const var_name = extract_assigned_variable(capture.node);

  builder.add_import({
    name: var_name,
    module_path: module_path,
    import_kind: "default", // CommonJS is like default import
    location: capture.location,
    ...
  });
}

function is_require_call(node: SyntaxNode): boolean {
  // Check if this is: const x = require('path')
  if (node.type === "call_expression") {
    const func = node.childForFieldName("function");
    if (func?.type === "identifier" && func.text === "require") {
      return true;
    }
  }

  // Or check assignment parent
  const parent = node.parent;
  if (parent?.type === "variable_declarator") {
    const value = parent.childForFieldName("value");
    if (value?.type === "call_expression") {
      const func = value.childForFieldName("function");
      return func?.text === "require";
    }
  }

  return false;
}

function extract_require_path(node: SyntaxNode): string {
  // Find call_expression node
  let call_node = node.type === "call_expression" ? node :
                  node.childForFieldName("value");

  const args = call_node?.childForFieldName("arguments");
  if (args) {
    // First argument is the module path
    const first_arg = args.child(1); // Skip '('
    if (first_arg?.type === "string") {
      return first_arg.text.slice(1, -1); // Remove quotes
    }
  }
  return "";
}
```

---

## Implementation

**File**: `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`

Add require() detection to:
- `@assignment.variable` handler
- Or create separate pass to detect require patterns from existing captures

**NO changes to javascript.scm** - uses existing captures

---

## Acceptance Criteria

- [ ] All 6 CommonJS tests pass
- [ ] require() imports detected and resolved
- [ ] Default exports work
- [ ] Aliased imports work
- [ ] Re-export chains work
- [ ] NO new captures added to javascript.scm
- [ ] Validation still passes (0 errors, 0 warnings)

---

## Time: 1-2 hours
