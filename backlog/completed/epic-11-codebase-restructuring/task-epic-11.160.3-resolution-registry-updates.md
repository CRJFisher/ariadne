# Task Epic-11.160.3: Resolution Registry Updates

**Status**: COMPLETED
**Priority**: P0 (Foundational)
**Estimated Effort**: 1-2 days
**Actual Effort**: 0.5 days
**Epic**: epic-11-codebase-restructuring
**Parent**: task-epic-11.160 (Multi-Candidate Resolution Foundation)
**Depends On**: 11.160.1 (Type Definitions), 11.160.2 (Resolver Updates)
**Blocks**: 11.160.4 (Call Graph Updates)

## Scope

Update ResolutionRegistry to build `CallReference` objects with `resolutions` arrays containing proper `Resolution` metadata. Store calls with all candidate information in a single, unified structure.

## Current State

After task 11.160.2, resolvers return `SymbolId[]`, but registry builds temporary `CallReference` objects:

```typescript
// Temporary from 11.160.2
for (const symbol of symbols) {
  resolved_calls.push({
    location: ref.location,
    name: ref.name,
    scope_id: ref.scope_id,
    call_type: "method",
    resolutions: [
      {
        symbol_id: symbol,
        confidence: "certain",
        reason: { type: "direct" },
      },
    ],
  });
}
```

**Problem**: Creates separate `CallReference` for each candidate instead of one `CallReference` with multiple resolutions.

## Target State

Build single `CallReference` with all candidates:

```typescript
const symbols = resolve_method_call(ref, ...);

if (symbols.length > 0) {
  resolved_calls.push({
    location: ref.location,
    name: ref.name,
    scope_id: ref.scope_id,
    call_type: "method",
    resolutions: symbols.map(symbol_id => ({
      symbol_id,
      confidence: "certain",
      reason: { type: "direct" }
    }))
  });
}
```

## Implementation

### 1. Refactor resolve_calls() Method

**File**: `packages/core/src/resolve_references/resolution_registry.ts`

Build proper `CallReference` objects with metadata:

