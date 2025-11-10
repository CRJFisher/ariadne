# Task Epic-11.155: Self-Reference Keyword Resolution (this/self/super)

**Status**: TODO
**Priority**: P0 (High Impact)
**Estimated Effort**: 2-3 days
**Epic**: epic-11-codebase-restructuring
**Impact**: Fixes 42 misidentified symbols (31% of all call graph bugs)

## Problem

Method calls using self-reference keywords fail to resolve when the property chain is short (≤2 elements):

### Current Bug

```typescript
// method_resolver.ts lines 82-110
if (chain && chain.length > 2) {
  // ✅ Long chains route to resolve_property_chain() which handles "this" keyword
  receiver_type = resolve_property_chain(...);  // Has "this" handling at line 240
}
else {
  // ❌ Short chains try to resolve "this" as a variable name
  const receiver_name = (chain && chain[0]) || call_ref.name;
  const receiver_symbol = resolutions.resolve(call_ref.scope_id, receiver_name);
  // ^ Fails because "this" is not a variable in scope
}
```

### Affected Patterns

**TypeScript/JavaScript**:
```typescript
this.build_class(state)           // ❌ Fails (chain length = 2)
this.definitions.update_file()    // ✅ Works (chain length = 3)
super.extract_boundaries()        // ❌ Fails (not handled at all)
```

**Python**:
```python
self.process_scope(node)          # ❌ Fails (chain length = 2)
self.registry.add_definition()    # ✅ Works (chain length = 3)
super().extract_boundaries()      # ❌ Fails (not handled at all)
```

**Rust**:
```rust
self.build_struct(state)          // ❌ Fails (chain length = 2)
self.registry.add_definition()    // ✅ Works (chain length = 3)
```

## Root Cause Analysis

The bug exists because of an architectural assumption that **syntax determines semantics**:

```typescript
// WRONG: Using chain length as a proxy for complexity
if (chain.length > 2) {
  use_sophisticated_resolution();  // Has keyword handling
} else {
  use_simple_variable_lookup();     // No keyword handling
}
```

**The fundamental error**: `this`/`self`/`super` are **scope context keywords**, not variables. They should NEVER route to variable resolution, regardless of property chain length.

## Design Principles

### 1. **Keyword Detection is Semantic, Not Syntactic**

Self-reference keywords have special meaning independent of chain length:
- `this` → current class instance (TypeScript/JavaScript)
- `self` → current struct/impl instance (Rust, Python)
- `super` → parent class instance (all languages)

### 2. **Unified Cross-Language Handling**

All languages use the same semantic pattern:
1. Detect keyword at chain start
2. Resolve to containing type scope
3. Look up member on that type

Language-specific differences:
- **Keyword names**: `this` vs `self` vs `super`
- **Scope types**: class vs struct vs impl block
- **Inheritance**: `super` requires parent class lookup

### 3. **Architectural Separation**

```
┌─────────────────────────────────────┐
│ Keyword Detection                   │  ← NEW: Extract before routing
│ (this/self/super)                   │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌─────────────┐  ┌─────────────┐
│  Keyword    │  │  Variable   │
│ Resolution  │  │ Resolution  │
└─────────────┘  └─────────────┘
```

**Current architecture**: Keyword detection happens INSIDE property chain resolution (only for long chains)

**Fixed architecture**: Keyword detection happens BEFORE routing decision

## Implementation Plan

### Phase 1: Unified Keyword Detection (0.5 days)

Create `resolve_references/call_resolution/keyword_detector.ts`:

```typescript
export type SelfReferenceKeyword = 'this' | 'self' | 'super';

export function detect_self_reference_keyword(
  property_chain: string[]
): SelfReferenceKeyword | null {
  if (property_chain.length === 0) return null;

  const first = property_chain[0];
  if (first === 'this' || first === 'self' || first === 'super') {
    return first as SelfReferenceKeyword;
  }

  return null;
}

export function is_self_reference_call(call_ref: SymbolReference): boolean {
  const chain = call_ref.context?.property_chain;
  return chain ? detect_self_reference_keyword(chain) !== null : false;
}
```

### Phase 2: Extract `this`/`self` Resolution (1 day)

Move keyword handling OUT of `resolve_property_chain()` into standalone function:

```typescript
// resolve_references/call_resolution/self_reference_resolver.ts

export function resolve_self_reference(
  keyword: SelfReferenceKeyword,
  scope_id: SymbolId,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  const scope = scopes.get_scope(scope_id);
  if (!scope) return null;

  switch (keyword) {
    case 'this':
    case 'self':
      return resolve_containing_type(scope, scopes, definitions);

    case 'super':
      return resolve_parent_type(scope, scopes, definitions);
  }
}

function resolve_containing_type(
  scope: LexicalScope,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  // Walk up scope chain to find class/struct/impl scope
  let current_scope: LexicalScope | undefined = scope;

  while (current_scope) {
    if (is_type_scope(current_scope.type)) {
      // Find the definition that created this scope
      return find_scope_definition(current_scope, scopes, definitions);
    }

    current_scope = current_scope.parent_id
      ? scopes.get_scope(current_scope.parent_id)
      : undefined;
  }

  return null;
}

function resolve_parent_type(
  scope: LexicalScope,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  // First find containing type
  const containing_type = resolve_containing_type(scope, scopes, definitions);
  if (!containing_type) return null;

  // Look up parent class/trait in definition
  const def = definitions.get(containing_type);
  if (!def) return null;

  // Get parent from extends/implements/inherits
  if (def.kind === 'class' && def.extends) {
    return def.extends;  // Assumes extends is SymbolId
  }

  // TODO: Handle Rust trait bounds, Python super() with explicit parent

  return null;
}

function is_type_scope(scope_type: string): boolean {
  return scope_type === 'class'
    || scope_type === 'struct'
    || scope_type === 'impl'
    || scope_type === 'interface';
}

function find_scope_definition(
  type_scope: LexicalScope,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  // Implementation extracted from current resolve_property_chain() lines 276-293
  if (!type_scope.parent_id || !type_scope.name) {
    return null;
  }

  const parent_scope_defs = definitions.get_scope_definitions(type_scope.parent_id);
  if (!parent_scope_defs) return null;

  const symbol = parent_scope_defs.get(type_scope.name);
  if (!symbol) return null;

  const def = definitions.get(symbol);
  if (!def || !is_type_definition(def.kind)) return null;

  return symbol;
}

function is_type_definition(kind: string): boolean {
  return kind === 'class'
    || kind === 'interface'
    || kind === 'struct'
    || kind === 'enum';
}
```

### Phase 3: Refactor `resolve_single_method_call()` (0.5 days)

Update routing logic to detect keywords FIRST:

```typescript
export function resolve_single_method_call(
  call_ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  const receiver_loc = call_ref.context?.receiver_location;
  if (!receiver_loc) return null;

  const chain = call_ref.context?.property_chain;
  let receiver_type: SymbolId | null = null;

  // NEW: Check for self-reference keywords FIRST
  const keyword = chain ? detect_self_reference_keyword(chain) : null;

  if (keyword) {
    // Route to keyword-specific resolution
    const self_type = resolve_self_reference(
      keyword,
      call_ref.scope_id,
      scopes,
      definitions
    );

    if (!self_type) return null;

    // If chain is just [keyword, method], we have the type
    if (chain.length === 2) {
      receiver_type = self_type;
    } else {
      // Walk remaining chain: this.field.method
      receiver_type = resolve_property_chain_from_type(
        self_type,
        chain.slice(1, -1),  // Skip keyword and method name
        types,
        definitions
      );
    }
  }
  else if (chain && chain.length > 2) {
    // Long non-keyword chains
    receiver_type = resolve_property_chain(...);
  }
  else {
    // Simple variable/namespace resolution
    const receiver_name = (chain && chain[0]) || call_ref.name;
    const receiver_symbol = resolutions.resolve(call_ref.scope_id, receiver_name);
    // ... existing logic ...
  }

  // Rest of method lookup logic unchanged
  if (!receiver_type) return null;

  let method_symbol = types.get_type_member(receiver_type, call_ref.name);
  // ... existing fallback logic ...

  return method_symbol;
}
```

### Phase 4: Language-Specific Adaptations (1 day)

#### Python `super()` Handling

Python's `super()` is a function call, not a keyword:

```python
super().extract_boundaries()  # super() returns proxy object
```

**Detection**: Check for `super` in function call position, not just property chain.

#### Rust Trait Implementation Resolution

```rust
impl MyTrait for MyStruct {
  fn method(&self) { /* ... */ }
}
```

`self` inside `impl` block should resolve to `MyStruct`, not the trait.

**Strategy**: When resolving `self`, check if scope is `impl` block and resolve to the implementing type.

#### TypeScript/JavaScript `super` in Constructors

```typescript
class Child extends Parent {
  constructor() {
    super();  // Constructor call, not method access
  }
}
```

**Detection**: `super` as call receiver (type: 'construct') should resolve to parent constructor.

### Phase 5: Testing (0.5 days)

