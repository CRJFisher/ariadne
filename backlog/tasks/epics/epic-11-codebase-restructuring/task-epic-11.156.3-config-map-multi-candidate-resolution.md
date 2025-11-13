# Task Epic-11.156.3: Config Map Handler Multi-Candidate Resolution

**Status**: TODO
**Priority**: P1 (Medium Impact - Enables advanced call graph analysis)
**Estimated Effort**: 3-4 days
**Parent Task**: task-epic-11.156 (Anonymous Callback Function Capture)
**Depends On**:

- task-epic-11.156.1 (Scope attribution)
- task-epic-11.156.2 (Callback invocation detection)
- task-epic-11.158 (Interface method multi-candidate resolution architecture)
  **Epic**: epic-11-codebase-restructuring
  **Impact**: Enables dynamic dispatch analysis; generalizes to all polymorphic call patterns

## Problem

Functions stored in Maps/Arrays/Objects and invoked dynamically cannot be resolved to concrete implementations, causing these handlers to appear as uncalled entry points.

### Current Behavior

```typescript
// javascript_builder_config.ts pattern
const CONFIG = new Map([
  ["class", (capture) => builder.add_class(definition)],
  ["function", (capture) => builder.add_function(definition)],
  ["method", (capture) => builder.add_method_to_class(definition)],
  // ... 20+ more handlers
]);

// Later, dynamic invocation:
const handler = CONFIG.get(type); // ← Variable assignment from Map access
handler(capture); // ← Dynamic call through variable
```

**Call Graph**:

```
process_captures (calls) → CONFIG.get  ✓ Tracked
process_captures (calls) → handler     ❌ Can't resolve (variable, not symbol)
(All handlers in CONFIG appear as uncalled entry points)
```

### User Requirements (from discussion)

> "I still think we need to trace the object (map, list etc) containing the function definitions and determine that it is at least invoked somewhere. This call site would then mark all the config functions as 'possible' calls i.e. not certain, but possible."

> "This is a new type of call reference resolution in the call graph analysis. We found that we also needed something like this for method resolution where e.g. an interface method is being called and all we can say is that it could be one of a handful of implementations that were called."

> "We should join up these bits of work, maybe starting with the prior task of modelling and naming this new type of call resolution."

**Key Points**:

1. Trace collections (Map, Array, Object) containing function definitions
2. Detect when collections are accessed and invoked
3. Model as **multi-candidate resolution** (like interface method resolution)
4. Mark as "possible" calls, not "certain"
5. Use same architecture as task-epic-11.158 (interface method resolution)

## Design: Multi-Candidate Resolution for Dynamic Dispatch

### Unified Architecture with Interface Method Resolution

From task-epic-11.158, we have `ResolutionCandidate`:

```typescript
export interface ResolutionCandidate {
  symbol_id: SymbolId;
  confidence: "certain" | "likely" | "possible";
  reason: string; // "direct resolution", "interface implementation", "config map handler", etc.
}
```

**Config map handlers are another case of multi-candidate resolution**:

- Interface calls: Multiple candidates based on type hierarchy
- Config map calls: Multiple candidates based on collection membership

**Shared pattern**:

1. **Detection**: Identify polymorphic call sites
2. **Candidate lookup**: Find all possible targets
3. **Edge creation**: Create call edges to all candidates
4. **Metadata**: Store information about ambiguity

### Three-Phase Approach

#### Phase A: Identify Collections Containing Functions

**Pattern**: Variable assigned to collection literal containing functions

```typescript
const CONFIG = new Map([...]);  // ← Collection definition
const HANDLERS = {              // ← Collection definition
  process: (x) => { },
  validate: (y) => { }
};
```

**Detection during definition building**:

- Track variable assignments to Map/Set/Array/Object literals
- If literal contains function definitions, register as "function collection"

#### Phase B: Detect Collection Access and Invocation

**Pattern**: Variable assigned from collection access, then called

```typescript
const handler = CONFIG.get(type); // ← Collection access
handler(capture); // ← Call through variable
```

**Pattern 2**: Direct invocation (less common)

```typescript
CONFIG.get(type)(capture); // ← Direct call on collection access
```

**Detection during reference capture**:

- Track variable assignments from collection access (Map.get, array[x], obj.prop)
- Track calls through those variables
- Link back to the collection definition