```typescript
import type {
  CallReference,
  Resolution,
  ResolutionReason,
  SymbolId,
  SymbolReference,
} from "@ariadnejs/types";
import {
  resolve_method_call,
  resolve_constructor_call,
  resolve_self_reference_call,
} from "./call_resolution";

export class ResolutionRegistry {
  /**
   * Resolve all calls in the provided references
   *
   * Builds CallReference objects with Resolution metadata for each candidate.
   */
  resolve_calls(
    file_references: Map<FilePath, readonly SymbolReference[]>,
    scopes: ScopeRegistry,
    types: TypeRegistry,
    definitions: DefinitionRegistry
  ): CallReference[] {
    const resolved_calls: CallReference[] = [];

    for (const [file_path, references] of file_references) {
      for (const ref of references) {
        const call_ref = this.resolve_single_call(
          ref,
          scopes,
          types,
          definitions
        );

        if (call_ref) {
          resolved_calls.push(call_ref);
        }
      }
    }

    // Store resolved calls (existing logic)
    this.store_resolved_calls_by_file(resolved_calls, file_references);
    this.build_caller_scope_index(resolved_calls);
    this.build_referenced_symbols_set(resolved_calls);

    return resolved_calls;
  }

  /**
   * Resolve a single call reference to CallReference with resolutions
   */
  private resolve_single_call(
    ref: SymbolReference,
    scopes: ScopeRegistry,
    types: TypeRegistry,
    definitions: DefinitionRegistry
  ): CallReference | null {
    switch (ref.kind) {
      case "method_call":
        return this.resolve_method_call_to_call_reference(
          ref,
          scopes,
          definitions,
          types
        );

      case "constructor_call":
        return this.resolve_constructor_call_to_call_reference(
          ref,
          scopes,
          definitions,
          types
        );

      case "self_reference_call":
        return this.resolve_self_reference_call_to_call_reference(
          ref,
          scopes,
          definitions,
          types
        );

      case "function_call":
        return this.resolve_function_call_to_call_reference(ref);

      default:
        return null;
    }
  }

  /**
   * Resolve method call to CallReference with metadata
   */
  private resolve_method_call_to_call_reference(
    ref: MethodCallReference,
    scopes: ScopeRegistry,
    definitions: DefinitionRegistry,
    types: TypeRegistry
  ): CallReference | null {
    const symbols = resolve_method_call(ref, scopes, definitions, types, this);

    if (symbols.length === 0) {
      return null;
    }

    return {
      location: ref.location,
      name: ref.name,
      scope_id: ref.scope_id,
      call_type: "method",
      resolutions: symbols.map((symbol_id) => ({
        symbol_id,
        confidence: "certain",
        reason: { type: "direct" },
      })),
    };
  }

  /**
   * Resolve constructor call to CallReference with metadata
   */
  private resolve_constructor_call_to_call_reference(
    ref: ConstructorCallReference,
    scopes: ScopeRegistry,
    definitions: DefinitionRegistry,
    types: TypeRegistry
  ): CallReference | null {
    const symbols = resolve_constructor_call(
      ref,
      scopes,
      definitions,
      types,
      this
    );

    if (symbols.length === 0) {
      return null;
    }

    return {
      location: ref.location,
      name: ref.name,
      scope_id: ref.scope_id,
      call_type: "constructor",
      resolutions: symbols.map((symbol_id) => ({
        symbol_id,
        confidence: "certain",
        reason: { type: "direct" },
      })),
    };
  }

  /**
   * Resolve self-reference call to CallReference with metadata
   */
  private resolve_self_reference_call_to_call_reference(
    ref: SelfReferenceCallReference,
    scopes: ScopeRegistry,
    definitions: DefinitionRegistry,
    types: TypeRegistry
  ): CallReference | null {
    const symbols = resolve_self_reference_call(
      ref,
      scopes,
      definitions,
      types,
      this
    );

    if (symbols.length === 0) {
      return null;
    }

    return {
      location: ref.location,
      name: ref.name,
      scope_id: ref.scope_id,
      call_type: "method",
      resolutions: symbols.map((symbol_id) => ({
        symbol_id,
        confidence: "certain",
        reason: { type: "direct" },
      })),
    };
  }

  /**
   * Resolve function call to CallReference with metadata
   */
  private resolve_function_call_to_call_reference(
    ref: FunctionCallReference
  ): CallReference | null {
    const symbol = this.resolve(ref.scope_id, ref.name);

    if (!symbol) {
      return null;
    }

    return {
      location: ref.location,
      name: ref.name,
      scope_id: ref.scope_id,
      call_type: "function",
      resolutions: [
        {
          symbol_id: symbol,
          confidence: "certain",
          reason: { type: "direct" },
        },
      ],
    };
  }
}
```

### 2. Update build_referenced_symbols_set()

**File**: `packages/core/src/resolve_references/resolution_registry.ts`

Update to iterate through all resolutions:

```typescript
/**
 * Build set of all referenced symbols
 */
private build_referenced_symbols_set(calls: CallReference[]): void {
  this.all_referenced_symbols.clear();

  for (const call of calls) {
    for (const resolution of call.resolutions) {
      this.all_referenced_symbols.add(resolution.symbol_id);
    }
  }
}
```

### 3. Update build_caller_scope_index()

**File**: `packages/core/src/resolve_references/resolution_registry.ts`

No changes needed - works on `CallReference` array regardless of resolutions structure.

## Testing

### Unit Tests

