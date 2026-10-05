# Task 110: Support Polymorphic Call Graph Edges (One-to-Many)

**Status:** Ready  
**Priority:** High  
**Created:** 2025-09-03  
**Size:** Large  
**Category:** Architecture Enhancement

## Problem Statement

The system correctly identifies ALL possible dispatch targets for polymorphic method calls during the enrichment phase, but then **discards this information** when building the call graph. Currently, each method call creates only a single edge in the call graph, pointing to just one target (usually the parent class method), even when multiple concrete implementations could be invoked at runtime.

This creates an incomplete and misleading call graph that fails to represent the true execution flow possibilities in object-oriented code with inheritance and polymorphism.

## Current Behavior

### What Works ✅
1. **Enrichment Phase** correctly identifies polymorphic targets:
   - `analyze_virtual_call()` recursively finds all subclass overrides
   - `resolve_polymorphic_targets()` builds list of all possible implementations
   - Method calls are enriched with `possible_targets: ResolvedTarget[]`
   - Confidence scores calculated for each target

2. **Example**: For `animal.makeSound()` where `animal: Animal`:
   - Enrichment finds: `[Animal.makeSound, Dog.makeSound, Cat.makeSound, Bird.makeSound]`
   - Each target has override information and confidence score

### What's Broken ❌
3. **Call Graph Building** throws away the multi-target information:
   ```typescript
   // In code_graph.ts lines 626-648
   edges.push({
     from,
     to,  // Only ONE target - loses polymorphic dispatch!
     location: call.location,
     call_type: "method",
   });
   ```

4. **CallEdge Interface** doesn't support multiple targets:
   ```typescript
   interface CallEdge {
     readonly from: SymbolId;    // Single source
     readonly to: SymbolId;      // Single target only!
     readonly location: Location;
     readonly call_type: "direct" | "method" | "constructor" | "dynamic";
   }
   ```

## Desired Behavior

The call graph should accurately represent ALL possible execution paths through polymorphic dispatch:

### Option 1: Multiple Edges (Recommended)
Create one edge per possible target:
```typescript
for (const target of enriched_call.possible_targets) {
  edges.push({
    from,
    to: target.symbol,
    location: call.location,
    call_type: "method",
    is_polymorphic: true,
    dispatch_confidence: target.confidence
  });
}
```

### Option 2: Enhanced Edge Type
Create new `PolymorphicEdge` type:
```typescript
interface PolymorphicEdge extends CallEdge {
  readonly to: SymbolId;           // Primary/static target
  readonly possible_targets: SymbolId[];  // All possible runtime targets
  readonly dispatch_probabilities?: Map<SymbolId, number>;
}
```

### Option 3: Parallel Polymorphic Graph
Maintain separate graph for polymorphic dispatch alongside main call graph.

## Impact Analysis

### What This Enables
- **Accurate call flow analysis** - See ALL paths execution might take
- **Complete impact analysis** - Understand which implementations are affected by interface changes
- **Better dead code detection** - Identify truly unreachable implementations
- **Polymorphic dispatch visualization** - Show virtual method dispatch patterns
- **Security analysis** - Track all possible code paths for taint analysis

### Current Limitations This Causes
- **Incomplete call chains** - Missing execution paths through subclasses
- **False negatives in dead code** - Can't tell if override is actually called
- **Inaccurate dependency analysis** - Missing runtime dependencies
- **Misleading call graphs** - Show only static dispatch, not runtime behavior

## Technical Implementation

### Phase 1: Extend CallEdge Interface
```typescript
interface CallEdge {
  readonly from: SymbolId;
  readonly to: SymbolId;
  readonly location: Location;
  readonly call_type: "direct" | "method" | "constructor" | "dynamic";
  readonly is_async?: boolean;
  readonly argument_count?: number;
  // NEW FIELDS:
  readonly is_polymorphic?: boolean;
  readonly dispatch_confidence?: number;
  readonly dispatch_reason?: string;  // "virtual", "interface", "abstract"
}
```