#### Phase C: Multi-Candidate Resolution

**When a call through a collection-accessed variable is detected**:

1. Trace back to the collection definition
2. Get all functions stored in that collection
3. Return all as candidates with `confidence: 'possible'`

### Comparison with Interface Method Resolution

| Aspect                | Interface Methods                   | Config Map Handlers                       |
| --------------------- | ----------------------------------- | ----------------------------------------- |
| **Trigger**           | Call on interface-typed variable    | Call through collection-accessed variable |
| **Candidates**        | All implementations of interface    | All functions in collection               |
| **Confidence**        | `certain` (all impls equally valid) | `possible` (only one will execute)        |
| **Candidate lookup**  | Interface → Implementations index   | Collection → Stored functions index       |
| **Call graph impact** | Multiple edges (all valid)          | Multiple edges (one will execute)         |

## Implementation Plan

### Phase 1: Extend Semantic Index for Collections (1 day)

#### Track Function Collections

```typescript
// packages/core/src/index_single_file/definitions/definition_builder.ts

interface FunctionCollection {
  collection_id: SymbolId; // Variable holding the collection
  collection_type: "Map" | "Set" | "Array" | "Object";
  location: Location;
  stored_functions: SymbolId[]; // Functions stored in this collection
}

export class DefinitionBuilder {
  // NEW: Track function collections
  private function_collections: Map<SymbolId, FunctionCollection> = new Map();

  /**
   * Register that a variable holds a collection containing functions
   */
  register_function_collection(
    collection_id: SymbolId,
    collection_type: "Map" | "Set" | "Array" | "Object",
    location: Location,
    stored_functions: SymbolId[]
  ): void {
    this.function_collections.set(collection_id, {
      collection_id,
      collection_type,
      location,
      stored_functions,
    });
  }

  get_function_collections(): ReadonlyMap<SymbolId, FunctionCollection> {
    return this.function_collections;
  }
}
```

#### Detect Collections During Processing

```typescript
// packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts

["definition.variable", {
  process: (capture, builder, context) => {
    const var_id = /* ... */;

    // Check if this variable is assigned to a collection literal
    const collection_info = detect_function_collection(capture.node);

    if (collection_info) {
      // Register the collection
      builder.register_function_collection(
        var_id,
        collection_info.type,
        capture.location,
        collection_info.function_ids
      );
    }

    // ... rest of variable processing ...
  }
}]

function detect_function_collection(node: TSNode): {
  type: 'Map' | 'Set' | 'Array' | 'Object';
  function_ids: SymbolId[];
} | null {
  // Check if initializer is a collection constructor or literal
  const initializer = node.childForFieldName('value');
  if (!initializer) return null;

  // Check for Map/Set constructor: new Map([...])
  if (initializer.type === 'new_expression') {
    const constructor = initializer.childForFieldName('constructor');
    if (constructor?.text === 'Map' || constructor?.text === 'Set') {
      const args = initializer.childForFieldName('arguments');
      const functions = extract_functions_from_collection_args(args);
      if (functions.length > 0) {
        return { type: constructor.text as 'Map' | 'Set', function_ids: functions };
      }
    }
  }

  // Check for array literal: [...]
  if (initializer.type === 'array') {
    const functions = extract_functions_from_array(initializer);
    if (functions.length > 0) {
      return { type: 'Array', function_ids: functions };
    }
  }

  // Check for object literal: { key: fn, ... }
  if (initializer.type === 'object') {
    const functions = extract_functions_from_object(initializer);
    if (functions.length > 0) {
      return { type: 'Object', function_ids: functions };
    }
  }

  return null;
}

function extract_functions_from_collection_args(args: TSNode | null): SymbolId[] {
  if (!args) return [];

  const function_ids: SymbolId[] = [];

  // For Map: new Map([['key', fn], ['key2', fn2]])
  // Navigate through: arguments → array → pair → array (key-value pairs) → arrow_function

  // Simplified: Look for arrow_function nodes within args
  const functions = find_nodes_by_type(args, 'arrow_function');
  for (const fn of functions) {
    const location = extract_location(fn);
    function_ids.push(anonymous_function_symbol(location));
  }

  return function_ids;
}

function extract_functions_from_object(obj: TSNode): SymbolId[] {
  const function_ids: SymbolId[] = [];

  // For object literal: { handler: (x) => { }, ... }
  for (let i = 0; i < obj.namedChildCount; i++) {
    const pair = obj.namedChild(i);
    if (pair?.type === 'pair') {
      const value = pair.childForFieldName('value');
      if (value && (value.type === 'arrow_function' || value.type === 'function_expression')) {
        const location = extract_location(value);
        function_ids.push(anonymous_function_symbol(location));
      }
    }
  }

  return function_ids;
}
```

