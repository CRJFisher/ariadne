# Type Simplification Plan for Tree-sitter Query System

## Investigation Summary

After analyzing the current type system across all AST modules, I've identified significant opportunities for simplification and improvement.

## Key Problems Identified

### 1. Redundant Type Definitions
- **Call Types**: `FunctionCallInfo`, `MethodCallInfo`, `ConstructorCallInfo` share 80% of their fields
- **Import/Export Duality**: `ImportInfo` vs `ImportStatement`, `ExportInfo` vs `ExportStatement`
- **Similar patterns** repeated across modules without reuse

### 2. Inconsistent Patterns
- **Naming**: Mix of `Info`, `Statement`, `Node`, `Definition` suffixes
- **Resolution**: Each module has its own way of representing resolved/unresolved references
- **Confidence**: Different confidence scales across modules

### 3. Type Complexity Issues
- **Too many optional fields**: Makes it unclear what's actually required
- **Deep nesting**: Optional objects containing optional fields
- **Missing discriminated unions**: Using optional fields instead of proper union types

### 4. Missing Base Types
- **No common query result type**: Each module returns different shapes
- **Location repetition**: Every type includes `location: Location` directly
- **No standard metadata pattern**: Each type handles metadata differently

## Proposed Simplifications

### Core Base Types

```typescript
// Base for all AST-derived data
interface ASTNode {
  readonly location: Location;
  readonly language: Language;
}

// Standard query result wrapper
interface QueryResult<T> {
  readonly data: T;
  readonly captures: QueryCapture[];
  readonly metadata: QueryMetadata;
}

// Unified resolution pattern
interface Resolution<T> {
  readonly resolved: T | undefined;
  readonly confidence: "high" | "medium" | "low";
  readonly reason?: string;
}
```

### Unified Call System

```typescript
// Single call type with discriminated union
type CallInfo = {
  readonly location: Location;
  readonly caller: string;
  readonly arguments_count: number;
} & (
  | { kind: "function"; target: string }
  | { kind: "method"; receiver: string; method: string }
  | { kind: "constructor"; class_name: string }
);
```

### Simplified Import/Export

```typescript
// Single import type for all stages
interface Import {
  readonly kind: "named" | "default" | "namespace" | "side-effect";
  readonly source: string;
  readonly location: Location;
  readonly symbols?: string[]; // Only for named/namespace
  readonly alias?: string;      // For renaming
}
```

## CRITICAL UPDATE: String Type Safety Crisis

**⚠️ See `task-epic-11.100.0.5-string-types-analysis.md` for critical findings**

After deeper analysis, discovered **100+ raw string types** that completely undermine type safety. This is MORE CRITICAL than the original issues and must be addressed FIRST.

## Recommended Subtask Structure

Based on the analysis, I recommend organizing subtasks by **concern** rather than by module. This approach will:
1. Address cross-cutting issues systematically
2. Ensure consistency across all modules
3. Reduce redundant work
4. Enable parallel development

### Updated Subtasks (Prioritized)

#### 🚨 HIGH PRIORITY - String Type Safety (NEW)

#### Task 11.100.0.5.9: Create Branded Type Infrastructure
- Define ALL missing branded types
- Create type guard functions for each
- Implement validator functions
- **Status**: CRITICAL - blocks everything else
- **Affects**: Every single module

#### Task 11.100.0.5.10: Implement Compound Type Builders/Parsers
- Build/parse functions for QualifiedName
- Build/parse functions for SymbolId
- Build/parse functions for ScopePath
- Other compound type handlers
- **Status**: CRITICAL - needed by all modules
- **Depends on**: Task 9

#### Task 11.100.0.5.11: Migrate Call Graph to Branded Types
- Replace all raw strings in call types
- **Depends on**: Tasks 9, 10

#### Task 11.100.0.5.12: Migrate Import/Export to Branded Types
- Replace module paths with ModulePath
- Use proper SymbolName types
- **Depends on**: Tasks 9, 10

#### Task 11.100.0.5.13: Migrate Type System to Branded Types
- Replace type strings with TypeString
- Use TypeConstraint for constraints
- **Depends on**: Tasks 9, 10

#### Original Tasks (Now depend on Task 9)

#### Task 11.100.0.5.1: Design Core Base Types
- Define base interfaces (ASTNode, QueryResult, Resolution)
- Create standard metadata patterns
- Design error handling types
- **Depends on**: Task 9 (Branded Types)
- **Affects**: All 19 modules

#### Task 11.100.0.5.2: Unify Call Graph Types
- Merge FunctionCallInfo, MethodCallInfo, ConstructorCallInfo
- Create discriminated union for call types
- Standardize call resolution types
- **Affects**: function_calls, method_calls, constructor_calls, call_chain_analysis