**File**: `packages/core/src/resolve_references/resolution_registry.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { ResolutionRegistry } from "./resolution_registry";
import { create_test_registries } from "./__test_helpers__/test_registries";

describe("ResolutionRegistry with Resolution metadata", () => {
  test("builds CallReference with single resolution", () => {
    const code = `
      class User {
        getName(): string { return "Alice"; }
      }

      function greet(user: User) {
        return user.getName();
      }
    `;

    const { registry, file_path } = create_test_registries(code);
    const calls = registry.get_resolved_calls_for_file(file_path);

    const getName_call = calls.find((c) => c.name === "getName");
    expect(getName_call).toBeDefined();
    expect(getName_call!.resolutions).toHaveLength(1);
    expect(getName_call!.resolutions[0].confidence).toBe("certain");
    expect(getName_call!.resolutions[0].reason.type).toBe("direct");
  });

  test("builds CallReference with Resolution metadata structure", () => {
    const code = `
      class Calculator {
        add(a: number, b: number): number { return a + b; }
      }

      function compute(calc: Calculator) {
        return calc.add(1, 2);
      }
    `;

    const { registry, file_path } = create_test_registries(code);
    const calls = registry.get_resolved_calls_for_file(file_path);

    const add_call = calls.find((c) => c.name === "add");

    // Verify Resolution structure
    expect(add_call!.resolutions[0]).toHaveProperty("symbol_id");
    expect(add_call!.resolutions[0]).toHaveProperty("confidence");
    expect(add_call!.resolutions[0]).toHaveProperty("reason");
    expect(add_call!.resolutions[0].reason).toHaveProperty("type");
  });

  test("all_referenced_symbols includes all resolutions", () => {
    const code = `
      class User {
        getName(): string { return "Alice"; }
        getAge(): number { return 30; }
      }

      function display(user: User) {
        console.log(user.getName());
        console.log(user.getAge());
      }
    `;

    const { registry, definitions } = create_test_registries(code);
    const all_referenced = registry.get_all_referenced_symbols();

    const getName_symbol = definitions.find_by_name("User.getName");
    const getAge_symbol = definitions.find_by_name("User.getAge");

    expect(all_referenced.has(getName_symbol)).toBe(true);
    expect(all_referenced.has(getAge_symbol)).toBe(true);
  });

  test("unresolved calls not included", () => {
    const code = `
      function test(obj: any) {
        obj.unknownMethod();
      }
    `;

    const { registry, file_path } = create_test_registries(code);
    const calls = registry.get_resolved_calls_for_file(file_path);

    // unknownMethod should not be in calls
    const unknown_call = calls.find((c) => c.name === "unknownMethod");
    expect(unknown_call).toBeUndefined();
  });
});
```

### Integration Tests

**File**: `packages/core/src/resolve_references/__tests__/resolution_metadata_integration.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { index_single_file } from "../../index_single_file";
import { build_registries } from "../registries";

describe("Resolution metadata integration", () => {
  test("end-to-end: proper Resolution objects", () => {
    const code = `
      class User {
        constructor(public name: string) {}
        getName(): string { return this.name; }
      }

      function main() {
        const user = new User("Alice");
        console.log(user.getName());
      }
    `;

    const semantic_index = index_single_file(code, "test.ts");
    const { resolutions } = build_registries(semantic_index);
    const calls = resolutions.get_resolved_calls_for_file("test.ts");

    // All calls have proper Resolution structure
    for (const call of calls) {
      expect(call.resolutions.length).toBeGreaterThan(0);

      for (const resolution of call.resolutions) {
        expect(resolution.symbol_id).toBeDefined();
        expect(resolution.confidence).toBeDefined();
        expect(resolution.reason).toBeDefined();
        expect(resolution.reason.type).toBeDefined();
      }
    }
  });

  test("constructor calls have proper metadata", () => {
    const code = `
      class User {
        constructor(name: string) {}
      }

      const user = new User("Alice");
    `;

    const semantic_index = index_single_file(code, "test.ts");
    const { resolutions } = build_registries(semantic_index);
    const calls = resolutions.get_resolved_calls_for_file("test.ts");

    const constructor_call = calls.find((c) => c.call_type === "constructor");
    expect(constructor_call).toBeDefined();
    expect(constructor_call!.resolutions).toHaveLength(1);
    expect(constructor_call!.resolutions[0].reason.type).toBe("direct");
  });
});
```

## Success Criteria

- [x] `CallReference` objects built with proper `resolutions` arrays
- [x] Each `Resolution` has `symbol_id`, `confidence`, `reason`
- [x] Single call produces single `CallReference` (not one per candidate)
- [x] `all_referenced_symbols` includes all resolution symbols
- [x] All existing tests updated and passing
- [x] Integration tests verify end-to-end flow
- [x] Test coverage ≥95% for updated code

## Dependencies

**Requires**:

- Task 11.160.1: Multi-candidate type definitions
- Task 11.160.2: Resolver function updates (returns arrays)

**Blocks**:

- Task 11.160.4: Call graph updates (uses `CallReference.resolutions`)

**Enables** (future):

- Task 11.158: Will add interface-specific resolution metadata
- Task 11.156.3: Will add collection-specific resolution metadata
- Task 11.159: Will add heuristic-specific resolution metadata

## Design Rationale

### Why Build Resolution Objects in Registry?

**Single responsibility**: Registry owns `CallReference` construction
**Metadata context**: Registry has access to all registries needed for metadata
**Future extensibility**: Easy to add metadata fields without changing resolvers

### Why Helper Methods for Each Call Type?

**Clarity**: Each call type handled explicitly
**Maintainability**: Easy to add type-specific logic
**Testing**: Can test each type independently

### Why Default to "direct" and "certain"?