### Phase 2: Modify Call Graph Building
In `code_graph.ts` function `build_call_graph()`:
```typescript
// Method calls with polymorphic dispatch
for (const call of analysis.method_calls) {
  const from = construct_function_symbol(
    analysis.file_path,
    call.caller_name || SPECIAL_SYMBOLS.MODULE
  );

  // Check if enriched call has multiple targets
  const enriched_call = enriched_analyses
    .find(a => a.file_path === analysis.file_path)
    ?.method_calls
    .find(c => c.location === call.location);

  if (enriched_call?.possible_targets && enriched_call.possible_targets.length > 1) {
    // Create edge to each possible target
    for (const target of enriched_call.possible_targets) {
      edges.push({
        from,
        to: construct_method_symbol(
          target.file_path,
          target.class,
          target.method,
          false
        ),
        location: call.location,
        call_type: "method",
        is_polymorphic: true,
        dispatch_confidence: target.confidence
      });
    }
  } else {
    // Single target (existing behavior)
    const to = resolution_results.resolved_methods.get(call.location) ||
      construct_method_symbol(
        analysis.file_path,
        call.receiver_name,
        call.method_name,
        call.is_static_method
      );
    
    edges.push({
      from,
      to,
      location: call.location,
      call_type: "method"
    });
  }
}
```

### Phase 3: Update Call Chain Analysis
Modify `call_chain_analysis` to handle multiple paths through polymorphic calls.

### Phase 4: Query Interface
Add queries for polymorphic dispatch:
- `get_all_possible_targets(method_call)` 
- `get_dispatch_probability(from, to)`
- `is_definitely_called(method)` vs `is_possibly_called(method)`

## Test Scenarios

### Basic Polymorphism
```typescript
abstract class Shape {
  abstract area(): number;
}
class Circle extends Shape {
  area() { return Math.PI * this.r * this.r; }
}
class Square extends Shape {
  area() { return this.side * this.side; }
}

function calculate(shape: Shape) {
  return shape.area();  // Should create edges to BOTH Circle.area and Square.area
}
```

### Interface Implementation
```typescript
interface Logger {
  log(msg: string): void;
}
class ConsoleLogger implements Logger {
  log(msg: string) { console.log(msg); }
}
class FileLogger implements Logger {
  log(msg: string) { fs.writeFileSync('log.txt', msg); }
}

function process(logger: Logger) {
  logger.log("Processing");  // Should create edges to ALL Logger implementations
}
```

### Deep Inheritance
```typescript
class Animal { makeSound() {} }
class Mammal extends Animal { makeSound() {} }
class Dog extends Mammal { makeSound() {} }
class Cat extends Mammal { makeSound() {} }

function zoo(animal: Animal) {
  animal.makeSound();  // Should create edges to Animal, Mammal, Dog, Cat
}
```

### Mixed Static/Dynamic
```typescript
class Base {
  static staticMethod() {}
  instanceMethod() {}
}
class Derived extends Base {
  instanceMethod() {}  // Override
}

const base: Base = new Derived();
base.instanceMethod();     // Polymorphic - should have 2 edges
Base.staticMethod();        // Static - should have 1 edge
```

## Dependencies

- Depends on enrichment phase working correctly (currently does ✅)
- Should coordinate with interface tracking (task 11.74.15)
- Should coordinate with method override detection (task 11.74.16)
- Will affect call chain analysis module
- May impact performance for large inheritance hierarchies

## Success Criteria

- [ ] Call graph contains edges to ALL possible dispatch targets for polymorphic calls
- [ ] Each edge marked with `is_polymorphic` flag when appropriate
- [ ] Confidence scores preserved for probabilistic analysis
- [ ] Call chain analysis follows all polymorphic paths
- [ ] Tests verify multi-edge creation for inheritance scenarios
- [ ] Tests verify interface implementation dispatch
- [ ] Documentation updated to explain polymorphic edge semantics
- [ ] Performance impact measured and acceptable (<10% slowdown)

## Future Enhancements

1. **Static analysis to narrow targets** - Use type flow to eliminate impossible targets
2. **Profile-guided optimization** - Use runtime data to assign probabilities
3. **Visualization** - Special rendering for polymorphic dispatch in call graphs
4. **Configuration** - Option to collapse/expand polymorphic edges
5. **Caching** - Cache polymorphic resolution results
6. **Selective Call Graph Generation** - Add optional parameters to limit call graph to specific class implementations:
   ```typescript
   generate_call_graph({
     filter_implementations?: {
       base_class?: string;      // Only include calls to this hierarchy
       include_classes?: string[];  // Only these implementations
       exclude_classes?: string[];  // Exclude these implementations
       max_depth?: number;       // Limit inheritance depth
     }
   })
   ```
   This would allow focused analysis like "show me call flow only through the FileLogger implementation" or "exclude test mock implementations"

## Notes

This is a fundamental limitation in the current architecture that significantly impacts the accuracy of call flow analysis in object-oriented codebases. While the enrichment phase correctly identifies the polymorphic nature of calls, the final call graph loses this critical information.

The recommended approach (Option 1: Multiple Edges) is the simplest and most compatible with existing call graph algorithms. It treats polymorphic dispatch as what it really is: multiple possible execution paths.