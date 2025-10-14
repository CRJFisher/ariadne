# Task: Update Call Resolvers to Use TypeRegistry Directly

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.144 - Merge TypeContext into TypeRegistry
**Status**: Not Started
**Priority**: High
**Complexity**: Medium

## Overview

Update method_resolver and constructor_resolver to use TypeRegistry directly instead of TypeContext interface. Remove the `build_type_context_eager()` call from ResolutionRegistry.

## Context

**Current Flow:**
```typescript
// In ResolutionRegistry.resolve_calls()
const type_context = build_type_context_eager(
  semantic_indexes,
  definitions,
  types,
  this
);

// Then pass to resolvers
resolve_single_method_call(ref, scopes, definitions, type_context, this);
resolve_single_constructor_call(ref, definitions, this, type_context);
```

**Problem:**
- `build_type_context_eager()` rebuilds type maps every time resolve_calls() is invoked
- Creates temporary TypeContext object that duplicates TypeRegistry data
- TypeRegistry now has all TypeContext methods - no adapter needed

**New Flow:**
```typescript
// In ResolutionRegistry.resolve_calls()
// NO build_type_context_eager() call!

// Pass TypeRegistry directly
resolve_single_method_call(ref, scopes, definitions, types, this);
resolve_single_constructor_call(ref, definitions, this, types);
```

## Goals

1. Update method_resolver to accept TypeRegistry instead of TypeContext
2. Update constructor_resolver similarly
3. Remove build_type_context_eager() call from ResolutionRegistry.resolve_calls()
4. Update all tests to work with new signatures
5. Verify performance improvement (no repeated resolution)

## Implementation

### 1. Update method_resolver.ts

Change signature and implementation:

```typescript
// OLD signature
export function resolve_single_method_call(
  call_ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  type_context: TypeContext,  // ← OLD: interface
  resolutions: ResolutionRegistry
): SymbolId | null

// NEW signature
export function resolve_single_method_call(
  call_ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,  // ← NEW: concrete class
  resolutions: ResolutionRegistry
): SymbolId | null
```

Update implementation:

```typescript
export function resolve_single_method_call(
  call_ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,  // ← Changed
  resolutions: ResolutionRegistry
): SymbolId | null {
  // Extract receiver location from context
  const receiver_loc = call_ref.context?.receiver_location;
  if (!receiver_loc) {
    return null;
  }

  // Step 1: Resolve receiver to its symbol
  const receiver_name = extract_receiver_name(call_ref);
  const receiver_symbol = resolutions.resolve(call_ref.scope_id, receiver_name);
  if (!receiver_symbol) {
    return null;
  }

  // Step 2: Check if receiver is namespace import
  // Use TypeRegistry method (was type_context.get_namespace_member)
  const namespace_member = types.get_namespace_member(receiver_symbol, call_ref.name);
  if (namespace_member) {
    return namespace_member;
  }

  // Step 3: Get receiver's type
  // Use TypeRegistry method (was type_context.get_symbol_type)
  const receiver_type = types.get_symbol_type(receiver_symbol);
  if (!receiver_type) {
    return null;
  }

  // Step 4: Look up method on type
  // Use TypeRegistry method (was type_context.get_type_member)
  return types.get_type_member(receiver_type, call_ref.name);
}
```

Update imports:

```typescript
// OLD
import type { TypeContext } from "../type_resolution/type_context";

// NEW
import type { TypeRegistry } from "../../project/type_registry";
```

### 2. Update constructor_resolver.ts

Change signature:

```typescript
// OLD signature
export function resolve_single_constructor_call(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  type_context: TypeContext  // ← OLD
): SymbolId | null

// NEW signature
export function resolve_single_constructor_call(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  types: TypeRegistry  // ← NEW
): SymbolId | null
```

Update implementation (if it uses type_context, otherwise just signature change):

```typescript
export function resolve_single_constructor_call(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  types: TypeRegistry  // ← Changed
): SymbolId | null {
  // Constructor resolution typically just resolves the class name
  // May use types.get_type_member() to find constructor if needed

  // Resolve the class name in the call's scope
  const class_symbol = resolutions.resolve(call_ref.scope_id, call_ref.name);
  if (!class_symbol) {
    return null;
  }

  // Could look up constructor member if needed:
  // const constructor_symbol = types.get_type_member(class_symbol, "constructor" as SymbolName);

  return class_symbol;
}
```

Update imports:

```typescript
// OLD
import type { TypeContext } from "../type_resolution/type_context";

// NEW
import type { TypeRegistry } from "../../project/type_registry";
```

### 3. Update ResolutionRegistry.resolve_calls()

Remove build_type_context_eager() call:

