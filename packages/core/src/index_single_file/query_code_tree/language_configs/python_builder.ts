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
import type { CaptureNode } from "../../semantic_index";
import type { ProcessingContext } from "../../semantic_index";

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

export function create_class_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return class_symbol(name, location);
}

export function create_method_id(
  capture: CaptureNode,
  class_name?: SymbolName
): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return method_symbol(name, location);
}

export function create_function_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return function_symbol(name, location);
}

export function create_variable_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return variable_symbol(name, location);
}

export function create_parameter_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return parameter_symbol(name, location);
}

export function create_property_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return property_symbol(name, location);
}

export function find_containing_class(
  capture: CaptureNode
): SymbolId | undefined {
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

export function find_containing_callable(capture: CaptureNode): SymbolId {
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

export function determine_availability(name: string): SymbolAvailability {
  // Private members (start with _)
  if (is_private_name(name)) {
    return { scope: "file-private" };
  }

  // Public by default in Python
  return { scope: "public" };
}

export function extract_return_type(node: SyntaxNode): SymbolName | undefined {
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

export function extract_parameter_type(
  node: SyntaxNode
): SymbolName | undefined {
  // Look for type annotation in parameter node
  const typeNode = node.childForFieldName?.("annotation");
  if (typeNode) {
    return typeNode.text as SymbolName;
  }
  return undefined;
}

export function extract_default_value(node: SyntaxNode): string | undefined {
  const defaultNode = node.childForFieldName?.("default");
  if (defaultNode) {
    return defaultNode.text;
  }
  return undefined;
}

export function extract_type_annotation(
  node: SyntaxNode
): SymbolName | undefined {
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

export function extract_initial_value(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (parent && parent.type === "assignment") {
    const valueNode = parent.childForFieldName?.("right");
    if (valueNode) {
      return valueNode.text;
    }
  }
  return undefined;
}

export function extract_extends(node: SyntaxNode): SymbolName[] {
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

export function extract_import_path(node: SyntaxNode): ModulePath {
  // Look for dotted_name or module name
  const moduleNode =
    node.childForFieldName?.("module") ||
    node.children?.find((child) => child.type === "dotted_name");
  if (moduleNode) {
    return moduleNode.text as ModulePath;
  }
  return "" as ModulePath;
}

export function is_async_function(node: SyntaxNode): boolean {
  // Check for async keyword
  return (
    node.children?.some(
      (child) => child.type === "async" || child.text === "async"
    ) || false
  );
}

export function determine_method_type(node: SyntaxNode): {
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
