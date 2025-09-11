/**
 * Tests for TypeScript bespoke type tracking
 */

import { describe, it, expect } from "vitest";
import { get_language_parser } from "../../scope_queries/loader";
import {
  track_typescript_interface,
  track_typescript_type_alias,
  track_typescript_enum,
  track_typescript_namespace,
  extract_typescript_complex_generics,
  extract_decorator_type_metadata,
} from "./type_tracking.typescript";
import {
  create_file_type_tracker,
  is_exported,
} from "./type_tracking";
import { get_variable_type } from "./test_utils";
import { FilePath, SourceCode } from "@ariadnejs/types";

describe("TypeScript bespoke type tracking", () => {
  const parser = get_language_parser("typescript");

  function parseAndGetNode(code: string, nodeType: string) {
    const tree = parser.parse(code);
    let targetNode: any = null;

    function walk(node: any) {
      if (node.type === nodeType && !targetNode) {
        targetNode = node;
        return;
      }
      for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i));
      }
    }
    walk(tree.rootNode);
    return targetNode;
  }

  describe("Interface tracking", () => {
    it("should track interface declarations", () => {
      const code = `
        interface User {
          name: string;
          age: number;
        }
      `;

      const interfaceNode = parseAndGetNode(code, "interface_declaration");
      const tracker = create_file_type_tracker();
      const context = {
        language: "typescript" as const,
        file_path: "test.ts" as FilePath,
        source_code: code as SourceCode,
      };

      const updated = track_typescript_interface(
        tracker,
        interfaceNode,
        context
      );
      const interfaceType = get_variable_type(updated, "interface:User");

      expect(interfaceType?.type_name).toBe("User");
      expect(interfaceType?.type_kind).toBe("interface");
      expect(interfaceType?.source).toBe("annotation");
    });

    it("should track exported interfaces", () => {
      const code = `
        export interface User {
          name: string;
        }
      `;

      const exportNode = parseAndGetNode(code, "export_statement");
      const interfaceNode = exportNode?.childForFieldName("declaration");
      const tracker = create_file_type_tracker();
      const context = {
        language: "typescript" as const,
        file_path: "test.ts" as FilePath,
        source_code: code as SourceCode,
      };

      if (interfaceNode) {
        const updated = track_typescript_interface(
          tracker,
          interfaceNode,
          context
        );
        expect(is_exported(updated, "User")).toBe(true);
      }
    });
  });

  describe("Type alias tracking", () => {
    it("should track type alias declarations", () => {
      const code = `
        type UserId = string;
      `;

      const typeAliasNode = parseAndGetNode(code, "type_alias_declaration");
      const tracker = create_file_type_tracker();
      const context = { language: "typescript" as const, file_path: "test.ts" as FilePath, source_code: code as SourceCode };

      const updated = track_typescript_type_alias(
        tracker,
        typeAliasNode,
        context
      );
      const aliasType = get_variable_type(updated, "type:UserId");

      expect(aliasType?.type_name).toBe("UserId");
      expect(aliasType?.confidence).toBe("explicit");
    });
  });

  describe("Enum tracking", () => {
    it("should track enum declarations", () => {
      const code = `
        enum Status {
          Active,
          Inactive,
          Pending
        }
      `;

      const enumNode = parseAndGetNode(code, "enum_declaration");
      const tracker = create_file_type_tracker();
      const context = { language: "typescript" as const, file_path: "test.ts" as FilePath, source_code: code as SourceCode };

      const updated = track_typescript_enum(tracker, enumNode, context);
      const enumType = get_variable_type(updated, "enum:Status");

      expect(enumType?.type_name).toBe("Status");
      expect(enumType?.type_kind).toBe("class"); // Enums behave like classes
    });
  });

  describe("Complex generics", () => {
    it("should extract nested generic type parameters", () => {
      const code = `const map: Map<string, Array<User>> = new Map();`;
      const tree = parser.parse(code);
      const context = { language: "typescript" as const, file_path: "test.ts" as FilePath, source_code: code as SourceCode };

      // Find the generic_type node
      let genericNode: any = null;
      function walk(node: any) {
        if (node.type === "generic_type" && !genericNode) {
          genericNode = node;
          return;
        }
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i));
        }
      }
      walk(tree.rootNode);

      if (genericNode) {
        const result = extract_typescript_complex_generics(
          genericNode,
          context
        );
        expect(result).toBe("Map<string, Array<User>>");
      }
    });
  });

  describe("Decorator metadata", () => {
    it("should extract type information from decorators", () => {
      const code = `
        @Injectable()
        class UserService {}
      `;

      const tree = parser.parse(code);
      const context = { language: "typescript" as const, file_path: "test.ts" as FilePath, source_code: code as SourceCode };

      // Find decorator node
      let decoratorNode: any = null;
      function walk(node: any) {
        if (node.type === "decorator" && !decoratorNode) {
          decoratorNode = node;
          return;
        }
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i));
        }
      }
      walk(tree.rootNode);

      if (decoratorNode) {
        const typeInfo = extract_decorator_type_metadata(
          decoratorNode,
          context
        );
        expect(typeInfo?.type_name).toBe("Service");
        expect(typeInfo?.type_kind).toBe("class");
        expect(typeInfo?.confidence).toBe("inferred");
      }
    });
  });

  describe("Namespace tracking", () => {
    it("should track namespace declarations", () => {
      const code = `
        namespace Utils {
          export function helper() {}
        }
      `;

      const namespaceNode = parseAndGetNode(code, "module");
      if (!namespaceNode) {
        // Try alternative node type
        const altNode = parseAndGetNode(code, "namespace_declaration");
        if (altNode) {
          const tracker = create_file_type_tracker();
          const context = {
            language: "typescript" as const,
            file_path: "test.ts" as FilePath,
            source_code: code as SourceCode,
          };

          const updated = track_typescript_namespace(
            tracker,
            altNode,
            context
          );
          const namespaceType = get_variable_type(updated, "namespace:Utils");

          expect(namespaceType?.type_name).toBe("Utils");
          expect(namespaceType?.type_kind).toBe("object");
        }
      } else {
        const tracker = create_file_type_tracker();
        const context = {
          language: "typescript" as const,
          file_path: "test.ts" as FilePath,
          source_code: code as SourceCode,
        };

        const updated = track_typescript_namespace(
          tracker,
          namespaceNode,
          context
        );
        const namespaceType = get_variable_type(updated, "namespace:Utils");

        expect(namespaceType?.type_name).toBe("Utils");
        expect(namespaceType?.type_kind).toBe("object");
      }
    });
  });
});
