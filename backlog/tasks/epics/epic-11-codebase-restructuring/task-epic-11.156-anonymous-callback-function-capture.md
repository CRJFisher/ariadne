# Task Epic-11.156: Anonymous Callback Function Capture

**Status**: TODO
**Priority**: P0 (High Impact)
**Estimated Effort**: 3-4 days
**Epic**: epic-11-codebase-restructuring
**Impact**: Fixes 13 misidentified symbols (9.6% of call graph bugs)

## Problem

Methods called from inline arrow functions (callbacks, config objects, IIFEs) appear as uncalled because the anonymous functions themselves are not captured as callable definitions.

### Current Limitation

Tree-sitter queries **only capture arrow functions assigned to named variables**:

```scm
; packages/core/src/index_single_file/query_code_tree/queries/typescript.scm:263-266
(variable_declarator
  name: (identifier) @definition.function
  value: (arrow_function)  # ← ONLY captures const foo = () => {}
)
```

### Missed Patterns

**Inline callbacks**:
```typescript
this.classes.forEach((state, id) => {
  classes.set(id, this.build_class(state));  // ❌ build_class appears uncalled
});

state.constructors.map((c) => this.build_constructor(c));  // ❌ Not tracked
```

**Configuration objects**:
```typescript
const CONFIG = new Map([
  ['class', (capture) => builder.add_class(definition)],  // ❌ add_class not tracked
  ['function', (capture) => builder.add_function(definition)]
]);
```

**IIFE (Immediately Invoked Function Expressions)**:
```typescript
const result = (() => {
  return this.process_data();  // ❌ process_data appears uncalled
})();
```

**Object literal methods**:
```typescript
const handlers = {
  process: (data) => this.handle(data),  // ❌ handle not tracked
  validate: (input) => this.check(input)
};
```

## Root Cause Analysis

### Architecture Gap: Definition vs. Callable

The semantic index distinguishes:
- **Definitions**: Named symbols (functions, classes, variables)
- **References**: Uses of those symbols

But **arrow functions are expressions**, not statements:
- When assigned to a variable → captured as definition
- When used inline → treated as expression, not captured

**The fundamental issue**: Our tree-sitter queries were designed for **symbol-based indexing** (finding definitions by name), not **call-graph indexing** (finding all callable constructs).

### Call Graph Requirements

