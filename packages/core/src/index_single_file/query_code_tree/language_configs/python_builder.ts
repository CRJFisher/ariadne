// Python language configuration using builder pattern
import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  ModulePath,
  CallbackContext,
  ExportMetadata,
  FunctionCollectionInfo,
  FilePath,
} from "@ariadnejs/types";
import {
  class_symbol,
  function_symbol,
  method_symbol,
  parameter_symbol,
  property_symbol,
  variable_symbol,
  interface_symbol,
  type_symbol,
  enum_symbol,
  anonymous_function_symbol,
} from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../semantic_index";
import type { ProcessingContext } from "../../semantic_index";
import { node_to_location } from "../../node_utils";

export type ProcessFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

export type LanguageBuilderConfig = Map<string, { process: ProcessFunction }>;

export function create_class_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return class_symbol(name, location);
}

export function create_method_id(capture: CaptureNode): SymbolId {
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

export function create_enum_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  const file_path = location.file_path;
  return `enum:${file_path}:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}:${name}` as SymbolId;
}

export function create_enum_member_id(
  name: string,
  enum_id: SymbolId
): SymbolId {
  return `${enum_id}:${name}` as SymbolId;
}

export function find_containing_class(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node;

  // Traverse up until we find a class
  while (node) {
    if (node.type === "class_definition") {
      const name_node = node.childForFieldName?.("name");
      if (name_node) {
        const class_name = name_node.text as SymbolName;
        return class_symbol(
          class_name,
          node_to_location(name_node, capture.location.file_path)
        );
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

export function find_containing_enum(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node;

  // Traverse up until we find a class_definition
  while (node) {
    if (node.type === "class_definition") {
      // Check if it inherits from Enum
      const superclasses = node.childForFieldName?.("superclasses");
      if (superclasses) {
        const has_enum_base = superclasses.children?.some((child) => {
          if (child.type === "identifier") {
            return /^(Enum|IntEnum|Flag|IntFlag|StrEnum)$/.test(child.text);
          } else if (child.type === "attribute") {
            const attr = child.childForFieldName?.("attribute");
            return (
              attr && /^(Enum|IntEnum|Flag|IntFlag|StrEnum)$/.test(attr.text)
            );
          }
          return false;
        });

        if (has_enum_base) {
          const name_node = node.childForFieldName?.("name");
          if (name_node) {
            const file_path = capture.location.file_path;
            const enum_name = name_node.text as SymbolName;
            return enum_symbol(enum_name, node_to_location(name_node, file_path));
          }
        }
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

export function extract_enum_value(node: SyntaxNode): string | undefined {
  // The node is the identifier (left side of assignment), so we need to get the right side
  const assignment = node.parent;
  if (assignment && assignment.type === "assignment") {
    const value_node = assignment.childForFieldName?.("right");
    if (value_node) {
      return value_node.text;
    }
  }
  return undefined;
}

export function create_protocol_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return interface_symbol(name, location);
}

export function find_containing_protocol(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node;

  // Traverse up until we find a class_definition
  while (node) {
    if (node.type === "class_definition") {
      // Check if it inherits from Protocol
      const superclasses = node.childForFieldName?.("superclasses");
      if (superclasses) {
        const has_protocol_base = superclasses.children?.some((child) => {
          if (child.type === "identifier") {
            return child.text === "Protocol";
          } else if (child.type === "attribute") {
            const attr = child.childForFieldName?.("attribute");
            return attr && attr.text === "Protocol";
          }
          return false;
        });

        if (has_protocol_base) {
          const name_node = node.childForFieldName?.("name");
          if (name_node) {
            const file_path = capture.location.file_path;
            const protocol_name = name_node.text as SymbolName;
            return interface_symbol(
              protocol_name,
              node_to_location(name_node, file_path)
            );
          }
        }
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

export function extract_property_type(
  node: SyntaxNode
): SymbolName | undefined {
  // For annotated assignments, extract the type annotation
  const assignment = node.parent;
  if (assignment && assignment.type === "assignment") {
    const type_node = assignment.childForFieldName?.("type");
    if (type_node) {
      return type_node.text as SymbolName;
    }
  }

  // For Protocol property signatures (x: int without assignment)
  // Pattern: expression_statement contains typed_parameter or type annotation
  // The node might be inside an expression_statement that contains the type
  let current = node.parent;
  while (current) {
    if (current.type === "expression_statement") {
      // Look for type annotation child
      for (const child of current.children || []) {
        if (child.type === "type") {
          return child.text as SymbolName;
        }
      }
      // Also check for typed_parameter pattern
      const type_node = current.childForFieldName?.("type");
      if (type_node) {
        return type_node.text as SymbolName;
      }
      break;
    }
    current = current.parent;
  }

  return undefined;
}

export function find_containing_callable(capture: CaptureNode): SymbolId {
  let node = capture.node;

  // Traverse up until we find a callable
  while (node) {
    if (node.type === "function_definition" || node.type === "lambda") {
      const name_node = node.childForFieldName?.("name");

      if (name_node) {
        // Check if this is a method (inside a class)
        const in_class = find_containing_class({
          node: node,
          text: "",
          name: "",
          location: capture.location,
        } as CaptureNode);
        if (in_class) {
          return method_symbol(
            name_node.text as SymbolName,
            node_to_location(name_node, capture.location.file_path)
          );
        } else {
          return function_symbol(
            name_node.text as SymbolName,
            node_to_location(name_node, capture.location.file_path)
          );
        }
      } else if (node.type === "lambda") {
        // Lambda function - use the location as ID
        return function_symbol(
          "lambda" as SymbolName,
          node_to_location(node, capture.location.file_path)
        );
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

/**
 * Check if a name is a magic/dunder method
 * Examples: __init__, __str__, __special__
 */
function is_magic_name(name: string): boolean {
  return name.startsWith("__") && name.endsWith("__");
}

/**
 * Check if a name is private by Python convention
 *
 * Private names start with underscore but are NOT magic methods.
 *
 * Examples:
 * - _private → true (private)
 * - __private → true (private, double underscore)
 * - __init__ → false (magic method, NOT private)
 * - public → false (not private)
 */
function is_private_name(name: string): boolean {
  return name.startsWith("_") && !is_magic_name(name);
}

function extract_decorators(node: SyntaxNode): SymbolName[] {
  const decorators: SymbolName[] = [];

  // Check if parent is decorated_definition
  const parent = node.parent;
  if (parent && parent.type === "decorated_definition") {
    const decorator_nodes = parent.children.filter(
      (child) => child.type === "decorator"
    );
    for (const decorator of decorator_nodes) {
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

/**
 * Check if a Python symbol is exported and extract export metadata
 *
 * Python export rules:
 * 1. Module-level definitions are importable (unless prefixed with _)
 * 2. Names starting with underscore are private by convention
 * 3. Nested definitions are not importable
 *
 * Privacy rules:
 * - Single underscore prefix (_name): Private by convention
 * - Double underscore prefix (__name): Also private (name mangling in classes)
 * - Dunder methods (__name__): NOT private, these are special/magic methods
 *
 * Examples:
 * - public_func (module) → is_exported = true
 * - _private_func (module) → is_exported = false
 * - __private (module) → is_exported = false
 * - __init__ (module) → is_exported = true (magic method)
 * - nested_func (nested) → is_exported = false
 *
 * @param name - Symbol name to check
 * @param defining_scope_id - Scope where this symbol is defined
 * @param module_scope_id - Root/module scope ID
 * @returns Export info with is_exported flag
 */
export function extract_export_info(
  name: string,
  defining_scope_id: ScopeId,
  module_scope_id: ScopeId
): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  // Names starting with underscore are private (convention)
  // Exception: Dunder methods (__name__) are NOT private
  if (is_private_name(name)) {
    return { is_exported: false };
  }

  // Only module-level definitions are importable
  if (defining_scope_id === module_scope_id) {
    return { is_exported: true };
  }

  // Nested definitions are not importable
  return { is_exported: false };
}

/**
 * Create a type alias symbol ID
 */
export function create_type_alias_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return type_symbol(name, location);
}

/**
 * Extract type expression from type alias value node
 * For Python 3.12+ type statements: type Url = str
 */
export function extract_type_expression(node: SyntaxNode): string | undefined {
  // Traverse up to find the type_alias_statement
  let current: SyntaxNode | null = node;
  while (current) {
    if (current.type === "type_alias_statement") {
      // The value is the last child after the '=' sign
      const children = current.children || [];
      for (let i = 0; i < children.length; i++) {
        if (children[i].type === "=" && i + 1 < children.length) {
          // Return the text of the value type node (excluding 'type' wrapper text if any)
          const value_node = children[i + 1];
          if (value_node.childCount > 0) {
            // Return first child's text (the actual type expression)
            return value_node.child(0)?.text;
          }
          return value_node.text;
        }
      }
      break;
    }
    current = current.parent;
  }
  return undefined;
}

export function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const return_type = node.childForFieldName?.("return_type");
  if (return_type) {
    // Skip the -> arrow if present
    const type_node = return_type.children?.find(
      (child) => child.type === "type"
    );
    return (type_node?.text || return_type.text) as SymbolName;
  }
  return undefined;
}

export function extract_parameter_type(
  node: SyntaxNode
): SymbolName | undefined {
  // Look for type annotation in parameter node
  // The query captures the identifier inside typed_parameter or typed_default_parameter
  // Python's tree-sitter grammar uses "type" field for both
  const param_node =
    node.type === "identifier" &&
    (node.parent?.type === "typed_parameter" || node.parent?.type === "typed_default_parameter")
      ? node.parent
      : node;

  const type_node = param_node.childForFieldName?.("type");
  if (type_node) {
    return type_node.text as SymbolName;
  }
  return undefined;
}

export function extract_default_value(node: SyntaxNode): string | undefined {
  const default_node = node.childForFieldName?.("default");
  if (default_node) {
    return default_node.text;
  }
  return undefined;
}

export function extract_type_annotation(
  node: SyntaxNode
): SymbolName | undefined {
  // Look for type annotation in assignment
  const parent = node.parent;
  if (parent && parent.type === "assignment") {
    const type_node = parent.childForFieldName?.("type");
    if (type_node) {
      return type_node.text as SymbolName;
    }
  }
  return undefined;
}

export function extract_initial_value(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (parent && parent.type === "assignment") {
    const value_node = parent.childForFieldName?.("right");
    if (value_node) {
      return value_node.text;
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
  // For "from X import Y" statements, look for module_name field
  // This handles both absolute (dotted_name) and relative (relative_import) imports
  const module_name_node = node.childForFieldName?.("module_name");
  if (module_name_node) {
    return module_name_node.text as ModulePath;
  }

  // Fallback: Look for "module" field or find dotted_name child
  // This handles "import X" statements
  const module_node =
    node.childForFieldName?.("module") ||
    node.children?.find((child) => child.type === "dotted_name");
  if (module_node) {
    return module_node.text as ModulePath;
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

export function find_decorator_target(
  capture: CaptureNode
): SymbolId | undefined {
  // Traverse up from decorator to find the decorated_definition, then get the actual definition
  let node = capture.node.parent;

  while (node) {
    if (node.type === "decorated_definition") {
      // Get the definition child (function_definition or class_definition)
      const definition = node.childForFieldName?.("definition");

      if (definition) {
        if (definition.type === "function_definition") {
          const name_node = definition.childForFieldName?.("name");
          if (name_node) {
            const file_path = capture.location.file_path;

            // Check if this is a method (inside a class)
            const class_node = find_containing_class({
              node: definition,
              text: "",
              name: "",
              location: capture.location,
            } as CaptureNode);

            if (class_node) {
              // It's a method or constructor
              const method_name = name_node.text as SymbolName;
              return method_symbol(method_name, {
                file_path,
                start_line: name_node.startPosition.row + 1,
                start_column: name_node.startPosition.column + 1,
                end_line: name_node.endPosition.row + 1,
                end_column: name_node.endPosition.column,
              });
            } else {
              // It's a function
              return function_symbol(name_node.text as SymbolName, {
                file_path,
                start_line: name_node.startPosition.row + 1,
                start_column: name_node.startPosition.column + 1,
                end_line: name_node.endPosition.row + 1,
                end_column: name_node.endPosition.column,
              });
            }
          }
        } else if (definition.type === "class_definition") {
          const name_node = definition.childForFieldName?.("name");
          if (name_node) {
            const file_path = capture.location.file_path;
            return class_symbol(name_node.text as SymbolName, {
              file_path,
              start_line: name_node.startPosition.row + 1,
              start_column: name_node.startPosition.column + 1,
              end_line: name_node.endPosition.row + 1,
              end_column: name_node.endPosition.column,
            });
          }
        }
      }
      break;
    }

    node = node.parent;
  }

  return undefined;
}

/**
 * Detect if a lambda/anonymous function is passed as a callback argument.
 * Walks up the AST to find if the function is inside an argument_list.
 */
export function detect_callback_context(
  node: SyntaxNode,
  file_path: FilePath
): CallbackContext {
  let current: SyntaxNode | null = node.parent;
  let depth = 0;
  const MAX_DEPTH = 5;

  while (current && depth < MAX_DEPTH) {
    // Python uses 'argument_list' for function call arguments
    if (current.type === "argument_list") {
      const call_node = current.parent;
      // Python uses 'call' for function calls
      if (call_node && call_node.type === "call") {
        return {
          is_callback: true,
          receiver_is_external: null,
          receiver_location: node_to_location(call_node, file_path),
        };
      }
    }
    current = current.parent;
    depth++;
  }

  return {
    is_callback: false,
    receiver_is_external: null,
    receiver_location: null,
  };
}

/**
 * Detect if a variable assignment contains a function collection (list/dict/tuple with functions).
 * Returns collection metadata if detected, null otherwise.
 *
 * Patterns detected:
 * - handlers = [fn1, fn2, fn3]
 * - config = {"success": handle_success, "error": handle_error}
 * - callbacks = (on_start, on_end, on_error)
 */
export function detect_function_collection(
  node: SyntaxNode,
  file_path: FilePath
): FunctionCollectionInfo | null {
  // Get the assignment node
  let assignment = node;
  if (node.type !== "assignment") {
    assignment = node.parent || node;
  }

  // Get the right side (value being assigned)
  const value_node = assignment.childForFieldName?.("right");
  if (!value_node) return null;



  // Check for list literal: [fn1, fn2, fn3]
  if (value_node.type === "list") {
    const { functions, references } = extract_functions_from_list(value_node, file_path);
    if (functions.length > 0 || references.length > 0) {
      return {
        collection_type: "Array",
        location: node_to_location(value_node, file_path),
        stored_functions: functions,
        stored_references: references,
      };
    }
  }

  // Check for dict literal: {"key": fn, ...}
  if (value_node.type === "dictionary") {
    const { functions, references } = extract_functions_from_dict(value_node, file_path);
    if (functions.length > 0 || references.length > 0) {
      return {
        collection_type: "Object",
        location: node_to_location(value_node, file_path),
        stored_functions: functions,
        stored_references: references,
      };
    }
  }

  // Check for tuple literal: (fn1, fn2, fn3)
  if (value_node.type === "tuple") {
    const { functions, references } = extract_functions_from_list(value_node, file_path);
    if (functions.length > 0 || references.length > 0) {
      return {
        collection_type: "Array",
        location: node_to_location(value_node, file_path),
        stored_functions: functions,
        stored_references: references,
      };
    }
  }

  return null;
}

/**
 * Extract the name of the variable this definition is derived from.
 * Used to track variables assigned from collection lookups.
 *
 * Patterns detected:
 * 1. handler = config.get("key")  -> returns "config"
 * 2. handler = config["key"]      -> returns "config"
 */
export function extract_derived_from(node: SyntaxNode): SymbolName | undefined {
  // Get initial value node (right side of assignment)
  let assignment = node;
  if (node.type === "identifier" || node.type === "attribute") {
    assignment = node.parent || node;
  }

  if (assignment.type !== "assignment") {
    // Try to find parent assignment
    let current = node.parent;
    while (current) {
      if (current.type === "assignment") {
        assignment = current;
        break;
      }
      current = current.parent;
    }
  }

  if (assignment.type !== "assignment") {
    return undefined;
  }

  const value_node = assignment.childForFieldName?.("right");
  if (!value_node) {
    return undefined;
  }

  // Case 1: Method call (config.get(...))
  if (value_node.type === "call") {
    const function_node = value_node.childForFieldName?.("function");
    if (function_node?.type === "attribute") {
      const object_node = function_node.childForFieldName?.("object");
      const attribute_node = function_node.childForFieldName?.("attribute");
      
      if (object_node?.type === "identifier" && attribute_node?.text === "get") {
        return object_node.text as SymbolName;
      }
    }
  }

  // Case 2: Subscript access (config[...])
  if (value_node.type === "subscript") {
    const value = value_node.childForFieldName?.("value");
    if (value?.type === "identifier") {
      return value.text as SymbolName;
    }
  }

  return undefined;
}

/**
 * Extract function SymbolIds from Python list or tuple: [fn1, fn2] or (fn1, fn2)
 */
function extract_functions_from_list(
  list_node: SyntaxNode,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[] } {
  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];

  for (let i = 0; i < list_node.namedChildCount; i++) {
    const element = list_node.namedChild(i);
    if (!element) continue;

    if (element.type === "lambda") {
      const location = node_to_location(element, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (element.type === "identifier") {
      references.push(element.text as SymbolName);
    }
  }

  return { functions: function_ids, references };
}

/**
 * Extract function SymbolIds from Python dict: {"key": fn, ...}
 */
function extract_functions_from_dict(
  dict_node: SyntaxNode,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[] } {
  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];

  for (let i = 0; i < dict_node.namedChildCount; i++) {
    const pair = dict_node.namedChild(i);
    if (pair?.type !== "pair") continue;

    const value = pair.childForFieldName?.("value");
    if (!value) continue;

    if (value.type === "lambda") {
      const location = node_to_location(value, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (value.type === "identifier") {
      references.push(value.text as SymbolName);
    }
  }

  return { functions: function_ids, references };
}
