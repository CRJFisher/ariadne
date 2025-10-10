# Sub-task 139.9: Performance Benchmarking and Optimization

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: Medium
**Complexity**: Medium
**Estimated Effort**: 1 day

## Overview

Benchmark the registry-based `resolve_symbols()` implementation against the original baseline, identify any performance regressions, and optimize hot paths if needed.

**Why needed?**
- ✅ Verify no significant performance regression
- 📊 Establish performance baseline for future work
- 🎯 Identify and fix any bottlenecks
- 📈 Document performance improvements (scope queries, etc.)

## Success Criteria

**Target**: < 5% regression compared to baseline (Phase 1)
**Stretch Goal**: Measurable improvements in specific areas (scope queries)

## Scope

### What to Benchmark

1. **End-to-End Resolution Time**
   - Small project (10 files, ~1000 definitions)
   - Medium project (100 files, ~10,000 definitions)
   - Large project (1000 files, ~100,000 definitions)

2. **Individual Component Performance**
   - `build_scope_resolver_index()` time
   - `build_type_context()` time
   - `resolve_function_calls()` time
   - `resolve_method_calls()` time
   - `resolve_constructor_calls()` time

3. **Registry Operation Performance**
   - `definitions.get_scope_definitions()` (cached vs uncached)
   - `exports.get_export_by_name()` (linear search)
   - `types.get_type_members()` (cache hit rate)

4. **Memory Usage**
   - Registry cache overhead
   - Peak memory during resolution
   - Memory after resolution (check for leaks)

### What NOT to Benchmark

- Individual tree-sitter parsing (not changed)
- SemanticIndex building (not changed)
- Test execution time (not production code)

## Implementation Plan

### Step 1: Create Benchmark Suite (Morning)

**File**: `packages/core/benchmarks/symbol_resolution.bench.ts` (new)

```typescript
import { describe, bench } from 'vitest';
import { resolve_symbols } from '../src/resolve_references/symbol_resolution';
import { build_semantic_index } from '../src/index_single_file/semantic_index';

describe('Symbol Resolution Performance', () => {
  // Fixture: Small project
  const small_project = create_test_project({
    files: 10,
    avg_definitions_per_file: 100,
    avg_scopes_per_file: 20,
  });

  // Fixture: Medium project
  const medium_project = create_test_project({
    files: 100,
    avg_definitions_per_file: 100,
    avg_scopes_per_file: 20,
  });

  // Fixture: Large project
  const large_project = create_test_project({
    files: 1000,
    avg_definitions_per_file: 100,
    avg_scopes_per_file: 20,
  });

  bench('resolve_symbols - small project (10 files)', () => {
    resolve_symbols_with_registries(small_project.indices, small_project.root_folder);
  });

  bench('resolve_symbols - medium project (100 files)', () => {
    resolve_symbols_with_registries(medium_project.indices, medium_project.root_folder);
  });

  bench('resolve_symbols - large project (1000 files)', () => {
    resolve_symbols_with_registries(large_project.indices, large_project.root_folder);
  });
});
```

**Run benchmarks**:
```bash
npm run bench -- symbol_resolution.bench.ts
```

---

### Step 2: Component-Level Benchmarks (Morning)

**File**: `packages/core/benchmarks/registry_performance.bench.ts` (new)

```typescript
describe('Registry Performance', () => {
  describe('DefinitionRegistry', () => {
    bench('get_scope_definitions - cold cache', () => {
      const registry = create_populated_definition_registry(1000);
      registry.get_scope_definitions(scope_id, file_id);
    });

    bench('get_scope_definitions - warm cache (10x calls)', () => {
      const registry = create_populated_definition_registry(1000);
      // First call warms cache
      registry.get_scope_definitions(scope_id, file_id);

      // Benchmark repeated calls
      for (let i = 0; i < 10; i++) {
        registry.get_scope_definitions(scope_id, file_id);
      }
    });

    bench('update_file - invalidation cost', () => {
      const registry = create_populated_definition_registry(1000);
      // Warm cache
      registry.get_scope_definitions(scope_id, file_id);

      // Benchmark update (invalidates cache)
      registry.update_file(file_id, new_definitions);
    });
  });

  describe('ExportRegistry', () => {
    bench('get_export_by_name - 10 exports', () => {
      const registry = create_export_registry(10);
      registry.get_export_by_name(file_id, 'symbol', definitions);
    });

    bench('get_export_by_name - 100 exports', () => {
      const registry = create_export_registry(100);
      registry.get_export_by_name(file_id, 'symbol', definitions);
    });

    bench('get_export_by_name - worst case (last export)', () => {
      const registry = create_export_registry(100);
      registry.get_export_by_name(file_id, 'symbol99', definitions);
    });
  });
});
```

---

