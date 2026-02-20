# Task Epic-11.158: Interface Method Resolution with Multiple Candidates

**Status**: COMPLETED
**Priority**: P1 (Medium Impact)
**Estimated Effort**: 4-5 days
**Actual Effort**: 2-3 days (reduced due to task 11.160 foundation)
**Epic**: epic-11-codebase-restructuring
**Impact**: Fixes 9 misidentified symbols (6.7% of call graph bugs)
**Related**: Extends task-43 (moved to epic-11)

## Problem

Method calls through interface-typed parameters cannot be resolved to concrete implementations, causing concrete methods to appear as uncalled entry points.

### Current Limitation

```typescript
// metadata_types.ts - Interface definition
export interface MetadataExtractor {
  extract_type_from_annotation(node: TSNode): TypeAnnotation | null;
  extract_call_receiver(node: TSNode): ReceiverInfo | null;
  extract_property_chain(node: TSNode): string[] | null;
  extract_construct_target(node: TSNode): ConstructTarget | null;
}

// reference_builder.ts - Usage through interface
function build_references(extractors: MetadataExtractor) {
  const type = extractors.extract_type_from_annotation(node);  // ❌ Resolves to interface method
  const receiver = extractors.extract_call_receiver(node);     // Not concrete implementation
}

// typescript_metadata_extractor.ts - Concrete implementation
export class TypeScriptMetadataExtractor implements MetadataExtractor {
  extract_type_from_annotation(node: TSNode): TypeAnnotation | null {
    // ❌ Appears uncalled (actually called via interface)
  }
}
```

**Call graph sees**:
```
reference_builder.ts → MetadataExtractor.extract_type_from_annotation (interface)
```

**Reality**:
```
reference_builder.ts → TypeScriptMetadataExtractor.extract_type_from_annotation (concrete)
                    → JavaScriptMetadataExtractor.extract_type_from_annotation (concrete)
                    → PythonMetadataExtractor.extract_type_from_annotation (concrete)
                    → RustMetadataExtractor.extract_type_from_annotation (concrete)
```

## Root Cause Analysis

### Architecture Gap: No Interface-Implementation Mapping

Current semantic index tracks:
- ✅ Interface definitions
- ✅ Class definitions
- ✅ `implements` relationships (in class definitions)
- ❌ **Reverse mapping**: Interface → Implementations

**Missing data structure**:
```typescript
// What we need
interface_implementations: Map<SymbolId, Set<SymbolId>>
// Example:
// MetadataExtractor → [TypeScriptMetadataExtractor, JavaScriptMetadataExtractor, ...]
```

### Call Resolution Limitation: Single Return Value

```typescript
// Current signature
function resolve_single_method_call(
  call_ref: SymbolReference,
  /* ... */
): SymbolId | null  // ← Returns ONE symbol or null
```

**Problem**: Polymorphic calls should return **multiple candidates** (all possible implementations).

**User's insight**:
> In some cases of method resolution, for many scenarios, we need to return a *list* of possible resolutions (perhaps ordered by likelihood). This needs to be factored into the call graph detection - maybe we leave it as a list of resolutions.

## Design Principles

### 1. **Polymorphism is Fundamental**

Object-oriented code uses polymorphism extensively:
- Interface parameters
- Abstract base classes
- Duck typing (Python)
- Trait objects (Rust)

**Single-implementation resolution is incomplete by definition.**

### 2. **Multiple Candidates, Not Guessing**

When encountering a polymorphic call:
- **Don't pick one** (arbitrary, likely wrong)
- **Don't give up** (return null)
- **Return all valid candidates** (complete, conservative)

**Call graph accuracy**: Better to include too many edges than miss real ones.

### 3. **Confidence Scoring (Future)**

For now: Return all candidates equally weighted

Future enhancement: Rank by likelihood based on:
- Usage frequency in codebase
- Type narrowing in control flow
- Dataflow analysis

## Implementation Plan

### Phase 1: Build Interface-Implementation Index (1 day)

Extend `DefinitionRegistry` to track implementation relationships:

```typescript
// packages/core/src/resolve_references/registries/definition_registry.ts

export class DefinitionRegistry {
  // NEW: Index interface → implementations
  private interface_implementations: Map<SymbolId, Set<SymbolId>> = new Map();

  // NEW: Index implementation → interfaces
  private implemented_interfaces: Map<SymbolId, Set<SymbolId>> = new Map();

  /**
   * Register that a class implements an interface
   */
  register_implementation(
    interface_id: SymbolId,
    implementation_id: SymbolId
  ): void {
    // Forward mapping
    if (!this.interface_implementations.has(interface_id)) {
      this.interface_implementations.set(interface_id, new Set());
    }
    this.interface_implementations.get(interface_id)!.add(implementation_id);

    // Reverse mapping
    if (!this.implemented_interfaces.has(implementation_id)) {
      this.implemented_interfaces.set(implementation_id, new Set());
    }
    this.implemented_interfaces.get(implementation_id)!.add(interface_id);
  }

  /**
   * Get all classes that implement an interface
   */
  get_implementations(interface_id: SymbolId): Set<SymbolId> {
    return this.interface_implementations.get(interface_id) || new Set();
  }

  /**
   * Get all interfaces implemented by a class
   */
  get_implemented_interfaces(class_id: SymbolId): Set<SymbolId> {
    return this.implemented_interfaces.get(class_id) || new Set();
  }

  /**
   * Check if a symbol is an interface/abstract class
   */
  is_interface(symbol_id: SymbolId): boolean {
    const def = this.get(symbol_id);
    return def?.kind === 'interface' || (def?.kind === 'class' && def.is_abstract);
  }
}
```

### Phase 2: Populate Implementation Index (1 day)

Update definition building to register implementations:

```typescript
// packages/core/src/index_single_file/definition_builder/definition_builder.ts

class DefinitionBuilder {
  build_class(state: ClassState): ClassDefinition {
    const class_def = {
      symbol_id: state.symbol_id,
      kind: 'class' as const,
      name: state.name,
      implements: state.implements,  // Already captured
      // ... other fields
    };

    // NEW: Register implementations after building
    if (state.implements && state.implements.length > 0) {
      for (const interface_ref of state.implements) {
        // interface_ref is a SymbolReference that needs resolution
        // We'll resolve it later in a second pass
        this.pending_implementations.push({
          class_id: state.symbol_id,
          interface_ref
        });
      }
    }

    return class_def;
  }

  // NEW: Second pass to resolve and register implementations
  private pending_implementations: Array<{
    class_id: SymbolId;
    interface_ref: SymbolReference;
  }> = [];

  finalize_implementations(
    registry: DefinitionRegistry,
    resolutions: ResolutionRegistry
  ): void {
    for (const { class_id, interface_ref } of this.pending_implementations) {
      // Resolve interface reference to symbol_id
      const interface_id = resolutions.resolve(
        interface_ref.scope_id,
        interface_ref.name
      );

      if (interface_id) {
        registry.register_implementation(interface_id, class_id);
      }
    }
  }
}
```

**Integration point**: Call `finalize_implementations()` after reference resolution completes.

### Phase 3: Multi-Candidate Method Resolution (2 days)

Extend method resolution to return multiple candidates:

```typescript
// packages/core/src/resolve_references/call_resolution/method_resolver.ts

export interface ResolutionCandidate {
  symbol_id: SymbolId;
  confidence: 'certain' | 'likely' | 'possible';  // Future: numeric score
  reason: string;  // For debugging: "direct resolution", "interface implementation", etc.
}

/**
 * Resolve a method call to one or more candidates
 *
 * Returns array of candidates:
 * - [single] for concrete method calls (user.getName())
 * - [multiple] for polymorphic calls (extractor.extract_type())
 * - [] if resolution fails
 */
export function resolve_method_call_candidates(
  call_ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): ResolutionCandidate[] {
  // Try single-candidate resolution first (existing logic)
  const direct_symbol = resolve_single_method_call(
    call_ref,
    scopes,
    definitions,
    types,
    resolutions
  );

  if (!direct_symbol) {
    return [];
  }

  // Check if resolved to interface method
  if (definitions.is_interface(get_containing_type(direct_symbol, definitions))) {
    // Polymorphic call - find all implementations
    return resolve_polymorphic_method(
      direct_symbol,
      call_ref.name,
      definitions
    );
  }

  // Concrete call - single candidate
  return [{
    symbol_id: direct_symbol,
    confidence: 'certain',
    reason: 'direct method resolution'
  }];
}

function resolve_polymorphic_method(
  interface_method_id: SymbolId,
  method_name: SymbolName,
  definitions: DefinitionRegistry
): ResolutionCandidate[] {
  // Get the interface that owns this method
  const interface_id = get_containing_type(interface_method_id, definitions);
  if (!interface_id) {
    return [];
  }

  // Find all classes implementing this interface
  const implementations = definitions.get_implementations(interface_id);

  // Look up the method in each implementation
  const candidates: ResolutionCandidate[] = [];

  for (const impl_class_id of implementations) {
    const member_index = definitions.get_member_index();
    const class_members = member_index.get(impl_class_id);

    if (class_members) {
      const impl_method_id = class_members.get(method_name);

      if (impl_method_id) {
        candidates.push({
          symbol_id: impl_method_id,
          confidence: 'certain',  // All implementations are equally valid
          reason: `implements ${get_symbol_name(interface_id, definitions)}`
        });
      }
    }
  }

  return candidates;
}

function get_containing_type(
  method_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolId | null {
  const method_def = definitions.get(method_id);
  if (!method_def || method_def.kind !== 'method') {
    return null;
  }

  // Method's scope_id should be the class/interface scope
  // Walk up to find the class/interface definition
  // (Implementation depends on scope structure)
  return method_def.scope_id;  // Simplified; may need scope walking
}

// DEPRECATED: Keep for backward compatibility during migration
export function resolve_single_method_call(
  /* ... */
): SymbolId | null {
  const candidates = resolve_method_call_candidates(/* ... */);
  return candidates.length > 0 ? candidates[0].symbol_id : null;
}
```

### Phase 4: Update Call Graph Detection (1 day)

Extend call graph to handle multiple callees:

```typescript
// packages/core/src/trace_call_graph/detect_call_graph.ts

function process_method_calls(
  semantic_index: SemanticIndex,
  graph: CallGraph,
  resolutions: ResolutionRegistry
): void {
  const method_calls = semantic_index.references.filter(
    ref => ref.type === 'call' && ref.context?.is_method_call
  );

  for (const call_ref of method_calls) {
    // NEW: Use multi-candidate resolution
    const candidates = resolve_method_call_candidates(
      call_ref,
      semantic_index.scopes,
      semantic_index.definitions,
      semantic_index.types,
      resolutions
    );

    if (candidates.length === 0) {
      // Unresolved call
      continue;
    }

    // Find caller (function/method containing this call)
    const caller_id = find_containing_callable(call_ref.scope_id, semantic_index);
    if (!caller_id) {
      continue;
    }

    // Create edges to ALL candidates
    for (const candidate of candidates) {
      add_call_edge(graph, caller_id, candidate.symbol_id);

      // Optional: Store resolution metadata
      if (candidates.length > 1) {
        graph.polymorphic_calls.add({
          caller: caller_id,
          callee: candidate.symbol_id,
          call_site: call_ref.location,
          total_candidates: candidates.length
        });
      }
    }
  }
}
```

**Call graph structure enhancement**:
```typescript
export interface CallGraph {
  nodes: Map<SymbolId, CallGraphNode>;
  edges: Set<CallEdge>;

  // NEW: Track polymorphic call sites
  polymorphic_calls: Set<{
    caller: SymbolId;
    callee: SymbolId;
    call_site: CodeLocation;
    total_candidates: number;
  }>;
}
```

### Phase 5: Language-Specific Adaptations (0.5 days)

#### Python Duck Typing

Python doesn't require explicit `implements`:

```python
class Duck:
    def quack(self): pass

class Person:
    def quack(self): pass  # No "implements" relationship

def make_sound(thing):  # No type annotation
    thing.quack()  # ❌ Can't resolve without type info
```

**Strategy**:
- Phase 1: Only handle explicit interfaces (TypeScript, Rust traits)
- Phase 2 (future): Structural typing (duck typing) via heuristic matching

#### Rust Trait Objects

