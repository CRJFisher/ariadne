---
id: task-152
title: Split SymbolReference into specific reference types
status: In Progress
assignee: []
created_date: '2025-10-03 11:32'
labels: [architecture, type-safety, refactoring]
dependencies: []
priority: high
estimated_effort: 6-8 days
---

## Description

Split the monolithic `SymbolReference` interface into a discriminated union of specific reference types. This architectural refactor improves type safety by making optional fields required on specific variants and enables pattern matching for cleaner resolution code.

**Key Benefits**:
- **Type safety**: Compiler enforces required fields per variant (no `undefined` checks)
- **Pattern matching**: Clean dispatch using `switch(ref.kind)`
- **Self-documenting**: Each variant clearly shows its purpose
- **Impossible states prevented**: Can't have method call without receiver location

**Architecture**: Replace runtime checks with compile-time guarantees through discriminated unions.

---

## Implementation Strategy

### Phase 1: Core Infrastructure (Tasks 152.1 - 152.5)
Build the foundation for typed references without breaking existing code.

### Phase 2: Migration (Tasks 152.6 - 152.9)
Migrate ReferenceBuilder and resolution code to use typed variants.

### Phase 3: Self-Reference Bug Fix (Tasks 152.10 - 152.13)
Add `SelfReferenceCall` variant to fix the `this.method()` resolution bug (31% of call graph failures).

### Phase 4: Cleanup (Task 152.14)
Remove legacy code and verify all systems work.

---

## Sub-Tasks

### ✅ task-152.1: Define discriminated union types (COMPLETED)

**Status**: Done
**File**: `packages/types/src/symbol_references.ts`

**What was done**:
- Created `SymbolReference` as discriminated union
- Defined 8 variant types:
  - `SelfReferenceCall` (for `this.method()` bug fix)
  - `MethodCallReference`
  - `FunctionCallReference`
  - `ConstructorCallReference`
  - `VariableReference`
  - `PropertyAccessReference`
  - `TypeReference`
  - `AssignmentReference`
- Created type guards for each variant
- Kept `LegacySymbolReference` for backward compatibility

---

### task-152.2: Create reference factory system

**Estimated Effort**: 4 hours

**Files to create**:
- `packages/core/src/index_single_file/references/reference_factories.ts`

**Purpose**: Centralize reference creation logic in pure factory functions.

**Implementation**:

```typescript
import type {
  SymbolReference,
  SelfReferenceCall,
  MethodCallReference,
  FunctionCallReference,
  // ... other types
  Location,
  SymbolName,
  ScopeId,
  SelfReferenceKeyword,
} from "@ariadnejs/types";

/**
 * Factory for self-reference calls: this.method(), self.method()
 */
export function create_self_reference_call(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  keyword: SelfReferenceKeyword,
  property_chain: readonly SymbolName[]
): SelfReferenceCall {
  return {
    kind: 'self_reference_call',
    name,
    location,
    scope_id,
    keyword,
    property_chain,
  };
}

/**
 * Factory for method calls: obj.method()
 */
export function create_method_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  receiver_location: Location,
  property_chain: readonly SymbolName[]
): MethodCallReference {
  return {
    kind: 'method_call',
    name,
    location,
    scope_id,
    receiver_location,
    property_chain,
  };
}

/**
 * Factory for function calls: foo()
 */
export function create_function_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId
): FunctionCallReference {
  return {
    kind: 'function_call',
    name,
    location,
    scope_id,
  };
}

/**
 * Factory for constructor calls: new MyClass()
 */
export function create_constructor_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  construct_target: Location
): ConstructorCallReference {
  return {
    kind: 'constructor_call',
    name,
    location,
    scope_id,
    construct_target,
  };
}

/**
 * Factory for variable references: reading/writing variables
 */
export function create_variable_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  access_type: 'read' | 'write'
): VariableReference {
  return {
    kind: 'variable_reference',
    name,
    location,
    scope_id,
    access_type,
  };
}

/**
 * Factory for property access: obj.field (not calling)
 */
export function create_property_access_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  receiver_location: Location,
  property_chain: readonly SymbolName[],
  access_type: 'property' | 'index',
  is_optional_chain: boolean
): PropertyAccessReference {
  return {
    kind: 'property_access',
    name,
    location,
    scope_id,
    receiver_location,
    property_chain,
    access_type,
    is_optional_chain,
  };
}

/**
 * Factory for type references: type annotations, extends clauses
 */
export function create_type_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  type_context: 'annotation' | 'extends' | 'implements' | 'generic' | 'return'
): TypeReference {
  return {
    kind: 'type_reference',
    name,
    location,
    scope_id,
    type_context,
  };
}

/**
 * Factory for assignments: x = value
 */
export function create_assignment_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  target_location: Location
): AssignmentReference {
  return {
    kind: 'assignment',
    name,
    location,
    scope_id,
    target_location,
  };
}
```