### Phase 2: Track Collection Access and Invocation (1 day)

#### Capture Collection Access References

Create new reference type for collection access:

```typescript
// packages/types/src/reference.ts

export interface CollectionAccessReference extends BaseReference {
  kind: "collection_access";
  collection_name: SymbolName; // Variable name (e.g., 'CONFIG')
  access_type: "get" | "index" | "property"; // Map.get(), array[x], obj.prop
  access_key?: string; // If statically known: CONFIG.get('class')
}
```

**Capture during reference building**:

```typescript
// reference_builder.ts

export enum ReferenceKind {
  // ... existing ...
  COLLECTION_ACCESS,
}

function determine_reference_kind(capture: CaptureNode): ReferenceKind {
  // ... existing cases ...

  // NEW: Detect collection access patterns
  if (capture.node.type === "call_expression") {
    const func_node = capture.node.childForFieldName("function");
    if (func_node?.type === "member_expression") {
      const property = func_node.childForFieldName("property");
      if (property?.text === "get") {
        // Likely Map.get() or similar
        return ReferenceKind.COLLECTION_ACCESS;
      }
    }
  }

  if (capture.node.type === "subscript_expression") {
    // Array or object index access: obj[key]
    return ReferenceKind.COLLECTION_ACCESS;
  }

  // ... rest ...
}
```

#### Detect Invocation Through Collection-Accessed Variables

**Challenge**: Need data flow analysis to track:

```typescript
const handler = CONFIG.get(type); // ← Assignment
handler(capture); // ← Call
```

**Simplified approach**: Detect pattern within same scope

```typescript
// packages/core/src/resolve_references/collection_dispatch_resolver.ts (NEW FILE)

/**
 * Detect when collection-accessed values are called.
 *
 * Pattern:
 * 1. Variable assigned from collection access (Map.get, array[x], obj.prop)
 * 2. Variable called within same scope
 * 3. Link call to all functions in the collection
 */
export function detect_collection_dispatch_calls(
  references: readonly SymbolReference[],
  definitions: DefinitionRegistry
): CollectionDispatchCall[] {
  const dispatch_calls: CollectionDispatchCall[] = [];

  // Group references by scope
  const refs_by_scope = group_by(references, (ref) => ref.scope_id);

  for (const [scope_id, scope_refs] of refs_by_scope) {
    // Find collection access assignments
    const collection_accesses = scope_refs.filter(
      (ref) => ref.kind === "collection_access"
    );

    // Find variable calls
    const variable_calls = scope_refs.filter(
      (ref) => ref.kind === "function_call"
    );

    // Match pattern: assignment from collection access + call to assigned variable
    for (const access of collection_accesses) {
      // Check if this access is assigned to a variable
      const assigned_var = extract_assignment_target(access);
      if (!assigned_var) continue;

      // Find calls to this variable in same scope
      for (const call of variable_calls) {
        if (call.name === assigned_var) {
          // Found pattern! Get collection definition
          const collection_id = resolve_collection_name(access, definitions);
          if (!collection_id) continue;

          const collection = definitions.get_function_collection(collection_id);
          if (!collection) continue;

          // Record this as a collection dispatch call
          dispatch_calls.push({
            call_location: call.location,
            collection_id,
            candidate_functions: collection.stored_functions,
            access_key: extract_access_key(access), // e.g., 'class' from CONFIG.get('class')
          });
        }
      }
    }
  }

  return dispatch_calls;
}

interface CollectionDispatchCall {
  call_location: Location;
  collection_id: SymbolId;
  candidate_functions: SymbolId[];
  access_key?: string; // If statically known
}

function extract_assignment_target(
  access_ref: SymbolReference
): SymbolName | null {
  // Look at the parent AST node to find assignment target
  // This requires access to tree-sitter node, which we don't have in references
  // PROBLEM: References don't include AST nodes

  // SOLUTION: During reference capture, store assignment target in metadata
  // Or: Re-parse to find assignment targets (expensive)

  // For now: Simplified heuristic based on location
  // If reference is on left side of assignment, extract target
  // This would require storing more context in references

  return null; // Placeholder
}
```

