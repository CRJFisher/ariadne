# Task Epic 11.105: Simplify Type Hint Extraction for Method Resolution

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 8-12 hours
**Dependencies:** None

## Overview

Simplify the semantic index type processing from 4 complex, overlapping structures to 2 focused type hint captures. Current code has significant duplication and unused complexity from an abandoned "comprehensive type resolution" effort. Only a small subset is actually used by production method resolution.

## Problem Statement

### Current State: Over-Engineered and Confusing

The semantic index currently extracts 4 type-related structures:

```typescript
export interface SemanticIndex {
  // Phase 6: Extract local type members (single-file only)
  readonly local_types: LocalTypeInfo[]; // 689 LOC

  // Phase 7: Extract type annotations (unresolved)
  readonly local_type_annotations: LocalTypeAnnotation[]; // 209 LOC

  // Phase 8: Extract type tracking (unresolved)
  readonly local_type_tracking: LocalTypeTracking; // 342 LOC

  // Phase 9: Extract type flow patterns (unresolved)
  readonly local_type_flow: LocalTypeFlowData; // 273 LOC
}
```

**Total: 1,513 lines of code across 4 modules**

### What's Actually Used in Production?

Analysis of the production method resolution pipeline reveals:

**CRITICAL (actually used):**

- ✅ `local_type_flow.constructor_calls` - Powers constructor-based type hints
  - Used in `local_type_context.ts:90-112`
  - Used in `heuristic_resolver.ts:342-364`

**USEFUL (partially used):**

- ✅ `local_type_annotations` - Tracks explicit type annotations
  - Used in `local_type_context.ts:115-127`

**UNUSED (dead code):**

- ❌ `local_types` - Duplicates `ClassDefinition.methods/properties`, only used in tests
- ❌ `local_type_tracking` - Only referenced in abandoned `enhanced_context.ts`
- ❌ `local_type_flow.{assignments, returns, call_assignments}` - Stub implementations

### Problems with Current Approach

1. **Duplication**: `local_types` mirrors data already in `ClassDefinition.methods[]`
2. **Overlap**: `local_type_tracking` and `local_type_annotations` extract similar data
3. **Incomplete**: `local_type_flow` has stub implementations that return hardcoded values
4. **Confusing**: Unclear which structure to use for what purpose
5. **Maintenance burden**: 1,500+ LOC for ~200 LOC of actual functionality
6. **Test complexity**: Tests use `local_types` instead of the canonical `index.classes`

## Proposed Solution

### Simplified Interface

Replace 4 structures with 2 focused captures:

```typescript
export interface SemanticIndex {
  /** Type annotations for variables, parameters, returns */
  readonly type_annotations: TypeAnnotation[];

  /** Constructor calls for tracking instance creation */
  readonly constructor_calls: ConstructorCall[];
}
```

**Result: ~250 LOC instead of 1,513 LOC (83% reduction)**

### Clear Purpose

Both structures have a single, clear purpose: **"Provide type hints for method resolution"**

- `type_annotations` → Explicit types (`let x: User`)
- `constructor_calls` → Instance creation (`new User()`)

Everything else (assignments, returns, type members) either:

- Already exists in definitions (`ClassDefinition.methods`)
- Isn't actually implemented (stub code)
- Isn't used by production code

## Architecture

### Before: Complex, Multi-Phase Processing

```
semantic_index.ts
├── extract_type_members() → local_types [689 LOC]
├── process_type_annotations() → local_type_annotations [209 LOC]
├── extract_type_tracking() → local_type_tracking [342 LOC]
└── extract_type_flow() → local_type_flow [273 LOC]
    └── build_local_type_context()
        └── heuristic_resolver
```

### After: Focused, Single-Purpose Extraction

```
semantic_index.ts
├── extract_type_annotations() → type_annotations [~150 LOC]
└── extract_constructor_calls() → constructor_calls [~100 LOC]
    └── build_local_type_context() [enhanced with better strategies]
        └── heuristic_resolver
```

## Success Criteria

1. ✅ Semantic index only extracts data actually used by method resolution
2. ✅ No duplication between type structures and definition structures
3. ✅ All existing method resolution tests pass
4. ✅ Tests using `local_types` migrated to use `index.classes`
5. ✅ 80%+ reduction in type extraction code
6. ✅ No performance regression in semantic indexing
7. ✅ Clear documentation of what each structure provides

## Benefits

### Code Quality

- **83% less code** - 1,513 LOC → 250 LOC
- **No duplication** - Type members use canonical `ClassDefinition`
- **Clear intent** - Each structure has single, obvious purpose
- **Complete implementations** - No stub/TODO code

### Developer Experience

- **Obvious what to use** - Two structures instead of four
- **Better tests** - Use canonical data sources (`index.classes`)
- **Less confusion** - Clear "type hints" vs "type definitions"
- **Easier maintenance** - Less code to understand and modify

### Performance

- **Faster indexing** - Skip unused extraction phases
- **Less memory** - Don't store duplicate type member data
- **Same resolution** - No loss of functionality

## Migration Path

### Phase 1: Audit (Task 105.1)

Document exactly what's used vs unused with concrete usage analysis

### Phase 2: Remove Unused Code (Tasks 105.2-105.4)

- Remove `local_types` from interface
- Remove `local_type_tracking` from interface
- Remove `local_type_flow.{assignments, returns, call_assignments}`

### Phase 3: Simplify Remaining (Tasks 105.5-105.6)

- Rename `local_type_annotations` → `type_annotations`
- Extract just `constructor_calls` from type flow
- Update semantic index builder

### Phase 4: Enhance Type Context (Task 105.7)

Improve `build_local_type_context()` with missing strategies:

- Function return type tracking
- Import-based type hints
- Better annotation resolution

### Phase 5: Update Tests (Tasks 105.8-105.9)

- Migrate tests using `local_types` to `index.classes`
- Remove tests for deleted structures
- Add tests for enhanced type context

## Risk Mitigation

### Risk: Breaking existing tests

**Mitigation:** Incremental migration with comprehensive test coverage

### Risk: Method resolution accuracy decrease

**Mitigation:** Enhanced type context building compensates for removed code

### Risk: Future type resolution needs

**Mitigation:** Keep extraction focused but extensible; can add back if proven necessary

## Non-Goals

- ❌ Full type inference system (not needed for method resolution)
- ❌ Cross-file type propagation (handled in symbol_resolution.ts)
- ❌ Generic type resolution (future enhancement)

## Related Work

- **task-epic-11.101** - Improve method resolution (uses these structures)
- **task-epic-11.104** - Reference metadata extraction (orthogonal concern)

## Implementation Details

See `task-epic-11.105-IMPLEMENTATION-GUIDE.md` for step-by-step breakdown.
