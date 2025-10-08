# Task: Implement Rust Method Resolution Metadata

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-07

## Problem

The [semantic_index.rust.test.ts:1573](packages/core/src/index_single_file/semantic_index.rust.test.ts#L1573) test is currently skipped because Rust lacks the metadata infrastructure needed for accurate method call resolution.

### Current Gap

When analyzing Rust code with method calls, we cannot determine:
1. **Receiver types from assignments**: When a variable is assigned with a type annotation, we don't track the type
2. **Receiver types from constructors**: When a variable is assigned from a constructor, we don't track what was constructed
3. **Method call receiver locations**: Method calls don't record where the receiver expression is located

### Test Scenario (Currently Skipped)

```rust
struct Service {
    data: Vec<String>,
}

impl Service {
    fn get_data(&self) -> &Vec<String> {
        &self.data
    }
}

fn main() {
    // Scenario 1: Receiver type from annotation
    let service1: Service = create_service();
    service1.get_data();  // Need to resolve that service1 is type Service

    // Scenario 2: Receiver type from constructor
    let service2 = Service { data: vec![] };
    service2.get_data();  // Need to resolve that service2 is type Service
}
```

**Problem**: Without tracking the receiver type, we cannot resolve `get_data()` calls to the correct implementation in `impl Service`.

## Root Cause

The Rust semantic indexing currently captures:
- ✅ Method definitions in `impl` blocks
- ✅ Function calls
- ✅ Method calls (as generic function calls)
- ❌ **Variable assignment types** (from annotations or constructors)
- ❌ **Receiver location metadata** (what expression is the method being called on)

This metadata is essential for:
- **Type-based method resolution**: Matching method calls to the correct `impl` block
- **Call graph construction**: Understanding which methods can be called from a given context
- **Entry point detection**: Finding methods that are never called (requires accurate resolution)

## Solution

Implement assignment tracking and receiver metadata for Rust method resolution:

### 1. Assignment Type Tracking

**Goal**: Capture the type of variables when assigned

**Implementation**:
- Add `assignment_type` field to variable references
- Extract type from:
  - Type annotations: `let x: MyType = ...` → track `MyType`
  - Struct literals: `let x = MyStruct { ... }` → track `MyStruct`
  - Function/method returns: Track return types when available

**Files to modify**:
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`
- Tree-sitter queries for Rust variable assignments
- Reference builder to capture assignment types

**Example**:
```rust
let service: Service = create_service();
//           ^^^^^^^ - capture this type annotation
```

### 2. Receiver Location Metadata

**Goal**: Track the receiver expression for method calls

**Implementation**:
- Add `receiver_location` field to method call references
- Capture the location of the expression before the `.`
- Store as a `Location` object for later type resolution

**Files to modify**:
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`
- Tree-sitter queries for Rust method calls (field expressions)
- Reference builder to capture receiver nodes

**Example**:
```rust
service1.get_data();
^^^^^^^^ - capture location of receiver expression
```

### 3. Method Resolution Algorithm

**Goal**: Use receiver metadata to resolve method calls to correct impl blocks

**Implementation**:
- Look up receiver variable's assignment type
- Find `impl` blocks for that type
- Resolve method name within that impl block
- Return the correct method definition

**Files to modify**:
- `packages/core/src/resolve_references/method_resolution/` (new module)
- Integration with existing symbol resolution

### 4. Update Reference Schema

**Type definitions to add**:

```typescript
// In @ariadnejs/types
interface Reference {
  // ... existing fields ...

  // For variable assignments
  assignment_type?: SymbolName;  // Type from annotation or constructor

  // For method calls
  receiver_location?: Location;  // Where the receiver expression is
}
```

## Testing Strategy

### Phase 1: Assignment Type Tracking
```bash
cd packages/core
npm test -- semantic_index.rust.test.ts -t "assignment type"
```

Test cases:
- ✅ Type annotations: `let x: MyType = expr`
- ✅ Struct literals: `let x = MyStruct { fields }`
- ✅ Function returns: Track when return type is known

### Phase 2: Receiver Location Capture
```bash
npm test -- semantic_index.rust.test.ts -t "receiver location"
```

Test cases:
- ✅ Method calls on variables: `variable.method()`
- ✅ Method calls on expressions: `create_obj().method()`
- ✅ Chained method calls: `obj.method1().method2()`

### Phase 3: Full Method Resolution
```bash
npm test -- semantic_index.rust.test.ts -t "method resolution metadata"
```

Un-skip the test at line 1573 and verify:
- ✅ Resolves method calls with type-annotated receivers
- ✅ Resolves method calls with constructor-assigned receivers
- ✅ Handles multiple impl blocks for different types

## Acceptance Criteria

1. **Assignment type tracking works**:
   - Variable assignments capture type from annotations
   - Variable assignments capture type from struct literals
   - Types are stored in reference metadata

2. **Receiver location tracking works**:
   - Method calls capture receiver expression location
   - Location points to the correct AST node
   - Works for variables, expressions, and chains

3. **Test passes**:
   - Un-skip test at `semantic_index.rust.test.ts:1573`
   - All assertions pass
   - No regressions in existing Rust tests

4. **Documentation updated**:
   - Type definitions include new fields
   - Examples show how to use the metadata
   - Architecture docs explain method resolution flow

## Related

- Rust semantic indexing: task-epic-11.114
- Rust scope boundaries: task-epic-11.116
- Method resolution (general): Future work for other languages
- Call graph construction: Depends on accurate method resolution

## Implementation Notes

### Tree-sitter Query Hints

For assignment type tracking:
```scm
; Type annotation
(let_declaration
  pattern: (identifier) @var.name
  type: (_) @var.type)

; Struct literal
(let_declaration
  value: (struct_expression
    name: (type_identifier) @struct.type))
```

For receiver location:
```scm
; Method call
(call_expression
  function: (field_expression
    value: (_) @receiver
    field: (field_identifier) @method.name))
```

### Suggested Implementation Order

1. **Week 1**: Add `assignment_type` field and capture from type annotations
2. **Week 2**: Capture assignment type from struct literals and function returns
3. **Week 3**: Add `receiver_location` field and capture for method calls
4. **Week 4**: Implement method resolution algorithm using the metadata
5. **Week 5**: Testing, documentation, and integration

### Performance Considerations

- Assignment type tracking adds ~5-10% overhead (acceptable)
- Receiver location tracking is nearly free (just storing node location)
- Method resolution is done on-demand, not during indexing

### Future Enhancements

This work enables future improvements:
- Type inference for Rust (using assignment flow)
- Trait method resolution (using type information)
- Generic type instantiation tracking
- Lifetime analysis (for advanced use cases)

## Success Metrics

- ✅ Test at line 1573 passes
- ✅ No performance regression >15%
- ✅ Method resolution accuracy >95% for common cases
- ✅ All existing Rust tests still pass

## Estimated Effort

**Size**: Medium (2-3 weeks)
**Complexity**: Medium-High
**Priority**: Medium (enables better call graph analysis for Rust)
