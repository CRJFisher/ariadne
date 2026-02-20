# Task: Update TypeScript Language Config

## Status: Created

## Parent Task

task-epic-11.102.5.2 - Update TypeScript

## Objective

Convert TypeScript language configuration from NormalizedCapture pattern to direct Definition builder pattern, handling all TypeScript-specific features.

## Implementation Details

### TypeScript-Specific Captures to Handle

```typescript
// packages/core/src/parse_and_query_code/language_configs/typescript.ts

export const TYPESCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // ============================================
  // INTERFACES
  // ============================================
  ["def.interface", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const interface_id = create_interface_id(capture);
      const extends_clause = capture.node.childForFieldName('extends');

      builder.add_interface({
        symbol_id: interface_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_availability(capture.node),
        extends: extends_clause ? extract_interface_extends(extends_clause) : []
      });
    }
  }],

  ["def.interface.method", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_signature_id(capture);
      const interface_id = find_containing_interface(capture);

      builder.add_method_signature_to_interface(interface_id, {
        symbol_id: method_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        optional: is_optional_method(capture.node),
        type_parameters: extract_type_parameters(capture.node),
        return_type: extract_return_type(capture.node)
      });
    }
  }],

  ["def.interface.property", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const prop_id = create_property_signature_id(capture);
      const interface_id = find_containing_interface(capture);

      builder.add_property_signature_to_interface(interface_id, {
        symbol_id: prop_id,
        name: capture.symbol_name,
        location: capture.node_location,
        type: extract_property_type(capture.node),
        optional: is_optional_property(capture.node),
        readonly: is_readonly_property(capture.node)
      });
    }
  }],

  // ============================================
  // TYPE ALIASES
  // ============================================
  ["def.type", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const type_id = create_type_alias_id(capture);

      builder.add_type({
        kind: 'type_alias',
        symbol_id: type_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_availability(capture.node),
        type_expression: extract_type_expression(capture.node),
        type_parameters: extract_type_parameters(capture.node)
      });
    }
  }],

  // ============================================
  // ENUMS
  // ============================================
  ["def.enum", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const enum_id = create_enum_id(capture);
      const is_const = capture.node.parent?.type === 'const_enum';

      builder.add_enum({
        symbol_id: enum_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_availability(capture.node),
        is_const: is_const
      });
    }
  }],

  ["def.enum.member", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const enum_id = find_containing_enum(capture);
      const member_id = create_enum_member_id(capture);

      builder.add_enum_member(enum_id, {
        symbol_id: member_id,
        name: capture.symbol_name,
        location: capture.node_location,
        value: extract_enum_value(capture.node)
      });
    }
  }],

  // ============================================
  // NAMESPACES/MODULES
  // ============================================
  ["def.namespace", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const namespace_id = create_namespace_id(capture);

      builder.add_namespace({
        symbol_id: namespace_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_availability(capture.node)
      });
    }
  }],

  // ============================================
  // DECORATORS
  // ============================================
  ["def.decorator", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const parent_id = find_decorator_target(capture);
      const decorator_name = extract_decorator_name(capture.node);

      builder.add_decorator_to_target(parent_id, {
        name: decorator_name,
        arguments: extract_decorator_arguments(capture.node),
        location: capture.node_location
      });
    }
  }],

  // ============================================
  // ACCESS MODIFIERS & TYPE PARAMETERS
  // ============================================
  ["def.class", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const class_id = create_class_id(capture);
      const extends_clause = capture.node.childForFieldName('extends');
      const implements_clause = capture.node.childForFieldName('implements');

      builder.add_class({
        symbol_id: class_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: context.get_scope_id(capture.node_location),
        availability: determine_availability(capture.node),
        abstract: is_abstract_class(capture.node),
        extends: extends_clause ? [extract_symbol_name(extends_clause)] : [],
        implements: implements_clause ? extract_implements(implements_clause) : [],
        type_parameters: extract_type_parameters(capture.node)
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
        access_modifier: extract_access_modifier(capture.node),
        abstract: is_abstract_method(capture.node),
        static: is_static_method(capture.node),
        async: is_async_method(capture.node),
        return_type: extract_return_type(capture.node),
        type_parameters: extract_type_parameters(capture.node)
      });
    }
  }],

  // ... Include all JavaScript captures plus TypeScript-specific ones
]);
```

## Helper Functions Specific to TypeScript

```typescript
// Type extraction
function extract_type_expression(node: SyntaxNode): string;
function extract_type_parameters(node: SyntaxNode): string[];
function extract_interface_extends(node: SyntaxNode): SymbolName[];
function extract_implements(node: SyntaxNode): SymbolName[];

// Access modifiers
function extract_access_modifier(node: SyntaxNode): 'public' | 'private' | 'protected' | undefined;
function is_readonly_property(node: SyntaxNode): boolean;
function is_optional_property(node: SyntaxNode): boolean;
function is_optional_method(node: SyntaxNode): boolean;

// Abstract members
function is_abstract_class(node: SyntaxNode): boolean;
function is_abstract_method(node: SyntaxNode): boolean;

// Decorators
function extract_decorator_name(node: SyntaxNode): string;
function extract_decorator_arguments(node: SyntaxNode): string[];
function find_decorator_target(capture: RawCapture): SymbolId;

// Enum helpers
function extract_enum_value(node: SyntaxNode): string | number | undefined;
function find_containing_enum(capture: RawCapture): SymbolId;

// Interface helpers
function find_containing_interface(capture: RawCapture): SymbolId;
function create_method_signature_id(capture: RawCapture): SymbolId;
function create_property_signature_id(capture: RawCapture): SymbolId;
```

## Success Criteria

- [ ] All TypeScript-specific features handled
- [ ] Interfaces fully supported
- [ ] Type aliases captured correctly
- [ ] Enums with const modifier support
- [ ] Decorators attached to correct targets
- [ ] Access modifiers preserved
- [ ] Type parameters extracted
- [ ] Abstract classes/methods marked
- [ ] No references to NormalizedCapture

## Estimated Effort

~1.5 hours (more complex than JavaScript)