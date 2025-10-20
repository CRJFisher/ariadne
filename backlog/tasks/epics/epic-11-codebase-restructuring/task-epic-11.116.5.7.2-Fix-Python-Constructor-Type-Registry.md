# Task epic-11.116.5.7.2: Fix Python __init__ Constructor in Type Registry

**Status:** Not Started
**Parent:** task-epic-11.116.5.7
**Priority:** Medium
**Created:** 2025-10-20

## Overview

Ensure Python `__init__` methods are properly captured as constructors in the type registry, consistent with how TypeScript/JavaScript constructors are handled.

## Problem

Python integration tests show that `__init__` methods are not captured as constructors in the type registry:
- `type_info.constructor` is `undefined` for Python classes
- TypeScript/JavaScript classes have `constructor` property populated
- Python `__init__` methods exist in the semantic index but aren't registered as constructors

## Current Behavior

```typescript
// Test: should handle __init__ as constructor
const user_class = // ... find User class
const type_info = project.get_type_info(user_class.symbol_id);
expect(type_info.constructor).toBeDefined(); // FAILS - undefined
```

Test currently works around this by checking methods instead:
```typescript
// Python __init__ might not be captured as constructor in the same way
// Verify methods exist instead
expect(type_info.methods.size).toBeGreaterThan(0); // PASSES
```

## Expected Behavior

Python classes should have their `__init__` method registered as the constructor:

```python
class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email
```

Should result in:
```typescript
const type_info = project.get_type_info(user_class.symbol_id);
expect(type_info.constructor).toBeDefined(); // Should PASS
expect(type_info.constructor).toBe(init_method_symbol_id);
```

## Root Cause Analysis Needed

Investigate the type registry population for Python:
1. **Method classification** - How are Python methods classified (method vs constructor)?
2. **Type registry logic** - Does it recognize `__init__` as special?
3. **Tree-sitter capture** - Is `__init__` marked as a constructor in queries?
4. **Type info builder** - Does it handle Python constructors differently?

## Test Cases to Fix

### Test 1: Class Methods with self
**File:** `packages/core/src/project/project.python.integration.test.ts`
**Test:** "should resolve instance methods with self parameter"
**Line:** ~176

Currently has workaround:
```typescript
// Python constructors might not be captured the same way as TypeScript
// Skip constructor check and verify methods instead
```

### Test 2: Python-Specific Patterns
**Test:** "should handle __init__ as constructor"
**Line:** ~438

Currently has workaround:
```typescript
// Python __init__ might not be captured as constructor in the same way
// Verify methods exist instead
expect(type_info.methods.size).toBeGreaterThan(0);
```

## Investigation Steps

1. **Review type registry code**
   - Check `packages/core/src/project/type_registry.ts`
   - See how constructors are registered
   - Look for language-specific handling

2. **Check semantic index processing**
   - Review `packages/core/src/index_single_file/classes/`
   - See how Python `__init__` is captured
   - Compare to TypeScript/JavaScript constructor handling

3. **Examine tree-sitter queries**
   - Check Python tree-sitter queries for class methods
   - See if `__init__` has special capture name
   - Compare to TypeScript/JavaScript constructor queries

4. **Review type info builder**
   - Check how TypeInfo is constructed from semantic index
   - See if there's special logic for constructors
   - Verify Python classes are processed correctly

## Files to Review

- `packages/core/src/project/type_registry.ts`
- `packages/core/src/index_single_file/classes/class_processor.ts`
- Python tree-sitter queries for classes/methods
- `packages/core/src/index_single_file/queries/python/*.scm`
- Type info construction logic

## Comparison: TypeScript vs Python

### TypeScript Constructor
```typescript
class User {
  constructor(name: string) {
    this.name = name;
  }
}
```
- Tree-sitter has `constructor` node type
- Clearly marked as constructor
- Type registry handles it

### Python Constructor
```python
class User:
  def __init__(self, name: str):
    self.name = name
```
- Tree-sitter sees it as `function_definition` named `__init__`
- Special handling needed to recognize as constructor
- Type registry needs to check method name

## Possible Solutions

### Option 1: Name-based Detection
In type registry, check if method name is `__init__`:
```typescript
if (method.name === "__init__") {
  type_info.constructor = method.symbol_id;
} else {
  type_info.methods.set(method.name, method.symbol_id);
}
```

### Option 2: Query-level Marking
Update Python tree-sitter queries to mark `__init__` specially:
```scheme
(function_definition
  name: (identifier) @constructor.name
  (#eq? @constructor.name "__init__"))
@constructor
```

### Option 3: Semantic Index Level
Mark `__init__` as constructor when building semantic index:
- Add `is_constructor` field to method definitions
- Use this flag when building type registry

## Success Criteria

- [ ] `type_info.constructor` is defined for Python classes with `__init__`
- [ ] Constructor symbol ID points to `__init__` method
- [ ] Both test cases pass without workarounds
- [ ] Remove conditional checks from tests
- [ ] Behavior matches TypeScript/JavaScript constructor handling

## Implementation Plan

1. **Analyze current flow** (30 min)
   - Trace how TypeScript constructors are captured
   - Compare to Python `__init__` capture
   - Identify where the difference occurs

2. **Implement fix** (1-2 hours)
   - Choose solution approach (likely Option 1)
   - Update type registry or semantic index processing
   - Ensure `__init__` is recognized as constructor

3. **Test and verify** (30 min)
   - Run Python integration tests
   - Verify both test cases pass
   - Check that constructor is accessible

4. **Clean up tests** (15 min)
   - Remove workarounds
   - Make tests properly assert on constructor
   - Add test for constructor parameters if needed

## Estimated Effort

**2-3 hours**

## Notes

- This is a Python-specific quirk - `__init__` is just a method with special semantics
- Other languages may have similar issues (Ruby's `initialize`, etc.)
- Fix should be maintainable and not break existing TypeScript/JavaScript handling
- Consider other Python magic methods that might need special handling
