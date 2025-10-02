# Task Epic 11.110: Implement Scope-Aware Availability System

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 5-7 days
**Parent:** epic-11
**Dependencies:**
- task-epic-11.109 (Scope-Aware Symbol Resolution - provides scope infrastructure)

## Objective

Refactor the `SymbolAvailability` system to be scope-aware. Currently, availability is a static property of a symbol definition that doesn't account for *where* you're trying to reference it from. This task makes availability relative to the referencing scope.

## Problem Statement

### Current Architecture

```typescript
interface SymbolAvailability {
  scope: "local" | "file" | "file-export" | "public";
  export?: ExportInfo;
}

interface FunctionDefinition {
  symbol_id: SymbolId;
  name: SymbolName;
  scope_id: ScopeId;  // Where it's defined
  availability: SymbolAvailability;  // Static property
}
```

### The Problem

Availability is currently **definition-centric** rather than **reference-centric**:

```typescript
// file: utils.ts
function helper() {}  // availability.scope = "file"

export function public_helper() {}  // availability.scope = "file-export"

function outer() {
  function inner() {}  // availability.scope = "local"

  function nested() {
    // Can we call inner()?
    // Current system: availability.scope = "local" (but where?)
    // Missing: "local relative to WHICH scope?"
  }
}
```

The current system can't answer: "Is symbol X available from scope Y?"

### What's Missing

1. **Scope Hierarchy** - `availability.scope = "local"` doesn't tell us which scope(s) can see it
2. **Import Scope** - Imported symbols should only be available in scopes at/below the import statement
3. **Variable Shadowing Context** - Local variables shadow parent scope variables, but availability doesn't encode this
4. **Reference Validation** - Can't validate "is this reference legal?" without scope context

## Proposed Solution

### New Architecture

```typescript
/**
 * Scope-aware availability: answers "Can scope Y see symbol X?"
 */
interface SymbolAvailability {
  // The scope where this symbol is defined/imported
  defining_scope_id: ScopeId;

  // Visibility rules
  visibility:
    | { kind: "local"; scope_id: ScopeId }  // Only visible in this scope
    | { kind: "local-recursive" }            // Visible in defining scope + children
    | { kind: "file" }                       // Visible anywhere in file
    | { kind: "file-export" }                // Visible to importers
    | { kind: "public" }                     // Public class member
    | { kind: "import"; import_scope_id: ScopeId }  // Imported, visible from import scope down

  // Export metadata (if exported)
  export?: ExportInfo;
}
```

### Availability Checker

```typescript
/**
 * Check if a symbol is available from a given scope
 */
function is_available(
  symbol_def: AnyDefinition,
  reference_scope_id: ScopeId,
  scope_tree: ScopeTree
): boolean {

  const availability = symbol_def.availability;

  switch (availability.visibility.kind) {
    case "local":
      // Only visible in the exact defining scope
      return reference_scope_id === availability.visibility.scope_id;

    case "local-recursive":
      // Visible in defining scope and all children
      return (
        reference_scope_id === availability.defining_scope_id ||
        scope_tree.is_ancestor(availability.defining_scope_id, reference_scope_id)
      );

    case "file":
      // Visible anywhere in the same file
      return scope_tree.get_file(reference_scope_id) ===
             scope_tree.get_file(availability.defining_scope_id);

    case "file-export":
      // Visible to importers (handled by import resolution)
      return true;

    case "import":
      // Visible from import scope downward
      return (
        reference_scope_id === availability.visibility.import_scope_id ||
        scope_tree.is_ancestor(availability.visibility.import_scope_id, reference_scope_id)
      );

    default:
      return false;
  }
}
```

## Implementation Plan

### Phase 1: Scope Tree Infrastructure
Build scope tree utilities needed for ancestor checking:

```typescript
interface ScopeTree {
  get_parent(scope_id: ScopeId): ScopeId | null;
  get_ancestors(scope_id: ScopeId): ScopeId[];
  is_ancestor(ancestor: ScopeId, descendant: ScopeId): boolean;
  get_file(scope_id: ScopeId): FilePath;
}
```

### Phase 2: Update SymbolAvailability Type
- Add `defining_scope_id` field
- Replace simple `scope` string with structured `visibility` union
- Update all definition types to use new availability

### Phase 3: Update Indexing Phase
Modify symbol indexing to set scope-aware availability:

```typescript
// Function at file level
availability: {
  defining_scope_id: root_scope_id,
  visibility: { kind: "file" }
}

// Function nested in another function
availability: {
  defining_scope_id: parent_function_scope_id,
  visibility: { kind: "local-recursive" }
}

// Imported symbol
availability: {
  defining_scope_id: source_file_scope_id,  // Where it's actually defined
  visibility: { kind: "import", import_scope_id: import_statement_scope_id }
}
```