**Better approach**: Store assignment context during reference capture

```typescript
// During reference building, detect variable assignments:

[
  "assignment.variable",
  {
    // NEW capture type
    process: (capture, builder, context) => {
      // Capture: const x = expr
      const var_name = extract_variable_name(capture.node);
      const value_expr = extract_value_expression(capture.node);

      // Check if value is a collection access
      if (is_collection_access(value_expr)) {
        // Store metadata about this assignment
        builder.add_collection_access_assignment({
          variable_name: var_name,
          collection_name: extract_collection_name(value_expr),
          access_type: extract_access_type(value_expr),
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
        });
      }
    },
  },
];
```

**Reality check**: This requires significant data flow analysis

**Pragmatic alternative**: Pattern-based heuristic for common cases

### Phase 3: Multi-Candidate Resolution (1 day)

Use same architecture as interface method resolution (task-epic-11.158):

```typescript
// packages/core/src/resolve_references/call_resolution/collection_dispatch_resolver.ts

/**
 * Resolve collection dispatch calls to multiple candidates.
 *
 * Similar to polymorphic method resolution (interface implementations),
 * but for dynamic dispatch through collections.
 */
export function resolve_collection_dispatch_candidates(
  dispatch_call: CollectionDispatchCall,
  definitions: DefinitionRegistry
): ResolutionCandidate[] {
  const collection = definitions.get_function_collection(
    dispatch_call.collection_id
  );
  if (!collection) {
    return [];
  }

  // All stored functions are candidates
  const candidates: ResolutionCandidate[] = [];

  for (const func_id of collection.stored_functions) {
    candidates.push({
      symbol_id: func_id,
      confidence: "possible", // Only ONE will execute, but we don't know which
      reason: `collection dispatch from ${collection.collection_type} at ${collection.location.start_line}`,
    });
  }

  return candidates;
}
```

### Phase 4: Integrate with Call Graph (0.5 days)

Update call graph detection to include collection dispatch calls:

```typescript
// packages/core/src/trace_call_graph/detect_call_graph.ts

export function detect_call_graph(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): CallGraph {
  // ... existing: build function nodes, detect regular calls ...

  // NEW: Detect collection dispatch calls
  const dispatch_calls = detect_collection_dispatch_calls(
    resolutions.get_all_references(),
    definitions
  );

  // NEW: Add collection dispatch edges
  for (const dispatch of dispatch_calls) {
    const candidates = resolve_collection_dispatch_candidates(
      dispatch,
      definitions
    );

    // Find caller (function containing the dispatch call)
    const caller_scope = find_enclosing_function_scope(
      dispatch.call_location,
      resolutions.get_scopes()
    );
    const caller_def = definitions.get_callable_by_body_scope(caller_scope);

    if (!caller_def) continue;

    // Create edges to all candidates
    for (const candidate of candidates) {
      add_call_edge(graph, caller_def.symbol_id, candidate.symbol_id);

      // Store as multi-candidate call
      graph.multi_candidate_calls.add({
        caller: caller_def.symbol_id,
        callees: candidates.map((c) => c.symbol_id),
        call_site: dispatch.call_location,
        dispatch_type: "collection", // vs 'polymorphic' for interfaces
        total_candidates: candidates.length,
      });
    }
  }

  return graph;
}
```

### Phase 5: Update Call Graph Types (0.5 days)

Extend CallGraph to track multi-candidate calls:

```typescript
// packages/types/src/call_graph.ts

export interface CallGraph {
  nodes: ReadonlyMap<SymbolId, CallableNode>;
  entry_points: readonly SymbolId[];

  /**
   * Multi-candidate call sites where a single call may invoke multiple possible targets.
   *
   * Includes:
   * - Polymorphic method calls (interface → implementations)
   * - Collection dispatch calls (Map/Array/Object → stored functions)
   * - Dynamic dispatch through variables
   */
  multi_candidate_calls: ReadonlyArray<{
    caller: SymbolId;
    callees: SymbolId[]; // All possible targets
    call_site: Location;
    dispatch_type: "polymorphic" | "collection" | "dynamic";
    total_candidates: number;
    // Optional metadata
    confidence?: "certain" | "likely" | "possible";
    access_key?: string; // For collection: key used to access
  }>;
}
```

