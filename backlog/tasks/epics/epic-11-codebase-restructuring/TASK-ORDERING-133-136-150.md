# Task Ordering Analysis: 11.133, 11.136, and 11.150

**Date**: 2025-10-23
**Question**: What order should tasks 11.133, 11.150, and 11.136 be done?

## Quick Answer

**Recommended Order:**

```
1. task-epic-11.133 (Receiver Metadata) - Python & Rust ONLY
2. task-epic-11.150 (Property Type Extraction) - All 4 languages  
3. task-epic-11.136 (Method Call Resolution) - Uses data from 133 + 150
```

**Why This Order:**
- 133 provides metadata that 136 needs (receiver_location)
- 150 provides type data that 136 needs (property types)
- 136 uses both 133 and 150 to implement resolution
- 133 can be done incrementally (Python/Rust only initially)

---

## Detailed Analysis

### Task Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│  task-epic-11.133: Receiver Metadata Extraction             │
│  Extracts receiver_location for Python & Rust              │
│                                                             │
│  Python: obj.method() → receiver_location points to "obj"  │
│  Rust:   val.method() → receiver_location points to "val"  │
│                                                             │
│  Status: TypeScript/JavaScript already have this ✅         │
│          Python/Rust missing ❌                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Provides receiver metadata
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  task-epic-11.150: Property Type Extraction                 │
│  Extracts property type annotations                         │
│                                                             │
│  class Foo { field: Type } → stores "Type"                 │
│                                                             │
│  Status: All 4 languages need this ❌                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Both feed into
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  task-epic-11.136: Method Call Type Tracking Resolution    │
│  Uses receiver_location + property types for resolution    │
│                                                             │
│  1. Get receiver_location from call (needs 133)            │
│  2. Look up receiver type (needs 150)                      │
│  3. Resolve method on that type                            │
│                                                             │
│  Status: Needs both 133 and 150 ❌                          │
└─────────────────────────────────────────────────────────────┘
```

### Current State

**What Works Today:**
- ✅ TypeScript/JavaScript have `receiver_location` extraction
- ✅ Simple variable type bindings work
- ✅ Method resolution infrastructure exists

**What's Missing:**
- ❌ Python/Rust missing `receiver_location` (task 133)
- ❌ No property type extraction (task 150)
- ❌ Property chain resolution doesn't work (needs 136 + 150)

### Why This Order Makes Sense

#### Option 1: Do 133 → 150 → 136 (RECOMMENDED)

**Advantages:**
- ✅ Incremental progress visible
- ✅ Can test receiver_location independently (133)
- ✅ Can test property types independently (150)
- ✅ 136 has all data it needs when started
- ✅ Can ship TypeScript/JavaScript support earlier

**Steps:**
1. **task-epic-11.133** (1 day for Python + Rust)
   - Add receiver_location to Python method calls
   - Add receiver_location to Rust method calls
   - Tests pass immediately
   - **Deliverable**: Metadata parity across all 4 languages

2. **task-epic-11.150** (3.5 days for all languages)
   - Extract property types in TypeScript
   - Extract property types in JavaScript
   - Extract property types in Python
   - Extract property types in Rust
   - **Deliverable**: Property type data available

3. **task-epic-11.136** (2-3 days)
   - Implement type-based method resolution
   - Use receiver_location from 133 ✅
   - Use property types from 150 ✅
   - **Deliverable**: Property chain resolution works!

**Total: 6.5-7.5 days with clear milestones**

#### Option 2: Do 150 → 133 → 136

**Disadvantages:**
- ⚠️ Python/Rust behind TypeScript/JavaScript longer
- ⚠️ Can't test property resolution until 136
- ⚠️ Harder to validate 150 without 136

**Not Recommended**

#### Option 3: Do 133 + 150 in parallel → 136

**Advantages:**
- ✅ Fastest overall timeline
- ✅ Both data sources ready for 136

**Disadvantages:**
- ⚠️ Requires coordinating two tasks
- ⚠️ Can't validate either fully until 136
- ⚠️ More risk of integration issues

**Viable but more complex**

---

## Recommended Implementation Plan

### Phase 1: Metadata Parity (task-epic-11.133)
**Duration**: 1 day
**Goal**: All 4 languages have receiver_location

```python
# Python - BEFORE
obj.method()  # receiver_location: undefined

# Python - AFTER  
obj.method()  # receiver_location: points to "obj" ✅
```

```rust
// Rust - BEFORE
value.method()  // receiver_location: undefined