```typescript
// In resolution_registry.ts

/**
 * Resolve all call references (function, method, constructor).
 * Uses pre-computed resolutions from this registry.
 *
 * @param file_references - Map of file_path → references
 * @param semantic_indexes - All semantic indexes (for TypeContext building)
 * @param scopes - Scope registry (for method resolution)
 * @param types - Type registry (provides type information directly)  // ← Updated doc
 * @param definitions - Definition registry (for constructor resolution)
 * @returns Array of resolved call references
 */
resolve_calls(
  file_references: Map<FilePath, readonly SymbolReference[]>,
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,  // May not be needed anymore
  scopes: ScopeRegistry,
  types: TypeRegistry,  // ← Already TypeRegistry, not TypeContext
  definitions: DefinitionRegistry
): CallReference[] {
  // OLD: Build TypeContext adapter
  // const type_context = build_type_context_eager(
  //   semantic_indexes,
  //   definitions,
  //   types,
  //   this
  // );

  // NEW: No adapter needed! TypeRegistry IS the type context

  const resolved_calls: CallReference[] = [];

  for (const references of file_references.values()) {
    for (const ref of references) {
      if (ref.type !== "call") {
        continue;
      }

      // Skip super calls for now
      if (ref.call_type === "super") {
        continue;
      }

      let resolved: SymbolId | null = null;

      switch (ref.call_type) {
        case "function":
          resolved = this.resolve(ref.scope_id, ref.name as SymbolName);
          break;

        case "method":
          // Pass TypeRegistry directly instead of TypeContext
          resolved = resolve_single_method_call(
            ref,
            scopes,
            definitions,
            types,      // ← Was type_context
            this
          );
          break;

        case "constructor":
          // Pass TypeRegistry directly instead of TypeContext
          resolved = resolve_single_constructor_call(
            ref,
            definitions,
            this,
            types       // ← Was type_context
          );
          break;
      }

      if (resolved && ref.call_type) {
        resolved_calls.push({
          ...ref,
          call_type: ref.call_type,
          symbol_id: resolved,
        });
      }
    }
  }

  return resolved_calls;
}
```

Remove import:

```typescript
// OLD
import { build_type_context_eager } from "./type_context_eager";

// NEW (remove the import)
// No longer needed!
```

### 4. Update Tests

Update method_resolver.test.ts:

```typescript
// OLD setup
const type_context = build_type_context_eager(...);

// NEW setup
const types = new TypeRegistry();
// Populate types with test data
types.update_file(file_id, index, definitions, resolutions);

// OLD test call
const result = resolve_single_method_call(ref, scopes, definitions, type_context, resolutions);

// NEW test call
const result = resolve_single_method_call(ref, scopes, definitions, types, resolutions);
```

Update constructor_resolver.test.ts similarly.

## Testing

### Existing Tests

Update and verify existing tests in:
- `method_resolver.test.ts`
- `constructor_resolver.test.ts`
- `resolution_registry.test.ts`

### New Integration Tests

Add test to verify no performance regression:

```typescript
describe("ResolutionRegistry - Performance", () => {
  it("should not rebuild type context on repeated resolve_calls", () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    project.update_file(file1, `
      class User {
        getName() { return ""; }
      }
      const user: User = new User();
      user.getName();
    `);

    // Call resolve_calls multiple times
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      project['resolutions'].resolve_calls(
        new Map([[file1, project['semantic_indexes'].get(file1)!.references]]),
        project['semantic_indexes'],
        project['scopes'],
        project['types'],
        project['definitions']
      );
    }
    const duration = performance.now() - start;

    // Should be fast (no type context rebuilding)
    expect(duration).toBeLessThan(100); // Adjust threshold as needed
  });
});
```

## Verification

After completing this task:

1. **Signatures updated**: method_resolver and constructor_resolver use TypeRegistry
2. **No adapter**: build_type_context_eager() call removed
3. **Tests pass**: All resolver tests passing
4. **Integration works**: End-to-end call resolution works
5. **Performance improved**: No repeated type context building

## Success Criteria

- [ ] method_resolver.ts uses TypeRegistry instead of TypeContext
- [ ] constructor_resolver.ts uses TypeRegistry instead of TypeContext
- [ ] ResolutionRegistry.resolve_calls() passes TypeRegistry directly
- [ ] build_type_context_eager() call removed from resolve_calls()
- [ ] All imports updated
- [ ] method_resolver tests updated and passing
- [ ] constructor_resolver tests updated and passing
- [ ] Integration tests passing
- [ ] Performance verified (no regression)

## Notes

- This is where we see the performance benefit: no repeated type context building
- TypeRegistry methods are called directly instead of through adapter
- semantic_indexes parameter to resolve_calls() may no longer be needed (check usage)
- Next task (11.144.5) will delete the obsolete TypeContext infrastructure
- After this task, TypeContext interface is no longer used anywhere

## Dependencies

- **Requires**: task-epic-11.144.3 completed (TypeRegistry must have resolved data)
- **Blocks**: task-epic-11.144.5 (can't delete TypeContext until resolvers updated)

## Estimated Effort

- Implementation: 1.5-2 hours
- Testing: 1-1.5 hours
- **Total**: 3-3.5 hours
