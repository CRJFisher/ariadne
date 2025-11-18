# Task Epic-11.160.2: Resolver Function Updates

**Status**: COMPLETED
**Priority**: P0 (Foundational)
**Estimated Effort**: 2-3 days
**Actual Effort**: 1 day
**Epic**: epic-11-codebase-restructuring
**Parent**: task-epic-11.160 (Multi-Candidate Resolution Foundation)
**Depends On**: 11.160.1 (Multi-Candidate Type Definitions)
**Blocks**: 11.160.3 (Resolution Registry Updates)

## Scope

Change resolver functions to return arrays of `SymbolId` instead of `SymbolId | null`. Update all callers to handle array results. This establishes the foundation for multi-candidate resolution while keeping current single-resolution logic intact.

## Current State

Resolvers return single symbol or null:

```typescript
function resolve_method_call(
  call_ref: MethodCallReference,
  ...
): SymbolId | null
```

Callers handle optional:

```typescript
const symbol = resolve_method_call(ref, ...);
if (symbol) {
  // Use symbol
}
```

## Target State

Resolvers return array:

```typescript
function resolve_method_call(
  call_ref: MethodCallReference,
  ...
): SymbolId[]
```

Callers handle array:

```typescript
const symbols = resolve_method_call(ref, ...);
for (const symbol of symbols) {
  // Use symbol
}
```

## Implementation

### 1. Update method_resolver.ts

**File**: `packages/core/src/resolve_references/call_resolution/method_resolver.ts`

Change signature and return type:

```typescript
import type {
  SymbolId,
  SymbolName,
  MethodCallReference,
} from "@ariadnejs/types";
import type { ScopeRegistry } from "../registries/scope_registry";
import type { DefinitionRegistry } from "../registries/definition_registry";
import type { ResolutionRegistry } from "../resolution_registry";
import type { TypeRegistry } from "../registries/type_registry";

/**
 * Resolve a method call to zero, one, or more symbols
 *
 * Returns:
 * - []: Resolution failed (no receiver, no type, or no method)
 * - [symbol]: Concrete method call (user.getName())
 * - [a, b, c]: Polymorphic method call (handler.process())
 *
 * Future tasks (11.158, 11.156.3) will add multi-candidate logic.
 * This task only changes the return type to array.
 */
export function resolve_method_call(
  call_ref: MethodCallReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  // Use existing single-resolution logic
  const receiver_type = resolve_property_chain(
    call_ref,
    scopes,
    definitions,
    types,
    resolutions
  );

  if (!receiver_type) {
    return [];
  }

  // Look up method on the receiver type
  let method_symbol = types.get_type_member(receiver_type, call_ref.name);

  if (!method_symbol) {
    // Fallback to direct lookup in DefinitionRegistry
    const member_index = definitions.get_member_index();
    const type_members = member_index.get(receiver_type);
    if (type_members) {
      method_symbol = type_members.get(call_ref.name) || null;
    }
  }

  if (!method_symbol) {
    return [];
  }

  // For now, return single element array
  // Task 11.158 will add polymorphic resolution logic here
  return [method_symbol];
}
```

**Note**: The existing `resolve_property_chain()` function remains unchanged. Multi-candidate detection logic will be added in task 11.158.

### 2. Update constructor_resolver.ts

**File**: `packages/core/src/resolve_references/call_resolution/constructor_resolver.ts`

Change signature:

```typescript
import type { SymbolId, ConstructorCallReference } from "@ariadnejs/types";

/**
 * Resolve a constructor call to zero or one symbol
 *
 * Constructor calls are typically single-target (new ClassName()).
 * Returns array for consistency with other resolvers.
 */
export function resolve_constructor_call(
  call_ref: ConstructorCallReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  // Existing resolution logic
  const class_symbol = resolve_constructor_target(
    call_ref,
    scopes,
    definitions,
    types,
    resolutions
  );

  if (!class_symbol) {
    return [];
  }

  return [class_symbol];
}
```

### 3. Update self_reference_resolver.ts

**File**: `packages/core/src/resolve_references/call_resolution/self_reference_resolver.ts`

Change signature:

```typescript
import type { SymbolId, SelfReferenceCallReference } from "@ariadnejs/types";

/**
 * Resolve a self-reference call to zero or one symbol
 *
 * Self-reference calls (this.method(), self.method()) are typically
 * single-target. Returns array for consistency.
 */
export function resolve_self_reference_call(
  call_ref: SelfReferenceCallReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  // Existing resolution logic
  const method_symbol = resolve_self_reference_target(
    call_ref,
    scopes,
    definitions,
    types,
    resolutions
  );

  if (!method_symbol) {
    return [];
  }

  return [method_symbol];
}
```

### 4. Update All Callers

**File**: `packages/core/src/resolve_references/resolution_registry.ts`

Update `resolve_calls()` to handle arrays:

```typescript
resolve_calls(
  file_references: Map<FilePath, readonly SymbolReference[]>,
  scopes: ScopeRegistry,
  types: TypeRegistry,
  definitions: DefinitionRegistry
): CallReference[] {
  const resolved_calls: CallReference[] = [];

  for (const [file_path, references] of file_references) {
    for (const ref of references) {
      switch (ref.kind) {
        case "method_call": {
          // Get array of resolved symbols
          const symbols = resolve_method_call(
            ref,
            scopes,
            definitions,
            types,
            this
          );

          // Store for later - will build Resolution[] in task 11.160.3
          // For now, just track the symbols
          if (symbols.length > 0) {
            // Temporary: Will be replaced in task 11.160.3
            for (const symbol of symbols) {
              resolved_calls.push({
                location: ref.location,
                name: ref.name,
                scope_id: ref.scope_id,
                call_type: "method",
                resolutions: [{
                  symbol_id: symbol,
                  confidence: "certain",
                  reason: { type: "direct" }
                }]
              });
            }
          }
          break;
        }

        case "constructor_call": {
          const symbols = resolve_constructor_call(
            ref,
            scopes,
            definitions,
            types,
            this
          );

          for (const symbol of symbols) {
            resolved_calls.push({
              location: ref.location,
              name: ref.name,
              scope_id: ref.scope_id,
              call_type: "constructor",
              resolutions: [{
                symbol_id: symbol,
                confidence: "certain",
                reason: { type: "direct" }
              }]
            });
          }
          break;
        }

        case "self_reference_call": {
          const symbols = resolve_self_reference_call(
            ref,
            scopes,
            definitions,
            types,
            this
          );

          for (const symbol of symbols) {
            resolved_calls.push({
              location: ref.location,
              name: ref.name,
              scope_id: ref.scope_id,
              call_type: "method",
              resolutions: [{
                symbol_id: symbol,
                confidence: "certain",
                reason: { type: "direct" }
              }]
            });
          }
          break;
        }

        case "function_call": {
          // Function calls use existing scope resolution
          const resolved = this.resolve(ref.scope_id, ref.name);

          if (resolved) {
            resolved_calls.push({
              location: ref.location,
              name: ref.name,
              scope_id: ref.scope_id,
              call_type: "function",
              resolutions: [{
                symbol_id: resolved,
                confidence: "certain",
                reason: { type: "direct" }
              }]
            });
          }
          break;
        }
      }
    }
  }

  return resolved_calls;
}
```

**Note**: Task 11.160.3 will refactor this to properly build `Resolution` objects with metadata. This task just handles the array return type.

## Testing

### Unit Tests

**File**: `packages/core/src/resolve_references/call_resolution/method_resolver.test.ts`

Update existing tests:

```typescript
import { describe, test, expect } from "vitest";
import { resolve_method_call } from "./method_resolver";
import { create_test_context } from "./__test_helpers__/test_context";

describe("resolve_method_call", () => {
  test("returns array with single element for concrete method call", () => {
    const code = `
      class User {
        getName(): string { return "Alice"; }
      }

      function greet(user: User) {
        return user.getName();
      }
    `;

    const { call_ref, scopes, definitions, types, resolutions } =
      create_test_context(code, "user.getName");

    const symbols = resolve_method_call(
      call_ref,
      scopes,
      definitions,
      types,
      resolutions
    );

    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toContain("User.getName");
  });

  test("returns empty array for unresolved call", () => {
    const code = `
      function test(obj: any) {
        return obj.unknownMethod();
      }
    `;

    const { call_ref, scopes, definitions, types, resolutions } =
      create_test_context(code, "obj.unknownMethod");

    const symbols = resolve_method_call(
      call_ref,
      scopes,
      definitions,
      types,
      resolutions
    );

    expect(symbols).toHaveLength(0);
  });

  test("returns array, not null", () => {
    const code = `
      class User {
        getName(): string { return "Alice"; }
      }

      function greet(user: User) {
        return user.getName();
      }
    `;

    const { call_ref, scopes, definitions, types, resolutions } =
      create_test_context(code, "user.getName");

    const result = resolve_method_call(
      call_ref,
      scopes,
      definitions,
      types,
      resolutions
    );

    // Must be array, never null
    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toBeNull();
  });
});
```

