# Task: Implement Method Call Resolution via Type Tracking

**Epic**: 11 - Codebase Restructuring
**Status**: TODO
**Priority**: High
**Estimated Effort**: 2-3 days

## Context

Currently, ~10 symbol resolution integration tests are marked as `.todo()` because they require type tracking to resolve method calls. The system needs to know the type of a variable/expression to resolve which method is being called.

### Current State

The infrastructure exists:
- ✅ `TypeContext` tracks variable types within functions
- ✅ `type_bindings_raw` maps variable locations to type names
- ✅ `type_members_raw` maps type names to their methods/properties
- ✅ Method resolution checks `TypeContext` for receiver type

### Missing Pieces

The integration between type tracking and method resolution is incomplete:
1. Type bindings from variable declarations aren't being used effectively
2. Method receiver type lookup isn't checking all sources
3. Cross-file type resolution needs import resolution (depends on task 135)

## Affected Test Files

### TypeScript (3 .todo tests)
- `symbol_resolution.typescript.test.ts`
  - "resolves local method call on typed variable"
  - "resolves method chain on typed variable"
  - "resolves method call through type inference"

### Python (4 .todo tests)
- `symbol_resolution.python.test.ts`
  - "resolves method call with self parameter"
  - "resolves class method (@classmethod)"
  - "resolves static method (@staticmethod)"
  - "resolves property access (@property)"

### Rust (3 .todo tests)
- `symbol_resolution.rust.test.ts`
  - "resolves associated function (::new) locally"
  - "resolves method call on struct"
  - "resolves method from trait implementation"

## Implementation Plan

### Phase 1: Enhance TypeContext Integration (1 day)

**File**: `packages/core/src/resolve_references/type_resolution/type_context.ts`

Improve type binding lookup to check multiple sources:

```typescript
function get_binding_type(
  location: Location,
  scope_id: ScopeId,
  context: TypeContext,
  index: SemanticIndex
): SymbolName | null {
  const loc_key = location_key(location);

  // 1. Check explicit type bindings (from declarations)
  if (index.type_bindings_raw.has(loc_key)) {
    return index.type_bindings_raw.get(loc_key)!;
  }

  // 2. Check constructor calls (user = new User())
  const constructor_binding = context.constructor_bindings.get(loc_key);
  if (constructor_binding) {
    return constructor_binding;
  }

  // 3. Check function return types
  const call_ref = index.references_raw.find(r =>
    location_key(r.location) === loc_key && r.type === 'call'
  );
  if (call_ref) {
    const func_def = resolve_function(call_ref, index);
    if (func_def?.return_type) {
      return func_def.return_type;
    }
  }

  return null;
}
```

### Phase 2: Fix Local Method Resolution (0.5 days)

**File**: `packages/core/src/resolve_references/call_resolution/method_resolution.ts`

Update method resolution to use enhanced type context:

```typescript
export function resolve_method_call(
  reference: MethodCallReference,
  resolver_index: ScopeResolverIndex,
  type_context: TypeContext,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  cache: ResolutionCache
): SymbolId | null {
  const index = indices.get(reference.location.file_path);
  if (!index) return null;

  // Get receiver location from context
  const receiver_loc = reference.context?.receiver_location;
  if (!receiver_loc) return null;

  // Look up receiver type
  const receiver_type = get_binding_type(
    receiver_loc,
    reference.scope_id,
    type_context,
    index
  );

  if (!receiver_type) return null;

  // Find method in type members
  const type_members = index.type_members_raw.get(receiver_type);
  if (!type_members) return null;

  const method_id = type_members.methods.get(reference.name);
  return method_id || null;
}
```

### Phase 3: Fix TypeScript Tests (0.5 days)

**File**: `symbol_resolution.typescript.test.ts`

Remove `.todo()` from 3 tests:
1. "resolves local method call on typed variable"
   - Code: `const user: User = new User(); user.getName();`
2. "resolves method chain on typed variable"
   - Code: `const builder = new Builder(); builder.setName("x").setBuild();`
3. "resolves method call through type inference"
   - Code: `const user = new User(); user.getName();` (no explicit type)

### Phase 4: Fix Python Tests (1 day)

**File**: `symbol_resolution.python.test.ts`

Remove `.todo()` from 4 tests:
1. "resolves method call with self parameter"
   - Handle Python `self` parameter in method lookup
2. "resolves class method (@classmethod)"
   - Check for `@classmethod` decorator, resolve to class type
3. "resolves static method (@staticmethod)"
   - Check for `@staticmethod` decorator, no type needed
4. "resolves property access (@property)"
   - Check for `@property` decorator, treat as method call

**Special handling needed**:
```typescript
// Check decorators to determine method type
function get_python_method_type(method: MethodDefinition): 'instance' | 'class' | 'static' {
  if (method.decorators?.some(d => d.name === 'classmethod')) return 'class';
  if (method.decorators?.some(d => d.name === 'staticmethod')) return 'static';
  return 'instance';
}
```

### Phase 5: Fix Rust Tests (1 day)

**File**: `symbol_resolution.rust.test.ts`

Remove `.todo()` from 3 tests:
1. "resolves associated function (::new) locally"
   - Code: `User::new()` - resolve `User` type, find static method `new`
2. "resolves method call on struct"
   - Code: `user.get_name()` - resolve `user` type, find instance method
3. "resolves method from trait implementation"
   - Code: `impl Display for User { fn display() }` - resolve trait methods

**Special handling needed**:
```typescript
// Rust associated functions (Type::method) vs instance methods (value.method)
function is_associated_function_call(reference: CallReference): boolean {
  return reference.context?.call_style === 'associated'; // Type::method
}
```

### Phase 6: Integration Testing (0.5 days)

Run full test suite to ensure:
- Method resolution works for all languages
- Type tracking correctly identifies receiver types
- No regressions in existing tests
- Cache effectiveness maintained

## Acceptance Criteria

- [ ] All 10 method resolution tests pass (no more `.todo()`)
- [ ] TypeScript method calls resolve correctly
- [ ] Python decorators handled correctly (@classmethod, @staticmethod, @property)
- [ ] Rust associated functions vs instance methods work
- [ ] No performance regressions
- [ ] All existing tests still pass

## Dependencies

**Partially depends on Task 135** (Cross-File Import Resolution):
- Local method resolution can be implemented independently
- Cross-file method resolution requires import resolution
- Can mark cross-file tests as `.todo("requires task 135")` temporarily

## Testing Strategy

1. Unit tests for `get_binding_type()` function
2. Unit tests for decorator detection (Python)
3. Unit tests for associated function detection (Rust)
4. Integration tests verify method resolution works end-to-end
5. Performance tests ensure no regression

## Notes

- Start with local (same-file) method resolution
- Cross-file method calls depend on task 135 completing first
- Python decorators require special handling in method lookup
- Rust has two method call styles (instance vs associated)
- TypeScript has method chaining which needs careful type tracking
