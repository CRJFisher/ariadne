# Task 152.4: Refactor ReferenceBuilder to Use Factory Functions

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: High
**Estimated Effort**: 8 hours
**Phase**: 1 - Core Infrastructure

## Purpose

Refactor `ReferenceBuilder` to create typed reference variants using factory functions instead of object literals. This establishes the new reference creation pattern and eliminates direct object literal construction.

## Current State

`ReferenceBuilder` creates references using object literals with the legacy interface:

```typescript
// Current approach (DEPRECATED)
const reference: SymbolReference = {
  location,
  type: ReferenceType.METHOD_CALL,
  scope_id,
  name,
  context: {
    receiver_location,
    property_chain,
  },
};
```

## Implementation

### Update ReferenceBuilder

**File**: `packages/core/src/index_single_file/references/reference_builder.ts`

Replace object literal construction with factory function calls:

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
} from './reference_factories';
import type { SymbolReference } from '@ariadnejs/types';

export class ReferenceBuilder {
  private references: SymbolReference[] = [];

  /**
   * Build method call reference
   * Detects self-reference vs regular method calls using ReceiverInfo
   */
  add_method_call(
    name: SymbolName,
    location: Location,
    scope_id: ScopeId,
    receiver_info: ReceiverInfo
  ): void {
    // NEW: Check if this is a self-reference call
    if (receiver_info.is_self_reference && receiver_info.self_keyword) {
      const ref = create_self_reference_call(
        name,
        location,
        scope_id,
        receiver_info.self_keyword,
        receiver_info.property_chain
      );
      this.references.push(ref);
      return;
    }

    // Regular method call
    const ref = create_method_call_reference(
      name,
      location,
      scope_id,
      receiver_info.receiver_location,
      receiver_info.property_chain
    );
    this.references.push(ref);
  }

  /**
   * Build function call reference
   */
  add_function_call(
    name: SymbolName,
    location: Location,
    scope_id: ScopeId
  ): void {
    const ref = create_function_call_reference(name, location, scope_id);
    this.references.push(ref);
  }

  /**
   * Build constructor call reference
   */
  add_constructor_call(
    name: SymbolName,
    location: Location,
    scope_id: ScopeId,
    construct_target: Location
  ): void {
    const ref = create_constructor_call_reference(
      name,
      location,
      scope_id,
      construct_target
    );
    this.references.push(ref);
  }

  /**
   * Build variable reference
   */
  add_variable_reference(
    name: SymbolName,
    location: Location,
    scope_id: ScopeId,
    access_type: 'read' | 'write'
  ): void {
    const ref = create_variable_reference(name, location, scope_id, access_type);
    this.references.push(ref);
  }

  /**
   * Build property access reference
   */
  add_property_access(
    name: SymbolName,
    location: Location,
    scope_id: ScopeId,
    receiver_info: ReceiverInfo,
    access_type: 'property' | 'index',
    is_optional_chain: boolean
  ): void {
    // Check for self-reference property access
    if (receiver_info.is_self_reference && receiver_info.self_keyword) {
      // Property access on self (e.g., this.field, not this.method())
      // Still create PropertyAccessReference, but note it's on self
      const ref = create_property_access_reference(
        name,
        location,
        scope_id,
        receiver_info.receiver_location,
        receiver_info.property_chain,
        access_type,
        is_optional_chain
      );
      this.references.push(ref);
      return;
    }

    const ref = create_property_access_reference(
      name,
      location,
      scope_id,
      receiver_info.receiver_location,
      receiver_info.property_chain,
      access_type,
      is_optional_chain
    );
    this.references.push(ref);
  }

  /**
   * Build type reference
   */
  add_type_reference(
    name: SymbolName,
    location: Location,
    scope_id: ScopeId,
    type_context: 'annotation' | 'extends' | 'implements' | 'generic' | 'return'
  ): void {
    const ref = create_type_reference(name, location, scope_id, type_context);
    this.references.push(ref);
  }

  /**
   * Build assignment reference
   */
  add_assignment(
    name: SymbolName,
    location: Location,
    scope_id: ScopeId,
    target_location: Location
  ): void {
    const ref = create_assignment_reference(name, location, scope_id, target_location);
    this.references.push(ref);
  }

