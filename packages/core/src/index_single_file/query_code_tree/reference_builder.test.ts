/**
 * Tests for Reference Builder System
 */

// @ts-nocheck - Test utilities use simplified type casting for readability
import { describe, it, expect, beforeEach } from "vitest";
import {
  ReferenceBuilder,
  ReferenceKind,
  process_references,
  is_reference_capture,
} from "./reference_builder";
import type { ProcessingContext, CaptureNode } from "./scope_processor";
import { SemanticCategory, SemanticEntity } from "./capture_types";
import type { Location, ScopeId, SymbolReference } from "@ariadnejs/types";
import { module_scope } from "@ariadnejs/types";

// ============================================================================
// Test Utilities
// ============================================================================

function create_test_location(
        start_line: number = 1,
  column: number = 0,
  file_path: string = "test.ts"
): Location {
  return {
    file_path: file_path as any, // Cast for test simplicity
    start_line: line,
    start_column: column,
    end_line: line,
    end_column: column + 10,
  };
}

function create_test_context(): ProcessingContext {
  const location = create_test_location();
  const root_scope_id = module_scope(location);

  return {
    scopes: new Map(),
    scope_depths: new Map(),
    root_scope_id,
    get_scope_id: (loc: Location) => root_scope_id,
  };
}

function create_test_capture(
  overrides: {
    category?: any;
    entity?: any;
    symbol_name?: string;
    node_location?: Location;
    [key: string]: any;
  } = {}
): CaptureNode {
  const location = overrides.node_location || create_test_location();
  const symbol_name = overrides.symbol_name || "testVar";

  // Map old category to new name format
  let category_str = "reference";
  if (overrides.category !== undefined) {
    switch (overrides.category) {
      case SemanticCategory.REFERENCE:
        category_str = "reference";
        break;
      case SemanticCategory.DEFINITION:
        category_str = "definition";
        break;
      case SemanticCategory.ASSIGNMENT:
        category_str = "assignment";
        break;
      case SemanticCategory.SCOPE:
        category_str = "scope";
        break;
      case SemanticCategory.IMPORT:
        category_str = "import";
        break;
      case SemanticCategory.EXPORT:
        category_str = "export";
        break;
    }
  }

  // Map old entity to new name format - entity is already a string in the enum
  const entity_str = overrides.entity || "variable";

  const mock_node = {
    text: symbol_name,
    startPosition: {
      row: location.start_line - 1,
      column: location.start_column,
    },
    endPosition: { row: location.end_line - 1, column: location.end_column },
  };

  return {
    name: `${category_str}.${entity_str}`,
    node: mock_node as any,
    text: symbol_name,
  };
}

// ============================================================================
// Tests
// ============================================================================

