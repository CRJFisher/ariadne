---
id: task-161.3
title: Optimize process_references() performance
status: To Do
assignee: []
created_date: '2026-01-07'
labels: [performance, investigation, optimization]
dependencies: [task-161.1]
parent_task_id: task-161
priority: MEDIUM
---

## Problem

`process_references()` accounts for 4.3% of total processing time (522ms across 82 files).

### Profiling Evidence

```
process_references: 522ms (4.3% of total)
  - 80 calls
  - avg: 6.53ms per file
  - min: 0.00ms
  - max: 32.66ms
```

While not as critical as query compilation, this is the third largest bottleneck and worth investigating.

## Investigation Goals

1. **Identify expensive files:** Which files have the most references?
2. **Profile metadata extraction:** Are the extractors efficient?
3. **Analyze reference creation:** Object allocation patterns?
4. **Check for redundant work:** Are we processing the same captures multiple times?

## Current Implementation

```typescript
// packages/core/src/index_single_file/references/references.ts

export function process_references(
  context: ProcessingContext,
  metadata_extractors: MetadataExtractors | undefined,
  file_path: FilePath
): SymbolReference[] {
  const references: SymbolReference[] = [];

  for (const capture of context.captures) {
    // Filter to reference-related captures
    if (!is_reference_capture(capture)) continue;

    // Extract metadata using language-specific extractors
    const metadata = extract_reference_metadata(capture, metadata_extractors);

    // Create SymbolReference object
    references.push({
      symbol_name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      ...metadata,
    });
  }

  return references;
}
```

## Investigation Steps

### Step 1: Per-File Reference Count

Add logging to correlate file size with processing time:

```typescript
profiler.record_counts({ references: references.length });
```

**Hypothesis:** Files with more references take longer (linear).

### Step 2: Profile Metadata Extraction

Check if extractors are expensive:

```typescript
profiler.start("extract_reference_metadata");
const metadata = extract_reference_metadata(capture, metadata_extractors);
profiler.end("extract_reference_metadata");
```

### Step 3: Profile Scope Lookups

Check if `get_scope_id()` is being called too often:

```typescript
profiler.start("get_scope_id");
const scope_id = context.get_scope_id(capture.location);
profiler.end("get_scope_id");
```

### Step 4: Analyze Metadata Extractors

Review the extractor implementations:

| Extractor | File | Potential Issues |
|-----------|------|------------------|
| `extract_call_metadata` | `javascript.ts`, `typescript.ts` | Tree traversal for receiver |
| `extract_member_access` | `javascript.ts`, `typescript.ts` | Parent node lookups |
| `extract_type_reference` | `typescript.ts` | Type node analysis |

## Potential Optimizations

### A. Batch Scope Lookups

Currently each reference does its own scope lookup:

```typescript
// Current: O(references * scopes) worst case
for (const capture of context.captures) {
  const scope_id = context.get_scope_id(capture.location);  // O(scopes) per call
}
```

**Optimization:** Pre-compute scope assignments for all captures:

```typescript
// Optimized: O(captures + scopes log captures)
const capture_to_scope = precompute_scope_assignments(context.captures, context.scopes);
for (const capture of context.captures) {
  const scope_id = capture_to_scope.get(capture);  // O(1) per call
}
```

### B. Skip Non-Reference Captures Early

Don't allocate or process captures that aren't references:

```typescript
// Current: Filter happens inside the loop
for (const capture of context.captures) {
  if (!is_reference_capture(capture)) continue;  // Check every time
}

// Optimized: Pre-filter once
const reference_captures = context.captures.filter(is_reference_capture);
for (const capture of reference_captures) {
  // Process directly, no check needed
}
```

### C. Reduce Object Spread

Each reference creation spreads metadata:

```typescript
// Current: Object spread creates new object
references.push({
  symbol_name: capture.text,
  location: capture.location,
  scope_id: scope_id,
  ...metadata,  // Spread = allocation
});

// Optimized: Build object directly
const ref: SymbolReference = {
  symbol_name: capture.text,
  location: capture.location,
  scope_id: scope_id,
  reference_kind: metadata.reference_kind,
  call_metadata: metadata.call_metadata,
  // ... explicit properties
};
references.push(ref);
```

### D. Pre-size Array

If reference count is predictable, pre-size the array:

```typescript
// Estimate reference count from capture count
const estimated_refs = context.captures.filter(is_reference_capture).length;
const references: SymbolReference[] = new Array(estimated_refs);
let idx = 0;

for (const capture of context.captures) {
  if (!is_reference_capture(capture)) continue;
  references[idx++] = create_reference(capture);
}

return references.slice(0, idx);  // Trim to actual size
```

### E. Lazy Metadata Extraction

Only extract metadata when needed:

```typescript
// If some metadata fields are rarely used, make them lazy
interface SymbolReference {
  symbol_name: SymbolName;
  location: Location;
  scope_id: ScopeId;
  get_call_metadata(): CallMetadata | undefined;  // Lazy getter
}
```

## Files to Analyze

- `packages/core/src/index_single_file/references/references.ts` - Main processing
- `packages/core/src/index_single_file/references/factories.ts` - Reference factories
- `packages/core/src/index_single_file/query_code_tree/metadata_extractors/` - All extractors
- `packages/core/src/index_single_file/scopes/scopes.ts` - `get_scope_id()` implementation

## Correlation Analysis

Cross-reference with `process_definitions` investigation:

- Both use `context.get_scope_id()` - optimize once, benefit both
- Both iterate `context.captures` - could batch if patterns overlap

## Acceptance Criteria

- [ ] Identify correlation between reference count and processing time
- [ ] Profile individual metadata extractors
- [ ] Document scope lookup frequency and cost
- [ ] Implement at least one optimization that reduces time by 20%+
- [ ] Verify no regression in reference detection accuracy
- [ ] Add benchmark test to prevent regression
- [ ] All existing tests pass

## Deliverables

1. **Investigation report:** Which extractors/patterns are expensive
2. **Optimization PR:** Implement identified optimizations
3. **Benchmark test:** Prevent future regression

## Notes

- Optimizations to `get_scope_id()` will benefit both `process_definitions` and `process_references`
- Consider implementing scope lookup optimizations as a shared improvement
