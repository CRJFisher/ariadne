# Sub-Task 11.140.4: Refactor detect_call_graph Signature

**Parent Task**: task-epic-11.140
**Status**: Not Started
**Priority**: High
**Estimated Effort**: 30 minutes

---

## Goal

Change `detect_call_graph` function signature to accept registries instead of ResolvedSymbols. This is the breaking change that enables registry-native implementation.

---

## Changes Required

**File**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

### Current Signature

```typescript
export function detect_call_graph(resolved: ResolvedSymbols): CallGraph
```

### New Signature

```typescript
export function detect_call_graph(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  resolutions: ResolutionCache
): CallGraph
```

**Note**: We DON'T need ScopeRegistry! The semantic_index changes mean we have all the data we need in definitions and references directly.

### Update Imports

```typescript
import type { FilePath, CallGraph, SymbolId } from '@ariadnejs/types';
import type { SemanticIndex } from '../index_single_file/semantic_index';
import type { DefinitionRegistry } from '../project/definition_registry';
import type { ResolutionCache } from '../project/resolution_cache';
```

### Stub Implementation (Temporarily)

```typescript
export function detect_call_graph(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  resolutions: ResolutionCache
): CallGraph {
  // TODO: Implementation in 11.140.5 and 11.140.6
  return {
    nodes: new Map(),
    entry_points: []
  };
}
```

### Comment Out Tests

Add note at top of test file:

```typescript
// Tests temporarily disabled during refactoring
// Will be updated in task 11.140.9
describe.skip('detect_call_graph', () => {
  // ... existing tests
});
```

---

## Acceptance Criteria

- [ ] Signature updated
- [ ] Imports updated
- [ ] Code compiles (stub implementation)
- [ ] Tests commented out with note
- [ ] No other code broken

---

## Dependencies

**Depends on**: None (can be done anytime)
**Blocks**: 11.140.5, 11.140.6 (implementation)