### Step 3: Memory Profiling (Afternoon)

**Use Node.js memory profiling**:

```typescript
// packages/core/benchmarks/memory_usage.ts
import { performance, PerformanceObserver } from 'perf_hooks';

function measure_memory_usage() {
  const before = process.memoryUsage();

  // Build large project
  const project = create_test_project({ files: 1000 });

  // Resolve symbols
  const resolved = resolve_symbols_with_registries(project.indices, project.root_folder);

  const after = process.memoryUsage();

  console.log('Memory Usage:');
  console.log(`  Heap Used: ${(after.heapUsed - before.heapUsed) / 1024 / 1024} MB`);
  console.log(`  External: ${(after.external - before.external) / 1024 / 1024} MB`);
  console.log(`  RSS: ${(after.rss - before.rss) / 1024 / 1024} MB`);

  // Get registry cache stats
  const { definitions, types, scopes } = build_registries_from_indices(project.indices);
  console.log('\nRegistry Cache Stats:');
  console.log(`  Definition cache: ${definitions.get_cache_stats()}`);
  console.log(`  Type cache: ${types.get_cache_stats()}`);
}

measure_memory_usage();
```

**Run**:
```bash
node --expose-gc packages/core/benchmarks/memory_usage.ts
```

---

### Step 4: Compare Against Baseline (Afternoon)

**Establish baseline** (if not already done in task 138.11):

```bash
# Checkout Phase 1 code (after 138.9 but before 139.1)
git checkout task-epic-11.138.9

# Run benchmarks
npm run bench -- symbol_resolution.bench.ts > baseline.txt

# Return to current branch
git checkout feat/epic-11-codebase-restructuring

# Run current benchmarks
npm run bench -- symbol_resolution.bench.ts > current.txt

# Compare
diff baseline.txt current.txt
```

**Expected results**:
- End-to-end: -5% to +5% (acceptable)
- Scope queries: +50% to +500% improvement (first call slower, subsequent much faster)
- Export lookups: -10% to +10% (linear search slightly slower, acceptable)

---

### Step 5: Identify Bottlenecks (If Needed)

**If regression > 5%**, use profiling to find bottlenecks:

```bash
# Node.js built-in profiler
node --prof packages/core/benchmarks/symbol_resolution.bench.ts
node --prof-process isolate-*-v8.log > profile.txt

# Or use clinic.js
npm install -g clinic
clinic doctor -- node packages/core/benchmarks/symbol_resolution.bench.ts
```

**Common bottlenecks to check**:
- Registry cache building taking too long
- Linear search in `get_export_by_name` for large export sets
- Map iteration overhead in `get_scope_definitions`
- Excessive object creation

---

### Step 6: Optimization (If Needed)

**Only optimize if benchmarks show >5% regression!**

#### Optimization 1: Export Name Cache

If `get_export_by_name` is slow:

```typescript
class ExportRegistry {
  private name_cache: Map<FilePath, Map<SymbolName, SymbolId>> = new Map()

  update_file(file_id: FilePath, exported_ids: Set<SymbolId>): void {
    this.exports.set(file_id, exported_ids);
    this.name_cache.delete(file_id);  // Invalidate
  }

  get_export_by_name(
    file_id: FilePath,
    name: SymbolName,
    definitions: DefinitionRegistry
  ): AnyDefinition | undefined {
    // Check cache first
    if (!this.name_cache.has(file_id)) {
      this.build_name_cache(file_id, definitions);
    }

    const symbol_id = this.name_cache.get(file_id)!.get(name);
    return symbol_id ? definitions.get(symbol_id) : undefined;
  }

  private build_name_cache(file_id: FilePath, definitions: DefinitionRegistry): void {
    const cache = new Map<SymbolName, SymbolId>();
    const exported_ids = this.exports.get(file_id) || new Set();

    for (const symbol_id of exported_ids) {
      const def = definitions.get(symbol_id);
      if (def) {
        cache.set(def.name, symbol_id);
      }
    }

    this.name_cache.set(file_id, cache);
  }
}
```

#### Optimization 2: Scope Cache Pre-warming

If first scope query is bottleneck:

```typescript
class DefinitionRegistry {
  warm_scope_cache(file_id: FilePath): void {
    // Build cache proactively
    this.build_scope_cache(file_id);
  }
}

// In Project coordinator
for (const file_id of changed_files) {
  definitions.update_file(file_id, defs);
  definitions.warm_scope_cache(file_id);  // Pre-warm
}
```

#### Optimization 3: Batch Registry Updates

If many `update_file` calls are slow:

```typescript
class DefinitionRegistry {
  batch_update(updates: Map<FilePath, AnyDefinition[]>): void {
    // Update all files without invalidating caches
    for (const [file_id, defs] of updates) {
      this.by_file.set(file_id, defs);
    }

    // Invalidate caches once at the end
    for (const file_id of updates.keys()) {
      this.scope_cache.delete(file_id);
    }
  }
}
```