  /**
   * Get all built references
   */
  get_references(): readonly SymbolReference[] {
    return this.references;
  }

  /**
   * Clear references (for testing)
   */
  clear(): void {
    this.references = [];
  }
}
```

### Update Callers

**File**: `packages/core/src/index_single_file/references/reference_processor.ts`

Update to use new ReferenceBuilder methods:

```typescript
export function process_references(
  captures: CaptureNode[],
  scope_registry: ScopeRegistry,
  source_code: string,
  metadata_extractor: LanguageMetadataExtractor
): SymbolReference[] {
  const builder = new ReferenceBuilder();

  for (const capture of captures) {
    const capture_name = capture.name;
    const node = capture.node;

    switch (capture_name) {
      case 'method_call': {
        const receiver_info = metadata_extractor.extract_receiver_info(node, source_code);
        if (!receiver_info) break;

        const method_name = extract_method_name(node, source_code);
        const location = node_location(node);
        const scope_id = find_containing_scope(location, scope_registry);

        builder.add_method_call(method_name, location, scope_id, receiver_info);
        break;
      }

      case 'function_call': {
        const func_name = extract_function_name(node, source_code);
        const location = node_location(node);
        const scope_id = find_containing_scope(location, scope_registry);

        builder.add_function_call(func_name, location, scope_id);
        break;
      }

      case 'constructor_call': {
        const class_name = extract_class_name(node, source_code);
        const location = node_location(node);
        const scope_id = find_containing_scope(location, scope_registry);
        const construct_target = extract_construct_target(node);

        builder.add_constructor_call(class_name, location, scope_id, construct_target);
        break;
      }

      case 'variable_read': {
        const var_name = extract_variable_name(node, source_code);
        const location = node_location(node);
        const scope_id = find_containing_scope(location, scope_registry);

        builder.add_variable_reference(var_name, location, scope_id, 'read');
        break;
      }

      case 'variable_write': {
        const var_name = extract_variable_name(node, source_code);
        const location = node_location(node);
        const scope_id = find_containing_scope(location, scope_registry);

        builder.add_variable_reference(var_name, location, scope_id, 'write');
        break;
      }

      case 'property_access': {
        const receiver_info = metadata_extractor.extract_receiver_info(node, source_code);
        if (!receiver_info) break;

        const property_name = extract_property_name(node, source_code);
        const location = node_location(node);
        const scope_id = find_containing_scope(location, scope_registry);
        const is_optional = is_optional_chaining(node);

        builder.add_property_access(
          property_name,
          location,
          scope_id,
          receiver_info,
          'property',
          is_optional
        );
        break;
      }

      case 'type_reference': {
        const type_name = extract_type_name(node, source_code);
        const location = node_location(node);
        const scope_id = find_containing_scope(location, scope_registry);
        const context = determine_type_context(node);

        builder.add_type_reference(type_name, location, scope_id, context);
        break;
      }

      case 'assignment': {
        const target_name = extract_assignment_target(node, source_code);
        const location = node_location(node);
        const scope_id = find_containing_scope(location, scope_registry);
        const target_location = extract_target_location(node);

        builder.add_assignment(target_name, location, scope_id, target_location);
        break;
      }
    }
  }

  return builder.get_references();
}
```

## Key Changes

### Self-Reference Detection

The critical logic is in `add_method_call()`:

```typescript
if (receiver_info.is_self_reference && receiver_info.self_keyword) {
  // Create SelfReferenceCall variant
  const ref = create_self_reference_call(
    name,
    location,
    scope_id,
    receiver_info.self_keyword,
    receiver_info.property_chain
  );
  this.references.push(ref);
  return;
}
```

This uses the keyword information from task-152.3 to route to the correct factory.

### Type Safety

Factory functions enforce required fields:

```typescript
// Compiler ensures all required fields provided
create_self_reference_call(
  name,          // ✅ Required
  location,      // ✅ Required
  scope_id,      // ✅ Required
  keyword,       // ✅ Required - can't forget!
  property_chain // ✅ Required - can't forget!
);

