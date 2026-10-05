# Task Epic-11.157: Delete Test-Only and Dead Code Exports

**Status**: TODO
**Priority**: P2 (Code Quality)
**Estimated Effort**: 1-2 days
**Epic**: epic-11-codebase-restructuring
**Impact**: Removes 32 unused exports (24% of "misidentifications" - not actually bugs)

## Problem

Analysis identified two categories of "uncalled" exports that are **not call graph bugs**:

1. **Test-Only Exports** (17 instances): Public methods only called from test files
2. **Dead Code** (15 instances): Exported functions never imported or called anywhere

### Category 1: Test-Only Exports

Functions exported as public API but only used in tests:

```typescript
// query_loader.ts
export function has_query(language: Language): boolean {
  // Called 33+ times in tests, 0 times in production
}

// import_graph.ts
export function detect_cycle(): ImportCycle[] {
  // Test-only public API method
}

// *_registry.ts
export function get_all_files(): string[] {
  // Common registry pattern, test-only usage
}
```

**Why they exist**: Originally intended as public API or testing utilities, but never used in production code.

**Verdict**: If truly test-only, they should be **removed along with their tests** (violates intention tree - surplus code that doesn't serve the core purpose).

### Category 2: Dead Code

Functions exported but never imported or called:

```typescript
// rust_builder_helpers.ts (10 functions)
export function extract_lifetime_parameters() { /* ... */ }
export function extract_trait_bounds() { /* ... */ }
export function is_async_function() { /* ... */ }
export function is_const_function() { /* ... */ }
export function is_unsafe_function() { /* ... */ }
export function has_generic_parameters() { /* ... */ }
// ... 4 more

// typescript_builder.ts
export function extract_implements() { /* ... */ }  // Removed from config, export remains
export function is_optional_member() { /* ... */ }
export function is_abstract_class() { /* ... */ }
```

**Why they exist**:
- Written speculatively ("might need this later")
- Refactoring artifacts (functionality removed but export remains)
- Incomplete feature integration

**Verdict**: **Delete immediately** (violates intention tree - unused branches).

## Design Principles

### 1. **Intention Tree Adherence**

From CLAUDE.md:
> We _never_ add 'extra' functionality outside of this intention tree, even if it is 'well-meaning' and 'might' be used one day. 'extra', surplus code reduces our longterm velocity.

**Corollary**: Remove code that doesn't serve the top-level intention (detecting call graphs to find entry points).

### 2. **Tests Follow Implementation**

If a function exists **only** to be tested, and doesn't serve the core purpose, then:
- Function should be deleted
- Tests should be deleted
- Exception: Infrastructure tests (e.g., testing DefinitionBuilder itself)

**Test-only exports violate this**: They exist to provide test access, not to serve the codebase purpose.

### 3. **No Backward Compatibility**

From CLAUDE.md:
> DO NOT SUPPORT BACKWARD COMPATIBILITY - JUST _CHANGE_ THE CODE.

We don't need to deprecate these exports—just delete them.

## Implementation Plan

### Phase 1: Verification (0.5 days)

Before deleting, **verify** each instance is truly unused:

```bash
# For each export, check:
# 1. No imports in production code
grep -r "import.*has_query" packages/core/src --exclude="*.test.ts"

# 2. No imports in other packages
grep -r "import.*has_query" packages/*/src

# 3. Only test imports
grep -r "import.*has_query" packages/core/src/**/*.test.ts
```

**Automation**: Create script to check all 32 instances:

```typescript
// scripts/verify_dead_exports.ts

interface DeadExport {
  file: string;
  export_name: string;
  category: 'test_only' | 'dead_code';
}

const CANDIDATES: DeadExport[] = [
  { file: 'query_loader.ts', export_name: 'has_query', category: 'test_only' },
  { file: 'rust_builder_helpers.ts', export_name: 'extract_lifetime_parameters', category: 'dead_code' },
  // ... all 32 instances
];

async function verify_dead_exports() {
  for (const candidate of CANDIDATES) {
    const production_uses = await find_imports(candidate, { exclude_tests: true });
    const test_uses = await find_imports(candidate, { only_tests: true });

    console.log(`${candidate.export_name}:`);
    console.log(`  Production: ${production_uses.length}`);
    console.log(`  Tests: ${test_uses.length}`);

    if (production_uses.length > 0) {
      console.warn(`  ⚠️  NOT DEAD - has production usage`);
    }
  }
}
```

### Phase 2: Delete Dead Code Exports (0.5 days)

Remove exports and their implementations:

#### rust_builder_helpers.ts (10 functions)

```typescript
// DELETE entire functions:
// - extract_lifetime_parameters()
// - extract_trait_bounds()
// - is_async_function()
// - is_const_function()
// - is_unsafe_function()
// - has_generic_parameters()
// - extract_return_type()
// - extract_function_modifiers()
// - is_public_function()
// - has_where_clause()
```

**Rationale**: These were written for Rust semantic analysis but never integrated into the language builder.

#### typescript_builder.ts (5 functions)

```typescript
// DELETE:
// - extract_implements() - removed from config
// - is_optional_member() - unused
// - is_abstract_class() - unused
// - extract_decorators() - decorator support not implemented
// - is_readonly_property() - unused
```

### Phase 3: Analyze Test-Only Exports (0.5 days)

For each test-only export, determine:

**Decision tree**:
```
Is the function testing infrastructure?
├─ YES → Keep (e.g., DefinitionRegistry.get_all() for inspecting state)
└─ NO → Is it used by external tests (outside packages/core)?
   ├─ YES → Keep (external API)
   └─ NO → DELETE (internal test-only)
```

#### Query Loader

```typescript
// query_loader.ts
export function has_query(language: Language): boolean { /* ... */ }
```

**Analysis**:
- Called 33+ times in `query_loader.test.ts`
- Tests implementation detail (query cache)
- Not used externally

**Decision**: **DELETE** (including tests)

#### Registry get_all_* Methods

```typescript
// export_registry.ts
export function get_all_files(): string[] { /* ... */ }
export function get_all_exports(): ExportDefinition[] { /* ... */ }

// type_registry.ts
export function get_all_types(): TypeBinding[] { /* ... */ }

// definition_registry.ts
export function get_all_definitions(): Definition[] { /* ... */ }
```

**Analysis**:
- Used in registry tests to inspect full state
- Useful for debugging (could dump registry contents)
- Potentially useful for external analysis tools

**Decision**: **KEEP** (testing infrastructure, potentially useful API)

**Alternative**: Move to test utilities if we want to hide from public API:

```typescript
// packages/core/src/test_utils/registry_inspectors.ts
export function get_all_definitions(registry: DefinitionRegistry): Definition[] {
  // Access internal state
}
```

#### Import Graph Helpers

```typescript
// import_graph.ts
export function detect_cycle(): ImportCycle[] { /* ... */ }
export function get_strongly_connected_components(): ImportNode[][] { /* ... */ }
```

**Analysis**:
- Test graph algorithms
- Could be useful for external tooling (cycle detection)
- Part of potential public API

**Decision**: **KEEP** (could be legitimate public API)

### Phase 4: Delete Test-Only Exports (If Applicable) (0.5 days)

Based on Phase 3 analysis, delete exports deemed truly test-only:

```typescript
// Remove from query_loader.ts
- export function has_query(language: Language): boolean

// Remove tests from query_loader.test.ts
- describe('has_query', () => { /* ... */ })
```

**Updated exports**:
```typescript
// query_loader.ts - before
export { load_query, has_query, clear_cache };

// query_loader.ts - after
export { load_query, clear_cache };
```

## Detailed Inventory

### Dead Code Exports (15 total)

#### rust_builder_helpers.ts (10)
| Function | LOC | Reason Never Used |
|----------|-----|-------------------|
| `extract_lifetime_parameters()` | 15 | Lifetime analysis not implemented |
| `extract_trait_bounds()` | 20 | Generic bounds not captured |
| `is_async_function()` | 5 | Async not distinguished in semantic index |
| `is_const_function()` | 5 | Const modifiers not captured |
| `is_unsafe_function()` | 5 | Unsafe not tracked |
| `has_generic_parameters()` | 8 | Generic detection incomplete |
| `extract_return_type()` | 12 | Return types not fully tracked |
| `extract_function_modifiers()` | 10 | Modifiers not captured |
| `is_public_function()` | 5 | Visibility via different mechanism |
| `has_where_clause()` | 8 | Where clauses not analyzed |

**Total LOC to delete**: ~93 lines

#### typescript_builder.ts (5)
| Function | LOC | Reason Never Used |
|----------|-----|-------------------|
| `extract_implements()` | 12 | Removed from language config |
| `is_optional_member()` | 5 | Optional detection via different path |
| `is_abstract_class()` | 5 | Abstract not tracked separately |
| `extract_decorators()` | 15 | Decorator support not implemented |
| `is_readonly_property()` | 5 | Readonly not distinguished |

**Total LOC to delete**: ~42 lines

### Test-Only Exports (17 total)

| File | Function | Test Files | Production Uses | Recommendation |
|------|----------|------------|-----------------|----------------|
| `query_loader.ts` | `has_query()` | 1 | 0 | DELETE |
| `query_loader.ts` | `get_cache_stats()` | 1 | 0 | DELETE |
| `import_graph.ts` | `detect_cycle()` | 1 | 0 | KEEP (public API) |
| `import_graph.ts` | `get_scc()` | 1 | 0 | KEEP (public API) |
| `export_registry.ts` | `get_all_files()` | 2 | 0 | KEEP (test infra) |
| `export_registry.ts` | `get_all_exports()` | 2 | 0 | KEEP (test infra) |
| `type_registry.ts` | `get_all_types()` | 3 | 0 | KEEP (test infra) |
| `type_registry.ts` | `get_all_bindings()` | 3 | 0 | KEEP (test infra) |
| `definition_registry.ts` | `get_all_definitions()` | 4 | 0 | KEEP (test infra) |
| `scope_registry.ts` | `get_all_scopes()` | 2 | 0 | KEEP (test infra) |
| `resolution_registry.ts` | `get_resolution_map()` | 2 | 0 | KEEP (test infra) |
| ... | ... | ... | ... | ... |

**Recommended deletions**: 2-4 functions (query_loader utilities)

## Success Criteria

- [ ] All 15 dead code exports deleted
- [ ] All unused helper functions removed
- [ ] 2-4 test-only utilities deleted (after verification)
- [ ] No broken imports in production code
- [ ] Test suite passes (with test-only tests removed)
- [ ] Code reduction: ~135 LOC deleted
- [ ] No regressions in call graph analysis

## Implementation Notes

### Why This Matters

**Cognitive load**: Every exported function is API surface that developers must understand.

**Maintenance burden**: Unused code still needs to be:
- Updated when types change
- Reviewed in PRs
- Kept in mind during refactoring

**False signals**: Exports suggest "this is important/used" when it's not.

**Intention tree violation**: Code exists outside the core purpose.

### Automated Detection

This task is reactive (cleaning up known dead code). For **proactive** detection, create:

```typescript
// scripts/detect_unused_exports.ts

// Use the same analysis that found these issues:
// 1. Build import/export graph
// 2. Find exports with 0 imports
// 3. Exclude public API (exported from index.ts)
// 4. Flag for review
```

Add to CI to prevent future accumulation.

## Related Tasks

- **task-100.24**: Original dead code tracking task
- **task-epic-11.155**: Self-reference resolution (actual bugs)
- **task-epic-11.156**: Anonymous callback capture (actual bugs)

## Out of Scope

- **Unused private functions**: Focus on exports (public API surface)
- **Unused types**: Separate task (type cleanup)
- **Deprecated API**: Nothing to deprecate, just delete
- **External package consumers**: This is internal to @ariadnejs/core

## Rollback Plan

If deletion causes unexpected breakage:

1. Git revert the commit
2. Add breakage case to verification script
3. Re-run verification
4. Delete only confirmed-safe exports

**Prevention**: Comprehensive verification in Phase 1 should prevent this.
