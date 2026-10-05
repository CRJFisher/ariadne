# Task: Implement Advanced Language-Specific Features

**Epic**: 11 - Codebase Restructuring
**Status**: TODO
**Priority**: Medium
**Estimated Effort**: 1-2 days

## Context

Currently, 3 symbol resolution integration tests are marked as `.todo()` for advanced language-specific features that require specialized handling beyond basic symbol resolution.

### Features Required

1. **Python**: `super()` inheritance resolution
2. **Rust**: Trait method resolution
3. **TypeScript**: Namespace resolution

These features are less common but important for comprehensive symbol resolution.

## Python: super() Inheritance Resolution

### Current State
- ✅ Class inheritance tracked in `ClassDefinition.extends`
- ✅ Method definitions include parent class names
- ❌ `super()` calls don't resolve to parent methods

### Test Case
```python
class Base:
    def method(self):
        return "base"

class Child(Base):
    def method(self):
        return super().method()  # Should resolve to Base.method
```

### Implementation (0.5 days)

**File**: `packages/core/src/resolve_references/call_resolution/method_resolution.ts`

Add special handling for `super()` calls:

```typescript
function resolve_super_method_call(
  reference: MethodCallReference,
  current_class: ClassDefinition,
  index: SemanticIndex,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): SymbolId | null {
  // 1. Get parent class name from current_class.extends
  const parent_name = current_class.extends[0]; // Python single inheritance
  if (!parent_name) return null;

  // 2. Find parent class definition in current file
  const parent_class = Array.from(index.classes.values()).find(
    c => c.name === parent_name
  );

  if (!parent_class) {
    // 3. Check if parent is imported (cross-file)
    // Requires task 135 for cross-file resolution
    return null;
  }

  // 4. Find method in parent class
  const method = parent_class.methods.find(
    m => m.name === reference.name
  );

  return method?.symbol_id || null;
}
```

**Test**: `symbol_resolution.python.test.ts`
- Remove `.todo()` from "resolves super() method call"

## Rust: Trait Method Resolution

### Current State
- ✅ Trait definitions extracted
- ✅ Trait methods tracked in `TraitDefinition.methods`
- ❌ Trait implementations not linked to structs
- ❌ Trait method calls don't resolve

### Test Case
```rust
trait Display {
    fn display(&self) -> String;
}

impl Display for User {
    fn display(&self) -> String {
        format!("User")
    }
}

fn main() {
    let user = User::new();
    user.display();  // Should resolve to impl Display for User
}
```

### Implementation (1 day)

**File**: `packages/core/src/index_single_file/type_preprocessing/trait_tracking.ts` (new)

Add trait implementation tracking:

```typescript
interface TraitImpl {
  trait_name: SymbolName;
  type_name: SymbolName;
  methods: Map<SymbolName, SymbolId>;
}

// During semantic indexing, extract trait impls
function extract_trait_implementations(
  index: SemanticIndex
): Map<SymbolName, TraitImpl[]> {
  const trait_impls = new Map<SymbolName, TraitImpl[]>();

  // Find all "impl Trait for Type" blocks
  // Store mapping: Type -> [TraitImpl]

  return trait_impls;
}
```

**File**: `packages/core/src/resolve_references/call_resolution/method_resolution.ts`

Update method resolution to check trait implementations:

```typescript
function resolve_rust_method_call(
  reference: MethodCallReference,
  receiver_type: SymbolName,
  index: SemanticIndex
): SymbolId | null {
  // 1. Check struct's own methods
  const struct_def = index.structs.get(receiver_type);
  const method = struct_def?.methods.find(m => m.name === reference.name);
  if (method) return method.symbol_id;

  // 2. Check trait implementations for this type
  const trait_impls = index.trait_implementations?.get(receiver_type);
  if (trait_impls) {
    for (const impl of trait_impls) {
      const trait_method = impl.methods.get(reference.name);
      if (trait_method) return trait_method;
    }
  }

  return null;
}
```