// Old way - easy to miss fields
const ref = {
  location,
  name,
  // Oops, forgot keyword! ❌
};
```

## Testing Strategy

```typescript
// reference_builder.test.ts
describe('ReferenceBuilder', () => {
  let builder: ReferenceBuilder;

  beforeEach(() => {
    builder = new ReferenceBuilder();
  });

  describe('Self-reference calls', () => {
    test('creates SelfReferenceCall for this.method()', () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: mock_location,
        property_chain: ['this', 'build_class'],
        is_self_reference: true,
        self_keyword: 'this',
      };

      builder.add_method_call(
        'build_class' as SymbolName,
        mock_location,
        'scope:1' as ScopeId,
        receiver_info
      );

      const refs = builder.get_references();
      expect(refs).toHaveLength(1);

      const ref = refs[0];
      expect(ref.kind).toBe('self_reference_call');
      if (ref.kind === 'self_reference_call') {
        expect(ref.keyword).toBe('this');
        expect(ref.property_chain).toEqual(['this', 'build_class']);
      }
    });

    test('creates SelfReferenceCall for self.method() in Python', () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: mock_location,
        property_chain: ['self', 'process_data'],
        is_self_reference: true,
        self_keyword: 'self',
      };

      builder.add_method_call(
        'process_data' as SymbolName,
        mock_location,
        'scope:1' as ScopeId,
        receiver_info
      );

      const refs = builder.get_references();
      const ref = refs[0];
      expect(ref.kind).toBe('self_reference_call');
      if (ref.kind === 'self_reference_call') {
        expect(ref.keyword).toBe('self');
      }
    });

    test('creates SelfReferenceCall for super.method()', () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: mock_location,
        property_chain: ['super', 'process'],
        is_self_reference: true,
        self_keyword: 'super',
      };

      builder.add_method_call(
        'process' as SymbolName,
        mock_location,
        'scope:1' as ScopeId,
        receiver_info
      );

      const refs = builder.get_references();
      const ref = refs[0];
      expect(ref.kind).toBe('self_reference_call');
      if (ref.kind === 'self_reference_call') {
        expect(ref.keyword).toBe('super');
      }
    });
  });

  describe('Regular method calls', () => {
    test('creates MethodCallReference for obj.method()', () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: mock_location,
        property_chain: ['user', 'getName'],
        is_self_reference: false,
      };

      builder.add_method_call(
        'getName' as SymbolName,
        mock_location,
        'scope:1' as ScopeId,
        receiver_info
      );

      const refs = builder.get_references();
      const ref = refs[0];
      expect(ref.kind).toBe('method_call');
      if (ref.kind === 'method_call') {
        expect(ref.property_chain).toEqual(['user', 'getName']);
      }
    });
  });

  describe('Function calls', () => {
    test('creates FunctionCallReference', () => {
      builder.add_function_call(
        'processData' as SymbolName,
        mock_location,
        'scope:1' as ScopeId
      );

      const refs = builder.get_references();
      const ref = refs[0];
      expect(ref.kind).toBe('function_call');
    });
  });

  describe('Constructor calls', () => {
    test('creates ConstructorCallReference', () => {
      builder.add_constructor_call(
        'MyClass' as SymbolName,
        mock_location,
        'scope:1' as ScopeId,
        mock_target_location
      );

      const refs = builder.get_references();
      const ref = refs[0];
      expect(ref.kind).toBe('constructor_call');
    });
  });

  // Test other reference types similarly...
});
```

## Success Criteria

- [ ] All ReferenceBuilder methods use factory functions
- [ ] No direct object literal construction of references
- [ ] Self-reference calls routed to `create_self_reference_call()`
- [ ] Regular method calls routed to `create_method_call_reference()`
- [ ] All other reference types use appropriate factories
- [ ] Tests pass for all reference creation paths
- [ ] Type checker enforces required fields
- [ ] Build succeeds without errors

## Files Changed

**Modified**:
- `packages/core/src/index_single_file/references/reference_builder.ts`
- `packages/core/src/index_single_file/references/reference_processor.ts`

**New**:
- `packages/core/src/index_single_file/references/reference_builder.test.ts` (if not exist)

## Next Task

After completion, proceed to **task-152.5** (Update resolution entry points)
