# Task 154: Type Resolution & Heuristic Fallback System

**Status**: Backlog
**Priority**: Medium (Required for Call Graph Accuracy)
**Estimated Effort**: 3-4 weeks
**Created**: 2025-10-09
**Related Epic**: epic-11 (infrastructure was built there)
**Dependencies**: task-epic-11.123 (Rust metadata extraction)

## Problem Statement

**Primary Goal**: Achieve high-accuracy call graph detection through robust method resolution.

**Current limitation**: Method resolution fails in two fundamental ways:

### Failure Mode 1: Missing Type Flow (Analytical Gap)

Type information exists but isn't tracked through assignments:

```typescript
// Function with return type annotation
function createService(): Service {
  return new Service();
}

// ❌ Doesn't work (no explicit variable annotation)
const service = createService();  // Type info exists but not tracked!
service.getData();  // Cannot resolve - type not linked to variable

// ✅ Works today (redundant annotation required)
const service: Service = createService();  // Must duplicate type!
service.getData();  // Resolves to Service.getData()
```

**The issue**: We have the type information (function return type) but don't track it to the variable.

### Failure Mode 2: Complex/Unknown Types (Unresolvable Cases)

Even with full type tracking, some patterns are analytically unresolvable:

```typescript
// Dynamic type from external data
const handler = plugin_loader.load_plugin(config.plugin_name);
handler.execute();  // Type depends on runtime config - unknowable statically

// Complex inference beyond our scope
const result = complex_conditional_flow();
result.process();  // Would require sophisticated flow analysis

// Generic constraints with complex bounds
function generic_factory<T extends SomeComplexType>(...)
const obj = generic_factory(...);
obj.method();  // Type depends on generic instantiation
```

**The issue**: No amount of analytical type tracking will resolve these cases perfectly. We need heuristic fallback strategies.

### Who This Affects

**All languages, especially:**
- **TypeScript**: Factory patterns, builder patterns, API clients (highest priority)
- **Rust**: Builder patterns (`ServiceBuilder::new().build()`), iterator chains
- **Python**: Factory functions, decorators, context managers

**Common patterns that fail:**
```typescript
// Factory pattern
const user = UserFactory.create();  // ❌ Type not tracked
user.getName();

// Builder pattern
const config = new ConfigBuilder().setHost("...").build();  // ❌
config.getHost();

// API client
const response = await api.get("/users");  // ❌
response.data.map(...);
```

```rust
// Rust builder pattern
let service = ServiceBuilder::new().with_timeout(30).build();  // ❌
service.get_data();
```

### Current Workaround

Users must add **redundant** type annotations everywhere:
```typescript
const service: Service = createService();  // Type already in function signature!
```

This is:
- **Verbose**: Duplicates information
- **Error-prone**: Can get out of sync with actual return type
- **Anti-pattern**: Modern languages have inference to avoid this

## Solution: Two-Pronged Resolution Strategy

### Strategy 1: Analytical Type Tracking (Primary)

Track types through **simple, common patterns**:

#### Pattern 1: Constructor Assignments
```javascript
const user = new User();  // Track: user → User type
user.getName();  // Resolve: User.getName()
```

**Status**: ✅ Already implemented via `construct_target` field

#### Pattern 2: Function Return Types
```javascript
function createService(): Service { ... }

const service = createService();  // Track: service → Service (from return type)
service.getData();  // Resolve: Service.getData()
```

**Status**: ❌ Not implemented - this is the core analytical work

**Expected coverage**: Moves from 65% → 85% resolution accuracy

### Strategy 2: Heuristic Fallback (Secondary)

When analytical resolution fails (no type information available), use heuristics:

#### Heuristic 1: Method Name Matching
```typescript
// Unknown type - analytical resolution fails
const obj = get_dynamic_object();
obj.execute();  // What is execute()?

// Heuristic: Find all classes with execute() method
// Candidates: TaskExecutor, CommandExecutor, JobExecutor
// Strategy: Return all candidates OR pick closest match
```

