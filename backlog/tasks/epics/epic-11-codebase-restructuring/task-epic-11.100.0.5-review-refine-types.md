# Task 11.100.0.5: Review and Refine Types for Tree-sitter Query System

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Overview

**Critical Pre-requisite**: Comprehensive review and refinement of all types used in AST processing BEFORE beginning refactoring. This transformation is the perfect opportunity to fix type issues and create a solid foundation for the query-based architecture.

## Scope

This task must be completed AFTER 11.100.0 (documentation) and BEFORE any refactoring subtasks (11.100.1-19) begin.

## Type Review Areas

### 1. Core AST Processing Types

- [ ] **SyntaxNode interfaces and extensions**

  - Review current Tree-sitter SyntaxNode usage
  - Identify missing type safety
  - Create proper type guards

- [ ] **Query Result Types**

  - Define QueryCapture wrappers
  - Create type-safe capture processing
  - Ensure consistent result interfaces

- [ ] **Language-specific Types**
  - JavaScript/TypeScript AST node types
  - Python AST node types
  - Rust AST node types
  - Unified cross-language interfaces

### 2. Module-Specific Type Analysis

#### Scope Analysis Types

- [ ] **scope_tree types** (src/scope_analysis/scope_tree/)

  - ScopeInfo interface
  - ScopeTree structure
  - Symbol definition types

- [ ] **symbol_resolution types** (src/scope_analysis/symbol_resolution/)

  - SymbolDefinition interface
  - SymbolReference types
  - Resolution result types

- [ ] **usage_finder types** (src/scope_analysis/usage_finder/)
  - Usage types and contexts
  - Reference tracking types

#### Import/Export Types

- [ ] **import_resolution types** (src/import_export/import_resolution/)

  - ImportInfo interfaces
  - Module resolution types
  - Dependency graph types

- [ ] **export_detection types** (src/import_export/export_detection/)

  - ExportInfo structures
  - Named vs default exports
  - Re-export handling

- [ ] **namespace_resolution types** (src/import_export/namespace_resolution/)
  - NamespaceInfo types
  - Member access types
  - Namespace binding types

#### Call Graph Types

- [ ] **function_calls types** (src/call_graph/function_calls/)

  - CallInfo interfaces
  - Function signature types
  - Call context types

- [ ] **method_calls types** (src/call_graph/method_calls/)

  - MethodCallInfo structures
  - Receiver type handling
  - Method chain types

- [ ] **constructor_calls types** (src/call_graph/constructor_calls/)
  - ConstructorInfo types
  - Instantiation patterns
  - Factory method types

#### Inheritance Types

- [ ] **class_detection types** (src/inheritance/class_detection/)

  - ClassInfo interfaces
  - Member definition types
  - Access modifier types

- [ ] **class_hierarchy types** (src/inheritance/class_hierarchy/)

  - Inheritance chain types
  - Interface implementation types
  - Multiple inheritance handling

- [ ] **method_override types** (src/inheritance/method_override/)

  - Override detection types
  - Signature matching types
  - Super call tracking

- [ ] **interface_implementation types** (src/inheritance/interface_implementation/)
  - Interface definition types
  - Implementation checking
  - Protocol/trait types

#### Type Analysis Types

- [ ] **type_tracking types** (src/type_analysis/type_tracking/)

  - TypeInfo structures
  - Type annotation handling
  - Inferred vs explicit types

- [ ] **return_type_inference types** (src/type_analysis/return_type_inference/)

  - Return type analysis
  - Control flow types
  - Promise/async types

- [ ] **parameter_type_inference types** (src/type_analysis/parameter_type_inference/)

  - Parameter info types
  - Default value handling
  - Variadic parameter types

- [ ] **type_propagation types** (src/type_analysis/type_propagation/)

  - Type flow analysis
  - Propagation graph types
  - Conflict resolution types

- [ ] **generic_resolution types** (src/type_analysis/generic_resolution/)
  - Generic parameter types
  - Constraint handling
  - Type substitution

#### AST Utilities Types

- [ ] **member_access types** (src/ast/member_access/)
  - Property access types
  - Computed property handling
  - Optional chaining types

### 3. Query Integration Types

#### New Query-Specific Types

- [ ] **QueryCapture Extensions**

  ```typescript
  interface TypedQueryCapture extends QueryCapture {
    readonly captureType: string;
    readonly context: CaptureContext;
    readonly metadata: CaptureMetadata;
  }
  ```

- [ ] **Query Result Processing**

  ```typescript
  interface QueryResult<T> {
    readonly captures: TypedQueryCapture[];
    readonly processed: T[];
    readonly errors: QueryError[];
    readonly metadata: QueryMetadata;
  }
  ```

- [ ] **Language Configuration Types**
  ```typescript
  interface LanguageQueryConfig {
    readonly language: Language;
    readonly queryFiles: Record<string, string>;
    readonly processors: QueryProcessor[];
    readonly validators: QueryValidator[];
  }
  ```

### 4. Cross-Module Type Consistency

