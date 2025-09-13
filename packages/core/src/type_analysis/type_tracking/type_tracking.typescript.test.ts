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

  function parse_and_get_node(code: string, node_type: string) {
    const tree = parser.parse(code);
    let target_node: any = null;

    function walk(node: any) {
      if (node.type === node_type && !target_node) {
        target_node = node;
        return;
      }
      for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i));
      }
    }
    walk(tree.rootNode);
    return target_node;
  }

  describe("Interface tracking", () => {
    it("should track interface declarations", () => {
      const code = `
        interface User {
          name: string;
          age: number;
        }
      `;

      const interface_node = parse_and_get_node(code, "interface_declaration");
      const tracker = create_file_type_tracker();
      const context = {
        language: "typescript" as const,
        file_path: "test.ts" as FilePath,
        source_code: code as SourceCode,
      };

      const updated = track_typescript_interface(
        tracker,
        interface_node,
        context
      );
      const interface_type = get_variable_type(updated, "interface:User");

      expect(interface_type?.type_name).toBe("User");
      expect(interface_type?.type_kind).toBe("interface");
      expect(interface_type?.source).toBe("annotation");
    });

    it("should track exported interfaces", () => {
      const code = `
        export interface User {
          name: string;
        }
      `;

      const export_node = parse_and_get_node(code, "export_statement");
      const interface_node = export_node?.childForFieldName("declaration");
      const tracker = create_file_type_tracker();
      const context = {
        language: "typescript" as const,
        file_path: "test.ts" as FilePath,
        source_code: code as SourceCode,
      };

      if (interface_node) {
        const updated = track_typescript_interface(
          tracker,
          interface_node,
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

      const type_alias_node = parse_and_get_node(code, "type_alias_declaration");
      const tracker = create_file_type_tracker();
      const context = { language: "typescript" as const, file_path: "test.ts" as FilePath, source_code: code as SourceCode };

      const updated = track_typescript_type_alias(
        tracker,
        type_alias_node,
        context
      );
      const alias_type = get_variable_type(updated, "type:UserId");

      expect(alias_type?.type_name).toBe("UserId");
      expect(alias_type?.confidence).toBe("explicit");
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

      const enum_node = parse_and_get_node(code, "enum_declaration");
      const tracker = create_file_type_tracker();
      const context = { language: "typescript" as const, file_path: "test.ts" as FilePath, source_code: code as SourceCode };

      const updated = track_typescript_enum(tracker, enum_node, context);
      const enum_type = get_variable_type(updated, "enum:Status");

      expect(enum_type?.type_name).toBe("Status");
      expect(enum_type?.type_kind).toBe("class"); // Enums behave like classes
    });
  });

  describe("Complex generics", () => {
    it("should extract nested generic type parameters", () => {
      const code = `const map: Map<string, Array<User>> = new Map();`;
      const tree = parser.parse(code);
      const context = { language: "typescript" as const, file_path: "test.ts" as FilePath, source_code: code as SourceCode };

      // Find the generic_type node
      let generic_node: any = null;
      function walk(node: any) {
        if (node.type === "generic_type" && !generic_node) {
          generic_node = node;
          return;
        }
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i));
        }
      }
      walk(tree.rootNode);

      if (generic_node) {
        const result = extract_typescript_complex_generics(
          generic_node,
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
      let decorator_node: any = null;
      function walk(node: any) {
        if (node.type === "decorator" && !decorator_node) {
          decorator_node = node;
          return;
        }
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i));
        }
      }
      walk(tree.rootNode);

      if (decorator_node) {
        const type_info = extract_decorator_type_metadata(
          decorator_node,
          context
        );
        expect(type_info?.type_name).toBe("Service");
        expect(type_info?.type_kind).toBe("class");
        expect(type_info?.confidence).toBe("inferred");
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

      const namespace_node = parse_and_get_node(code, "module");
      if (!namespace_node) {
        // Try alternative node type
        const alt_node = parse_and_get_node(code, "namespace_declaration");
        if (alt_node) {
          const tracker = create_file_type_tracker();
          const context = {
            language: "typescript" as const,
            file_path: "test.ts" as FilePath,
            source_code: code as SourceCode,
          };

          const updated = track_typescript_namespace(
            tracker,
            alt_node,
            context
          );
          const namespace_type = get_variable_type(updated, "namespace:Utils");

          expect(namespace_type?.type_name).toBe("Utils");
          expect(namespace_type?.type_kind).toBe("object");
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
          namespace_node,
          context
        );
        const namespace_type = get_variable_type(updated, "namespace:Utils");

        expect(namespace_type?.type_name).toBe("Utils");
        expect(namespace_type?.type_kind).toBe("object");
      }
    });
  });
});
