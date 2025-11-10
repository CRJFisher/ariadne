# Task Epic-11.159: Framework Callback Pattern Detection

**Status**: TODO
**Priority**: P1 (Medium Impact)
**Estimated Effort**: 3-4 days
**Epic**: epic-11-codebase-restructuring
**Impact**: Fixes 9 misidentified symbols (6.7% of call graph bugs)
**Related**: Complements task-155 (type flow inference)

## Problem

Methods called through configuration-driven dispatch patterns (Map lookups, dynamic handler invocation) appear as uncalled because the call path goes through framework infrastructure.

### Pattern: Configuration-Driven Dispatch

```typescript
// Language builder configuration pattern
const CONFIG = new Map<string, CaptureHandler>([
  ['class', { process: (capture, builder, context) => builder.add_class(definition) }],
  ['function', { process: (capture, builder, context) => builder.add_function(definition) }],
  ['method', { process: (capture, builder, context) => builder.add_method_to_class(definition) }],
  // ... 20+ more handlers
]);

// Dispatcher loop
for (const capture of captures) {
  const handler = CONFIG.get(capture.name);
  if (handler) {
    handler.process(capture, builder, context);  // ❌ Indirect invocation
  }
}
```

**Call graph sees**:
```
query_loader.ts → Map.get() → (unknown) → handler.process()
```

**Reality**:
```
query_loader.ts → dispatcher loop → ALL 20+ handlers
                                  ↓
                      builder.add_class()
                      builder.add_function()
                      builder.add_method_to_class()
                      ... 20+ more methods
```

## Root Cause Analysis

### Missing: Data-Flow Analysis

Current call graph resolution is **control-flow based**:
- Follows function calls directly
- Resolves method receivers via types
- Works for: `foo.bar()`, `this.method()`, `user.getName()`

**Doesn't work for**:
- Values stored in collections (`Map`, `Array`, `Set`)
- Values retrieved from collections
- Callbacks passed to/through data structures

**The gap**: We need **data-flow tracking** to see:
1. What gets PUT into the Map (`CONFIG.set(key, handler)`)
2. What gets RETRIEVED from the Map (`CONFIG.get(key)`)
3. What gets CALLED from retrieved value (`handler.process()`)

### Pattern Recognition vs. General Data-Flow

**Two approaches**:

**Option A: General data-flow analysis**
- Track ALL values through ALL data structures
- Comprehensive but expensive (O(n²) or worse)
- Requires whole-program analysis
- Complex implementation (alias analysis, heap modeling)

**Option B: Pattern-specific detection**
- Recognize SPECIFIC framework patterns (Map-based dispatch, registry pattern)
- Targeted, efficient (O(n) with pattern matching)
- Pragmatic (covers 90% of real cases)
- Simple implementation (pattern templates)

**This task: Option B** (pattern-specific detection)

Future work: Option A (general data-flow) if analysis shows it's needed

## Design Principles

### 1. **Pattern Templates, Not Hardcoded Logic**

Define dispatch patterns declaratively:

```typescript
// framework_patterns/map_dispatch.pattern.ts
export const MAP_DISPATCH_PATTERN = {
  name: 'Map-based dispatch',

  // Pattern structure
  structure: {
    initialization: 'const CONFIG = new Map([...])',
    lookup: 'CONFIG.get(key)',
    invocation: 'handler.method(...args)'
  },

  // How to detect
  detect: {
    map_type: 'Map<string, {process: Function}>',
    initialization_style: 'literal' | 'constructor' | 'set_calls',
    lookup_method: 'get',
    call_on_result: 'process'
  },

  // How to trace calls
  trace: {
    from: 'lookup call site',
    to: 'all Map values',
    through: 'specified method (process)'
  }
};
```

### 2. **Conservative Over-Approximation**

When uncertain, **include too many edges** rather than miss real calls:
- If unsure what's in the Map → assume ALL registered handlers can be called
- If unsure which path is taken → assume ALL paths can be taken

**Rationale**: False positives (extra edges) are better than false negatives (missed calls) for entry point detection.

### 3. **Incremental Pattern Library**

Start with **most common patterns** in this codebase:
1. Map-based dispatch (language builder config)
2. Array of handlers (iteration patterns)
3. Registry pattern (callback storage and invocation)

Add more patterns as analysis identifies them.

## Implementation Plan

### Phase 1: Pattern Detection Framework (1 day)

Create infrastructure for pattern matching:

```typescript
// packages/core/src/trace_call_graph/framework_patterns/pattern_detector.ts

export interface FrameworkPattern {
  name: string;
  detect: (semantic_index: SemanticIndex) => PatternMatch[];
  trace_calls: (match: PatternMatch, graph: CallGraph) => CallEdge[];
}

export interface PatternMatch {
  pattern_name: string;
  locations: {
    initialization?: CodeLocation;
    lookup?: CodeLocation;
    invocation?: CodeLocation;
  };
  data: any;  // Pattern-specific extracted data
}

export class PatternDetector {
  private patterns: FrameworkPattern[] = [];

  register_pattern(pattern: FrameworkPattern): void {
    this.patterns.push(pattern);
  }

  detect_all(semantic_index: SemanticIndex): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns) {
      const pattern_matches = pattern.detect(semantic_index);
      matches.push(...pattern_matches);
    }

    return matches;
  }

  trace_calls(matches: PatternMatch[], graph: CallGraph): CallEdge[] {
    const edges: CallEdge[] = [];

    for (const match of matches) {
      const pattern = this.patterns.find(p => p.name === match.pattern_name);
      if (pattern) {
        const pattern_edges = pattern.trace_calls(match, graph);
        edges.push(...pattern_edges);
      }
    }

    return edges;
  }
}
```

### Phase 2: Map-Based Dispatch Pattern (1.5 days)

Implement detection for the language builder config pattern:

```typescript
// packages/core/src/trace_call_graph/framework_patterns/map_dispatch_pattern.ts

export const MAP_DISPATCH_PATTERN: FrameworkPattern = {
  name: 'Map-based dispatch',

  detect: (semantic_index: SemanticIndex): PatternMatch[] => {
    const matches: PatternMatch[] = [];

    // Step 1: Find Map variable declarations
    const map_variables = find_map_variables(semantic_index);

    for (const map_var of map_variables) {
      // Step 2: Find initialization (new Map([...]) or Map.set calls)
      const initialization = find_map_initialization(map_var, semantic_index);

      if (!initialization) continue;

      // Step 3: Extract handler functions from initialization
      const handlers = extract_map_handlers(initialization, semantic_index);

      // Step 4: Find .get() calls on this Map
      const lookups = find_map_lookups(map_var, semantic_index);

      // Step 5: Find method calls on retrieved values
      const invocations = find_handler_invocations(lookups, semantic_index);

      if (handlers.length > 0 && invocations.length > 0) {
        matches.push({
          pattern_name: 'Map-based dispatch',
          locations: {
            initialization: initialization.location,
            lookup: lookups[0]?.location,
            invocation: invocations[0]?.location
          },
          data: {
            map_variable: map_var.symbol_id,
            handlers,  // List of SymbolIds for handler functions
            invocation_method: 'process',  // Method called on handlers
            call_sites: invocations  // All invocation locations
          }
        });
      }
    }

    return matches;
  },

  trace_calls: (match: PatternMatch, graph: CallGraph): CallEdge[] => {
    const edges: CallEdge[] = [];
    const data = match.data;

    // Find the caller (function containing the dispatch loop)
    const caller_id = find_containing_callable(
      match.locations.invocation,
      graph
    );

    if (!caller_id) return edges;

    // Create edges from caller to ALL handlers
    for (const handler_id of data.handlers) {
      // If handler is an object with methods, find the invocation method
      const target_method = find_handler_method(
        handler_id,
        data.invocation_method,
        graph
      );

      if (target_method) {
        edges.push({
          from: caller_id,
          to: target_method,
          type: 'framework_dispatch',
          metadata: {
            pattern: 'Map-based dispatch',
            dispatch_variable: data.map_variable
          }
        });
      }
    }

    return edges;
  }
};

// Helper functions

function find_map_variables(semantic_index: SemanticIndex): VariableDefinition[] {
  return semantic_index.definitions.filter(def =>
    def.kind === 'variable' &&
    def.type_annotation?.type === 'Map'
  );
}

function extract_map_handlers(
  initialization: MapInitialization,
  semantic_index: SemanticIndex
): SymbolId[] {
  // For: new Map([['key', handler], ...])
  // Extract 'handler' from each array element

  const handlers: SymbolId[] = [];

  if (initialization.type === 'literal') {
    for (const entry of initialization.entries) {
      // entry is [key, value] array
      const value = entry[1];  // Handler function/object

      if (value.type === 'object_literal') {
        // Extract object literal methods
        const handler_id = create_synthetic_handler(value, semantic_index);
        handlers.push(handler_id);
      } else if (value.type === 'arrow_function') {
        // Use anonymous function SymbolId (from task-epic-11.156)
        handlers.push(value.symbol_id);
      }
    }
  }

  return handlers;
}

function find_map_lookups(
  map_var: VariableDefinition,
  semantic_index: SemanticIndex
): MethodCallReference[] {
  // Find all: CONFIG.get(...)
  return semantic_index.references.filter(ref =>
    ref.type === 'call' &&
    ref.context?.is_method_call &&
    ref.name === 'get' &&
    ref.context.receiver === map_var.symbol_id
  );
}

function find_handler_invocations(
  lookups: MethodCallReference[],
  semantic_index: SemanticIndex
): MethodCallReference[] {
  // Find calls like: handler.process(...)
  // where handler = CONFIG.get(...)

  const invocations: MethodCallReference[] = [];

  for (const lookup of lookups) {
    // Find variable that stores the result: const handler = CONFIG.get(...)
    const result_var = find_assignment_target(lookup, semantic_index);

    if (result_var) {
      // Find all method calls on result_var
      const calls = semantic_index.references.filter(ref =>
        ref.type === 'call' &&
        ref.context?.receiver === result_var.symbol_id
      );

      invocations.push(...calls);
    }
  }

  return invocations;
}
```