**Success Criteria**:
- All factory functions are pure (no side effects)
- Each factory corresponds to one variant type
- Type parameters match variant requirements exactly
- Exported from reference_factories.ts

---

### task-152.3: Update metadata extractors to detect self-reference keywords

**Estimated Effort**: 3 hours

**Purpose**: Enable semantic index to detect `this`, `self`, `super` keywords so ReferenceBuilder can create `SelfReferenceCall` variants.

**Files to modify**:
1. `packages/core/src/index_single_file/query_code_tree/language_configs/metadata_types.ts`
2. `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts`
3. `packages/core/src/index_single_file/query_code_tree/language_configs/python_metadata.ts`
4. `packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts`

**Changes to metadata_types.ts**:

```typescript
import type { SelfReferenceKeyword } from "@ariadnejs/types";

export interface ReceiverInfo {
  location: Location;
  property_chain: string[];
  // NEW: Self-reference detection
  is_self_reference?: boolean;
  self_keyword?: SelfReferenceKeyword;
}
```

**Changes to javascript_metadata.ts** (lines 255, 274):

```typescript
// In extract_property_chain()
let is_self_reference = false;
let self_keyword: SelfReferenceKeyword | undefined;

if (object_node.type === "this") {
  chain.push("this");
  is_self_reference = true;
  self_keyword = "this";
} else if (object_node.type === "super") {
  chain.push("super");
  is_self_reference = true;
  self_keyword = "super";
}

// Return enhanced info
return {
  location,
  property_chain: chain,
  is_self_reference,
  self_keyword
};
```

**Changes to python_metadata.ts** (lines 236, 238):

```typescript
// In extract_property_chain()
let is_self_reference = false;
let self_keyword: SelfReferenceKeyword | undefined;

if (object_node.type === "identifier") {
  const text = object_node.text;
  chain.push(text);

  if (text === "self") {
    is_self_reference = true;
    self_keyword = "self";
  } else if (text === "cls") {
    is_self_reference = true;
    self_keyword = "cls";
  }
} else if (object_node.type === "call") {
  const func = object_node.childForFieldName("function");
  if (func?.type === "identifier" && func.text === "super") {
    chain.push("super");
    is_self_reference = true;
    self_keyword = "super";
  }
}
```

**Changes to rust_metadata.ts**:

```typescript
// Similar pattern: detect "self" identifier
if (object_node.type === "identifier" && object_node.text === "self") {
  chain.push("self");
  is_self_reference = true;
  self_keyword = "self";
}
```

**Success Criteria**:
- `ReceiverInfo` includes `is_self_reference` and `self_keyword` fields
- All extractors detect keywords in their language
- Property chains still include the keyword (backward compatible)

---

### task-152.4: Refactor ReferenceBuilder to use factory functions

**Estimated Effort**: 8 hours

**File**: `packages/core/src/index_single_file/references/reference_builder.ts`

**Purpose**: Migrate from creating monolithic references to creating typed variants using factories.

**Implementation Strategy**:

```typescript
import {
  create_self_reference_call,
  create_method_call_reference,
  create_function_call_reference,
  create_constructor_call_reference,
  create_variable_reference,
  create_property_access_reference,
  create_type_reference,
  create_assignment_reference,
} from "./reference_factories";

export class ReferenceBuilder {
  private references: SymbolReference[] = [];  // Now typed variants!

  process(capture: CaptureNode): ReferenceBuilder {
    const kind = determine_reference_kind(capture, this.extractors);

    // Dispatch to variant creation
    const reference = this.create_typed_reference(kind, capture);
    if (reference) {
      this.references.push(reference);
    }

    return this;
  }

  private create_typed_reference(
    kind: ReferenceKind,
    capture: CaptureNode
  ): SymbolReference | null {
    const location = capture.location;
    const scope_id = this.context.get_scope_id(location);
    const name = this.extract_name(capture);

    switch (kind) {
      case ReferenceKind.METHOD_CALL:
        return this.create_method_or_self_reference_call(capture, location, scope_id, name);

      case ReferenceKind.FUNCTION_CALL:
        return create_function_call_reference(name, location, scope_id);

      case ReferenceKind.CONSTRUCTOR_CALL:
        return this.create_constructor_reference(capture, location, scope_id, name);

      case ReferenceKind.VARIABLE_REFERENCE:
        return create_variable_reference(name, location, scope_id, 'read');

      case ReferenceKind.VARIABLE_WRITE:
        return create_variable_reference(name, location, scope_id, 'write');

      case ReferenceKind.PROPERTY_ACCESS:
        return this.create_property_access(capture, location, scope_id, name);

      case ReferenceKind.TYPE_REFERENCE:
        return create_type_reference(name, location, scope_id, 'annotation');

      case ReferenceKind.ASSIGNMENT:
        return this.create_assignment(capture, location, scope_id, name);

      default:
        return null;
    }
  }

  private create_method_or_self_reference_call(
    capture: CaptureNode,
    location: Location,
    scope_id: ScopeId,
    name: SymbolName
  ): SymbolReference | null {
    const receiver_info = this.extractors?.extract_call_receiver(capture.node);
    if (!receiver_info) return null;

    // Check for self-reference FIRST
    if (receiver_info.is_self_reference && receiver_info.self_keyword) {
      return create_self_reference_call(
        name,
        location,
        scope_id,
        receiver_info.self_keyword,
        receiver_info.property_chain as readonly SymbolName[]
      );
    }

    // Regular method call
    return create_method_call_reference(
      name,
      location,
      scope_id,
      receiver_info.location,
      receiver_info.property_chain as readonly SymbolName[]
    );
  }

  private create_constructor_reference(
    capture: CaptureNode,
    location: Location,
    scope_id: ScopeId,
    name: SymbolName
  ): ConstructorCallReference | null {
    const target_info = this.extractors?.extract_construct_target(capture.node);
    if (!target_info) return null;

    return create_constructor_call_reference(
      name,
      location,
      scope_id,
      target_info
    );
  }

  private create_property_access(
    capture: CaptureNode,
    location: Location,
    scope_id: ScopeId,
    name: SymbolName
  ): PropertyAccessReference | null {
    const chain_info = this.extractors?.extract_property_chain(capture.node);
    if (!chain_info) return null;

    return create_property_access_reference(
      name,
      location,
      scope_id,
      chain_info.location,
      chain_info.property_chain as readonly SymbolName[],
      'property',
      false  // TODO: detect optional chaining
    );
  }

  private create_assignment(
    capture: CaptureNode,
    location: Location,
    scope_id: ScopeId,
    name: SymbolName
  ): AssignmentReference {
    return create_assignment_reference(
      name,
      location,
      scope_id,
      location  // Target is the assignment location itself
    );
  }

  private extract_name(capture: CaptureNode): SymbolName {
    // Extract symbol name from capture node text
    return capture.node.text as SymbolName;
  }
}
```

**Key Changes**:
1. Remove old monolithic reference creation code (lines 350-500+)
2. Add `create_typed_reference()` dispatch method
3. Create variant-specific helper methods
4. Use factory functions for all reference creation
5. Check for self-reference keywords BEFORE creating method calls

**Success Criteria**:
- All references created are typed variants (no `LegacySymbolReference`)
- Self-reference calls correctly identified and typed
- Build completes without type errors in reference_builder.ts
- All reference fields properly populated

---

### task-152.5: Update resolution entry points to handle discriminated unions

**Estimated Effort**: 4 hours

**File**: `packages/core/src/resolve_references/resolution_registry.ts`

**Purpose**: Update main resolution dispatch to use pattern matching on `ref.kind` instead of checking optional fields.

