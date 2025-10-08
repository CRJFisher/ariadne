# Task: Implement Python Method Decorator Tracking

**Status**: Open
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-08

## Problem

Python method decorators (@property, @staticmethod, @classmethod) are not being extracted and attached to method definitions. The test expects `decorators` field to be defined on methods, but it's currently `undefined`.

### Failing Test

Test: [semantic_index.python.test.ts:1135](packages/core/src/index_single_file/semantic_index.python.test.ts#L1135) - "should extract class with decorated methods"

```python
class User:
    @property
    def name(self):
        return self._name

    @staticmethod
    def create_guest():
        return User("Guest")

    @classmethod
    def from_dict(cls, data):
        return cls(data['name'])

    def regular_method(self):
        pass
```

**Expected**: `method.decorators` should be defined and contain decorator names
**Actual**: `method.decorators` is `undefined`

Test fails at line 1209:
```typescript
expect(class_method.decorators).toBeDefined();
```

## Current Behavior

Methods are being extracted, but the `decorators` field is not populated. This affects:
- `@property` decorated methods
- `@staticmethod` decorated methods
- `@classmethod` decorated methods
- Other custom decorators

## Expected Behavior

For decorated methods, the semantic index should:
1. Extract decorator names from `@decorator` syntax
2. Store them in the method's `decorators` array field
3. Handle decorator arguments if present (e.g., `@decorator(arg)`)
4. Preserve decorator order

## Investigation Steps

1. **Check Python query patterns**:
   - Look at [python.scm](packages/core/src/index_single_file/query_code_tree/queries/python.scm)
   - Find how decorators are captured (if at all)
   - Check if there's a `@decorator` or `decorator` pattern

2. **Examine method definition structure**:
   - Check [python_builder.ts](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts)
   - See how method definitions are processed
   - Determine if decorators are being ignored

3. **Review type definitions**:
   - Check if the Method type has a `decorators` field defined
   - Verify it's an optional string array

4. **Compare with TypeScript decorator handling**:
   - TypeScript also has decorators
   - See if similar patterns exist in typescript.scm
   - Adapt the approach if applicable

## Solution Approach

### Step 1: Add Decorator Capture to Query
Update [python.scm](packages/core/src/index_single_file/query_code_tree/queries/python.scm):

```scheme
; Method with decorators
(decorated_definition
  (decorator)+ @decorator
  definition: (function_definition
    name: (identifier) @definition.method
  )
) @scope.method
```

### Step 2: Process Decorators in Builder
Update [python_builder.ts](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts):

1. Extract decorator nodes when processing method definitions
2. Get decorator names (strip `@` prefix)
3. Handle decorator arguments if present
4. Store in method's `decorators` array

### Step 3: Update Method Type (if needed)
Ensure the Method type includes:
```typescript
decorators?: string[];
```

## Testing

```bash
# Run failing test
npm test -- semantic_index.python.test.ts -t "should extract class with decorated methods"

# Verify decorator extraction for:
# - @property methods
# - @staticmethod methods
# - @classmethod methods
# - Multiple decorators on one method
# - Decorators with arguments
```

Test cases should verify:
1. `decorators` field is defined
2. Contains correct decorator names
3. Order is preserved (top-to-bottom)
4. Arguments are handled correctly

## Acceptance Criteria

- [ ] Python decorated methods test passes
- [ ] `decorators` field is populated for decorated methods
- [ ] All decorator types are captured (@property, @staticmethod, @classmethod, custom)
- [ ] Decorator order is preserved
- [ ] Methods without decorators have empty/undefined decorators field
- [ ] No regressions in other Python tests

## Related

- Python decorator syntax and semantics
- TypeScript decorator extraction (if implemented)
- Method metadata extraction
