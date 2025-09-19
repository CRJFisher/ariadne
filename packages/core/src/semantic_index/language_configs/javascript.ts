/**
 * JavaScript/TypeScript capture mapping configuration
 */

import type { SyntaxNode } from "tree-sitter";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "../capture_types";

const safeNodeText = (node: SyntaxNode | undefined): string => {
  return node?.text || "";
};

/**
 * Map JavaScript/TypeScript tree-sitter captures to normalized semantic concepts
 */
export const JAVASCRIPT_CAPTURE_CONFIG: LanguageCaptureConfig = new Map<
  string,
  CaptureMapping
>([
  // ============================================================================
  // SCOPES
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

  // ============================================================================
  // DEFINITIONS
  // ============================================================================
  [
    "def.function",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "def.arrow",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_async: false }), // Could check for async keyword
    },
  ],
  [
    "def.variable",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.class",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS,
    },
  ],
  [
    "def.method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: (node) => {
        // Check for static modifier in parent
        const parent = node.parent;
        const has_static =
          parent?.children?.some((child) => child.type === "static") || false;
        return { is_static: has_static };
      },
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
    "def.param",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
    },
  ],
  [
    "def.field",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FIELD,
      modifiers: (node) => {
        const parent = node.parent;
        const has_static =
          parent?.children?.some((child) => child.type === "static") || false;
        return { is_static: has_static };
      },
    },
  ],

  // ============================================================================
  // REFERENCES
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
        const parent = node.parent;
        const receiver = parent?.childForFieldName?.("object");
        return receiver ? { receiver_node: receiver } : {};
      },
    },
  ],
  [
    "ref.method_call.chained",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: (node) => {
        const parent = node.parent;
        const receiver = parent?.childForFieldName?.("object");

        // Build property chain from the receiver
        const property_chain: string[] = [];
        let current = receiver;
        while (current?.type === "member_expression") {
          const prop = current.childForFieldName?.("property");
          if (prop) {
            property_chain.unshift(prop.text);
          }
          current = current.childForFieldName?.("object");
        }

        return {
          receiver_node: current || undefined,
          property_chain:
            property_chain.length > 0 ? property_chain : undefined,
        };
      },
    },
  ],
  [
    "ref.method_call.deep",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: (node) => {
        const parent = node.parent;
        const receiver = parent?.childForFieldName?.("object");

        // Build property chain from the deep receiver
        const property_chain: string[] = [];
        let current = receiver;
        while (current?.type === "member_expression") {
          const prop = current.childForFieldName?.("property");
          if (prop) {
            property_chain.unshift(prop.text);
          }
          current = current.childForFieldName?.("object");
        }

        return {
          receiver_node: current || undefined,
          property_chain:
            property_chain.length > 0 ? property_chain : undefined,
        };
      },
    },
  ],
  [
    "ref.constructor",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: (node) => {
        // Look for assignment context
        const parent = node.parent?.parent;
        if (parent?.type === "variable_declarator") {
          const target = parent.childForFieldName?.("name");
          return target ? { construct_target: target } : {};
        }
        return {};
      },
    },
  ],
  [
    "ref.constructor.assigned",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: (node) => {
        // This capture is specifically for constructors within variable declarations
        // The parent structure is: identifier -> new_expression -> variable_declarator
        const new_expr = node.parent; // new_expression
        const var_declarator = new_expr?.parent; // variable_declarator
        if (var_declarator?.type === "variable_declarator") {
          const target = var_declarator.childForFieldName?.("name");
          return target ? { construct_target: target } : {};
        }
        return {};
      },
    },
  ],
  [
    "ref.property",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MEMBER_ACCESS,
      context: (node) => {
        const parent = node.parent; // member_expression
        const receiver = parent?.childForFieldName?.("object");
        return receiver ? { receiver_node: receiver } : {};
      },
    },
  ],
  [
    "ref.property.computed",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MEMBER_ACCESS,
      context: (node) => {
        const parent = node.parent; // subscript_expression
        const receiver = parent?.childForFieldName?.("object");
        const index = parent?.childForFieldName?.("index");
        return {
          receiver_node: receiver || undefined,
          computed_key_node: index || undefined,
          is_computed: true,
          bracket_notation: true,
        };
      },
    },
  ],
  [
    "ref.property.optional",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MEMBER_ACCESS,
      context: (node) => {
        const parent = node.parent; // member_expression with optional chaining
        const receiver = parent?.childForFieldName?.("object");
        return {
          receiver_node: receiver || undefined,
          optional_chaining: true,
          is_optional: true,
          uses_optional_operator: true,
        };
      },
    },
  ],
  [
    "ref.this",
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

  // ============================================================================
  // IMPORTS
  // ============================================================================
  [
    "import.source",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.MODULE,
      context: (node) => {
        // Check if this is a side-effect import by seeing if parent has import_clause
        const import_stmt = node.parent;
        // Look for import_clause among named children
        const has_import_clause = import_stmt?.namedChildren?.some(
          (child: any) => child.type === "import_clause"
        );
        if (!has_import_clause) {
          // This is a side-effect import (no import clause means just import 'module')
          return {
            source_module: node.text.slice(1, -1),
            is_side_effect_import: true,
          };
        }
        // Not a side-effect import, will be handled by other captures
        return { skip: true };
      },
    },
  ],
  [
    "import.named",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        // Navigate up: import_specifier -> named_imports -> import_clause -> import_statement
        let import_stmt = node.parent; // import_specifier or identifier
        while (import_stmt && import_stmt.type !== "import_statement") {
          import_stmt = import_stmt.parent;
        }
        const source = import_stmt?.childForFieldName?.("source");
        return source ? { source_module: source.text.slice(1, -1) } : {};
      },
    },
  ],
  [
    "import.named.source",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        // This is the source name in an aliased import (e.g., "join" in: join as pathJoin)
        const specifier = node.parent; // import_specifier
        const alias_node = specifier?.childForFieldName?.("alias");
        // Navigate up to import_statement
        let import_stmt = specifier;
        while (import_stmt && import_stmt.type !== "import_statement") {
          import_stmt = import_stmt.parent;
        }
        const source = import_stmt?.childForFieldName?.("source");
        return {
          source_module: source ? source.text.slice(1, -1) : undefined,
          import_alias: alias_node?.text,
        };
      },
    },
  ],
  // import.named.alias is handled via import.named.source context, so we don't map it separately
  [
    "import.default",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_default: true }),
      context: (node) => {
        const import_stmt = node.parent?.parent;
        const source = import_stmt?.childForFieldName?.("source");
        return source ? { source_module: source.text.slice(1, -1) } : {};
      },
    },
  ],
  [
    "import.namespace",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.MODULE,
      modifiers: () => ({ is_namespace: true }),
      context: (node) => {
        // Navigate up: identifier -> namespace_import -> import_clause -> import_statement
        let import_stmt = node.parent;
        while (import_stmt && import_stmt.type !== "import_statement") {
          import_stmt = import_stmt.parent;
        }
        const source = import_stmt?.childForFieldName?.("source");
        return source ? { source_module: source.text.slice(1, -1) } : {};
      },
    },
  ],

  // ============================================================================
  // EXPORTS
  // ============================================================================
  [
    "export.named",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "export.named.source",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        // This is the source name in an aliased export
        const specifier = node.parent; // export_specifier
        const alias_node = specifier?.childForFieldName?.("alias");
        return { export_alias: alias_node?.text };
      },
    },
  ],
  [
    "export.named.alias",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        // This is the alias in an aliased export
        const specifier = node.parent; // export_specifier
        const source_node = specifier?.childForFieldName?.("name");
        return { export_source: source_node?.text };
      },
    },
  ],
  [
    "export.default",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_default: true }),
    },
  ],
  [
    "export.default.function",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_default: true }),
    },
  ],
  [
    "export.default.class",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.CLASS,
      modifiers: () => ({ is_default: true }),
    },
  ],
  [
    "export.declaration",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_exported: true }),
    },
  ],

  // Namespace exports
  [
    "export.namespace.source",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.MODULE,
      modifiers: () => ({ is_namespace: true }),
      context: (node) => {
        // This is the source string for a namespace export
        return {
          export_source: node.text.slice(1, -1),
          is_namespace_export: true,
        };
      },
    },
  ],
  [
    "export.namespace.alias",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.MODULE,
      modifiers: () => ({ is_namespace: true }),
      context: (node) => {
        // This is the alias for namespace export (export * as foo from 'module')
        return { namespace_alias: node.text };
      },
    },
  ],
  [
    "export.namespace.source.aliased",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.MODULE,
      context: (node) => {
        // Source for aliased namespace export
        const export_stmt = node.parent;
        const namespace_export = export_stmt?.children?.find(
          (c: any) => c.type === "namespace_export"
        );
        const alias =
          namespace_export?.childForFieldName?.("alias") ||
          namespace_export?.children?.find((c: any) => c.type === "identifier");
        return {
          export_source: node.text.slice(1, -1),
          namespace_alias: alias?.text,
          is_namespace_export: true,
        };
      },
    },
  ],

  // Re-exports
  [
    "export.reexport",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_reexport: true }),
      context: (node) => {
        return { reexport_name: node.text };
      },
    },
  ],
  [
    "export.reexport.source",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.MODULE,
      context: (node) => {
        // Get re-exported names from the export clause
        const export_stmt = node.parent;
        const export_clause =
          export_stmt?.childForFieldName?.("declaration") ||
          export_stmt?.children?.find((c: any) => c.type === "export_clause");
        const specifiers: string[] = [];
        if (export_clause) {
          for (const child of export_clause.children || []) {
            if (child.type === "export_specifier") {
              const name = child.childForFieldName?.("name");
              if (name) specifiers.push(name.text);
            }
          }
        }
        return {
          export_source: node.text.slice(1, -1),
          is_reexport: true,
          reexport_names: specifiers,
        };
      },
    },
  ],
  [
    "export.reexport.original",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_reexport: true }),
      context: (node) => {
        const specifier = node.parent;
        const alias_node = specifier?.childForFieldName?.("alias");
        return {
          reexport_name: node.text,
          reexport_alias: alias_node?.text,
        };
      },
    },
  ],
  [
    "export.reexport.alias",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        const specifier = node.parent;
        const name_node = specifier?.childForFieldName?.("name");
        return {
          reexport_original: name_node?.text,
          reexport_alias: node.text,
        };
      },
    },
  ],
  [
    "export.reexport.source.aliased",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.MODULE,
      context: (node) => {
        // Get aliased re-exports from the export clause
        const export_stmt = node.parent;
        const export_clause =
          export_stmt?.childForFieldName?.("declaration") ||
          export_stmt?.children?.find((c: any) => c.type === "export_clause");
        const reexports: Array<{ original: string; alias?: string }> = [];
        if (export_clause) {
          for (const child of export_clause.children || []) {
            if (child.type === "export_specifier") {
              const name = child.childForFieldName?.("name");
              const alias = child.childForFieldName?.("alias");
              if (name) {
                reexports.push({
                  original: name.text,
                  alias: alias?.text,
                });
              }
            }
          }
        }
        return {
          export_source: node.text.slice(1, -1),
          is_reexport: true,
          reexports,
        };
      },
    },
  ],

  // ============================================================================
  // ASSIGNMENTS
  // ============================================================================
  [
    "assign.target",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        const parent = node.parent;
        const source = parent?.childForFieldName?.("value");
        return source ? { source_node: source, target_node: node } : {};
      },
    },
  ],
  [
    "assign.source",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        const parent = node.parent;
        const target = parent?.childForFieldName?.("name");
        return target ? { target_node: target, source_node: node } : {};
      },
    },
  ],
  [
    "assign.constructor",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.CONSTRUCTOR,
      context: (node) => ({
        constructor_name: safeNodeText(node),
      }),
    },
  ],
  [
    "assign.source.constructor",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.CONSTRUCTOR,
      context: (node) => {
        const constructor_node = node.childForFieldName?.("constructor");
        return constructor_node
          ? { constructor_name: safeNodeText(constructor_node) }
          : {};
      },
    },
  ],
  [
    "assignment.constructor",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.CONSTRUCTOR,
      context: (node) => {
        const name = node.childForFieldName?.("name");
        const value = node.childForFieldName?.("value");
        const constructor_node = value?.childForFieldName?.("constructor");
        return {
          variable_name: name ? safeNodeText(name) : undefined,
          constructor_name: constructor_node
            ? safeNodeText(constructor_node)
            : undefined,
        };
      },
    },
  ],
  [
    "assignment.var",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => {
        const name = node.childForFieldName?.("name");
        const value = node.childForFieldName?.("value");
        return {
          variable_name: name ? safeNodeText(name) : undefined,
          value_node: value || undefined,
        };
      },
    },
  ],

  // ============================================================================
  // RETURNS
  // ============================================================================
  [
    "ref.return",
    {
      category: SemanticCategory.RETURN,
      entity: SemanticEntity.REFERENCE,
      context: (node) => {
        // Find containing function
        let current = node.parent;
        while (current) {
          if (
            [
              "function_declaration",
              "function_expression",
              "arrow_function",
              "method_definition",
            ].includes(current.type)
          ) {
            return { containing_function_node: current };
          }
          current = current.parent;
        }
        return {};
      },
    },
  ],

  // ============================================================================
  // CLASSES
  // ============================================================================
  [
    "class.extends",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.CLASS,
      context: (node) => ({
        extends_class: node.text,
      }),
    },
  ],
]);
