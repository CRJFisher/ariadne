# Task Execution Order

## Recommended Order for Property Chain Resolution

### Summary

To achieve working property chain resolution and reduce false entry points from 135 → ~10-20:

```
1. task-epic-11.133 (1 day)      - Receiver metadata for Python/Rust ✅ COMPLETED
2. task-epic-11.150 (3.5 days)   - Property type extraction (all languages) [IN PROGRESS]
   2.5. task-epic-11.151 (2-3 days) - Properties/methods first-class (recommended cleanup)
3. task-152 (1-2 days)           - Split SymbolReference types (optional)
4. task-epic-11.136 (2-3 days)   - Method call resolution (uses 133 + 150 + 151)
```

**Minimum Path: 6.5-8.5 days** (skip task-152 and task-11.151)
**Recommended Path: 8.5-11.5 days** (include task-11.151 for clean architecture)
**Full Path: 10.5-13.5 days** (include both optional tasks)

**Status Update (2025-10-23):**

- ✅ task-11.133 completed (commit 00373de)
- ✅ task-11.150.1 completed (TypeScript property types working)
- ⚠️ task-11.151 created (technical debt from 11.150 - hacky code needs cleanup)
- 🎉 **Property chain resolution already working!** Entry points reduced from 135 → 120

---

## Task Details

### 1. task-epic-11.133: Receiver Metadata Extraction ✅ COMPLETED (commit 00373de)

**Goal**: Add `receiver_location` to Python and Rust method calls

**Why First:**

- Small, focused task (5-6 files)
- TypeScript/JavaScript already have this - just need parity
- Quick win - tests pass immediately
- Unblocks task-136 for all languages

**Status:**

-  TypeScript: receiver_location working
-  JavaScript: receiver_location working
- L Python: needs receiver_location
- L Rust: needs receiver_location

**Deliverable:** All 4 languages have receiver_location populated

---

### 2. task-epic-11.150: Property Type Extraction (3.5 days)

**Goal**: Extract type annotations from class/struct properties

**Sub-tasks (do in order):**

- 11.150.1: TypeScript (1 day) - reference implementation
- 11.150.2: JavaScript (0.5 day) - JSDoc types
- 11.150.3: Python (0.75 day) - type hints
- 11.150.4: Rust (0.75 day) - struct field types
- 11.150.5: Integration (0.5 day) - validation

**Why Second:**

- Provides type data that 136 needs
- Can validate with debug scripts before 136
- Larger scope but well-divided

**Example:** `class Project { definitions: DefinitionRegistry }` � extracts "DefinitionRegistry"

**Deliverable:** ~100+ property type bindings in TypeRegistry

---

### 2.5. task-epic-11.151: Make Properties/Methods First-Class Definitions (2-3 days) [RECOMMENDED]

**Goal**: Refactor properties and methods to be first-class definitions in DefinitionRegistry

**Why Here:**

- Technical debt from task 11.150 implementation
- Current code has hacky O(n) string-parsing for property/method lookups
- Should clean up before moving to task 136
- Not blocking but highly recommended for maintainability

**Problem:**

When implementing property type binding resolution (task 11.150), we discovered that properties and methods have SymbolIds but aren't stored as first-class definitions. This requires [40+ lines of hacky string-parsing code](packages/core/src/resolve_references/registries/definition_registry.ts#L161-L208) to look up property scopes.

**Solution:**

1. Add `defining_scope_id` field to PropertyDefinition and MethodDefinition types
2. Register properties/methods in DefinitionRegistry's `by_symbol` map
3. Set `defining_scope_id` when building properties/methods in language builders
4. Remove hacky string-parsing code

**Benefits:**

- O(1) lookups instead of O(n) string parsing
- Cleaner architecture - all symbols work the same way
- Better performance
- Removes 40+ lines of unmaintainable code
- Foundation for future features

**Impact:**

- ✅ Property chain resolution still works
- ✅ Entry point count stays at 120
- ✅ All tests pass
- ✅ Code is maintainable

**Files to Modify:**

- `packages/types/src/semantic_index.ts` (add defining_scope_id fields)
- All language builders (TypeScript, JavaScript, Python, Rust)
- `definition_registry.ts` (register properties/methods, simplify get_symbol_scope)

**Deliverable:** Clean O(1) architecture for all symbol lookups

**Recommendation:** Do this task before 11.136 to ensure clean foundation for method resolution work.

---

### 3. task-152: Split SymbolReference Types (1-2 days) [OPTIONAL]

**Goal**: Refactor SymbolReference into discriminated union

**Why Here:**

- Benefits task-136's pattern matching most
- By now we've seen all language patterns (better type design)
- Not blocking - can skip if time constrained

**Current:**

```typescript
interface SymbolReference {
  context?: { receiver_location?: Location }; // Optional
}
```

**After:**

```typescript
interface MethodCallReference {
  context: { receiver_location: Location }; // Required!
}
```

**Why Not Before 133:**

- TypeScript/JavaScript already work without it (proves it's not necessary)
- Adds 1-2 day delay before feature work starts
- Can do later with more context

**Deliverable:** Better type safety for method resolution

---

### 4. task-epic-11.136: Method Call Type Tracking Resolution (2-3 days)

**Goal**: Implement property chain resolution using data from 133 + 150

**Dependencies:**

-  Needs receiver_location from task-133
-  Needs property types from task-150
-  Benefits from type split from task-152 (optional)

**Implementation:**

1. Enhance TypeContext to use property types
2. Fix local method resolution
3. Language-specific handling (Python decorators, Rust associated functions)
4. Integration testing

**Deliverable:**

- Property chain resolution works: `this.definitions.update_file()` resolves correctly
- Entry points reduced from 135 � 10-20
- **RELEASABLE QUALITY** <�

---

## Alternative: Phased Language Rollout

If you want faster incremental delivery, do per-language:

### Phase A: TypeScript Only (2 days)

1. task-11.150.1 (TypeScript property types)
2. task-11.136 (TypeScript tests only)
   � **Ship TypeScript property chain resolution**

### Phase B: Add other languages incrementally

- JavaScript � Python � Rust
- Ship each as ready

**Advantage:** Features ship in 2 days instead of 6.5
**Disadvantage:** More releases, context switching

---

## Why NOT task-152 First?

**Question:** Should we do task-152 (type split) before task-133?

**Answer:** No. Your intuition is correct - "11.133 is just populating an existing field."

**Proof:** TypeScript and JavaScript already successfully populate `receiver_location` WITHOUT the type split.

**Timeline Impact:**

- **152 first**: 7.5-9.5 days, features delayed 1-2 days
- **133 first**: 6.5-7.5 days, features start immediately

**Better to:**

- Get 133 done quickly (1 day)
- Get 150 done (3.5 days)
- THEN do 152 before 136 (benefits pattern matching, better informed design)

The type split improves code quality but doesn't unblock features. Do it when you have full context.

---

## Success Metrics

### After task-133

-  All 4 languages have receiver_location
-  No regressions

### After task-150

-  All 4 languages extract property types
-  ~100+ property type bindings in TypeRegistry

### After task-152 (optional)

-  Better type safety
-  Cleaner pattern matching code

### After task-136

-  Property chain resolution works
-  Entry points: 135 � 10-20 (87% reduction!)
-  All integration tests pass
-  **RELEASABLE** <�

---

## See Also

- `backlog/tasks/epics/epic-11-codebase-restructuring/TASK-ORDERING-133-136-150.md` - Detailed analysis
- `backlog/tasks/task-152 - Split-SymbolReference-into-specific-reference-types.md` - Type split details
