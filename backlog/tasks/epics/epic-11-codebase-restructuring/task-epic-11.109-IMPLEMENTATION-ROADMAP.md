# Task 11.109: Scope-Aware Resolution Implementation Roadmap

**Epic:** 11 - Codebase Restructuring
**Status:** Not Started
**Total Estimated Effort:** 4-5 weeks

## Overview

This roadmap outlines the complete transformation of the `resolve_references` system to use scope-aware resolution. The new architecture uses lexical scope walking as the foundation for all symbol resolution, ensuring correctness and simplicity.

## Task Breakdown

### Foundation Phase (Week 1-2)

#### 11.109.1: Core ScopeResolver (3-4 days) ⭐ **CRITICAL**
**Purpose:** Universal scope-walking algorithm used by all resolution phases

**Deliverables:**
- `core/scope_resolver.ts` with `resolve_in_scope()` function
- Comprehensive test suite (100% coverage)
- Handles shadowing correctly

**Key Algorithm:**
```typescript
resolve_name(name, scope_id) {
  while (scope_id) {
    if (local_definition_exists(name, scope_id)) return it
    if (module_scope) check imports
    scope_id = parent_scope
  }
  return null
}
```

---

#### 11.109.2: Import Resolution (4-5 days) ⭐ **CRITICAL**
**Purpose:** Cross-file import/export connections

**Deliverables:**
- `import_resolution/import_resolver.ts`
- Per-file map: `local_name -> source_symbol_id`
- All 4 languages supported (JS/TS/Python/Rust)
- Test coverage for all import types

**Integration:** Feeds ImportMap to ScopeResolver

---

### Type System Phase (Week 2)

#### 11.109.3: Type Context (5-6 days) 🔗 **Integrates with 11.105**
**Purpose:** Type tracking and member lookup for method resolution

**Deliverables:**
- `type_resolution/type_context.ts`
- Type tracking from:
  - Annotations: `const x: Type`
  - Constructors: `const x = new Type()`
  - Return types: `function f(): Type`
- Member lookup with inheritance (future)
- Integration with task 11.105 preprocessed types

**Key Features:**
- `get_symbol_type(symbol_id) -> type_id`
- `get_type_member(type_id, member_name) -> member_id`

---

### Call Resolution Phase (Week 3)

#### 11.109.4: Function Call Resolution (2-3 days)
**Purpose:** Resolve function calls using scope walking

**Deliverables:**
- `call_resolution/function_resolver.ts`
- Trivial implementation (delegates to ScopeResolver)
- Test coverage for shadowing and cross-file

**Note:** This is the simplest resolver - demonstrates the power of scope-aware architecture.

---

#### 11.109.5: Method Call Resolution (4-5 days)
**Purpose:** Resolve method calls using scope + types

**Deliverables:**
- `call_resolution/method_resolver.ts`
- Three-step resolution:
  1. Resolve receiver (scope-aware)
  2. Get receiver type (from TypeContext)
  3. Lookup method on type
- Test coverage for type tracking sources

---

#### 11.109.6: Constructor Call Resolution (3-4 days)
**Purpose:** Resolve constructor calls using scope + validation

**Deliverables:**
- `call_resolution/constructor_resolver.ts`
- Class name resolution (scope-aware)
- Constructor vs class symbol handling
- Test coverage for explicit/implicit constructors

---

### Integration Phase (Week 4)

#### 11.109.7: Main Orchestration (3-4 days) ⭐ **CRITICAL**
**Purpose:** Integrate all components into unified pipeline

**Deliverables:**
- Updated `symbol_resolution.ts`
- Five-phase pipeline:
  1. Import resolution
  2. Scope resolver creation
  3. Type context building
  4. Call resolution (3 types)
  5. Result combination
- Integration tests
- Performance benchmarks

**Pipeline:**
```
SemanticIndex
  ↓ Phase 1
ImportMap
  ↓ Phase 2
ScopeResolver
  ↓ Phase 3
TypeContext
  ↓ Phase 4
FunctionCallMap + MethodCallMap + ConstructorCallMap
  ↓ Phase 5
ResolvedSymbols
```

---

### Validation Phase (Week 4-5)

#### 11.109.8: Comprehensive Testing (4-5 days) ⭐ **CRITICAL**
**Purpose:** Validate entire system with comprehensive test coverage

**Deliverables:**
- Unit tests (500+ tests, 95%+ coverage)
- Integration tests (50+ tests)
- End-to-end tests (20+ tests)
- Performance benchmarks
- Edge case testing
- Regression testing

**Coverage Targets:**
- ScopeResolver: 100%
- ImportResolver: 95%
- TypeContext: 90%
- Call Resolvers: 95%
- Overall: 95%+

---

#### 11.109.9: Cleanup & Documentation (2-3 days)
**Purpose:** Production readiness - remove old code, finalize docs

**Deliverables:**
- Remove all old implementation code
- Update all READMEs (5+ files)
- Create architecture diagram
- Update CHANGELOG
- Create migration guide
- Code quality validation

---

## Dependencies Graph

```
11.109.1 (ScopeResolver)
    ↓
    ├─→ 11.109.2 (ImportResolver) ──→ 11.109.1 (feeds ImportMap)
    ↓
    ├─→ 11.109.3 (TypeContext) ← [depends on 11.105]
    ↓
    ├─→ 11.109.4 (FunctionResolver)
    ├─→ 11.109.5 (MethodResolver)
    └─→ 11.109.6 (ConstructorResolver)
         ↓
    11.109.7 (Orchestration)
         ↓
    11.109.8 (Testing)
         ↓
    11.109.9 (Cleanup)
```

## Critical Path

