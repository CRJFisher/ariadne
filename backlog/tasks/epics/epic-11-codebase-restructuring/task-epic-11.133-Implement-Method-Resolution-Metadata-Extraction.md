# Task: Implement Method Resolution Metadata Extraction (Python & Rust)

**Status**: Open
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-08

## Problem

Method calls in Python and Rust are not extracting critical metadata needed for method resolution:
- **receiver_location**: Location of the receiver object in method calls (e.g., `service1.get_data()` - where is `service1`?)
- **assignment tracking**: Variable assignments are not being tracked in Rust

These metadata fields are essential for type-based method resolution, which allows the system to determine which class/struct a method belongs to.

### Failing Tests

1. **Python**: [semantic_index.python.test.ts:953](packages/core/src/index_single_file/semantic_index.python.test.ts#L953) - "should extract method resolution metadata for all receiver patterns"
   - **Failure**: `expect(calls_with_receiver.length).toBeGreaterThan(0)` - No method calls have `receiver_location`

2. **Rust**: [semantic_index.rust.test.ts:1573](packages/core/src/index_single_file/semantic_index.rust.test.ts#L1573) - "should extract method resolution metadata for all receiver patterns"
   - **Failure**: `expect(service1_assignment).toBeDefined()` - Assignment tracking not implemented

### Test Code Examples

**Python:**
```python
class Service:
    def get_data(self) -> list[str]:
        return []

service1: Service = create_service()
service1.get_data()  # receiver_location should point to service1

service2 = Service()
service2.get_data()  # receiver_location should point to service2
```

**Rust:**
```rust
fn main() {
    let service1: Service = create_service();
    service1.get_data();  // receiver_location should point to service1

    let service2 = Service { data: vec![] };
    service2.get_data();  // receiver_location should point to service2
}
```

## Current Behavior

Method calls are being extracted, but:
- Python: `context.receiver_location` is not populated
- Rust: Variable assignments (type `"assignment"`) are not being captured at all

## Expected Behavior

For method calls like `receiver.method()`:
1. Extract the method call reference with name `"method"`
2. Populate `context.receiver_location` with the source location of `receiver`
3. This allows the resolver to:
   - Look up the receiver variable
   - Determine its type (from annotation or constructor)
   - Resolve the method to the correct class/struct

For variable assignments in Rust:
1. Create references with type `"assignment"`
2. Track the variable name and location
3. Optionally track the assigned type (from annotation or inference)

## Investigation Steps

### Python Investigation

1. **Check existing TypeScript/JavaScript implementation**:
   - These languages already populate `receiver_location`
   - See [javascript_builder.ts](packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts)
   - Look for `receiver_location` extraction logic

2. **Check Python query patterns**:
   - Look at [python.scm](packages/core/src/index_single_file/query_code_tree/queries/python.scm)
   - Find method call patterns (`attribute` nodes with calls)
   - Verify if receiver is captured

3. **Examine Python builder**:
   - Check [python_builder.ts](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts)
   - Find method call processing
   - Add receiver extraction logic

### Rust Investigation

1. **Check assignment patterns**:
   - Look at [rust.scm](packages/core/src/index_single_file/query_code_tree/queries/rust.scm)
   - Find `let` statement patterns
   - Add assignment reference captures

2. **Check method call patterns**:
   - Look for field expression patterns (receiver in Rust)
   - Add receiver_location extraction

3. **Examine Rust builder**:
   - Check [rust_metadata.ts](packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts)
   - Add assignment and receiver_location processing

## Solution Approach

### For Python

**Step 1**: Update python.scm to capture receiver in method calls
```scheme
; Method call with receiver
(call
  function: (attribute
    object: (identifier) @call.receiver  ; Capture receiver
    attribute: (identifier) @reference.call
  )
) @reference.call.container
```

**Step 2**: Update python_builder.ts to extract receiver_location
```typescript
if (capture.name === "reference.call" && receiverCapture) {
  const receiverNode = receiverCapture.node;
  context.receiver_location = {
    file_path: filePath,
    start_line: receiverNode.startPosition.row + 1,
    start_column: receiverNode.startPosition.column + 1,
    end_line: receiverNode.endPosition.row + 1,
    end_column: receiverNode.endPosition.column
  };
}
```

### For Rust

**Step 1**: Add assignment tracking to rust.scm
```scheme
; Variable assignment
(let_declaration
  pattern: (identifier) @reference.assignment
  value: (_)
) @reference.assignment.container
```

**Step 2**: Add receiver_location for method calls
```scheme
; Method call with receiver
(call_expression
  function: (field_expression
    value: (identifier) @call.receiver
    field: (field_identifier) @reference.call
  )
)
```

**Step 3**: Update rust_metadata.ts to process both

## Testing

```bash
# Test Python
npm test -- semantic_index.python.test.ts -t "should extract method resolution metadata for all receiver patterns"

# Test Rust
npm test -- semantic_index.rust.test.ts -t "should extract method resolution metadata for all receiver patterns"
```

Verify:
- Method calls have `context.receiver_location` populated
- Rust assignments are tracked
- Receiver locations point to correct identifiers
- Both type annotation and constructor assignment scenarios work

## Acceptance Criteria

### Python
- [ ] Method calls have `receiver_location` in context
- [ ] Receiver location points to the correct variable/expression
- [ ] Works for: variable receivers, constructor receivers, property chains
- [ ] Python test passes

### Rust
- [ ] Variable assignments are tracked (type: "assignment")
- [ ] Method calls have `receiver_location` in context
- [ ] Receiver location points to the correct variable/expression
- [ ] Works for: typed let bindings, constructor let bindings
- [ ] Rust test passes

### Both
- [ ] No regressions in other tests
- [ ] Consistent with TypeScript/JavaScript receiver_location implementation

## Related

- Method resolution system (epic-11.113)
- Type context building
- JavaScript/TypeScript receiver_location (working reference implementation)
