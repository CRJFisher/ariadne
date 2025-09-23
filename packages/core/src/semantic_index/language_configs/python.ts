/**
 * Python capture mapping configuration
 *
 * Handles Python-specific patterns:
 * - Decorators (@property, @staticmethod, custom decorators)
 * - Magic methods (__init__, __str__, etc.)
 * - Implicit export model (all top-level symbols exportable)
 * - Python scoping rules (comprehensions, with statements)
 * - Type annotations and hints
 */

import type { SyntaxNode } from "tree-sitter";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
  type SemanticModifiers,
  type CaptureContext,
} from "../capture_types";

/**
 * Helper to check if a method has a specific decorator
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
 * Helper to check if a name is a magic method/attribute
 */
function is_magic_name(name: string): boolean {
  return name.startsWith("__") && name.endsWith("__");
}

/**
 * Helper to check if a name is private by Python convention
 */
function is_private_name(name: string): boolean {
  return name.startsWith("_") && !is_magic_name(name);
}

/**
 * Helper to extract decorator context
 */
function extract_decorator_context(node: SyntaxNode): CaptureContext {
  if (node.type === "identifier") {
    // Look for the function this decorator is applied to
    let current = node.parent;
    while (current) {
      if (current.type === "decorated_definition") {
        const func = current.children.find(
          (child) => child.type === "function_definition"
        );
        if (func) {
          const name_node = func.children.find(
            (child) => child.type === "identifier"
          );
          return {
            decorator_name: node.text,
            decorates: name_node?.text,
          };
        }
      }
      current = current.parent;
    }
  }
  return { decorator_name: node.text };
}

/**
 * Helper to extract method modifiers based on decorators and context
 */
function extract_method_modifiers(node: SyntaxNode): SemanticModifiers {
  const modifiers: SemanticModifiers = {};
  const name = node.text;

  // Check for magic methods
  if (is_magic_name(name)) {
    modifiers.is_abstract = name === "__init__"; // Constructor
  }

  // Check for private methods (by convention)
  if (is_private_name(name)) {
    modifiers.is_private = true;
  }

  // Check for specific decorators
  if (has_decorator(node, "staticmethod")) {
    modifiers.is_static = true;
  }

  if (has_decorator(node, "classmethod")) {
    modifiers.is_abstract = true; // Use abstract flag for classmethod
  }

  if (has_decorator(node, "property")) {
    modifiers.is_readonly = true; // Use readonly flag for property
  }

  return modifiers;
}

/**
 * Helper to extract function modifiers
 */
function extract_function_modifiers(node: SyntaxNode): SemanticModifiers {
  const modifiers: SemanticModifiers = {};

  // Check for async functions
  const func = node.parent;
  if (func && func.type === "function_definition") {
    const has_async = func.children.some(
      (child) => child.type === "async" || child.text === "async"
    );
    if (has_async) {
      modifiers.is_async = true;
    }
  }

  // Check for generator functions (functions with yield)
  if (func) {
    const body = func.children.find((child) => child.type === "block");
    if (body && body.text.includes("yield")) {
      modifiers.is_generator = true;
    }
  }

  return modifiers;
}

/**
 * Map Python tree-sitter captures to normalized semantic concepts
 */
export const PYTHON_CAPTURE_CONFIG: LanguageCaptureConfig = new Map<
  string,
  CaptureMapping
