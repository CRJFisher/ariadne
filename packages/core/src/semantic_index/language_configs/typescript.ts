/**
 * TypeScript capture mapping configuration
 *
 * Strategy:
 * 1. Start with JavaScript as the foundation (TypeScript is a superset)
 * 2. Override specific JavaScript patterns where TypeScript differs
 * 3. Add TypeScript-specific language features
 * 4. Provide rich context extraction for type system features
 * 5. Ensure compatibility with both .ts and .tsx files
 */

import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "../capture_types";

// Import JavaScript config as foundation
import { JAVASCRIPT_CAPTURE_CONFIG } from "./javascript";

/**
 * Helper function to safely extract text from AST nodes
 */
function safeNodeText(node: any): string {
  return node?.text || "";
}

/**
 * Helper function to find child by type in AST node
 */
function findChildByType(node: any, type: string): any {
  return node?.children?.find((child: any) => child.type === type);
}

/**
 * Helper function to extract type annotation text
 */
function extractTypeAnnotation(node: any): string | undefined {
  const typeAnnotation = node?.childForFieldName?.("type") ||
                        findChildByType(node, "type_annotation");
  return typeAnnotation?.text;
}

/**
 * Helper function to extract access modifier
 */
function extractAccessModifier(node: any): string | undefined {
  const modifier = findChildByType(node, "accessibility_modifier");
  return modifier?.text;
}

/**
 * Helper function to check for static modifier
 */
function hasStaticModifier(node: any): boolean {
  return node?.children?.some((child: any) => child.type === "static") || false;
}

/**
 * Helper function to check for readonly modifier
 */
function hasReadonlyModifier(node: any): boolean {
  return node?.children?.some((child: any) => child.type === "readonly") || false;
}

/**
 * Helper function to check for async modifier
 */
function hasAsyncModifier(node: any): boolean {
  return node?.children?.some((child: any) => child.type === "async") || false;
}

/**
 * Helper function to extract source module from import/export
 */
function extractSourceModule(node: any): string | undefined {
  let current = node;
  while (current && current.type !== "import_statement" && current.type !== "export_statement") {
    current = current.parent;
  }
  const source = current?.childForFieldName?.("source");
  return source ? source.text.slice(1, -1) : undefined;
}

/**
 * TypeScript capture configuration - extends JavaScript with TypeScript-specific features
 */
export const TYPESCRIPT_CAPTURE_CONFIG: LanguageCaptureConfig = new Map<
  string,
  CaptureMapping