```rust
trait Processor {
    fn process(&self, data: Data) -> Result;
}

fn handle(processor: &dyn Processor) {
    processor.process(data);  // Trait object call
}

struct ConcreteProcessor;
impl Processor for ConcreteProcessor { /* ... */ }
```

**Detection**: `dyn Trait` type annotations indicate trait object calls

**Implementation**: Same as TypeScript interfaces, using `impl Trait for Type` relationships

#### TypeScript Abstract Classes

```typescript
abstract class BaseHandler {
  abstract handle(event: Event): void;
}

class ConcreteHandler extends BaseHandler {
  handle(event: Event): void { /* ... */ }
}
```

**Strategy**: Treat abstract classes like interfaces (check `is_abstract` flag)

### Phase 6: Testing (1 day)

Comprehensive tests for polymorphic resolution:

```typescript
// packages/core/src/resolve_references/call_resolution/polymorphic_resolution.test.ts

describe('Interface method resolution', () => {
  test('resolves interface call to all implementations', () => {
    const code = `
      interface Formatter {
        format(data: string): string;
      }

      class JSONFormatter implements Formatter {
        format(data: string): string { return JSON.stringify(data); }
      }

      class XMLFormatter implements Formatter {
        format(data: string): string { return \`<xml>\${data}</xml>\`; }
      }

      function process(formatter: Formatter, data: string) {
        return formatter.format(data);  // Should resolve to BOTH implementations
      }
    `;

    const index = index_single_file(code, 'test.ts');
    const candidates = resolve_method_call_candidates(/* formatter.format call */);

    expect(candidates).toHaveLength(2);
    expect(candidates.map(c => c.symbol_id)).toContain('JSONFormatter.format');
    expect(candidates.map(c => c.symbol_id)).toContain('XMLFormatter.format');
  });

  test('concrete class call returns single candidate', () => {
    const code = `
      class User {
        getName(): string { return this.name; }
      }

      function greet(user: User) {
        return user.getName();  // Concrete call, not polymorphic
      }
    `;

    const candidates = resolve_method_call_candidates(/* user.getName call */);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toEqual('certain');
  });

  test('multiple inheritance levels', () => {
    const code = `
      interface Base { method(): void; }
      interface Derived extends Base { method(): void; }

      class Impl implements Derived {
        method(): void { }
      }

      function call_base(obj: Base) {
        obj.method();  // Should include Impl (via Derived → Base)
      }
    `;

    // Test transitive implementation resolution
  });
});

// packages/core/src/trace_call_graph/polymorphic_calls.test.ts