### Phase 4: Implement Availability Checker
Create `is_available()` function and integrate with resolution system.

### Phase 5: Update Resolution System
Modify task 11.109 resolvers to use availability checking:

```typescript
// In resolve() function:
const symbol_id = resolver();
if (!symbol_id) return null;

// NEW: Validate availability
const symbol_def = get_definition(symbol_id);
if (!is_available(symbol_def, reference_scope_id, scope_tree)) {
  return null;  // Symbol exists but not available from this scope
}

return symbol_id;
```

### Phase 6: Testing
Comprehensive tests for:
- Local variable visibility (function scope boundaries)
- Import visibility (only below import statement)
- Nested scope availability
- Shadowing scenarios
- Cross-file exports

## Benefits

### 1. Correctness
Catches illegal references that current system allows:
```typescript
function outer() {
  inner();  // ERROR: inner not yet defined
  function inner() {}
}
```

### 2. Better Error Messages
Can distinguish:
- "Symbol not found" (doesn't exist)
- "Symbol not accessible" (exists but out of scope)

### 3. Import Scope Validation
```typescript
if (condition) {
  import { helper } from './utils';
}
helper();  // ERROR: helper only available inside if block
```

### 4. Enables Future Features
- Unused import detection (know which scope can use it)
- Auto-import suggestions (know where to add import)
- Refactoring tools (understand visibility boundaries)

## Migration Strategy

### Backward Compatibility
Old code that reads `availability.scope` string will break. Need to:

1. **Gradual migration**: Support both old and new format during transition
2. **Adapter layer**: Provide `get_legacy_scope()` that maps new format to old
3. **Update consumers**: Modify all code reading availability to use new format

### Example Adapter
```typescript
function get_legacy_scope(availability: SymbolAvailability): string {
  switch (availability.visibility.kind) {
    case "local":
    case "local-recursive":
      return "local";
    case "file":
      return "file";
    case "file-export":
      return "file-export";
    case "public":
      return "public";
    case "import":
      return "file";  // Imported symbols act as file-scoped
  }
}
```

## Open Questions

### 1. Python Import Scope
Python allows imports inside functions - are they scoped to that function or the whole file?
```python
def foo():
    import os  # Scoped to foo() or whole file?
    os.path.join()
```

### 2. Hoisting
JavaScript function declarations are hoisted - they're available before definition:
```javascript
foo();  // Works!
function foo() {}
```

How does this interact with scope-aware availability?

### 3. Class Member Visibility
Class members have `public`, `private`, `protected`:
```typescript
class MyClass {
  private helper() {}
  public method() {
    this.helper();  // OK from inside class
  }
}
```

Should this use the availability system or separate access control?

## Success Criteria

### Functional
- ✅ Scope tree infrastructure implemented
- ✅ New SymbolAvailability type defined
- ✅ Indexing phase updated to set scope-aware availability
- ✅ `is_available()` checker implemented
- ✅ Integration with resolution system
- ✅ All existing tests still pass

### Testing
- ✅ Local scope boundaries enforced
- ✅ Import scope restrictions enforced
- ✅ Nested scope availability correct
- ✅ Shadowing handled correctly
- ✅ All 4 languages tested

### Quality
- ✅ Full documentation
- ✅ Migration guide for old availability format
- ✅ Performance testing (availability checks are O(1) or O(log n))

## Technical Notes

### Performance Considerations
Availability checking happens during resolution, which is already cached. The additional check is:
- O(1) for "local", "file", "file-export"
- O(log n) for "local-recursive", "import" (ancestor checking with caching)

Not a performance concern.

### Scope Tree Caching
Build scope tree once during index build:
```typescript
const scope_tree = build_scope_tree(indices);
// Cache ancestor relationships for O(1) lookup
```

## Dependencies

**Uses:**
- Task 11.109 scope infrastructure (ScopeId, scope_id on definitions)
- SemanticIndex with scope information

**Consumed by:**
- Task 11.109 resolution system (validates availability during resolution)
- Future: Auto-import suggestions
- Future: Unused import detection
- Future: Refactoring tools

## Related Work

This task addresses the second issue raised during task 11.109.3 review - that availability doesn't use scope knowledge. This is a foundational improvement that makes the availability system consistent with our scope-aware architecture.

## Next Steps

After completion:
- Update task 11.109.3 to use scope-aware availability for export detection
- Consider adding reference validation pass that flags illegal references
- Build tools on top (unused imports, auto-imports, etc.)
