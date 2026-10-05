---
id: task-109
title: Call Site Metadata and Control Flow Context
status: To Do
assignee: []
created_date: "2025-08-26"
labels: [enhancement, graph, analysis]
dependencies: []
---

## Description

Add rich metadata to call sites describing their execution context. This enables downstream tools (visualizers, analyzers) to understand HOW a call is made, not just THAT it's made.

## Motivation

The call graph currently captures call edges but lacks context about:
- Is this call inside a conditional branch?
- Is this call inside a loop?
- Is this call inside exception handling?
- Does this call have multiple resolution candidates?

This context is valuable for:
- **Visualization**: Draw conditional calls differently than unconditional calls
- **Dead code detection**: Identify calls in unreachable branches
- **Test coverage**: Understand which branches are exercised
- **Complexity analysis**: Identify deeply nested call patterns

## Data Model

### CallSiteMetadata

```typescript
// packages/types/src/call_chains.ts

/**
 * Rich metadata about a specific call site's execution context
 */
export interface CallSiteMetadata {
  /** Control flow context if inside conditional/loop/exception handling */
  readonly control_flow?: ControlFlowContext;

  /** Resolution ambiguity if multiple candidate targets */
  readonly resolution_ambiguity?: ResolutionAmbiguity;

  // Future extensions:
  // readonly async_context?: AsyncContext;
  // readonly closure_context?: ClosureContext;
}

/**
 * Control flow context for a call site
 */
export interface ControlFlowContext {
  /** Type of control flow construct */
  readonly type: "conditional" | "loop" | "switch" | "try_catch";

  /** Full span of the control flow construct (entire if/elif/else, full loop, etc.) */
  readonly construct_span: Location;

  /** Span of the specific branch this call is in (just the if-block, specific case, etc.) */
  readonly branch_span: Location;

  /** Condition/iterator expression text (for display/debugging) */
  readonly condition_text?: string;

  /** Branch index (0 = if/first case, 1 = elif/second case, etc.) */
  readonly branch_index?: number;

  /** Nesting depth (1 = top-level conditional, 2 = nested, etc.) */
  readonly nesting_depth?: number;
}

/**
 * Resolution ambiguity metadata
 */
export interface ResolutionAmbiguity {
  /** All candidate targets for this call */
  readonly candidates: readonly SymbolId[];

  /** Reason for ambiguity */
  readonly reason: "polymorphic" | "dynamic_dispatch" | "overload";
}
```

### Extended CallGraph

```typescript
export interface CallGraph {
  readonly nodes: ReadonlyMap<SymbolId, CallableNode>;
  readonly entry_points: readonly SymbolId[];

  /** Rich metadata about specific call sites (keyed by location) */
  readonly call_site_metadata?: ReadonlyMap<LocationKey, CallSiteMetadata>;
}
```

## Implementation

### Phase 1: Control Flow Context Detection

Detect when a call is inside a control flow construct:

```typescript
// packages/core/src/resolve_references/call_site_metadata/

function detect_control_flow_context(
  call_node: SyntaxNode,
  file_path: FilePath
): ControlFlowContext | undefined {
  let current = call_node.parent;
  let nesting_depth = 0;

  while (current) {
    if (is_conditional(current)) {
      nesting_depth++;
      return {
        type: "conditional",
        construct_span: extract_construct_span(current),
        branch_span: extract_branch_span(call_node, current),
        condition_text: extract_condition_text(current),
        branch_index: get_branch_index(call_node, current),
        nesting_depth,
      };
    }

    if (is_loop(current)) {
      nesting_depth++;
      return {
        type: "loop",
        construct_span: extract_construct_span(current),
        branch_span: extract_construct_span(current), // Loop body
        condition_text: extract_iterator_text(current),
        nesting_depth,
      };
    }

    // ... switch, try_catch handling

    current = current.parent;
  }

  return undefined;
}
```

### Phase 2: Resolution Ambiguity Tracking

Capture when a call resolves to multiple candidates:

```typescript
function detect_resolution_ambiguity(
  resolutions: Resolution[]
): ResolutionAmbiguity | undefined {
  if (resolutions.length <= 1) return undefined;

  // Determine ambiguity type based on resolution reasons
  const reasons = resolutions.map(r => r.reason.type);

  if (reasons.includes("interface_implementation")) {
    return {
      candidates: resolutions.map(r => r.symbol_id),
      reason: "polymorphic",
    };
  }

  return {
    candidates: resolutions.map(r => r.symbol_id),
    reason: "dynamic_dispatch",
  };
}
```

### Phase 3: Integration

Populate metadata during call resolution:

```typescript
// In resolve_calls()
for (const call of resolved_calls) {
  const metadata: CallSiteMetadata = {};

  // Detect control flow context
  const control_flow = detect_control_flow_context(call.node, file_path);
  if (control_flow) metadata.control_flow = control_flow;

  // Detect resolution ambiguity
  const ambiguity = detect_resolution_ambiguity(call.resolutions);
  if (ambiguity) metadata.resolution_ambiguity = ambiguity;

  if (Object.keys(metadata).length > 0) {
    call_site_metadata.set(location_key(call.location), metadata);
  }
}
```

## Language-Specific Considerations

### JavaScript/TypeScript

Control flow constructs:
- `if_statement` → conditional
- `for_statement`, `while_statement`, `do_statement` → loop
- `switch_statement` → switch
- `try_statement` → try_catch

### Python

Control flow constructs:
- `if_statement` → conditional (includes elif/else)
- `for_statement`, `while_statement` → loop
- `match_statement` → switch
- `try_statement` → try_catch

### Rust

Control flow constructs:
- `if_expression` → conditional
- `loop_expression`, `while_expression`, `for_expression` → loop
- `match_expression` → switch
- (No try_catch - uses Result/Option)

## Visualization Use Cases

A visualization tool could use this metadata to:

```
// Example: conditional call rendering
if (call_site_metadata.control_flow?.type === "conditional") {
  // Draw with dashed line
  // Show condition on hover: "if (x > 0)"
  // Color by branch index
}

// Example: ambiguous resolution rendering
if (call_site_metadata.resolution_ambiguity) {
  // Draw with "?" icon
  // Show candidates on hover
  // Use different line style
}
```

## Tasks

### Phase 1: Type Definitions
- [ ] Add CallSiteMetadata, ControlFlowContext, ResolutionAmbiguity to types
- [ ] Extend CallGraph interface with call_site_metadata field

### Phase 2: Control Flow Detection
- [ ] Implement control flow context detection for JavaScript/TypeScript
- [ ] Implement control flow context detection for Python
- [ ] Implement control flow context detection for Rust
- [ ] Handle nested control flow (nesting_depth)

### Phase 3: Resolution Ambiguity
- [ ] Track ambiguous resolutions during call resolution
- [ ] Classify ambiguity reasons (polymorphic, dynamic, overload)

### Phase 4: Integration
- [ ] Integrate metadata collection into resolve_references pipeline
- [ ] Include metadata in CallGraph output
- [ ] Add tests for each control flow type and language

## Acceptance Criteria

- [ ] Control flow context detected for calls in if/else, loops, switch, try/catch
- [ ] Resolution ambiguity tracked for polymorphic/dynamic calls
- [ ] Metadata available on CallGraph.call_site_metadata map
- [ ] Works across TypeScript, JavaScript, Python, Rust
- [ ] Performance impact < 5%
- [ ] Comprehensive tests for each control flow type

## Files to Create/Modify

| File | Changes |
|------|---------|
| `packages/types/src/call_chains.ts` | Add CallSiteMetadata types |
| `packages/core/src/resolve_references/call_site_metadata/` | NEW: Metadata detection module |
| `packages/core/src/resolve_references/resolve_references.ts` | Integrate metadata collection |
| `packages/core/src/trace_call_graph/trace_call_graph.ts` | Include metadata in CallGraph |

## Related Tasks

- **task-epic-11.156**: Function reachability via collection reads (orthogonal concern)

## Notes

This is orthogonal to function reachability. A call can be both:
- Resolved and reachable (function-level)
- Inside a conditional branch (call-site-level)

The two concerns are independent and should be modeled separately.
