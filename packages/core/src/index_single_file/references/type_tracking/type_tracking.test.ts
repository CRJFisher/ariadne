/**
 * Tests for type tracking local extraction
 */

import { describe, it, expect } from "vitest";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../query_code_tree/capture_types";
import {
  SemanticCategory,
  SemanticEntity,
} from "../../query_code_tree/capture_types";
import {
  extract_type_tracking,
  type LocalTypeTracking,
  type LocalVariableAnnotation,
  type LocalVariableDeclaration,
  type LocalAssignment,
} from "./type_tracking";

describe("extract_type_tracking", () => {
  const mock_file_path = "test.ts" as FilePath;

  const mock_location: Location = {
    file_path: mock_file_path,
    start_line: 1,
    start_column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mock_scope: LexicalScope = {
    id: "scope_1" as ScopeId,
    parent_id: null,
    name: "testFunction" as SymbolName,
    type: "function",
    location: {
      file_path: mock_file_path,
      start_line: 1,
      start_column: 0,
      end_line: 10, // Extended to line 10 to include test captures
      end_column: 10,
    },
    child_ids: [],
    symbols: new Map(),
  };

  const mock_scopes = new Map<ScopeId, LexicalScope>([
    [mock_scope.id, mock_scope],
  ]);

  describe("LocalVariableAnnotation extraction", () => {
    it("should extract type annotations without resolution", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "MyClass",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: mock_location,
          context: {
            annotated_var_name: "x",
            declaration_kind: "let",
          },
          modifiers: {},
        },
        {
          text: "string",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: {
            ...mock_location,
            line: 2,
            end_line: 2,
          },
          context: {
            annotated_var_name: "y",
            declaration_kind: "const",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      // Should capture annotation text only, no TypeInfo or resolution
      expect(tracking.annotations).toHaveLength(2);

      expect(tracking.annotations[0].annotation_text).toBe("MyClass");
      expect(tracking.annotations[0].name).toBe("x");
      expect(tracking.annotations[0].kind).toBe("let");
      expect(tracking.annotations[0].scope_id).toBe(mock_scope.id);

      expect(tracking.annotations[1].annotation_text).toBe("string");
      expect(tracking.annotations[1].name).toBe("y");
      expect(tracking.annotations[1].kind).toBe("const");
    });

    it("should extract parameter annotations", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "number",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: mock_location,
          context: {
            parameter_name: "count",
            declaration_kind: "parameter",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.annotations).toHaveLength(1);
      expect(tracking.annotations[0].annotation_text).toBe("number");
      expect(tracking.annotations[0].name).toBe("count");
      expect(tracking.annotations[0].kind).toBe("parameter");
    });

    it("should extract complex type annotations as strings", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "Array<string>",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: mock_location,
          context: {
            annotated_var_name: "items",
            declaration_kind: "const",
          },
          modifiers: {},
        },
        {
          text: "Map<string, number>",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: {
            ...mock_location,
            line: 2,
            end_line: 2,
          },
          context: {
            annotated_var_name: "lookup",
            declaration_kind: "const",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.annotations[0].annotation_text).toBe("Array<string>");
      expect(tracking.annotations[1].annotation_text).toBe(
        "Map<string, number>"
      );
    });
  });

  describe("LocalVariableDeclaration extraction", () => {
    it("should extract variable declarations", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "x",
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: mock_location,
          context: {
            declaration_kind: "let",
            type_annotation: "MyClass",
            initializer_text: "new MyClass()",
          },
          modifiers: {},
        },
        {
          text: "y",
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            ...mock_location,
            line: 2,
            end_line: 2,
          },
          context: {
            declaration_kind: "const",
            initializer_text: '"hello"',
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.declarations).toHaveLength(2);

      expect(tracking.declarations[0].name).toBe("x");
      expect(tracking.declarations[0].kind).toBe("let");
      expect(tracking.declarations[0].type_annotation).toBe("MyClass");
      expect(tracking.declarations[0].initializer).toBe("new MyClass()");

      expect(tracking.declarations[1].name).toBe("y");
      expect(tracking.declarations[1].kind).toBe("const");
      expect(tracking.declarations[1].type_annotation).toBeUndefined();
      expect(tracking.declarations[1].initializer).toBe('"hello"');
    });

    it("should handle var declarations", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "oldVar",
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: mock_location,
          context: {
            declaration_kind: "var",
            initializer_text: "100",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.declarations).toHaveLength(1);
      expect(tracking.declarations[0].name).toBe("oldVar");
      expect(tracking.declarations[0].kind).toBe("var");
    });

    it("should handle parameter declarations", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "param",
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: mock_location,
          context: {
            declaration_kind: "parameter",
            type_annotation: "string",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.declarations).toHaveLength(1);
      expect(tracking.declarations[0].name).toBe("param");
      expect(tracking.declarations[0].kind).toBe("parameter");
      expect(tracking.declarations[0].type_annotation).toBe("string");
    });
  });

  describe("LocalAssignment extraction", () => {
    it("should extract assignments without type inference", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "x",
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: mock_location,
          context: {
            source_text: "42",
            operator: "=",
          },
          modifiers: {},
        },
        {
          text: "count",
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            ...mock_location,
            line: 2,
            end_line: 2,
          },
          context: {
            source_text: "count + 1",
            operator: "+=",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.assignments).toHaveLength(2);

      expect(tracking.assignments[0].target).toBe("x");
      expect(tracking.assignments[0].source).toBe("42");
      expect(tracking.assignments[0].operator).toBe("=");
      expect(tracking.assignments[0].scope_id).toBe(mock_scope.id);

      expect(tracking.assignments[1].target).toBe("count");
      expect(tracking.assignments[1].source).toBe("count + 1");
      expect(tracking.assignments[1].operator).toBe("+=");
    });

    it("should handle different assignment operators", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "x",
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: mock_location,
          context: {
            source_text: "10",
            operator: "-=",
          },
          modifiers: {},
        },
        {
          text: "y",
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: { ...mock_location, line: 2, end_line: 2 },
          context: {
            source_text: "2",
            operator: "*=",
          },
          modifiers: {},
        },
        {
          text: "z",
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: { ...mock_location, line: 3, end_line: 3 },
          context: {
            source_text: "5",
            operator: "/=",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.assignments).toHaveLength(3);
      expect(tracking.assignments[0].operator).toBe("-=");
      expect(tracking.assignments[1].operator).toBe("*=");
      expect(tracking.assignments[2].operator).toBe("/=");
    });
  });

  describe("Complete tracking", () => {
    it("should extract all tracking info from mixed captures", () => {
      const captures: NormalizedCapture[] = [
        // Type annotation
        {
          text: "string",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: mock_location,
          context: {
            annotated_var_name: "name",
            declaration_kind: "let",
          },
          modifiers: {},
        },
        // Variable declaration
        {
          text: "name",
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: mock_location,
          context: {
            declaration_kind: "let",
            type_annotation: "string",
            initializer_text: '"John"',
          },
          modifiers: {},
        },
        // Assignment
        {
          text: "name",
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            ...mock_location,
            line: 2,
            end_line: 2,
          },
          context: {
            source_text: '"Jane"',
            operator: "=",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.annotations).toHaveLength(1);
      expect(tracking.declarations).toHaveLength(1);
      expect(tracking.assignments).toHaveLength(1);

      // Check connections between them
      expect(tracking.annotations[0].name).toBe("name");
      expect(tracking.declarations[0].name).toBe("name");
      expect(tracking.assignments[0].target).toBe("name");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty captures", () => {
      const tracking = extract_type_tracking([], mock_scopes, mock_file_path);

      expect(tracking.annotations).toHaveLength(0);
      expect(tracking.declarations).toHaveLength(0);
      expect(tracking.assignments).toHaveLength(0);
    });

    it("should skip invalid captures", () => {
      const captures: NormalizedCapture[] = [
        // Missing text
        {
          text: "",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: mock_location,
          context: {},
          modifiers: {},
        },
        // Missing context info
        {
          text: "SomeType",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: mock_location,
          context: {}, // No annotated_var_name or parameter_name
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.annotations).toHaveLength(0);
    });

    it("should handle nested scopes correctly", () => {
      const innerScope: LexicalScope = {
        id: "scope_2" as ScopeId,
        parent_id: mock_scope.id,
        name: "innerBlock" as SymbolName,
        type: "block",
        location: {
          file_path: mock_file_path,
          start_line: 3,
          start_column: 2,
          end_line: 5,
          end_column: 2,
        },
        child_ids: [],
        symbols: new Map(),
      };

      const scopesWithNested = new Map<ScopeId, LexicalScope>([
        [mock_scope.id, mock_scope],
        [innerScope.id, innerScope],
      ]);

      const captures: NormalizedCapture[] = [
        {
          text: "InnerType",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: {
            ...mock_location,
            line: 4, // Inside inner scope
          },
          context: {
            annotated_var_name: "innerVar",
            declaration_kind: "const",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        scopesWithNested,
        mock_file_path
      );

      expect(tracking.annotations).toHaveLength(1);
      expect(tracking.annotations[0].scope_id).toBe(innerScope.id); // Should find innermost scope
    });

    it("should handle multiple scopes with same variable names", () => {
      const innerScope: LexicalScope = {
        id: "scope_2" as ScopeId,
        parent_id: mock_scope.id,
        name: "innerBlock" as SymbolName,
        type: "block",
        location: {
          file_path: mock_file_path,
          start_line: 3,
          start_column: 2,
          end_line: 5,
          end_column: 2,
        },
        child_ids: [],
        symbols: new Map(),
      };

      const scopesWithNested = new Map<ScopeId, LexicalScope>([
        [mock_scope.id, mock_scope],
        [innerScope.id, innerScope],
      ]);

      const captures: NormalizedCapture[] = [
        // Outer scope variable
        {
          text: "x",
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: { ...mock_location, line: 1 },
          context: {
            declaration_kind: "let",
            initializer_text: "'outer'",
          },
          modifiers: {},
        },
        // Inner scope variable with same name
        {
          text: "x",
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: { ...mock_location, line: 4 },
          context: {
            declaration_kind: "const",
            initializer_text: "'inner'",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        scopesWithNested,
        mock_file_path
      );

      expect(tracking.declarations).toHaveLength(2);
      expect(tracking.declarations[0].scope_id).toBe(mock_scope.id);
      expect(tracking.declarations[1].scope_id).toBe(innerScope.id);
    });

    it("should handle captures with no scopes available", () => {
      const emptyScopes = new Map<ScopeId, LexicalScope>();

      const captures: NormalizedCapture[] = [
        {
          text: "orphanVar",
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: mock_location,
          context: {
            declaration_kind: "let",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        emptyScopes,
        mock_file_path
      );

      // Should handle gracefully without scope
      expect(tracking.declarations).toHaveLength(0);
    });

    it("should extract union and intersection type annotations", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "string | number",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: mock_location,
          context: {
            annotated_var_name: "unionVar",
            declaration_kind: "let",
          },
          modifiers: {},
        },
        {
          text: "Readable & Writable",
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: { ...mock_location, line: 2, end_line: 2 },
          context: {
            annotated_var_name: "intersectionVar",
            declaration_kind: "const",
          },
          modifiers: {},
        },
      ];

      const tracking = extract_type_tracking(
        captures,
        mock_scopes,
        mock_file_path
      );

      expect(tracking.annotations).toHaveLength(2);
      expect(tracking.annotations[0].annotation_text).toBe("string | number");
      expect(tracking.annotations[1].annotation_text).toBe(
        "Readable & Writable"
      );
    });
  });
});
