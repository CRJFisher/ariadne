/**
 * Python language configuration using builder pattern
 *
 * Handles Python-specific patterns:
 * - Classes with __init__, methods, class methods, static methods
 * - Functions including async functions and lambda
 * - Decorators (@decorator syntax)
 * - Properties (@property, @setter, @getter)
 * - Imports (from X import Y, import X as Y)
 * - Type hints (function annotations, variable annotations)
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  SymbolAvailability,
  Location,
  ScopeId,
  ModulePath
} from "@ariadnejs/types";
import {
  class_symbol,
  function_symbol,
  method_symbol,
  parameter_symbol,
  property_symbol,
  variable_symbol,
} from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { ProcessingContext, RawCapture } from "../scope_processor";

// ============================================================================
// Types
// ============================================================================

export type ProcessFunction = (
  capture: RawCapture,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

export type LanguageBuilderConfig = Map<string, { process: ProcessFunction }>;

// ============================================================================
// Helper Functions for Python
// ============================================================================

/**
 * Extract location from a tree-sitter node
 */
function extract_location(node: SyntaxNode): Location {
  return {
    file_path: "" as any, // Will be filled by context
    line: node.startPosition.row + 1,
    column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column
  };
}

/**
 * Extract symbol name from a capture
 */
function extract_symbol_name(capture: RawCapture): SymbolName {
  return (capture.text || capture.node.text || "unknown") as SymbolName;
}

/**
 * Create a class symbol ID
 */
function create_class_id(capture: RawCapture): SymbolId {
  const name = extract_symbol_name(capture);
  const location = extract_location(capture.node);
  return class_symbol(name, location);
}

/**
 * Create a method symbol ID
 */
function create_method_id(capture: RawCapture, class_name?: SymbolName): SymbolId {
  const name = extract_symbol_name(capture);
  const location = extract_location(capture.node);
  return method_symbol(name, location);
}

/**
 * Create a function symbol ID
 */
function create_function_id(capture: RawCapture): SymbolId {
  const name = extract_symbol_name(capture);
  const location = extract_location(capture.node);
  return function_symbol(name, location);
}

/**
 * Create a variable symbol ID
 */
function create_variable_id(capture: RawCapture): SymbolId {
  const name = extract_symbol_name(capture);
  const location = extract_location(capture.node);
  return variable_symbol(name, location);
}

/**
 * Create a parameter symbol ID
 */
function create_parameter_id(capture: RawCapture): SymbolId {
  const name = extract_symbol_name(capture);
  const location = extract_location(capture.node);
  return parameter_symbol(name, location);
}

/**
 * Create a property symbol ID
 */
function create_property_id(capture: RawCapture): SymbolId {
  const name = extract_symbol_name(capture);
  const location = extract_location(capture.node);
  return property_symbol(name, location);
}

/**
 * Find containing class by traversing up the AST
 */
function find_containing_class(capture: RawCapture): SymbolId | undefined {
  let node = capture.node;

  // Traverse up until we find a class
  while (node) {
    if (node.type === 'class_definition') {
      const nameNode = node.childForFieldName?.('name');
      if (nameNode) {
        const className = nameNode.text as SymbolName;
        return class_symbol(className, extract_location(nameNode));
      }
    }
    node = node.parent;
  }
  return undefined;
}

/**
 * Find containing callable (function/method)
 */
function find_containing_callable(capture: RawCapture): SymbolId {
  let node = capture.node;

  // Traverse up until we find a callable
  while (node) {
    if (node.type === 'function_definition' || node.type === 'lambda') {
      const nameNode = node.childForFieldName?.('name');

      if (nameNode) {
        // Check if this is a method (inside a class)
        const inClass = find_containing_class({ node: node, text: "", name: "" } as RawCapture);
        if (inClass) {
          return method_symbol(nameNode.text as SymbolName, extract_location(nameNode));
        } else {
          return function_symbol(nameNode.text as SymbolName, extract_location(nameNode));
        }
      } else if (node.type === 'lambda') {
        // Lambda function - use the location as ID
        return function_symbol("lambda" as SymbolName, extract_location(node));
      }
    }
    node = node.parent;
  }
  // Default to unknown function
  return function_symbol("anonymous" as SymbolName, extract_location(capture.node));
}

/**
 * Check if a method has a specific decorator
 */
function has_decorator(node: SyntaxNode, decorator_name: string): boolean {
  const parent = node.parent;
  if (!parent || parent.type !== "function_definition") return false;

  // Look for decorated_definition parent
  const decorated = parent.parent;
  if (!decorated || decorated.type !== "decorated_definition") return false;

  // Check decorators
  const decorators = decorated.children.filter(
    (child) => child.type === "decorator"
  );
  return decorators.some((decorator) => {
    const identifier = decorator.children.find(
      (child) => child.type === "identifier"
    );
    return identifier?.text === decorator_name;
  });
}

