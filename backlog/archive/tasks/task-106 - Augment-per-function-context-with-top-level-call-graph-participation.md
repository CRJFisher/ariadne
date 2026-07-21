---
id: task-106
title: Augment per-function context with top-level call graph participation
status: To Do
assignee: []
created_date: '2025-08-14 16:25'
labels: [architecture, metrics, call-graph]
dependencies: []
priority: Medium
---

# Task 106: Augment per-function context with top-level call graph participation

## Description

Add a new metric to per-function context that tracks how many top-level call graphs each function participates in. This will identify functions that are integral to multiple top-level tasks/features, providing valuable architectural insights.

## Context

Currently, Ariadne analyzes call graphs and tracks function relationships, but doesn't explicitly measure how "central" or "integral" a function is across different top-level entry points. By tracking which functions appear in multiple top-level call graphs, we can:

1. **Identify critical integration points** - Functions that appear in many call graphs are likely key architectural components
2. **Measure coupling** - Functions in many call graphs may indicate tight coupling between features
3. **Prioritize refactoring** - High-participation functions are prime candidates for optimization or splitting
4. **Understand feature dependencies** - See which low-level utilities support multiple high-level features
5. **Detect hidden complexity** - Functions that seem simple but appear everywhere may have hidden importance

## Acceptance Criteria

- [ ] Add `top_level_call_graph_count` field to per-function context
- [ ] Track which specific top-level call graphs include each function (not just count)
- [ ] Include list of top-level entry points that lead to this function
- [ ] Calculate percentage of all top-level call graphs that include this function
- [ ] Add metrics for:
  - Direct participation (function is directly called)
  - Indirect participation (function is in the call chain)
  - Depth from each top-level entry point
- [ ] Generate insights report highlighting:
  - Functions in 80%+ of call graphs (critical infrastructure)
  - Functions in 50-80% of call graphs (shared utilities)
  - Functions that bridge distinct feature areas
- [ ] Add tests for all supported languages (JavaScript, TypeScript, Python, Rust)
- [ ] Document the new metrics in user-facing documentation

## Technical Approach

### Data Structure

```typescript
interface FunctionCallGraphParticipation {
  // Count of top-level call graphs this function appears in
  top_level_graph_count: number;

  // Total number of top-level call graphs in the codebase
  total_top_level_graphs: number;

  // Percentage of all call graphs this function participates in
  participation_percentage: number;

  // Detailed participation info
  participations: Array<{
    // The top-level entry point function
    entry_point: string;

    // How deep this function is from the entry point
    depth: number;

    // The call path from entry point to this function
    call_path: string[];

    // Whether this is a direct call from entry point
    is_direct: boolean;
  }>;

  // Categorization based on participation
  integration_category: "critical" | "shared" | "feature-specific" | "isolated";
}
```

### Implementation Steps

1. **Identify top-level entry points**

   - Functions not called by any other function in the codebase
   - Exported functions from entry files
   - Main functions, event handlers, API endpoints

2. **Build complete call graphs from each entry point**

   - Use existing call graph infrastructure
   - Track depth and path for each function encountered

3. **Aggregate participation data**

   - Count unique top-level graphs each function appears in
   - Calculate participation percentages
   - Categorize based on thresholds

4. **Generate insights**
   - Functions that are "architectural keystones" (high participation)
   - Functions that bridge otherwise disconnected features
   - Potential refactoring opportunities for over-used functions

## Value Proposition

This feature will provide immediate architectural insights by revealing:

- **Hidden dependencies**: Functions you didn't realize were critical
- **Refactoring targets**: Over-used functions that should be split
- **Architecture quality**: How well-separated features really are
- **Testing priorities**: Which functions affect the most features
- **Performance hotspots**: Functions on many critical paths

## Example Use Cases

1. **Finding the most critical functions to test thoroughly**

   - Functions in 90%+ of call graphs need the most rigorous testing

2. **Identifying candidates for micro-optimization**

   - Functions called in many graphs have multiplicative performance impact

3. **Understanding feature isolation**

   - If adding a feature increases many functions' participation counts, features may be too coupled

4. **Prioritizing documentation**
   - Functions with high participation need the best documentation

## Dependencies

- Existing call graph analysis infrastructure
- Language-specific parsers for all supported languages

## Related Tasks

- Task 100 series (call graph improvements)
- Epic 8 (cross-file analysis capabilities)

## Notes

This metric connects top-level call graphs in a way that could reveal profound insights about code architecture. By understanding which functions are truly "load-bearing" across multiple features, developers can make more informed decisions about refactoring, testing, and optimization priorities.

## Implementation Notes

_To be filled in during implementation_

## Test Gaps

_To be documented during implementation_
