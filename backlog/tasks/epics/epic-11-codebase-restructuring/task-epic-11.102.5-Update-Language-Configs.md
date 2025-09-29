# Task: Update Language Configs for Direct Definition Creation

## Status: Created

## Parent Task
task-epic-11.102 - Replace NormalizedCapture with Direct Definition Builders

## Objective

Update all language configuration files to use the new builder pattern for direct Definition creation instead of NormalizedCapture. Each language requires updating its config, queries, and tests.

## Sub-tasks by Language

### 102.5.1 - JavaScript
- **102.5.1.1** - Update JavaScript Language Config
- **102.5.1.2** - Update JavaScript Queries (.scm file)
- **102.5.1.3** - Update JavaScript Tests

### 102.5.2 - TypeScript
- **102.5.2.1** - Update TypeScript Language Config
- **102.5.2.2** - Update TypeScript Queries (.scm file)
- **102.5.2.3** - Update TypeScript Tests

### 102.5.3 - Python
- **102.5.3.1** - Update Python Language Config
- **102.5.3.2** - Update Python Queries (.scm file)
- **102.5.3.3** - Update Python Tests

### 102.5.4 - Rust
- **102.5.4.1** - Update Rust Language Config
- **102.5.4.2** - Update Rust Queries (.scm file)
- **102.5.4.3** - Update Rust Tests

## Files to Update Per Language

### Config Files
- `packages/core/src/parse_and_query_code/language_configs/javascript.ts`
- `packages/core/src/parse_and_query_code/language_configs/typescript.ts`
- `packages/core/src/parse_and_query_code/language_configs/python.ts`
- `packages/core/src/parse_and_query_code/language_configs/rust.ts`

### Query Files
- `packages/core/src/parse_and_query_code/queries/javascript.scm`
- `packages/core/src/parse_and_query_code/queries/typescript.scm`
- `packages/core/src/parse_and_query_code/queries/python.scm`
- `packages/core/src/parse_and_query_code/queries/rust.scm`

### Test Files
- `packages/core/src/parse_and_query_code/language_configs/*.test.ts`
- `packages/core/tests/{language}/*.test.ts`

## New Mapping Structure

### Before (NormalizedCapture)

```typescript
export const JAVASCRIPT_CAPTURE_CONFIG: LanguageCaptureConfig = new Map([
  ["def.class", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.CLASS,
    modifiers: (node) => ({ ... }),
    context: (node) => ({ extends: extractExtends(node) })
  }]
]);
```

### After (Direct Builder)

```typescript
export const JAVASCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  ["def.class", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.CLASS,
    process: (capture: RawCapture, builder: DefinitionBuilder) => {
      const extends_clause = capture.node.childForFieldName('extends');

      builder.add_class({
        symbol_id: create_symbol_id(capture.symbol_name, capture.node_location),
        name: capture.symbol_name,
        location: capture.node_location,
        extends: extends_clause ? [extract_symbol_name(extends_clause)] : [],
        availability: determine_availability(capture.node)
      });
    }
  }]
]);
```

## Key Changes Per Capture Type

### Class Captures
- Extract base class information directly
- Create ClassDefinition stub immediately
- Methods/properties will be added by subsequent captures

### Method Captures
- Find containing class via scope/parent analysis
- Add to class's method list in builder

### Function Captures
- Create complete FunctionDefinition immediately
- Extract parameters from node structure

### Parameter Captures
- Add to containing function/method in builder
- Extract type information if available

## Helper Functions to Create

```typescript
// packages/core/src/parse_and_query_code/builder_helpers.ts

export function create_symbol_id(name: SymbolName, location: Location): SymbolId {
  // Create unique symbol ID
}

export function determine_availability(node: SyntaxNode): SymbolAvailability {
  // Determine if exported, private, etc.
}

export function find_containing_class(capture: RawCapture): SymbolId | undefined {
  // Walk up AST to find containing class
}

export function extract_parameters(node: SyntaxNode): ParameterDefinition[] {
  // Extract parameter list from function/method node
}
```

## Testing Updates

Each language config needs updated tests:
- Test that captures produce correct definitions
- Test that multi-part definitions (class + methods) assemble correctly
- Test that all required fields are populated

## Key Requirements for Each Language

1. **Update Language Config**
   - Convert from NormalizedCapture to builder pattern
   - Handle language-specific features
   - Implement all helper functions

2. **Update Query Files**
   - Remove unnecessary captures
   - Add missing captures (scopes, imports, etc.)
   - Optimize for performance

3. **Update Tests**
   - Fix breaking tests
   - Add comprehensive field coverage
   - Test language-specific features

## Success Criteria

- [ ] All 4 languages updated (JavaScript, TypeScript, Python, Rust)
- [ ] All 12 sub-subtasks completed
- [ ] Query files optimized and cleaned
- [ ] 100% test coverage for all definition fields
- [ ] No references to NormalizedCapture remain
- [ ] All language tests pass

## Dependencies

- task-epic-11.102.1, 102.2, 102.3 (All builder systems exist)
- task-epic-11.102.4 (Old types removed)

## Estimated Effort

- JavaScript: ~3 hours (1 hour per subtask)
- TypeScript: ~4 hours (more complex)
- Python: ~3 hours
- Rust: ~4 hours (complex type system)
- **Total: ~14 hours**
