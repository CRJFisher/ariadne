# Task Epic-11.160: Multi-Candidate Resolution Foundation

**Status**: TODO
**Priority**: P0 (Foundational)
**Estimated Effort**: 4-6 days
**Epic**: epic-11-codebase-restructuring
**Impact**: Enables tasks 11.158, 11.156.3, 11.159 (reduces entry points by ~65%)
**Blocks**: 11.158 (Interface method resolution), 11.156.3 (Collection dispatch), 11.159 (Heuristic fallback)

## Problem

The call resolution system represents each call as resolving to a single `SymbolId`, but multiple scenarios require representing multiple resolution candidates:

1. **Polymorphic dispatch**: Interface method calls resolve to ALL implementations
2. **Dynamic dispatch**: Collection-accessed functions resolve to ALL stored functions
3. **Ambiguous resolution**: Type inference returns multiple scored candidates

Current architecture cannot represent these scenarios, causing concrete implementations to appear as entry points when they're actually called via polymorphic or dynamic dispatch.

## Solution

Every call resolution is inherently multi-candidate. Change `CallReference` to represent resolutions as an array:

```typescript
// Current (single)
CallReference {
  symbol_id?: SymbolId
}

// New (array of candidates)
CallReference {
  resolutions: Array<{
    symbol_id: SymbolId
    confidence: ResolutionConfidence
    reason: ResolutionReason
  }>
}
```

**Key insight**: Single resolution is just `resolutions: [one_element]`. No special cases needed.

## Architecture

### Core Data Model

All resolution information lives in `CallReference.resolutions` array:

- **Empty array** `[]`: Resolution failed
- **Single element** `[{symbol_id, ...}]`: Concrete resolution
- **Multiple elements** `[{...}, {...}, ...]`: Polymorphic/dynamic/ambiguous

No separate storage, no dual tracking, no complexity.

### Resolution Metadata

Each candidate includes structured metadata:

```typescript
{
  symbol_id: SymbolId,
  confidence: "certain" | "probable" | "possible",
  reason: {
    type: "direct" | "interface_implementation" | "collection_member" | "heuristic_match",
    // Type-specific fields
  }
}
```

Metadata is:

- **Typed**: Discriminated union for `reason`
- **Serializable**: JSON-safe structures
- **Analyzable**: Filter/group by reason type

### Entry Point Detection

Works unchanged because all candidates are represented:

```typescript
function detect_entry_points(nodes, calls) {
  const all_called = new Set<SymbolId>();

  for (const call of calls) {
    for (const resolution of call.resolutions) {
      all_called.add(resolution.symbol_id);
    }
  }

  return nodes.filter((n) => !all_called.has(n.symbol_id));
}
```

All candidates marked as called → correct entry point detection.

## Implementation Phases

### Phase 1: Type Definitions (Sub-task 11.160.1)

**Effort**: 0.5 days

Define core types:

- `ResolutionConfidence`: "certain" | "probable" | "possible"
- `ResolutionReason`: Discriminated union for resolution metadata
- Update `CallReference` to include `resolutions` array

**Location**: `packages/types/src/`

### Phase 2: Resolver Function Updates (Sub-task 11.160.2)

**Effort**: 2-3 days

Change resolvers to return arrays:

- `resolve_method_call()`: Returns `SymbolId[]`
- `resolve_constructor_call()`: Returns `SymbolId[]`
- `resolve_self_reference_call()`: Returns `SymbolId[]`
- Update all callers immediately

**Location**: `packages/core/src/resolve_references/call_resolution/`

### Phase 3: Resolution Registry Updates (Sub-task 11.160.3)

**Effort**: 1-2 days

Store resolutions as arrays:

- Build `CallReference` with `resolutions` array
- Create metadata for each resolution
- Update all consumers of `CallReference`

**Location**: `packages/core/src/resolve_references/resolution_registry.ts`

### Phase 4: Call Graph Updates (Sub-task 11.160.4)

**Effort**: 0.5-1 day

Update call graph building:

- Process all resolutions in array
- Create edges for all candidates
- Entry point detection unchanged (already uses all resolutions)

**Location**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

## Sub-Tasks

1. **[task-epic-11.160.1](./task-epic-11.160.1-multi-candidate-types.md)**: Type definitions (0.5 days)
2. **[task-epic-11.160.2](./task-epic-11.160.2-resolver-function-updates.md)**: Resolver function updates (2-3 days)
3. **[task-epic-11.160.3](./task-epic-11.160.3-resolution-registry-updates.md)**: Resolution registry updates (1-2 days)
4. **[task-epic-11.160.4](./task-epic-11.160.4-call-graph-api-updates.md)**: Call graph updates (0.5-1 day)