**Current code** (lines 258-313):

```typescript
// OLD: Check optional fields
if (ref.type === "call") {
  if (ref.call_type === "method") {
    return resolve_single_method_call(...);
  } else if (ref.call_type === "constructor") {
    return resolve_constructor_call(...);
  } else {
    return resolve_function_call(...);
  }
}
```

**New code**:

```typescript
export function resolve_reference(
  ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  // Pattern match on kind
  switch (ref.kind) {
    case 'self_reference_call':
      return resolve_self_reference_call(ref, scopes, definitions, types);

    case 'method_call':
      return resolve_method_call(ref, scopes, definitions, types, resolutions);

    case 'function_call':
      return resolve_function_call(ref, scopes, definitions, resolutions);

    case 'constructor_call':
      return resolve_constructor_call(ref, scopes, definitions, types, resolutions);

    case 'variable_reference':
      return resolve_variable_reference(ref, scopes, resolutions);

    case 'property_access':
      return resolve_property_access(ref, scopes, definitions, types, resolutions);

    case 'type_reference':
      return resolve_type_reference(ref, scopes, definitions, resolutions);

    case 'assignment':
      return resolve_assignment_target(ref, scopes, resolutions);

    default:
      // Exhaustiveness check - TypeScript ensures all cases covered
      const _exhaustive: never = ref;
      return null;
  }
}
```

**Success Criteria**:
- Single dispatch point using switch statement
- No more checking `ref.type` or `ref.call_type`
- Exhaustiveness checking ensures all variants handled
- Clean separation of resolution logic per variant

---

### task-152.6: Refactor method_resolver.ts for typed variants

**Estimated Effort**: 4 hours

**File**: `packages/core/src/resolve_references/call_resolution/method_resolver.ts`

**Purpose**: Update method call resolution to work with typed `MethodCallReference` instead of checking optional context fields.

**Current signature**:
```typescript
export function resolve_single_method_call(
  call_ref: SymbolReference,  // Untyped
  // ...
): SymbolId | null {
  const receiver_loc = call_ref.context?.receiver_location;  // Optional field
  if (!receiver_loc) return null;  // Runtime check

  const chain = call_ref.context?.property_chain;  // Optional field
  // ...
}
```

**New signature**:
```typescript
export function resolve_method_call(
  ref: MethodCallReference,  // Typed parameter!
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  // ref.receiver_location always present - no check needed!
  // ref.property_chain always present - no check needed!

  const receiver_name = ref.property_chain[0];
  const receiver_symbol = resolutions.resolve(ref.scope_id, receiver_name);
  // ... clean resolution logic
}
```

**Key Changes**:
1. Remove all `call_ref.context?.field` optional chaining
2. Access fields directly: `ref.receiver_location`, `ref.property_chain`
3. Remove runtime undefined checks
4. Update function name: `resolve_single_method_call` → `resolve_method_call`

**Success Criteria**:
- No optional chaining in method resolver
- No runtime undefined checks for receiver_location or property_chain
- Function accepts `MethodCallReference` type (not generic `SymbolReference`)
- All method call resolution tests pass

---

### task-152.7: Create self_reference_resolver.ts

**Estimated Effort**: 4 hours

**File**: `packages/core/src/resolve_references/call_resolution/self_reference_resolver.ts` (NEW)

**Purpose**: Dedicated resolver for `SelfReferenceCall` variant, fixing the `this.method()` bug.

**Implementation**:

