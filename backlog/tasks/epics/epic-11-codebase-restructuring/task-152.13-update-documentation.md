# Task 152.13: Update Documentation

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: Medium
**Estimated Effort**: 3 hours
**Phase**: 4 - Cleanup

## Purpose

Update all documentation to reflect the new discriminated union architecture. Remove references to legacy patterns and ensure examples use the correct approach.

## Documentation Style

From CLAUDE.md:
> Write in a **canonical, self-contained** style. Documentation should describe the system as it currently IS, not as it was or how it changed.

**DO NOT**:
- Reference "old approaches" or "previous versions"
- Use "revised," "updated," or "new" framing
- Explain what you're NOT doing

**DO**:
- Describe the system as it currently works
- Use present tense
- Be authoritative and direct

## Files to Update

### 1. Main README

**File**: `packages/core/README.md`

Update the "Reference Resolution" section:

```markdown
## Reference Resolution

The system uses typed reference variants for type-safe resolution:

### Reference Types

- **SelfReferenceCall**: `this.method()`, `self.method()`, `super.method()`
- **MethodCallReference**: `obj.method()`
- **FunctionCallReference**: `foo()`
- **ConstructorCallReference**: `new MyClass()`
- **VariableReference**: Reading or writing variables
- **PropertyAccessReference**: `obj.field`
- **TypeReference**: Type annotations and clauses
- **AssignmentReference**: `x = value`

### Creating References

Use factory functions from `reference_factories.ts`:

\`\`\`typescript
import { create_self_reference_call } from './reference_factories';

const ref = create_self_reference_call(
  'method' as SymbolName,
  location,
  scope_id,
  'this',
  ['this', 'method']
);
\`\`\`

### Resolving References

Pattern matching with discriminated unions:

\`\`\`typescript
function resolve_reference(ref: SymbolReference): SymbolId | null {
  switch (ref.kind) {
    case 'self_reference_call':
      return resolve_self_reference_call(ref, semantic_index);
    case 'method_call':
      return resolve_method_call(ref, semantic_index);
    // ... other cases
  }
}
\`\`\`

### Self-Reference Resolution

Self-reference calls resolve by finding the containing class and looking up methods within that class scope:

1. Detect keyword (`this`, `self`, `super`)
2. Walk scope tree to find containing class
3. Find method definition in class scope
4. Return method's symbol_id
```

### 2. Architecture Documentation

**File**: `packages/core/docs/architecture/references.md`

Create comprehensive reference architecture documentation:

```markdown
# Reference Architecture

References represent uses of symbols in code. Each reference type has specific semantics and resolution strategies.

## Discriminated Union Type System

All references use a discriminated union with a `kind` field:

\`\`\`typescript
export type SymbolReference =
  | SelfReferenceCall
  | MethodCallReference
  | FunctionCallReference
  | ConstructorCallReference
  | VariableReference
  | PropertyAccessReference
  | TypeReference
  | AssignmentReference;
\`\`\`

Each variant has exactly the fields it needs, making impossible states unrepresentable.

## Reference Variants

### SelfReferenceCall

Calls where the receiver is a self-reference keyword:

- **TypeScript/JavaScript**: `this.method()`, `super.method()`
- **Python**: `self.method()`, `cls.method()`, `super().method()`
- **Rust**: `self.method()`

**Fields**:
- `kind`: `'self_reference_call'`
- `keyword`: The self-reference keyword used
- `property_chain`: Always starts with keyword
- `name`, `location`, `scope_id`: Common to all references

**Resolution**: Find containing class, look up method in class scope.

### MethodCallReference

Calls where the receiver is a variable or property:

\`\`\`typescript
const user = getUser();
user.getName();  // MethodCallReference
\`\`\`

**Fields**:
- `kind`: `'method_call'`
- `receiver_location`: Where the receiver object is defined
- `property_chain`: Full chain of property accesses

**Resolution**: Resolve receiver, get receiver's type, find method on type.

### FunctionCallReference

Standalone function calls:

\`\`\`typescript
processData(value);  // FunctionCallReference
\`\`\`

**Fields**:
- `kind`: `'function_call'`
- `name`, `location`, `scope_id`

**Resolution**: Walk scope chain to find function definition.

[... Document other variants similarly ...]

## Factory Functions

Create references using pure factory functions:

\`\`\`typescript
// Self-reference call
const ref = create_self_reference_call(
  name,
  location,
  scope_id,
  keyword,
  property_chain
);

// Method call
const ref = create_method_call_reference(
  name,
  location,
  scope_id,
  receiver_location,
  property_chain
);
\`\`\`

Benefits:
- Type safety: Compiler enforces required fields
- Centralization: Single source of truth
- Consistency: All references created the same way

## Pattern Matching

Resolve references using pattern matching:

\`\`\`typescript
switch (ref.kind) {
  case 'self_reference_call':
    // TypeScript knows ref is SelfReferenceCall
    return resolve_self_reference_call(ref, semantic_index);

  case 'method_call':
    // TypeScript knows ref is MethodCallReference
    return resolve_method_call(ref, semantic_index);

  // ... other cases
}
\`\`\`

TypeScript provides:
- **Type narrowing**: Automatic type inference in each case
- **Exhaustiveness checking**: Compiler errors if cases missing
- **No runtime checks**: Fields guaranteed to exist

## Self-Reference Bug Fix

The discriminated union architecture fixes a critical bug where `this.method()` calls failed to resolve.

**Problem**: Old system used chain length heuristic:
- Short chains (`['this', 'method']`) → variable resolution (failed)
- Long chains (`['this', 'field', 'method']`) → property chain resolution (worked)

**Solution**: Detect keywords at semantic index time, create `SelfReferenceCall` variant, resolve with dedicated resolver.

**Impact**: Fixes 42 instances (31% of misidentifications).
```