**Important**: Only add these optimizations if benchmarks show they're needed!

---

### Step 7: Document Results

**File**: `PERFORMANCE_REPORT.md` (new)

```markdown
# Symbol Resolution Performance Report

**Date**: 2025-10-10
**Branch**: feat/epic-11-codebase-restructuring
**Baseline**: task-epic-11.138.9 (Phase 1)

## Summary

Registry-based architecture shows **< 5% regression** in end-to-end performance while
providing significant improvements in specific areas.

## Benchmark Results

### End-to-End Resolution Time

| Project Size | Baseline (ms) | Current (ms) | Change |
|--------------|---------------|--------------|--------|
| Small (10 files) | 45 | 47 | +4.4% |
| Medium (100 files) | 450 | 465 | +3.3% |
| Large (1000 files) | 4500 | 4680 | +4.0% |

**Verdict**: ✅ Within acceptable range (<5% regression)

### Component Performance

| Component | Baseline | Current | Change |
|-----------|----------|---------|--------|
| build_scope_resolver_index | 150ms | 145ms | -3.3% (improved!) |
| build_type_context | 80ms | 82ms | +2.5% |
| resolve_function_calls | 200ms | 205ms | +2.5% |
| resolve_method_calls | 180ms | 185ms | +2.8% |

**Verdict**: ✅ All components within acceptable range

### Registry Operation Performance

| Operation | Time | Notes |
|-----------|------|-------|
| get_scope_definitions (cold) | 5ms | First call per file |
| get_scope_definitions (warm) | 0.1ms | 50x faster! |
| get_export_by_name (10 exports) | 0.05ms | Very fast |
| get_export_by_name (100 exports) | 0.5ms | Acceptable |

**Verdict**: ✅ Caching provides significant speedup

### Memory Usage

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| Heap Used | 120 MB | 135 MB | +12.5% |
| Registry Caches | N/A | 15 MB | New overhead |
| Peak RSS | 250 MB | 268 MB | +7.2% |

**Verdict**: ✅ Memory increase acceptable for caching benefits

## Optimizations Applied

- [ ] None (no optimizations needed)
- [ ] Export name cache added
- [ ] Scope cache pre-warming added
- [ ] Batch registry updates added

## Recommendations

1. **Monitor** cache hit rates in production
2. **Consider** pre-warming caches for large projects
3. **Add** metrics for registry performance
4. **Profile** again after incremental resolution (future work)

## Conclusion

Registry-based architecture provides **acceptable performance** with <5% regression
while enabling future optimizations (incremental resolution, better caching).

Performance is **production-ready**.
```

---

## Acceptance Criteria

- [ ] Benchmark suite created and documented
- [ ] End-to-end benchmarks < 5% regression from baseline
- [ ] Component benchmarks measured and documented
- [ ] Registry operation performance measured
- [ ] Memory usage profiled and documented
- [ ] Bottlenecks identified (if any)
- [ ] Optimizations applied (if needed)
- [ ] Performance report written
- [ ] Results reviewed and approved

## Success Metrics

✅ < 5% regression in end-to-end performance
✅ Scope query caching shows measurable improvement
✅ Memory overhead < 20% increase
✅ No critical bottlenecks identified
✅ Performance report documents baseline for future work

## Dependencies

**Prerequisites**:
- ✅ task-epic-11.139.8 (all tests passing)
- Optional: task-epic-11.138.11 (baseline benchmarks)

**Enables**:
- 139.10 (documentation can reference performance results)
- Future: Incremental resolution optimizations

## Risks & Mitigations

### Risk: Significant Regression Found
**Impact**: May need to rethink registry architecture
**Mitigation**: Optimization step (Step 6) addresses common bottlenecks

### Risk: Benchmark Environment Variability
**Impact**: Results inconsistent between runs
**Mitigation**: Run benchmarks multiple times, report median + variance

### Risk: Memory Leak
**Impact**: Memory grows unbounded
**Mitigation**: Memory profiling (Step 3) will catch this

## Notes

### Why This Matters

Performance benchmarking ensures:
1. No regressions slip through
2. Future changes have baseline to compare against
3. Optimization opportunities are identified and prioritized
4. Production readiness is validated

### When to Optimize

**DO NOT optimize prematurely!**

Only optimize if:
- Benchmarks show >5% regression
- Profiling confirms the bottleneck
- Optimization complexity is justified by improvement

**DO optimize** if:
- >10% regression
- Critical path is affected
- User-facing performance issue

### Future Work

After this sub-task, we have baseline for:
- Incremental resolution performance gains
- Cache strategy effectiveness
- Memory optimization opportunities