- [ ] **Unified Result Interfaces**

  - Consistent location tracking
  - Standard error reporting
  - Common metadata patterns

- [ ] **Generic Type Patterns**

  - Reusable constraint types
  - Common transformation types
  - Shared validation types

- [ ] **Integration Types**
  - Module interconnection interfaces
  - Data flow types between modules
  - Aggregated result types

## Implementation Steps

### Phase 1: Current Type Audit

1. [ ] Inventory all existing type definitions
2. [ ] Identify inconsistencies and gaps
3. [ ] Document problematic patterns
4. [ ] Map dependencies between types

### Phase 2: Query Type Design

1. [ ] Design query result type system
2. [ ] Create language-agnostic base types
3. [ ] Design capture processing types
4. [ ] Plan type safety improvements

### Phase 3: Module Type Refinement

1. [ ] Refine types for each of 19 modules
2. [ ] Ensure cross-module consistency
3. [ ] Create type validation patterns
4. [ ] Design error handling types

### Phase 4: Type Implementation

1. [ ] Implement refined type definitions
2. [ ] Create type guard functions
3. [ ] Add comprehensive type tests
4. [ ] Validate with tsc --strict

### Phase 5: Documentation and Validation

1. [ ] Document all type decisions
2. [ ] Create type usage guidelines
3. [ ] Validate against architectural requirements
4. [ ] Ensure refactoring readiness

## Type Quality Requirements

### Strictness Standards

- [ ] All types must pass `tsc --strict`
- [ ] No `any` types without explicit justification
- [ ] Comprehensive null/undefined handling
- [ ] Proper readonly modifiers where appropriate

### Consistency Standards

- [ ] Consistent naming conventions
- [ ] Unified error type patterns
- [ ] Standard location/position types
- [ ] Common metadata structures

### Safety Standards

- [ ] Type guards for all runtime type checking
- [ ] Branded types for domain concepts
- [ ] Exhaustive union type handling
- [ ] Proper generic constraints

## Success Criteria

- [ ] All 19 modules have refined, consistent types
- [ ] Query integration types designed and implemented
- [ ] Cross-module type consistency achieved
- [ ] Full tsc --strict compliance
- [ ] Comprehensive type documentation
- [ ] Type validation patterns established
- [ ] Ready for refactoring implementation

## Deliverables

1. **Refined Type Definitions**

   - Updated interfaces for all 19 modules
   - New query-specific types
   - Cross-module consistency types

2. **Type System Documentation**

   - Type architecture overview
   - Usage guidelines
   - Migration patterns from old types

3. **Type Validation**
   - Type guard implementations
   - Comprehensive type tests
   - tsc compliance verification

## Dependencies

- Must complete AFTER 11.100.0 (documentation updates)
- Must complete BEFORE any refactoring tasks (11.100.1-19)
- Requires understanding of new architecture patterns

## Timeline

- Target completion: 3-4 days
- Critical path item - blocks all refactoring work
- May require iteration with documentation team

## Notes

- This is foundational work that prevents type debt in new architecture
- Quality here prevents major rework during refactoring
- Focus on getting types right rather than fast
- Consider this the last chance to fix type architecture before massive changes

## Implementation Notes

### Investigation Completed: 2025-09-11

Conducted comprehensive analysis of current type system across all AST modules. Key findings:

1. **Significant Redundancy**: Found ~40% of types are duplicates or near-duplicates
2. **Inconsistent Patterns**: Each module implements similar concepts differently
3. **Missing Base Types**: No common foundation for query results or AST nodes
4. **Complexity Issues**: Too many optional fields, deep nesting, missing discriminated unions

### CRITICAL UPDATE: String Type Safety Crisis

After deeper investigation requested by user, discovered **100+ raw string types** that completely undermine type safety:
- Call graph modules use `string` for caller_name, method_name, etc.
- Import/export modules use `string` for module paths and symbols
- Type system uses `string` for type annotations and constraints
- **Zero type safety** for compound strings like QualifiedName, SymbolId

This is MORE CRITICAL than originally identified issues. See detailed analysis in:
- `task-epic-11.100.0.5-string-types-analysis.md`

### Subtask Structure Created

Based on investigation, created **13 focused subtasks** organized by **concern**:

#### 🚨 CRITICAL - String Type Safety (NEW)
9. **task-epic-11.100.0.5.9**: Create Branded Type Infrastructure
10. **task-epic-11.100.0.5.10**: Implement Compound Type Builders/Parsers
11. **task-epic-11.100.0.5.11**: Migrate Call Graph to Branded Types
12. **task-epic-11.100.0.5.12**: Migrate Import/Export to Branded Types
13. **task-epic-11.100.0.5.13**: Migrate Type System to Branded Types