### 3. API Documentation

**File**: `packages/core/docs/api/references.md`

Document the public API:

```markdown
# References API

## Factory Functions

### create_self_reference_call()

Creates a self-reference call reference.

\`\`\`typescript
function create_self_reference_call(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  keyword: SelfReferenceKeyword,
  property_chain: readonly SymbolName[]
): SelfReferenceCall
\`\`\`

**Parameters**:
- `name`: Method name being called
- `location`: Location of the call site
- `scope_id`: Scope containing the reference
- `keyword`: Self-reference keyword (`'this'`, `'self'`, `'super'`, `'cls'`)
- `property_chain`: Property chain including keyword

**Example**:
\`\`\`typescript
// TypeScript: this.build_class(node)
create_self_reference_call(
  'build_class',
  location,
  scope_id,
  'this',
  ['this', 'build_class']
)

// Python: self.process_data(x)
create_self_reference_call(
  'process_data',
  location,
  scope_id,
  'self',
  ['self', 'process_data']
)
\`\`\`

[... Document other factory functions ...]

## Type Guards

### is_self_reference_call()

Type guard for self-reference calls.

\`\`\`typescript
function is_self_reference_call(ref: SymbolReference): ref is SelfReferenceCall
\`\`\`

**Example**:
\`\`\`typescript
if (is_self_reference_call(ref)) {
  // TypeScript knows ref is SelfReferenceCall
  console.log(ref.keyword);
  console.log(ref.property_chain);
}
\`\`\`

[... Document other type guards ...]
```

### 4. Code Comments

Update JSDoc comments in source files to remove migration notes:

**Example - reference_factories.ts**:

```typescript
/**
 * Factory for self-reference calls: this.method(), self.method(), super.method()
 *
 * @example TypeScript
 * // this.build_class(node)
 * create_self_reference_call(
 *   'build_class',
 *   location,
 *   scope_id,
 *   'this',
 *   ['this', 'build_class']
 * )
 *
 * @example Python
 * // self.process_data(x)
 * create_self_reference_call(
 *   'process_data',
 *   location,
 *   scope_id,
 *   'self',
 *   ['self', 'process_data']
 * )
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
```

Remove any comments like:

```typescript
// DELETE THESE:

// NOTE: This is the NEW way to create references (old way used object literals)
// MIGRATION: Replace ReferenceType.METHOD_CALL with 'method_call'
// TODO: Update once migration complete
```

### 5. Example Code

Update example code in documentation:

**File**: `packages/core/docs/examples/resolution.md`

```markdown
# Resolution Examples

## Resolving Self-Reference Calls

\`\`\`typescript
import { build_semantic_index } from '@ariadnejs/core';
import { resolve_references } from '@ariadnejs/core';

const code = \`
  class MyClass {
    method() {
      this.helper();
    }

    helper() { }
  }
\`;

const semantic_index = build_semantic_index(code, 'typescript');
const resolutions = resolve_references(
  semantic_index.references,
  semantic_index
);

// Find the self-reference call
const self_ref = semantic_index.references.find(
  (ref) => ref.kind === 'self_reference_call' && ref.name === 'helper'
);

if (self_ref) {
  const resolved_id = resolutions.get(self_ref.location);
  console.log('Resolved to:', resolved_id);
}
\`\`\`

[... More examples ...]
```

## Documentation Checklist

- [ ] Main README updated with new architecture
- [ ] Architecture documentation created/updated
- [ ] API documentation complete
- [ ] Code comments updated (no migration notes)
- [ ] Example code uses correct patterns
- [ ] No references to "old way" or "legacy"
- [ ] All examples use factory functions
- [ ] All examples use pattern matching
- [ ] Documentation is canonical and self-contained

## Success Criteria

- [ ] All documentation describes current system only
- [ ] No references to legacy patterns
- [ ] Examples compile and run correctly
- [ ] Documentation follows canonical style from CLAUDE.md
- [ ] API documentation is complete
- [ ] Code comments are clear and accurate

## Files Changed

**New**:
- `packages/core/docs/architecture/references.md`
- `packages/core/docs/api/references.md`
- `packages/core/docs/examples/resolution.md`

**Modified**:
- `packages/core/README.md`
- All source files with JSDoc comments
- Existing documentation files

## Next Task

After completion, proceed to **task-152.14** (Final verification)