### Phase 6: Testing (1 day)

```typescript
// packages/core/src/resolve_references/collection_dispatch.test.ts

describe('Collection dispatch detection', () => {
  test('detects Map with function handlers', () => {
    const code = `
      const CONFIG = new Map([
        ['class', (capture) => builder.add_class(capture)],
        ['function', (capture) => builder.add_function(capture)]
      ]);
    `;

    const definitions = /* ... */;
    const collections = definitions.get_function_collections();

    expect(collections.size).toBe(1);
    const config = Array.from(collections.values())[0];
    expect(config.collection_type).toBe('Map');
    expect(config.stored_functions).toHaveLength(2);
  });

  test('detects object literal handlers', () => {
    const code = `
      const HANDLERS = {
        process: (data) => validate(data),
        transform: (data) => normalize(data)
      };
    `;

    const collections = /* ... */;
    expect(collections.size).toBe(1);
    const handlers = Array.from(collections.values())[0];
    expect(handlers.collection_type).toBe('Object');
    expect(handlers.stored_functions).toHaveLength(2);
  });

  test('detects dispatch call pattern', () => {
    const code = `
      const CONFIG = new Map([
        ['class', (capture) => process(capture)]
      ]);

      function handle_capture(type: string, capture: any) {
        const handler = CONFIG.get(type);
        handler(capture);  // ← Dispatch call
      }
    `;

    const dispatch_calls = detect_collection_dispatch_calls(/* ... */);
    expect(dispatch_calls).toHaveLength(1);
    expect(dispatch_calls[0].candidate_functions).toHaveLength(1);
  });
});

// packages/core/src/trace_call_graph/collection_dispatch_edges.test.ts

describe('Call graph with collection dispatch', () => {
  test('creates edges to all collection functions', () => {
    const code = `
      const CONFIG = new Map([
        ['class', (capture) => add_class(capture)],
        ['function', (capture) => add_function(capture)]
      ]);

      function process(type: string, capture: any) {
        const handler = CONFIG.get(type);
        handler(capture);
      }

      function add_class(c: any) { }
      function add_function(f: any) { }
    `;

    const call_graph = detect_call_graph(code, 'test.ts');

    const process_node = call_graph.nodes.get('process');
    expect(process_node.callees.size).toBe(2);  // Both handlers

    // Check multi-candidate metadata
    const multi_candidate = call_graph.multi_candidate_calls.find(
      mc => mc.dispatch_type === 'collection'
    );
    expect(multi_candidate).toBeDefined();
    expect(multi_candidate.total_candidates).toBe(2);
  });

  test('marks all candidates as possible, not certain', () => {
    const code = `/* same as above */`;

    const candidates = resolve_collection_dispatch_candidates(/* ... */);
    expect(candidates.every(c => c.confidence === 'possible')).toBe(true);
  });

  test('handlers no longer appear as entry points', () => {
    const code = `/* same as above */`;

    const call_graph = detect_call_graph(code, 'test.ts');

    // add_class and add_function called via collection dispatch
    const add_class_id = /* ... */;
    const add_function_id = /* ... */;

    expect(call_graph.entry_points).not.toContain(add_class_id);
    expect(call_graph.entry_points).not.toContain(add_function_id);
  });
});
```

## Success Criteria

- [ ] Collections containing functions identified and indexed
- [ ] Collection dispatch calls detected (Map.get → call pattern)
- [ ] Multi-candidate resolution returns all stored functions
- [ ] Call graph edges created to all candidates
- [ ] Handlers in config maps no longer appear as entry points
- [ ] Multi-candidate calls tracked with metadata (dispatch type, confidence)
- [ ] Architecture consistent with interface method resolution (task-epic-11.158)
- [ ] Test coverage ≥90% (data flow analysis is complex, some patterns may be missed)

## Expected Impact

**Before**:

- Entry points: ~150 total (~30 anonymous + ~120 non-anonymous)
  - Includes ~20-30 config map handlers

**After**:

- Entry points: ~120-130 total (~5-10 anonymous + ~115-120 non-anonymous)
- Reduction: 20-30 config map handlers correctly attributed

**Final reduction from baseline (task-epic-11.156 complete)**:

- Started with: 350 entry points (228 anonymous + 122 non-anonymous)
- After all sub-tasks: ~120-130 entry points
- **Total reduction: ~220-230 entry points (65% reduction)**

## Design Decisions

### Why Multi-Candidate Resolution Instead of Filtering?

**Alternative considered**: Just mark `is_config_handler: true` and filter from entry points

**User feedback**: "I still think we need to trace the object... and determine that it is at least invoked somewhere"

**Chosen approach**: Full multi-candidate resolution

- Creates actual call edges (captures invocation)
- Enables analysis ("CONFIG contains 20 handlers, all potentially invoked from process_captures")
- Consistent with interface method resolution architecture
- More information, better call graph

### Why "possible" Confidence Instead of "certain"?

**Difference from interface calls**:

- **Interface call**: ALL implementations are valid targets (polymorphism)
- **Collection dispatch**: Only ONE will execute (selection based on key)

**Confidence levels**:

- Interface candidates: `certain` (any could execute)
- Collection candidates: `possible` (only one will execute, unknown which)

**Example**:

```typescript
interface_var.method(); // ALL implementations are certain targets
CONFIG.get(type)(); // ONE handler is certain, others are possible
```

This distinction helps with analysis and understanding call patterns.

### Why Not Solve with Full Data Flow Analysis?

**Alternative considered**: Track variable assignments and aliasing across scopes

**Rejected because**:

- **Complex**: Requires SSA form, variable aliasing, inter-procedural analysis
- **Error-prone**: Many edge cases (closures, async, mutability)
- **Expensive**: Significant performance cost
- **Diminishing returns**: Most patterns are localized (assignment + call in same scope)

**Chosen approach**: Pattern-based heuristic

- Detect common patterns (assignment from collection + call in same scope)
- Simple and fast
- Covers 80% of real-world cases
- Extensible (can add more patterns as needed)

### Generalization to Other Dynamic Dispatch

This architecture also handles:

- **Strategy pattern**: Object storing multiple implementations
- **Command pattern**: Queue of function objects
- **Event handlers**: Event → handler mapping

**Future extensions**:

- Property access dispatch: `obj[dynamicKey]()`
- Conditional dispatch: `if (condition) fn1() else fn2()`
- Indirect calls: `const f = getFn(); f()`

All can use the same `ResolutionCandidate` architecture.

## Related Tasks

- **task-epic-11.158**: Interface method resolution (defines multi-candidate architecture)
- **task-epic-11.156.1**: Scope attribution (must work for calls in handlers)
- **task-epic-11.156.2**: Callback invocation (similar detection patterns)
- **task-155**: Type flow inference (helps with collection element types)

## Out of Scope

- **Inter-procedural data flow**: Collections passed across functions
- **Mutable collections**: Handlers added/removed after initialization
- **Computed keys**: `CONFIG.get(computeKey())` where key is dynamic
- **Nested dispatch**: Collections containing collections
- **Confidence scoring**: Ranking candidates by likelihood (all marked 'possible')

These can be addressed in follow-up tasks if needed.

## Implementation Strategy

Given the complexity of data flow analysis, we recommend a **phased rollout**:

**Phase 1 (MVP)**: Pattern-based detection for same-scope access + call

- Covers ~60-70% of cases
- Low complexity, high value
- Fast to implement and test

**Phase 2 (Enhancement)**: Cross-scope variable tracking (function parameters)

```typescript
function process(handler_map: Map<string, Function>, type: string) {
  const handler = handler_map.get(type); // ← Cross-scope
  handler();
}
```

**Phase 3 (Advanced)**: Full data flow analysis

- Only if needed for remaining cases
- High cost, evaluate ROI first

## Migration Path

This is a **non-breaking addition**:

- Adds new collection tracking to semantic index
- Adds new multi-candidate resolution (doesn't affect existing resolution)
- Extends CallGraph types (backward compatible)
- No changes to existing call resolution logic

**Integration with task-epic-11.158**:

- Share `ResolutionCandidate` type
- Share multi-candidate edge creation logic
- Unified `multi_candidate_calls` tracking in CallGraph
- Consistent confidence scoring approach