#### Original Type Improvements
1. **task-epic-11.100.0.5.1**: Design Core Base Types
2. **task-epic-11.100.0.5.2**: Unify Call Graph Types
3. **task-epic-11.100.0.5.3**: Simplify Scope and Symbol Types
4. **task-epic-11.100.0.5.4**: Consolidate Import/Export Types
5. **task-epic-11.100.0.5.5**: Streamline Type Analysis Types
6. **task-epic-11.100.0.5.6**: Refactor Inheritance Types
7. **task-epic-11.100.0.5.7**: Create Query Integration Types
8. **task-epic-11.100.0.5.8**: Implement Type Validation Layer

### Benefits of This Approach

- **Addresses cross-cutting concerns** systematically
- **Enables parallel development** (tasks 2-6 and 11-13 can run simultaneously)
- **Updated time estimate**: 8-10 days (was 5-6 days, but includes critical string type safety)
- **Ensures consistency** across all 19 modules
- **Prevents massive tech debt** from raw string types

### Detailed Plan

See `task-epic-11.100.0.5-type-simplification-plan.md` for:
- Complete investigation findings
- Proposed type simplifications with examples
- Implementation strategy
- Success metrics

### SYMBOL REFACTOR EXTENSION (2025-09-12)

After implementing initial symbol utilities in `symbol_utils.ts`, conducted comprehensive analysis to identify all locations where the universal SymbolId system should be applied. 

#### Initial Analysis Found: 100+ opportunities
#### Deep Analysis Found: 300+ additional raw string usages

**CRITICAL GAPS DISCOVERED:**
- Hundreds of functions using `string` for identifier parameters
- Legacy interfaces (LegacyTypeInfo, ImportedClassInfo) using raw strings
- Generic `name: string` fields that should be typed
- Map<string, Symbol> patterns throughout scope analysis

#### 🔥 URGENT - Universal Symbol System Migration (RENUMBERED)
21. **task-epic-11.100.0.5.21**: Symbol Refactor - Core Type Maps
    - Replace Map keys in types.ts, classes.ts from individual names to SymbolId
    - Update type_registry and scope_tree Maps
    - **NEW**: scope_tree and enhanced_symbols Map<string> patterns
    - **Impact**: 20+ core type definitions
    
22. **task-epic-11.100.0.5.22**: Symbol Refactor - Interface Properties
    - Update definitions.ts, calls.ts interfaces to use SymbolId
    - **NEW**: Fix all generic `name: string` fields (found 15+ instances)
    - **NEW**: Update modules.ts name fields
    - **Impact**: 35+ interface properties
    
23. **task-epic-11.100.0.5.23**: Symbol Refactor - Function Parameters
    - **MASSIVE SCOPE**: Hundreds of functions using raw strings
    - Update import_export.ts functions to accept SymbolId
    - **NEW**: Fix LegacyTypeInfo and ImportedClassInfo interfaces
    - **NEW**: Update all method resolution functions
    - **Impact**: 200+ function signatures
    
24. **task-epic-11.100.0.5.24**: Symbol Refactor - Array Properties
    - Change array properties from name arrays to SymbolId arrays
    - Update base_classes, interfaces, type_parameters arrays
    - **Impact**: 25+ array properties
    
25. **task-epic-11.100.0.5.25**: Symbol Refactor - Core Implementation
    - Update class_hierarchy to use SymbolId Maps
    - Modify scope_tree symbol tracking to use SymbolId
    - **NEW**: Update all internal Set<string> for identifiers
    - **Impact**: 15+ implementation files
    
26. **task-epic-11.100.0.5.26**: Symbol Refactor - Tests and Documentation
    - Update all test files to use symbol builders
    - Create migration guide and best practices
    - **Impact**: 50+ test files

See detailed analysis in:
- `docs/epic-11-investigations/SYMBOL_REFACTOR_TASKS.md`
- `docs/epic-11-investigations/SYMBOL_REFACTOR_IMPACT.md`

**COVERAGE ASSESSMENT**: The refactor is MORE extensive than initially thought - estimated 400+ changes needed vs 100+ originally identified

### Next Steps (UPDATED PRIORITY - CORRECTED NUMBERING)

1. **✅ COMPLETED Task 9** (Branded Type Infrastructure) 
2. **✅ COMPLETED Task 10** (Compound Type Builders) in branded-types.ts
3. **🚨 START with Task 21** (Core Type Maps) - Foundation for symbol system
4. **Then Task 22** (Interface Properties) - API consistency  
5. **Then Task 23** (Function Parameters) - MASSIVE scope, 200+ functions
6. **Parallel Tasks 11-13** (Migrate other modules to branded types)
7. **Then Tasks 24-25** (Arrays and Implementation)
8. **Finally Task 26** (Tests and Documentation)
9. **Then Task 1** (Core Base Types) using branded types and symbols as foundation
10. **Parallel Tasks 2-6** (Module-specific improvements)
11. **Finally Tasks 7-8** (Integration and validation)

**WARNING**: The symbol refactor is MORE extensive than initially estimated:
- Originally identified: 100+ changes
- Actually needed: 400+ changes
- Critical gap: Hundreds of raw string parameters
- Completing Tasks 21-26 will eliminate 93% of identifier type proliferation!