>([
  // ============================================================================
  // SCOPES - Define lexical boundaries
  // ============================================================================
  [
    "scope.module",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.MODULE,
    },
  ],
  [
    "scope.function",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "scope.lambda",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "scope.method",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.METHOD,
    },
  ],
  [
    "scope.class",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.CLASS,
    },
  ],
  [
    "scope.block",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  // All Python control flow blocks map to BLOCK
  [
    "scope.for",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.while",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.with",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.if",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.elif",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.else",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.try",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.except",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.finally",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.match",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.case",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  // Comprehensions create their own scopes
  [
    "scope.comprehension",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],

  // ============================================================================
  // DEFINITIONS - Symbols that introduce new names
  // ============================================================================
  [
    "def.function",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: extract_function_modifiers,
    },
  ],
  [
    "def.function.async",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_async: true }),
    },
  ],
  [
    "def.lambda",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "def.class",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS,
      context: (node) => {
        // Look for class inheritance
        const class_def = node.parent;
        if (class_def && class_def.type === "class_definition") {
          const heritage = class_def.children.find(
            (child) => child.type === "argument_list"
          );
          if (heritage) {
            const extends_class = heritage.children.find(
              (child) => child.type === "identifier"
            )?.text;
            return extends_class ? { extends_class } : {};
          }
        }
        return {};
      },
    },
  ],
  [
    "def.method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: extract_method_modifiers,
    },
  ],
  [
    "def.method.static",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_static: true }),
    },
  ],
  [
    "def.method.class",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_abstract: true }), // Use abstract for classmethod
    },
  ],
  [
    "def.constructor",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],
  [
    "def.property",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PROPERTY,
      modifiers: () => ({ is_readonly: true }),
    },
  ],
  [
    "def.field",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FIELD,
    },
  ],
  [
    "def.variable",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: (node) => ({
        is_private: is_private_name(node.text),
      }),
    },
  ],
  [
    "def.variable.typed",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: (node) => ({
        is_private: is_private_name(node.text),
      }),
    },
  ],
  [
    "def.variable.multiple",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.variable.tuple",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.variable.destructured",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.param",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
    },
  ],
  [
    "def.param.default",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_optional: true }),
    },
  ],
  [
    "def.param.typed",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
    },
  ],
  [
    "def.param.typed.default",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_optional: true }),
    },
  ],
  [
    "def.param.args",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_generator: true }), // Use generator for *args
    },
  ],
  [
    "def.param.kwargs",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_namespace: true }), // Use namespace for **kwargs
    },
  ],
  // Loop and comprehension variables
  [
    "def.loop_var",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.loop_var.multiple",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.comprehension_var",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.except_var",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.with_var",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],

  // ============================================================================
  // IMPORTS - Python's import system
  // ============================================================================
  [
    "import.module",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.NAMESPACE,
    },
  ],
  [
    "import.module.source",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.NAMESPACE,
    },
  ],
  [
    "import.module.alias",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.NAMESPACE,
    },
  ],
  [
    "import.source",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.MODULE,
      context: (node) => ({ source_module: node.text.replace(/['"]/g, "") }),
    },
  ],
  [
    "import.named",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "import.named.source",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "import.named.alias",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "import.star",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.NAMESPACE,
      modifiers: () => ({ is_namespace: true }),
    },
  ],
  [
    "import.source.star",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.MODULE,
      context: (node) => ({ source_module: node.text.replace(/['"]/g, "") }),
    },
  ],
  [
    "import.source.relative",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.MODULE,
      context: (node) => ({ source_module: node.text }),
    },
  ],
  [
    "import.named.relative",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.VARIABLE,
    },
  ],

  // ============================================================================
  // EXPORTS - Python's implicit export model
  // ============================================================================
  [
    "export.all",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      context: () => ({
        export_type: "explicit_control",
        is_namespace_export: true,
      }),
    },
  ],
  [
    "export.all.list",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        // Extract all string values from the list
        const all_contents: string[] = [];
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child && child.type === "string") {
            // Remove quotes from the string literal
            const text = child.text;
            const content = text.slice(1, -1); // Remove surrounding quotes
            all_contents.push(content);
          }
        }
        return {
          export_type: "explicit_control",
          is_namespace_export: true,
          all_contents,
        };
      },
    },
  ],
  [
    "export.explicit",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      context: () => ({ export_type: "explicit" }),
    },
  ],

  // ============================================================================
  // REFERENCES - Function calls, member access, etc.
  // ============================================================================
  [
    "ref.call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
    },
  ],
  [
    "ref.method_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: (node) => {
        // Find the receiver for method calls
        const attr = node.parent;
        if (attr && attr.type === "attribute") {
          const receiver = attr.children[0];
          return {
            receiver_node: receiver,
            is_generic_call: false,
          };
        }
        return {};
      },
    },
  ],
  [
    "ref.method_call.chained",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
    },
  ],
  [
    "ref.method_call.deep",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
    },
  ],
  [
    "ref.constructor",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],
  [
    "ref.constructor.assigned",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],
  [
    "ref.object",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.property",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MEMBER_ACCESS,
    },
  ],
  [
    "ref.subscript.object",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.subscript.index",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.receiver",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.receiver.base",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.receiver.chain",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.receiver.deep",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  // Python-specific references
  [
    "ref.self",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.THIS,
    },
  ],
  [
    "ref.cls",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.THIS,
    },
  ],
  [
    "ref.super",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.SUPER,
    },
  ],
  [
    "ref.decorator",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: extract_decorator_context,
    },
  ],
  [
    "ref.decorator.call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: extract_decorator_context,
    },
  ],
  [
    "ref.type",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE_REFERENCE,
    },
  ],
  [
    "ref.type.generic",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE_REFERENCE,
      context: () => ({ is_generic: true }),
    },
  ],
  [
    "ref.identifier",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],

  // ============================================================================
  // ASSIGNMENTS AND TYPE FLOW
  // ============================================================================
  [
    "assign.target",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assign.source",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assign.source.lambda",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "assign.source.typed",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assign.source.constructor",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],
  [
    "assign.source.multiple",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assign.source.tuple",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assign.constructor",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],
  [
    "ref.assign.target",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.assign.source",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.assign.object",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.assign.property",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.MEMBER_ACCESS,
    },
  ],
  [
    "ref.assign.member",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.MEMBER_ACCESS,
    },
  ],
  [
    "ref.assign.source.member",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.augment.target",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.augment.source",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],

  // ============================================================================
  // RETURNS AND CONTROL FLOW
  // ============================================================================
  [
    "ref.return",
    {
      category: SemanticCategory.RETURN,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.yield",
    {
      category: SemanticCategory.RETURN,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_generator: true }),
    },
  ],
  [
    "ref.delete",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.assert",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],

  // ============================================================================
  // TYPE ANNOTATIONS
  // ============================================================================
  [
    "type.annotation",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
    },
  ],
  [
    "param.type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
    },
  ],
  [
    "param.type.default",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
    },
  ],
  [
    "field.value",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],

  // ============================================================================
  // MODIFIERS AND METADATA
  // ============================================================================
  [
    "class.extends",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CLASS,
      context: (node) => ({ extends_class: node.text } as CaptureContext),
    },
  ],
  [
    "method.static",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.ACCESS_MODIFIER,
      modifiers: () => ({ is_static: true }),
    },
  ],
  [
    "field.static",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.ACCESS_MODIFIER,
      modifiers: () => ({ is_static: true }),
    },
  ],
  [
    "function.async",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.ACCESS_MODIFIER,
      modifiers: () => ({ is_async: true }),
    },
  ],
  [
    "decorator.static",
    {
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.ACCESS_MODIFIER,
      modifiers: () => ({ is_static: true }),
    },
  ],
  [
    "decorator.classmethod",
    {
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.ACCESS_MODIFIER,
      modifiers: () => ({ is_abstract: true }),
    },
  ],
  [
    "decorator.property",
    {
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.ACCESS_MODIFIER,
      modifiers: () => ({ is_readonly: true }),
    },
  ],

  // ============================================================================
  // COMPOSITE CAPTURES - Groups of related captures
  // ============================================================================
  [
    "assignment.var",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assignment.typed",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assignment.lambda",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "assignment.constructor",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],
  [
    "assignment.multiple",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assignment.tuple",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assignment.expr",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "assignment.member",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.MEMBER_ACCESS,
    },
  ],
  [
    "assignment.augmented",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "method.definition",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
    },
  ],
  [
    "property.definition",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PROPERTY,
    },
  ],
  [
    "constructor.definition",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],
  [
    "method_call.full",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
    },
  ],
  [
    "method_call.chained",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
    },
  ],
  [
    "method_call.deep",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
    },
  ],
  [
    "member_access",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MEMBER_ACCESS,
    },
  ],
  [
    "subscript_access",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MEMBER_ACCESS,
    },
  ],
  [
    "constructor_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],
  [
    "super_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.SUPER,
    },
  ],
  [
    "return.statement",
    {
      category: SemanticCategory.RETURN,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "yield.expression",
    {
      category: SemanticCategory.RETURN,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_generator: true }),
    },
  ],
]);
