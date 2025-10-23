# Task 155.8: Multiple Candidate Resolution

**Parent**: task-155
**Dependencies**: task-155.2 (stub resolver), task-154 (heuristic fallback)
**Status**: TODO
**Priority**: Medium
**Estimated Effort**: 0.5 day

## Goal

When type resolution is ambiguous, return multiple candidate resolutions instead of failing or picking arbitrarily. Let the caller decide how to handle multiple candidates.

## Problem

Both stub inference and heuristic fallback can produce multiple possible resolutions:

**Stub case**:
```typescript
// Multiple stubs could match
obj.process(data);  // Could be Processor.process() or DataProcessor.process()
```

**Heuristic case**:
```typescript
// Method name exists on multiple classes
const handler = get_handler();  // Unknown type
handler.execute();  // execute() exists on TaskExecutor, CommandExecutor, JobExecutor
```

**Current behavior**: Either fail to resolve or pick one arbitrarily.

**Desired behavior**: Return all candidates with confidence scores, let caller decide.

## Use Cases

### 1. Call Graph Exploration

Generate call graph with all possible edges:

```typescript
// Show all possible call paths
graph.add_edge(call_site, [TaskExecutor.execute, CommandExecutor.execute], {
  confidence: "candidate"
});
```

User can:
- Filter by confidence level
- Show all possible paths
- Investigate ambiguous cases

### 2. Interactive Resolution

In an IDE or tool:

```typescript
// Show user all candidates
const candidates = resolve_method(call);
if (candidates.length > 1) {
  show_picker("Multiple possible methods", candidates);
  // Let user select correct one
}
```

### 3. Statistical Analysis

For codebase analysis:

```typescript
// Count how many calls are ambiguous
const stats = {
  definite: 0,
  probable: 0,
  candidate: 0,
  unresolved: 0
};

for (const call of calls) {
  const resolution = resolve_method(call);
  stats[resolution.confidence]++;
}
```

## Design

### Resolution Result Type

Extend existing `SymbolResolution` type:

```typescript
export type ResolutionConfidence = "definite" | "probable" | "candidate" | "unresolved";

export interface SymbolResolution {
  // Single resolution (definite or probable)
  resolved_symbol?: SymbolId;

  // Multiple candidates (candidate confidence)
  candidates?: Array<{
    symbol: SymbolId;
    score: number;
    reason: string;  // Why this candidate?
  }>;

  // Confidence level
  confidence: ResolutionConfidence;

  // Why this resolution? (for debugging)
  resolution_method?: "explicit" | "stub" | "heuristic" | "unresolved";
}
```

### Resolution Pipeline

```typescript
export function resolve_method_call_with_candidates(
  call: SymbolReference,
  context: TypeContext,
  stub_registry: StubRegistry,
  method_index: MethodIndex
): SymbolResolution {
  // Layer 1: Explicit type annotation
  const explicit = try_explicit_resolution(call, context);
  if (explicit) {
    return {
      resolved_symbol: explicit,
      confidence: "definite",
      resolution_method: "explicit"
    };
  }

  // Layer 2: Type stub inference
  const stub = try_stub_inference(call, context, stub_registry);
  if (stub) {
    return {
      resolved_symbol: stub,
      confidence: "definite",
      resolution_method: "stub"
    };
  }

  // Layer 3: Heuristic fallback
  const heuristic = try_heuristic_resolution(call, context, method_index);
  if (heuristic.candidates.length === 0) {
    return {
      confidence: "unresolved",
      resolution_method: "unresolved"
    };
  }

  // Single high-confidence match
  if (heuristic.candidates.length === 1 ||
      heuristic.candidates[0].score > heuristic.candidates[1].score * 2) {
    return {
      resolved_symbol: heuristic.candidates[0].symbol,
      confidence: "probable",
      resolution_method: "heuristic"
    };
  }

  // Multiple candidates
  return {
    candidates: heuristic.candidates,
    confidence: "candidate",
    resolution_method: "heuristic"
  };
}
```

### Heuristic Resolution (Enhanced)

```typescript
interface HeuristicResult {
  candidates: Array<{
    symbol: SymbolId;
    score: number;
    reason: string;
  }>;
}

function try_heuristic_resolution(
  call: SymbolReference,
  context: TypeContext,
  method_index: MethodIndex
): HeuristicResult {
  // 1. Find all methods with this name
  const all_methods = method_index.get_methods(call.name);
  if (!all_methods || all_methods.size === 0) {
    return { candidates: [] };
  }

  // 2. Score each candidate
  const scored = Array.from(all_methods).map(method_id => {
    const score = calculate_proximity_score(call, method_id, context);
    const reason = explain_score(call, method_id, score);
    return { symbol: method_id, score, reason };
  });

  // 3. Sort by score
  scored.sort((a, b) => b.score - a.score);

  // 4. Return top N candidates
  const MAX_CANDIDATES = 5;
  return {
    candidates: scored.slice(0, MAX_CANDIDATES)
  };
}

function explain_score(
  call: SymbolReference,
  method_id: SymbolId,
  score: number
): string {
  const reasons: string[] = [];

  if (same_file(call, method_id)) {
    reasons.push("same file (+100)");
  }
  if (same_package(call, method_id)) {
    reasons.push("same package (+50)");
  }
  if (recently_imported(call, method_id)) {
    reasons.push("imported (+25)");
  }

  return reasons.join(", ") || "distant match";
}
```