#### Heuristic 2: Proximity Scoring
When multiple candidates exist, rank by:
- **Same file** (highest priority: +100 points)
- **Same package/module** (+50 points)
- **Recently imported** (+25 points)
- **Lexical scope distance** (+10 points per scope level)

#### Heuristic 3: Call Pattern Matching
```typescript
// Pattern: service.method()
// Find classes used as services in this codebase
// Rank candidates by usage frequency
```

**Expected benefit**: Recovers 5-10% of otherwise-unresolvable cases

### Combined Strategy: Layered Resolution

```
1. Try explicit type annotation (current, 65% success)
2. Try return type tracking (new analytical, +20% = 85%)
3. Try heuristic fallback (new fallback, +5-10% = 90-95%)
4. Report unresolved (remaining 5-10%)
```

**Key insight**: For call graph detection, having candidate resolutions is better than no resolution. We can mark edges as "probable" vs "definite".

## Scope: What's Included

### Part A: Analytical Type Tracking (Core)

1. **Return Type Extraction**
   - Extract return type from function/method definitions
   - Store in `FunctionDefinition.return_type` (already exists!)
   - Support all languages (TypeScript, Python, Rust)

2. **Return Type Tracking**
   - When call resolves to a function, get its return type
   - Populate `return_type` field on call SymbolReference
   - Link to variable via assignment

3. **Type Flow via Assignments**
   - When variable is assigned from call: `const x = foo()`
   - Track x's type as return type of foo()
   - Use `assignment_type` field on assignment reference

4. **Integration with Type Context**
   - Extend `extract_type_bindings()` to include assignment types
   - Fallback: use assignment_type when VariableDefinition.type is missing

### Part B: Heuristic Fallback System (New)

5. **Method Name Index**
   - Build codebase-wide index: method_name → [class_ids]
   - Query during resolution: find all classes with method X
   - Return candidate resolutions when analytical fails

6. **Proximity Scoring**
   - Same file: +100 points
   - Same package: +50 points
   - Recently imported: +25 points
   - Rank candidates by score

7. **Resolution Confidence**
   - Analytical resolution: confidence = "definite"
   - Single heuristic match: confidence = "probable"
   - Multiple heuristic matches: confidence = "candidate"
   - Track in resolution result

8. **Call Graph Edge Types**
   - Extend call graph to support:
     - Definite edges (analytical resolution)
     - Probable edges (single heuristic match)
     - Candidate edges (multiple heuristic matches)
   - Allow filtering by confidence level

### NOT In Scope (Future Work)

- ❌ Reassignments (type changes)
- ❌ Conditional branches (if/else different types)
- ❌ Loop analysis
- ❌ Generic type instantiation
- ❌ Union/intersection types
- ❌ Type narrowing
- ❌ Complex inference (chained calls beyond 1 level)
- ❌ Machine learning-based type prediction

**Philosophy**: Start with deterministic patterns and simple heuristics. Complex flow analysis and ML approaches are future work.

**Why This Matters for Call Graphs**: Without these strategies, we miss method calls on factory-created or dynamically-typed objects. This creates incomplete call graphs, which defeats the primary purpose of the tool.

## Architecture

### Current State (Layer 1: Explicit Types Only)

```
VariableDefinition.type (explicit annotation)
  ↓
extract_type_bindings()
  ↓
type_bindings: Map<LocationKey, SymbolName>
  ↓
build_type_context()
  ↓
symbol_types: Map<SymbolId, SymbolId>
  ↓
resolve_method_calls()
  → Success: 65% of cases
  → Failure: 35% unresolved
```

