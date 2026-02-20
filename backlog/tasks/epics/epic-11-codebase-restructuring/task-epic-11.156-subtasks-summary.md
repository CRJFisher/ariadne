# Task Epic-11.156: Sub-Tasks Summary

**Parent Task**: task-epic-11.156 (Anonymous Callback Function Capture)
**Status**: Phases 1-3 Complete, Phases 4-5 Split into Sub-Tasks
**Overall Impact**: 350 → ~120 entry points (65% reduction)

## Completed Work (Phases 1-3)

✅ **Phase 1**: Tree-sitter query patterns for anonymous functions
✅ **Phase 2**: DefinitionBuilder support for anonymous functions
✅ **Phase 3**: Language config handlers for TypeScript, JavaScript, Python, Rust
✅ **Phase 4A**: Call graph node building includes anonymous functions

**Result**: 228 anonymous functions successfully captured, but appearing as entry points

## Remaining Work: Three Sub-Tasks

### task-epic-11.156.1: Debug Anonymous Function Scope Attribution
**Priority**: P0 (Critical - Blocks other tasks)
**Effort**: 1-2 days
**Impact**: Fixes ~30 methods incorrectly appearing as entry points

**Problem**: Calls INSIDE anonymous functions not attributed to them as callers

**Solution**: Debug scope tree linkage
- Verify anonymous functions have `body_scope_id` set
- Ensure scope tree links call scopes to anonymous function scopes
- Fix scope matching for name-less functions

**Expected Outcome**:
- Methods like `build_class`, `add_enum` show anonymous functions as callers
- Entry points: 350 → 320 (122 → 92 non-anonymous)

---

### task-epic-11.156.2: Callback Invocation Detection and Attribution
**Priority**: P0 (High Impact)
**Effort**: 2-3 days
**Depends On**: task-epic-11.156.1
**Impact**: Removes ~200 anonymous functions from entry points

**Problem**: Anonymous functions passed as callbacks appear as entry points

**User Requirement**: "detect that these functions are being passed in to 3rd party functions"

**Solution**: Syntactic callback detection + external function classification
- Detect when anonymous function is in call expression arguments
- Classify receiving function as internal (our code) or external (built-in/library)
- Create call edges from external functions to callbacks
- Mark callbacks to external functions as invoked

**Architecture**: Create `CallReference` edges with `is_callback_invocation: true`
- Consistent with existing call graph model
- Enables analysis ("forEach invokes 50 callbacks")
- Works with entry point detection automatically

**Expected Outcome**:
- Entry points: 320 → ~130 (~30 anonymous + ~100 non-anonymous)
- Reduction: 200 callbacks to external functions removed

**Examples**:
```typescript
items.forEach((item) => { ... });      // External → Create edge
my_foreach((item) => { ... });         // Internal → Keep as entry point (correct)
```

---

### task-epic-11.156.3: Config Map Multi-Candidate Resolution
**Priority**: P1 (Medium Impact)
**Effort**: 3-4 days
**Depends On**: task-epic-11.156.1, task-epic-11.156.2, task-epic-11.158
**Impact**: Removes ~20-30 config handlers from entry points

**Problem**: Functions in Maps/Arrays/Objects invoked dynamically

**User Requirement**: "trace the object containing the function definitions and determine that it is at least invoked somewhere. This call site would then mark all the config functions as 'possible' calls"

**Solution**: Multi-candidate resolution (same architecture as interface methods)
- Track collections containing functions
- Detect collection access + invocation pattern
- Create call edges to ALL stored functions
- Mark as `confidence: 'possible'` (vs `certain` for interfaces)

**Architecture**: Unified with task-epic-11.158 (Interface Method Resolution)
- Shared `ResolutionCandidate` type
- Shared multi-candidate edge creation
- Unified `multi_candidate_calls` tracking in CallGraph
- Consistent confidence scoring

**Expected Outcome**:
- Entry points: ~130 → ~120 (~5 anonymous + ~115 non-anonymous)
- Reduction: 20-30 config handlers removed

**Examples**:
```typescript
const CONFIG = new Map([
  ['class', (c) => add_class(c)],    // All stored functions are candidates
  ['function', (f) => add_function(f)]
]);

const handler = CONFIG.get(type);
handler(capture);  // ← Multi-candidate call to all in CONFIG
```

**Confidence Levels**:
- Interface calls: `certain` (ALL implementations valid)
- Collection dispatch: `possible` (only ONE will execute)

---

## Task Dependencies

```
task-epic-11.156 (Anonymous Callback Capture - Phases 1-3)
  └─ task-epic-11.156.1 (Scope Attribution) ← START HERE
       ├─ task-epic-11.156.2 (Callback Invocation)
       └─ task-epic-11.156.3 (Config Map Resolution)
            └─ Depends on: task-epic-11.158 (Interface Method Resolution)
```

**Recommended Order**:
1. **Start**: task-epic-11.156.1 (critical, blocks others)
2. **Then**: task-epic-11.156.2 (high impact, independent)
3. **Finally**: task-epic-11.156.3 (depends on 11.158 architecture)

