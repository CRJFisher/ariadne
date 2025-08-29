# Architecture Issues Analysis

Based on audit against PROCESSING_PIPELINE.md dependency model.

## 1. Import Extraction Duplication

**Issue**: Multiple modules are extracting imports independently

**Found in:**

- `scope_analysis/symbol_resolution/` - Has `extract_imports()` functions
- `import_export/import_resolution/` - Should be the canonical place

**Impact**:

- Duplicate code maintenance
- Potential inconsistencies in import handling
- Violates single responsibility principle

**Resolution**:

- `symbol_resolution` should consume data from `import_resolution`
- Remove `extract_imports` from `symbol_resolution`
- Make `import_resolution` the single source of truth

## 2. Missing Layer Dependencies

**Issue**: Type tracking doesn't depend on required lower layers

**Current state:**

- `type_analysis/type_tracking/` has TODOs for integration but no actual imports from:
  - `import_export/import_resolution/` (Layer 2)
  - Type registry (Layer 4 - doesn't exist yet)
  - Class hierarchy (Layer 4 - doesn't exist yet)

**Impact**:

- Cannot track types across module boundaries
- Cannot resolve inherited types
- Limited to local file analysis only

**Resolution**:

- Wire up dependencies according to pipeline
- Create missing type registry module
- Create class hierarchy module

## 3. Module Graph Underutilization

**Issue**: `import_export/module_graph/` exists but isn't widely used

**Current state:**

- Module graph is built but not consumed by higher layers
- Call analysis modules don't use it for cross-module resolution

**Impact**:

- Cannot track cross-file dependencies properly
- Call chains break at module boundaries

**Resolution**:

- Method calls should use module graph
- Type tracking should use module graph
- Constructor calls should use module graph for imported classes

## 4. Scope Analysis Integration

**Issue**: Scope trees not fully integrated with type tracking

**Current state:**

- `scope_analysis/scope_tree/` builds scope hierarchy
- Type tracking has TODO for scope integration but doesn't use it

**Impact**:

- Variable shadowing not handled correctly
- Block scope vs function scope differences lost
- Cannot track variable lifetime properly

**Resolution**:

- Type tracking must consume scope tree
- Use scope chains for variable resolution
- Respect scope boundaries for type flow

## 5. Missing Type Registry

**Issue**: No central type registry (Layer 4)

**Current state:**

- Each module tracks types independently
- No central place to register class/interface definitions
- No way to look up type definitions across modules

**Impact**:

- Cannot resolve type references
- Cannot build inheritance chains
- Type checking is incomplete

**Resolution**:

- Create `type_analysis/type_registry/` module
- Should consume exports from Layer 2
- Should provide type lookup for Layer 5

## 6. Missing Class Hierarchy

**Issue**: No class hierarchy tracking (Layer 4)

**Current state:**

- No inheritance chain tracking
- No method resolution order
- No virtual method tables

**Impact**:

- Cannot resolve inherited methods
- Cannot track overridden methods
- Polymorphic calls not resolved

**Resolution**:

- Create `type_analysis/class_hierarchy/` module
- Should consume type registry
- Should provide inheritance info to call analysis

## 7. Constructor Calls Position

**Issue**: Constructor calls correctly positioned but missing dependencies

**Current state:**

- `call_graph/constructor_calls/` is in Layer 6 (correct)
- But doesn't use type tracking from Layer 5
- Doesn't update type maps when constructors are called

**Impact**:

- Type flow breaks at constructor calls
- Cannot track object types through construction

**Resolution**:

- Constructor calls should report to type tracking
- Type tracking should consume constructor call info
- Bidirectional data flow needed (event-based?)

## 8. Language-Specific Logic Scattered

**Issue**: Language-specific code mixed with common logic

**Current state:**

- Each module has `.javascript.ts`, `.python.ts`, etc. files
- Common patterns duplicated across language files
- No clear language abstraction layer

**Impact**:

- Duplicate logic across language files
- Hard to add new language support
- Inconsistent handling across languages

**Resolution**:

- Extract common patterns to base module
- Language files should only have language-specific AST patterns
- Use language configuration pattern more consistently

## Summary Priority Order

1. **High Priority - Breaking Issues**
   - Create type registry (Layer 4)
   - Create class hierarchy (Layer 4)
   - Remove import extraction from symbol_resolution
2. **Medium Priority - Integration Issues**
   - Wire type tracking to use imports
   - Wire type tracking to use scopes
   - Wire call analysis to use module graph
3. **Low Priority - Optimization**
   - Consolidate language-specific patterns
   - Add event-based updates between layers
   - Cache layer results for performance

## 9. Missing Class Detection Module

**Issue**: Referenced in Architecture.md but doesn't exist

**Expected location**: `/inheritance/class_detection/`

**Impact**:
- Cannot identify class definitions in per-file phase
- Class hierarchy has no input data
- Type registry has incomplete information

**Resolution**:
- Create class_detection module immediately
- Should run in per-file phase
- Output class definitions for global assembly

## 10. No Generic Type Support

**Issue**: No modules handle generic/template types

**Missing functionality**:
- Generic type parameter extraction
- Generic type resolution with concrete types
- Generic constraint checking

**Impact**:
- Cannot analyze generic code properly
- Type tracking fails for generic instances
- Call resolution breaks for generic methods

**Resolution**:
- Add generic type parameter extraction to class_detection
- Create generic_type_resolution module
- Track generic instantiations in type registry

## 11. No Async Flow Analysis

**Issue**: Async/await and Promise chains not tracked

**Missing functionality**:
- Async call detection
- Promise chain tracking
- Async execution flow analysis

**Impact**:
- Call chains break at async boundaries
- Cannot trace async execution paths
- Missing important control flow information

**Resolution**:
- Add async_call_detection module
- Extend call_chain_analysis for async flows
- Track Promise types in type_tracking

## 12. No Variable Declaration Analysis

**Issue**: Variables are tracked but not their declarations

**Missing functionality**:
- Variable declaration extraction
- Initial type assignment tracking
- Declaration scope binding

**Impact**:
- Cannot distinguish declaration from reassignment
- Type tracking starts from unknown state
- Scope analysis incomplete

**Resolution**:
- Add variable_declaration module in scope_analysis
- Link declarations to scope tree
- Feed declaration types to type_tracking

## Next Steps

### Immediate Priority (Breaking Issues):
1. Create `/inheritance/class_detection` module (referenced but missing!)
2. Create `/type_analysis/type_registry` module
3. Remove duplicate import extraction from symbol_resolution
4. Wire type_tracking to use import_resolution

### Medium Priority (Integration Issues):
1. Wire method_calls to use type_tracking
2. Wire method_calls to use class_hierarchy  
3. Wire constructor_calls to update type_tracking
4. Wire call analysis to use module_graph

### Missing Functionality (New Modules):
1. Add variable_declaration_analysis
2. Add generic_type_resolution
3. Add async_flow_analysis
4. Add closure_analysis
5. Add decorator/annotation processing

### Testing & Validation:
1. Add integration tests for cross-layer data flow
2. Add contract tests for layer interfaces
3. Add language-specific test coverage
4. Add performance benchmarks for two-phase processing