### Target State (Multi-Layer Resolution)

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 1: Analytical Type Tracking                            │
│                                                               │
│  VariableDefinition.type (explicit annotation)               │
│    OR                                                         │
│  SymbolReference.assignment_type (from return type)          │
│    ↓                                                          │
│  extract_type_bindings() [enhanced]                          │
│    ↓                                                          │
│  type_bindings: Map<LocationKey, SymbolName>                 │
│    ↓                                                          │
│  build_type_context()                                        │
│    ↓                                                          │
│  symbol_types: Map<SymbolId, SymbolId>                       │
│    ↓                                                          │
│  resolve_method_calls()                                      │
│    → Success: 85% of cases (confidence: definite)            │
│    → Failure: 15% → fallback to Layer 2                      │
└──────────────────────────────────────────────────────────────┘
                       ↓ (if failed)
┌──────────────────────────────────────────────────────────────┐
│ Layer 2: Heuristic Fallback                                  │
│                                                               │
│  method_name_index: Map<string, Set<ClassId>>                │
│    ↓                                                          │
│  find_all_methods(method_name)                               │
│    → candidates: ClassId[]                                   │
│    ↓                                                          │
│  rank_by_proximity(candidates, call_location)                │
│    → scored_candidates: [ClassId, score][]                  │
│    ↓                                                          │
│  if (single high-score match)                                │
│    → Return probable resolution (confidence: probable)       │
│  else                                                         │
│    → Return all candidates (confidence: candidate)           │
│    → Success: +5-10% of cases                                │
│    → Failure: 5-10% truly unresolvable                       │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

#### Part A: Analytical Components

1. **Return Type Resolution** (NEW)
   - When resolving a call, get the target function definition
   - Extract return_type from that definition
   - Populate return_type on the call reference

2. **Assignment Type Wiring** (NEW)
   - In extract_type_bindings(), check assignment references
   - If assignment.assignment_type exists, add to type_bindings
   - Fallback for variables without explicit type

3. **Extractor Completion** (PARTIALLY DONE)
   - ✅ Rust: assignment_type extraction (task 11.123)
   - ⚠️ TypeScript/JavaScript: needs identifier walking
   - ⚠️ Python: needs identifier walking

#### Part B: Heuristic Components

4. **Method Name Index Builder** (NEW)
   - Scan all class/interface definitions at index time
   - Build map: method_name → Set<ClassId>
   - Update incrementally as code changes
   - Location: New file `packages/core/src/resolve_references/heuristic_resolution/method_index.ts`

5. **Proximity Scorer** (NEW)
   - Calculate distance between call site and candidate classes
   - Weight by: same file > same package > imports > lexical scope
   - Return ranked list of candidates
   - Location: New file `packages/core/src/resolve_references/heuristic_resolution/proximity_scorer.ts`

6. **Confidence Tracker** (NEW)
   - Tag each resolution with confidence level: "definite" | "probable" | "candidate"
   - Propagate through call graph edges
   - Enable filtering/visualization by confidence
   - Extend existing SymbolResolution type with confidence field

7. **Fallback Resolution Pipeline** (NEW)
   - Try analytical first (existing code)
   - On failure, invoke heuristic matching (new code)
   - Return best candidate(s) with confidence score
   - Location: Enhance `packages/core/src/resolve_references/symbol_resolution.ts`

## Implementation Plan

### Phase 1: Return Type Tracking (1 week)

**1.1 Return Type Extraction During Parsing** (2 days)

Already captured in FunctionDefinition, verify for all languages:
- TypeScript: ✅ Function return types exist
- JavaScript: ✅ JSDoc @returns
- Python: ✅ Type hints
- Rust: ✅ Return type syntax

**1.2 Populate return_type on Call References** (3 days)

Location: `packages/core/src/resolve_references/call_resolution/`

Add to `resolve_function_calls()`:
```typescript
function resolve_function_calls(...) {
  for (const call_ref of calls) {
    // Existing: resolve to function definition
    const func_def = resolve_call(call_ref, ...);

    // NEW: If resolved and has return type, populate
    if (func_def && func_def.return_type) {
      // Store in resolution result or extend call_ref
      // Need to create enhanced resolution type
    }
  }
}
```

**1.3 Test Return Type Tracking** (2 days)

Add tests showing:
- Function with return type gets tracked
- Call to function has return_type populated
- Works across all languages

### Phase 2: Assignment Type Wiring (1 week)

