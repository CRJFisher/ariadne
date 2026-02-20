# Sub-Task 11.140.7: Update Project Integration

**Parent Task**: task-epic-11.140
**Status**: Not Started
**Priority**: High
**Estimated Effort**: 30 minutes

---

## Goal

Update the Project coordinator to call the new `detect_call_graph` signature with registries instead of pre-computed data structures.

---

## Implementation

**File**: `packages/core/src/project/project.ts`

### Before (Old Signature)
```typescript
// Had to pre-compute resolved structures
const resolved = resolve_references(
  this.semantic_indexes,
  this.definitions,
  this.imports
);

const call_graph = detect_call_graph(
  this.semantic_indexes,
  resolved
);
```

### After (New Signature)
```typescript
// Pass registries directly
const call_graph = detect_call_graph(
  this.semantic_indexes,
  this.definitions,
  this.resolutions  // ResolutionCache from resolve_references
);
```

---

## Key Changes

1. **Remove intermediate `resolved` variable** if it's only used for call graph
2. **Pass ResolutionCache directly** from the resolution step
3. **Verify ResolutionCache is available** in Project state

### If ResolutionCache Not Available

If Project doesn't store ResolutionCache, update it to do so:

```typescript
export class Project {
  private semantic_indexes: Map<FilePath, SemanticIndex>;
  private definitions: DefinitionRegistry;
  private imports: ImportRegistry;
  private resolutions: ResolutionCache;  // Add this

  async resolve_references(): Promise<void> {
    this.resolutions = resolve_references(
      this.semantic_indexes,
      this.definitions,
      this.imports
    );
  }

  async detect_call_graph(): Promise<CallGraph> {
    return detect_call_graph(
      this.semantic_indexes,
      this.definitions,
      this.resolutions
    );
  }
}
```

---

## Testing Strategy

### Manual Verification

1. **Check Project compiles** with new signature
2. **Verify call graph still works** in existing integration tests
3. **No behavior changes** - only plumbing update

---

## Acceptance Criteria

- [ ] Project coordinator updated to use new signature
- [ ] ResolutionCache properly passed to detect_call_graph
- [ ] Code compiles without errors
- [ ] Existing integration tests still pass

---

## Dependencies

**Depends on**:
- 11.140.6 (detect_call_graph fully refactored)

**Blocks**:
- 11.140.8 (comprehensive testing)

---

## Notes

This is a simple plumbing change - we're just passing different parameters to the same function. The actual logic changes happened in subtasks 11.140.1-6.
