# Task Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Status
Pending

## Parent Epic
Epic 11: Codebase Restructuring

## Description
Refactor function_calls module to use configuration-driven language processing and integrate with enhanced data structures for improved call resolution.

## Objectives

### 1. Apply Configuration-Driven Pattern
Transform the current language-specific implementations into a configuration-based approach where 86% of the code can be genericized.

### 2. Integrate Enhanced Data Structures
Add the integration points outlined in the TODO comments (lines 20-24 of function_calls.ts):
- `scope_graph?: ScopeGraph` - For symbol resolution  
- `import_resolver?: (name: string) => ImportInfo | undefined` - For resolving imported functions
- `export_detector?: (file: string) => ExportInfo[]` - For checking if functions are exported
- `type_tracker?: TypeTracker` - For tracking variable types to resolve method calls

## Implementation Details

### Configuration Structure
```typescript
interface LanguageCallConfig {
  call_expression_types: string[];
  function_field: string;
  arguments_field: string;
  method_expression_types: string[];
  method_object_field: string;
  method_property_field: string;
  function_definition_types: string[];
  constructor_patterns: ConstructorConfig;
}
```

### Enhanced Context
```typescript
interface FunctionCallContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
  
  // New integration points
  scope_tree: ScopeTree;
  import_resolver: ImportResolver;
  type_tracker: TypeTracker;
  symbol_table: SymbolTable;
}
```

### Benefits of Integration

1. **With scope_tree**: Resolve local function definitions and understand scope context
2. **With import_resolver**: Track calls to imported functions and resolve their sources
3. **With type_tracker**: Better method call resolution through type information
4. **With symbol_table**: Cross-file call resolution and definition linking

## Work Items

### Phase 1: Configuration Extraction
- [ ] Create LANGUAGE_CONFIGS constant with configurations for all languages
- [ ] Build generic processors for common patterns
- [ ] Preserve bespoke handlers for truly language-specific features

### Phase 2: Integration Enhancement
- [ ] Update FunctionCallContext interface
- [ ] Modify find_function_calls to use scope_tree for local resolution
- [ ] Add import resolution to track external function calls
- [ ] Use type_tracker for improved method call detection

### Phase 3: Testing and Migration
- [ ] Ensure all existing tests pass
- [ ] Add tests for enhanced resolution capabilities
- [ ] Document the new capabilities

## Expected Outcomes

### Code Reduction
- Current: ~747 lines across 4 language files
- After refactor: ~247 lines (67% reduction)
- Better maintainability and consistency

### Enhanced Capabilities
- Accurate cross-file call resolution
- Import-aware function call tracking
- Type-informed method call detection
- Scope-aware local function resolution

## Success Criteria
- [ ] All existing tests pass without modification
- [ ] 60%+ code reduction achieved
- [ ] Enhanced resolution using integrated data structures
- [ ] Clear separation of generic vs bespoke logic
- [ ] Documentation updated to reflect new pattern

## Related Files
- `/packages/core/src/call_graph/function_calls/`
- `/packages/core/src/call_graph/method_calls/` (apply pattern here too)
- `/packages/core/src/call_graph/constructor_calls/` (apply pattern here too)
- `/docs/Architecture.md` (configuration-driven pattern documentation)

## Notes
This refactoring establishes a pattern that can be applied across multiple language-specific modules in the codebase, significantly reducing duplication and improving maintainability.