## Call Graph Integration

### Edge Types

Call graph edges now have confidence levels:

```typescript
export interface CallGraphEdge {
  from: SymbolId;  // Caller
  to: SymbolId | SymbolId[];  // Single callee or multiple candidates
  confidence: ResolutionConfidence;
  location: Location;  // Where the call happens
}

export class CallGraph {
  private edges: CallGraphEdge[] = [];

  add_call(call: SymbolReference, resolution: SymbolResolution) {
    if (resolution.resolved_symbol) {
      // Single resolution
      this.edges.push({
        from: call.scope_id,
        to: resolution.resolved_symbol,
        confidence: resolution.confidence,
        location: call.location
      });
    } else if (resolution.candidates) {
      // Multiple candidates
      this.edges.push({
        from: call.scope_id,
        to: resolution.candidates.map(c => c.symbol),
        confidence: resolution.confidence,
        location: call.location
      });
    }
    // else: unresolved, no edge
  }

  // Filter edges by confidence
  get_edges(min_confidence: ResolutionConfidence): CallGraphEdge[] {
    const confidence_order = {
      definite: 3,
      probable: 2,
      candidate: 1,
      unresolved: 0
    };

    return this.edges.filter(edge =>
      confidence_order[edge.confidence] >= confidence_order[min_confidence]
    );
  }
}
```

## Implementation Tasks

### 1. Extend SymbolResolution Type (0.5 hour)

**Location**: `packages/types/src/symbol_resolution.ts`

Add fields:
- `candidates?: Array<{ symbol, score, reason }>`
- `resolution_method?: string`

### 2. Update Resolution Pipeline (2 hours)

**Location**: `packages/core/src/resolve_references/method_resolution/resolve_method_calls.ts`

Modify to return multiple candidates when appropriate.

### 3. Enhance Heuristic Scoring (2 hours)

**Location**: `packages/core/src/resolve_references/heuristic_resolution/proximity_scorer.ts`

Add:
- Score explanation
- Top-N candidate selection
- Tie-breaking logic

### 4. Update Call Graph (1 hour)

**Location**: `packages/core/src/trace_call_graph/call_graph.ts`

Support:
- Multiple target edges
- Confidence filtering
- Statistics reporting

### 5. Testing (2 hours)

Test cases:
- Single definite resolution
- Single probable resolution
- Multiple candidates
- Unresolved case
- Confidence filtering

## Files to Create

1. `packages/core/src/resolve_references/method_resolution/multiple_resolution.test.ts`

## Files to Modify

1. `packages/types/src/symbol_resolution.ts` - Extend types
2. `packages/core/src/resolve_references/method_resolution/resolve_method_calls.ts` - Return candidates
3. `packages/core/src/resolve_references/heuristic_resolution/proximity_scorer.ts` - Score explanation
4. `packages/core/src/trace_call_graph/call_graph.ts` - Support multiple targets

## Acceptance Criteria

- [ ] SymbolResolution type supports multiple candidates
- [ ] Resolution pipeline returns candidates when ambiguous
- [ ] Each candidate has score and explanation
- [ ] Call graph supports candidate edges
- [ ] Confidence filtering works
- [ ] Tests pass for all confidence levels
- [ ] Documentation explains how to use candidates

## Usage Examples

### Example 1: Show All Candidates

```typescript
const resolution = resolve_method_call(call, context, stub_registry, method_index);

if (resolution.confidence === "candidate") {
  console.log(`Ambiguous call to ${call.name}:`);
  for (const candidate of resolution.candidates!) {
    console.log(`  - ${candidate.symbol} (score: ${candidate.score})`);
    console.log(`    Reason: ${candidate.reason}`);
  }
}
```

### Example 2: Filter Call Graph

```typescript
// Get only definite edges
const definite_edges = call_graph.get_edges("definite");

// Get definite + probable
const likely_edges = call_graph.get_edges("probable");

// Get all edges including candidates
const all_edges = call_graph.get_edges("candidate");
```

### Example 3: Statistics

```typescript
const stats = {
  definite: 0,
  probable: 0,
  candidate: 0,
  unresolved: 0
};

for (const call of all_calls) {
  const resolution = resolve_method_call(call, ...);
  stats[resolution.confidence]++;
}

console.log(`Resolution quality:`);
console.log(`  Definite: ${stats.definite} (${pct(stats.definite)}%)`);
console.log(`  Probable: ${stats.probable} (${pct(stats.probable)}%)`);
console.log(`  Candidate: ${stats.candidate} (${pct(stats.candidate)}%)`);
console.log(`  Unresolved: ${stats.unresolved} (${pct(stats.unresolved)}%)`);
```

## Success Criteria

When analyzing the codebase:
- Can see all possible method resolutions
- Can filter by confidence level
- Can understand why each candidate was suggested
- Call graph shows realistic coverage (including ambiguous cases)

## Notes

- This is the final layer of the resolution pipeline
- Candidates are ordered by score (best first)
- Limit to top N to avoid overwhelming output
- Explanations help debug why resolution failed or was ambiguous
- Consider UI/visualization for candidates in future
