# Task epic-11.112.23: Design Scope-Aware Availability System

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 1 file created
**Dependencies:** task-epic-11.112.22

## Objective

Design the scope-aware availability system that makes availability relative to the referencing scope instead of absolute. This addresses task-epic-11.110 by creating a comprehensive design document.

## Files

### CREATED
- `docs/architecture/scope-aware-availability-design.md`

## Implementation Steps

### 1. Document Current Problem (30 min)

```markdown
# Scope-Aware Availability Design

## Current System Problems

### 1. Definition-Centric Availability
Current: `Availability = "local" | "file" | "file-export"`
- "local" means "defined in a function"
- "file" means "defined at file scope"
- Problem: Doesn't account for WHERE symbol is being referenced from

### 2. Examples of Current Problems

**Problem 1: Local variables appear available from outside function**
```typescript
function foo() {
  const x = 1; // availability = "local"
}

function bar() {
  x; // Current system: "local" availability means nothing here
     // Actual: Should be UNAVAILABLE from this scope
}
```

**Problem 2: File-scoped symbols not truly "file-scoped"**
```typescript
// file1.ts
class MyClass { } // availability = "file"

// file2.ts
MyClass; // Should be UNAVAILABLE (not exported)
```

## Proposed Solution

### Reference-Centric Availability

Replace absolute availability with relative visibility:

```typescript
// New system
interface Definition {
  defining_scope_id: ScopeId;  // Where this is defined
  visibility: VisibilityKind;  // How far it can be seen
}

type VisibilityKind =
  | { kind: "scope_local" }              // Only in defining scope
  | { kind: "scope_children" }           // Defining scope + children
  | { kind: "file" }                     // Entire file
  | { kind: "exported", export_kind: ExportKind };  // Other files
```

### Visibility Resolution Algorithm

```typescript
function is_visible(
  definition: Definition,
  reference_scope: ScopeId,
  scope_tree: ScopeTree
): boolean {
  switch (definition.visibility.kind) {
    case "scope_local":
      return reference_scope === definition.defining_scope_id;

    case "scope_children":
      return reference_scope === definition.defining_scope_id ||
             is_ancestor_of(definition.defining_scope_id, reference_scope, scope_tree);

    case "file":
      return same_file(definition, reference_scope);

    case "exported":
      return true; // Visible from any file
  }
}
```
```

### 2. Map Current to New System (30 min)

Document how current availability maps to new visibility:

```markdown
## Migration Mapping

| Current | Construct | New Visibility |
|---------|-----------|----------------|
| "local" | Function parameter | scope_children (visible in function body) |
| "local" | Local variable | scope_local (only in defining block) |
| "local" | Function in function | scope_local (only in defining function) |
| "file" | Class at file scope | file (no export) |
| "file" | Interface at file scope | file (no export) |
| "file-export" | Exported class | exported |
| "file-export" | Exported function | exported |
```

### 3. Design Type Definitions (30 min)

```markdown
## Type Definitions

```typescript
// In @ariadnejs/types

export type VisibilityKind =
  | { kind: "scope_local" }
  | { kind: "scope_children" }
  | { kind: "file" }
  | { kind: "exported", export_kind: ExportKind };

export type ExportKind =
  | { kind: "named", export_name: string }
  | { kind: "default" }
  | { kind: "namespace", namespace: string };

export interface WithVisibility {
  defining_scope_id: ScopeId;
  visibility: VisibilityKind;
}

// Update existing definition types
export interface FunctionDefinition extends WithVisibility {
  // ... existing fields
}

export interface ClassDefinition extends WithVisibility {
  // ... existing fields
}

// etc.
```
```

### 4. Design Implementation Plan (30 min)

```markdown
## Implementation Phases

### Phase 1: Add defining_scope_id to definitions (task-epic-11.112.24-26)
- Already implemented via `get_defining_scope_id()` fix!
- Just need to rename `scope_id` → `defining_scope_id` for clarity

### Phase 2: Add visibility field (task-epic-11.112.27-29)
- Add `visibility` field to all definition types
- Update builder configs to populate visibility
- Keep existing `availability` field temporarily for compatibility

### Phase 3: Implement visibility checker (task-epic-11.112.30-32)
- Create `is_visible()` function
- Create `VisibilityChecker` service
- Add scope tree utilities

### Phase 4: Update symbol resolution (task-epic-11.112.33-34)
- Use visibility checker in symbol resolution
- Filter definitions by visibility
- Update tests

### Phase 5: Remove old availability (task-epic-11.112.35-37)
- Remove `availability` field
- Update all references to use `visibility`
- Update tests
```

### 5. Document Edge Cases (30 min)

```markdown
## Edge Cases

### 1. Nested Functions
```typescript
function outer() {
  function inner() {
    const x = 1;
  }
  x; // UNAVAILABLE - wrong scope
}
```
- `x.visibility = scope_local`
- `x.defining_scope_id = inner_scope`
- Reference from `outer_scope` → NOT visible

### 2. Class Members
```typescript
class MyClass {
  private field = 1;

  method() {
    this.field; // AVAILABLE - same class
  }
}
```
- `field.visibility = file` (handled by access modifiers separately)
- `field.defining_scope_id = MyClass_scope`
- Reference from method → visible (method is child of class scope)

### 3. Block Scopes
```typescript
{
  const x = 1;
}
x; // UNAVAILABLE - block scope
```
- `x.visibility = scope_local`
- `x.defining_scope_id = block_scope`
- Reference from outside block → NOT visible
```

## Success Criteria

- ✅ Design document created
- ✅ Current problems documented with examples
- ✅ Proposed solution clearly explained
- ✅ Type definitions specified
- ✅ Implementation plan outlined
- ✅ Edge cases documented

## Outputs

- `docs/architecture/scope-aware-availability-design.md`

## Next Task

**task-epic-11.112.24** - Rename scope_id to defining_scope_id
