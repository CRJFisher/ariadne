# Task: Implement Function Return Type Tracking

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-08
**Priority**: Medium
**Estimated Effort**: 3-5 hours

## Problem

Function return types are not tracked in the `type_context` module, causing 4 test failures across TypeScript, Python, and Rust. This limits the effectiveness of type-based analysis and method resolution.

### Failing Tests

File: [type_context.test.ts](packages/core/src/resolve_references/type_resolution/type_context.test.ts)

**TypeScript** (line ~199):
```typescript
it("should track function return type annotation", () => {
  const code = `
    class Result { value: string; }
    function process(): Result { ... }
  `;

  // Test expects:
  const return_type = type_context.get_type(process_fn);
  expect(return_type).toBe(result_class.symbol_id);

  // Actual: null ❌
});
```

**Python** (line ~423):
```python
it("should track function return type hint", () => {
  const code = `
    class Result:
        value: str

    def process() -> Result:
        return Result()
  `;

  // Test expects:
  expect(return_type).toBe(result_class.symbol_id);

  // Actual: null ❌
});
```

**Rust** (line ~599):
```rust
it("should track function return type", () => {
  const code = `
    struct Result { value: String }

    fn process() -> Result {
        Result { value: String::new() }
    }
  `;

  // Test expects:
  expect(return_type).toBe(result_struct.symbol_id);

  // Actual: null ❌
});
```

### Current Type Context Capabilities

The `type_context` module currently tracks:
- ✅ **Variable type annotations**: `let x: Type = ...`
- ✅ **Parameter type annotations**: `function fn(x: Type)`
- ❌ **Function return types**: `function fn(): Type` ← MISSING

## Root Cause

The type context builder extracts type information from:
1. Variable definitions with type annotations
2. Parameter definitions with type annotations
3. Constructor assignments (`new Type()`)

**Missing**: Extraction of return type annotations from function definitions.

### Why This Matters

Without return type tracking:
- **Type inference chains broken**: Cannot infer types of function call results
- **Method resolution incomplete**: Cannot determine return type of method calls
- **Call graph analysis limited**: Cannot follow data flow through function returns
- **Type-based refactoring blocked**: Cannot safely refactor based on return types

### Examples of Impact

**TypeScript**:
```typescript
class UserService {
  getUser(): User { ... }
}

// Without return type tracking:
const result = service.getUser();
// Cannot determine that 'result' is of type 'User'
```

**Python**:
```python
def fetch_data() -> DataModel:
    return DataModel()

# Without return type tracking:
data = fetch_data()
# Cannot determine that 'data' is of type 'DataModel'
```

**Rust**:
```rust
fn create_config() -> Config {
    Config::default()
}

// Without return type tracking:
let config = create_config();
// Cannot determine that 'config' is of type 'Config'
```

## Solution Design

### High-Level Approach

Add return type extraction to the type context builder:

1. **Capture return type annotations** from function definitions
2. **Store in type bindings map**: `function_symbol_id -> return_type_symbol_name`
3. **Expose via type_context API**: `get_return_type(function_symbol_id)`
4. **Support all three languages**: TypeScript, Python, Rust

### Implementation Strategy

#### Phase 1: Type Context Schema Update

**File**: `packages/types/src/type_context.ts` (or similar)

Add return type to type bindings:
```typescript
interface TypeBinding {
  symbol_id: SymbolId;           // Symbol being annotated
  type_name: SymbolName;         // Type annotation
  kind: 'variable' | 'parameter' | 'return';  // ← Add 'return'
  location: Location;            // Where the annotation is
}
```

#### Phase 2: TypeScript Return Type Extraction

**File**: `packages/core/src/resolve_references/type_resolution/type_context_builder.ts`

Add handler for function return types:
```typescript
function extract_return_type(fn_def: FunctionDefinition): TypeBinding | null {
  // For TypeScript:
  // function process(): Result { ... }
  //                     ^^^^^^ - extract this type annotation

  const return_type_node = fn_def.return_type_annotation;
  if (!return_type_node) return null;

  return {
    symbol_id: fn_def.symbol_id,
    type_name: extract_type_name(return_type_node),
    kind: 'return',
    location: node_to_location(return_type_node)
  };
}
```

#### Phase 3: Python Return Type Extraction

**File**: Same as above

Add Python return type hint support:
```typescript
function extract_python_return_type(fn_def: FunctionDefinition): TypeBinding | null {
  // For Python:
  // def process() -> Result:
  //               ^^^^^^^^^^ - extract this type hint

  const return_hint = fn_def.return_type_annotation;  // Python stores as 'return_annotation'
  if (!return_hint) return null;

  return {
    symbol_id: fn_def.symbol_id,
    type_name: extract_type_name(return_hint),
    kind: 'return',
    location: node_to_location(return_hint)
  };
}
```

#### Phase 4: Rust Return Type Extraction

**File**: Same as above

Add Rust return type support:
```typescript
function extract_rust_return_type(fn_def: FunctionDefinition): TypeBinding | null {
  // For Rust:
  // fn process() -> Result { ... }
  //              ^^^^^^^^^ - extract this type annotation

  const return_type = fn_def.return_type;
  if (!return_type) return null;

  return {
    symbol_id: fn_def.symbol_id,
    type_name: extract_type_name(return_type),
    kind: 'return',
    location: node_to_location(return_type)
  };
}
```

