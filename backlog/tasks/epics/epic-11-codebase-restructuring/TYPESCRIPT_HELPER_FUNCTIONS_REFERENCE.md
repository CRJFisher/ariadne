# TypeScript Builder Helper Functions Reference

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`
**Last Updated:** 2025-10-02

---

## Overview

This document provides a comprehensive reference for all helper functions in the TypeScript builder. These functions are used by handlers in `typescript_builder_config.ts` to extract metadata from AST nodes.

**Total Helper Functions:** 42

---

## Categories

1. [Symbol ID Creation](#symbol-id-creation) (13 functions)
2. [Type Extraction](#type-extraction) (5 functions)
3. [Metadata Extraction](#metadata-extraction) (8 functions)
4. [Boolean Properties](#boolean-properties) (7 functions)
5. [Scope Finding](#scope-finding) (5 functions)
6. [Decorator Helpers](#decorator-helpers) (3 functions)
7. [Unused Helpers](#unused-helpers) (4 functions)

---

## Symbol ID Creation

Functions that create unique symbol IDs for different definition types.

### `create_class_id(capture: CaptureNode): ClassId`
Creates a unique identifier for a class definition.

**Usage:** `definition.class` handler
**Format:** `class:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_interface_id(capture: CaptureNode): InterfaceId`
Creates a unique identifier for an interface definition.

**Usage:** `definition.interface` handler
**Format:** `interface:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_enum_id(capture: CaptureNode): EnumId`
Creates a unique identifier for an enum definition.

**Usage:** `definition.enum` handler
**Format:** `enum:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_enum_member_id(capture: CaptureNode): EnumMemberId`
Creates a unique identifier for an enum member.

**Usage:** `definition.enum.member` handler
**Format:** `enum_member:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_namespace_id(capture: CaptureNode): NamespaceId`
Creates a unique identifier for a namespace definition.

**Usage:** `definition.namespace` handler
**Format:** `namespace:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_type_alias_id(capture: CaptureNode): TypeAliasId`
Creates a unique identifier for a type alias definition.

**Usage:** `definition.type_alias` handler
**Format:** `type:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_method_id(capture: CaptureNode): MethodId`
Creates a unique identifier for a class method.

**Usage:** `definition.method`, `definition.method.private` handlers
**Format:** `method:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_method_signature_id(capture: CaptureNode): MethodId`
Creates a unique identifier for an interface method signature.

**Usage:** `definition.interface.method` handler
**Format:** `method:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_property_id(capture: CaptureNode): PropertyId`
Creates a unique identifier for a property (field or parameter property).

**Usage:** `definition.field`, `definition.field.private`, `definition.field.param_property` handlers
**Format:** `property:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_property_signature_id(capture: CaptureNode): PropertyId`
Creates a unique identifier for an interface property signature.

**Usage:** `definition.interface.property` handler
**Format:** `property:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_parameter_id(capture: CaptureNode): ParameterId`
Creates a unique identifier for a parameter.

**Usage:** `definition.parameter`, `definition.parameter.optional`, `definition.parameter.rest` handlers
**Format:** `parameter:{file}:{line}:{col}:{line}:{col}:{name}`

---

### `create_function_id(capture: CaptureNode): FunctionId` ❌ UNUSED
Creates a unique identifier for a function (currently unused in TypeScript config).

**Note:** TypeScript config inherits function handling from JavaScript config.

---

### `create_variable_id(capture: CaptureNode): VariableId` ❌ UNUSED
Creates a unique identifier for a variable (currently unused in TypeScript config).

**Note:** TypeScript config inherits variable handling from JavaScript config.

---

## Type Extraction

Functions that extract type information from AST nodes.

### `extract_property_type(node: SyntaxNode): SymbolName | undefined`
Extracts the type annotation from a property or field node.

**Usage:** Properties, fields, interface properties
**AST:** Looks for `type_annotation` field on parent node
**Example:** `name: string` → returns `"string"`

---

### `extract_parameter_type(node: SyntaxNode): SymbolName | undefined` ✨ NEW
Extracts the type annotation from a parameter node.

**Usage:** All parameter types (required, optional, rest)
**Special handling:** Rest parameters navigate up two levels to find type annotation
**Example:**
- `x: number` → returns `"number"`
- `...args: any[]` → returns `"any[]"`

---

### `extract_return_type(node: SyntaxNode): SymbolName | undefined`
Extracts the return type annotation from a function/method node.

**Usage:** Functions, methods, interface method signatures
**AST:** Looks for `return_type` field on parent node
**Example:** `function foo(): string` → returns `"string"`

---

### `extract_type_expression(node: SyntaxNode): string | undefined`
Extracts the type expression from a type alias.

**Usage:** Type alias definitions
**AST:** Looks for type expression on parent node
**Example:** `type Foo = string | number` → returns `"string | number"`

---

### `extract_type_parameters(node: SyntaxNode): string[]`
Extracts generic type parameters from a node.

**Usage:** Classes, interfaces, methods with generics
**AST:** Looks for `type_parameters` field
**Returns:** Array of type parameter names
**Example:** `<T, K extends string>` → returns `["T", "K extends string"]`

---

## Metadata Extraction

Functions that extract various metadata from AST nodes.

### `extract_access_modifier(node: SyntaxNode): string | undefined`
Extracts the access modifier (public, private, protected) from a node.

**Usage:** Class members, parameter properties
**Returns:** `"public"`, `"private"`, `"protected"`, or `undefined`
**Example:** `private name: string` → returns `"private"`

---

### `extract_enum_value(node: SyntaxNode): string | undefined`
Extracts the value expression from an enum member.

**Usage:** Enum member definitions
**AST:** Looks for value on parent node
**Example:** `Active = 1` → returns `"1"`

---

### `extract_interface_extends(node: SyntaxNode): string[]`
Extracts the interfaces that an interface extends.

**Usage:** Interface definitions
**Returns:** Array of interface names
**Example:** `interface B extends A, C` → returns `["A", "C"]`

---

### `extract_implements(node: SyntaxNode): string[]`
Extracts the interfaces that a class implements.

**Usage:** Class definitions
**Returns:** Array of interface names
**Example:** `class B implements A, C` → returns `["A", "C"]`

---

### `extract_decorator_name(node: SyntaxNode): string | undefined`
Extracts the name of a decorator.

**Usage:** Decorator handlers
**Example:** `@Component` → returns `"Component"`

---

### `extract_decorator_arguments(node: SyntaxNode): string[]`
Extracts the arguments passed to a decorator.

**Usage:** Decorator handlers
**Returns:** Array of argument expressions
**Example:** `@Component({ name: "Foo" })` → returns `['{ name: "Foo" }']`

---

### `extract_parameter_default_value(node: SyntaxNode): string | undefined` ✨ NEW
Extracts the default value from a parameter declaration.

**Usage:** All parameter handlers
**AST:** Looks for `value` field on parent parameter node
**Example:** `name: string = "World"` → returns `'"World"'`

---

### `extract_property_initial_value(node: SyntaxNode): string | undefined` ✨ NEW
Extracts the initial value from a property/field declaration.

**Usage:** Field and property handlers
**AST:** Looks for `value` field on parent node
**Example:** `count: number = 42` → returns `"42"`

---

## Boolean Properties

Functions that check boolean properties of AST nodes.

### `is_abstract_class(node: SyntaxNode): boolean`
Checks if a class is declared as abstract.

**Usage:** Class definitions
**Returns:** `true` if node has `abstract` modifier
**Example:** `abstract class Base` → returns `true`

---

### `is_abstract_method(node: SyntaxNode): boolean`
Checks if a method is declared as abstract.

**Usage:** Method definitions
**Returns:** `true` if node has `abstract` modifier
**Example:** `abstract process(): void` → returns `true`

---

### `is_static_method(node: SyntaxNode): boolean`
Checks if a method or property is declared as static.

**Usage:** Methods and properties
**Returns:** `true` if node has `static` modifier
**Example:** `static count = 0` → returns `true`

---

### `is_async_method(node: SyntaxNode): boolean`
Checks if a method is declared as async.

**Usage:** Method definitions
**Returns:** `true` if node has `async` modifier
**Example:** `async fetchData()` → returns `true`

---

### `is_readonly_property(node: SyntaxNode): boolean`
Checks if a property is declared as readonly.

**Usage:** Properties and parameter properties
**Returns:** `true` if node has `readonly` modifier
**Example:** `readonly id: string` → returns `true`

---

### `is_const_enum(node: SyntaxNode): boolean`
Checks if an enum is declared as const.

**Usage:** Enum definitions
**Returns:** `true` if node has `const` modifier
**Example:** `const enum Status` → returns `true`

---

### `is_optional_member(node: SyntaxNode): boolean`
Checks if a property or method is marked as optional.

**Usage:** Interface members
**Returns:** `true` if node has `?` token
**Example:** `name?: string` → returns `true`

---

## Scope Finding

Functions that find containing scopes for captured nodes.

### `find_containing_class(capture: CaptureNode): ClassId | undefined`
Finds the containing class for a node.

**Usage:** Methods, properties, constructors
**Returns:** ClassId of containing class or `undefined`
**Walks up:** From node until finding `class_declaration`

---

### `find_containing_interface(capture: CaptureNode): InterfaceId | undefined`
Finds the containing interface for a node.

**Usage:** Interface methods and properties
**Returns:** InterfaceId of containing interface or `undefined`
**Walks up:** From node until finding `interface_declaration`

---

### `find_containing_enum(capture: CaptureNode): EnumId | undefined`
Finds the containing enum for a node.

**Usage:** Enum members
**Returns:** EnumId of containing enum or `undefined`
**Walks up:** From node until finding `enum_declaration`

---

### `find_containing_callable(capture: CaptureNode): MethodId | FunctionId`
Finds the containing callable (function, method, or method signature) for a node.

**Usage:** Parameters
**Returns:** Symbol ID of containing callable
**Handles:** Functions, arrow functions, methods, method signatures, constructors

**Special handling:**
- Supports `method_signature` for interface methods
- Creates appropriate ID based on callable type

---

### `find_decorator_target(capture: CaptureNode): SyntaxNode | undefined`
Finds the target (class, method, or property) being decorated.

**Usage:** Decorator handlers
**Returns:** The AST node being decorated
**Walks up:** From decorator to find declaration node

---

## Availability Determination

### `determine_availability(node: SyntaxNode): Availability`
Determines the availability/visibility of a definition.

**Usage:** General definitions (interfaces, types, etc.)
**Returns:** `{ scope: "exported" | "file-private" }`
**Logic:** Checks if node is within an export statement

---

### `determine_method_availability(node: SyntaxNode): Availability`
Determines the availability of a method or property considering access modifiers.

**Usage:** Class methods and properties
**Returns:** `{ scope: "exported" | "file-private" | "class-private" }`
**Logic:**
- Private members → `"class-private"`
- Exported → `"exported"`
- Otherwise → `"file-private"`

---

## Unused Helpers

Functions defined but not currently used (may be for future use).

### `extract_location(node: SyntaxNode): Location` ❌ UNUSED
Extracts location information from a node.

**Note:** Captures already provide location via `capture.location`.

---

### `extract_symbol_name(node: SyntaxNode): SymbolName` ❌ UNUSED
Extracts the symbol name from a node.

**Note:** Captures already provide name via `capture.text`.

---

## Usage Examples

### Creating a Class Definition

```typescript
const class_id = create_class_id(capture);
const availability = determine_availability(capture.node);
const implements_list = extract_implements(capture.node);
const is_abstract = is_abstract_class(capture.node);
const generics = extract_type_parameters(capture.node.parent);
```

### Processing a Method

```typescript
const method_id = create_method_id(capture);
const class_id = find_containing_class(capture);
const return_type = extract_return_type(capture.node);
const access = extract_access_modifier(capture.node);
const is_abstract = is_abstract_method(capture.node);
const is_static = is_static_method(capture.node);
const is_async = is_async_method(capture.node);
```

### Processing a Parameter

```typescript
const param_id = create_parameter_id(capture);
const callable_id = find_containing_callable(capture);
const type = extract_parameter_type(capture.node);
const default_value = extract_parameter_default_value(capture.node);
```

### Processing a Property

```typescript
const prop_id = create_property_id(capture);
const class_id = find_containing_class(capture);
const type = extract_property_type(capture.node);
const initial_value = extract_property_initial_value(capture.node);
const is_readonly = is_readonly_property(capture.node);
const is_static = is_static_method(capture.node);
```

---

## Recent Additions (2025-10-02)

### New Helper Functions

1. **`extract_parameter_default_value()`**
   - Extracts default values from parameters
   - Handles regular and rest parameters
   - Used in all parameter handlers

2. **`extract_property_initial_value()`**
   - Extracts initial values from properties and fields
   - Handles public fields and property signatures
   - Used in field and property handlers

### Updates to Handlers

All handlers updated to use new value extraction functions:
- `definition.field` → uses `extract_property_initial_value()`
- `definition.field.private` → uses `extract_property_initial_value()`
- `definition.parameter` → uses `extract_parameter_default_value()`
- `definition.parameter.optional` → uses `extract_parameter_default_value()`
- `definition.parameter.rest` → uses `extract_parameter_default_value()`
- `definition.field.param_property` → uses `extract_parameter_default_value()`
- `param.property` → uses `extract_parameter_default_value()`

---

## Best Practices

1. **Always use helper functions** instead of manual AST traversal in handlers
2. **Check for undefined** - Most helpers return `undefined` if metadata not found
3. **Use correct helpers** - Don't use property helpers for parameters and vice versa
4. **Trust the helpers** - They handle edge cases and AST structure variations
5. **Add new helpers** when you find yourself writing the same AST traversal logic multiple times

---

## Summary

- **Total Functions:** 42
- **Used in Handlers:** 38
- **Unused (future use):** 4
- **Recently Added:** 2
- **Coverage:** Complete for all TypeScript-specific features
