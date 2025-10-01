# Task 105.7: Enhance Local Type Context Building

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2 hours
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.6

## Objective

Improve `build_local_type_context()` with additional type resolution strategies to compensate for removed structures and increase method resolution accuracy.

## Current Strategies

**File:** `src/resolve_references/local_type_context/local_type_context.ts`

Currently implements:
1. ✅ **Constructor calls** - `const x = new User()`
2. ✅ **Type annotations** - `let x: User`
3. ❌ **Function returns** - Not implemented
4. ❌ **Better import resolution** - Partially implemented
5. ❌ **Type guards** - Placeholder only

## New Strategies to Add

### Strategy 3: Function Return Types (45 min)

Track when a function has a return type annotation:

```typescript
function getUser(): User {
  return new User();
}

const user = getUser();  // user has type User
user.method();  // Look for method on User
```

**Implementation:**

```typescript
/**
 * Track function return types for call result inference
 */
function process_function_returns(
  functions: ReadonlyMap<SymbolId, FunctionDefinition>,
  imports: ReadonlyMap<SymbolName, SymbolId>
): Map<SymbolName, SymbolId> {
  const return_types = new Map<SymbolName, SymbolId>();

  for (const [func_id, func_def] of functions) {
    // If function has return type hint
    if (func_def.return_type_hint) {
      const type_name = extract_type_name(func_def.return_type_hint);

      if (type_name) {
        // Resolve the type name to SymbolId
        const type_id = resolve_type_name_from_string(
          type_name,
          imports
        );

        if (type_id) {
          // Map: function name → return type
          return_types.set(func_def.name, type_id);
        }
      }
    }
  }

  return return_types;
}
```

**Usage in context building:**

```typescript
function build_file_type_context(...) {
  // ... existing code ...

  // NEW: Track function return types
  const function_returns = process_function_returns(
    index.functions,
    imports
  );

  // Use when a function call is assigned
  // const x = getUser(); → x has type User
  for (const [func_name, return_type] of function_returns) {
    // Store for later lookup
  }
}
```

### Strategy 4: Enhanced Import Resolution (30 min)

Better handling of imported types in annotations:

```typescript
import { User, Admin } from './types';

const user: User = ...;      // Should resolve via imports
const admin: Admin = ...;    // Should resolve via imports
```

**Implementation:**

```typescript
/**
 * Resolve type name in annotation to SymbolId
 */
function resolve_type_name_from_annotation(
  annotation: TypeAnnotation,
  index: SemanticIndex,
  imports: ReadonlyMap<SymbolName, SymbolId>
): SymbolId | null {
  // Extract base type name (handle generics)
  const type_name = extract_base_type_name(annotation.annotation_text);
  if (!type_name) return null;

  // PRIORITY 1: Check imports first (most common for cross-file types)
  if (imports?.has(type_name)) {
    return imports.get(type_name) || null;
  }

  // PRIORITY 2: Check local classes
  for (const [id, class_def] of index.classes) {
    if (class_def.name === type_name) {
      return id;
    }
  }

  // PRIORITY 3: Check local interfaces
  for (const [id, interface_def] of index.interfaces) {
    if (interface_def.name === type_name) {
      return id;
    }
  }

  // PRIORITY 4: Check local type aliases
  for (const [id, type_def] of index.types) {
    if (type_def.name === type_name) {
      return id;
    }
  }

  return null;
}

/**
 * Extract base type name from annotation text
 * "User" → "User"
 * "Array<User>" → "User"
 * "User | null" → "User"
 */
function extract_base_type_name(annotation_text: string): SymbolName | null {
  // Handle generics: User<T> → User
  const generic_match = annotation_text.match(/^(\w+)</);
  if (generic_match) {
    return generic_match[1] as SymbolName;
  }

  // Handle unions: User | null → User
  const union_match = annotation_text.match(/^(\w+)\s*\|/);
  if (union_match) {
    return union_match[1] as SymbolName;
  }

  // Handle simple: User → User
  const simple_match = annotation_text.match(/^(\w+)$/);
  if (simple_match) {
    return simple_match[1] as SymbolName;
  }

  return null;
}
```

### Strategy 5: Type Guard Support (45 min)

Track `instanceof` checks and type assertions:

```typescript
if (obj instanceof User) {
  obj.method();  // obj is User in this block
}

const user = obj as User;
user.method();  // user is User
```

**Implementation:**

```typescript
/**
 * Process type guards from references
 */
function process_type_guards(
  references: readonly SymbolReference[],
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  imports: ReadonlyMap<SymbolName, SymbolId>
): TypeGuard[] {
  const guards: TypeGuard[] = [];

  // Look for instanceof checks in references
  for (const ref of references) {
    if (ref.reference_type === 'type_guard') {
      // Extract guard information
      const guard = extract_guard_info(ref, imports);
      if (guard) {
        guards.push(guard);
      }
    }
  }

  return guards;
}
```