**2.1 Complete Assignment Type Extractors** (3 days)

For TypeScript/JavaScript/Python, add identifier walking:
```typescript
// In javascript_metadata.ts
if (node.type === "identifier" && node.parent?.type === "variable_declarator") {
  return this.extract_type_from_annotation(node.parent, file_path);
}
```

See Rust implementation in task 11.123 as template.

**2.2 Enhance extract_type_bindings()** (2 days)

Location: `packages/core/src/index_single_file/type_preprocessing/type_bindings.ts`

```typescript
export function extract_type_bindings(definitions, references) {
  const bindings = new Map();

  // Existing: from variable definitions
  for (const variable of definitions.variables.values()) {
    if (variable.type) {
      bindings.set(location_key(variable.location), variable.type);
    }
  }

  // NEW: from assignment references
  for (const ref of references) {
    if (ref.type === "assignment" && ref.assignment_type) {
      const key = location_key(ref.location);
      // Only add if not already bound (explicit types take precedence)
      if (!bindings.has(key)) {
        bindings.set(key, ref.assignment_type.type_name);
      }
    }
  }

  return bindings;
}
```

**2.3 Link Return Types to Assignments** (2 days)

When we see:
```javascript
const service = createService();
```

Need to:
1. Resolve `createService()` call → get return_type
2. Find assignment reference for `service`
3. Populate assignment_type with return_type
4. This happens during resolution, not during parsing!

May need new pass or extend existing resolution.

### Phase 3: Heuristic Fallback System (1-1.5 weeks)

**3.1 Build Method Name Index** (2 days)

Location: New file `packages/core/src/resolve_references/heuristic_resolution/method_index.ts`

```typescript
export interface MethodIndex {
  methods: Map<string, Set<SymbolId>>;  // method_name → class_ids
}

export function build_method_index(definitions: Definitions): MethodIndex {
  const methods = new Map<string, Set<SymbolId>>();

  // Scan all class definitions
  for (const class_def of definitions.classes.values()) {
    for (const method of class_def.members) {
      if (method.kind === "method") {
        if (!methods.has(method.name)) {
          methods.set(method.name, new Set());
        }
        methods.get(method.name)!.add(class_def.symbol_id);
      }
    }
  }

  return { methods };
}
```

**3.2 Implement Proximity Scorer** (2 days)

Location: New file `packages/core/src/resolve_references/heuristic_resolution/proximity_scorer.ts`

```typescript
export function rank_candidates(
  candidates: SymbolId[],
  call_location: SourceLocation,
  definitions: Definitions
): Array<{ candidate: SymbolId; score: number }> {
  return candidates.map(candidate => {
    const def = definitions.classes.get(candidate);
    if (!def) return { candidate, score: 0 };

    let score = 0;

    // Same file: +100
    if (def.location.file_path === call_location.file_path) {
      score += 100;
    }

    // Same package: +50
    if (same_package(def.location.file_path, call_location.file_path)) {
      score += 50;
    }

    // TODO: Import tracking (+25)
    // TODO: Lexical scope distance (+10 per level)

    return { candidate, score };
  }).sort((a, b) => b.score - a.score);
}
```

**3.3 Integrate Fallback Pipeline** (2-3 days)

Location: Enhance `packages/core/src/resolve_references/symbol_resolution.ts`

```typescript
export function resolve_method_call_with_fallback(
  call: SymbolReference,
  context: TypeContext,
  method_index: MethodIndex,
  definitions: Definitions
): SymbolResolution | null {
  // Layer 1: Try analytical resolution
  const analytical = resolve_method_call(call, context);
  if (analytical) {
    return { ...analytical, confidence: "definite" };
  }

  // Layer 2: Try heuristic fallback
  const method_name = call.name;
  const candidates = method_index.methods.get(method_name);
  if (!candidates || candidates.size === 0) {
    return null;  // No candidates found
  }

  // Rank by proximity
  const ranked = rank_candidates([...candidates], call.location, definitions);

  // If single high-score match, return as probable
  if (ranked.length === 1 || (ranked[0].score > ranked[1].score * 2)) {
    return {
      resolved_symbol: ranked[0].candidate,
      confidence: "probable"
    };
  }

  // Multiple candidates: return all with "candidate" confidence
  return {
    resolved_symbols: ranked.slice(0, 5).map(r => r.candidate),  // Top 5
    confidence: "candidate"
  };
}
```

