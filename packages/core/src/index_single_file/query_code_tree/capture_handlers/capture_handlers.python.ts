/**
 * Python capture handlers
 *
 * Named, exported handler functions for processing Python tree-sitter captures.
 * Includes handlers for classes, methods, functions, parameters, variables,
 * imports, decorators, protocols, enums, and type aliases.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";
import {
  anonymous_function_symbol,
  interface_symbol,
  property_symbol,
} from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";
import { node_to_location } from "../../node_to_location";
import type { HandlerRegistry } from "./handler_types";
import {
  classify_class_bases,
  find_owning_class_node,
  create_class_id,
  extract_extends,
  extract_export_info,
  create_method_id,
  find_containing_class,
  determine_method_type,
  determine_accessor_kind,
  is_async_function,
  extract_return_type,
  create_property_id,
  extract_type_annotation,
  extract_initial_value,
  create_function_id,
  create_parameter_id,
  find_containing_callable,
  extract_parameter_type,
  extract_default_value,
  create_variable_id,
  find_decorator_target,
  create_enum_id,
  create_enum_member_id,
  find_containing_enum,
  extract_enum_value,
  create_protocol_id,
  find_containing_protocol,
  extract_property_type,
  create_type_alias_id,
  extract_type_expression,
  detect_callback_context,
  detect_function_collection,
  extract_collection_source,
} from "../symbol_factories/symbol_factories.python";
import {
  store_python_docstring,
  consume_python_docstring,
} from "../symbol_factories/documentation_state.python";
import { handle_definition_import } from "./imports.python";

// ============================================================================
// DOCUMENTATION HANDLERS
// ============================================================================

export function handle_definition_documentation(
  capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  store_python_docstring(capture);
}

// ============================================================================
// CLASS HANDLERS
// ============================================================================

export function handle_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // The query emits one capture per class whatever its base shapes; Enum and
  // Protocol classes are discriminated here so a class builds exactly one
  // definition (a co-firing query discriminator would forge duplicate exports).
  // Discrimination reads the captured class's own bases only — a walk-up
  // helper would re-kind a plain class nested inside an Enum/Protocol body.
  const base_kind = classify_class_bases(capture.node.parent);
  if (base_kind === "interface") {
    return handle_definition_interface(capture, builder, context);
  }
  if (base_kind === "enum") {
    return handle_definition_enum(capture, builder, context);
  }

  const class_id = create_class_id(capture);
  const base_classes = extract_extends(capture.node.parent || capture.node);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );
  const docstring = consume_python_docstring(capture.location.start_line);

  builder.add_class({
    symbol_id: class_id,
    name: capture.text,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    extends: base_classes,
    docstring: docstring ? [docstring] : undefined,
  });
}

// ============================================================================
// METHOD HANDLERS
// ============================================================================

export function handle_definition_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const name = capture.text;

  // Skip __init__ - handled by definition.constructor
  if (name === "__init__") {
    return;
  }

  const docstring = consume_python_docstring(capture.location.start_line);

  // A method belongs to the class that owns it, so the Protocol test reads the
  // nearest class's own bases — walking up would attribute a nested plain
  // class's methods to an enclosing Protocol.
  const owning_class = find_owning_class_node(capture);
  if (owning_class && classify_class_bases(owning_class) === "interface") {
    const owning_class_name = owning_class.childForFieldName("name");
    if (owning_class_name) {
      builder.add_method_signature_to_interface(
        interface_symbol(
          owning_class_name.text as SymbolName,
          node_to_location(owning_class_name, capture.location.file_path)
        ),
        {
          symbol_id: method_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          return_type: extract_return_type(capture.node.parent || capture.node),
        }
      );
      return;
    }
  }

  // An Enum class is built as an enum, so its methods attach to the enum. The
  // class branch below mints a class symbol, which no enum state answers to,
  // and the method would be dropped.
  if (owning_class && classify_class_bases(owning_class) === "enum") {
    const enum_id = find_containing_enum(capture);
    if (enum_id) {
      builder.add_method_to_enum(enum_id, {
        symbol_id: method_id,
        name: name,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        return_type: extract_return_type(capture.node.parent || capture.node),
        ...determine_method_type(capture.node.parent || capture.node),
        async: is_async_function(capture.node.parent || capture.node),
        docstring,
      });
      return;
    }
  }

  // Regular class method
  const class_id = find_containing_class(capture);
  if (class_id) {
    const method_type = determine_method_type(capture.node.parent || capture.node);
    const accessor_kind = determine_accessor_kind(
      capture.node.parent || capture.node
    );
    const is_async = is_async_function(capture.node.parent || capture.node);

    builder.add_method_to_class(
      class_id,
      {
        symbol_id: method_id,
        name: name,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        return_type: extract_return_type(capture.node.parent || capture.node),
        ...method_type,
        accessor_kind,
        async: is_async,
        docstring,
      },
    );
  }
}

export function handle_definition_constructor(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // __init__ method - treat as constructor
  const method_id = create_method_id(capture);
  const class_id = find_containing_class(capture);

  if (class_id) {
    builder.add_constructor_to_class(
      class_id,
      {
        symbol_id: method_id,
        name: "__init__" as SymbolName,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
      },
      capture
    );
  }
}

// ============================================================================
// PROPERTY HANDLERS
// ============================================================================

export function handle_definition_field(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const prop_id = create_property_id(capture);
  const class_id = find_containing_class(capture);

  if (class_id) {
    builder.add_property_to_class(class_id, {
      symbol_id: prop_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      type: extract_type_annotation(capture.node),
      initial_value: extract_initial_value(capture.node),
    });
  }
}

// A constructor callee is a class name, which Python spells in CapWords
// (PEP 8), optionally with leading underscores for a private class. This
// distinguishes `self.x = Database()` (a typed construction) from
// `self.x = helper()` (a transient call result), since indexing has no
// cross-file class table to resolve the callee against.
const CONSTRUCTOR_NAME = /^_*[A-Z]/;

/**
 * Extract the constructed type from an assignment's right-hand side.
 *
 * `self.x = Database()` yields `Database` from the bare-identifier callee;
 * `self.x = pd.DataFrame()` yields the last segment `DataFrame` from the
 * namespace-qualified attribute callee — the same last-segment rule
 * `extract_constructor_bindings` applies to namespace-qualified constructors.
 * A call whose callee is not CapWords (e.g. `helper()`, `obj.transform()`) is
 * a plain call result, not a construction, and yields `undefined`.
 */