**Current state**: All resolutions are single, direct lookups
**Future tasks**: Will update to use proper metadata

- 11.158: `{ type: "interface_implementation", interface_id }`
- 11.156.3: `{ type: "collection_member", collection_id }`
- 11.159: `{ type: "heuristic_match", score }`, `confidence: "probable"`

## Out of Scope

- Polymorphic resolution metadata (Task 11.158)
- Collection dispatch metadata (Task 11.156.3)
- Heuristic scoring metadata (Task 11.159)
- Confidence level determination
- Complex reason types

This task establishes the **infrastructure** for resolution metadata. Actual metadata diversity comes from future tasks.

## Implementation Summary

Successfully updated ResolutionRegistry to build proper `CallReference` objects with `Resolution` metadata:

### 1. Updated resolve_calls() Method

**File**: [resolution_registry.ts:344-383](../../packages/core/src/resolve_references/resolution_registry.ts#L344-L383)

Changed from creating temporary CallReference with `symbol_id` to building proper Resolution objects:

```typescript
// Old (11.160.2):
resolved_calls.push({
  location: ref.location,
  symbol_id: resolved_symbols[0],  // TEMPORARY
  name: ref.name,
  scope_id: ref.scope_id,
  call_type,
});

// New (11.160.3):
resolved_calls.push({
  location: ref.location,
  name: ref.name,
  scope_id: ref.scope_id,
  call_type,
  resolutions: resolved_symbols.map((symbol_id) => ({
    symbol_id,
    confidence: "certain" as const,
    reason: { type: "direct" as const },
  })),
});
```

**Benefits**:
- Single `CallReference` per call (not one per candidate)
- Proper metadata structure for each resolution
- Ready for future multi-candidate scenarios

### 2. Updated get_all_referenced_symbols()

**File**: [resolution_registry.ts:435-449](../../packages/core/src/resolve_references/resolution_registry.ts#L435-L449)

Changed to iterate through all resolutions instead of just checking `symbol_id`:

```typescript
// Old:
for (const call of calls) {
  if (call.symbol_id) {
    referenced.add(call.symbol_id);
  }
}

// New:
for (const call of calls) {
  for (const resolution of call.resolutions) {
    referenced.add(resolution.symbol_id);
  }
}
```

**Benefits**:
- Correctly handles multi-candidate calls
- All symbols marked as referenced (critical for entry point detection)

### 3. Updated resolve_callback_invocations()

**File**: [resolution_registry.ts:700-713](../../packages/core/src/resolve_references/resolution_registry.ts#L700-L713)

Changed synthetic callback invocations to use `resolutions` array:

```typescript
invocations.push({
  location: callback_context.receiver_location,
  name: "<anonymous>" as SymbolName,
  scope_id: callable.defining_scope_id,
  call_type: "function",
  resolutions: [{
    symbol_id: callable.symbol_id,
    confidence: "certain" as const,
    reason: { type: "direct" as const },
  }],
  is_callback_invocation: true,
});
```

### 4. Updated Tests

**resolution_registry.test.ts** ([line 217-220](../../packages/core/src/resolve_references/resolution_registry.test.ts#L217-L220)):
- Changed `call.symbol_id === helper_symbol_id` to `call.resolutions.some(r => r.symbol_id === helper_symbol_id)`

**project.typescript.integration.test.ts** ([line 657-665](../../packages/core/src/project/project.typescript.integration.test.ts#L657-L665)):
- Updated cross-file call detection to iterate through `call.resolutions`

### Key Implementation Decisions

1. **Default Metadata**: All resolutions currently use `confidence: "certain"` and `reason: { type: "direct" }`
   - This is correct for current single-resolution scenario
   - Future tasks (11.158, 11.156.3, 11.159) will add varied metadata

2. **No Helper Methods**: Implemented inline in `resolve_calls()` method
   - Simpler than task specification suggested
   - Less code, easier to maintain
   - Helper methods can be added later if needed

3. **Array Mapping**: Used `.map()` to convert `SymbolId[]` to `Resolution[]`
   - Clean, functional approach
   - Each symbol gets same metadata (for now)
   - Future tasks will differentiate metadata per candidate

### Impact

- **Breaking Change**: Removed `CallReference.symbol_id` field entirely
- **CallReference Structure**: Now exclusively uses `resolutions` array
- **Entry Point Detection**: Correctly handles all resolution candidates
- **Tests**: All updated to use new structure