```typescript
import type {
  SelfReferenceCall,
  SelfReferenceKeyword,
  SymbolId,
  LexicalScope
} from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope_registry";
import { DefinitionRegistry } from "../registries/definition_registry";
import { TypeRegistry } from "../registries/type_registry";

/**
 * Resolve self-reference method calls: this.method(), self.method(), super.method()
 *
 * This resolver fixes the bug where short property chains like `this.method()`
 * failed to resolve because they bypassed keyword handling.
 *
 * Algorithm:
 * 1. Resolve keyword to containing type (class/struct/impl)
 * 2. Walk property chain if multi-step (this.field.method)
 * 3. Look up final method on resolved type
 */
export function resolve_self_reference_call(
  ref: SelfReferenceCall,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry
): SymbolId | null {
  // Step 1: Resolve keyword to containing type
  const containing_type = resolve_keyword_to_type(
    ref.keyword,
    ref.scope_id,
    scopes,
    definitions
  );
  if (!containing_type) return null;

  // Step 2: Walk property chain if needed (this.field.method)
  let current_type = containing_type;
  const chain = ref.property_chain;

  // Walk from index 1 (skip keyword) to second-to-last (skip method name)
  for (let i = 1; i < chain.length - 1; i++) {
    const field_name = chain[i];
    const field_symbol = types.get_type_member(current_type, field_name);
    if (!field_symbol) return null;

    current_type = types.get_symbol_type(field_symbol);
    if (!current_type) return null;
  }

  // Step 3: Look up final method on type
  return types.get_type_member(current_type, ref.name);
}

/**
 * Resolve keyword to containing type
 */
function resolve_keyword_to_type(
  keyword: SelfReferenceKeyword,
  scope_id: SymbolId,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  switch (keyword) {
    case 'this':
    case 'self':
    case 'cls':
      return find_containing_class(scope_id, scopes, definitions);

    case 'super':
      const containing_class = find_containing_class(scope_id, scopes, definitions);
      if (!containing_class) return null;
      return find_parent_class(containing_class, definitions);
  }
}

/**
 * Find containing class/struct/impl scope
 */
function find_containing_class(
  scope_id: SymbolId,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  const scope = scopes.get_scope(scope_id);
  if (!scope) return null;

  // Walk up scope tree to find class/struct/impl scope
  let current_scope: LexicalScope | undefined = scope;

  while (current_scope) {
    if (is_type_scope(current_scope.type)) {
      // Find class definition in parent scope
      return find_type_definition(current_scope, scopes, definitions);
    }

    // Move to parent
    if (current_scope.parent_id) {
      current_scope = scopes.get_scope(current_scope.parent_id);
    } else {
      break;
    }
  }

  return null;
}

function is_type_scope(scope_type: string): boolean {
  return scope_type === 'class'
    || scope_type === 'struct'
    || scope_type === 'impl'
    || scope_type === 'interface';
}

function find_type_definition(
  type_scope: LexicalScope,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  if (!type_scope.parent_id || !type_scope.name) {
    return null;
  }

  const parent_defs = definitions.get_scope_definitions(type_scope.parent_id);
  if (!parent_defs) return null;

  const class_symbol = parent_defs.get(type_scope.name);
  if (!class_symbol) return null;

  const class_def = definitions.get(class_symbol);
  if (!class_def || !is_type_definition(class_def.kind)) {
    return null;
  }

  return class_symbol;
}

function is_type_definition(kind: string): boolean {
  return kind === 'class'
    || kind === 'struct'
    || kind === 'interface'
    || kind === 'enum';
}

function find_parent_class(
  class_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolId | null {
  const class_def = definitions.get(class_id);
  if (!class_def || class_def.kind !== 'class') {
    return null;
  }

  // Get parent from extends clause
  // TODO: Implement extends tracking in definitions
  // For now, return null (super not fully supported)
  return null;
}
```

**Success Criteria**:
- `resolve_self_reference_call()` exported and integrated
- Handles `this`, `self`, `cls` keywords
- Walks multi-step property chains correctly
- Tests pass for all self-reference patterns

---

### task-152.8: Update constructor_tracking.ts

**Estimated Effort**: 2 hours

**File**: `packages/core/src/index_single_file/type_preprocessing/constructor_tracking.ts`

**Purpose**: Update constructor tracking to work with typed `ConstructorCallReference`.

**Current code** (lines 40-41):

```typescript
if (ref.call_type === "constructor" && ref.context?.construct_target) {
  const target_location = ref.context.construct_target;
  // ...
}
```

**New code**:

```typescript
if (ref.kind === 'constructor_call') {
  const target_location = ref.construct_target;  // Always present!
  // ...
}
```

**Success Criteria**:
- Uses `ref.kind` check instead of `ref.call_type`
- Accesses `ref.construct_target` directly (no optional chaining)
- Constructor tracking tests pass

---

### task-152.9: Update all tests for typed variants

**Estimated Effort**: 6 hours