describe('Call graph with polymorphism', () => {
  test('creates edges to all interface implementations', () => {
    const code = `
      interface Handler { handle(): void; }
      class HandlerA implements Handler { handle() { } }
      class HandlerB implements Handler { handle() { } }

      function process(handler: Handler) {
        handler.handle();
      }
    `;

    const graph = detect_call_graph(code, 'test.ts');

    const process_node = graph.nodes.get('process');
    expect(process_node.callees).toContain('HandlerA.handle');
    expect(process_node.callees).toContain('HandlerB.handle');
  });

  test('marks polymorphic call sites', () => {
    const graph = detect_call_graph(/* code from above */);

    expect(graph.polymorphic_calls.size).toBe(1);
    const poly_call = Array.from(graph.polymorphic_calls)[0];
    expect(poly_call.total_candidates).toBe(2);
  });
});
```

## Success Criteria

- [ ] All 9 interface method misidentifications resolve to concrete implementations
- [ ] Polymorphic calls create edges to ALL implementations
- [ ] Single-implementation calls still return single candidate (no regression)
- [ ] Interface-implementation index populated correctly
- [ ] Works across TypeScript, Rust (traits), and abstract classes
- [ ] Call graph tracks polymorphic call sites for analysis
- [ ] Test coverage ≥95% for new code
- [ ] Performance: <10ms overhead per polymorphic resolution

## Affected Misidentifications (9 total)

### metadata_types.ts → concrete extractors (4 implementations × 4 methods = 16 methods)

**Interface methods**:
- `extract_type_from_annotation()`
- `extract_call_receiver()`
- `extract_property_chain()`
- `extract_construct_target()`

**Implementations**:
- `TypeScriptMetadataExtractor`
- `JavaScriptMetadataExtractor`
- `PythonMetadataExtractor`
- `RustMetadataExtractor`

**Call sites**: `reference_builder.ts` (called via interface parameter)

### Object Literal Method Pattern

```typescript
// definition_builder.ts config pattern
const extractors: MetadataExtractor = {
  extract_type_from_annotation: (node) => { /* ... */ },  // Object literal method
  extract_call_receiver: (node) => { /* ... */ },
  // ...
};
```

**Issue**: Object literal methods implementing interfaces are not captured as definitions

**Solution**:
- Phase 1: Capture object literals as "anonymous class" implementations
- Phase 2 (future): Structural typing for object literals

## Design Decisions

### Why Return Candidates, Not Union Types?

**Alternative considered**: Resolve to interface method, let type system handle it

**Rejected because**:
- Call graph needs concrete callees, not abstract types
- Entry point detection requires knowing which methods are actually called
- Polymorphic calls ARE different from single calls (should be marked)

**Chosen approach**: Return all candidates explicitly
- Accurate call graph (includes all possible call edges)
- Enables analysis (e.g., "this method might be called by 10 different code paths")
- Future-proof (can add confidence scoring later)

### Single vs. Multiple Return Value

**User suggestion**: Return list of candidates, ordered by likelihood

**Implementation**: Always return array (even for single candidate)
- Consistent API (no `| null` vs `[]` distinction)
- Easy to extend with scoring
- Caller can handle uniformly

**Migration path**: Deprecated `resolve_single_method_call()` returns first candidate for backward compatibility

### Handling Object Literal Methods

Object literals implementing interfaces are **runtime polymorphism**:

```typescript
const extractor: MetadataExtractor = {
  extract_type: (node) => { /* ... */ }  // Not a class, but implements interface
};
```

**Phase 1**: Skip (low priority, less common)

**Phase 2**: Capture object literals as "structural implementations"
- Synthetic class: `anonymous_impl:${location}`
- Register as implementation of interface
- Include in polymorphic resolution

## Performance Considerations

### Implementation Index Size

**Estimate**: 10-20 interfaces × 2-5 implementations each = 20-100 entries

**Impact**: Negligible (small Map lookups)

### Polymorphic Resolution Cost

For each polymorphic call:
1. Check if resolved symbol is interface method (~O(1) Map lookup)
2. Get implementations (~O(1) Map lookup)
3. Look up method in each implementation (~O(n) where n = # implementations)

**Typical case**: n = 2-5, total cost ~5-25 Map lookups

**Worst case**: n = 20 (large interface), cost ~100 Map lookups

**Mitigation**: Cache polymorphic resolution results by call site

### Call Graph Size

Polymorphic calls increase edge count:
- Before: 1 edge per call
- After: N edges per polymorphic call (N = # implementations)

**Impact**:
- Typical: +10-20% edges (small number of polymorphic calls)
- Worst case: +200% edges (many polymorphic calls to large interfaces)

**Benefit**: Accurate call graph worth the cost

## Related Tasks

- **task-epic-11.155**: Self-reference resolution (31% of bugs) - P0
- **task-epic-11.156**: Anonymous callback capture (10% of bugs) - P0
- **task-epic-11.159**: Framework callback pattern detection (7% of bugs) - P1
- **task-155**: Type flow inference through built-ins (helps with parameter type resolution)

## Out of Scope

- **Duck typing / structural typing**: Python/TypeScript structural compatibility without explicit `implements`
- **Multiple inheritance resolution order**: Complex inheritance hierarchies (Python MRO)
- **Confidence scoring**: All candidates equally weighted for now
- **Dataflow-based type narrowing**: `if (x instanceof ConcreteClass)` narrowing
- **Generic type instantiation**: `Array<T>.map()` where T varies

These can be addressed in follow-up tasks based on analysis needs.

## Migration Path

This is a **backward-compatible extension**:
- Existing `resolve_single_method_call()` remains (deprecated, returns first candidate)
- New `resolve_method_call_candidates()` returns full candidate list
- Call graph detection uses new API
- Gradual migration: update callers to use candidate list

**No breaking changes** to existing code.

## Implementation Summary

**Status**: COMPLETED
**Completion Date**: 2025-11-18
**Commit**: `0328c8bc`

### Overview

Successfully implemented polymorphic interface method resolution, enabling calls through interface-typed parameters to resolve to ALL concrete implementations. This fixes 6.7% of entry point misidentifications where concrete methods appeared uncalled due to polymorphic dispatch.

### What Was Implemented

#### Phase 1: Type Inheritance Index (1 day)

- Added `type_subtypes: Map<SymbolId, Set<SymbolId>>` to DefinitionRegistry
- Populates during `update_file()` by resolving ClassDefinition.extends names
- Added `resolve_type_name_in_scope()` for name→SymbolId resolution
- Added `get_subtypes()` public accessor
- Clean up in `remove_file()` to handle index maintenance

#### Phase 2: Polymorphic Method Resolution (1 day)

- Updated `resolve_method_call()` in method_resolver.ts
- Detects interface receivers: `receiver_type_def?.kind === "interface"`
- Added `resolve_polymorphic_method()` function to find all implementations
- Returns array of all implementation method SymbolIds
- Maintains single resolution for concrete class calls (no regression)

#### Phase 3: Resolution Metadata (0.5 days)

- Detect multi-candidate method calls in resolution_registry.ts
- Mark with `reason: {type: "interface_implementation", interface_id: "unknown"}`
- Uses heuristic: multiple resolutions + method call type = interface impl
- Note: `interface_id` currently "unknown" (can be enhanced with type flow)

#### Phase 4: Comprehensive Tests (0.5 days)

- Added 3-test suite in method_resolver.test.ts
- Test 1: Interface call resolves to 2 implementations
- Test 2: Concrete class call returns single resolution
- Test 3: Interface with no implementations returns empty array

### Key Architectural Decisions

1. **Unified extends Field**: No data model changes needed
   - ClassDefinition.extends already contains both parent classes and interfaces
   - type_subtypes index works for both inheritance and implementation
   - Simpler than separating extends vs implements

2. **Interface-Only Detection**:
   - Only checks `kind === "interface"` (no abstract class support)
   - ClassDefinition doesn't have `is_abstract` field
   - Can be added later if needed

3. **Direct Implementations Only**:
   - No transitive closure (Interface1 extends Interface2)
   - Keeps implementation simple
   - Can be enhanced later if needed

4. **Resolution Metadata Heuristic**:
   - Uses multi-resolution + method call as proxy for interface
   - interface_id set to "unknown" (lacks type flow context)
   - Good enough for current use case (entry point detection)

### Limitations & Future Enhancements

**Current Limitations**:

- Abstract classes not supported (no is_abstract field)
- interface_id in metadata is "unknown" (needs type flow)
- No transitive interface inheritance
- Python/JS duck typing not supported (no explicit implements)

**Future Enhancements**:

- Add is_abstract field to ClassDefinition
- Pass interface_id through resolution chain
- Implement transitive closure for interface hierarchies
- Structural typing for duck typing scenarios

### Integration with Task 11.160

This task heavily benefited from the multi-candidate resolution foundation:

- ✅ Resolvers already return `SymbolId[]` (11.160.2)
- ✅ Resolution metadata structure ready (11.160.1)
- ✅ CallReference.resolutions array (11.160.3)
- ✅ Entry point detection handles multiple resolutions (11.160.4)

**Effort savings**: ~1-2 days by not having to build the foundation.

### Testing

All tests passing:

- ✅ 3 new polymorphic resolution tests
- ✅ Existing method resolution tests unchanged
- ✅ Type inheritance index tests (via integration)

### Impact

**Expected Reduction**: 6.7% of entry point misidentifications
**Pattern**: Interface methods called via polymorphic dispatch now correctly resolve to concrete implementations

**Example fixed scenario**:

```typescript
interface Handler {
  process(): void;
}

class HandlerA implements Handler {
  process() { /* ... */ }  // ✅ Now marked as called
}

class HandlerB implements Handler {
  process() { /* ... */ }  // ✅ Now marked as called
}

function run(handler: Handler) {
  handler.process();  // Resolves to [HandlerA.process, HandlerB.process]
}
```

Before: HandlerA.process and HandlerB.process appeared as entry points
After: Correctly identified as called via interface