### Phase 3: Array Iteration Pattern (1 day)

Detect handlers stored in arrays and invoked via iteration:

```typescript
// framework_patterns/array_iteration_pattern.ts

export const ARRAY_ITERATION_PATTERN: FrameworkPattern = {
  name: 'Array iteration dispatch',

  detect: (semantic_index: SemanticIndex): PatternMatch[] => {
    // Detect pattern:
    // const handlers = [fn1, fn2, fn3];
    // for (const handler of handlers) {
    //   handler.process(...);
    // }
    // OR:
    // handlers.forEach(h => h.process(...));

    // Similar to Map dispatch, but for arrays
  },

  trace_calls: (match: PatternMatch, graph: CallGraph): CallEdge[] => {
    // Create edges from iteration site to all array elements
  }
};
```

### Phase 4: Integration with Call Graph Detection (0.5 days)

Extend call graph detection to include framework patterns:

```typescript
// packages/core/src/trace_call_graph/detect_call_graph.ts

export function detect_call_graph(
  semantic_index: SemanticIndex
): CallGraph {
  const graph = initialize_graph(semantic_index);

  // Existing: Direct function/method calls
  process_function_calls(semantic_index, graph);
  process_method_calls(semantic_index, graph);
  process_constructor_calls(semantic_index, graph);

  // NEW: Framework pattern calls
  const pattern_detector = create_pattern_detector();
  const pattern_matches = pattern_detector.detect_all(semantic_index);
  const pattern_edges = pattern_detector.trace_calls(pattern_matches, graph);

  for (const edge of pattern_edges) {
    add_call_edge(graph, edge.from, edge.to);

    // Mark as framework dispatch for analysis
    graph.framework_dispatch_edges.add(edge);
  }

  return graph;
}

function create_pattern_detector(): PatternDetector {
  const detector = new PatternDetector();

  // Register all patterns
  detector.register_pattern(MAP_DISPATCH_PATTERN);
  detector.register_pattern(ARRAY_ITERATION_PATTERN);
  // ... more patterns as needed

  return detector;
}
```

**Call graph enhancement**:
```typescript
export interface CallGraph {
  nodes: Map<SymbolId, CallGraphNode>;
  edges: Set<CallEdge>;

  // Existing enhancements
  polymorphic_calls: Set<PolymorphicCall>;

  // NEW: Framework dispatch tracking
  framework_dispatch_edges: Set<CallEdge & {
    type: 'framework_dispatch';
    metadata: {
      pattern: string;
      dispatch_variable?: SymbolId;
    };
  }>;
}
```

### Phase 5: Testing (1 day)

Comprehensive tests for pattern detection:

```typescript
// packages/core/src/trace_call_graph/framework_patterns/map_dispatch_pattern.test.ts

describe('Map-based dispatch pattern', () => {
  test('detects Map literal initialization', () => {
    const code = `
      const CONFIG = new Map([
        ['class', { process: (c, b, ctx) => b.add_class(c) }],
        ['function', { process: (c, b, ctx) => b.add_function(c) }]
      ]);
    `;

    const index = index_single_file(code, 'test.ts');
    const detector = create_pattern_detector();
    const matches = detector.detect_all(index);

    expect(matches).toHaveLength(1);
    expect(matches[0].pattern_name).toEqual('Map-based dispatch');
    expect(matches[0].data.handlers).toHaveLength(2);
  });

  test('traces calls from dispatch loop to all handlers', () => {
    const code = `
      const CONFIG = new Map([
        ['class', { process: (c, b, ctx) => b.add_class(c) }],
        ['function', { process: (c, b, ctx) => b.add_function(c) }]
      ]);

      function process_captures(captures, builder, context) {
        for (const capture of captures) {
          const handler = CONFIG.get(capture.name);
          if (handler) {
            handler.process(capture, builder, context);
          }
        }
      }
    `;

    const graph = detect_call_graph(code, 'test.ts');

    const process_node = graph.nodes.get('process_captures');

    // Should have edges to builder.add_class and builder.add_function
    // (via the handlers)
    expect(process_node.callees).toContain('add_class');
    expect(process_node.callees).toContain('add_function');

    // Should mark as framework dispatch
    const dispatch_edges = Array.from(graph.framework_dispatch_edges);
    expect(dispatch_edges.length).toBeGreaterThan(0);
  });

  test('handles Map.set() initialization', () => {
    const code = `
      const CONFIG = new Map();
      CONFIG.set('class', { process: (c, b) => b.add_class(c) });
      CONFIG.set('function', { process: (c, b) => b.add_function(c) });
    `;

    const detector = create_pattern_detector();
    const matches = detector.detect_all(index_single_file(code, 'test.ts'));

    expect(matches[0].data.handlers).toHaveLength(2);
  });
});

// packages/core/src/trace_call_graph/framework_patterns/integration.test.ts

describe('Framework pattern call graph integration', () => {
  test('combines direct calls and framework dispatch', () => {
    const code = `
      class Builder {
        add_class(def) { this.process_members(def.members); }
        process_members(members) { /* ... */ }
      }

      const CONFIG = new Map([
        ['class', { process: (c, b) => b.add_class(c) }]
      ]);

      function dispatch(captures, builder) {
        const handler = CONFIG.get(captures[0].name);
        handler.process(captures[0], builder);
      }
    `;

    const graph = detect_call_graph(code, 'test.ts');

    // dispatch → add_class (via framework dispatch)
    expect(graph.nodes.get('dispatch').callees).toContain('add_class');

    // add_class → process_members (direct call)
    expect(graph.nodes.get('add_class').callees).toContain('process_members');

    // Both should appear as reachable, not entry points
    const entry_points = find_entry_points(graph);
    expect(entry_points.map(e => e.name)).toContain('dispatch');
    expect(entry_points.map(e => e.name)).not.toContain('add_class');
    expect(entry_points.map(e => e.name)).not.toContain('process_members');
  });
});
```

## Success Criteria

- [ ] All 9 framework-dispatched method misidentifications resolve correctly
- [ ] Map-based dispatch pattern detected accurately
- [ ] Call edges created from dispatch loop to all registered handlers
- [ ] Framework dispatch edges marked separately for analysis
- [ ] No false positives (non-dispatch Maps incorrectly detected)
- [ ] Test coverage ≥95% for new code
- [ ] Performance: Pattern detection adds <15% overhead to call graph analysis

## Affected Misidentifications (9 total)

### DefinitionBuilder methods called via language config

**Pattern**:
```typescript
// typescript_config.ts, javascript_config.ts, python_config.ts, rust_config.ts
const CONFIG = new Map([
  ['definition.class', { process: (capture, builder) => builder.add_class(...) }],
  ['definition.function', { process: (capture, builder) => builder.add_function(...) }],
  ['definition.method', { process: (capture, builder) => builder.add_method_to_class(...) }],
  // ... 20+ more
]);

// query_loader.ts (dispatcher)
for (const capture of captures) {
  const handler = CONFIG.get(capture.name);
  handler?.process(capture, builder, context);
}
```

**Affected methods** (called via dispatch, appear uncalled):
- `add_class()`
- `add_function()`
- `add_method_to_class()`
- `add_import()`
- `add_type_annotation()`
- `add_variable()`
- `add_parameter()`
- `add_property()`
- `add_constructor()`
- ... ~20+ total

**Root cause**: Methods called through `CONFIG.get()` → `handler.process()` → `builder.add_*()` chain not traced.

## Design Decisions

### Why Pattern Matching, Not General Data-Flow?

**General data-flow analysis** would require:
- Alias analysis (tracking which variables point to same object)
- Heap modeling (tracking Map contents through program execution)
- Inter-procedural analysis (tracking data across function boundaries)
- Points-to analysis (what each pointer/reference might point to)

**Complexity**: O(n²) to O(n³), requires whole-program analysis, high implementation cost

**Pattern matching** advantages:
- O(n) complexity (linear scan for patterns)
- Localized (per-file or per-module)
- Pragmatic (covers real cases in this codebase)
- Extensible (add patterns incrementally)

