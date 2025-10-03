# Task epic-11.112.11: Fix Python Class Scopes

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.10

## Objective

Update Python class definitions to use `get_defining_scope_id()` to fix scope assignment bug.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder_config.ts`

## Implementation Steps

### 1. Locate Class Definition Handler (10 min)

Find the handler for `@definition.class`:

```typescript
{
  name: "definition.class",
  handler: (capture, context, builder) => {
    const class_id = class_symbol(/* ... */);

    builder.add_class({
      symbol_id: class_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),  // ← CHANGE THIS
      availability: determine_availability(capture.node),
      extends: base_classes,
    });
  }
}
```

### 2. Apply Fix (5 min)

```typescript
scope_id: context.get_defining_scope_id(capture.location),  // ← FIXED
```

### 3. Check for Nested Classes (10 min)

Python supports nested classes:
```python
class Outer:
    class Inner:
        pass
```

Verify the fix works for both.

### 4. Verify All Class Handlers (10 min)

```bash
grep -n "add_class" packages/core/src/index_single_file/query_code_tree/language_configs/python_builder_config.ts
```

### 5. Run Python Semantic Tests (15 min)

```bash
npm test -- semantic_index.python.test.ts
```

### 6. Manual Verification (30 min)

Test with Python classes:
```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hello, {self.name}"

class Company:
    class Employee:
        def work(self):
            pass
```

Verify:
- `Person.scope_id === file_scope` ✓
- `Company.scope_id === file_scope` ✓
- `Employee.scope_id === Company_scope` ✓
- Not pointing to method scopes ❌

## Success Criteria

- ✅ Python class definitions use `get_defining_scope_id()`
- ✅ Nested classes work correctly
- ✅ Tests pass
- ✅ Manual verification confirms fix

## Outputs

- Fixed Python class scope assignment

## Next Task

**task-epic-11.112.12** - Fix Rust struct scopes
