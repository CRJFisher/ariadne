# Task: Update JavaScript Language Config

## Status: Created

## Parent Task

task-epic-11.102.5.1 - Update JavaScript

## Objective

Convert JavaScript language configuration from NormalizedCapture pattern to direct Definition builder pattern.

## Implementation Details

### Current Structure (to remove)

```typescript
// packages/core/src/parse_and_query_code/language_configs/javascript.ts

export const JAVASCRIPT_CAPTURE_CONFIG: LanguageCaptureConfig = new Map([
  ["def.class", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.CLASS,
    modifiers: (node) => ({ ... }),
    context: (node) => ({ extends: extractExtends(node) })
  }]
]);
```

### New Structure (to implement)

```typescript
// packages/core/src/parse_and_query_code/language_configs/javascript.ts

export const JAVASCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  ["def.class", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const class_id = create_class_id(capture);
      const extends_clause = capture.node.childForFieldName('superclass');

      builder.add_class({
        symbol_id: class_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_availability(capture.node),
        extends: extends_clause ? [extract_symbol_name(extends_clause)] : []
      });
    }
  }],

  ["def.method", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);

      builder.add_method_to_class(class_id, {
        symbol_id: method_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_method_availability(capture.node),
        return_type: extract_return_type(capture.node)
      });
    }
  }],

  ["def.function", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_availability(capture.node)
      });
    }
  }],

  ["def.parameter", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        type: extract_parameter_type(capture.node),
        default_value: extract_default_value(capture.node)
      });
    }
  }],

  ["def.variable", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);
      const is_const = capture.node.parent?.type === 'const_statement';

      builder.add_variable({
        kind: is_const ? 'constant' : 'variable',
        symbol_id: var_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_availability(capture.node),
        type: extract_type_annotation(capture.node),
        initial_value: extract_initial_value(capture.node)
      });
    }
  }],

  ["def.import", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const import_id = create_import_id(capture);
      const import_node = capture.node.parent; // Get full import statement

      builder.add_import({
        symbol_id: import_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: { scope: 'file-private' }, // Imports are file-scoped
        import_path: extract_import_path(import_node),
        original_name: extract_original_name(import_node, capture.symbol_name),
        is_default: is_default_import(import_node, capture.symbol_name),
        is_namespace: is_namespace_import(import_node)
      });
    }
  }],

  ["def.property", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const prop_id = create_property_id(capture);
      const class_id = find_containing_class(capture);

      builder.add_property_to_class(class_id, {
        symbol_id: prop_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_property_availability(capture.node),
        type: extract_property_type(capture.node),
        initial_value: extract_initial_value(capture.node)
      });
    }
  }]
]);
```

## Capture Types to Process

### Definitions

- `def.class` - Class declarations
- `def.method` - Class methods
- `def.constructor` - Class constructors
- `def.function` - Function declarations/expressions
- `def.parameter` - Function/method parameters
- `def.variable` - Variable declarations (let/const/var)
- `def.property` - Class properties/fields
- `def.import` - Import statements

### References

- `ref.call` - Function/method calls
- `ref.property` - Property access
- `ref.variable` - Variable references

### Scopes

- `scope.function` - Function scope
- `scope.class` - Class scope
- `scope.block` - Block scope

## Helper Functions to Implement

```typescript
// Symbol ID creation
function create_class_id(capture: RawCapture): SymbolId;
function create_method_id(capture: RawCapture): SymbolId;
function create_function_id(capture: RawCapture): SymbolId;
function create_variable_id(capture: RawCapture): SymbolId;
function create_parameter_id(capture: RawCapture): SymbolId;
function create_property_id(capture: RawCapture): SymbolId;
function create_import_id(capture: RawCapture): SymbolId;

// Context extraction
function find_containing_class(capture: RawCapture): SymbolId | undefined;
function find_containing_callable(capture: RawCapture): SymbolId;

// Availability determination
function determine_availability(node: SyntaxNode): SymbolAvailability;
function determine_method_availability(node: SyntaxNode): SymbolAvailability;
function determine_property_availability(node: SyntaxNode): SymbolAvailability;

// Type extraction
function extract_return_type(node: SyntaxNode): SymbolName | undefined;
function extract_parameter_type(node: SyntaxNode): SymbolName | undefined;
function extract_property_type(node: SyntaxNode): SymbolName | undefined;
function extract_type_annotation(node: SyntaxNode): SymbolName | undefined;

// Value extraction
function extract_initial_value(node: SyntaxNode): string | undefined;
function extract_default_value(node: SyntaxNode): string | undefined;

// Import-specific extraction
function extract_import_path(node: SyntaxNode): ModulePath;
function extract_original_name(node: SyntaxNode, local_name: SymbolName): SymbolName | undefined;
function is_default_import(node: SyntaxNode, name: SymbolName): boolean;
function is_namespace_import(node: SyntaxNode): boolean;

// Inheritance extraction
function extract_extends(node: SyntaxNode): SymbolName[];
function extract_symbol_name(node: SyntaxNode): SymbolName;
```

## Success Criteria

- [ ] All capture types have builder implementations
- [ ] Helper functions implemented and tested
- [ ] No references to NormalizedCapture
- [ ] Direct Definition creation working
- [ ] All fields populated correctly

## Estimated Effort

~1 hour
