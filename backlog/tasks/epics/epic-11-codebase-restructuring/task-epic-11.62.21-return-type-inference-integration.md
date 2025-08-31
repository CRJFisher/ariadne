---
id: task-epic-11.62.21
title: Return Type Inference Integration - Complete Type System Alignment
status: In Progress
assignee: []
created_date: "2025-08-31"
labels: [epic-11, sub-task, critical, type-system, return-types]
dependencies: [task-epic-11.62.20]
parent_task_id: task-epic-11.62
priority: CRITICAL
---

# Return Type Inference Integration - Complete Type System Alignment

## Problem Statement

The return type inference module is complete and working but cannot be integrated into code_graph.ts due to fundamental type mismatches between internal implementation types and the public API types defined in @ariadnejs/types. This blocks a critical capability of inferring function return types, which is essential for complete type analysis.

## Root Causes Analysis

### 1. Type Mutability Mismatch
- **Issue**: FileAnalysis interface expects readonly arrays and ReadonlyMap
- **Current**: code_graph.ts returns mutable arrays and Map
- **Impact**: TypeScript compilation errors when assigning to FileAnalysis

### 2. Missing Type Conversions
- **ImportInfo → ImportStatement**: Need location, symbols array, flags
- **ExportInfo → ExportStatement**: Need location, symbols array, flags  
- **TypeInfo[] → TypeInfo**: Need to flatten array to single type
- **Map → ReadonlyMap**: Need immutable wrapper

### 3. Missing Data Extraction
- **Variable declarations**: Not extracted from AST
- **Analysis errors**: Not collected during processing
- **Def objects**: Not created for functions (needed by return type inference)

### 4. Property Name Mismatches
- **Location properties**: row/column vs line/column
- **Context properties**: MODULE_CONTEXT vs '<module>'
- **Type properties**: Different structures between internal and public

## Solution Architecture

### Phase 1: Create Type Adapters
Create adapter layer to convert between internal and public types without breaking existing code:

```typescript
// src/type_analysis/type_adapters.ts
export function convert_import_info_to_statement(
  import_info: ImportInfo,
  file_path: string
): ImportStatement

export function convert_export_info_to_statement(
  export_info: ExportInfo,
  file_path: string
): ExportStatement

export function convert_type_info_array_to_single(
  types: TypeInfo[]
): TypeInfo

export function create_readonly_map<K, V>(
  map: Map<K, V>
): ReadonlyMap<K, V>

export function create_location_from_range(
  range: ScopeRange,
  file_path: string
): Location
```

### Phase 2: Extract Missing Data
Add extraction functions for missing elements:

```typescript
// src/variable_analysis/variable_extraction.ts
export function extract_variable_declarations(
  node: SyntaxNode,
  source_code: string,
  language: Language
): VariableDeclaration[]

// src/error_collection/analysis_errors.ts
export function collect_analysis_errors(
  context: AnalysisContext
): AnalysisError[]

// src/definition_extraction/def_factory.ts
export function create_def_from_scope(
  scope: ScopeNode,
  file_path: string
): Def
```

### Phase 3: Integrate Return Type Inference
Wire return type inference into the analyze_file function:

```typescript
// In analyze_file function
for (const [scope_id, scope] of scopes.nodes.entries()) {
  if (scope.type === "function") {
    // Create Def object
    const def = create_def_from_scope(scope, file.file_path);
    
    // Get function node from AST
    const func_node = find_function_node(tree.rootNode, scope.range);
    
    // Create context for return type inference
    const return_context: ReturnTypeContext = {
      language: file.language,
      source_code,
      type_tracker: type_tracker,
      class_name: get_enclosing_class_name(scope, scopes)
    };
    
    // Infer return type
    const return_info = infer_function_return_type(
      def,
      func_node,
      return_context
    );
    
    // Update function info with return type
    const return_type = return_info?.type || undefined;
```

### Phase 4: Fix Type Compatibility
Update analyze_file to return properly typed FileAnalysis:

```typescript
return {
  file_path: file.file_path,
  language: file.language,
  functions: Object.freeze(functions),
  classes: Object.freeze(classes),
  imports: Object.freeze(import_statements),
  exports: Object.freeze(export_statements),
  variables: Object.freeze(variable_declarations),
  errors: Object.freeze(analysis_errors),
  scopes,
  function_calls: Object.freeze(function_calls),
  method_calls: Object.freeze(method_calls),
  constructor_calls: Object.freeze(constructor_calls),
  type_info: create_readonly_map(flattened_type_map)
} as FileAnalysis;
```

## Implementation Plan

### Step 1: Create Type Adapter Module
- [ ] Create type_adapters.ts with all conversion functions
- [ ] Add tests for each adapter function
- [ ] Ensure no data loss during conversion

### Step 2: Create Variable Extraction Module
- [ ] Implement extract_variable_declarations for all languages
- [ ] Follow dispatcher pattern with language-specific files
- [ ] Add comprehensive tests

### Step 3: Create Error Collection Module
- [ ] Design AnalysisError structure
- [ ] Implement error collection during each analysis phase
- [ ] Add error recovery mechanisms

### Step 4: Create Def Factory Module
- [ ] Implement create_def_from_scope
- [ ] Add find_function_node helper
- [ ] Create get_enclosing_class_name helper

### Step 5: Wire Return Type Inference
- [ ] Import return type inference functions
- [ ] Add inference logic to function processing
- [ ] Update FunctionInfo creation with return types

### Step 6: Fix analyze_file Return Type
- [ ] Convert all arrays to readonly
- [ ] Convert Map to ReadonlyMap
- [ ] Apply type adapters for imports/exports
- [ ] Add proper type assertion

### Step 7: Update Enrichment Functions
- [ ] Update enrich_method_calls_with_hierarchy for readonly
- [ ] Update other enrichment functions as needed
- [ ] Ensure no mutations of readonly data

### Step 8: Comprehensive Testing
- [ ] Test return type inference for all languages
- [ ] Test type conversions preserve data
- [ ] Test error handling and recovery
- [ ] Performance benchmarks

## Success Criteria

1. **Return types inferred**: All functions have return types when determinable
2. **Type safety**: No TypeScript errors in code_graph.ts
3. **No data loss**: All information preserved through conversions
4. **Performance**: No significant performance regression
5. **All tests pass**: Existing tests continue to work

## Technical Decisions

### Why Adapter Layer?
- Allows incremental migration
- Preserves existing internal APIs
- Enables testing at each step
- Can be removed later if types unified

### Why Not Refactor Everything?
- Too risky for single change
- Would break many existing modules
- Adapter layer provides safe migration path
- Can refactor incrementally later

### Readonly vs Mutable
- Public API should be readonly for safety
- Internal processing can remain mutable
- Conversion happens at API boundary
- Prevents accidental mutations by consumers

## Dependencies

- Return type inference module (complete)
- Type tracking system (working)
- Scope analysis (working)
- AST traversal utilities (available)

## Risks

1. **Performance overhead**: Type conversions may impact performance
   - Mitigation: Profile and optimize hot paths
   
2. **Data structure mismatch**: Some conversions may be lossy
   - Mitigation: Comprehensive testing of conversions
   
3. **Breaking changes**: May affect downstream consumers
   - Mitigation: Careful testing of public API

## Notes

This task represents the final major integration needed to complete the type analysis system. Once complete, we'll have full return type inference working across all supported languages, enabling much more sophisticated type flow analysis.