### Constructor and Self-Reference Tests

**File**: `packages/core/src/resolve_references/call_resolution/constructor_resolver.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { resolve_constructor_call } from "./constructor_resolver";

describe("resolve_constructor_call", () => {
  test("returns array with single element", () => {
    const code = `
      class User {
        constructor(name: string) {}
      }

      const user = new User("Alice");
    `;

    const { call_ref, scopes, definitions, types, resolutions } =
      create_test_context(code, "new User");

    const symbols = resolve_constructor_call(
      call_ref,
      scopes,
      definitions,
      types,
      resolutions
    );

    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toContain("User");
  });

  test("returns empty array when unresolved", () => {
    const code = `
      const obj = new UnknownClass();
    `;

    const { call_ref, scopes, definitions, types, resolutions } =
      create_test_context(code, "new UnknownClass");

    const symbols = resolve_constructor_call(
      call_ref,
      scopes,
      definitions,
      types,
      resolutions
    );

    expect(symbols).toHaveLength(0);
  });
});
```

### Integration Tests

**File**: `packages/core/src/resolve_references/__tests__/resolver_array_integration.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { index_single_file } from "../../index_single_file";
import { build_registries } from "../registries";

describe("Resolver array integration", () => {
  test("end-to-end: resolvers return arrays", () => {
    const code = `
      class User {
        getName(): string { return "Alice"; }
      }

      function greet(user: User) {
        return user.getName();
      }

      const user = new User("Alice");
      greet(user);
    `;

    const semantic_index = index_single_file(code, "test.ts");
    const { resolutions } = build_registries(semantic_index);

    const calls = resolutions.get_resolved_calls_for_file("test.ts");

    // All calls have resolutions array
    for (const call of calls) {
      expect(Array.isArray(call.resolutions)).toBe(true);
      expect(call.resolutions.length).toBeGreaterThan(0);
    }
  });
});
```

## Update Strategy

### Phase 1: Change Resolver Signatures

- Update return types to `SymbolId[]`
- Change returns from `symbol` to `[symbol]` or `null` to `[]`

### Phase 2: Update All Callers

- Find all uses of resolvers
- Change from `if (symbol)` to `for (const symbol of symbols)`
- Update to handle arrays

### Phase 3: Verify Tests

- Update all resolver tests
- Ensure all tests pass
- Add new tests for array behavior

## Success Criteria

- [x] All resolver functions return `SymbolId[]`
- [x] No resolver returns `null` or `SymbolId | null`
- [x] All callers updated to handle arrays
- [x] All existing tests updated and passing
- [x] New tests for array returns pass
- [x] Test coverage ≥95% for updated code

## Dependencies

**Requires**:

- Task 11.160.1: Multi-candidate type definitions

**Blocks**:

- Task 11.160.3: Resolution registry updates (will use array results)

**Enables** (future):

- Task 11.158: Interface method resolution (returns multiple implementations)
- Task 11.156.3: Collection dispatch (returns multiple stored functions)
- Task 11.159: Heuristic fallback (returns scored candidates)

## Files to Update

### Resolver Functions

- `packages/core/src/resolve_references/call_resolution/method_resolver.ts`
- `packages/core/src/resolve_references/call_resolution/constructor_resolver.ts`
- `packages/core/src/resolve_references/call_resolution/self_reference_resolver.ts`

### Callers

- `packages/core/src/resolve_references/resolution_registry.ts`
- Any other files calling resolvers (find with search)

### Tests

- `packages/core/src/resolve_references/call_resolution/*.test.ts`
- `packages/core/src/resolve_references/__tests__/*.test.ts`

## Design Rationale

### Why Arrays Instead of Optional?

**Uniform handling**: All cases use same code path

- `[]` = failed
- `[one]` = success
- `[a, b, c]` = multi (future)

**No null checks**: Array operations work on empty arrays
**Future-proof**: Multi-candidate logic is just "return more elements"