### Phase 4: Integration & Testing (4-5 days)

**4.1 Extend Resolution Types** (1 day)

Location: `packages/types/src/symbol_resolution.ts`

```typescript
export type ResolutionConfidence = "definite" | "probable" | "candidate";

export interface SymbolResolution {
  // Single resolution (definite or probable)
  resolved_symbol?: SymbolId;

  // Multiple candidates (candidate confidence)
  resolved_symbols?: SymbolId[];

  // Confidence level
  confidence: ResolutionConfidence;
}
```

**4.2 End-to-End Integration** (2 days)

Test full flow:
```javascript
// 1. Function with return type
function createUser(): User { ... }

// 2. Assignment from call
const user = createUser();

// 3. Method call resolution
user.getName();  // Should resolve to User.getName() (definite)

// 4. Heuristic fallback
const obj = get_unknown();
obj.execute();  // Should find candidates (probable/candidate)
```

**4.3 Test Coverage** (2 days)

- All languages (TypeScript, JavaScript, Python, Rust)
- Factory patterns (analytical)
- Builder patterns (analytical)
- Unknown types (heuristic)
- Edge cases (no candidates, multiple candidates, etc.)

**4.4 Documentation** (1 day)

- Update type_bindings.ts docs
- Add architecture doc for layered resolution
- Update SymbolReference field docs (link to this task)
- Add usage examples

## Success Criteria

### Must Have

1. ✅ TypeScript factory pattern resolves: `const x = factory()` → `x.method()` (definite)
2. ✅ Rust builder pattern resolves: `let x = Builder::new().build()` → `x.method()` (definite)
3. ✅ Return types tracked for TypeScript, Rust, Python
4. ✅ Assignment types wired into type_bindings
5. ✅ Method name index built and queryable
6. ✅ Heuristic fallback returns candidates with confidence scores
7. ✅ All existing tests still pass

### Nice to Have

1. ⭐ Python type hints respected
2. ⭐ Performance benchmarks (no regression >10%)
3. ⭐ Works with namespace imports
4. ⭐ Candidate ranking includes import relationships
5. ⭐ Visualization distinguishes definite vs probable vs candidate edges

## Risks & Mitigations

### Risk: Performance Impact

**Concern**: Extra pass through references + method index building

**Mitigation**:
- Profile before/after
- Build method index incrementally (only on changed files)
- Cache proximity scores
- Only invoke heuristic fallback when analytical fails

### Risk: False Positives from Heuristics

**Concern**: Heuristic matching might suggest wrong methods

**Mitigation**:
- Clearly mark with confidence levels
- Don't treat candidates as definite
- Allow user filtering by confidence
- Provide "why this match" explanations

### Risk: Ambiguous Cases

**Concern**: What if return type is wrong or missing?

**Mitigation**:
- Fallback to no resolution (same as today)
- Log warnings for debugging
- Don't crash on missing types

### Risk: Complex Type Flow

**Concern**: Users expect full inference (unions, generics, etc.)

**Mitigation**:
- Document scope clearly
- Add "future enhancements" section
- Set expectations in error messages

### Risk: Method Index Size

**Concern**: Large codebases might have huge method name maps

**Mitigation**:
- Use Sets for efficient storage
- Measure memory usage on large projects
- Consider chunking or lazy loading if needed

## Dependencies

### Infrastructure Already Built ✅

- `SymbolReference.assignment_type` field (Epic 11.106)
- `SymbolReference.return_type` field (Epic 11.106)
- `FunctionDefinition.return_type` field (exists)
- `extract_call_receiver()` metadata extraction (task 11.123)
- Rust assignment type extraction (task 11.123)