// Rust - AFTER
value.method()  // receiver_location: points to "value" ✅
```

**Validation**: Run existing tests, verify receiver_location populated

**Why First:**
- Small, focused task
- TypeScript/JavaScript already work, just need Python/Rust
- Independent of other tasks
- Unblocks 136 for Python/Rust

### Phase 2: Property Type Extraction (task-epic-11.150)
**Duration**: 3.5 days
**Goal**: All property type annotations extracted

**Sub-tasks in order:**
1. **task-epic-11.150.1** - TypeScript (1 day)
   - Most complete type system
   - Good reference for other languages
   
2. **task-epic-11.150.2** - JavaScript (0.5 day)
   - JSDoc extraction
   - Simpler than TypeScript

3. **task-epic-11.150.3** - Python (0.75 day)
   - Type hints extraction
   - Dataclass support

4. **task-epic-11.150.4** - Rust (0.75 day)
   - Struct field types
   - Generic + lifetime handling

5. **task-epic-11.150.5** - Integration (0.5 day)
   - Verify type flow to TypeRegistry
   - Cross-language validation

**Validation**: Property types stored in TypeRegistry

**Why Second:**
- Builds on 133's foundation
- Provides data 136 needs
- Can partially validate with debug scripts
- Larger task split into manageable pieces

### Phase 3: Method Resolution (task-epic-11.136)
**Duration**: 2-3 days
**Goal**: Property chain resolution works end-to-end

**Implementation:**
1. Enhance TypeContext integration
2. Fix local method resolution
3. Language-specific handling (Python decorators, Rust associated functions)
4. Integration testing
5. **VERIFY ENTRY POINT REDUCTION: 135 → 10-20**

**Validation**: Self-analysis shows dramatic improvement

**Why Last:**
- Needs data from both 133 and 150
- Biggest integration challenge
- Most visible user impact
- Final deliverable

---

## Alternative: Phased Language Rollout

If you want faster incremental delivery:

### Phase A: TypeScript Complete Chain
1. Do task-epic-11.150.1 (TypeScript property types) - 1 day
2. Do task-epic-11.136 (but only fix TypeScript tests) - 1 day
3. **Ship TypeScript property chain resolution** ✅

### Phase B: Add JavaScript
4. Do task-epic-11.150.2 (JavaScript property types) - 0.5 day
5. Update task-epic-11.136 for JavaScript - 0.5 day
6. **Ship JavaScript support** ✅

### Phase C: Add Python
7. Do task-epic-11.133 (Python receiver_location only) - 0.5 day
8. Do task-epic-11.150.3 (Python property types) - 0.75 day
9. Update task-epic-11.136 for Python - 0.75 day
10. **Ship Python support** ✅

### Phase D: Add Rust
11. Do task-epic-11.133 (Rust receiver_location only) - 0.5 day
12. Do task-epic-11.150.4 (Rust property types) - 0.75 day
13. Update task-epic-11.136 for Rust - 0.75 day
14. **Ship Rust support** ✅

**Advantage**: Ship value faster, get feedback earlier
**Disadvantage**: More releases, fragmented work

---

## Success Metrics

### After task-epic-11.133
- ✅ All 4 languages have receiver_location in method calls
- ✅ Tests verify receiver_location populated
- ✅ No regressions

### After task-epic-11.150
- ✅ All 4 languages extract property types
- ✅ TypeRegistry contains property type bindings
- ✅ Debug scripts show types available
- ✅ ~100+ property type bindings created

### After task-epic-11.136
- ✅ Property chain resolution works
- ✅ Entry points reduced from 135 → 10-20
- ✅ All integration tests pass
- ✅ No performance regression
- ✅ **RELEASABLE QUALITY** 🎉

---

## Risks and Mitigations

### Risk 1: Integration Issues Between Tasks
**Mitigation**: 
- Do 133 first (small, independent)
- Validate 150 with debug scripts before 136
- 136 has clear acceptance criteria

### Risk 2: 150 Takes Longer Than Expected
**Mitigation**:
- 150 split into 5 sub-tasks
- Can parallelize language implementations
- TypeScript reference implementation first

### Risk 3: 136 Reveals New Requirements
**Mitigation**:
- 133 and 150 provide all known data needs
- Comprehensive test coverage in 150
- Can iterate on 136 independently

---

## Recommendation

**Do tasks in order: 133 → 150 → 136**

This provides:
- ✅ Clear milestones
- ✅ Incremental validation
- ✅ Risk reduction
- ✅ Ability to ship intermediate value
- ✅ Clean dependency chain

**Total Timeline: 6.5-7.5 days**

If you need faster delivery for a specific language (e.g., TypeScript only), do the phased rollout instead.
