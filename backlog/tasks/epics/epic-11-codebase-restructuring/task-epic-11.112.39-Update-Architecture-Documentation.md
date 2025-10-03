# Task epic-11.112.39: Update Architecture Documentation

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 3 files modified/created
**Dependencies:** task-epic-11.112.38

## Objective

Update architecture documentation to reflect the scope system changes: scope assignment fix, sibling scope resolution, and scope-aware visibility system.

## Files

### MODIFIED
- `docs/architecture/semantic-index.md`
- `docs/architecture/symbol-resolution.md`

### CREATED
- `docs/architecture/scope-aware-visibility.md`

## Implementation Steps

### 1. Update Semantic Index Documentation (40 min)

Update `docs/architecture/semantic-index.md`:

```markdown
# Semantic Index Architecture

## Overview

The semantic index is a structured representation of a source file containing:
- **Definitions**: Functions, classes, variables, etc.
- **Scopes**: Lexical scope tree
- **References**: Variable/function usages
- **Types**: Type information (TypeScript, Python)

## Scope Assignment

### Defining Scope

All definitions have a `defining_scope_id` that points to the scope where they are declared.

**Key Fix (Task 11.112):**
Previously, `scope_id` used the full location span of the definition, which could include nested scopes (e.g., methods inside a class). This caused classes to be assigned to method scopes instead of file scope.

**Solution:**
`get_defining_scope_id()` uses only the START position of the definition location to find the correct declaring scope.

```typescript
// Before (WRONG):
const scope_id = get_scope_id(class_location);
// class_location spans lines 1-30, including method at lines 15-20
// Returns: method_scope (deepest scope in span)

// After (CORRECT):
const defining_scope_id = get_defining_scope_id(class_location);
// Uses only start position (line 1)
// Returns: file_scope (where class is declared)
```

### Scope Tree Structure

```
file_scope (root)
├─ function_scope (outer)
│  ├─ block_scope
│  └─ function_scope (inner)
└─ class_scope (MyClass)
   ├─ method_scope (method1)
   └─ method_scope (method2)
```

Each scope has:
- `id`: Unique identifier
- `parent_scope_id`: Parent in scope tree
- `children`: Child scope IDs
- `type`: Scope type (module, function, class, block, etc.)

## Scope Tree Queries

See `scope_tree_utils.ts` for utilities:
- `get_scope_ancestors()`: Get path to root
- `get_scope_descendants()`: Get all children
- `is_ancestor_of()`: Check ancestor relationship

## Processing Context

The `ProcessingContext` interface provides scope lookup during indexing:

```typescript
interface ProcessingContext {
  // Find deepest scope at a location (for references)
  get_scope_id(location: Location): ScopeId;

  // Find declaring scope for a definition (uses start position only)
  get_defining_scope_id(location: Location): ScopeId;
}
```

## Tree-sitter Queries

Scope creation is driven by `.scm` query files:
- `(function_declaration) @scope.function` - Creates ONE scope
- `(class_declaration) @scope.class` - Creates ONE scope
- `(statement_block) @scope.block` - Creates ONE scope

**Note:** No constructs create sibling scopes (e.g., no separate function name/body scopes).
```

### 2. Update Symbol Resolution Documentation (40 min)

Update `docs/architecture/symbol-resolution.md`:

```markdown
# Symbol Resolution Architecture

## Overview

Symbol resolution matches references (usages) to definitions using:
1. **Scope tree traversal**: Look up parent scopes
2. **Visibility checking**: Filter by scope-aware visibility
3. **Closest match**: Prefer definitions in closer scopes

## Resolution Algorithm

```typescript
function resolve_reference(
  reference_name: string,
  reference_scope_id: ScopeId
): SymbolId | undefined {
  // 1. Find all definitions with this name
  const candidates = find_definitions_by_name(reference_name);

  // 2. Filter by visibility
  const visible = candidates.filter(def =>
    visibility_checker.is_visible(def, reference_scope_id)
  );

  // 3. Choose closest match
  return choose_closest(visible, reference_scope_id);
}
```

## Visibility Filtering

The `VisibilityChecker` determines if a definition is visible from a reference location based on `VisibilityKind`:

### scope_local
Visible ONLY in the exact defining scope.
```typescript
const x = 1; // In block scope
{ console.log(x); } // NOT visible (different scope)
```

### scope_children
Visible in defining scope and all child scopes.
```typescript
function foo(x) { // x is parameter
  { console.log(x); } // Visible in child block
}
```

### file
Visible anywhere in the same file.
```typescript
class MyClass { } // file visibility

function useClass() {
  new MyClass(); // Visible
}
```

### exported
Visible from any file (requires import).
```typescript
export class MyClass { } // exported visibility
// Visible from other files
```

## Scope Traversal

Resolution traverses the scope tree UP from reference location:

```
Reference at scope D:
  D → C → B → A (root)