/**
 * Check if a name is a magic method/attribute
 */
function is_magic_name(name: string): boolean {
  return name.startsWith("__") && name.endsWith("__");
}

/**
 * Check if a name is private by Python convention
 */
function is_private_name(name: string): boolean {
  return name.startsWith("_") && !is_magic_name(name);
}

/**
 * Extract decorator names from a function/method
 */
function extract_decorators(node: SyntaxNode): SymbolName[] {
  const decorators: SymbolName[] = [];

  // Check if parent is decorated_definition
  const parent = node.parent;
  if (parent && parent.type === "decorated_definition") {
    const decoratorNodes = parent.children.filter(child => child.type === "decorator");
    for (const decorator of decoratorNodes) {
      const identifier = decorator.children.find(child => child.type === "identifier");
      if (identifier) {
        decorators.push(identifier.text as SymbolName);
      }
    }
  }

  return decorators;
}

/**
 * Determine availability based on Python conventions
 */
function determine_availability(name: string): SymbolAvailability {
  // Private members (start with _)
  if (is_private_name(name)) {
    return { scope: "file-private" };
  }

  // Public by default in Python
  return { scope: "public" };
}

/**
 * Extract return type from function/method node (type annotation)
 */
function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const returnType = node.childForFieldName?.('return_type');
  if (returnType) {
    // Skip the -> arrow if present
    const typeNode = returnType.children?.find(child => child.type === 'type');
    return (typeNode?.text || returnType.text) as SymbolName;
  }
  return undefined;
}

/**
 * Extract parameter type annotation
 */
