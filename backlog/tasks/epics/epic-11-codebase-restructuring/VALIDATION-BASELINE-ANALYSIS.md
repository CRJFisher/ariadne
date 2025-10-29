# Validation Baseline Analysis

**Date**: 2025-10-29
**Task**: 11.154.3 - Validation Infrastructure
**Purpose**: Analyze the 476 errors from initial validation run

---

## Summary

Validation found **476 errors** across **161 unique invalid captures**.

### Breakdown by Category

| Category | Observation |
|----------|-------------|
| **Duplicates/Fragments** (~50) | `.full`, `.chained`, `.deep`, `.chain`, `.prop`, `.field` - Should be REMOVED |
| **Type Fragments** (~40) | `@type.type_reference`, `@type.type_parameter` on child nodes - Should be consolidated |
| **Import/Export Fragments** (~30) | Capturing pieces of import statements - Should use complete captures |
| **Legitimate Optional** (~40) | Language-specific features that should be ADDED to schema |

**Recommendation**: Most errors are GOOD - they represent fragments that should be removed. Only ~25% need to be added to schema as legitimate optional captures.

---

## Category 1: Duplicate/Fragment Captures (REMOVE)

These are the problematic patterns causing bugs:

### Method Call Duplicates
```
@reference.call.full       (7 occurrences) ❌ REMOVE
@reference.call.chained    (7 occurrences) ❌ REMOVE
@reference.call.deep       (6 occurrences) ❌ REMOVE
```

**Why invalid**: Create duplicate captures for same method call

### Property/Field Fragments
```
@reference.property.prop   (6 occurrences) ❌ REMOVE
@reference.property.field  ❌ REMOVE
@reference.field           (6 occurrences) ❌ REMOVE
@reference.variable.chain  (6 occurrences) ❌ REMOVE
@reference.variable.deep   (3 occurrences) ❌ REMOVE
```

**Why invalid**: Fragment captures on child nodes, should be on parent

---

## Category 2: Type System Fragments (CONSOLIDATE)

Currently 42 occurrences of `@type.type_reference` - these are fragments:

```typescript
// Current (fragment captures on pieces):
(class_declaration
  name: (type_identifier) @type.type_reference          ; Fragment 1
  type_parameters: (type_parameters) @type.type_parameters  ; Fragment 2
) @type.type_parameter                                  ; Fragment 3
```

**Should be**:
```typescript
// Complete capture on class_declaration, extract type info via builder
(class_declaration
  name: (type_identifier) @definition.class
  // Builder extracts type parameters by traversing node
)
```

**Other type fragments to remove**:
- `@type.type_annotation` (9 occurrences)
- `@type.type_parameter` (5 occurrences)
- `@type.type_parameters` (6 occurrences)
- `@type.type_constraint` (5 occurrences)
- `@type.function`, `@type.method`, `@type.module` (metadata, not captures)

**Total**: ~70 type-related errors, mostly fragments

**Action**: Remove these, let builders extract type info from definition captures

---

## Category 3: Import/Export Fragments (CONSOLIDATE)

Currently capturing pieces of import/export statements:

```typescript
// Current (fragments):
(import_specifier
  name: (identifier) @import.reexport.named.original     ; Fragment 1
  alias: (identifier) @import.reexport.named.alias       ; Fragment 2
)
source: (string) @import.reexport.source.aliased         ; Fragment 3
```

**Should be**:
```typescript
// Complete capture:
(import_statement) @definition.import
// Builder extracts: specifiers, source, aliases from node traversal
```

**Invalid import/export patterns**:
- `@import.import` (26 occurrences) - redundant naming
- `@import.reexport.*` (multiple variants) - should be one pattern
- `@export.variable.*` (many variants) - fragments

**Total**: ~60 import/export errors, mostly fragments

**Action**: Use complete capture on import/export statements, extract details via builders

---

## Category 4: Legitimate Optional Captures (ADD TO SCHEMA)

These are valid language-specific features that should be in optional list:

### Rust-Specific (~20 captures)
```
@decorator.macro           ✅ ADD (Rust macros)
@definition.function.unsafe ✅ ADD (unsafe blocks)
@definition.function.const  ✅ ADD (const functions)
@reference.macro           ✅ ADD (macro invocations)
@scope.trait               ✅ ADD (trait scopes)
@scope.impl                ✅ ADD (impl scopes)
@reference.variable.borrowed ✅ ADD (Rust borrowing)
```

### TypeScript-Specific (~10 captures)
```
@definition.interface.method   ✅ ADD (interface methods)
@definition.interface.property ✅ ADD (interface properties)
@type.type_assertion           ✅ ADD (type assertions)
@scope.namespace               ✅ ADD (namespace scopes)
```

### Python-Specific (~5 captures)
```
@decorator.* variants          ✅ ADD (already partially in schema)
@scope.comprehension           ✅ ADD (list/dict comprehensions)
```

### Universal (~5 captures)
```
@reference.write               ✅ ADD (write references)
@return.function               ✅ ADD (returning functions)
@scope.constructor             ✅ ADD (constructor scope)
```

**Total**: ~40 legitimate patterns to add

---

## Recommendations

### Action 1: Expand Optional List (Minimal - ~40 patterns)

Add only the legitimate language-specific features listed in Category 4.

### Action 2: Document Removal Targets (~ 120 patterns)

Create list of fragments/duplicates to remove in Tasks 11.154.4-7:
- All `.full`, `.chained`, `.deep` qualifiers
- Type system fragments (`@type.type_reference` on child nodes)
- Import/export fragments (capturing pieces not wholes)

### Action 3: Investigate Remaining (~80 patterns)

Some captures may be:
- Legitimately needed but not yet understood
- Unused legacy patterns
- Experimental patterns never completed

Review these manually during query file refactoring.

---

## Key Insight

**Most errors (~75%) are GOOD errors** - they represent fragments and duplicates that SHOULD be removed.

**Only ~25% (~40 patterns) need to be added** to the optional list as legitimate language features.

This validates our conservative schema approach - better to start strict and add valid patterns than allow everything.

---

## Next Steps

### Option A: Minimal Schema Expansion
Add ~40 legitimate patterns to optional list, then proceed with query fixes.
Query fixes will remove the ~120 fragment patterns.

### Option B: Query Fixes First
Proceed to Task 11.154.4, let the errors guide which patterns to keep/remove.
Iteratively update schema as we validate each language.

**Recommendation**: Option A - expand schema with known-good patterns first, then fix queries. This gives clearer signal during query refactoring.

---

## Statistics

- **Total errors**: 476
- **Unique invalid captures**: 161
- **Duplicates/fragments** (remove): ~120 (75%)
- **Legitimate optional** (add): ~40 (25%)
- **Need investigation**: ~1 (rare patterns)

**After cleanup, expect**:
- Required: 23 patterns
- Optional: ~60 patterns (20 current + 40 added)
- Total allowed: ~83 patterns
- Down from 393 current = **79% reduction in capture complexity**