**Parallel Option**:
- Can work on task-epic-11.158 (Interface Method Resolution) in parallel with 11.156.1 and 11.156.2
- task-epic-11.156.3 requires 11.158 to define `ResolutionCandidate` architecture

---

## Overall Impact Summary

### Entry Point Reduction

| Phase | Entry Points | Anonymous | Non-Anonymous | Reduction |
|-------|-------------|-----------|---------------|-----------|
| **Baseline** | 350 | 228 | 122 | - |
| After 11.156.1 | 320 | 228 | 92 | 30 fixed |
| After 11.156.2 | ~130 | ~30 | ~100 | 200 callbacks |
| After 11.156.3 | ~120 | ~5 | ~115 | 20-30 handlers |
| **Final** | **~120** | **~5** | **~115** | **~230 (65%)** |

### What's Fixed

**task-epic-11.156.1**: Methods called only from anonymous functions
- `build_class`, `add_enum`, `build_constructor`, etc.
- ~30 methods

**task-epic-11.156.2**: Callbacks passed to external functions
- `forEach`, `map`, `filter`, `Promise.then`, etc.
- ~200 anonymous functions

**task-epic-11.156.3**: Config map handlers
- Handler functions in dispatch Maps
- ~20-30 anonymous functions

### What Remains as Entry Points (Correct Behavior)

**Legitimate entry points** (~115):
- Top-level module code
- Exported functions
- Event handlers
- Test functions
- CLI commands

**Anonymous functions (correct)** (~5):
- IIFEs not in callbacks
- Closures assigned to exported variables
- Module initialization functions

---

## Architecture Principles

### 1. Unified Multi-Candidate Resolution

Both polymorphic calls and dynamic dispatch use the same architecture:

```typescript
interface ResolutionCandidate {
  symbol_id: SymbolId;
  confidence: 'certain' | 'likely' | 'possible';
  reason: string;
}
```

**Use cases**:
- Interface method calls → ALL implementations (certain)
- Collection dispatch → ALL stored functions (possible)
- Future: Duck typing, conditional dispatch, etc.

### 2. Syntactic Detection > Data Flow Analysis

**Chosen approach**: Pattern-based detection using AST structure
- Simple, fast, reliable
- Covers 80% of real-world cases
- Easy to extend with new patterns

**Avoided**: Full data flow analysis
- Complex (SSA, aliasing, inter-procedural)
- Expensive (performance cost)
- Diminishing returns (most patterns are local)

### 3. Create Edges, Not Just Metadata

**Chosen approach**: Create actual `CallReference` edges
- Consistent with call graph architecture
- Enables rich analysis
- Works with existing entry point detection

**Avoided**: Metadata-only (`is_callback: true` without edges)
- Loses information about invocation
- Can't analyze call patterns
- Requires special handling everywhere

### 4. External vs. Internal Classification

**For callbacks**: Only mark external function callbacks as invoked
- **External**: Built-ins, libraries → WILL invoke callback
- **Internal**: User code → MIGHT invoke callback (analyze separately)

**Rationale**: Conservative approach
- Safe assumption for external functions
- Avoid false negatives (marking non-invoked as invoked)
- Can add internal analysis later

---

## Testing Strategy

Each sub-task includes comprehensive tests:

### Unit Tests
- Pattern detection (callback context, collection structure)
- Classification (external vs internal, collection types)
- Resolution (multi-candidate, confidence levels)

### Integration Tests
- Full call graph with anonymous functions
- Entry point detection accuracy
- Multi-candidate edge creation

### Regression Tests
- Ensure existing call resolution still works
- No false positives (legitimate entry points)
- Performance benchmarks (<10% overhead)

### Test Coverage Target
- ≥95% for new code
- ≥90% for data flow analysis (inherently complex)

---

## Future Enhancements

After completing these three sub-tasks, potential follow-ups:

1. **Internal callback analysis**: Determine if user-defined HOFs invoke callbacks
2. **Confidence scoring**: Rank candidates by likelihood (frequency, type narrowing)
3. **Cross-scope data flow**: Track variables passed across function boundaries
4. **Computed dispatch keys**: `CONFIG.get(computeKey())` analysis
5. **Mutable collections**: Track handlers added after initialization
6. **Conditional dispatch**: `if (condition) fn1() else fn2()` patterns

These would further improve accuracy but have diminishing returns.

---

## Success Metrics

**Quantitative**:
- [ ] Entry point count: 350 → ~120 (65% reduction)
- [ ] False positives: <5% (legitimate entry points incorrectly filtered)
- [ ] False negatives: <10% (entry points missed due to complex patterns)
- [ ] Performance overhead: <10% increase in call graph detection time

**Qualitative**:
- [ ] Call graph accurately represents callback invocations
- [ ] Multi-candidate calls tracked with clear metadata
- [ ] Architecture consistent across all resolution types
- [ ] Code maintainable and extensible

**User Feedback**:
> "We should join up these bits of work [interface methods and config handlers], maybe starting with the prior task of modelling and naming this new type of call resolution."

✅ Achieved through unified `ResolutionCandidate` architecture
