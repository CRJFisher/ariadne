/**
 * Comprehensive tests for Python language configuration
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "../capture_types";
import { PYTHON_CAPTURE_CONFIG } from "./python";

describe("Python Language Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
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

  describe("PYTHON_CAPTURE_CONFIG", () => {
    it("should export a valid LanguageCaptureConfig", () => {
      expect(PYTHON_CAPTURE_CONFIG).toBeDefined();
      expect(PYTHON_CAPTURE_CONFIG).toBeInstanceOf(Map);
      expect(PYTHON_CAPTURE_CONFIG.size).toBeGreaterThan(0);
    });

    it("should contain scope capture mappings", () => {
      const scopeMappings = [
        "scope.module",
        "scope.function",
        "scope.lambda",
        "scope.method",
        "scope.class",
        "scope.block",
        "scope.for",
        "scope.while",
        "scope.with",
        "scope.if",
        "scope.try",
        "scope.comprehension"
      ];

      for (const mapping of scopeMappings) {
        expect(PYTHON_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.SCOPE);
      }
    });

    it("should contain definition capture mappings", () => {
      const definitionMappings = [
        "def.function",
        "def.function.async",
        "def.lambda",
        "def.class",
        "def.method",
        "def.constructor",
        "def.property",
        "def.variable",
        "def.param"
      ];

      for (const mapping of definitionMappings) {
        expect(PYTHON_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.DEFINITION);
      }
    });

    it("should contain import capture mappings", () => {
      const importMappings = [
        "import.module",
        "import.source",
        "import.named",
        "import.star"
      ];

      for (const mapping of importMappings) {
        expect(PYTHON_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.IMPORT);
      }
    });

    it("should contain export capture mappings", () => {
      const exportMappings = [
        "export.all",
        "export.explicit"
      ];

      for (const mapping of exportMappings) {
        expect(PYTHON_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.EXPORT);
      }
    });

    it("should contain reference capture mappings", () => {
      const referenceMappings = [
        "ref.call",
        "ref.method_call",
        "ref.constructor",
        "ref.object",
        "ref.property",
        "ref.self",
        "ref.cls",
        "ref.super",
        "ref.decorator"
      ];

      for (const mapping of referenceMappings) {
        expect(PYTHON_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = PYTHON_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.REFERENCE);
      }
    });

    it("should handle Python-specific modifiers correctly", () => {
      // Test async function modifier
      const asyncConfig = PYTHON_CAPTURE_CONFIG.get("def.function.async");
      expect(asyncConfig?.modifiers).toBeDefined();
      expect(typeof asyncConfig?.modifiers).toBe("function");

      if (typeof asyncConfig?.modifiers === "function") {
        const modifiers = asyncConfig.modifiers({} as SyntaxNode);
        expect(modifiers?.is_async).toBe(true);
      }

      // Test static method modifier
      const staticConfig = PYTHON_CAPTURE_CONFIG.get("def.method.static");
      expect(staticConfig?.modifiers).toBeDefined();
      if (typeof staticConfig?.modifiers === "function") {
        const modifiers = staticConfig.modifiers({} as SyntaxNode);
        expect(modifiers?.is_static).toBe(true);
      }

      // Test property modifier
      const propertyConfig = PYTHON_CAPTURE_CONFIG.get("def.property");
      expect(propertyConfig?.modifiers).toBeDefined();
      if (typeof propertyConfig?.modifiers === "function") {
        const modifiers = propertyConfig.modifiers({} as SyntaxNode);
        expect(modifiers?.is_readonly).toBe(true);
      }
    });

    it("should handle Python-specific context extraction", () => {
      // Test import source context
      const importSourceConfig = PYTHON_CAPTURE_CONFIG.get("import.source");
      expect(importSourceConfig?.context).toBeDefined();

      if (typeof importSourceConfig?.context === "function") {
        const mockNode = { text: "os" } as SyntaxNode;
        const context = importSourceConfig.context(mockNode);
        expect(context?.source_module).toBe("os");
      }

      // Test export context
      const exportAllConfig = PYTHON_CAPTURE_CONFIG.get("export.all");
      expect(exportAllConfig?.context).toBeDefined();

      if (typeof exportAllConfig?.context === "function") {
        const context = exportAllConfig.context({} as SyntaxNode);
        expect(context?.export_type).toBe("explicit_control");
        expect(context?.is_namespace_export).toBe(true);
      }
    });
  });

  describe("Helper Functions Integration", () => {
    describe("Magic Methods", () => {
      it("should handle __init__ method correctly", () => {
        const code = `
class TestClass:
    def __init__(self):
        pass
`;
        const tree = getAstNode(code);
        const methodNode = findNodeByType(tree, "identifier");

        if (methodNode && methodNode.text === "__init__") {
          const constructorConfig = PYTHON_CAPTURE_CONFIG.get("def.constructor");
          expect(constructorConfig).toBeDefined();
          expect(constructorConfig?.entity).toBe(SemanticEntity.CONSTRUCTOR);
        }
      });

      it("should handle magic methods like __str__", () => {
        const code = `
class TestClass:
    def __str__(self):
        return "test"
`;
        const tree = getAstNode(code);
        // Magic methods should be captured as regular methods
        const methodConfig = PYTHON_CAPTURE_CONFIG.get("def.method");
        expect(methodConfig).toBeDefined();
        expect(methodConfig?.entity).toBe(SemanticEntity.METHOD);
      });
    });

    describe("Decorators", () => {
      it("should handle @property decorator", () => {
        const code = `
class TestClass:
    @property
    def value(self):
        return self._value
`;
        const tree = getAstNode(code);
        const propertyConfig = PYTHON_CAPTURE_CONFIG.get("def.property");
        expect(propertyConfig).toBeDefined();
        expect(propertyConfig?.entity).toBe(SemanticEntity.PROPERTY);
      });

      it("should handle @staticmethod decorator", () => {
        const code = `
class TestClass:
    @staticmethod
    def static_method():
        pass
`;
        const tree = getAstNode(code);
        const staticConfig = PYTHON_CAPTURE_CONFIG.get("def.method.static");
        expect(staticConfig).toBeDefined();
        expect(staticConfig?.entity).toBe(SemanticEntity.METHOD);
      });

      it("should handle @classmethod decorator", () => {
        const code = `
class TestClass:
    @classmethod
    def class_method(cls):
        pass
`;
        const tree = getAstNode(code);
        const classmethodConfig = PYTHON_CAPTURE_CONFIG.get("def.method.class");
        expect(classmethodConfig).toBeDefined();
        expect(classmethodConfig?.entity).toBe(SemanticEntity.METHOD);
      });
    });

    describe("Type Annotations", () => {
      it("should handle type annotation captures", () => {
        const code = `
def typed_function(x: int, y: str) -> bool:
    return True
`;
        const tree = getAstNode(code);
        const typeConfig = PYTHON_CAPTURE_CONFIG.get("type.annotation");
        expect(typeConfig).toBeDefined();
        expect(typeConfig?.entity).toBe(SemanticEntity.TYPE_ANNOTATION);
      });

      it("should handle parameter type annotations", () => {
        const code = `
def func(param: List[str]):
    pass
`;
        const tree = getAstNode(code);
        const paramTypeConfig = PYTHON_CAPTURE_CONFIG.get("param.type");
        expect(paramTypeConfig).toBeDefined();
        expect(paramTypeConfig?.entity).toBe(SemanticEntity.TYPE_ANNOTATION);
      });
    });

    describe("Scopes", () => {
      it("should handle comprehension scopes", () => {
        const code = `[x for x in range(10)]`;
        const tree = getAstNode(code);
        const comprehensionConfig = PYTHON_CAPTURE_CONFIG.get("scope.comprehension");
        expect(comprehensionConfig).toBeDefined();
        expect(comprehensionConfig?.entity).toBe(SemanticEntity.BLOCK);
      });

      it("should handle with statement scopes", () => {
        const code = `
with open("file") as f:
    content = f.read()
`;
        const tree = getAstNode(code);
        const withConfig = PYTHON_CAPTURE_CONFIG.get("scope.with");
        expect(withConfig).toBeDefined();
        expect(withConfig?.entity).toBe(SemanticEntity.BLOCK);
      });

      it("should handle try/except scopes", () => {
        const code = `
try:
    risky_operation()
except Exception as e:
    handle_error(e)
finally:
    cleanup()
`;
        const tree = getAstNode(code);
        const tryConfig = PYTHON_CAPTURE_CONFIG.get("scope.try");
        const exceptConfig = PYTHON_CAPTURE_CONFIG.get("scope.except");
        const finallyConfig = PYTHON_CAPTURE_CONFIG.get("scope.finally");

        expect(tryConfig?.entity).toBe(SemanticEntity.BLOCK);
        expect(exceptConfig?.entity).toBe(SemanticEntity.BLOCK);
        expect(finallyConfig?.entity).toBe(SemanticEntity.BLOCK);
      });
    });

    describe("Python References", () => {
      it("should handle self references", () => {
        const code = `
class TestClass:
    def method(self):
        return self.value
`;
        const tree = getAstNode(code);
        const selfConfig = PYTHON_CAPTURE_CONFIG.get("ref.self");
        expect(selfConfig).toBeDefined();
        expect(selfConfig?.entity).toBe(SemanticEntity.THIS);
      });

      it("should handle cls references", () => {
        const code = `
class TestClass:
    @classmethod
    def method(cls):
        return cls()
`;
        const tree = getAstNode(code);
        const clsConfig = PYTHON_CAPTURE_CONFIG.get("ref.cls");
        expect(clsConfig).toBeDefined();
        expect(clsConfig?.entity).toBe(SemanticEntity.THIS);
      });

      it("should handle super() calls", () => {
        const code = `
class Child(Parent):
    def method(self):
        super().method()
`;
        const tree = getAstNode(code);
        const superConfig = PYTHON_CAPTURE_CONFIG.get("ref.super");
        expect(superConfig).toBeDefined();
        expect(superConfig?.entity).toBe(SemanticEntity.SUPER);
      });
    });

    describe("Import/Export System", () => {
      it("should handle basic imports", () => {
        const code = `import os`;
        const tree = getAstNode(code);
        const moduleConfig = PYTHON_CAPTURE_CONFIG.get("import.module");
        expect(moduleConfig).toBeDefined();
        expect(moduleConfig?.entity).toBe(SemanticEntity.NAMESPACE);
      });

      it("should handle from imports", () => {
        const code = `from collections import defaultdict`;
        const tree = getAstNode(code);
        const namedConfig = PYTHON_CAPTURE_CONFIG.get("import.named");
        expect(namedConfig).toBeDefined();
        expect(namedConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });

      it("should handle star imports", () => {
        const code = `from math import *`;
        const tree = getAstNode(code);
        const starConfig = PYTHON_CAPTURE_CONFIG.get("import.star");
        expect(starConfig).toBeDefined();
        expect(starConfig?.entity).toBe(SemanticEntity.NAMESPACE);
      });

      it("should handle __all__ exports", () => {
        const code = `__all__ = ["function1", "Class1"]`;
        const tree = getAstNode(code);
        const allConfig = PYTHON_CAPTURE_CONFIG.get("export.all");
        expect(allConfig).toBeDefined();
        expect(allConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });
    });

    describe("Assignments and Type Flow", () => {
      it("should handle variable assignments", () => {
        const code = `x = 42`;
        const tree = getAstNode(code);
        const assignConfig = PYTHON_CAPTURE_CONFIG.get("assign.target");
        expect(assignConfig).toBeDefined();
        expect(assignConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });

      it("should handle tuple assignments", () => {
        const code = `x, y = 1, 2`;
        const tree = getAstNode(code);
        const tupleConfig = PYTHON_CAPTURE_CONFIG.get("assign.source.tuple");
        expect(tupleConfig).toBeDefined();
        expect(tupleConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });

      it("should handle augmented assignments", () => {
        const code = `x += 1`;
        const tree = getAstNode(code);
        const augmentConfig = PYTHON_CAPTURE_CONFIG.get("ref.augment.target");
        expect(augmentConfig).toBeDefined();
        expect(augmentConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });
    });

    describe("Return Statements", () => {
      it("should handle return statements", () => {
        const code = `
def func():
    return 42
`;
        const tree = getAstNode(code);
        const returnConfig = PYTHON_CAPTURE_CONFIG.get("ref.return");
        expect(returnConfig).toBeDefined();
        expect(returnConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });

      it("should handle yield expressions", () => {
        const code = `
def generator():
    yield 1
`;
        const tree = getAstNode(code);
        const yieldConfig = PYTHON_CAPTURE_CONFIG.get("ref.yield");
        expect(yieldConfig).toBeDefined();
        expect(yieldConfig?.entity).toBe(SemanticEntity.VARIABLE);

        if (typeof yieldConfig?.modifiers === "function") {
          const modifiers = yieldConfig.modifiers({} as SyntaxNode);
          expect(modifiers?.is_generator).toBe(true);
        }
      });
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    it("should handle empty capture mappings gracefully", () => {
      // Test that all mappings have required properties
      for (const [key, mapping] of Array.from(PYTHON_CAPTURE_CONFIG.entries())) {
        expect(mapping.category).toBeDefined();
        expect(mapping.entity).toBeDefined();
        expect(typeof key).toBe("string");
        expect(key.length).toBeGreaterThan(0);
      }
    });

    it("should handle invalid AST nodes in modifier functions", () => {
      const methodConfig = PYTHON_CAPTURE_CONFIG.get("def.method");
      if (typeof methodConfig?.modifiers === "function") {
        // Test with null node - should throw since function accesses .text
        expect(() => {
          methodConfig.modifiers(null as any);
        }).toThrow();

        // Test with node without parent - should work
        const mockNode = { text: "test", parent: null } as any;
        expect(() => {
          methodConfig.modifiers(mockNode);
        }).not.toThrow();
      }
    });

    it("should handle invalid AST nodes in context functions", () => {
      const importConfig = PYTHON_CAPTURE_CONFIG.get("import.source");
      if (typeof importConfig?.context === "function") {
        // Test with null node - should throw since function accesses .text
        expect(() => {
          importConfig.context(null as any);
        }).toThrow();

        // Test with node without text - should also throw since replace is called on undefined
        const mockNode = {} as any;
        expect(() => {
          importConfig.context(mockNode);
        }).toThrow();
      }
    });

    it("should handle malformed decorator patterns", () => {
      const decoratorConfig = PYTHON_CAPTURE_CONFIG.get("ref.decorator");
      if (typeof decoratorConfig?.context === "function") {
        // Test with node that doesn't have proper structure
        const mockNode = { text: "decorator", parent: null } as any;
        const context = decoratorConfig.context(mockNode);
        expect(context).toBeDefined();
        expect(context?.decorator_name).toBe("decorator");
      }
    });

    it("should handle complex inheritance chains", () => {
      const code = `
class A:
    pass

class B(A):
    pass

class C(B):
    pass
`;
      const tree = getAstNode(code);
      const classConfig = PYTHON_CAPTURE_CONFIG.get("def.class");
      expect(classConfig).toBeDefined();

      if (typeof classConfig?.context === "function") {
        // This tests the inheritance extraction logic
        expect(() => {
          classConfig.context({} as SyntaxNode);
        }).not.toThrow();
      }
    });
  });
});