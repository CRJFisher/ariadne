# Task Epic-11.80.9: ~~Expose and Integrate EnhancedFunctionCallInfo~~ Merge Enhanced Fields into FunctionCallInfo

## Status
Completed

## UPDATE: Better Architecture Decision
Instead of creating a separate EnhancedFunctionCallInfo type, we've merged all enhanced fields directly into the base FunctionCallInfo type in the @ariadnejs/types package. This simplifies the type hierarchy and aligns with the "early enrichment" pattern where we populate these fields during Phase 1 of processing when context is readily available.

## Parent Task
Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description
Expose the EnhancedFunctionCallInfo type to consumers and integrate the enhanced data throughout the processing pipeline.

## Research Findings

### Current State
The function_calls module now creates EnhancedFunctionCallInfo objects with:
- **resolved_target**: Local function resolution via scope tree
- **is_imported, source_module, import_alias, original_name**: Import tracking
- **resolved_type**: Type-based method resolution

However, the module still returns the base FunctionCallInfo type, preventing consumers from accessing these enhancements.

### Integration Points Identified

#### 1. File Analyzer Integration (`/src/file_analyzer.ts`)
The `analyze_calls` function currently:
- Receives `_type_tracker` and `_scopes` (prefixed with _ indicating unused)
- Creates a minimal context without scope_tree, imports, or type_map
- Returns base FunctionCallInfo[] instead of enhanced version

**Required Changes:**
```typescript
// In analyze_calls function:
function analyze_calls(
  root_node: SyntaxNode,
  source_code: SourceCode,
  language: Language,
  type_tracker: FileTypeTracker,  // Remove underscore
  scopes: ScopeTree,              // Remove underscore
  file_path: FilePath,
  imports: ImportInfo[]           // Add imports parameter
)

// Update context creation:
const function_call_context = {
  source_code,
  file_path,
  language,
  ast_root: root_node,
  scope_tree: scopes,           // Add scope tree
  imports: imports,             // Add imports
  type_map: type_tracker.variable_types  // Add type map
};
```

#### 2. Processing Pipeline Alignment
According to PROCESSING_PIPELINE.md:
- **Phase 1 (Per-File)**: Function calls are detected in Layer 4
- **Phase 3 (Enrichment)**: Function calls are enriched with resolved symbols (Line 373)

Our EnhancedFunctionCallInfo provides early enrichment during Phase 1, which:
- Reduces the need for Phase 3 enrichment
- Provides immediate resolution when context is available
- Enables downstream consumers to use enriched data earlier

#### 3. Call Chain Analysis Integration
The call_chain_analysis module imports FunctionCallInfo but could benefit from:
- Using resolved_target to build more accurate call chains
- Leveraging import tracking for cross-file analysis
- Using resolved_type for polymorphic dispatch

#### 4. Type Updates Required
- Export EnhancedFunctionCallInfo from index.ts ✅ (Already done)
- Update FileAnalysis type to use EnhancedFunctionCallInfo[]
- Update call_chain_analysis to use enhanced type

## Implementation Approach

### Phase 1: Wire Up Context (Immediate)
1. Update analyze_calls to accept imports parameter
2. Pass all available context to function_call_context
3. Ensure type_tracker.variable_types is converted to Map<string, TypeInfo>

### Phase 2: Update Types (Next)
1. Change FileAnalysis.function_calls type to EnhancedFunctionCallInfo[]
2. Update all consumers to handle enhanced type
3. Add type guards for checking enhanced fields

### Phase 3: Leverage Enhancements (Future)
1. Update call_chain_analysis to use resolved_target
2. Simplify enrichment phase to avoid redundant resolution
3. Add cross-file call tracking using import information

## Benefits
- **Immediate Resolution**: Symbol resolution happens when context is readily available
- **Reduced Complexity**: Less work needed in enrichment phase
- **Better Accuracy**: Direct access to scope tree and type information
- **Cross-File Awareness**: Import tracking enables better cross-file analysis

## Implementation Completed

### Changes Made:
1. **Updated FunctionCallInfo in @ariadnejs/types** - Added all enhanced fields as optional properties
2. **Removed EnhancedFunctionCallInfo** - No longer needed since base type has all fields
3. **Updated all function signatures** - Now return FunctionCallInfo with enhanced fields populated when context available
4. **Fixed type compatibility** - Mapped TypeInfo.type_kind values to expected values in FunctionCallInfo
5. **Updated all language handlers** - TypeScript, Rust, and Python handlers now use base FunctionCallInfo

### Key Architectural Decision:
Rather than having two separate types (base and enhanced), we unified them into a single FunctionCallInfo type with optional enhanced fields. This:
- Simplifies the type hierarchy
- Eliminates type casting
- Makes the API cleaner
- Aligns with "early enrichment" where we populate fields when context is available

## Acceptance Criteria
- [x] FunctionCallInfo type includes all enhanced fields
- [x] Enhanced fields populated when context is available  
- [x] All tests pass with unified type
- [x] Type mapping handles different TypeInfo formats
- [x] Documentation updated to reflect architectural change

## Dependencies
- Task 11.80 (configuration pattern implementation) - Complete
- Task 11.80.3-6 (integrations) - Complete
- Task 11.80.7-8 (method/constructor support) - Complete

## Estimated Effort
4 hours

## Notes
This task bridges the gap between the enhanced function_calls module and its consumers. The key insight is that we're doing "early enrichment" during per-file analysis when we have the context readily available, rather than deferring all enrichment to Phase 3.

The architecture supports this approach since:
1. Scope tree is available when calls are detected
2. Imports have already been extracted
3. Type tracking has been performed

This aligns with the "progressive enhancement" principle mentioned in PROCESSING_PIPELINE.md while providing value earlier in the pipeline.