function extract_constructor_rhs_type(
  right: SyntaxNode | null
): SymbolName | undefined {
  if (right?.type !== "call") return undefined;
  const callee = right.childForFieldName("function");
  let name: string | undefined;
  if (callee?.type === "identifier") name = callee.text;
  else if (callee?.type === "attribute") {
    name = callee.childForFieldName("attribute")?.text;
  }
  if (!name || !CONSTRUCTOR_NAME.test(name)) return undefined;
  return name as SymbolName;
}

/**
 * Handle `self.attr = value` assignments inside class methods.
 *
 * Creates a PropertyDefinition on the containing class for instance attributes
 * so a later `self.attr.method()` resolves against the attribute's type. The
 * `@assignment.property` capture in python.scm fires for all `obj.attr = value`
 * patterns; this handler keeps only `self.X = ...` assignments in a direct
 * method body of the class.
 *
 * Inside `__init__`, every distinct attribute is promoted (typed or not) — the
 * canonical declaration site. Outside `__init__`, only a constructor RHS
 * promotes; an untyped transient mutation in an arbitrary method is not a
 * declaration. Promotion is deduped by attribute name (see
 * `add_inferred_property_to_class`): the first assignment of an attribute wins
 * and a later typed assignment upgrades an earlier untyped one.
 */
export function handle_assignment_property(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const assignment_node = capture.node;

  // Get the left side (attribute node: self.attr)
  const left = assignment_node.childForFieldName("left");
  if (!left || left.type !== "attribute") return;

  const object_node = left.childForFieldName("object");
  const attr_node = left.childForFieldName("attribute");
  if (!object_node || !attr_node) return;

  // Only handle self.X assignments
  if (object_node.type !== "identifier" || object_node.text !== "self") return;

  // Promote only from a direct method body — the nearest enclosing function
  // must sit directly in the class block, never a nested function.
  let enclosing_function = assignment_node.parent;
  while (
    enclosing_function &&
    enclosing_function.type !== "function_definition"
  ) {
    enclosing_function = enclosing_function.parent;
  }
  if (!enclosing_function) return;
  const method_block = enclosing_function.parent;
  if (
    method_block?.type !== "block" ||
    method_block.parent?.type !== "class_definition"
  ) {
    return;
  }
  const in_init =
    enclosing_function.childForFieldName("name")?.text === "__init__";

  const right = assignment_node.childForFieldName("right");
  const rhs_type = extract_constructor_rhs_type(right);

  // Outside __init__, only a typed/constructor RHS is a declaration worth promoting.
  if (!in_init && rhs_type === undefined) return;

  const class_id = find_containing_class(capture);
  if (!class_id) return;

  const attr_name = attr_node.text as SymbolName;
  const attr_location = node_to_location(attr_node, capture.location.file_path);

  builder.add_inferred_property_to_class(class_id, {
    symbol_id: property_symbol(attr_name, attr_location),
    name: attr_name,
    location: attr_location,
    scope_id: context.get_scope_id(capture.location),
    type: rhs_type,
  });
}

// ============================================================================
// FUNCTION HANDLERS
// ============================================================================

export function handle_definition_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const func_id = create_function_id(capture);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );
  const docstring = consume_python_docstring(capture.location.start_line);

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: defining_scope_id,
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node.parent || capture.node),
      docstring,
    },
    capture
  );
}