#### Task 11.100.0.5.3: Simplify Scope & Symbol Types
- Unify symbol representation across modules
- Standardize scope hierarchy types
- Create consistent symbol resolution types
- **Affects**: scope_tree, symbol_resolution, usage_finder, definition_finder

#### Task 11.100.0.5.4: Consolidate Import/Export Types
- Merge ImportInfo/ImportStatement, ExportInfo/ExportStatement
- Create single import/export representation
- Standardize module graph types
- **Affects**: import_resolution, export_detection, namespace_resolution, module_graph

#### Task 11.100.0.5.5: Streamline Type Analysis Types
- Unify type tracking representations
- Standardize inference result types
- Create consistent type propagation types
- **Affects**: type_tracking, return_type_inference, parameter_type_inference, type_propagation, generic_resolution

#### Task 11.100.0.5.6: Refactor Inheritance Types
- Simplify class detection types
- Standardize hierarchy representation
- Unify interface/trait handling
- **Affects**: class_detection, class_hierarchy, method_override, interface_implementation

#### Task 11.100.0.5.7: Create Query Integration Types
- Design TypedQueryCapture
- Create QueryProcessor interfaces
- Define language configuration types
- **Affects**: All modules using tree-sitter queries

#### Task 11.100.0.5.8: Implement Type Validation
- Create comprehensive type guards
- Add runtime validation
- Ensure tsc --strict compliance
- **Affects**: All type definitions

## Benefits of This Approach

### Immediate Benefits
1. **Reduced complexity**: Fewer types to understand and maintain
2. **Better type safety**: Discriminated unions instead of optional fields
3. **Consistency**: Same patterns across all modules
4. **Smaller bundle**: Less duplicated type definitions

### Long-term Benefits
1. **Easier refactoring**: Changes to base types automatically propagate
2. **Better documentation**: Clearer type relationships
3. **Improved DX**: Simpler types are easier to work with
4. **Future-proof**: Extensible base types support new features

## Implementation Strategy

### Phase 0: String Type Safety (CRITICAL - NEW)
- **Task 9**: Branded type infrastructure (1 day)
- **Task 10**: Compound type builders (1 day)
- **Tasks 11-13**: Migrate to branded types (parallel, 2 days)

### Phase 1: Design (Tasks 1-2)
- Create base type definitions
- Get consensus on patterns
- Document decisions
- **Now depends on Phase 0 completion**

### Phase 2: Module Types (Tasks 3-6)
- Update module-specific types
- Can be done in parallel
- Maintain backwards compatibility initially

### Phase 3: Integration (Tasks 7-8)
- Create query-specific types
- Add validation layer
- Remove deprecated types

## Success Metrics

1. **Type count reduction**: Target 40% fewer type definitions
2. **Optional field reduction**: Target 60% fewer optional fields
3. **Type guard coverage**: 100% of public types have guards
4. **tsc --strict**: Zero errors with strict mode
5. **Documentation**: All types have JSDoc comments

## Next Steps (UPDATED PRIORITY)

1. ✅ Review and approve this plan
2. ✅ Created 13 subtasks in the backlog (8 original + 5 for string type safety)
3. **🚨 START WITH Task 9** (Branded Type Infrastructure) - BLOCKS EVERYTHING
4. **Then Task 10** (Compound Type Builders) - needed by all
5. **Parallel Tasks 11-13** (Migrate to branded types)
6. **Then Task 1** (Core Base Types) using branded types
7. **Parallel Tasks 2-6** (Module-specific improvements)
8. **Finally Tasks 7-8** (Integration and validation)

**CRITICAL**: Do NOT start any other tasks until Task 9 is complete!

## Time Estimate (UPDATED)

### Phase 0: String Type Safety (NEW - CRITICAL)
- Task 9: 1 day (branded type infrastructure)
- Task 10: 1 day (compound type builders)
- Tasks 11-13: 2 days (parallel migration)
- **Phase 0 Total: 3-4 days**

### Original Phases
- Task 1: 1 day (foundational, needs careful design)
- Tasks 2-6: 1 day each (can parallelize, 2-3 days total)
- Task 7: 1 day (integration)
- Task 8: 1 day (validation and cleanup)

**New Total: 8-10 days** (but prevents massive tech debt and future bugs)
**Original estimate: 5-6 days** (without string type safety)

The additional 3-4 days is CRITICAL investment that will:
- Prevent countless runtime bugs
- Enable proper type checking
- Make the codebase maintainable
- Save weeks of debugging later