#### Phase 5: Type Context API Update

**File**: `packages/core/src/resolve_references/type_resolution/type_context.ts`

Add method to get return types:
```typescript
class TypeContext {
  get_return_type(function_id: SymbolId): SymbolId | null {
    const binding = this.type_bindings.get(function_id);
    if (!binding || binding.kind !== 'return') return null;

    // Resolve type_name to actual type symbol
    return this.resolve_type_name(binding.type_name);
  }
}
```

### Tree-sitter Query Updates (If Needed)

**TypeScript** (`typescript.scm`):
```scheme
; Function return type annotation
(function_declaration
  name: (_) @function.name
  return_type: (type_annotation
    (_) @function.return_type))
```

**Python** (`python.scm`):
```scheme
; Function return type hint
(function_definition
  name: (identifier) @function.name
  return_type: (type) @function.return_type)
```

**Rust** (`rust.scm`):
```scheme
; Function return type
(function_item
  name: (identifier) @function.name
  return_type: (_) @function.return_type)
```

## Implementation Tasks

### 1. Update Type Context Schema (30 min)
- [ ] Add 'return' kind to TypeBinding enum
- [ ] Update type_context builder to handle return types
- [ ] Add `get_return_type()` method to TypeContext class

### 2. Implement TypeScript Return Type Extraction (60 min)
- [ ] Add return type extraction in type_context_builder
- [ ] Handle optional return types (`?: Type`)
- [ ] Handle generic return types (`Promise<Type>`)
- [ ] Test with existing TypeScript test case

### 3. Implement Python Return Type Extraction (60 min)
- [ ] Add Python return type hint extraction
- [ ] Handle optional types (`Optional[Type]`)
- [ ] Handle union types (`Type1 | Type2`)
- [ ] Test with existing Python test case

### 4. Implement Rust Return Type Extraction (60 min)
- [ ] Add Rust return type extraction
- [ ] Handle Result/Option types
- [ ] Handle generic return types
- [ ] Test with existing Rust test case

### 5. Update Tests and Validate (30 min)
- [ ] All 4 type_context.test.ts tests pass
- [ ] No regressions in variable/parameter type tracking
- [ ] Add additional test coverage for edge cases

## Files to Modify

### Core Implementation
- `packages/core/src/resolve_references/type_resolution/type_context_builder.ts` - Add return type extraction
- `packages/core/src/resolve_references/type_resolution/type_context.ts` - Add get_return_type method

### Type Definitions
- `packages/types/src/type_context.ts` - Add 'return' to TypeBinding.kind

### Tests (Already Exist)
- `packages/core/src/resolve_references/type_resolution/type_context.test.ts` - Tests already written, just need to pass

### Query Files (If Needed)
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`
- `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`

## Acceptance Criteria

- [ ] All 4 failing tests in type_context.test.ts now pass:
  - TypeScript: "should track function return type annotation"
  - Python: "should track function return type hint"
  - Rust: "should track function return type"
- [ ] No regressions in existing type tracking:
  - Variable type annotations still work
  - Parameter type annotations still work
  - Constructor assignments still work
- [ ] Return types accessible via type_context API:
  - `type_context.get_return_type(function_id)` returns correct type
- [ ] Edge cases handled:
  - Functions without return types return null
  - Generic return types work correctly
  - Optional/union types work correctly

## Testing Strategy

### Existing Tests (Must Pass)
```bash
npm test -- type_context.test.ts -t "return type"
```

Expected:
- ✅ TypeScript return type test passes
- ✅ Python return type test passes
- ✅ Rust return type test passes

### Regression Tests (Must Not Break)
```bash
npm test -- type_context.test.ts
```

Expected:
- ✅ All 22 tests pass (18 already passing + 4 new)

### Additional Test Coverage
Add tests for:
- Functions without return types
- Generic return types
- Optional return types
- Async function return types (Promise<T>)
- Method return types (class methods)

## Success Metrics

**Before**:
- type_context.test.ts: 18/22 tests passing (4 failures)
- Return type tracking: Not implemented

**After**:
- type_context.test.ts: 22/22 tests passing (0 failures)
- Return type tracking: Fully implemented for TypeScript, Python, Rust

## Dependencies

**Requires**: None (independent feature)

**Blocks**: Nothing critical, but enables:
- Improved type inference
- Better method resolution
- More accurate call graph analysis

## Related Tasks

- **task-epic-11.123**: Implement Rust Method Resolution Metadata (uses type context)
- **task-epic-11.124**: Implement TypeScript Re-Export Support (independent)

## Priority Justification

**Medium Priority** because:
- Fixes 4 test failures (test suite health)
- Completes type_context functionality (architectural completeness)
- Enables better type-based analysis (value add)
- Relatively quick fix (3-5 hours)

**Not High Priority** because:
- Not blocking other work
- Type inference works without it (less accurate, but works)
- Can be deferred if higher priority bugs exist

## Estimated Effort

- Schema update: 30 minutes
- TypeScript implementation: 60 minutes
- Python implementation: 60 minutes
- Rust implementation: 60 minutes
- Testing & validation: 30 minutes

**Total**: 3-5 hours

## Notes

- Return type extraction is similar to parameter type extraction (use as reference)
- Tree-sitter queries may already capture return types (check first)
- Focus on getting tests to pass first, optimize later
- Document the type_context API with examples after implementation