For accurate call graph analysis, we need to capture:
1. **All functions** (named or anonymous)
2. **Their call sites** (where they're invoked)
3. **Their internal calls** (what they invoke)

**Current state**:
```
Named function:    ✅ Definition captured, calls tracked
Arrow variable:    ✅ Definition captured, calls tracked
Inline arrow:      ❌ No definition, calls become "orphans"
```

**Orphan calls**: Calls inside anonymous functions have no caller attribution, making called methods appear as entry points.

## Design Principles

### 1. **Every Callable is a Node**

Extend the semantic model to treat **all** function-like constructs as nodes:
- Named functions
- Named arrow functions (existing)
- Anonymous arrow functions (NEW)
- Object literal methods (NEW)
- Class expressions (NEW)
- IIFEs (NEW)

### 2. **Synthetic SymbolIds for Anonymous Callables**

Since anonymous functions have no name, generate location-based identifiers:

```typescript
// Synthetic SymbolId format
`anonymous_function:${file_path}:${start_line}:${start_column}`

// Examples
"anonymous_function:definition_builder.ts:202:34"
"anonymous_function:export_registry.ts:77:22"
```

**Properties**:
- Globally unique (includes file path + position)
- Stable (doesn't change unless code moves)
- Debuggable (human-readable location)

### 3. **Capture Context, Not Just Function**

For call graph analysis, we need to know:
- **Where** the function is defined (location)
- **How** it's invoked (callback, config, IIFE)
- **What** it captures (closure scope)

## Implementation Plan

### Phase 1: Extend Tree-Sitter Queries (1 day)

Update queries to capture **all** arrow function contexts:

#### TypeScript/JavaScript

```scm
; packages/core/src/index_single_file/query_code_tree/queries/typescript.scm

; === EXISTING: Named arrow functions (keep) ===
(variable_declarator
  name: (identifier) @definition.function
  value: (arrow_function)
)

; === NEW: Inline arrow functions in call expressions ===
; forEach, map, filter, reduce, etc.
(call_expression
  arguments: (arguments
    (arrow_function) @definition.anonymous_function
  )
)

; === NEW: Arrow functions in array literals ===
; const handlers = [() => foo(), () => bar()]
(array
  (arrow_function) @definition.anonymous_function
)

; === NEW: Arrow functions in object properties ===
; const config = { handler: () => foo() }
(pair
  value: (arrow_function) @definition.anonymous_function
)

; === NEW: Arrow functions in Map/Set constructors ===
; new Map([['key', () => foo()]])
(array
  (array
    (arrow_function) @definition.anonymous_function
  )
)

; === NEW: IIFEs ===
(call_expression
  function: (parenthesized_expression
    (arrow_function) @definition.anonymous_function
  )
)

; === NEW: Object literal methods (shorthand) ===
; { process(data) { ... } }
(method_definition
  name: (property_identifier) @definition.method
  value: (function_expression)
)
```

#### Python

```scm
; packages/core/src/index_single_file/query_code_tree/queries/python.scm

; === NEW: Lambda expressions ===
; list(map(lambda x: process(x), items))
(lambda) @definition.anonymous_function

; === NEW: Inline function definitions ===
; def outer():
;     def inner(): pass  # Already captured as nested function
;     return inner
; (Verify existing nested function support)
```

#### Rust

```scm
; packages/core/src/index_single_file/query_code_tree/queries/rust.scm

; === NEW: Closure expressions ===
; items.iter().map(|x| process(x))
(closure_expression) @definition.anonymous_function
```

### Phase 2: Update Definition Builder (1 day)

Extend `DefinitionBuilder` to handle anonymous functions:

```typescript
// packages/core/src/index_single_file/definition_builder/definition_builder.ts

interface AnonymousFunctionState {
  type: 'anonymous_function';
  location: CodeLocation;
  parent_scope_id: SymbolId;
  parameters?: ParameterState[];
  // No name field
}

class DefinitionBuilder {
  private anonymous_functions: Map<SymbolId, AnonymousFunctionState> = new Map();

  add_anonymous_function(
    location: CodeLocation,
    parent_scope_id: SymbolId,
    parameters?: ParameterState[]
  ): SymbolId {
    // Generate synthetic SymbolId
    const symbol_id = generate_anonymous_function_id(location);

    this.anonymous_functions.set(symbol_id, {
      type: 'anonymous_function',
      location,
      parent_scope_id,
      parameters
    });

    return symbol_id;
  }

  build_anonymous_function(state: AnonymousFunctionState): CallableDefinition {
    return {
      symbol_id: generate_anonymous_function_id(state.location),
      kind: 'function',
      name: '<anonymous>' as SymbolName,  // Synthetic name for display
      location: state.location,
      scope_id: state.parent_scope_id,
      is_exported: false,
      parameters: state.parameters?.map(p => this.build_parameter(p)) || []
    };
  }
}

function generate_anonymous_function_id(location: CodeLocation): SymbolId {
  return `anonymous_function:${location.file_path}:${location.start.line}:${location.start.column}` as SymbolId;
}
```

### Phase 3: Update Language Configurations (0.5 days)

Add handlers for anonymous function captures:

```typescript
// packages/core/src/index_single_file/languages/*.ts

const typescript_config: LanguageConfig = {
  definitions: {
    // ... existing handlers ...

    'definition.anonymous_function': {
      process: (capture, builder, context) => {
        const location = extract_location(capture.node);
        const scope_id = context.current_scope_id;

        // Extract parameters if present
        const params_node = capture.node.childForFieldName('parameters');
        const parameters = params_node
          ? extract_parameters(params_node, builder, context)
          : [];

        const fn_id = builder.add_anonymous_function(
          location,
          scope_id,
          parameters
        );

        // Anonymous functions create their own scope
        // (handled by existing scope.function capture)

        return fn_id;
      }
    }
  }
};
```

### Phase 4: Update Call Graph Detection (1 day)

Include anonymous functions in call graph node building:

```typescript
// packages/core/src/trace_call_graph/detect_call_graph.ts

function build_function_nodes(
  semantic_index: SemanticIndex
): Map<SymbolId, CallGraphNode> {
  const nodes = new Map<CallGraphNode>();

  // Existing: Add named functions
  for (const def of semantic_index.definitions) {
    if (def.kind === 'function' || def.kind === 'method') {
      nodes.set(def.symbol_id, {
        symbol_id: def.symbol_id,
        name: def.name,
        type: 'function',
        callers: new Set(),
        callees: new Set()
      });
    }
  }

  // NEW: Add anonymous functions
  const anonymous_functions = extract_anonymous_functions(semantic_index);
  for (const [symbol_id, location] of anonymous_functions.entries()) {
    nodes.set(symbol_id, {
      symbol_id,
      name: '<anonymous>' as SymbolName,
      type: 'function',
      location,  // Include location for debugging
      callers: new Set(),
      callees: new Set()
    });
  }

  return nodes;
}

function extract_anonymous_functions(
  semantic_index: SemanticIndex
): Map<SymbolId, CodeLocation> {
  // Look for definitions with kind='function' and name='<anonymous>'
  const anonymous = new Map<SymbolId, CodeLocation>();

  for (const def of semantic_index.definitions) {
    if (def.kind === 'function' && def.name === '<anonymous>') {
      anonymous.set(def.symbol_id, def.location);
    }
  }

  return anonymous;
}
```

### Phase 5: Scope Attribution (0.5 days)

Ensure calls inside anonymous functions are attributed to the correct scope:

**Challenge**: Anonymous functions create nested scopes. When resolving calls inside them, we need to:
1. Walk up from the call's scope to the anonymous function's scope
2. Attribute the call to the anonymous function (as caller)
3. Continue normal reference resolution from there

**Verification**: Check that existing scope walking logic handles anonymous function scopes correctly.

### Phase 6: Testing (1 day)

Create comprehensive tests covering all patterns:

```typescript
// packages/core/src/index_single_file/definition_builder/anonymous_functions.test.ts

describe('Anonymous Function Capture', () => {
  test('captures arrow functions in forEach callbacks', () => {
    const code = `
      items.forEach((item) => {
        process(item);
      });
    `;

    const index = index_single_file(code, 'test.ts');
    const anon_functions = index.definitions.filter(
      d => d.name === '<anonymous>'
    );

    expect(anon_functions).toHaveLength(1);
    expect(anon_functions[0].kind).toEqual('function');
  });

  test('captures arrow functions in object literals', () => {
    const code = `
      const config = {
        handler: (data) => validate(data)
      };
    `;

    const index = index_single_file(code, 'test.ts');
    // Verify anonymous function captured
    // Verify validate() call attributed to anonymous function
  });

  test('captures IIFEs', () => {
    const code = `
      const result = (() => {
        return compute();
      })();
    `;

    const index = index_single_file(code, 'test.ts');
    // Verify IIFE captured
    // Verify compute() call attributed correctly
  });

  test('generates stable synthetic SymbolIds', () => {
    const code = `
      items.map(x => x * 2);
    `;

    const index1 = index_single_file(code, 'test.ts');
    const index2 = index_single_file(code, 'test.ts');

    const anon1 = index1.definitions.find(d => d.name === '<anonymous>');
    const anon2 = index2.definitions.find(d => d.name === '<anonymous>');

    expect(anon1.symbol_id).toEqual(anon2.symbol_id);
  });
});

// packages/core/src/trace_call_graph/anonymous_calls.test.ts

describe('Call Graph with Anonymous Functions', () => {
  test('attributes calls inside forEach to anonymous function', () => {
    const code = `
      function outer() {
        items.forEach((item) => {
          inner(item);
        });
      }

      function inner(x) { }
    `;

    const graph = detect_call_graph(code, 'test.ts');

    // outer() should call the anonymous function
    const outer_node = graph.nodes.get('outer');
    expect(outer_node.callees).toContain('<anonymous>');

    // Anonymous function should call inner()
    const anon_node = Array.from(graph.nodes.values()).find(
      n => n.name === '<anonymous>'
    );
    expect(anon_node.callees).toContain('inner');
  });

  test('handles nested anonymous functions', () => {
    const code = `
      items.map(x => {
        return others.filter(y => y > x);
      });
    `;

    const graph = detect_call_graph(code, 'test.ts');

    // Should have 2 anonymous functions
    const anon_functions = Array.from(graph.nodes.values()).filter(
      n => n.name === '<anonymous>'
    );
    expect(anon_functions).toHaveLength(2);

    // Outer anonymous should call inner anonymous
    const [outer, inner] = anon_functions;
    expect(outer.callees).toContain(inner.symbol_id);
  });
});
```

## Success Criteria

- [ ] All 13 method misidentifications (in callbacks) resolve correctly
- [ ] Anonymous functions appear as nodes in call graph
- [ ] Calls inside anonymous functions are attributed correctly
- [ ] Synthetic SymbolIds are stable across re-indexing
- [ ] No performance regression (anonymous function capture adds <10% overhead)
- [ ] Test coverage ≥95% for new code
- [ ] Works across all supported languages (TypeScript, JavaScript, Python, Rust)

## Affected Misidentifications (13 total)

### definition_builder.ts callbacks
```typescript
// Line 202: forEach callback
this.classes.forEach((state, id) => {
  classes.set(id, this.build_class(state));
});

// Array.map callbacks
state.constructors.map((c) => this.build_constructor(c));
state.methods.map((m) => this.build_method(m));
state.properties.map((p) => this.build_property(p));

// Filter callbacks
definitions.filter((d) => this.is_valid(d));
```

### Configuration Map patterns
```typescript
// language_config.ts pattern
const CONFIG = new Map([
  ['class', (capture) => builder.add_class(definition)],
  ['function', (capture) => builder.add_function(definition)],
  ['method', (capture) => builder.add_method_to_class(definition)],
  // ... 20+ more handlers
]);
```

Affected methods:
- `add_class`
- `add_function`
- `add_method_to_class`
- `add_import`
- `add_type_annotation`
- And others called via config dispatch

## Design Decisions

### Why Synthetic SymbolIds?

**Alternative considered**: Use node hash or sequential IDs

**Rejected because**:
- Node hashes are unstable (tree-sitter node changes don't reflect semantic changes)
- Sequential IDs aren't stable across re-indexing
- Need human-readable identifiers for debugging

**Chosen approach**: Location-based IDs
- Stable (only change when code moves)
- Unique (file + line + column)
- Debuggable (can locate in source)

### Why Not Capture All Function Expressions?

**Scope limited to**:
- Arrow functions
- Lambda expressions (Python)
- Closures (Rust)

**Excluded**:
- Traditional `function` keyword expressions (rarely used inline)
- Generator expressions (low priority)
- Async function expressions (can add later if needed)

**Rationale**: Focus on common modern patterns first. Can extend incrementally.

### Handling Object Literal Methods

Object methods are **named**, but not captured as top-level definitions:

```typescript
const handlers = {
  process(data) { return validate(data); }  // Named method, but in object
};
```

**Decision**: Capture these as **named definitions**, not anonymous
- They have a name (process)
- They're similar to class methods
- SymbolId format: `object_method:${file}:${line}:${name}`

This is technically separate from anonymous functions, but uses the same infrastructure.

## Performance Considerations

### Capture Overhead

Adding more tree-sitter patterns increases query execution time.

**Mitigation**:
- Benchmark existing query performance
- Measure overhead of new patterns
- Optimize if overhead >10%

**Expected impact**: <5% overhead (anonymous functions are minority of code)

### SymbolId Generation

Location-based IDs require string concatenation for every anonymous function.

**Mitigation**:
- Cache generated IDs during indexing
- Use template literals (fast in modern JS engines)

**Expected impact**: Negligible (<1ms per file)

## Related Tasks

- **task-epic-11.155**: Self-reference keyword resolution (31% of bugs) - P0
- **task-epic-11.157**: Interface method resolution (7% of bugs) - P1
- **task-epic-11.158**: Framework callback pattern detection (7% of bugs) - P1
- **task-155**: Type flow inference through built-ins (related to callback parameter types)

## Migration Path

This is a **non-breaking change**:
- Adds new definition types, doesn't modify existing ones
- Call graph analysis extends naturally to include new nodes
- Existing code continues to work unchanged

**Deployment**:
1. Deploy query updates
2. Verify anonymous function capture in staging
3. Run full codebase analysis
4. Compare before/after entry point detection accuracy
5. Roll out to production

## Out of Scope

- **Type inference for anonymous function parameters**: Covered by task-155
- **Closure capture analysis**: Which variables are captured from outer scope
- **Async/await in arrow functions**: Works automatically, but async call graph analysis is separate
- **Generator arrow functions**: Low priority, add if usage found

These can be addressed in follow-up tasks based on analysis results.