export function handle_definition_anonymous_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Generate location-based symbol ID for anonymous lambda
  const anon_id = anonymous_function_symbol(capture.location);
  const scope_id = context.get_scope_id(capture.location);

  // Detect if this lambda is a callback
  const callback_context = detect_callback_context(
    capture.node,
    capture.location.file_path
  );

  builder.add_anonymous_function(
    {
      symbol_id: anon_id,
      location: capture.location,
      scope_id: scope_id,
      return_type: extract_return_type(capture.node),
      callback_context: callback_context,
    },
    capture
  );
}

// ============================================================================
// PARAMETER HANDLERS
// ============================================================================

export function handle_definition_parameter(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

// ============================================================================
// VARIABLE HANDLERS
// ============================================================================

export function handle_definition_variable(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);
  const name = capture.text;

  // Check if this is a constant (UPPER_CASE convention)
  const is_const = name === name.toUpperCase() && name.includes("_");

  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    name,
    defining_scope_id,
    context.root_scope_id
  );

  // Detect function collections
  const parent = capture.node.parent;
  const collection_info = parent
    ? detect_function_collection(parent, capture.location.file_path)
    : null;
  const function_collection = collection_info
    ? {
        ...collection_info,
        collection_id: var_id,
      }
    : undefined;

  const collection_source = extract_collection_source(capture.node);

  builder.add_variable({
    kind: is_const ? "constant" : "variable",
    symbol_id: var_id,
    name: name,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: extract_type_annotation(capture.node),
    initial_value: extract_initial_value(capture.node),
    function_collection,
    collection_source,
  });
}

// ============================================================================
// PROTOCOL HANDLERS
// ============================================================================

export function handle_definition_interface(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const protocol_id = create_protocol_id(capture);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_interface({
    symbol_id: protocol_id,
    name: capture.text,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
  });
}

export function handle_definition_property_interface(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const protocol_id = find_containing_protocol(capture);
  if (!protocol_id) return;

  // Only process if there's a type annotation (Protocol property signatures)
  const prop_type = extract_property_type(capture.node);
  if (!prop_type) return;

  const prop_id = create_property_id(capture);

  builder.add_property_signature_to_interface(protocol_id, {
    symbol_id: prop_id,
    name: capture.text,
    location: capture.location,
    type: prop_type,
    scope_id: context.get_scope_id(capture.location),
  });
}

// ============================================================================
// ENUM HANDLERS
// ============================================================================

export function handle_definition_enum(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const enum_id = create_enum_id(capture);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_enum({
    symbol_id: enum_id,
    name: capture.text,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
  });
}

export function handle_definition_enum_member(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  const enum_id = find_containing_enum(capture);
  if (!enum_id) return;

  const member_id = create_enum_member_id(capture.text, enum_id);
  const value = extract_enum_value(capture.node);

  builder.add_enum_member(enum_id, {
    symbol_id: member_id,
    name: capture.text,
    location: capture.location,
    value,
  });
}

// ============================================================================
// DECORATOR HANDLERS
// ============================================================================

export function handle_decorator_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const target_id = find_decorator_target(capture);
  if (!target_id) return;

  const decorator_name = capture.text;

  builder.add_decorator_to_target(target_id, {
    name: decorator_name,
    defining_scope_id: context.get_scope_id(capture.location),
    location: capture.location,
  });
}

// ============================================================================
// TYPE ALIAS HANDLERS
// ============================================================================

export function handle_definition_type_alias(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const type_id = create_type_alias_id(capture);
  const type_expression = extract_type_expression(capture.node) as SymbolName | undefined;
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_type_alias({
    kind: "type_alias",
    symbol_id: type_id,
    name: capture.text,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    type_expression,
  });
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const PYTHON_HANDLERS: HandlerRegistry = {
  // Documentation
  "definition.documentation": handle_definition_documentation,

  // Classes
  "definition.class": handle_definition_class,

  // Methods
  "definition.method": handle_definition_method,
  "definition.constructor": handle_definition_constructor,

  // Properties
  "definition.field": handle_definition_field,
  "assignment.property": handle_assignment_property,

  // Functions
  "definition.function": handle_definition_function,
  "definition.anonymous_function": handle_definition_anonymous_function,

  // Parameters
  "definition.parameter": handle_definition_parameter,

  // Variables
  "definition.variable": handle_definition_variable,

  // Imports
  "definition.import": handle_definition_import,

  // Protocols (definition.class discriminates and routes to the interface/enum
  // handlers; only their member captures dispatch directly)
  "definition.property.interface": handle_definition_property_interface,

  // Enums
  "definition.enum_member": handle_definition_enum_member,

  // Decorators
  "decorator.method": handle_decorator_method,

  // Type aliases
  "definition.type_alias": handle_definition_type_alias,
} as const;