**Files**: All test files in `packages/core/src/`

**Purpose**: Update test expectations to match new typed reference structure.

**Changes needed**:

```typescript
// Before
expect(ref.type).toBe("call");
expect(ref.call_type).toBe("method");
expect(ref.context?.receiver_location).toBeDefined();

// After
expect(ref.kind).toBe("method_call");
expect(ref.receiver_location).toBeDefined();  // Always present

// Type guards in tests
if (ref.kind === 'method_call') {
  expect(ref.property_chain).toEqual(['user', 'getName']);
}
```

**Test files to update**:
- `reference_builder.test.ts`
- `method_resolver.test.ts`
- `constructor_tracking.test.ts`
- `resolution_registry.test.ts`
- `test_nested_scope.test.ts`
- All language-specific tests

**Success Criteria**:
- All tests pass
- Tests use `ref.kind` for type discrimination
- Tests access typed fields directly (no optional chaining)
- Test coverage maintained or improved

---

### task-152.10: Write comprehensive self-reference tests

**Estimated Effort**: 3 hours

**File**: `packages/core/src/resolve_references/call_resolution/self_reference_resolver.test.ts` (NEW)

**Purpose**: Verify self-reference resolution works for all keywords and patterns.

**Test cases**:

```typescript
describe('self_reference_resolver', () => {
  describe('TypeScript this', () => {
    test('resolves this.method() to class method', () => {
      const code = `
        class Builder {
          build_class(node) { }
          process() { this.build_class(node); }
        }
      `;

      const index = index_single_file(code, 'test.ts', 'typescript');
      const ref = index.references.find(r => r.name === 'build_class');

      expect(ref?.kind).toBe('self_reference_call');
      if (ref?.kind === 'self_reference_call') {
        expect(ref.keyword).toBe('this');
        expect(ref.property_chain).toEqual(['this', 'build_class']);
      }

      const resolved = resolve_self_reference_call(ref!, scopes, definitions, types);
      expect(resolved).toBe('method:test.ts:Builder:build_class');
    });

    test('resolves this.field.method() to nested method', () => {
      const code = `
        class Container {
          registry: Registry;
          process() { this.registry.update(); }
        }
        class Registry {
          update() { }
        }
      `;

      // Test multi-step chain resolution
    });

    test('handles nested classes correctly', () => {
      const code = `
        class Outer {
          method() {
            class Inner {
              method() { this.method(); }
            }
          }
        }
      `;
      // Should resolve to Inner.method, not Outer.method
    });
  });

  describe('Python self', () => {
    test('resolves self.method() to class method', () => {
      const code = `
        class IndexBuilder:
            def build_class(self, node):
                pass
            def build_definitions(self, node):
                self.build_class(node)
      `;

      const index = index_single_file(code, 'test.py', 'python');
      const ref = index.references.find(r => r.name === 'build_class');

      expect(ref?.kind).toBe('self_reference_call');
      if (ref?.kind === 'self_reference_call') {
        expect(ref.keyword).toBe('self');
      }
    });

    test('handles cls for classmethods', () => {
      const code = `
        class MyClass:
            @classmethod
            def factory(cls):
                return cls.create()

            @classmethod
            def create(cls):
                pass
      `;

      // Should resolve cls.create to classmethod
    });
  });

  describe('Rust self', () => {
    test('resolves self.method() in impl block', () => {
      const code = `
        impl MyStruct {
            fn helper(&self) { }
            fn process(&self) {
                self.helper();
            }
        }
      `;

      const index = index_single_file(code, 'test.rs', 'rust');
      const ref = index.references.find(r => r.name === 'helper');

      expect(ref?.kind).toBe('self_reference_call');
      if (ref?.kind === 'self_reference_call') {
        expect(ref.keyword).toBe('self');
      }
    });
  });

  describe('super keyword', () => {
    test('resolves super.method() to parent class', () => {
      const code = `
        class Parent {
          process() { }
        }
        class Child extends Parent {
          process() { super.process(); }
        }
      `;

      // Test super resolution
      // Note: May return null if extends tracking not implemented
    });
  });

  describe('edge cases', () => {
    test('returns null for this in non-class scope', () => {
      const code = `
        function standalone() {
          this.method();
        }
      `;

      const index = index_single_file(code, 'test.ts', 'typescript');
      const ref = index.references.find(r => r.name === 'method');

      const resolved = resolve_self_reference_call(ref!, scopes, definitions, types);
      expect(resolved).toBeNull();
    });

    test('handles arrow functions with lexical this', () => {
      const code = `
        class MyClass {
          field = () => {
            this.helper();
          }
          helper() { }
        }
      `;

      // Arrow function inherits this from MyClass
    });
  });
});
```

