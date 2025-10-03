# Task epic-11.112.40: Create Migration Guide

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2 hours
**Files:** 1 file created
**Dependencies:** task-epic-11.112.39

## Objective

Create a comprehensive migration guide for users upgrading from the old availability system to the new scope-aware visibility system. This guide should cover all breaking changes and provide clear examples.

## Files

### CREATED
- `docs/migration/v1-to-v2-scope-visibility.md`

## Implementation Steps

### 1. Create Migration Guide Structure (15 min)

```markdown
# Migration Guide: v1.x → v2.0 (Scope & Visibility)

## Overview

Version 2.0 introduces significant improvements to scope handling and symbol visibility:

1. **Scope Assignment Fix**: Definitions now use `defining_scope_id` instead of `scope_id`
2. **Scope-Aware Visibility**: New `visibility` field replaces `availability`
3. **Improved Symbol Resolution**: References resolve only to truly visible symbols

## Breaking Changes

### 1. Field Renaming: scope_id → defining_scope_id

All definition types now use `defining_scope_id`:

```typescript
// v1.x
class_def.scope_id

// v2.0
class_def.defining_scope_id
```

**Impact**: Any code reading the scope of a definition needs updating.

### 2. Field Replacement: availability → visibility

The `availability` field has been removed. Use `visibility` instead:

```typescript
// v1.x
if (definition.availability === "file-export") { }

// v2.0
if (definition.visibility.kind === "exported") { }
```

**Impact**: All availability checks need updating.

### 3. Type Removal: Availability

The `Availability` type has been removed. Use `VisibilityKind` instead.

## Migration Steps

### Step 1: Update Field Access (30 min)

**Find all scope_id accesses:**
```bash
grep -r "\.scope_id" your-code/ --include="*.ts"
```

**Replace with defining_scope_id:**
```typescript
// Before
const scope = definition.scope_id;

// After
const scope = definition.defining_scope_id;
```

### Step 2: Update Availability Checks (60 min)

**Find all availability checks:**
```bash
grep -r "\.availability" your-code/ --include="*.ts"
```

**Replace with visibility checks:**

| Old Code | New Code |
|----------|----------|
| `def.availability === "local"` | `def.visibility.kind === "scope_local"` or `"scope_children"` |
| `def.availability === "file"` | `def.visibility.kind === "file"` |
| `def.availability === "file-export"` | `def.visibility.kind === "exported"` |

### Step 3: Update Symbol Resolution (if using custom logic)

If you have custom symbol resolution logic:

```typescript
// Before (v1.x)
function find_symbol(name: string): Definition | undefined {
  const candidates = get_definitions(name);

  // Simple filter by availability
  return candidates.find(def => def.availability !== "local");
}

// After (v2.0)
function find_symbol(
  name: string,
  reference_scope_id: ScopeId
): Definition | undefined {
  const candidates = get_definitions(name);

  // Use VisibilityChecker
  const checker = new VisibilityChecker(semantic_index);
  return candidates.find(def =>
    checker.is_visible(def, reference_scope_id)
  );
}
```

### Step 4: Update Tests

Update test assertions:

```typescript
// Before
expect(class_def.scope_id).toBe(file_scope);
expect(class_def.availability).toBe("file");

// After
expect(class_def.defining_scope_id).toBe(file_scope);
expect(class_def.visibility.kind).toBe("file");
```

## Detailed Changes

### Availability → Visibility Mapping

#### For Parameters

```typescript
// v1.x
interface ParameterDefinition {
  availability: "local"; // All parameters were "local"
}

// v2.0
interface ParameterDefinition {
  visibility: { kind: "scope_children" }; // Parameters visible in function body
}
```

#### For Variables

**Block-scoped variables:**
```typescript
// v1.x: availability = "local"
// v2.0: visibility = { kind: "scope_local" }
{
  const x = 1; // Only visible in this exact scope
}
```

**File-scoped variables:**
```typescript
// v1.x: availability = "file"
// v2.0: visibility = { kind: "file" }
const x = 1; // Visible anywhere in file
```

#### For Classes/Functions

**Not exported:**
```typescript
// v1.x: availability = "file"
// v2.0: visibility = { kind: "file" }
class MyClass { } // Visible in file only
```

**Exported:**
```typescript
// v1.x: availability = "file-export"
// v2.0: visibility = { kind: "exported", export_kind: { kind: "named", export_name: "MyClass" } }
export class MyClass { } // Visible from other files
```

## New Features

### VisibilityChecker

Use the new `VisibilityChecker` to check if a definition is visible:

```typescript
import { VisibilityChecker } from '@ariadnejs/core';

