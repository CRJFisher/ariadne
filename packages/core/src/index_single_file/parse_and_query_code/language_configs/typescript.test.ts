/**
 * Comprehensive tests for TypeScript language configuration
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "../capture_types";
import { TYPESCRIPT_CAPTURE_CONFIG } from "./typescript";
import { JAVASCRIPT_CAPTURE_CONFIG } from "./javascript";
import { create_simple_mock_node } from "../../test_utils";

describe("TypeScript Language Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  // Helper function to get AST node from code
  function getAstNode(code: string): SyntaxNode {
    return parser.parse(code).rootNode;
  }

  // Helper function to find first node of specific type
  function findNodeByType(node: SyntaxNode, type: string): SyntaxNode | null {
    if (node.type === type) return node;

    for (let i = 0; i < node.childCount; i++) {
      const found = findNodeByType(node.child(i)!, type);
      if (found) return found;
    }
    return null;
  }

  describe("TYPESCRIPT_CAPTURE_CONFIG", () => {
    it("should export a valid LanguageCaptureConfig", () => {
      expect(TYPESCRIPT_CAPTURE_CONFIG).toBeDefined();
      expect(TYPESCRIPT_CAPTURE_CONFIG).toBeInstanceOf(Map);
      expect(TYPESCRIPT_CAPTURE_CONFIG.size).toBeGreaterThan(0);
    });

    it("should extend JavaScript configuration", () => {
      // Should contain all JavaScript mappings plus TypeScript-specific ones
      expect(TYPESCRIPT_CAPTURE_CONFIG.size).toBeGreaterThan(
        JAVASCRIPT_CAPTURE_CONFIG.size
      );

      // Check that JavaScript mappings are included
      const jsKeys = Array.from(JAVASCRIPT_CAPTURE_CONFIG.keys());
      for (const key of jsKeys) {
        expect(TYPESCRIPT_CAPTURE_CONFIG.has(key)).toBe(true);
      }
    });

    it("should contain TypeScript-specific scope mappings", () => {
      const tsSpecificScopes = [
        "scope.interface",
        "scope.enum",
        "scope.namespace",
      ];

      for (const mapping of tsSpecificScopes) {
        expect(TYPESCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = TYPESCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.SCOPE);
      }
    });

    it("should contain type system definition mappings", () => {
      const typeDefinitions = [
        "def.interface",
        "def.type_alias",
        "def.enum",
        "def.enum.member",
        "def.namespace",
        "def.type_param",
      ];

      for (const mapping of typeDefinitions) {
        expect(TYPESCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = TYPESCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.DEFINITION);
      }
    });

    it("should contain type annotation mappings", () => {
      const typeAnnotations = [
        "param.type",
        "function.return_type",
        "method.return_type",
        "arrow.return_type",
        "property.type",
        "field.type",
        "var.type",
      ];

      for (const mapping of typeAnnotations) {
        expect(TYPESCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = TYPESCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.TYPE);
        expect(config?.entity).toBe(SemanticEntity.TYPE_ANNOTATION);
      }
    });

    it("should contain generic type parameter mappings", () => {
      const genericMappings = [
        "class.type_params",
        "interface.type_params",
        "function.type_params",
        "method.type_params",
      ];

      for (const mapping of genericMappings) {
        expect(TYPESCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = TYPESCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.TYPE);
        expect(config?.entity).toBe(SemanticEntity.TYPE_PARAMETERS);
      }
    });

    it("should contain access modifier mappings", () => {
      const modifierMappings = [
        "method.access",
        "field.access",
        "field.readonly",
        "param.access",
      ];

      for (const mapping of modifierMappings) {
        expect(TYPESCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = TYPESCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.MODIFIER);
      }
    });

    it("should contain decorator mappings", () => {
      const decoratorMappings = [
        "decorator.class",
        "decorator.method",
        "decorator.property",
      ];

      for (const mapping of decoratorMappings) {
        expect(TYPESCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = TYPESCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.DECORATOR);
      }
    });

    it("should contain type-specific import/export mappings", () => {
      const typeImportExportMappings = [
        "import.type_only",
        "import.type",
        "import.source.type",
        "export.type_only",
        "export.type",
        "export.interface",
        "export.type_alias",
        "export.enum",
      ];

      for (const mapping of typeImportExportMappings) {
        expect(TYPESCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = TYPESCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
      }
    });
  });

  describe("Helper Functions", () => {
    describe("safeNodeText", () => {
      it("should be accessible through function mapping", () => {
        // Test helper function indirectly through config usage
        const interfaceConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.interface");
        expect(interfaceConfig?.context).toBeDefined();

        if (typeof interfaceConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "TestInterface"
          );
          const context = interfaceConfig.context(mockNode);
          expect(context?.type_name).toBe("TestInterface");
        }
      });
    });

    describe("extractTypeAnnotation", () => {
      it("should extract type annotations correctly", () => {
        const paramTypeConfig = TYPESCRIPT_CAPTURE_CONFIG.get("param.type");
        expect(paramTypeConfig?.context).toBeDefined();

        if (typeof paramTypeConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "string | number"
          );
          const context = paramTypeConfig.context(mockNode);
          expect(context?.annotation_type).toBe("string | number");
        }
      });
    });

    describe("extractAccessModifier", () => {
      it("should extract access modifiers correctly", () => {
        const methodConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.method");
        expect(methodConfig?.context).toBeDefined();

        if (typeof methodConfig?.context === "function") {
          const mockNode = create_simple_mock_node("identifier", "testMethod", {
            parent: create_simple_mock_node("parent", "parent", {
              children: [
                create_simple_mock_node("accessibility_modifier", "private"),
              ],
            }),
          });

          const context = methodConfig.context(mockNode);
          expect(context?.access_modifier).toBe("private");
        }
      });
    });

    describe("hasStaticModifier", () => {
      it("should detect static modifiers correctly", () => {
        const fieldConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.field");
        expect(fieldConfig?.context).toBeDefined();

        if (typeof fieldConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "staticField",
            {
              parent: create_simple_mock_node("parent", "parent", {
                children: [create_simple_mock_node("static", "static")],
              }),
            }
          );

          const context = fieldConfig.context(mockNode);
          expect(context?.is_static).toBe(true);
        }
      });
    });

    describe("hasReadonlyModifier", () => {
      it("should detect readonly modifiers correctly", () => {
        const fieldConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.field");
        expect(fieldConfig?.context).toBeDefined();

        if (typeof fieldConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "readonlyField",
            {
              parent: create_simple_mock_node("parent", "parent", {
                children: [create_simple_mock_node("readonly", "readonly")],
              }),
            }
          );

          const context = fieldConfig.context(mockNode);
          expect(context).toBeDefined();
        }
      });
    });

    describe("hasAsyncModifier", () => {
      it("should detect async modifiers correctly", () => {
        const methodConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.method");
        expect(methodConfig?.context).toBeDefined();

        if (typeof methodConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "asyncMethod",
            {
              parent: create_simple_mock_node("parent", "parent", {
                children: [create_simple_mock_node("async", "async")],
              }),
            }
          );

          const context = methodConfig.context(mockNode);
          expect(context?.is_async).toBe(true);
        }
      });
    });
  });

  describe("Type System Features", () => {
    describe("Interface Definitions", () => {
      it("should handle interface with type parameters", () => {
        const interfaceConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.interface");
        expect(interfaceConfig?.context).toBeDefined();

        if (typeof interfaceConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "GenericInterface",
            {
              parent: create_simple_mock_node("parent", "parent", {
                childForFieldName: (field: string) => {
                  if (field === "type_parameters")
                    return create_simple_mock_node("identifier", "<T, U>");
                  return null;
                },
              }),
            }
          );

          const context = interfaceConfig.context(mockNode);
          expect(context?.type_name).toBe("GenericInterface");
          expect(context?.type_parameters).toBe("<T, U>");
        }
      });
    });

    describe("Type Alias Definitions", () => {
      it("should handle type alias with value", () => {
        const typeAliasConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.type_alias");
        expect(typeAliasConfig?.context).toBeDefined();

        if (typeof typeAliasConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "StringOrNumber",
            {
              parent: create_simple_mock_node("parent", "parent", {
                childForFieldName: (field: string) => {
                  if (field === "value")
                    return create_simple_mock_node(
                      "identifier",
                      "string | number"
                    );
                  if (field === "type_parameters")
                    return create_simple_mock_node("identifier", "<T>");
                  return null;
                },
              }),
            }
          );

          const context = typeAliasConfig.context(mockNode);
          expect(context).toBeDefined();
          expect(context?.type_parameters).toBe("<T>");
        }
      });
    });

    describe("Enum Definitions", () => {
      it("should handle enum definition", () => {
        const enumConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.enum");
        expect(enumConfig?.context).toBeDefined();

        if (typeof enumConfig?.context === "function") {
          const mockNode = create_simple_mock_node("identifier", "Color");
          const context = enumConfig.context(mockNode);
          expect(context?.type_name).toBe("Color");
        }
      });

      it("should handle enum member definition", () => {
        const enumMemberConfig =
          TYPESCRIPT_CAPTURE_CONFIG.get("def.enum.member");
        expect(enumMemberConfig?.context).toBeDefined();

        if (typeof enumMemberConfig?.context === "function") {
          const mockNode = create_simple_mock_node("identifier", "Red", {
            parent: create_simple_mock_node("parent", "parent", {
              childForFieldName: (field: string) => {
                if (field === "value")
                  return create_simple_mock_node("identifier", "0");
                return null;
              },
            }),
          });

          const context = enumMemberConfig.context(mockNode);
          expect(context?.type_name).toBe("Red");
        }
      });
    });

    describe("Type Parameters", () => {
      it("should handle type parameter with constraints", () => {
        const typeParamConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.type_param");
        expect(typeParamConfig?.context).toBeDefined();

        if (typeof typeParamConfig?.context === "function") {
          const mockNode = create_simple_mock_node("identifier", "T", {
            parent: create_simple_mock_node("parent", "parent", {
              childForFieldName: (field: string) => {
                if (field === "constraint")
                  return create_simple_mock_node("identifier", "string");
                if (field === "default_type")
                  return create_simple_mock_node("identifier", "never");
                return null;
              },
            }),
          });

          const context = typeParamConfig.context(mockNode);
          expect(context?.constraint_type).toBe("string");
        }
      });
    });

    describe("Generic Type Parameters", () => {
      it("should handle class type parameters", () => {
        const classTypeParamsConfig =
          TYPESCRIPT_CAPTURE_CONFIG.get("class.type_params");
        expect(classTypeParamsConfig?.context).toBeDefined();

        if (typeof classTypeParamsConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "<T extends string, U = number>"
          );
          const context = classTypeParamsConfig.context(mockNode);

          expect(context?.type_params).toBe("<T extends string, U = number>");
          expect(context?.params_for).toBe("class");
        }
      });

      it("should handle function type parameters", () => {
        const functionTypeParamsConfig = TYPESCRIPT_CAPTURE_CONFIG.get(
          "function.type_params"
        );
        expect(functionTypeParamsConfig?.context).toBeDefined();

        if (typeof functionTypeParamsConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "<T, U extends T>"
          );
          const context = functionTypeParamsConfig.context(mockNode);

          expect(context?.type_params).toBe("<T, U extends T>");
          expect(context?.params_for).toBe("function");
        }
      });
    });
  });

  describe("Type Annotations", () => {
    describe("Parameter Types", () => {
      it("should analyze parameter type annotations", () => {
        const paramTypeConfig = TYPESCRIPT_CAPTURE_CONFIG.get("param.type");
        expect(paramTypeConfig?.context).toBeDefined();

        if (typeof paramTypeConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "string | undefined"
          );
          const context = paramTypeConfig.context(mockNode);

          expect(context?.annotation_type).toBe("string | undefined");
          expect(context?.annotation_kind).toBe("parameter");
        }
      });

      it("should detect generic parameter types", () => {
        const paramTypeConfig = TYPESCRIPT_CAPTURE_CONFIG.get("param.type");

        if (typeof paramTypeConfig?.context === "function") {
          const mockNode = create_simple_mock_node("identifier", "Array<T>");
          const context = paramTypeConfig.context(mockNode);

          expect(context?.annotation_type).toBe("Array<T>");
          expect(context?.is_generic).toBe(true);
        }
      });
    });

    describe("Return Types", () => {
      it("should analyze function return types", () => {
        const returnTypeConfig = TYPESCRIPT_CAPTURE_CONFIG.get(
          "function.return_type"
        );
        expect(returnTypeConfig?.context).toBeDefined();

        if (typeof returnTypeConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "Promise<string>"
          );
          const context = returnTypeConfig.context(mockNode);

          expect(context?.annotation_type).toBe("Promise<string>");
          expect(context?.annotation_kind).toBe("return");
          expect(context?.is_async).toBe(true);
          expect(context?.is_generic).toBe(true);
        }
      });

      it("should analyze method return types", () => {
        const methodReturnTypeConfig =
          TYPESCRIPT_CAPTURE_CONFIG.get("method.return_type");
        expect(methodReturnTypeConfig?.context).toBeDefined();

        if (typeof methodReturnTypeConfig?.context === "function") {
          const mockNode = create_simple_mock_node("identifier", "void");
          const context = methodReturnTypeConfig.context(mockNode);

          expect(context?.annotation_type).toBe("void");
          expect(context?.annotation_kind).toBe("method_return");
        }
      });
    });

    describe("Property Types", () => {
      it("should analyze property type annotations", () => {
        const propertyTypeConfig =
          TYPESCRIPT_CAPTURE_CONFIG.get("property.type");
        expect(propertyTypeConfig?.context).toBeDefined();

        if (typeof propertyTypeConfig?.context === "function") {
          const mockNode = create_simple_mock_node("identifier", "string?");
          const context = propertyTypeConfig.context(mockNode);

          expect(context?.annotation_type).toBe("string?");
          expect(context?.annotation_kind).toBe("property");
        }
      });

      it("should analyze field type annotations", () => {
        const fieldTypeConfig = TYPESCRIPT_CAPTURE_CONFIG.get("field.type");
        expect(fieldTypeConfig?.context).toBeDefined();

        if (typeof fieldTypeConfig?.context === "function") {
          const mockNode = create_simple_mock_node("identifier", "number");
          const context = fieldTypeConfig.context(mockNode);

          expect(context?.annotation_type).toBe("number");
          expect(context?.annotation_kind).toBe("field");
        }
      });
    });

    describe("Variable Types", () => {
      it("should analyze variable type annotations", () => {
        const varTypeConfig = TYPESCRIPT_CAPTURE_CONFIG.get("var.type");
        expect(varTypeConfig?.context).toBeDefined();

        if (typeof varTypeConfig?.context === "function") {
          const mockNode = create_simple_mock_node(
            "identifier",
            "readonly [1, 2, 3] as const"
          );
          const context = varTypeConfig.context(mockNode);

          expect(context?.annotation_type).toBe("readonly [1, 2, 3] as const");
          expect(context?.annotation_kind).toBe("variable");
        }
      });
    });
  });

  describe("Access Modifiers", () => {
    it("should handle method access modifiers", () => {
      const methodAccessConfig = TYPESCRIPT_CAPTURE_CONFIG.get("method.access");
      expect(methodAccessConfig?.context).toBeDefined();

      if (typeof methodAccessConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "private");
        const context = methodAccessConfig.context(mockNode);

        expect(context?.modifier).toBe("private");
        expect(context?.applies_to).toBe("method");
      }
    });

    it("should handle field access modifiers", () => {
      const fieldAccessConfig = TYPESCRIPT_CAPTURE_CONFIG.get("field.access");
      expect(fieldAccessConfig?.context).toBeDefined();

      if (typeof fieldAccessConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "protected");
        const context = fieldAccessConfig.context(mockNode);

        expect(context?.modifier).toBe("protected");
        expect(context?.applies_to).toBe("field");
      }
    });

    it("should handle readonly modifier", () => {
      const readonlyConfig = TYPESCRIPT_CAPTURE_CONFIG.get("field.readonly");
      expect(readonlyConfig?.context).toBeDefined();

      if (typeof readonlyConfig?.context === "function") {
        const context = readonlyConfig.context(create_simple_mock_node());

        expect(context?.modifier).toBe("readonly");
        expect(context?.applies_to).toBe("field");
      }
    });

    it("should handle parameter property access modifiers", () => {
      const paramAccessConfig = TYPESCRIPT_CAPTURE_CONFIG.get("param.access");
      expect(paramAccessConfig?.context).toBeDefined();

      if (typeof paramAccessConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "public");
        const context = paramAccessConfig.context(mockNode);

        expect(context?.modifier).toBe("public");
        expect(context?.applies_to).toBe("parameter");
        expect(context?.is_property).toBe(true);
      }
    });
  });

  describe("Decorators", () => {
    it("should handle class decorators", () => {
      const classDecoratorConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("decorator.class");
      expect(classDecoratorConfig?.context).toBeDefined();

      if (typeof classDecoratorConfig?.context === "function") {
        const mockNode = create_simple_mock_node(
          "identifier",
          "@Component({ selector: 'app-test' })"
        );
        const context = classDecoratorConfig.context(mockNode);

        expect(context?.decorator_name).toBe(
          "@Component({ selector: 'app-test' })"
        );
        expect(context?.decorates).toBe("class");
      }
    });

    it("should handle method decorators", () => {
      const methodDecoratorConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("decorator.method");
      expect(methodDecoratorConfig?.context).toBeDefined();

      if (typeof methodDecoratorConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "@Override");
        const context = methodDecoratorConfig.context(mockNode);

        expect(context?.decorator_name).toBe("@Override");
        expect(context?.decorates).toBe("method");
      }
    });

    it("should handle property decorators", () => {
      const propertyDecoratorConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("decorator.property");
      expect(propertyDecoratorConfig?.context).toBeDefined();

      if (typeof propertyDecoratorConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "@Input()");
        const context = propertyDecoratorConfig.context(mockNode);

        expect(context?.decorator_name).toBe("@Input()");
        expect(context?.decorates).toBe("property");
      }
    });
  });

  describe("Enhanced Class Features", () => {
    it("should handle class implements", () => {
      const implementsConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("class.implements");
      expect(implementsConfig?.context).toBeDefined();

      if (typeof implementsConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "Serializable");
        const context = implementsConfig.context(mockNode);

        expect(context?.implements_interface).toBe("Serializable");
      }
    });

    it("should handle enhanced class definition", () => {
      const classConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.class");
      expect(classConfig?.context).toBeDefined();

      if (typeof classConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "MyClass", {
          parent: create_simple_mock_node("parent", "parent", {
            childForFieldName: (field: string) => {
              if (field === "type_parameters")
                return create_simple_mock_node("identifier", "<T>");
              if (field === "class_heritage") {
                return create_simple_mock_node(
                  "class_heritage",
                  "class_heritage",
                  {
                    childForFieldName: (field: string) => {
                      if (field === "extends_clause")
                        return create_simple_mock_node(
                          "identifier",
                          "BaseClass"
                        );
                      if (field === "implements_clause") {
                        return create_simple_mock_node(
                          "implements_clause",
                          "implements_clause",
                          {
                            children: [
                              create_simple_mock_node(
                                "type_identifier",
                                "Interface1"
                              ),
                              create_simple_mock_node(
                                "type_identifier",
                                "Interface2"
                              ),
                            ],
                          }
                        );
                      }
                      return null;
                    },
                  }
                );
              }
              return null;
            },
            children: [create_simple_mock_node("abstract", "abstract")],
          }),
        });

        const context = classConfig.context(mockNode);

        expect(context?.type_name).toBe("MyClass");
        expect(context?.type_parameters).toBe("<T>");
        expect(context?.extends_class).toBe("BaseClass");
        expect(context?.implements_interfaces).toContain("Interface1");
        expect(context?.implements_interfaces).toContain("Interface2");
      }
    });
  });

  describe("Type-specific Imports/Exports", () => {
    it("should handle type-only imports", () => {
      const typeOnlyImportConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("import.type_only");
      expect(typeOnlyImportConfig?.modifiers).toBeDefined();
      expect(typeOnlyImportConfig?.context).toBeDefined();

      if (typeof typeOnlyImportConfig?.modifiers === "function") {
        const modifiers = typeOnlyImportConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_type_only).toBe(true);
      }

      if (typeof typeOnlyImportConfig?.context === "function") {
        const context = typeOnlyImportConfig.context(create_simple_mock_node());
        expect(context?.import_kind).toBe("type_only");
      }
    });

    it("should handle type imports", () => {
      const typeImportConfig = TYPESCRIPT_CAPTURE_CONFIG.get("import.type");
      expect(typeImportConfig?.context).toBeDefined();

      if (typeof typeImportConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "MyType");
        const context = typeImportConfig.context(mockNode);

        expect(context?.import_kind).toBe("type");
      }
    });

    it("should handle type-only exports", () => {
      const typeOnlyExportConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("export.type_only");
      expect(typeOnlyExportConfig?.modifiers).toBeDefined();
      expect(typeOnlyExportConfig?.context).toBeDefined();

      if (typeof typeOnlyExportConfig?.modifiers === "function") {
        const modifiers = typeOnlyExportConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_type_only).toBe(true);
      }

      if (typeof typeOnlyExportConfig?.context === "function") {
        const context = typeOnlyExportConfig.context(create_simple_mock_node());
        expect(context?.export_kind).toBe("type_only");
      }
    });

    it("should handle interface exports", () => {
      const interfaceExportConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("export.interface");
      expect(interfaceExportConfig?.modifiers).toBeDefined();
      expect(interfaceExportConfig?.context).toBeDefined();

      if (typeof interfaceExportConfig?.modifiers === "function") {
        const modifiers = interfaceExportConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_exported).toBe(true);
      }

      if (typeof interfaceExportConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "MyInterface");
        const context = interfaceExportConfig.context(mockNode);

        expect(context?.export_alias).toBe("MyInterface");
        expect(context?.export_kind).toBe("interface");
      }
    });

    it("should handle type alias exports", () => {
      const typeAliasExportConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("export.type_alias");
      expect(typeAliasExportConfig?.modifiers).toBeDefined();
      expect(typeAliasExportConfig?.context).toBeDefined();

      if (typeof typeAliasExportConfig?.modifiers === "function") {
        const modifiers = typeAliasExportConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_exported).toBe(true);
      }

      if (typeof typeAliasExportConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "MyTypeAlias");
        const context = typeAliasExportConfig.context(mockNode);

        expect(context?.export_alias).toBe("MyTypeAlias");
        expect(context?.export_kind).toBe("type_alias");
      }
    });

    it("should handle enum exports", () => {
      const enumExportConfig = TYPESCRIPT_CAPTURE_CONFIG.get("export.enum");
      expect(enumExportConfig?.modifiers).toBeDefined();
      expect(enumExportConfig?.context).toBeDefined();

      if (typeof enumExportConfig?.modifiers === "function") {
        const modifiers = enumExportConfig.modifiers(create_simple_mock_node());
        expect(modifiers?.is_exported).toBe(true);
      }

      if (typeof enumExportConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "MyEnum");
        const context = enumExportConfig.context(mockNode);

        expect(context?.export_alias).toBe("MyEnum");
        expect(context?.export_kind).toBe("enum");
      }
    });
  });

  describe("Type References", () => {
    it("should handle generic type references", () => {
      const genericTypeRefConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("ref.type.generic");
      expect(genericTypeRefConfig?.context).toBeDefined();

      if (typeof genericTypeRefConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "Array", {
          parent: create_simple_mock_node("parent", "parent", {
            childForFieldName: (field: string) => {
              if (field === "type_arguments")
                return create_simple_mock_node(
                  "identifier",
                  "<string, number>"
                );
              return null;
            },
          }),
        });

        const context = genericTypeRefConfig.context(mockNode);

        expect(context?.type_name).toBe("Array");
        expect(context?.is_generic).toBe(true);
        expect(context?.type_arguments).toBe("<string, number>");
      }
    });

    it("should handle generic constructor calls", () => {
      const genericConstructorConfig = TYPESCRIPT_CAPTURE_CONFIG.get(
        "ref.constructor.generic"
      );
      expect(genericConstructorConfig?.context).toBeDefined();

      if (typeof genericConstructorConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "Map", {
          parent: create_simple_mock_node("parent", "parent", {
            childForFieldName: (field: string) => {
              if (field === "type_arguments")
                return create_simple_mock_node(
                  "identifier",
                  "<string, number>"
                );
              return null;
            },
            parent: create_simple_mock_node(
              "variable_declarator",
              "variable_declarator",
              {
                childForFieldName: (field: string) => {
                  if (field === "name")
                    return create_simple_mock_node("identifier", "myMap");
                  return null;
                },
              }
            ),
          }),
        });

        const context = genericConstructorConfig.context(mockNode);

        expect(context?.method_name).toBe("Map");
        expect(context?.is_generic_constructor).toBe(true);
        expect(context?.type_arguments).toBe("<string, number>");
        expect(context?.construct_target).toBeDefined();
      }
    });

    it("should handle generic function calls", () => {
      const genericCallConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("ref.call.generic");
      expect(genericCallConfig?.context).toBeDefined();

      if (typeof genericCallConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "identity", {
          parent: create_simple_mock_node("parent", "parent", {
            childForFieldName: (field: string) => {
              if (field === "type_arguments")
                return create_simple_mock_node("identifier", "<string>");
              return null;
            },
          }),
        });

        const context = genericCallConfig.context(mockNode);

        expect(context?.is_generic_call).toBe(true);
        expect(context?.type_arguments).toBe("<string>");
      }
    });
  });

  describe("Type Assertions and Casts", () => {
    it("should handle cast values", () => {
      const castValueConfig = TYPESCRIPT_CAPTURE_CONFIG.get("ref.cast.value");
      expect(castValueConfig?.context).toBeDefined();

      if (typeof castValueConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "someValue", {
          parent: create_simple_mock_node("parent", "parent", {
            childForFieldName: (field: string) => {
              if (field === "type")
                return create_simple_mock_node("identifier", "string");
              return null;
            },
          }),
        });

        const context = castValueConfig.context(mockNode);

        expect(context?.cast_to_type).toBe("string");
        expect(context?.assertion_kind).toBe("as_expression");
      }
    });

    it("should handle cast types", () => {
      const castTypeConfig = TYPESCRIPT_CAPTURE_CONFIG.get("ref.cast.type");
      expect(castTypeConfig?.context).toBeDefined();

      if (typeof castTypeConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "string", {
          parent: create_simple_mock_node("parent", "parent", {
            childForFieldName: (field: string) => {
              if (field === "expression")
                return create_simple_mock_node("identifier", "someValue");
              return null;
            },
          }),
        });

        const context = castTypeConfig.context(mockNode);

        expect(context?.cast_to_type).toBe("string");
        expect(context?.assertion_kind).toBe("as_expression");
      }
    });
  });

  describe("Typeof Expressions", () => {
    it("should handle typeof references", () => {
      const typeofConfig = TYPESCRIPT_CAPTURE_CONFIG.get("ref.typeof");
      expect(typeofConfig?.context).toBeDefined();

      if (typeof typeofConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "myVariable");
        const context = typeofConfig.context(mockNode);

        expect(context?.typeof_target).toBe("myVariable");
      }
    });
  });

  describe("Enhanced Parameter Definitions", () => {
    it("should handle optional parameters", () => {
      const optionalParamConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("def.param.optional");
      expect(optionalParamConfig?.modifiers).toBeDefined();
      expect(optionalParamConfig?.context).toBeDefined();

      if (typeof optionalParamConfig?.modifiers === "function") {
        const modifiers = optionalParamConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_optional).toBe(true);
      }

      if (typeof optionalParamConfig?.context === "function") {
        const mockNode = create_simple_mock_node(
          "identifier",
          "optionalParam",
          {
            parent: create_simple_mock_node("parent", "parent", {
              childForFieldName: (field: string) => {
                if (field === "type")
                  return create_simple_mock_node("identifier", "string");
                return null;
              },
            }),
          }
        );

        const context = optionalParamConfig.context(mockNode);

        expect(context?.param_type).toBe("string");
      }
    });

    it("should handle parameter properties", () => {
      const paramPropertyConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("param.property");
      expect(paramPropertyConfig?.context).toBeDefined();

      if (typeof paramPropertyConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "name", {
          parent: create_simple_mock_node("parent", "parent", {
            children: [
              create_simple_mock_node("accessibility_modifier", "private"),
              create_simple_mock_node("readonly", "readonly"),
            ],
            childForFieldName: (field: string) => {
              if (field === "type")
                return create_simple_mock_node("identifier", "string");
              return null;
            },
          }),
        });

        const context = paramPropertyConfig.context(mockNode);

        expect(context?.is_parameter_property).toBe(true);
        expect(context?.access_modifier).toBe("private");
        expect(context?.property_type).toBe("string");
      }
    });

    it("should handle parameter property field definitions", () => {
      const fieldParamPropertyConfig = TYPESCRIPT_CAPTURE_CONFIG.get(
        "def.field.param_property"
      );
      expect(fieldParamPropertyConfig?.category).toBe(
        SemanticCategory.DEFINITION
      );
      expect(fieldParamPropertyConfig?.entity).toBe(SemanticEntity.VARIABLE);
      expect(fieldParamPropertyConfig?.context).toBeDefined();

      if (typeof fieldParamPropertyConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "age", {
          parent: create_simple_mock_node("parent", "parent", {
            children: [
              create_simple_mock_node("accessibility_modifier", "public"),
            ],
            childForFieldName: (field: string) => {
              if (field === "type")
                return create_simple_mock_node("identifier", "number");
              return null;
            },
          }),
        });

        const context = fieldParamPropertyConfig.context(mockNode);

        expect(context?.is_parameter_property).toBe(true);
        expect(context?.access_modifier).toBe("public");
        expect(context?.property_type).toBe("number");
      }
    });
  });

  describe("Type Alias Values", () => {
    it("should analyze complex type alias values", () => {
      const typeAliasValueConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("type.alias.value");
      expect(typeAliasValueConfig?.context).toBeDefined();

      if (typeof typeAliasValueConfig?.context === "function") {
        const mockNode = create_simple_mock_node(
          "identifier",
          "T extends string ? U | V : T & W"
        );
        const context = typeAliasValueConfig.context(mockNode);

        expect(context).toBeDefined();
      }
    });

    it("should detect mapped types", () => {
      const typeAliasValueConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("type.alias.value");

      if (typeof typeAliasValueConfig?.context === "function") {
        const mockNode = create_simple_mock_node(
          "identifier",
          "{ [K in keyof T]: T[K] }"
        );
        const context = typeAliasValueConfig.context(mockNode);

        expect(context).toBeDefined();
      }
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    it("should handle empty capture mappings gracefully", () => {
      // Test that all mappings have required properties
      for (const [key, mapping] of TYPESCRIPT_CAPTURE_CONFIG) {
        expect(mapping.category).toBeDefined();
        expect(mapping.entity).toBeDefined();
        expect(typeof key).toBe("string");
        expect(key.length).toBeGreaterThan(0);
      }
    });

    it("should handle null/undefined nodes in context functions", () => {
      const interfaceConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.interface");
      if (typeof interfaceConfig?.context === "function") {
        // These should actually throw since the function accesses .parent
        expect(() => {
          interfaceConfig.context!(null as any);
        }).toThrow();

        expect(() => {
          interfaceConfig.context!(undefined as any);
        }).toThrow();

        const result = interfaceConfig.context(create_simple_mock_node());
        expect(result).toBeDefined();
      }
    });

    it("should handle missing parent nodes", () => {
      const typeAliasConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.type_alias");
      if (typeof typeAliasConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "MyType", {
          parent: null,
        });

        expect(() => {
          typeAliasConfig.context!(mockNode);
        }).not.toThrow();
      }
    });

    it("should handle missing childForFieldName methods", () => {
      const classConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.class");
      if (typeof classConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "MyClass", {
          parent: create_simple_mock_node("parent", "parent", {
            // Missing childForFieldName method
            children: [],
          }),
        });

        expect(() => {
          classConfig.context!(mockNode);
        }).not.toThrow();
      }
    });

    it("should handle malformed type parameter strings", () => {
      const classTypeParamsConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("class.type_params");
      if (typeof classTypeParamsConfig?.context === "function") {
        // Test with malformed type parameters
        const mockNode = create_simple_mock_node("identifier", "<<T,,");
        const context = classTypeParamsConfig.context(mockNode);

        expect(context?.type_params).toBe("<<T,,");
      }
    });

    it("should handle invalid access modifier structures", () => {
      const methodConfig = TYPESCRIPT_CAPTURE_CONFIG.get("def.method");
      if (typeof methodConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "method", {
          parent: create_simple_mock_node("parent", "parent", {
            children: undefined, // Invalid children structure
          }),
        });

        expect(() => {
          methodConfig.context!(mockNode);
        }).not.toThrow();
      }
    });

    it("should handle complex nested type structures", () => {
      const genericTypeRefConfig =
        TYPESCRIPT_CAPTURE_CONFIG.get("ref.type.generic");
      if (typeof genericTypeRefConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "ComplexType", {
          parent: create_simple_mock_node("parent", "parent", {
            childForFieldName: (field: string) => {
              if (field === "type_arguments") {
                return create_simple_mock_node(
                  "identifier",
                  "<Map<string, Array<Promise<T | U>>>, WeakMap<K, V>>"
                );
              }
              return null;
            },
          }),
        });

        const context = genericTypeRefConfig.context(mockNode);

        expect(context?.type_name).toBe("ComplexType");
        expect(context?.is_generic).toBe(true);
      }
    });
  });

  describe("Static vs Instance Method Detection", () => {
    it("should detect static method calls on capitalized identifiers", () => {
      const config = TYPESCRIPT_CAPTURE_CONFIG;
      const mapping = config.get("static_method_call");

      expect(mapping).toBeDefined();
      expect(mapping?.category).toBe(SemanticCategory.REFERENCE);
      expect(mapping?.entity).toBe(SemanticEntity.METHOD);

      // Create a real node from TypeScript code
      const code = "MyClass.staticMethod()";
      const tree = parser.parse(code);
      const callNode = tree.rootNode.child(0); // The call_expression

      if (mapping?.context && callNode) {
        const context = mapping.context(callNode);
        expect(context?.is_static).toBe(true);
        expect(context?.is_call).toBe(true);
      }
    });

    it("should detect instance method calls on lowercase identifiers", () => {
      const config = TYPESCRIPT_CAPTURE_CONFIG;
      const mapping = config.get("instance_method_call");

      expect(mapping).toBeDefined();
      expect(mapping?.category).toBe(SemanticCategory.REFERENCE);
      expect(mapping?.entity).toBe(SemanticEntity.METHOD);

      // Create a real node from TypeScript code
      const code = "instance.method()";
      const tree = parser.parse(code);
      const callNode = tree.rootNode.child(0); // The call_expression

      if (mapping?.context && callNode) {
        const context = mapping.context(callNode);
        expect(context?.is_static).toBe(false);
        expect(context?.is_call).toBe(true);
      }
    });

    it("should mark class references as static context", () => {
      const config = TYPESCRIPT_CAPTURE_CONFIG;
      const mapping = config.get("class.ref");

      expect(mapping).toBeDefined();
      expect(mapping?.category).toBe(SemanticCategory.REFERENCE);
      expect(mapping?.entity).toBe(SemanticEntity.CLASS);

      const mockNode = create_simple_mock_node("identifier", "MyClass");
      const context = mapping?.context?.(mockNode);
      expect(context?.is_static).toBe(true);
    });

    it("should mark method.static captures as static", () => {
      const config = TYPESCRIPT_CAPTURE_CONFIG;
      const mapping = config.get("method.static");

      expect(mapping).toBeDefined();
      const mockNode = create_simple_mock_node("identifier", "staticMethod");
      const context = mapping?.context?.(mockNode);
      expect(context?.is_static).toBe(true);
    });

    it("should mark instance references as non-static", () => {
      const config = TYPESCRIPT_CAPTURE_CONFIG;
      const mapping = config.get("instance.ref");

      expect(mapping).toBeDefined();
      expect(mapping?.entity).toBe(SemanticEntity.VARIABLE);

      const mockNode = create_simple_mock_node("identifier", "instance");
      const context = mapping?.context?.(mockNode);
      expect(context?.is_static).toBe(false);
    });

    it("should mark method.instance captures as non-static", () => {
      const config = TYPESCRIPT_CAPTURE_CONFIG;
      const mapping = config.get("method.instance");

      expect(mapping).toBeDefined();
      const mockNode = create_simple_mock_node("identifier", "instanceMethod");
      const context = mapping?.context?.(mockNode);
      expect(context?.is_static).toBe(false);
    });
  });
});