The critical path (longest dependency chain):
1. **11.109.1** (ScopeResolver) - 4 days
2. **11.109.2** (ImportResolver) - 5 days
3. **11.109.3** (TypeContext) - 6 days
4. **11.109.5** (MethodResolver) - 5 days
5. **11.109.7** (Orchestration) - 4 days
6. **11.109.8** (Testing) - 5 days

**Total Critical Path: 29 days (~6 weeks)**

## Parallelization Opportunities

### Week 1
- Start: 11.109.1 (ScopeResolver)

### Week 2
- Start: 11.109.2 (ImportResolver) - requires 11.109.1
- Start: 11.109.3 (TypeContext) - requires 11.109.1

### Week 3
- Start: 11.109.4, 11.109.5, 11.109.6 (all call resolvers in parallel)
- All require 11.109.1 and 11.109.3

### Week 4
- Start: 11.109.7 (Orchestration) - requires all call resolvers
- Start: 11.109.8 (Testing) - can start integration tests early

### Week 5
- Continue: 11.109.8 (Testing)
- Start: 11.109.9 (Cleanup) - can overlap with testing

## Key Architectural Decisions

### 1. Scope-First Resolution
**Decision:** Every name lookup walks the scope chain
**Rationale:** Matches language semantics, handles shadowing correctly

### 2. Unified ScopeResolver
**Decision:** Single algorithm for all name lookups
**Rationale:** DRY, testability, consistency

### 3. Separate Type Context
**Decision:** Type tracking is isolated from scope resolution
**Rationale:** Separation of concerns, integrates with 11.105

### 4. Explicit Constructor Resolution
**Decision:** Constructors resolved separately from methods
**Rationale:** Different semantics, clearer code

## Integration with Task 11.105

Task 11.105 preprocesses type information in `SemanticIndex`:

### Enhanced SemanticIndex
```typescript
interface SemanticIndex {
  // NEW from 11.105:
  readonly type_annotations?: ReadonlyMap<LocationKey, SymbolName>;
  readonly inferred_types?: ReadonlyMap<LocationKey, SymbolName>;
  readonly type_inheritance?: ReadonlyMap<SymbolId, readonly SymbolId[]>;
}
```

### Integration Point: TypeContext
Task 11.109.3 will consume this preprocessed data:
```typescript
// Easy integration with 11.105 output
for (const [loc_key, type_name] of index.type_annotations) {
  const type_symbol = scope_resolver.resolve_in_scope(type_name, scope_id);
  // Store type mapping...
}
```

**Key Benefit:** Scope-aware architecture is **orthogonal** to type preprocessing. Task 11.105's work slots in cleanly.

## Success Metrics

### Correctness
- ✅ Local definitions shadow imports (currently broken)
- ✅ Nested scope shadowing works correctly
- ✅ Cross-file resolution accurate
- ✅ All existing tests pass

### Code Quality
- ✅ 95%+ test coverage
- ✅ No `any` types (documented exceptions only)
- ✅ Clear separation of concerns
- ✅ Comprehensive documentation

### Performance
- ✅ Small projects: < 10ms
- ✅ Medium projects: < 100ms
- ✅ Large projects: < 1s
- ✅ No memory leaks

## Risk Mitigation

### Risk: Task 11.105 Not Complete
**Mitigation:** TypeContext designed to work with/without preprocessed types
**Plan B:** Use annotation extraction only, enhance later

### Risk: Performance Regression
**Mitigation:** Benchmarks at each phase, optimize early
**Plan B:** Memoization, caching strategies

### Risk: Test Coverage Gaps
**Mitigation:** Write tests during implementation, not after
**Plan B:** Dedicated test week (11.109.8)

### Risk: Breaking External Users
**Mitigation:** Maintain backwards compatibility where possible
**Plan B:** Clear migration guide, version bump

## Communication Plan

### Stakeholders
- **Core team:** Daily updates on progress
- **External users:** Announce breaking changes early
- **Documentation:** Update as we go

### Milestones to Announce
1. **Foundation complete** (11.109.1-2) - Core algorithm working
2. **Call resolution working** (11.109.4-6) - End-to-end flow
3. **Integration complete** (11.109.7) - Ready for testing
4. **Production ready** (11.109.9) - Release candidate

## Post-Implementation

### Future Enhancements
- **Inheritance walking** in TypeContext
- **Method chaining** in method resolver
- **Type inference** beyond annotations
- **Cross-language calls** (e.g., JS → WASM)

### Maintenance Plan
- Monitor performance on real projects
- Collect edge cases from users
- Iterate on type tracking
- Enhance documentation based on feedback

## Conclusion

This roadmap provides a clear path to transforming symbol resolution into a scope-aware, correct, and maintainable system. The phased approach allows for incremental progress, testing, and validation at each step.

**Estimated Total Time:** 4-5 weeks
**Estimated Total Effort:** 29-35 developer days

---

## Quick Reference

| Task | Component | Duration | Priority | Dependencies |
|------|-----------|----------|----------|--------------|
| 11.109.1 | ScopeResolver | 3-4 days | Critical | None |
| 11.109.2 | ImportResolver | 4-5 days | Critical | 11.109.1 |
| 11.109.3 | TypeContext | 5-6 days | High | 11.109.1, 11.105 |
| 11.109.4 | FunctionResolver | 2-3 days | High | 11.109.1 |
| 11.109.5 | MethodResolver | 4-5 days | High | 11.109.1, 11.109.3 |
| 11.109.6 | ConstructorResolver | 3-4 days | High | 11.109.1, 11.109.3 |
| 11.109.7 | Orchestration | 3-4 days | Critical | 11.109.1-6 |
| 11.109.8 | Testing | 4-5 days | Critical | 11.109.7 |
| 11.109.9 | Cleanup | 2-3 days | Medium | 11.109.8 |

**Next Task:** Start with 11.109.1 (Core ScopeResolver)