### Why Update All Callers Immediately?

Following project ethos: "DO NOT SUPPORT BACKWARD COMPATIBILITY - JUST CHANGE THE CODE"

**Benefits**:

- No technical debt
- No deprecation warnings
- Clean, consistent codebase

**Risks**: High touch, many files
**Mitigation**: Comprehensive testing, systematic approach

## Out of Scope

- Multi-candidate detection logic (Task 11.158, 11.156.3, 11.159)
- Resolution metadata creation (Task 11.160.3)
- Confidence scoring
- Interface-implementation index
- Collection detection

This task only changes **return type from single to array**. Logic for returning multiple elements comes later.

## Implementation Summary

Successfully updated all resolver functions to return `SymbolId[]`:

### 1. Resolver Functions Updated

**method_resolver.ts** ([method_resolver.ts:62-107](../../packages/core/src/resolve_references/call_resolution/method_resolver.ts#L62-L107)):
- Changed function name from `resolve_single_method_call` to `resolve_method_call`
- Changed return type from `SymbolId | null` to `SymbolId[]`
- Updated return statements: `return null` → `return []`, `return method_symbol` → `return [method_symbol]`
- Updated documentation to explain array semantics

**constructor_resolver.ts** ([constructor_resolver.ts:52-85](../../packages/core/src/resolve_references/call_resolution/constructor_resolver.ts#L52-L85)):
- Changed function name from `resolve_single_constructor_call` to `resolve_constructor_call`
- Changed return type from `SymbolId | null` to `SymbolId[]`
- Updated return statements: `return null` → `return []`, `return symbol` → `return [symbol]`

**self_reference_resolver.ts** ([self_reference_resolver.ts:60-182](../../packages/core/src/resolve_references/call_resolution/self_reference_resolver.ts#L60-L182)):
- Main function `resolve_self_reference_call` now returns `SymbolId[]`
- Helper functions `resolve_this_or_self_call` and `resolve_super_call` now return `SymbolId[]`
- Updated all return statements to use array syntax

### 2. Export Index Updated

**call_resolution/index.ts** ([index.ts:8-9](../../packages/core/src/resolve_references/call_resolution/index.ts#L8-L9)):
- Updated exports to use new function names:
  - `export { resolve_method_call }` (was `resolve_single_method_call`)
  - `export { resolve_constructor_call }` (was `resolve_single_constructor_call`)

### 3. Callers Updated

**resolution_registry.ts** ([resolution_registry.ts:271-385](../../packages/core/src/resolve_references/resolution_registry.ts#L271-L385)):
- Updated imports to use new function names
- Changed `resolve_calls()` method to handle array returns:
  - `let resolved_symbols: SymbolId[] = []` instead of `let resolved: SymbolId | null`
  - Function calls updated to use new names
  - Added wrapping for function call resolution: `const func_symbol = this.resolve(...); resolved_symbols = func_symbol ? [func_symbol] : [];`
  - Updated call reference creation to use `resolved_symbols[0]` (temporary, until task 11.160.3)
- Fixed lexical declaration issue in case block by adding braces

### 4. Tests Updated

**method_resolver.test.ts**:
- Updated import: `resolve_single_method_call` → `resolve_method_call`
- Changed all 13 function calls to use new name
- Updated 6 success assertions: `expect(resolved).toBe(method_id)` → `expect(resolved).toEqual([method_id])`
- Updated 5 failure assertions: `expect(resolved).toBeNull()` → `expect(resolved).toEqual([])`

**self_reference_resolver.test.ts**:
- Updated 8 success assertions: `expect(resolved).toBe(method_id)` → `expect(resolved).toEqual([method_id])`
- Updated 3 failure assertions: `expect(resolved).toBeNull()` → `expect(resolved).toEqual([])`

### Key Implementation Notes

1. **Backward Compatibility**: None provided - all changes are breaking changes per project ethos
2. **Temporary Bridge Code**: In `resolution_registry.ts`, we use `resolved_symbols[0]` to populate the old `CallReference.symbol_id` field. Task 11.160.3 will properly populate the `resolutions` array with `Resolution` objects
3. **Array Semantics**: Empty array `[]` means resolution failed, single-element array `[symbol]` means concrete resolution
4. **Future-Ready**: The array return type enables future tasks (11.158, 11.156.3, 11.159) to return multiple candidates without changing signatures again