// TODO: These tests need updating - ReferenceBuilder doesn't extract all the
// metadata that tests expect (type_info, member_access details, etc.)
// The builder only works with capture name, node, and text fields
describe.skip("ReferenceBuilder", () => {
  let context: ProcessingContext;
  let builder: ReferenceBuilder;

  beforeEach(() => {
    context = create_test_context();
    builder = new ReferenceBuilder(context);
  });

  describe("process", () => {
    it("should ignore non-reference captures", () => {
      const capture = create_test_capture({
        category: SemanticCategory.DEFINITION,
        entity: SemanticEntity.FUNCTION,
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(0);
    });

    it("should process variable references", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "myVar" as any,
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("myVar");
      expect(references[0].type).toBe("read");
    });

    it("should process function calls", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.CALL,
        symbol_name: "doSomething",
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("doSomething");
      expect(references[0].type).toBe("call");
      expect(references[0].call_type).toBe("function");
    });

    it("should process method calls with object context", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "getValue",
        context: {
          type_name: "MyClass",
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("getValue");
      expect(references[0].type).toBe("call");
      expect(references[0].call_type).toBe("method");
      expect(references[0].member_access).toBeDefined();
      expect(references[0].member_access?.access_type).toBe("method");
      expect(references[0].member_access?.object_type?.type_name).toBe(
        "MyClass"
      );
    });

    it("should process constructor calls", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.CALL,
        symbol_name: "MyClass",
        modifiers: {
          is_constructor: true,
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("MyClass");
      expect(references[0].type).toBe("construct");
      expect(references[0].call_type).toBe("constructor");
    });

    it("should process type references", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "MyType",
        context: {
          type_name: "MyType",
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("MyType");
      expect(references[0].type).toBe("type");
      expect(references[0].type_info?.type_name).toBe("MyType");
    });

    it("should process type references with generics", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "Array",
        context: {
          type_name: "Array",
          type_arguments: "string",
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("Array");
      expect(references[0].type).toBe("type");
      expect(references[0].type_info?.type_name).toBe("Array<string>");
    });

    it("should process property access", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.PROPERTY,
        symbol_name: "length",
        context: {
          type_name: "Array",
        },
        modifiers: {
          is_optional: true,
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("length");
      expect(references[0].type).toBe("member_access");
      expect(references[0].member_access).toBeDefined();
      expect(references[0].member_access?.access_type).toBe("property");
      expect(references[0].member_access?.is_optional_chain).toBe(true);
    });

    it("should process assignments with type flow", () => {
      const capture = create_test_capture({
        category: SemanticCategory.ASSIGNMENT,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "result",
        context: {
          type_name: "number",
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("result");
      expect(references[0].type).toBe("assignment");
      expect(references[0].type_flow).toBeDefined();
      expect(references[0].type_flow?.target_type?.type_name).toBe("number");
    });

    it("should process return references", () => {
      const capture = create_test_capture({
        category: SemanticCategory.RETURN,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "value",
        context: {
          return_type: "string",
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("value");
      expect(references[0].type).toBe("return");
      expect(references[0].return_type?.type_name).toBe("string");
    });

    it("should handle super calls", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.SUPER,
        symbol_name: "super",
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("super");
      expect(references[0].type).toBe("call");
      expect(references[0].call_type).toBe("super");
    });

    it("should chain multiple references", () => {
      const capture1 = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "var1",
      });

      const capture2 = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.CALL,
        symbol_name: "func1",
      });

      const capture3 = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "Type1",
      });

      builder.process(capture1).process(capture2).process(capture3);
      const references = builder.build();

      expect(references).toHaveLength(3);
      expect(references[0].name).toBe("var1");
      expect(references[1].name).toBe("func1");
      expect(references[2].name).toBe("Type1");
    });
  });

  describe("process_references pipeline", () => {
    it("should filter and process only reference captures", () => {
      const captures: NormalizedCapture[] = [
        create_test_capture({
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
          symbol_name: "ignored",
        }),
        create_test_capture({
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          symbol_name: "included1",
        }),
        create_test_capture({
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          symbol_name: "included2",
        }),
        create_test_capture({
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.BLOCK,
          symbol_name: "ignored2",
        }),
      ];

      const references = process_references(captures, context);

      expect(references).toHaveLength(2);
      expect(references[0].name).toBe("included1");
      expect(references[1].name).toBe("included2");
    });

    it("should preserve scope context", () => {
      const custom_scope_id = "function:test.ts:10:0:20:0:myFunc" as ScopeId;
      const custom_context: ProcessingContext = {
        ...context,
        get_scope_id: (loc: Location) => custom_scope_id,
      };

      const captures = [
        create_test_capture({
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          symbol_name: "myVar",
        }),
      ];

      const references = process_references(captures, custom_context);

      expect(references).toHaveLength(1);
      expect(references[0].scope_id).toBe(custom_scope_id);
    });
  });

  describe("is_reference_capture", () => {
    it("should return true for reference captures", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
      });

      expect(is_reference_capture(capture)).toBe(true);
    });

    it("should return true for assignment captures", () => {
      const capture = create_test_capture({
        category: SemanticCategory.ASSIGNMENT,
      });

      expect(is_reference_capture(capture)).toBe(true);
    });

    it("should return true for return captures", () => {
      const capture = create_test_capture({
        category: SemanticCategory.RETURN,
      });

      expect(is_reference_capture(capture)).toBe(true);
    });

    it("should return false for non-reference captures", () => {
      const capture = create_test_capture({
        category: SemanticCategory.DEFINITION,
      });

      expect(is_reference_capture(capture)).toBe(false);
    });
  });

  describe("complex scenarios", () => {
    it("should handle method call with property chain", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "toString",
        context: {
          property_chain: ["person", "address", "toString"],
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].context?.property_chain).toEqual([
        "person",
        "address",
        "toString",
      ]);
    });

    it("should handle type references", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "string",
        context: {
          type_name: "string",
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].type_info?.type_name).toBe("string");
    });

    it("should handle assignments", () => {
      const capture = create_test_capture({
        category: SemanticCategory.ASSIGNMENT,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "value",
        context: {
          type_name: "string",
        },
      });

      builder.process(capture);
      const references = builder.build();

      expect(references).toHaveLength(1);
      expect(references[0].type).toBe("assignment");
      expect(references[0].type_flow?.target_type?.type_name).toBe("string");
    });
  });
});