const checker = new VisibilityChecker(semantic_index);

if (checker.is_visible(definition, reference_scope_id)) {
  // Definition is visible from reference location
}
```

### Scope Tree Utilities

New utilities for working with scope trees:

```typescript
import {
  get_scope_ancestors,
  get_scope_descendants,
  is_ancestor_of,
  get_common_ancestor,
} from '@ariadnejs/core';

// Get path from scope to root
const ancestors = get_scope_ancestors(scope_id, index);

// Check ancestor relationship
if (is_ancestor_of(parent_id, child_id, index)) {
  // parent is an ancestor of child
}
```

## Benefits of Migration

1. **Correctness**: Symbol resolution now respects lexical scope rules
2. **Clarity**: Visibility is explicit and relative to reference location
3. **Type Safety**: TypeScript catches visibility errors at compile time
4. **Flexibility**: Easy to add new visibility kinds in the future

## Examples

### Example 1: Class Visibility

```typescript
// Code
class MyClass {
  method() {
    const x = 1;
  }
}

// v1.x (WRONG)
// class_def.scope_id pointed to method scope
// class_def.availability = "file"

// v2.0 (CORRECT)
// class_def.defining_scope_id points to file scope
// class_def.visibility = { kind: "file" }
```

### Example 2: Parameter Visibility

```typescript
// Code
function foo(param) {
  {
    console.log(param); // Should be visible
  }
}

// v1.x
// param.availability = "local" (ambiguous)

// v2.0
// param.visibility = { kind: "scope_children" } (explicit)
// Visible in foo's scope and all child scopes
```

### Example 3: Variable Shadowing

```typescript
// Code
const x = 1; // outer x

function foo() {
  const x = 2; // inner x
  console.log(x); // Should resolve to inner x
}

// v2.0
// Both x definitions visible, but inner x chosen (closer scope)
```

## FAQ

### Q: Why was this change necessary?

A: The old system had a fundamental bug where class/interface/enum definitions were assigned to incorrect scopes (method scopes instead of file scope). This broke TypeContext and made symbol resolution unreliable.

### Q: Do I need to regenerate my semantic index?

A: Yes. Semantic indices created with v1.x are incompatible with v2.0 due to schema changes.

### Q: Can I use both availability and visibility during migration?

A: No. v2.0 completely removes the `availability` field. You must migrate all code before upgrading.

### Q: How do I handle custom visibility logic?

A: Use `VisibilityChecker` instead of implementing custom logic. If you need custom behavior, extend the checker or create a wrapper.

## Support

For issues during migration:
- GitHub Issues: [link]
- Migration Examples: [link to examples repo]
- API Documentation: [link]
```

### 2. Add Code Examples (30 min)

Create `docs/migration/examples/` with before/after code samples.

### 3. Add Migration Checklist (15 min)

```markdown
## Migration Checklist

- [ ] Update all `.scope_id` to `.defining_scope_id`
- [ ] Update all `.availability` checks to `.visibility.kind`
- [ ] Replace availability filters with VisibilityChecker
- [ ] Update all test assertions
- [ ] Regenerate semantic indices
- [ ] Run full test suite
- [ ] Update documentation
- [ ] Deploy and monitor
```

## Success Criteria

- ✅ Comprehensive migration guide created
- ✅ All breaking changes documented
- ✅ Step-by-step migration instructions
- ✅ Before/after code examples
- ✅ FAQ section
- ✅ Migration checklist

## Outputs

- `docs/migration/v1-to-v2-scope-visibility.md`

## Next Task

**task-epic-11.112.41** - Update API documentation
