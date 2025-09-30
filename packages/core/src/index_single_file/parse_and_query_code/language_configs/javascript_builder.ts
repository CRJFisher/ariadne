/**
 * JavaScript/TypeScript language configuration using builder pattern
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
// Helper Functions for JavaScript/TypeScript
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
function create_method_id(capture: RawCapture): SymbolId {
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
 * Create an import symbol ID
 */
function create_import_id(capture: RawCapture): SymbolId {
  const name = extract_symbol_name(capture);
  const location = extract_location(capture.node);
  return variable_symbol(name, location); // Imports are like variables in the local scope
}

/**
 * Find containing class by traversing up the AST
 */
function find_containing_class(capture: RawCapture): SymbolId | undefined {
  let node = capture.node;

  // Traverse up until we find a class
  while (node) {
    if (node.type === 'class_declaration' || node.type === 'class') {
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
    if (node.type === 'function_declaration' || node.type === 'function_expression' ||
        node.type === 'arrow_function' || node.type === 'method_definition') {
      const nameNode = node.childForFieldName?.('name');

      if (node.type === 'method_definition') {
        const methodName = nameNode ? nameNode.text : "anonymous";
        return method_symbol(methodName as SymbolName, extract_location(nameNode || node));
      } else if (nameNode) {
        // Named function
        return function_symbol(nameNode.text as SymbolName, extract_location(nameNode));
      } else {
        // Anonymous function/arrow function - use the location as ID
        return function_symbol("anonymous" as SymbolName, extract_location(node));
      }
    }
    node = node.parent;
  }
  // Default to unknown function
  return function_symbol("anonymous" as SymbolName, extract_location(capture.node));
}

/**
 * Determine availability based on node context
 */
function determine_availability(node: SyntaxNode): SymbolAvailability {
  // Check for export modifier
  let current: SyntaxNode | null = node;
  while (current) {
    if (current.parent?.type === 'export_statement') {
      return { scope: 'public' };
    }
    current = current.parent;
  }
  return { scope: 'file-private' };
}

/**
 * Determine method availability
 */
function determine_method_availability(node: SyntaxNode): SymbolAvailability {
  // Check for private/protected/public modifiers
  const parent = node.parent;
  if (parent) {
    const modifiers = parent.children?.filter((c: any) =>
      c.type === 'private' || c.type === 'protected' || c.type === 'public'
    );
    if (modifiers?.length > 0) {
      const modifier = modifiers[0].type;
      // Map TypeScript visibility to SymbolAvailability scope values
      if (modifier === 'private' || modifier === 'protected') {
        return { scope: 'file-private' }; // Private/protected are not exportable
      }
    }
  }
  return { scope: 'public' };
}

/**
 * Determine property availability
 */
function determine_property_availability(node: SyntaxNode): SymbolAvailability {
  return determine_method_availability(node);
}

/**
 * Extract return type from function/method node
 */
function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const returnType = node.childForFieldName?.('return_type');
  if (returnType) {
    return returnType.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract parameter type
 */
function extract_parameter_type(node: SyntaxNode): SymbolName | undefined {
  const typeNode = node.childForFieldName?.('type');
  if (typeNode) {
    return typeNode.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract property type
 */
function extract_property_type(node: SyntaxNode): SymbolName | undefined {
  return extract_parameter_type(node);
}

/**
 * Extract type annotation
 */
function extract_type_annotation(node: SyntaxNode): SymbolName | undefined {
  const typeAnnotation = node.childForFieldName?.('type');
  if (typeAnnotation) {
    return typeAnnotation.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract initial value
 */
function extract_initial_value(node: SyntaxNode): string | undefined {
  const valueNode = node.childForFieldName?.('value') || node.childForFieldName?.('init');
  if (valueNode) {
    return valueNode.text;
  }
  return undefined;
}

/**
 * Extract default value
 */
function extract_default_value(node: SyntaxNode): string | undefined {
  return extract_initial_value(node);
}

/**
 * Extract import path from import statement
 */
function extract_import_path(node: SyntaxNode): ModulePath {
  const source = node.childForFieldName?.('source');
  if (source) {
    // Remove quotes from the string literal
    const text = source.text;
    return text.slice(1, -1) as ModulePath;
  }
  return "" as ModulePath;
}

/**
 * Extract original name for aliased imports
 */
function extract_original_name(node: SyntaxNode, local_name: SymbolName): SymbolName | undefined {
  // Check if this is an aliased import
  const importClause = node.childForFieldName?.('import_clause');
  if (importClause) {
    const namedImports = importClause.childForFieldName?.('named_imports');
    if (namedImports) {
      for (const child of namedImports.children || []) {
        if (child.type === 'import_specifier') {
          const alias = child.childForFieldName?.('alias');
          if (alias?.text === local_name) {
            const name = child.childForFieldName?.('name');
            return name?.text as SymbolName;
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Check if this is a default import
 */
function is_default_import(node: SyntaxNode, name: SymbolName): boolean {
  const importClause = node.childForFieldName?.('import_clause');
  if (importClause) {
    const defaultImport = importClause.childForFieldName?.('default');
    return defaultImport?.text === name;
  }
  return false;
}

/**
 * Check if this is a namespace import
 */
function is_namespace_import(node: SyntaxNode): boolean {
  const importClause = node.childForFieldName?.('import_clause');
  if (importClause) {
    const namespaceImport = importClause.childForFieldName?.('namespace_import');
    return namespaceImport !== undefined;
  }
  return false;
}

/**
 * Extract extends classes
 */
function extract_extends(node: SyntaxNode): SymbolName[] {
  const heritage = node.childForFieldName?.('heritage');
  if (heritage) {
    const superclass = heritage.childForFieldName?.('superclass') || heritage.childForFieldName?.('parent');
    if (superclass) {
      return [superclass.text as SymbolName];
    }
  }
  return [];
}

// ============================================================================
// JavaScript/TypeScript Builder Configuration
// ============================================================================

export const JAVASCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // ============================================================================
  // DEFINITIONS
  // ============================================================================

  ["def.class", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const class_id = create_class_id(capture);
      const extends_clause = capture.node.childForFieldName?.('heritage');

      builder.add_class({
        symbol_id: class_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(capture.node),
        extends: extends_clause ? extract_extends(capture.node) : []
      });
    }
  }],

  ["def.method", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_method_to_class(class_id, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: determine_method_availability(capture.node),
          return_type: extract_return_type(capture.node)
        });
      }
    }
  }],

  ["def.constructor", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      // Constructor will be added as a special method to the containing class
      const class_id = find_containing_class(capture);
      if (class_id) {
        const constructor_id = method_symbol("constructor" as SymbolName, extract_location(capture.node));
        builder.add_method_to_class(class_id, {
          symbol_id: constructor_id,
          name: "constructor" as SymbolName,
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: determine_method_availability(capture.node),
          return_type: undefined
        });
      }
    }
  }],

  ["def.function", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(capture.node)
      });
    }
  }],

  ["def.arrow", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(capture.node)
      });
    }
  }],

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

  ["def.parameter", {
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

  ["def.variable", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);

      // Check for const by looking at parent (variable_declarator) and its parent (lexical_declaration)
      let is_const = false;
      const parent = capture.node.parent; // variable_declarator
      if (parent && parent.parent) {
        const lexicalDecl = parent.parent; // lexical_declaration
        if (lexicalDecl.type === 'lexical_declaration') {
          // Check the first token for 'const'
          const firstChild = lexicalDecl.firstChild;
          if (firstChild && firstChild.type === 'const') {
            is_const = true;
          }
        }
      }

      builder.add_variable({
        kind: is_const ? 'constant' : 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: determine_availability(capture.node),
        type: extract_type_annotation(capture.node),
        initial_value: extract_initial_value(capture.node)
      });
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
          availability: determine_property_availability(capture.node),
          type: extract_property_type(capture.node),
          initial_value: extract_initial_value(capture.node)
        });
      }
    }
  }],

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
          availability: determine_property_availability(capture.node),
          type: extract_property_type(capture.node),
          initial_value: extract_initial_value(capture.node)
        });
      }
    }
  }],

  // ============================================================================
  // IMPORTS
  // ============================================================================

  ["def.import", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const import_id = create_import_id(capture);
      const import_node = capture.node.parent; // Get full import statement

      builder.add_import({
        symbol_id: import_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: extract_import_path(import_node),
        original_name: extract_original_name(import_node, extract_symbol_name(capture)),
        is_default: is_default_import(import_node, extract_symbol_name(capture)),
        is_namespace: is_namespace_import(import_node)
      });
    }
  }],

  ["import.named", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const import_id = create_import_id(capture);
      // Navigate up to find import statement
      let import_stmt = capture.node.parent;
      while (import_stmt && import_stmt.type !== 'import_statement') {
        import_stmt = import_stmt.parent;
      }

      builder.add_import({
        symbol_id: import_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: extract_import_path(import_stmt),
        original_name: extract_original_name(import_stmt, extract_symbol_name(capture)),
        is_default: false,
        is_namespace: false
      });
    }
  }],

  ["import.default", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const import_id = create_import_id(capture);
      const import_stmt = capture.node.parent?.parent; // import_clause -> import_statement

      builder.add_import({
        symbol_id: import_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: extract_import_path(import_stmt),
        original_name: undefined,
        is_default: true,
        is_namespace: false
      });
    }
  }],

  ["import.namespace", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const import_id = create_import_id(capture);
      // Navigate up to import statement
      let import_stmt = capture.node.parent;
      while (import_stmt && import_stmt.type !== 'import_statement') {
        import_stmt = import_stmt.parent;
      }

      builder.add_import({
        symbol_id: import_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: 'file-private' },
        import_path: extract_import_path(import_stmt),
        original_name: undefined,
        is_default: false,
        is_namespace: true
      });
    }
  }],
]);