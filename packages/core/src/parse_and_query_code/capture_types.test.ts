/**
 * Tests for capture types and exports
 */

import { describe, it, expect } from "vitest";
import type { SyntaxNode } from "tree-sitter";
import type { FilePath, Location } from "@ariadnejs/types";
import {
  SemanticCategory,
  SemanticEntity,
  type SemanticModifiers,
  type NormalizedCapture,
  type CaptureContext,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "../parse_and_query_code/capture_types";

describe("Capture Types", () => {
  describe("SemanticCategory Enum", () => {
    it("should export all expected semantic categories", () => {
      const expectedCategories = [
        "scope",
        "definition",
        "reference",
        "import",
        "export",
        "type",
        "assignment",
        "return",
        "decorator",
        "modifier",
      ];

      const actualCategories = Object.values(SemanticCategory);
      expect(actualCategories).toEqual(expectedCategories);
    });

    it("should have consistent string values", () => {
      expect(SemanticCategory.SCOPE).toBe("scope");
      expect(SemanticCategory.DEFINITION).toBe("definition");
      expect(SemanticCategory.REFERENCE).toBe("reference");
      expect(SemanticCategory.IMPORT).toBe("import");
      expect(SemanticCategory.EXPORT).toBe("export");
      expect(SemanticCategory.TYPE).toBe("type");
      expect(SemanticCategory.ASSIGNMENT).toBe("assignment");
      expect(SemanticCategory.RETURN).toBe("return");
      expect(SemanticCategory.DECORATOR).toBe("decorator");
      expect(SemanticCategory.MODIFIER).toBe("modifier");
    });

    it("should have unique values", () => {
      const values = Object.values(SemanticCategory);
      const uniqueValues = [...new Set(values)];
      expect(values).toHaveLength(uniqueValues.length);
    });
  });

  describe("SemanticEntity Enum", () => {
    it("should export all expected scope entities", () => {
      const scopeEntities = [
        SemanticEntity.MODULE,
        SemanticEntity.CLASS,
        SemanticEntity.FUNCTION,
        SemanticEntity.METHOD,
        SemanticEntity.CONSTRUCTOR,
        SemanticEntity.BLOCK,
        SemanticEntity.INTERFACE,
        SemanticEntity.ENUM,
        SemanticEntity.NAMESPACE,
      ];

      for (const entity of scopeEntities) {
        expect(Object.values(SemanticEntity)).toContain(entity);
      }
    });

    it("should export all expected definition entities", () => {
      const definitionEntities = [
        SemanticEntity.VARIABLE,
        SemanticEntity.CONSTANT,
        SemanticEntity.PARAMETER,
        SemanticEntity.FIELD,
        SemanticEntity.PROPERTY,
        SemanticEntity.TYPE_PARAMETER,
        SemanticEntity.ENUM_MEMBER,
      ];

      for (const entity of definitionEntities) {
        expect(Object.values(SemanticEntity)).toContain(entity);
      }
    });

    it("should export all expected type entities", () => {
      const typeEntities = [
        SemanticEntity.TYPE,
        SemanticEntity.TYPE_ALIAS,
        SemanticEntity.TYPE_ANNOTATION,
        SemanticEntity.TYPE_PARAMETERS,
        SemanticEntity.TYPE_ASSERTION,
        SemanticEntity.TYPE_CONSTRAINT,
        SemanticEntity.TYPE_ARGUMENT,
      ];

      for (const entity of typeEntities) {
        expect(Object.values(SemanticEntity)).toContain(entity);
      }
    });

    it("should export all expected reference entities", () => {
      const referenceEntities = [
        SemanticEntity.CALL,
        SemanticEntity.MEMBER_ACCESS,
        SemanticEntity.TYPE_REFERENCE,
        SemanticEntity.TYPEOF,
      ];

      for (const entity of referenceEntities) {
        expect(Object.values(SemanticEntity)).toContain(entity);
      }
    });

    it("should export special entities", () => {
      const specialEntities = [
        SemanticEntity.THIS,
        SemanticEntity.SUPER,
        SemanticEntity.IMPORT,
      ];

      for (const entity of specialEntities) {
        expect(Object.values(SemanticEntity)).toContain(entity);
      }
    });

    it("should export modifier entities", () => {
      const modifierEntities = [
        SemanticEntity.ACCESS_MODIFIER,
        SemanticEntity.READONLY_MODIFIER,
        SemanticEntity.VISIBILITY,
        SemanticEntity.MUTABILITY,
        SemanticEntity.REFERENCE,
      ];

      for (const entity of modifierEntities) {
        expect(Object.values(SemanticEntity)).toContain(entity);
      }
    });

    it("should export expression entities", () => {
      const expressionEntities = [
        SemanticEntity.OPERATOR,
        SemanticEntity.ARGUMENT_LIST,
        SemanticEntity.LABEL,
        SemanticEntity.MACRO,
      ];

      for (const entity of expressionEntities) {
        expect(Object.values(SemanticEntity)).toContain(entity);
      }
    });

    it("should have consistent string values", () => {
      expect(SemanticEntity.MODULE).toBe("module");
      expect(SemanticEntity.CLASS).toBe("class");
      expect(SemanticEntity.FUNCTION).toBe("function");
      expect(SemanticEntity.VARIABLE).toBe("variable");
      expect(SemanticEntity.TYPE).toBe("type");
      expect(SemanticEntity.CALL).toBe("call");
      expect(SemanticEntity.THIS).toBe("this");
    });

    it("should have unique values", () => {
      const values = Object.values(SemanticEntity);
      const uniqueValues = [...new Set(values)];
      expect(values).toHaveLength(uniqueValues.length);
    });
  });

  describe("SemanticModifiers Interface", () => {
    it("should allow creating valid modifier objects", () => {
      const modifiers: SemanticModifiers = {
        is_static: true,
        is_async: false,
        is_private: true,
        is_readonly: true,
      };

      expect(modifiers.is_static).toBe(true);
      expect(modifiers.is_async).toBe(false);
      expect(modifiers.is_private).toBe(true);
      expect(modifiers.is_readonly).toBe(true);
    });

    it("should allow all optional properties", () => {
      const emptyModifiers: SemanticModifiers = {};
      expect(emptyModifiers).toBeDefined();

      const partialModifiers: SemanticModifiers = {
        is_static: true,
      };
      expect(partialModifiers.is_static).toBe(true);
    });

    it("should support language-specific modifiers", () => {
      // TypeScript/JavaScript modifiers
      const tsModifiers: SemanticModifiers = {
        is_static: true,
        is_async: true,
        is_generator: true,
        is_private: true,
        is_protected: true,
        is_abstract: true,
        is_readonly: true,
        is_optional: true,
        is_exported: true,
        is_default: true,
        is_namespace: true,
        is_type_only: true,
      };

      expect(Object.keys(tsModifiers)).toContain("is_static");
      expect(Object.keys(tsModifiers)).toContain("is_type_only");

      // Rust-specific modifiers
      const rustModifiers: SemanticModifiers = {
        is_unsafe: true,
        is_mutable: true,
        is_mutable_borrow: true,
        is_closure: true,
        is_generic: true,
        is_method: true,
        is_associated_function: true,
        is_constructor: true,
        is_self: true,
        is_closure_param: true,
        visibility_level: "public",
        visibility_path: "crate::utils",
        // Function-specific modifiers
        is_const: true,
        is_move: true,
        returns_impl_trait: true,
        accepts_impl_trait: true,
        is_function_pointer: true,
        is_function_trait: true,
        is_higher_order: true,
      };

      expect(rustModifiers.is_unsafe).toBe(true);
      expect(rustModifiers.visibility_level).toBe("public");
      // Test function-specific modifiers
      expect(rustModifiers.is_const).toBe(true);
      expect(rustModifiers.returns_impl_trait).toBe(true);
      expect(rustModifiers.is_function_pointer).toBe(true);
      expect(rustModifiers.is_higher_order).toBe(true);
    });
  });

  describe("NormalizedCapture Interface", () => {
    it("should create valid normalized capture objects", () => {
      const mockLocation: Location = {
        file_path: "test.js" as FilePath,
        line: 1,
        column: 0,
        end_line: 1,
        end_column: 10,
      };

      const capture: NormalizedCapture = {
        category: SemanticCategory.DEFINITION,
        entity: SemanticEntity.FUNCTION,
        node_location: mockLocation,
        symbol_name: "testFunction",
        modifiers: { is_static: true },
        context: { method_name: "testFunction" },
      };

      expect(capture.category).toBe(SemanticCategory.DEFINITION);
      expect(capture.entity).toBe(SemanticEntity.FUNCTION);
      expect(capture.node_location).toBe(mockLocation);
      expect(capture.symbol_name).toBe("testFunction");
      expect(capture.modifiers.is_static).toBe(true);
      expect(capture.context?.method_name).toBe("testFunction");
    });

    it("should allow optional context", () => {
      const mockLocation: Location = {
        file_path: "test.js" as FilePath,
        line: 1,
        column: 0,
        end_line: 1,
        end_column: 10,
      };

      const capture: NormalizedCapture = {
        category: SemanticCategory.DEFINITION,
        entity: SemanticEntity.VARIABLE,
        node_location: mockLocation,
        symbol_name: "testVar",
        modifiers: {},
      };

      expect(capture.context).toBeUndefined();
    });
  });

  describe("CaptureContext Interface", () => {
    it("should support import context properties", () => {
      const importContext: CaptureContext = {
        source_module: "react",
        import_alias: "React",
        is_side_effect_import: false,
        import_kind: "named",
      };

      expect(importContext.source_module).toBe("react");
      expect(importContext.import_alias).toBe("React");
      expect(importContext.is_side_effect_import).toBe(false);
      expect(importContext.import_kind).toBe("named");
    });

    it("should support export context properties", () => {
      const exportContext: CaptureContext = {
        export_alias: "Component",
        export_source: "React.Component",
        export_type: "class",
        export_kind: "named",
        is_namespace_export: false,
        is_reexport: true,
        reexport_names: ["useState", "useEffect"],
      };

      expect(exportContext.export_alias).toBe("Component");
      expect(exportContext.is_reexport).toBe(true);
      expect(exportContext.reexport_names).toContain("useState");
    });

    it("should support method call context properties", () => {
      const callContext: CaptureContext = {
        property_chain: ["obj", "nested", "method"],
        is_generic_call: true,
        type_arguments: "<string, number>",
      };

      expect(callContext.property_chain).toEqual(["obj", "nested", "method"]);
      expect(callContext.is_generic_call).toBe(true);
      expect(callContext.type_arguments).toBe("<string, number>");
    });

    it("should support TypeScript type system context", () => {
      const typeContext: CaptureContext = {
        annotation_type: "Promise<string>",
        annotation_kind: "return",
        type_params: "<T extends string>",
        params_for: "function",
        constraint_type: "string",
        type_name: "GenericType",
        is_generic: true,
      };

      expect(typeContext.annotation_type).toBe("Promise<string>");
      expect(typeContext.is_generic).toBe(true);
      expect(typeContext.type_params).toBe("<T extends string>");
    });
  });

  describe("CaptureMapping Interface", () => {
    it("should create valid capture mapping objects", () => {
      const mapping: CaptureMapping = {
        category: SemanticCategory.DEFINITION,
        entity: SemanticEntity.FUNCTION,
        modifiers: (node: SyntaxNode) => ({ is_static: true }),
        context: (node: SyntaxNode) => ({ method_name: node.text }),
      };

      expect(mapping.category).toBe(SemanticCategory.DEFINITION);
      expect(mapping.entity).toBe(SemanticEntity.FUNCTION);
      expect(typeof mapping.modifiers).toBe("function");
      expect(typeof mapping.context).toBe("function");
    });

    it("should allow optional modifier and context functions", () => {
      const simpleMapping: CaptureMapping = {
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.VARIABLE,
      };

      expect(simpleMapping.modifiers).toBeUndefined();
      expect(simpleMapping.context).toBeUndefined();
    });

    it("should support function composition", () => {
      const mapping: CaptureMapping = {
        category: SemanticCategory.DEFINITION,
        entity: SemanticEntity.METHOD,
        modifiers: (node: SyntaxNode) => {
          const hasStatic = node.parent?.children?.some(
            (child: any) => child.type === "static"
          );
          return { is_static: Boolean(hasStatic) };
        },
        context: (node: SyntaxNode) => {
          const returnType = node.parent?.childForFieldName?.("return_type");
          return { return_type: returnType?.text };
        },
      };

      // Test with mock node
      const mockNode = {
        text: "testMethod",
        parent: {
          children: [{ type: "static" }],
          childForFieldName: (field: string) => {
            if (field === "return_type") return { text: "void" };
            return null;
          },
        },
      } as SyntaxNode;

      const modifiers = mapping.modifiers!(mockNode);
      const context = mapping.context!(mockNode);

      expect(modifiers.is_static).toBe(true);
      expect(context.return_type).toBe("void");
    });
  });

  describe("LanguageCaptureConfig Type", () => {
    it("should create valid language capture configs", () => {
      const config: LanguageCaptureConfig = new Map([
        [
          "def.function",
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.FUNCTION,
          },
        ],
        [
          "ref.call",
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
          },
        ],
      ]);

      expect(config.size).toBe(2);
      expect(config.has("def.function")).toBe(true);
      expect(config.has("ref.call")).toBe(true);

      const functionMapping = config.get("def.function");
      expect(functionMapping?.category).toBe(SemanticCategory.DEFINITION);
      expect(functionMapping?.entity).toBe(SemanticEntity.FUNCTION);
    });

    it("should support complex mapping configurations", () => {
      const config: LanguageCaptureConfig = new Map([
        [
          "def.method",
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.METHOD,
            modifiers: (node: SyntaxNode) => ({
              is_static:
                node.parent?.children?.some((c: any) => c.type === "static") ||
                false,
              is_async:
                node.parent?.children?.some((c: any) => c.type === "async") ||
                false,
            }),
            context: (node: SyntaxNode) => ({
              method_name: node.text,
              access_modifier: node.parent?.children?.find((c: any) =>
                ["public", "private", "protected"].includes(c.type)
              )?.type,
            }),
          },
        ],
      ]);

      const mapping = config.get("def.method");
      expect(mapping).toBeDefined();
      expect(typeof mapping?.modifiers).toBe("function");
      expect(typeof mapping?.context).toBe("function");
    });
  });

  describe("Type Consistency", () => {
    it("should ensure semantic categories and entities are compatible", () => {
      // Test that common combinations work
      const validCombinations = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
        },
        { category: SemanticCategory.DEFINITION, entity: SemanticEntity.CLASS },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
        },
        { category: SemanticCategory.REFERENCE, entity: SemanticEntity.CALL },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.MEMBER_ACCESS,
        },
        { category: SemanticCategory.SCOPE, entity: SemanticEntity.MODULE },
        { category: SemanticCategory.SCOPE, entity: SemanticEntity.FUNCTION },
        {
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
        },
        { category: SemanticCategory.IMPORT, entity: SemanticEntity.IMPORT },
        { category: SemanticCategory.EXPORT, entity: SemanticEntity.FUNCTION },
      ];

      for (const combo of validCombinations) {
        const capture: NormalizedCapture = {
          category: combo.category,
          entity: combo.entity,
          node_location: {
            file_path: "test.js" as FilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 4,
          },
          symbol_name: "test",
          modifiers: {},
        };

        expect(capture.category).toBe(combo.category);
        expect(capture.entity).toBe(combo.entity);
      }
    });

    it("should support all defined modifiers in SemanticModifiers", () => {
      const allModifiers: SemanticModifiers = {
        // Common modifiers
        is_static: true,
        is_async: true,
        is_generator: false,
        is_private: true,
        is_protected: false,
        is_abstract: true,
        is_readonly: true,
        is_optional: false,
        is_exported: true,
        is_default: false,
        is_namespace: true,
        is_type_only: false,
        is_side_effect: true,
        is_reexport: false,

        // Rust-specific modifiers
        is_unsafe: true,
        is_mutable: false,
        is_mutable_borrow: true,
        is_closure: false,
        is_generic: true,
        is_method: false,
        is_associated_function: true,
        is_constructor: false,
        is_self: true,
        is_closure_param: false,
        visibility_level: "public",
        visibility_path: "crate::module",
        is_associated_call: true,
        is_self_reference: false,
        is_borrow: true,
        is_dereference: false,
        is_lifetime: true,
        is_trait_method: false,
        is_reference: true,
        is_scoped: false,
        is_signature: true,
        is_associated: false,
        is_wildcard: true,
        match_type: "exhaustive",
        is_pattern_var: false,
      };

      // Should compile without errors and have all properties
      expect(Object.keys(allModifiers).length).toBeGreaterThan(25);
      expect(allModifiers.is_static).toBe(true);
      expect(allModifiers.visibility_level).toBe("public");
      expect(allModifiers.match_type).toBe("exhaustive");
    });
  });
});
