# Feature Integration Points

This document tracks the integration points between migrated features that need to be connected once all features are migrated.

## Current Status

### Completed Features
- ✅ function_calls
- ✅ method_calls  
- ✅ constructor_calls
- ✅ call_chain_analysis
- ✅ import_resolution
- 🚧 export_detection (in progress)

### Missing Integrations

#### 1. Call Graph ↔ Import Resolution
**Old System**: Call analysis uses `get_imports_with_definitions` to resolve imported functions
**New System**: Not connected
**TODO**: 
- Add `import_resolver` to FunctionCallContext
- Use import resolution when detecting cross-file calls
- Resolve imported function definitions

#### 2. Call Graph ↔ Type Tracking  
**Old System**: Type tracker flows through call analysis for method resolution
**New System**: Type tracking not yet migrated
**TODO**:
- Migrate type_tracking feature
- Add `type_tracker` to MethodCallContext
- Use type info for accurate method resolution

#### 3. Import Resolution ↔ Export Detection
**Old System**: Import resolver checks exported definitions
**New System**: Not connected
**TODO**:
- Share export information between features
- Use export detection in import resolution
- Validate imports against actual exports

#### 4. All Features ↔ ScopeGraph
**Old System**: Everything flows through ScopeGraph
**New System**: No shared graph structure
**TODO**:
- Migrate scope_analysis features
- Create unified graph structure
- Connect all features through scope graph

#### 5. Call Chain Analysis ↔ Cross-File Resolution
**Old System**: Call chains can traverse file boundaries
**New System**: Only works with provided calls
**TODO**:
- Use import resolution to follow cross-file chains
- Resolve imported function calls to their definitions

## Integration Plan

### Phase 1: Complete Core Migrations
- [x] function_calls
- [x] method_calls
- [x] constructor_calls
- [x] call_chain_analysis
- [x] import_resolution
- [ ] export_detection
- [ ] namespace_resolution
- [ ] module_graph

### Phase 2: Type System
- [ ] type_tracking
- [ ] return_type_inference
- [ ] parameter_type_inference
- [ ] type_propagation

### Phase 3: Scope Analysis
- [ ] scope_tree
- [ ] symbol_resolution
- [ ] definition_finder
- [ ] usage_finder

### Phase 4: Integration Layer
- [ ] Create unified context objects
- [ ] Wire up cross-feature dependencies
- [ ] Create integration tests
- [ ] Remove placeholder comments

## Key Integration Interfaces

```typescript
// Unified analysis context (future)
interface AnalysisContext {
  language: Language;
  file_path: string;
  source_code: string;
  ast: any; // tree-sitter Tree
  scope_graph: ScopeGraph;
  
  // Services
  import_resolver: ImportResolver;
  export_detector: ExportDetector;
  type_tracker: TypeTracker;
  symbol_resolver: SymbolResolver;
}

// Cross-file resolution (future)
interface CrossFileResolver {
  resolve_import(name: string, from_file: string): Def | undefined;
  get_exported_symbols(file: string): ExportInfo[];
  resolve_type(name: string, context: AnalysisContext): TypeInfo;
}
```

## Notes

- Features are currently isolated but functional
- Integration will happen after all core features are migrated
- Placeholder comments mark where connections are needed
- Old system's circular dependencies are avoided by design