Create comprehensive tests for all patterns:

```typescript
// resolve_references/call_resolution/self_reference_resolver.test.ts

describe('self_reference_resolver', () => {
  describe('this keyword', () => {
    test('resolves this.method() calls', () => { /* ... */ });
    test('resolves this.field.method() calls', () => { /* ... */ });
    test('handles nested class scopes', () => { /* ... */ });
  });

  describe('super keyword', () => {
    test('resolves super.method() calls', () => { /* ... */ });
    test('resolves super constructor calls', () => { /* ... */ });
    test('handles multiple inheritance levels', () => { /* ... */ });
  });

  describe('self keyword (Rust)', () => {
    test('resolves self.method() in impl blocks', () => { /* ... */ });
    test('resolves to implementing type, not trait', () => { /* ... */ });
  });

  describe('self keyword (Python)', () => {
    test('resolves self.method() in class methods', () => { /* ... */ });
    test('resolves super().method() proxy calls', () => { /* ... */ });
  });
});
```

## Success Criteria

- [ ] All 42 `this.method()` misidentifications resolve correctly
- [ ] `super.method()` calls resolve to parent class methods
- [ ] Python `self` and `super()` work correctly
- [ ] Rust `self` in impl blocks resolves to implementing type
- [ ] No regressions in long property chain resolution
- [ ] Test coverage ≥95% for new code
- [ ] Performance: <5ms overhead per keyword resolution

## Files Changed

**New files**:
- `packages/core/src/resolve_references/call_resolution/keyword_detector.ts`
- `packages/core/src/resolve_references/call_resolution/self_reference_resolver.ts`
- `packages/core/src/resolve_references/call_resolution/self_reference_resolver.test.ts`

**Modified files**:
- `packages/core/src/resolve_references/call_resolution/method_resolver.ts`
  - Extract `resolve_containing_type()` logic to new module
  - Add keyword detection before routing
  - Route keyword calls to specialized resolver

## Affected Misidentifications (42 total)

### definition_builder.ts (27 instances)
Lines: 874, 902, 925, 948, 971, 994, 1017, 1040, 1063, 1086, 1109, 1132, 1155, 1178, 1201, 1224, 1247, 1270, 1293, 1316, 1339, 1362, 1385, 1408, 1431, 1454, 1477

### Scope Boundary Extractors (29 instances)
- `python_scope_boundary_extractor.ts`: 10 instances
- `rust_scope_boundary_extractor.ts`: 10 instances
- `typescript_scope_boundary_extractor.ts`: 7 instances
- `javascript_typescript_scope_boundary_extractor.ts`: 6 instances
- `scope_boundary_base.ts`: 6 instances

### Registry Classes (15 instances)
- `export_registry.ts`: 8 instances
- `type_registry.ts`: 7 instances

All use Template Method pattern with `this.extract_*_boundaries()` calls.

## Related Tasks

- **task-epic-11.156**: Anonymous callback function capture (9% of bugs)
- **task-epic-11.157**: Interface method resolution with multiple candidates (7% of bugs)
- **task-155**: Type flow inference through built-ins (related to type tracking)

## Implementation Notes

### Why Not Fix the Conditional?

**Tempting quick fix**:
```typescript
if (chain && chain[0] === 'this') {
  // Always use property chain resolution for "this"
  receiver_type = resolve_property_chain(...);
}
```

**Why we're not doing this**:
1. Doesn't handle `self` (Rust/Python) or `super`
2. Leaves keyword logic buried inside property chain resolution
3. Doesn't set up architecture for future keyword additions
4. Violates separation of concerns (routing based on syntax, not semantics)

The proper fix requires **architectural refactoring** to separate keyword detection from resolution strategy.

### Super Resolution Complexity

`super` is more complex than `this`/`self`:
- Requires inheritance relationship tracking
- Python's `super()` is a function call (needs special detection)
- Rust doesn't have `super` (uses explicit trait names)
- TypeScript `super` in constructors vs methods (different semantics)

**Phased approach**:
1. Fix `this`/`self` first (90% of the 42 instances)
2. Add `super` support incrementally per language
3. Document limitations for complex inheritance (multiple inheritance, mixins)

## Out of Scope

- **Multiple inheritance**: Python's MRO (Method Resolution Order) for multiple inheritance
- **Mixins/Traits**: Complex composition patterns
- **Dynamic super()**: Python's `super()` with explicit class arguments
- **Proxy patterns**: Objects that forward `this` to wrapped instances

These are edge cases that can be addressed in follow-up tasks if analysis shows they're common.