## Success Criteria

- [ ] `CallReference.resolutions` is array of candidates with metadata
- [ ] All resolvers return `SymbolId[]`
- [ ] Entry point detection works correctly (all candidates marked as called)
- [ ] All existing tests updated and passing
- [ ] Test coverage ≥95% for new code
- [ ] No special-case code for single vs. multiple resolutions

## Design Principles

### 1. Arrays Everywhere

Every resolution is an array. No `SymbolId | null`, no special cases. Empty array means failed resolution.

### 2. Structured Metadata

`ResolutionReason` is a discriminated union, not a string. Fully typed, analyzable, serializable.

### 3. Single Source of Truth

Resolution information lives in one place: `CallReference.resolutions`. No parallel tracking, no synchronization issues.

### 4. Zero Backward Compatibility

Change the code directly. Update all callers. No deprecated functions, no gradual migration.

## API Examples

### Basic Usage

```typescript
const calls = resolutions.get_resolved_calls();

for (const call of calls) {
  if (call.resolutions.length === 0) {
    console.log(`Unresolved: ${call.name}`);
  } else if (call.resolutions.length === 1) {
    console.log(`Single: ${call.name} → ${call.resolutions[0].symbol_id}`);
  } else {
    console.log(`Multi: ${call.name} → ${call.resolutions.length} candidates`);
  }
}
```

### Analysis

```typescript
// Find polymorphic calls
const polymorphic = calls.filter((c) =>
  c.resolutions.some((r) => r.reason.type === "interface_implementation")
);

// Find collection dispatch
const collection_dispatch = calls.filter((c) =>
  c.resolutions.some((r) => r.reason.type === "collection_member")
);

// Filter by confidence
const certain_only = calls.filter((c) =>
  c.resolutions.every((r) => r.confidence === "certain")
);

// Get primary resolution only
const primary_calls = calls.map((c) => ({
  ...c,
  resolutions: c.resolutions.slice(0, 1),
}));
```

### Statistics

```typescript
const total_calls = calls.length;
const multi_candidate = calls.filter((c) => c.resolutions.length > 1).length;
const avg_candidates =
  calls.reduce((sum, c) => sum + c.resolutions.length, 0) / total_calls;

console.log(`Total calls: ${total_calls}`);
console.log(
  `Multi-candidate: ${multi_candidate} (${(
    (multi_candidate / total_calls) *
    100
  ).toFixed(1)}%)`
);
console.log(`Avg candidates per call: ${avg_candidates.toFixed(2)}`);
```

## Enables Future Tasks

This foundation enables:

1. **Task 11.158** (Interface method resolution)

   - Resolvers return all implementations as array
   - Metadata: `reason: { type: "interface_implementation", interface_id }`

2. **Task 11.156.3** (Collection dispatch)

   - Resolvers return all stored functions as array
   - Metadata: `reason: { type: "collection_member", collection_id, access_pattern }`

3. **Task 11.159** (Heuristic fallback)
   - Resolvers return scored candidates as array
   - Metadata: `reason: { type: "heuristic_match", score }`, `confidence: "probable" | "possible"`

## Performance Expectations

- **Memory**: +10-20% for typical codebase (array overhead)
- **Speed**: No significant change (same number of edges created)
- **Call graph size**: +20-30% edges for polymorphic codebases

## Out of Scope

- Language-specific implementations (Tasks 11.158, 11.156.3, 11.159)
- Interface-implementation index building (Task 11.158)
- Collection detection algorithms (Task 11.156.3)
- Heuristic scoring algorithms (Task 11.159)
- Confidence threshold tuning
- Performance optimizations

## Dependencies

**Requires**:

- Current resolution system (tasks 11.109, 11.105)
- Type registry (task 11.105)
- Definition registry with member index

**Blocks**:

- Task 11.158: Interface method resolution
- Task 11.156.3: Collection dispatch detection
- Task 11.159: Heuristic type inference fallback

## Estimated Impact

Based on analysis from dependent tasks:

- **Task 11.158**: ~9 entry points → concrete implementations (6.7% of bugs)
- **Task 11.156.3**: ~12 entry points → called handlers (9% of bugs)
- **Task 11.159**: Variable additional reductions

**Total expected reduction**: ~65% of remaining entry point misidentifications

## Testing Strategy

Each sub-task includes comprehensive tests:

1. **Type definitions**: TypeScript compilation, type checking
2. **Resolver functions**: Unit tests for arrays of 0, 1, N elements
3. **Registry updates**: Integration tests for resolution storage
4. **Call graph**: End-to-end tests with real code samples

**Overall coverage target**: ≥95% for all new code