>([
  // ============================================================================
  // JAVASCRIPT FOUNDATION - Start with all JavaScript mappings
  // ============================================================================
  ...Array.from(JAVASCRIPT_CAPTURE_CONFIG),

  // ============================================================================
  // TYPESCRIPT-SPECIFIC SCOPES
  // ============================================================================
  [
    "scope.interface",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.INTERFACE,
    },
  ],
  [
    "scope.enum",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.ENUM,
    },
  ],
  [
    "scope.namespace",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.NAMESPACE,
    },
  ],

  // ============================================================================
  // TYPE SYSTEM DEFINITIONS
  // ============================================================================
  [
    "def.interface",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE,
      context: (node) => {
        const parent = node.parent; // interface_declaration
        const typeParams = parent?.childForFieldName?.("type_parameters");
        const heritage = parent?.childForFieldName?.("extends_type_clause");

        return {
          type_parameters: typeParams?.text,
          type_name: safeNodeText(node),
        };
      },
    },
  ],
  [
    "def.type_alias",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_ALIAS,
      context: (node) => {
        const parent = node.parent; // type_alias_declaration
        const typeParams = parent?.childForFieldName?.("type_parameters");
        const value = parent?.childForFieldName?.("value");

        return {
          type_parameters: typeParams?.text,
          alias_value: value?.text,
          alias_name: safeNodeText(node),
        };
      },
    },
  ],
  [
    "def.enum",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM,
      context: (node) => ({
        type_name: safeNodeText(node),
      }),
    },
  ],
  [
    "def.enum.member",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM_MEMBER,
      context: (node) => {
        const parent = node.parent; // enum_assignment or property_identifier
        const initializer = parent?.childForFieldName?.("value");

        return {
          type_name: safeNodeText(node),
        };
      },
    },
  ],
  [
    "def.namespace",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.NAMESPACE,
      context: (node) => ({
        type_name: safeNodeText(node),
      }),
    },
  ],
  [
    "def.type_param",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_PARAMETER,
      context: (node) => {
        const parent = node.parent; // type_parameter
        const constraint = parent?.childForFieldName?.("constraint");
        const defaultType = parent?.childForFieldName?.("default_type");

        return {
          param_name: safeNodeText(node),
          constraint_type: constraint?.text,
          default_type: defaultType?.text,
        };
      },
    },
  ],

  // ============================================================================
  // TYPE ANNOTATIONS - Rich type information extraction
  // ============================================================================
  [
    "param.type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
      context: (node) => {
        const typeText = safeNodeText(node);
        return {
          annotation_type: typeText,
          annotation_kind: "parameter",
          is_optional: typeText.includes("undefined") || typeText.includes("?"),
          is_union: typeText.includes("|"),
          is_generic: typeText.includes("<"),
        };
      },
    },
  ],
  [
    "function.return_type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
      context: (node) => {
        const typeText = safeNodeText(node);
        return {
          annotation_type: typeText,
          annotation_kind: "return",
          is_promise: typeText.includes("Promise<"),
          is_async: typeText.includes("Promise<") || typeText.includes("async"),
          is_generic: typeText.includes("<"),
        };
      },
    },
  ],
  [
    "method.return_type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
      context: (node) => {
        const typeText = safeNodeText(node);
        return {
          annotation_type: typeText,
          annotation_kind: "method_return",
          is_promise: typeText.includes("Promise<"),
          is_generic: typeText.includes("<"),
        };
      },
    },
  ],
  [
    "arrow.return_type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
      context: (node) => ({
        annotation_type: safeNodeText(node),
        annotation_kind: "arrow_return",
        is_generic: safeNodeText(node).includes("<"),
      }),
    },
  ],
  [
    "property.type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
      context: (node) => ({
        annotation_type: safeNodeText(node),
        annotation_kind: "property",
        is_optional: safeNodeText(node).includes("?"),
      }),
    },
  ],
  [
    "field.type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
      context: (node) => ({
        annotation_type: safeNodeText(node),
        annotation_kind: "field",
        is_optional: safeNodeText(node).includes("?"),
      }),
    },
  ],
  [
    "var.type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ANNOTATION,
      context: (node) => ({
        annotation_type: safeNodeText(node),
        annotation_kind: "variable",
        is_const_assertion: safeNodeText(node).includes("as const"),
      }),
    },
  ],

  // ============================================================================
  // GENERIC TYPE PARAMETERS - Comprehensive generic support
  // ============================================================================
  [
    "class.type_params",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_PARAMETERS,
      context: (node) => {
        const params = safeNodeText(node);
        return {
          type_params: params,
          params_for: "class",
          param_count: (params.match(/,/g) || []).length + 1,
          has_constraints: params.includes("extends"),
          has_defaults: params.includes("="),
        };
      },
    },
  ],
  [
    "interface.type_params",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_PARAMETERS,
      context: (node) => {
        const params = safeNodeText(node);
        return {
          type_params: params,
          params_for: "interface",
          param_count: (params.match(/,/g) || []).length + 1,
          has_constraints: params.includes("extends"),
        };
      },
    },
  ],
  [
    "function.type_params",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_PARAMETERS,
      context: (node) => {
        const params = safeNodeText(node);
        return {
          type_params: params,
          params_for: "function",
          param_count: (params.match(/,/g) || []).length + 1,
          has_constraints: params.includes("extends"),
        };
      },
    },
  ],
  [
    "method.type_params",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_PARAMETERS,
      context: (node) => {
        const params = safeNodeText(node);
        return {
          type_params: params,
          params_for: "method",
          param_count: (params.match(/,/g) || []).length + 1,
          has_constraints: params.includes("extends"),
        };
      },
    },
  ],

  // ============================================================================
  // ACCESS MODIFIERS AND VISIBILITY
  // ============================================================================
  [
    "method.access",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.ACCESS_MODIFIER,
      context: (node) => ({
        modifier: safeNodeText(node),
        applies_to: "method",
      }),
    },
  ],
  [
    "field.access",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.ACCESS_MODIFIER,
      context: (node) => ({
        modifier: safeNodeText(node),
        applies_to: "field",
      }),
    },
  ],
  [
    "field.readonly",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.READONLY_MODIFIER,
      context: () => ({
        modifier: "readonly",
        applies_to: "field",
      }),
    },
  ],
  [
    "param.access",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.ACCESS_MODIFIER,
      context: (node) => ({
        modifier: safeNodeText(node),
        applies_to: "parameter",
        is_property: true, // Constructor parameter properties
      }),
    },
  ],

  // ============================================================================
  // DECORATORS - Enhanced decorator support
  // ============================================================================
  [
    "decorator.class",
    {
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.CLASS,
      context: (node) => {
        const decoratorText = safeNodeText(node);
        return {
          decorator_name: decoratorText,
          decorates: "class",
          has_arguments: decoratorText.includes("("),
        };
      },
    },
  ],
  [
    "decorator.method",
    {
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.METHOD,
      context: (node) => {
        const decoratorText = safeNodeText(node);
        return {
          decorator_name: decoratorText,
          decorates: "method",
          has_arguments: decoratorText.includes("("),
        };
      },
    },
  ],
  [
    "decorator.property",
    {
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.FIELD,
      context: (node) => {
        const decoratorText = safeNodeText(node);
        return {
          decorator_name: decoratorText,
          decorates: "property",
          has_arguments: decoratorText.includes("("),
        };
      },
    },
  ],

  // ============================================================================
  // ENHANCED CLASS FEATURES
  // ============================================================================
  [
    "class.implements",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.INTERFACE,
      context: (node) => ({
        implements_interface: safeNodeText(node),
        relationship: "implements",
      }),
    },
  ],
  [
    "class.extends",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.CLASS,
      context: (node) => ({
        extends_class: safeNodeText(node),
        relationship: "extends",
      }),
    },
  ],

  // ============================================================================
  // TYPE-SPECIFIC IMPORTS AND EXPORTS
  // ============================================================================
  [
    "import.type_only",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_type_only: true }),
      context: (node) => ({
        import_kind: "type_only",
        source_module: extractSourceModule(node),
      }),
    },
  ],
  [
    "import.type",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.TYPE,
      context: (node) => ({
        import_name: safeNodeText(node),
        import_kind: "type",
        source_module: extractSourceModule(node),
      }),
    },
  ],
  [
    "import.source.type",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.MODULE,
      modifiers: () => ({ is_type_only: true }),
      context: (node) => ({
        source_module: safeNodeText(node).slice(1, -1),
        import_kind: "type_only",
      }),
    },
  ],
  [
    "export.type_only",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_type_only: true }),
      context: () => ({
        export_kind: "type_only",
      }),
    },
  ],
  [
    "export.type",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.TYPE,
      context: (node) => ({
        export_alias: safeNodeText(node),
        export_kind: "type",
      }),
    },
  ],
  [
    "export.type.named",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.TYPE,
      context: (node) => ({
        export_alias: safeNodeText(node),
        export_kind: "named_type",
      }),
    },
  ],
  [
    "export.interface",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.INTERFACE,
      modifiers: () => ({ is_exported: true }),
      context: (node) => ({
        export_alias: safeNodeText(node),
        export_kind: "interface",
      }),
    },
  ],

  // ============================================================================
  // TYPE REFERENCES AND USAGE
  // ============================================================================
  [
    "ref.type",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
      context: (node) => ({
        type_name: safeNodeText(node),
        reference_kind: "type",
      }),
    },
  ],
  [
    "ref.type.generic",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
      context: (node) => {
        const parent = node.parent; // generic_type
        const typeArgs = parent?.childForFieldName?.("type_arguments");
        const argsText = typeArgs?.text || "";

        return {
          type_name: safeNodeText(node),
          reference_kind: "generic_type",
          is_generic: true,
          type_arguments: argsText,
          arg_count: argsText ? (argsText.match(/,/g) || []).length + 1 : 0,
        };
      },
    },
  ],
  [
    "ref.constructor.generic",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: (node) => {
        const newExpr = node.parent; // new_expression
        const typeArgs = newExpr?.childForFieldName?.("type_arguments");
        const varDeclarator = newExpr?.parent;
        const target = varDeclarator?.type === "variable_declarator"
          ? varDeclarator.childForFieldName?.("name")
          : undefined;

        return {
          method_name: safeNodeText(node),
          construct_target: target || undefined,
          is_generic_constructor: true,
          type_arguments: typeArgs?.text,
        };
      },
    },
  ],
  [
    "ref.call.generic",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: (node) => {
        const callExpr = node.parent; // call_expression
        const typeArgs = callExpr?.childForFieldName?.("type_arguments");

        return {
          function_name: safeNodeText(node),
          is_generic_call: true,
          type_arguments: typeArgs?.text,
        };
      },
    },
  ],

  // ============================================================================
  // TYPE ASSERTIONS AND CASTS
  // ============================================================================
  [
    "ref.cast.value",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        const parent = node.parent; // as_expression
        const targetType = parent?.childForFieldName?.("type");

        return {
          cast_value: safeNodeText(node),
          cast_to_type: targetType?.text,
          assertion_kind: "as_expression",
        };
      },
    },
  ],
  [
    "ref.cast.type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ASSERTION,
      context: (node) => {
        const parent = node.parent; // as_expression
        const sourceValue = parent?.childForFieldName?.("expression");

        return {
          cast_to_type: safeNodeText(node),
          cast_from: sourceValue?.text,
          assertion_kind: "as_expression",
        };
      },
    },
  ],

  // ============================================================================
  // TYPEOF EXPRESSIONS
  // ============================================================================
  [
    "ref.typeof",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPEOF,
      context: (node) => ({
        typeof_target: safeNodeText(node),
        expression_kind: "typeof",
      }),
    },
  ],

  // ============================================================================
  // ENHANCED PARAMETER DEFINITIONS
  // ============================================================================
  [
    "def.param.optional",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_optional: true }),
      context: (node) => {
        const parent = node.parent; // optional_parameter
        const typeAnnotation = extractTypeAnnotation(parent);

        return {
          param_name: safeNodeText(node),
          param_type: typeAnnotation,
          is_optional: true,
        };
      },
    },
  ],
  [
    "param.property",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        // This is a constructor parameter that becomes a property
        const parent = node.parent; // required_parameter
        const accessibility = parent?.children?.find(
          (child: any) => child.type === "accessibility_modifier"
        );
        const readonly = parent?.children?.some(
          (child: any) => child.type === "readonly"
        );
        const type_annotation = parent?.childForFieldName?.("type");
        return {
          is_parameter_property: true,
          access_modifier: accessibility?.text,
          property_type: type_annotation?.text,
          is_readonly: readonly,
        };
      },
    },
  ],
  [
    "def.field.param_property",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        // This is the field definition aspect of a parameter property
        const parent = node.parent; // required_parameter
        const accessibility = parent?.children?.find(
          (child: any) => child.type === "accessibility_modifier"
        );
        const readonly = parent?.children?.some(
          (child: any) => child.type === "readonly"
        );
        const type_annotation = parent?.childForFieldName?.("type");
        return {
          is_parameter_property: true,
          access_modifier: accessibility?.text,
          property_type: type_annotation?.text,
          is_readonly: readonly,
        };
      },
    },
  ],

  // ============================================================================
  // ENHANCED METHOD DEFINITIONS - Override JavaScript version with TypeScript features
  // ============================================================================
  [
    "def.method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      context: (node) => {
        const parent = node.parent; // method_definition
        const returnType = parent?.childForFieldName?.("return_type");
        const typeParams = parent?.childForFieldName?.("type_parameters");
        const accessModifier = extractAccessModifier(parent);

        return {
          method_name: safeNodeText(node),
          return_type: returnType?.text,
          type_parameters: typeParams?.text,
          access_modifier: accessModifier,
          is_static: hasStaticModifier(parent),
          is_async: hasAsyncModifier(parent),
          is_abstract: findChildByType(parent, "abstract") !== undefined,
          is_override: findChildByType(parent, "override") !== undefined,
        };
      },
    },
  ],

  // ============================================================================
  // ENHANCED FIELD DEFINITIONS - Override JavaScript version with TypeScript features
  // ============================================================================
  [
    "def.field",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FIELD,
      context: (node) => {
        const parent = node.parent; // public_field_definition
        const typeAnnotation = extractTypeAnnotation(parent);
        const accessModifier = extractAccessModifier(parent);
        const initializer = parent?.childForFieldName?.("value");

        return {
          field_name: safeNodeText(node),
          field_type: typeAnnotation,
          access_modifier: accessModifier,
          is_static: hasStaticModifier(parent),
          is_readonly: hasReadonlyModifier(parent),
          is_abstract: findChildByType(parent, "abstract") !== undefined,
          has_initializer: !!initializer,
          initializer_value: initializer?.text,
        };
      },
    },
  ],

  // ============================================================================
  // ENHANCED CLASS DEFINITIONS - Override JavaScript version with TypeScript features
  // ============================================================================
  [
    "def.class",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS,
      context: (node) => {
        const parent = node.parent; // class_declaration
        const typeParams = parent?.childForFieldName?.("type_parameters");
        const heritage = parent?.childForFieldName?.("class_heritage");
        const extendsClause = heritage?.childForFieldName?.("extends_clause");
        const implementsClause = heritage?.childForFieldName?.("implements_clause");

        // Extract interface names from implements clause
        const implementedInterfaces: string[] = [];
        if (implementsClause) {
          // implements_clause contains a list of type_identifiers
          const interfaces = implementsClause.children?.filter(
            (child: any) => child.type === "type_identifier"
          );
          implementedInterfaces.push(...(interfaces?.map((i: any) => i.text) || []));
        }

        return {
          type_name: safeNodeText(node),
          type_parameters: typeParams?.text,
          extends_class: extendsClause?.text,
          implements_interfaces: implementedInterfaces,
          is_abstract: findChildByType(parent, "abstract") !== undefined,
          is_exported: false, // Will be overridden by export mappings if applicable
        };
      },
    },
  ],

  // ============================================================================
  // CAPTURED ELEMENTS FOR CONTEXT (these provide additional context but don't create symbols)
  // ============================================================================
  [
    "class.name",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CLASS,
      context: (node) => ({
        type_name: safeNodeText(node),
      }),
    },
  ],
  [
    "interface.name",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.INTERFACE,
      context: (node) => ({
        type_name: safeNodeText(node),
      }),
    },
  ],
  [
    "function.name",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.FUNCTION,
      context: (node) => ({
        method_name: safeNodeText(node),
      }),
    },
  ],
  [
    "method.name",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: (node) => ({
        method_name: safeNodeText(node),
      }),
    },
  ],
  [
    "decorated.class",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CLASS,
      context: (node) => ({
        type_name: safeNodeText(node),
      }),
    },
  ],
  [
    "decorated.method",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: (node) => ({
        method_name: safeNodeText(node),
      }),
    },
  ],
  [
    "decorated.property",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.FIELD,
      context: (node) => ({
        method_name: safeNodeText(node),
      }),
    },
  ],

  // ============================================================================
  // TYPE ALIAS VALUE TRACKING
  // ============================================================================
  [
    "type.alias.value",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ALIAS,
      context: (node) => {
        const typeText = safeNodeText(node);
        return {
          alias_value: typeText,
          is_union: typeText.includes("|"),
          is_intersection: typeText.includes("&"),
          is_generic: typeText.includes("<"),
          is_conditional: typeText.includes("extends") && typeText.includes("?"),
          is_mapped: typeText.includes("[K in "),
        };
      },
    },
  ],

  // ============================================================================
  // STATIC VS INSTANCE METHOD DETECTION
  // ============================================================================
  [
    "class.ref",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CLASS,
      context: () => ({
        is_static: true,
      }),
    },
  ],
  [
    "method.static",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: () => ({
        is_static: true,
      }),
    },
  ],
  [
    "instance.ref",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      context: () => ({
        is_static: false,
      }),
    },
  ],
  [
    "method.instance",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: () => ({
        is_static: false,
      }),
    },
  ],
  [
    "static_method_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: (node) => {
        const memberExpr = node.childForFieldName?.("function");
        const receiver = memberExpr?.childForFieldName?.("object");
        return {
          receiver_node: receiver || undefined,
          is_call: true,
          is_static: true,
        };
      },
    },
  ],
  [
    "instance_method_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: (node) => {
        const memberExpr = node.childForFieldName?.("function");
        const receiver = memberExpr?.childForFieldName?.("object");
        return {
          receiver_node: receiver || undefined,
          is_call: true,
          is_static: false,
        };
      },
    },
  ],
]);