**Success Criteria**:
- All test cases pass
- Coverage ≥ 95% for self_reference_resolver.ts
- Tests cover all languages (TypeScript, JavaScript, Python, Rust)
- Edge cases handled gracefully

---

### task-152.11: Integration testing - verify bug fix

**Estimated Effort**: 2 hours

**Purpose**: Verify that all 42 misidentified symbols from the analysis now resolve correctly.

**Test file**: `packages/core/src/resolve_references/integration/self_reference_bug_fix.test.ts` (NEW)

**Test cases**:

```typescript
describe('Self-reference bug fix integration tests', () => {
  test('definition_builder.ts: this.build_class resolves', () => {
    // Test actual code from definition_builder.ts
    const code = fs.readFileSync(
      'packages/core/src/index_single_file/definition_builder/definition_builder.ts',
      'utf-8'
    );

    const index = index_single_file(code, 'definition_builder.ts', 'typescript');
    const graph = detect_call_graph(index);

    // build_class should NOT be an entry point (it's called by process methods)
    const entry_points = find_entry_points(graph);
    expect(entry_points.map(e => e.name)).not.toContain('build_class');

    // build_class should have callers
    const build_class_node = graph.nodes.get('build_class');
    expect(build_class_node.callers.size).toBeGreaterThan(0);
  });

  test('python_scope_boundary_extractor.ts: self.extract_* resolves', () => {
    // Test Python extractor methods
  });

  test('all 42 misidentifications are fixed', () => {
    // Load the misidentified symbols from analysis
    const misidentified = JSON.parse(
      fs.readFileSync('top-level-nodes-analysis/results/internal_misidentified.json', 'utf-8')
    );

    // Filter for self-reference related failures
    const self_ref_failures = misidentified.filter(item =>
      item.reasoning.includes('this') ||
      item.reasoning.includes('self') ||
      item.reasoning.includes('property chain')
    );

    expect(self_ref_failures.length).toBe(42);

    // Verify each one resolves correctly now
    for (const failure of self_ref_failures) {
      // Re-run analysis on the file
      // Verify the symbol is no longer misidentified
    }
  });
});
```

**Success Criteria**:
- All 42 misidentified symbols resolve correctly
- Entry point detection accuracy improves by 31%
- No regressions in other call graph analysis

---

### task-152.12: Remove legacy code and deprecated types

**Estimated Effort**: 2 hours

**Purpose**: Clean up backward compatibility code now that migration is complete.

**Files to update**:
1. `packages/types/src/symbol_references.ts` - Remove `LegacySymbolReference`, `ReferenceContext`
2. `packages/core/src/index_single_file/references/reference_builder.ts` - Remove old creation code

**Changes**:

```typescript
// DELETE from symbol_references.ts:
export interface ReferenceContext { ... }
export interface LegacySymbolReference { ... }

// DELETE from reference_builder.ts:
// All old monolithic reference creation code (lines 350-500+)
```

**Success Criteria**:
- No references to `LegacySymbolReference` in codebase
- No references to `ReferenceContext` (except metadata extractors)
- Build completes without errors
- All tests pass

---

### task-152.13: Update documentation

**Estimated Effort**: 2 hours

**Purpose**: Document the new architecture for future maintainers.

**Files to update**:

1. **ARCHITECTURE.md** (create if doesn't exist):
```markdown
## Reference System Architecture

### Discriminated Union Types

Symbol references use a discriminated union with 8 variants:

- `SelfReferenceCall`: this.method(), self.method()
- `MethodCallReference`: obj.method()
- `FunctionCallReference`: foo()
- `ConstructorCallReference`: new MyClass()
- `VariableReference`: x, y
- `PropertyAccessReference`: obj.field
- `TypeReference`: type annotations
- `AssignmentReference`: x = value

### Pattern Matching

Resolution uses pattern matching on `ref.kind`:

\`\`\`typescript
switch (ref.kind) {
  case 'self_reference_call':
    return resolve_self_reference_call(ref);
  case 'method_call':
    return resolve_method_call(ref);
  // ... other cases
}
\`\`\`

### Type Safety

Each variant has exactly the fields it needs:
- `MethodCallReference.receiver_location` is REQUIRED (not optional)
- `SelfReferenceCall.keyword` is REQUIRED
- Impossible states are unrepresentable

### Adding New Reference Types

1. Add variant to discriminated union in `symbol_references.ts`
2. Create factory function in `reference_factories.ts`
3. Add case to `ReferenceBuilder.create_typed_reference()`
4. Add case to `resolve_reference()` pattern match
5. Implement resolver function
```

2. **README.md** - Add section on reference types
3. **packages/types/README.md** - Document type system

**Success Criteria**:
- Architecture documented
- Examples provided for adding new types
- Migration guide for external consumers

---

### task-152.14: Final verification and performance testing

**Estimated Effort**: 2 hours

**Purpose**: Ensure no regressions and measure performance impact.

**Verification checklist**:
- [ ] All tests pass (`npm test`)
- [ ] Build completes without errors (`npm run build`)
- [ ] Type checking passes (`npx tsc --noEmit`)
- [ ] No unused exports (`npx ts-prune`)
- [ ] Linting passes (`npm run lint`)

**Performance testing**:

```bash
# Before and after comparison
npm run build
time npm test

# Measure resolution performance
node scripts/benchmark_resolution.js

# Expected: <5% performance difference (within noise)
```

**Success Criteria**:
- No regressions in functionality
- Performance within ±5% of baseline
- Type coverage maintained or improved
- All CI checks pass

---

## Success Metrics

### Quantitative:
- [ ] 0 TypeScript errors
- [ ] 100% test pass rate
- [ ] ≥95% type coverage on new code
- [ ] <5% performance impact
- [ ] 42 misidentified symbols fixed (31% improvement in call graph accuracy)

### Qualitative:
- [ ] Code is more readable (pattern matching vs conditionals)
- [ ] Type safety improved (required fields, no undefined checks)
- [ ] Architecture is extensible (easy to add new reference types)
- [ ] Documentation is comprehensive

---

## Timeline

**Week 1**:
- Day 1-2: Tasks 152.1-152.3 (types, factories, metadata)
- Day 3-5: Tasks 152.4-152.5 (ReferenceBuilder, resolution entry)

**Week 2**:
- Day 1-2: Tasks 152.6-152.8 (resolvers, constructor tracking)
- Day 3-5: Tasks 152.9-152.10 (tests, self-reference tests)

**Week 3**:
- Day 1-2: Tasks 152.11-152.13 (integration, cleanup, docs)
- Day 3: Task 152.14 (final verification)

**Total**: 15 days (3 weeks) with buffer

---

## Dependencies

None - this is a foundational refactor that enables future improvements.

## Blocks

This task blocks:
- **task-epic-11.156**: Anonymous callback function capture (depends on typed references)
- **task-epic-11.158**: Interface method resolution (depends on pattern matching)
- Any other reference-related improvements

---

## Notes

### Why This Order?

1. **Types first** (152.1): Foundation for everything else
2. **Factories** (152.2): Centralize creation logic
3. **Metadata** (152.3): Enable self-reference detection at semantic index time
4. **ReferenceBuilder** (152.4): Migrate creation to use factories
5. **Resolution** (152.5-152.7): Migrate consumption to use pattern matching
6. **Tests** (152.9-152.11): Verify everything works
7. **Cleanup** (152.12-152.14): Remove legacy code, finalize

### Risk Mitigation

- **Large refactor risk**: Mitigated by keeping legacy types during migration
- **Breaking changes**: Mitigated by comprehensive test coverage
- **Performance risk**: Mitigated by benchmarking before/after

### Future Enhancements

After this task, we can easily add:
- More reference variants (e.g., `ImportReference`, `ExportReference`)
- Richer metadata per variant
- Specialized resolvers with variant-specific optimizations