### New Dependencies

- None! All type definitions exist.

## Follow-Up Work (Future)

After this task, could add:

### Advanced Analytical Tracking
1. **Chained Calls**: `factory().getUser().getName()`
2. **Reassignments**: Track type changes through code
3. **Conditional Types**: Different types in if/else branches
4. **Generic Instantiation**: `Array<string>` from `Array<T>`
5. **Union Types**: `string | number`
6. **Type Narrowing**: Type guards, instanceof checks

### Advanced Heuristic Strategies
7. **Import Relationship Scoring**: Weight by imports
8. **Usage Frequency**: Prefer commonly-used classes
9. **Naming Conventions**: Match by class/method naming patterns
10. **Historical Analysis**: Learn from resolved examples
11. **Machine Learning**: Train on codebase patterns

Each is a separate task.

## Related Work

- **task-epic-11.123**: Rust Method Resolution Metadata (✅ Completed - infrastructure)
- **task-epic-11.106**: SymbolReference Interface Refinements (✅ Completed - type definitions)
- **Epic 11.130**: File Index Implementation (✅ Completed - symbol lookup)
- **Current**: docs/current-type-tracking-analysis.md (analysis of coverage)
- Future: Advanced type inference
- Future: Cross-file type tracking
- Future: Machine learning-based type prediction

## Why This Matters

### Current Pain Point

**For typed languages**: Users must add redundant type annotations everywhere, defeating the purpose of type inference.

**For all languages**: 35% of method calls fail to resolve, creating incomplete call graphs.

### Target Users

**Primary:**
- TypeScript developers using factory patterns (very common in Angular, React, NestJS)
- Rust developers using builder patterns (std library, tokio, diesel)

**Secondary:**
- Python developers with type hints
- JavaScript developers (harder, lower priority)

### Impact

- **Improves**: Call graph accuracy from 65% to 90-95%
- **Reduces**: Need for redundant type annotations
- **Enables**: Better IDE support (go-to-definition, hover)
- **Unlocks**: More accurate call graph analysis for entry point detection

**Bottom line**: Without this, the tool cannot achieve its primary goal of accurate call graph detection.

## Open Questions

1. **Candidate Limit**: How many candidates should we return? (Current: 5)
   - Too many = overwhelming
   - Too few = miss correct answer

2. **Confidence Thresholds**: When is a score "high enough" for probable vs candidate?
   - Need empirical testing
   - May vary by codebase

3. **Performance**: Is method index build time acceptable?
   - Need benchmarks on large codebases
   - Consider incremental updates

4. **Alternative**: Could we use language servers instead?
   - TypeScript: Use tsserver for type info
   - Rust: Use rust-analyzer
   - Tradeoff: External dependency vs. self-contained analysis
   - Decision: Start self-contained, consider LSP integration later

5. **Edge Case**: Method name collisions in different domains
   - Example: `execute()` in both TaskExecutor and SQLExecutor
   - Proximity scoring should help, but may need domain hints

## Current State Analysis

See [docs/current-type-tracking-analysis.md](../../docs/current-type-tracking-analysis.md) for detailed analysis of:
- Current type tracking capabilities (65% coverage)
- Expected improvement from this task (85% coverage)
- Full type flow analysis (95% coverage)
- Recommendation: This task is the right next step

## Decision: Implement

**Recommendation**: Implement both analytical and heuristic components.

**Rationale**:
- Analytical (Part A) gets us to 85% - big improvement
- Heuristic (Part B) gets us to 90-95% - completes the picture
- Together they provide robust, graceful degradation
- Total effort (3-4 weeks) is reasonable for the value

**Effort**: 3-4 weeks
**Value**: High (required for primary goal: call graph detection)
**Risk**: Low (infrastructure exists, changes are additive)

**Key insight**: This isn't about "replicating tsc/rust-analyzer" - it's about **layered resolution with graceful degradation**, which is essential for accurate call graphs across all languages and patterns.