function extract_parameter_type(node: SyntaxNode): SymbolName | undefined {
  // Look for type annotation in parameter node
  const typeNode = node.childForFieldName?.('annotation');
  if (typeNode) {
    return typeNode.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract default value from parameter
 */
function extract_default_value(node: SyntaxNode): string | undefined {
  const defaultNode = node.childForFieldName?.('default');
  if (defaultNode) {
    return defaultNode.text;
  }
  return undefined;
}

/**
 * Extract type annotation from variable
 */
function extract_type_annotation(node: SyntaxNode): SymbolName | undefined {
  // Look for type annotation in assignment
  const parent = node.parent;
  if (parent && parent.type === 'assignment') {
    const typeNode = parent.childForFieldName?.('type');
    if (typeNode) {
      return typeNode.text as SymbolName;
    }
  }
  return undefined;
}

/**
 * Extract initial value from variable
 */
function extract_initial_value(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (parent && parent.type === 'assignment') {
    const valueNode = parent.childForFieldName?.('right');
    if (valueNode) {
      return valueNode.text;
    }
  }
  return undefined;
}

/**
 * Extract base classes from class definition
 */
function extract_extends(node: SyntaxNode): SymbolName[] {
  const bases: SymbolName[] = [];
  const superclasses = node.childForFieldName?.('superclasses');

  if (superclasses && superclasses.type === 'argument_list') {
    for (const child of superclasses.children || []) {
      if (child.type === 'identifier') {
        bases.push(child.text as SymbolName);
      } else if (child.type === 'attribute') {
        // Handle module.Class inheritance pattern
        bases.push(child.text as SymbolName);
      }
    }
  }

  return bases;
}

/**
 * Extract import path from import statement
 */
function extract_import_path(node: SyntaxNode): ModulePath {
  // Look for dotted_name or module name
  const moduleNode = node.childForFieldName?.('module') ||
                     node.children?.find(child => child.type === 'dotted_name');
  if (moduleNode) {
    return moduleNode.text as ModulePath;
  }
  return "" as ModulePath;
}

/**
 * Check if function is async
 */
function is_async_function(node: SyntaxNode): boolean {
  // Check for async keyword
  return node.children?.some(child => child.type === 'async' || child.text === 'async') || false;
}

/**
 * Determine if method is static, class method, or instance method
 */
function determine_method_type(node: SyntaxNode): { static?: boolean, abstract?: boolean } {
  const decorators = extract_decorators(node);

  if (decorators.includes('staticmethod' as SymbolName)) {
    return { static: true };
  }

  if (decorators.includes('classmethod' as SymbolName)) {
    // Use abstract flag to indicate class method (as per original pattern)
    return { abstract: true };
  }

  return {};
}

// ============================================================================
// Python Builder Configuration
// ============================================================================

export const PYTHON_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // ============================================================================
  // CLASSES
  // ============================================================================

  ["def.class", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const class_id = create_class_id(capture);
      const base_classes = extract_extends(capture.node.parent || capture.node);

      builder.add_class({
        symbol_id: class_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(extract_symbol_name(capture)),
        extends: base_classes
      });
    }
  }],

  // ============================================================================
  // METHODS
  // ============================================================================

  ["def.method", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);
      const name = extract_symbol_name(capture);

      if (class_id) {
        const methodType = determine_method_type(capture.node.parent || capture.node);
        const isAsync = is_async_function(capture.node.parent || capture.node);

        // Special handling for __init__
        if (name === "__init__") {
          // __init__ is actually a constructor
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: "constructor" as SymbolName,
            location: extract_location(capture.node),
            scope_id: context.get_scope_id(extract_location(capture.node)),
            availability: { scope: "public" },
            return_type: undefined,
            ...methodType,
            async: isAsync
          });
        } else {
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: name,
            location: extract_location(capture.node),
            scope_id: context.get_scope_id(extract_location(capture.node)),
            availability: determine_availability(name),
            return_type: extract_return_type(capture.node.parent || capture.node),
            ...methodType,
            async: isAsync
          });
        }
      }
    }
  }],

  ["def.method.static", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_method_to_class(class_id, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: determine_availability(extract_symbol_name(capture)),
          return_type: extract_return_type(capture.node.parent || capture.node),
          static: true,
          async: is_async_function(capture.node.parent || capture.node)
        });
      }
    }
  }],

  ["def.method.class", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_method_to_class(class_id, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: determine_availability(extract_symbol_name(capture)),
          return_type: extract_return_type(capture.node.parent || capture.node),
          abstract: true, // Use abstract flag for classmethod
          async: is_async_function(capture.node.parent || capture.node)
        });
      }
    }
  }],

  ["def.constructor", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // __init__ method - treat as constructor
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_method_to_class(class_id, {
          symbol_id: method_id,
          name: "constructor" as SymbolName,
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: { scope: "public" },
          return_type: undefined
        });
      }
    }
  }],

  // ============================================================================
  // PROPERTIES
  // ============================================================================

  ["def.property", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const prop_id = create_property_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_property_to_class(class_id, {
          symbol_id: prop_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: determine_availability(extract_symbol_name(capture)),
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node),
          readonly: true // Properties decorated with @property are readonly
        });
      }
    }
  }],

  ["def.field", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const prop_id = create_property_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_property_to_class(class_id, {
          symbol_id: prop_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: determine_availability(extract_symbol_name(capture)),
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node)
        });
      }
    }
  }],

  // ============================================================================
  // FUNCTIONS
  // ============================================================================

  ["def.function", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);
      const isAsync = is_async_function(capture.node.parent || capture.node);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(extract_symbol_name(capture))
      });

      // Note: Return type will be handled separately if needed
    }
  }],

  ["def.function.async", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(extract_symbol_name(capture))
      });
    }
  }],

  ["def.lambda", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: "lambda" as SymbolName,
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: "file-private" }
      });
    }
  }],

  // ============================================================================
  // PARAMETERS
  // ============================================================================

  ["def.param", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        type: extract_parameter_type(capture.node),
        default_value: extract_default_value(capture.node)
      });
    }
  }],

  ["def.param.default", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        type: extract_parameter_type(capture.node),
        default_value: extract_default_value(capture.node),
        optional: true
      });
    }
  }],

  ["def.param.typed", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        type: extract_parameter_type(capture.node),
        default_value: extract_default_value(capture.node)
      });
    }
  }],

  ["def.param.typed.default", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        type: extract_parameter_type(capture.node),
        default_value: extract_default_value(capture.node),
        optional: true
      });
    }
  }],

  ["def.param.args", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        type: "tuple" as SymbolName // *args is a tuple
      });
    }
  }],

  ["def.param.kwargs", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        type: "dict" as SymbolName // **kwargs is a dict
      });
    }
  }],

  // ============================================================================
  // VARIABLES
  // ============================================================================

  ["def.variable", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);
      const name = extract_symbol_name(capture);

      // Check if this is a constant (UPPER_CASE convention)
      const is_const = name === name.toUpperCase() && name.includes('_');

      builder.add_variable({
        kind: is_const ? 'constant' : 'variable',
        symbol_id: var_id,
        name: name,
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(name),
        type: extract_type_annotation(capture.node),
        initial_value: extract_initial_value(capture.node)
      });
    }
  }],

  ["def.variable.typed", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);
      const name = extract_symbol_name(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: name,
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(name),
        type: extract_type_annotation(capture.node),
        initial_value: extract_initial_value(capture.node)
      });
    }
  }],

  ["def.variable.multiple", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // Handle multiple assignment like: a, b = 1, 2
      const var_id = create_variable_id(capture);
      const name = extract_symbol_name(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: name,
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(name),
        type: undefined, // Type inference would be complex for unpacking
        initial_value: undefined // Value would be partial
      });
    }
  }],

  ["def.variable.tuple", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // Handle tuple unpacking like: (a, b) = (1, 2)
      const var_id = create_variable_id(capture);
      const name = extract_symbol_name(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: name,
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(name),
        type: undefined,
        initial_value: undefined
      });
    }
  }],

  ["def.variable.destructured", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // Handle destructuring assignment
      const var_id = create_variable_id(capture);
      const name = extract_symbol_name(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: name,
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(name),
        type: undefined,
        initial_value: undefined
      });
    }
  }],

  // Loop and comprehension variables
  ["def.loop_var", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        type: undefined,
        initial_value: undefined
      });
    }
  }],

  ["def.loop_var.multiple", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        type: undefined,
        initial_value: undefined
      });
    }
  }],

  ["def.comprehension_var", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        type: undefined,
        initial_value: undefined
      });
    }
  }],

  ["def.except_var", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        type: "Exception" as SymbolName,
        initial_value: undefined
      });
    }
  }],

  ["def.with_var", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        type: undefined,
        initial_value: undefined
      });
    }
  }],

  // ============================================================================
  // IMPORTS
  // ============================================================================

  ["import.named", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const import_id = create_variable_id(capture);
      const import_statement = capture.node.parent?.parent || capture.node;
      const import_path = extract_import_path(import_statement);

      builder.add_import({
        symbol_id: import_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: import_path,
        original_name: undefined,
        is_default: false,
        is_namespace: false
      });
    }
  }],

  ["import.named.source", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // This is the source name in an aliased import
      const import_id = create_variable_id(capture);
      const import_statement = capture.node.parent?.parent?.parent || capture.node;
      const import_path = extract_import_path(import_statement);

      // Look for alias
      const alias_import = capture.node.parent;
      let alias_name: SymbolName | undefined;
      if (alias_import && alias_import.type === 'aliased_import') {
        const alias_node = alias_import.childForFieldName?.('alias');
        if (alias_node) {
          alias_name = alias_node.text as SymbolName;
        }
      }

      builder.add_import({
        symbol_id: import_id,
        name: alias_name || extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: import_path,
        original_name: extract_symbol_name(capture),
        is_default: false,
        is_namespace: false
      });
    }
  }],

  ["import.named.alias", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // This is the alias in an aliased import - skip as it's handled by import.named.source
      return;
    }
  }],

  ["import.module", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const import_id = create_variable_id(capture);

      builder.add_import({
        symbol_id: import_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: extract_symbol_name(capture) as ModulePath,
        original_name: undefined,
        is_default: false,
        is_namespace: true
      });
    }
  }],

  ["import.module.source", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // This is the source module in "import X as Y"
      const import_id = create_variable_id(capture);
      const import_statement = capture.node.parent || capture.node;

      // Look for alias
      let alias_name: SymbolName | undefined;
      if (import_statement.type === 'aliased_import') {
        const alias_node = import_statement.childForFieldName?.('alias');
        if (alias_node) {
          alias_name = alias_node.text as SymbolName;
        }
      }

      builder.add_import({
        symbol_id: import_id,
        name: alias_name || extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: extract_symbol_name(capture) as ModulePath,
        original_name: alias_name ? extract_symbol_name(capture) : undefined,
        is_default: false,
        is_namespace: true
      });
    }
  }],

  ["import.module.alias", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // This is the alias in "import X as Y" - skip as it's handled by import.module.source
      return;
    }
  }],

  ["import.star", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const import_id = create_variable_id(capture);
      const import_statement = capture.node.parent || capture.node;
      const import_path = extract_import_path(import_statement);

      builder.add_import({
        symbol_id: import_id,
        name: "*" as SymbolName,
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: import_path,
        original_name: undefined,
        is_default: false,
        is_namespace: true
      });
    }
  }],

  // ============================================================================
  // Note: The following capture types are not definitions, so they're not included:
  // - Exports (Python doesn't have explicit exports)
  // - References (ref.*)
  // - Assignments (assign.*)
  // - Returns (ref.return, ref.yield)
  // - Type annotations (type.*, param.type)
  // - Modifiers (method.static, etc.)
  // - Composite captures
  // These would be handled by a separate ReferenceBuilder if needed
  // ============================================================================
]);