**Trade-off**: Misses exotic dispatch patterns, but covers 90%+ of real usage.

### Relationship to task-155 (Type Flow Inference)

**task-155** focuses on:
- Type flow through built-in methods (`Array.reduce`, `Promise.then`)
- Parameter type inference for callbacks
- Generic type instantiation

**This task** focuses on:
- Call flow through data structures (Map, Array)
- Callback registration and invocation
- Framework-specific dispatch patterns

**Overlap**: Both deal with callbacks, but different aspects:
- task-155: "What TYPE does the callback parameter have?"
- This task: "What FUNCTIONS are called through the dispatch?"

**Integration**: This task creates call edges; task-155 provides type information for those calls.

### Conservative Over-Approximation Strategy

When in doubt, **include the edge**:

```typescript
// Uncertain case: Map might be mutated after initialization
const CONFIG = new Map([/* initial handlers */]);

// Later, in different function
if (some_condition) {
  CONFIG.set('extra', some_handler);  // Dynamic addition
}
```

**Strategy**:
- Detect initial handlers → create edges
- Detect dynamic additions (Map.set calls) → create additional edges
- Even if unsure if set() is executed → include it (conservative)

**Rationale**: Entry point detection prefers false positives (marking something as called when it might not be) over false negatives (missing a real call).

### Pattern Library Extensibility

Start with 2-3 patterns, design for easy addition:

**Future patterns to consider**:
- Event emitter pattern (`on('event', handler)`)
- Plugin registry pattern (`register(plugin)` → `plugin.init()`)
- Middleware chain pattern (`use(middleware)` → `middleware(req, res, next)`)
- Dependency injection pattern (`@Inject()` decorators)

**Extension mechanism**:
```typescript
// Create new pattern file
// framework_patterns/event_emitter_pattern.ts
export const EVENT_EMITTER_PATTERN: FrameworkPattern = {
  name: 'Event emitter',
  detect: (semantic_index) => { /* ... */ },
  trace_calls: (match, graph) => { /* ... */ }
};

// Register in pattern detector
detector.register_pattern(EVENT_EMITTER_PATTERN);
```

## Performance Considerations

### Pattern Detection Cost

For each pattern:
1. Scan definitions for matching variables (~O(n) where n = # definitions)
2. Find initialization (~O(k) where k = # references to variable)
3. Extract handlers (~O(h) where h = # handlers)
4. Find lookups (~O(k))
5. Find invocations (~O(k))

**Total per pattern**: O(n + k + h) ≈ O(n)

**With P patterns**: O(P × n)

**Expected**: P = 2-5, overhead = 2-5× definition scan (already done for call graph)

**Mitigation**:
- Lazy detection (only scan for patterns if enabled)
- Cache pattern matches across analyses
- Early exit if pattern preconditions not met

### Call Graph Edge Increase

Framework dispatch creates **multiple edges** from single call site:

```typescript
// Single call site
handler.process(capture, builder, context);

// Creates N edges (N = # handlers)
dispatch → handler1.process
dispatch → handler2.process
dispatch → handler3.process
// ... N total
```

**Impact**: +20-50 edges for typical config with 20-50 handlers

**Benefit**: Accurately represents call graph (all handlers ARE reachable from dispatch)

## Related Tasks

- **task-epic-11.155**: Self-reference resolution (31% of bugs) - P0
- **task-epic-11.156**: Anonymous callback capture (10% of bugs) - P0, **prerequisite for this task**
- **task-epic-11.158**: Interface method resolution (7% of bugs) - P1
- **task-155**: Type flow inference through built-ins (complementary: types vs calls)

**Dependency**: Requires task-epic-11.156 (anonymous callback capture) to be completed first, as framework dispatch handlers are often anonymous arrow functions.

## Out of Scope

- **General data-flow analysis**: Alias analysis, points-to analysis, heap modeling
- **Dynamic code execution**: `eval()`, `Function()` constructor, runtime code generation
- **Reflection-based dispatch**: `obj[methodName]()` where methodName is a variable
- **External framework patterns**: Only patterns used in this codebase (not generic framework support)

These would require significantly more complex analysis infrastructure and are low priority for current use cases.

## Migration Path

This is a **non-breaking addition**:
- Adds new call edges to graph
- Doesn't modify existing call edge detection
- Framework dispatch edges are marked separately (can be filtered if needed)

**Deployment**:
1. Implement pattern detector
2. Add to call graph detection (behind feature flag initially)
3. Verify accuracy on test suite
4. Enable by default
5. Monitor entry point detection accuracy improvement

**Rollback**: Disable pattern detection, fall back to existing call graph logic.