**Note:** Type guard extraction may need additional capture support in queries. This can be a future enhancement if not immediately possible.

## Changes

### 1. Add Helper Functions (30 min)

**File:** `src/resolve_references/local_type_context/local_type_context.ts`

Add the new helper functions listed above:
- `process_function_returns()`
- `resolve_type_name_from_annotation()`
- `extract_base_type_name()`
- `process_type_guards()` (optional)

### 2. Update build_file_type_context (20 min)

```typescript
function build_file_type_context(
  index: SemanticIndex,
  imports?: ReadonlyMap<SymbolName, SymbolId>
): LocalTypeContext {
  const variable_types = new Map<string, SymbolId>();
  const expression_types = new Map<LocationKey, SymbolId>();
  const type_guards: TypeGuard[] = [];
  const constructor_calls: ConstructorCall[] = [];

  // EXISTING: Process constructor calls
  if (index.constructor_calls) {
    for (const call of index.constructor_calls) {
      const class_id = resolve_class_name(call.class_name, index, imports);
      if (class_id) {
        constructor_calls.push({
          class_id,
          location: call.location,
          assigned_to: call.assigned_to,
          scope_id: call.scope_id || ("" as ScopeId),
        });

        if (call.assigned_to) {
          variable_types.set(call.assigned_to, class_id);
        }
        expression_types.set(location_key(call.location), class_id);
      }
    }
  }

  // EXISTING: Process type annotations
  if (index.type_annotations) {
    for (const annotation of index.type_annotations) {
      const type_id = resolve_type_name_from_annotation(
        annotation,
        index,
        imports
      );

      if (type_id && annotation.annotation_kind === 'variable') {
        // Extract variable name from annotation
        const var_name = extract_variable_name_from_annotation(annotation);
        if (var_name) {
          variable_types.set(var_name, type_id);
        }
      }
    }
  }

  // NEW: Process function return types
  if (index.functions) {
    const function_returns = process_function_returns(
      index.functions,
      imports
    );

    // Store for lookup when function calls are resolved
    // TODO: Need to track call sites to map results to variables
  }

  // NEW: Process type guards (if available)
  if (index.references) {
    const guards = process_type_guards(
      index.references,
      index.scopes,
      imports
    );
    type_guards.push(...guards);
  }

  return {
    variable_types,
    expression_types,
    type_guards,
    constructor_calls,
  };
}
```

### 3. Add Tests (30 min)

**File:** `src/resolve_references/local_type_context/local_type_context.test.ts`

Add test cases:

```typescript
describe('build_local_type_context - function returns', () => {
  it('tracks function return type annotations', () => {
    // Code: function getUser(): User { ... }
    const index = create_index_with_function_return_type();
    const context = build_file_type_context(index, imports);

    // Verify return type tracked
    // (exact assertion depends on implementation)
  });
});

describe('resolve_type_name_from_annotation', () => {
  it('resolves imported types', () => {
    const annotation = { annotation_text: 'User', ... };
    const imports = new Map([['User' as SymbolName, 'user_id' as SymbolId]]);

    const result = resolve_type_name_from_annotation(
      annotation,
      index,
      imports
    );

    expect(result).toBe('user_id');
  });

  it('handles generic types', () => {
    const annotation = { annotation_text: 'Array<User>', ... };
    // Should extract 'User' and resolve it
  });

  it('handles union types', () => {
    const annotation = { annotation_text: 'User | null', ... };
    // Should extract 'User' and resolve it
  });
});
```

## Validation

### 1. Unit Tests
```bash
npm test -- local_type_context.test.ts
# All new tests should pass
```

### 2. Integration Test
```bash
npm test -- method_resolution.test.ts
# Should see improved resolution rates
```

### 3. Coverage Check
```bash
# Before: X% method calls resolved
# After: Should be X+10% or more
```

## Deliverables

- [ ] `process_function_returns()` implemented
- [ ] `resolve_type_name_from_annotation()` with import priority
- [ ] `extract_base_type_name()` handling generics and unions
- [ ] `process_type_guards()` (basic implementation)
- [ ] `build_file_type_context()` updated with new strategies
- [ ] Tests for all new strategies
- [ ] Method resolution accuracy improved

## Benefits

**Better Type Resolution:**
- Function returns: +5-10% method calls resolved
- Better imports: +5-10% method calls resolved
- Type guards: +2-5% method calls resolved (if implemented)

**Total improvement:** 15-25% more method calls resolved

**Compensates for removed code:**
- We removed stub implementations
- We added working implementations
- Net result: better accuracy with less code

## Next Steps

- Task 105.8: Migrate tests from local_types to index.classes
