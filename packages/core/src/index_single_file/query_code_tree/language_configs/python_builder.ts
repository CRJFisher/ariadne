// Python language configuration using builder pattern
import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  SymbolAvailability,
  Location,
  ScopeId,
  ModulePath,
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
import type { ProcessingContext, CaptureNode } from "../scope_processor";

export type ProcessFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

export type LanguageBuilderConfig = Map<string, { process: ProcessFunction }>;

// Helper Functions
function extract_location(node: SyntaxNode): Location {
  return {
    file_path: "" as any, // Will be filled by context
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column,
  };
}

function create_class_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return class_symbol(name, location);
}

function create_method_id(
  capture: CaptureNode,
  class_name?: SymbolName
): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return method_symbol(name, location);
}

function create_function_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return function_symbol(name, location);
}

function create_variable_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return variable_symbol(name, location);
}

function create_parameter_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return parameter_symbol(name, location);
}

function create_property_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return property_symbol(name, location);
}

function find_containing_class(capture: CaptureNode): SymbolId | undefined {
  let node = capture.node;

  // Traverse up until we find a class
  while (node) {
    if (node.type === "class_definition") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        const className = nameNode.text as SymbolName;
        return class_symbol(className, extract_location(nameNode));
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }
  return undefined;
}

function find_containing_callable(capture: CaptureNode): SymbolId {
  let node = capture.node;

  // Traverse up until we find a callable
  while (node) {
    if (node.type === "function_definition" || node.type === "lambda") {
      const nameNode = node.childForFieldName?.("name");

      if (nameNode) {
        // Check if this is a method (inside a class)
        const inClass = find_containing_class({
          node: node,
          text: "",
          name: "",
        } as CaptureNode);
        if (inClass) {
          return method_symbol(
            nameNode.text as SymbolName,
            extract_location(nameNode)
          );
        } else {
          return function_symbol(
            nameNode.text as SymbolName,
            extract_location(nameNode)
          );
        }
      } else if (node.type === "lambda") {
        // Lambda function - use the location as ID
        return function_symbol("lambda" as SymbolName, extract_location(node));
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }
  // Default to unknown function
  return function_symbol("anonymous" as SymbolName, capture.location);
}

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

function is_magic_name(name: string): boolean {
  return name.startsWith("__") && name.endsWith("__");
}

function is_private_name(name: string): boolean {
  return name.startsWith("_") && !is_magic_name(name);
}

function extract_decorators(node: SyntaxNode): SymbolName[] {
  const decorators: SymbolName[] = [];

  // Check if parent is decorated_definition
  const parent = node.parent;
  if (parent && parent.type === "decorated_definition") {
    const decoratorNodes = parent.children.filter(
      (child) => child.type === "decorator"
    );
    for (const decorator of decoratorNodes) {
      const identifier = decorator.children.find(
        (child) => child.type === "identifier"
      );
      if (identifier) {
        decorators.push(identifier.text as SymbolName);
      }
    }
  }

  return decorators;
}

function determine_availability(name: string): SymbolAvailability {
  // Private members (start with _)
  if (is_private_name(name)) {
    return { scope: "file-private" };
  }

  // Public by default in Python
  return { scope: "public" };
}

function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const returnType = node.childForFieldName?.("return_type");
  if (returnType) {
    // Skip the -> arrow if present
    const typeNode = returnType.children?.find(
      (child) => child.type === "type"
    );
    return (typeNode?.text || returnType.text) as SymbolName;
  }
  return undefined;
}

function extract_parameter_type(node: SyntaxNode): SymbolName | undefined {
  // Look for type annotation in parameter node
  const typeNode = node.childForFieldName?.("annotation");
  if (typeNode) {
    return typeNode.text as SymbolName;
  }
  return undefined;
}

function extract_default_value(node: SyntaxNode): string | undefined {
  const defaultNode = node.childForFieldName?.("default");
  if (defaultNode) {
    return defaultNode.text;
  }
  return undefined;
}

function extract_type_annotation(node: SyntaxNode): SymbolName | undefined {
  // Look for type annotation in assignment
  const parent = node.parent;
  if (parent && parent.type === "assignment") {
    const typeNode = parent.childForFieldName?.("type");
    if (typeNode) {
      return typeNode.text as SymbolName;
    }
  }
  return undefined;
}

function extract_initial_value(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (parent && parent.type === "assignment") {
    const valueNode = parent.childForFieldName?.("right");
    if (valueNode) {
      return valueNode.text;
    }
  }
  return undefined;
}

function extract_extends(node: SyntaxNode): SymbolName[] {
  const bases: SymbolName[] = [];
  const superclasses = node.childForFieldName?.("superclasses");

  if (superclasses && superclasses.type === "argument_list") {
    for (const child of superclasses.children || []) {
      if (child.type === "identifier") {
        bases.push(child.text as SymbolName);
      } else if (child.type === "attribute") {
        // Handle module.Class inheritance pattern
        bases.push(child.text as SymbolName);
      }
    }
  }

  return bases;
}

function extract_import_path(node: SyntaxNode): ModulePath {
  // Look for dotted_name or module name
  const moduleNode =
    node.childForFieldName?.("module") ||
    node.children?.find((child) => child.type === "dotted_name");
  if (moduleNode) {
    return moduleNode.text as ModulePath;
  }
  return "" as ModulePath;
}

function is_async_function(node: SyntaxNode): boolean {
  // Check for async keyword
  return (
    node.children?.some(
      (child) => child.type === "async" || child.text === "async"
    ) || false
  );
}

function determine_method_type(node: SyntaxNode): {
  static?: boolean;
  abstract?: boolean;
} {
  const decorators = extract_decorators(node);

  if (decorators.includes("staticmethod" as SymbolName)) {
    return { static: true };
  }

  if (decorators.includes("classmethod" as SymbolName)) {
    // Use abstract flag to indicate class method (as per original pattern)
    return { abstract: true };
  }

  return {};
}

export const PYTHON_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // Classes
  [
    "definition.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const class_id = create_class_id(capture);
        const base_classes = extract_extends(
          capture.node.parent || capture.node
        );

        builder.add_class({
          symbol_id: class_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
          extends: base_classes,
        });
      },
    },
  ],

  // Methods
  [
    "definition.method",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const class_id = find_containing_class(capture);
        const name = capture.text;

        if (class_id) {
          const methodType = determine_method_type(
            capture.node.parent || capture.node
          );
          const isAsync = is_async_function(
            capture.node.parent || capture.node
          );

          // Special handling for __init__
          if (name === "__init__") {
            // __init__ is actually a constructor
            builder.add_method_to_class(class_id, {
              symbol_id: method_id,
              name: "constructor" as SymbolName,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              availability: { scope: "public" },
              return_type: undefined,
              ...methodType,
              async: isAsync,
            });
          } else {
            builder.add_method_to_class(class_id, {
              symbol_id: method_id,
              name: name,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              availability: determine_availability(name),
              return_type: extract_return_type(
                capture.node.parent || capture.node
              ),
              ...methodType,
              async: isAsync,
            });
          }
        }
      },
    },
  ],

  [
    "definition.method.static",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(capture.text),
            return_type: extract_return_type(
              capture.node.parent || capture.node
            ),
            static: true,
            async: is_async_function(capture.node.parent || capture.node),
          });
        }
      },
    },
  ],

  [
    "definition.method.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(capture.text),
            return_type: extract_return_type(
              capture.node.parent || capture.node
            ),
            abstract: true, // Use abstract flag for classmethod
            async: is_async_function(capture.node.parent || capture.node),
          });
        }
      },
    },
  ],

  [
    "definition.constructor",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // __init__ method - treat as constructor
        const method_id = create_method_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: "constructor" as SymbolName,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: { scope: "public" },
            return_type: undefined,
          });
        }
      },
    },
  ],

  // Properties
  [
    "definition.property",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const prop_id = create_property_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_property_to_class(class_id, {
            symbol_id: prop_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(capture.text),
            type: extract_type_annotation(capture.node),
            initial_value: extract_initial_value(capture.node),
            readonly: true, // Properties decorated with @property are readonly
          });
        }
      },
    },
  ],

  [
    "definition.field",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const prop_id = create_property_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_property_to_class(class_id, {
            symbol_id: prop_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(capture.text),
            type: extract_type_annotation(capture.node),
            initial_value: extract_initial_value(capture.node),
          });
        }
      },
    },
  ],

  // Functions
  [
    "definition.function",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const func_id = create_function_id(capture);
        const isAsync = is_async_function(capture.node.parent || capture.node);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
        });

        // Note: Return type will be handled separately if needed
      },
    },
  ],

  [
    "definition.function.async",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const func_id = create_function_id(capture);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
        });
      },
    },
  ],

  [
    "definition.lambda",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const func_id = create_function_id(capture);

        builder.add_function({
          symbol_id: func_id,
          name: "lambda" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
        });
      },
    },
  ],

  // Parameters
  [
    "definition.param",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          default_value: extract_default_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.param.default",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          default_value: extract_default_value(capture.node),
          optional: true,
        });
      },
    },
  ],

  [
    "definition.param.typed",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          default_value: extract_default_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.param.typed.default",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          default_value: extract_default_value(capture.node),
          optional: true,
        });
      },
    },
  ],

  [
    "definition.param.args",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: "tuple" as SymbolName, // *args is a tuple
        });
      },
    },
  ],

  [
    "definition.param.kwargs",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: "dict" as SymbolName, // **kwargs is a dict
        });
      },
    },
  ],

  // Variables
  [
    "definition.variable",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);
        const name = capture.text;

        // Check if this is a constant (UPPER_CASE convention)
        const is_const = name === name.toUpperCase() && name.includes("_");

        builder.add_variable({
          kind: is_const ? "constant" : "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.variable.typed",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);
        const name = capture.text;

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.variable.multiple",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Handle multiple assignment like: a, b = 1, 2
        const var_id = create_variable_id(capture);
        const name = capture.text;

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: undefined, // Type inference would be complex for unpacking
          initial_value: undefined, // Value would be partial
        });
      },
    },
  ],

  [
    "definition.variable.tuple",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Handle tuple unpacking like: (a, b) = (1, 2)
        const var_id = create_variable_id(capture);
        const name = capture.text;

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.variable.destructured",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Handle destructuring assignment
        const var_id = create_variable_id(capture);
        const name = capture.text;

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  // Loop and comprehension variables
  [
    "definition.loop_var",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.loop_var.multiple",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.comprehension_var",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.except_var",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: "Exception" as SymbolName,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.with_var",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  // Imports
  [
    "import.named",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent?.parent || capture.node;
        const import_path = extract_import_path(import_statement);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: import_path,
          import_kind: "named",
          original_name: undefined,
        });
      },
    },
  ],

  [
    "import.named.source",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the source name in an aliased import
        const import_id = create_variable_id(capture);
        const import_statement =
          capture.node.parent?.parent?.parent || capture.node;
        const import_path = extract_import_path(import_statement);

        // Look for alias
        const alias_import = capture.node.parent;
        let alias_name: SymbolName | undefined;
        if (alias_import && alias_import.type === "aliased_import") {
          const alias_node = alias_import.childForFieldName?.("alias");
          if (alias_node) {
            alias_name = alias_node.text as SymbolName;
          }
        }

        builder.add_import({
          symbol_id: import_id,
          name: alias_name || capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: import_path,
          import_kind: "named",
          original_name: capture.text,
        });
      },
    },
  ],

  [
    "import.named.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the alias in an aliased import - skip as it's handled by import.named.source
        return;
      },
    },
  ],

  [
    "import.module",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: capture.text as ModulePath,
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],

  [
    "import.module.source",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the source module in "import X as Y"
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent || capture.node;

        // Look for alias
        let alias_name: SymbolName | undefined;
        if (import_statement.type === "aliased_import") {
          const alias_node = import_statement.childForFieldName?.("alias");
          if (alias_node) {
            alias_name = alias_node.text as SymbolName;
          }
        }

        builder.add_import({
          symbol_id: import_id,
          name: alias_name || capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: capture.text as ModulePath,
          import_kind: "namespace",
          original_name: alias_name ? capture.text : undefined,
        });
      },
    },
  ],

  [
    "import.module.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the alias in "import X as Y" - skip as it's handled by import.module.source
        return;
      },
    },
  ],

  [
    "import.star",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent || capture.node;
        const import_path = extract_import_path(import_statement);

        builder.add_import({
          symbol_id: import_id,
          name: "*" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: import_path,
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],
]);