**Test**: `symbol_resolution.rust.test.ts`
- Remove `.todo()` from "resolves trait method implementation"

**Note**: This requires adding a new query pattern to capture `impl Trait for Type` blocks:

**File**: `packages/core/queries/rust.scm`

Add pattern:
```scm
; Trait implementations
(impl_item
  trait: (type_identifier) @trait_name
  type: (type_identifier) @type_name
  body: (declaration_list) @trait_impl_body
) @definition.trait_impl
```

## TypeScript: Namespace Resolution

### Current State
- ✅ Namespace definitions extracted
- ✅ Namespace members tracked
- ❌ Qualified namespace access not resolved (`Namespace.Member`)

### Test Case
```typescript
namespace Utils {
  export function helper() {
    return 42;
  }
}

const result = Utils.helper();  // Should resolve to Utils.helper
```

### Implementation (0.5 days)

**File**: `packages/core/src/resolve_references/call_resolution/function_resolution.ts`

Add namespace-qualified call resolution:

```typescript
function resolve_namespace_qualified_call(
  reference: FunctionCallReference,
  index: SemanticIndex
): SymbolId | null {
  // Check if name contains '.' (qualified access)
  const parts = reference.name.split('.');
  if (parts.length !== 2) return null;

  const [namespace_name, member_name] = parts;

  // Find namespace definition
  const namespace = Array.from(index.namespaces.values()).find(
    ns => ns.name === namespace_name
  );

  if (!namespace) return null;

  // Find member in namespace
  const member = namespace.members.find(m => m.name === member_name);
  return member?.symbol_id || null;
}
```

**Test**: `symbol_resolution.typescript.test.ts`
- Remove `.todo()` from "resolves namespace member access"

**Alternative approach**: Store namespace-qualified references during indexing:
- Extract `Utils.helper` as a qualified reference with `namespace_name` context
- Resolution checks namespace members directly

## Implementation Plan

### Phase 1: Python super() (0.5 days)
1. Implement `resolve_super_method_call()` function
2. Wire into method resolution pipeline
3. Remove `.todo()` from test
4. Verify test passes

### Phase 2: Rust Trait Methods (1 day)
1. Add `impl Trait for Type` query pattern to `rust.scm`
2. Create `trait_tracking.ts` module
3. Extract trait implementations during indexing
4. Update method resolution to check trait impls
5. Remove `.todo()` from test
6. Verify test passes

### Phase 3: TypeScript Namespaces (0.5 days)
1. Implement namespace-qualified call resolution
2. Wire into function resolution pipeline
3. Remove `.todo()` from test
4. Verify test passes

### Phase 4: Integration Testing (0.5 days)
- Run full test suite
- Verify no regressions
- Document new features

## Acceptance Criteria

- [ ] Python `super()` method calls resolve to parent class methods
- [ ] Rust trait method implementations resolve correctly
- [ ] TypeScript namespace-qualified calls resolve correctly
- [ ] All 3 advanced feature tests pass (no more `.todo()`)
- [ ] No regressions in existing tests
- [ ] Documentation updated

## Dependencies

**Partially depends on Task 135** (Cross-File Import Resolution):
- `super()` with imported parent classes requires cross-file resolution
- Trait methods from imported traits require cross-file resolution
- Can implement local cases first, mark cross-file as separate `.todo()`

## Testing Strategy

1. Unit tests for each resolution function
2. Integration tests verify end-to-end resolution
3. Edge case testing:
   - `super()` with multiple inheritance (Python 3)
   - Trait default implementations (Rust)
   - Nested namespaces (TypeScript)

## Notes

- Python `super()` is the simplest - just lookup in parent class
- Rust traits require new extraction during indexing
- TypeScript namespaces might need qualified name handling during extraction
- These features are less common but important for completeness
- Prioritize after tasks 135 and 136 since those affect more tests