For each scope, check:
1. Is definition visible from scope D?
2. If multiple visible, choose closest (highest depth)
```

## Sibling Scope Resolution

**Decision:** Sibling scopes are NOT checked.

**Rationale:**
- No supported language creates sibling scopes that need mutual visibility
- Block scopes are siblings but variables aren't visible across them
- Function parameters are in the same scope as function body (not siblings)

See `docs/architecture/sibling-scope-resolution-decision.md` for full analysis.
```

### 3. Create Scope-Aware Visibility Documentation (60 min)

Create new file `docs/architecture/scope-aware-visibility.md`:

```markdown
# Scope-Aware Visibility System

## Overview

The scope-aware visibility system determines whether a symbol definition is visible from a given reference location. It replaces the old definition-centric `availability` system with a reference-centric `visibility` system.

## Problem with Old System

### availability (Deprecated)

The old system was definition-centric:

```typescript
type Availability = "local" | "file" | "file-export";
```

**Problems:**
1. "local" didn't specify WHERE the symbol was local to
2. Didn't account for reference location
3. Led to incorrect symbol resolution

**Example of bug:**
```typescript
function foo() {
  const x = 1; // availability = "local"
}

function bar() {
  x; // Should be UNAVAILABLE, but "local" doesn't tell us this
}
```

## New System: VisibilityKind

### Type Definition

```typescript
type VisibilityKind =
  | { kind: "scope_local" }
  | { kind: "scope_children" }
  | { kind: "file" }
  | { kind: "exported"; export_kind: ExportKind };
```

### Visibility Kinds

#### scope_local
**Visible only in the exact defining scope.**

Use cases:
- Block-scoped variables
- Local functions

```typescript
{
  const x = 1; // scope_local
  console.log(x); // ✓ Visible (same scope)

  {
    console.log(x); // ✗ Not visible (child scope)
  }
}
```

#### scope_children
**Visible in defining scope and all child scopes.**

Use cases:
- Function parameters
- Nested function definitions

```typescript
function foo(x) { // x has scope_children visibility
  console.log(x); // ✓ Visible (defining scope)

  {
    console.log(x); // ✓ Visible (child scope)
  }
}

console.log(x); // ✗ Not visible (parent scope)
```

#### file
**Visible anywhere in the same file.**

Use cases:
- File-scoped classes (not exported)
- File-scoped functions
- File-scoped interfaces

```typescript
// file1.ts
class MyClass { } // file visibility

function useClass() {
  new MyClass(); // ✓ Visible (same file)
}

// file2.ts
new MyClass(); // ✗ Not visible (different file)
```

#### exported
**Visible from any file (requires import).**

Use cases:
- Exported classes
- Exported functions
- Exported variables

```typescript
// file1.ts
export class MyClass { } // exported visibility

// file2.ts
import { MyClass } from './file1';
new MyClass(); // ✓ Visible (exported and imported)
```

## VisibilityChecker

### Usage

```typescript
const checker = new VisibilityChecker(semantic_index);

const is_visible = checker.is_visible(
  definition,           // The definition to check
  reference_scope_id    // Where the reference occurs
);
```

### Implementation

```typescript
class VisibilityChecker {
  is_visible(definition: Definition, reference_scope_id: ScopeId): boolean {
    switch (definition.visibility.kind) {
      case "scope_local":
        return definition.defining_scope_id === reference_scope_id;

      case "scope_children":
        return (
          definition.defining_scope_id === reference_scope_id ||
          is_ancestor_of(definition.defining_scope_id, reference_scope_id)
        );

      case "file":
        return same_file(definition, reference_scope_id);

      case "exported":
        return true; // Visible everywhere
    }
  }
}
```

## Migration Guide

### Mapping availability → visibility

| Old Availability | Context | New Visibility |
|------------------|---------|----------------|
| "local" | Parameter | scope_children |
| "local" | Block variable | scope_local |
| "local" | Nested function | scope_local |
| "file" | File-scoped symbol | file |
| "file-export" | Exported symbol | exported |

### Code Changes

```typescript
// Before:
if (definition.availability === "file-export") {
  // ...
}

// After:
if (definition.visibility.kind === "exported") {
  // ...
}
```

## Benefits

1. **Correctness**: References only resolve to truly visible symbols
2. **Clarity**: Explicit about scope relationships
3. **Flexibility**: Can add new visibility kinds (e.g., module-scoped)
4. **Type Safety**: TypeScript discriminated union catches errors
```

### 4. Update Main README (20 min)

Add section about scope-aware visibility to main README.

### 5. Cross-link Documents (10 min)

Add links between related docs:
- semantic-index.md ↔ scope-aware-visibility.md
- symbol-resolution.md ↔ scope-aware-visibility.md
- sibling-scope-resolution-decision.md ↔ symbol-resolution.md

## Success Criteria

- ✅ Semantic index docs updated with scope assignment fix
- ✅ Symbol resolution docs updated with visibility system
- ✅ New scope-aware visibility documentation created
- ✅ Main README updated
- ✅ Documents cross-linked
- ✅ All examples clear and accurate

## Outputs

- Updated architecture documentation
- New visibility system documentation

## Next Task

**task-epic-11.112.40** - Create migration guide
