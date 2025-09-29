/**
 * Tests for DefinitionBuilder
 */

import { describe, it, expect } from "vitest";
import { DefinitionBuilder } from "./definition_builder";
import type { ProcessingContext } from "../parse_and_query_code/scope_processor";
import type { NormalizedCapture } from "../parse_and_query_code/capture_types";
import { SemanticCategory, SemanticEntity } from "../parse_and_query_code/capture_types";
import type { Location, ScopeId, SymbolName } from "@ariadnejs/types";

// Test helpers
function create_test_location(line: number = 1): Location {
  return {
    file_path: "test.ts" as any,
    line,
    column: 0,
    end_line: line + 5,
    end_column: 10,
  };
}

function create_test_context(): ProcessingContext {
  const test_scope_id = "module:test.ts:1:0:100:0:<module>" as ScopeId;

  return {
    scopes: new Map(),
    scope_depths: new Map(),
    root_scope_id: test_scope_id,
    get_scope_id: (location: Location) => test_scope_id,
  };
}

function create_test_capture(
  entity: SemanticEntity,
  name: string = "testSymbol",
  location: Location = create_test_location()
): NormalizedCapture {
  return {
    category: SemanticCategory.DEFINITION,
    entity,
    node_location: location,
    symbol_name: name as SymbolName,
    modifiers: {},
    context: {},
  };
}

describe("DefinitionBuilder", () => {
  it("should create empty definitions array when no captures processed", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);
    const definitions = builder.build();

    expect(definitions).toEqual([]);
  });

  it("should process class definitions", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_capture = create_test_capture(SemanticEntity.CLASS, "MyClass");
    builder.process(class_capture);

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const class_def = definitions[0];
    expect(class_def.kind).toBe("class");
    expect(class_def.name).toBe("MyClass");
    expect(class_def.scope_id).toBeDefined();
  });

  it("should process function definitions", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const func_capture = create_test_capture(SemanticEntity.FUNCTION, "myFunction");
    builder.process(func_capture);

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const func_def = definitions[0];
    expect(func_def.kind).toBe("function");
    expect(func_def.name).toBe("myFunction");
    expect(func_def.scope_id).toBeDefined();
  });

  it("should process interface definitions", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const interface_capture = create_test_capture(SemanticEntity.INTERFACE, "IMyInterface");
    builder.process(interface_capture);

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const interface_def = definitions[0];
    expect(interface_def.kind).toBe("interface");
    expect(interface_def.name).toBe("IMyInterface");
    expect(interface_def.scope_id).toBeDefined();
  });

  it("should process enum definitions", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const enum_capture = create_test_capture(SemanticEntity.ENUM, "MyEnum");
    builder.process(enum_capture);

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const enum_def = definitions[0];
    expect(enum_def.kind).toBe("enum");
    expect(enum_def.name).toBe("MyEnum");
    expect(enum_def.scope_id).toBeDefined();
  });

  it("should process variable definitions", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const var_capture = create_test_capture(SemanticEntity.VARIABLE, "myVar");
    builder.process(var_capture);

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const var_def = definitions[0];
    expect(var_def.kind).toBe("variable");
    expect(var_def.name).toBe("myVar");
    expect(var_def.scope_id).toBeDefined();
  });

  it("should process constant definitions", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const const_capture = create_test_capture(SemanticEntity.CONSTANT, "MY_CONST");
    builder.process(const_capture);

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const const_def = definitions[0];
    expect(const_def.kind).toBe("constant");
    expect(const_def.name).toBe("MY_CONST");
    expect(const_def.scope_id).toBeDefined();
  });

  it("should support functional chaining", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const result = builder
      .process(create_test_capture(SemanticEntity.CLASS, "Class1"))
      .process(create_test_capture(SemanticEntity.FUNCTION, "func1"))
      .process(create_test_capture(SemanticEntity.VARIABLE, "var1"));

    expect(result).toBe(builder); // Should return same instance

    const definitions = builder.build();
    expect(definitions).toHaveLength(3);
  });

  it("should handle nested structures like methods in classes", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    // Add a class
    const class_location = create_test_location(10);
    builder.process(create_test_capture(SemanticEntity.CLASS, "MyClass", class_location));

    // Add a method inside the class
    const method_location = {
      ...class_location,
      line: 12,
      end_line: 14,
    };
    builder.process(create_test_capture(SemanticEntity.METHOD, "myMethod", method_location));

    const definitions = builder.build();
    expect(definitions).toHaveLength(1); // Only the class is a top-level definition

    const class_def = definitions[0];
    expect(class_def.kind).toBe("class");

    // Type guard for ClassDefinition
    if (class_def.kind === "class") {
      const classDef = class_def as import("@ariadnejs/types").ClassDefinition;
      expect(classDef.methods).toHaveLength(1);
      expect(classDef.methods[0].name).toBe("myMethod");
    }
  });

  it("should ensure non-null arrays", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    builder.process(create_test_capture(SemanticEntity.CLASS, "EmptyClass"));

    const definitions = builder.build();
    const class_def = definitions[0];

    expect(class_def.kind).toBe("class");

    // Type guard for ClassDefinition
    if (class_def.kind === "class") {
      const classDef = class_def as import("@ariadnejs/types").ClassDefinition;
      expect(classDef.methods).toEqual([]); // Non-null empty array
      expect(classDef.properties).toEqual([]); // Non-null empty array
      expect(classDef.decorators).toEqual([]); // Non-null empty array
      expect(classDef.extends).toEqual([]); // Non-null empty array
    }
  });

  it("should ignore non-definition captures", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const reference_capture: NormalizedCapture = {
      category: SemanticCategory.REFERENCE, // Not a definition
      entity: SemanticEntity.CALL,
      node_location: create_test_location(),
      symbol_name: "someCall" as SymbolName,
      modifiers: {},
      context: {},
    };

    builder.process(reference_capture);

    const definitions = builder.build();
    expect(definitions).toEqual([]);
  });

  it("should handle multiple definitions of different types", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    // Process various definition types
    builder
      .process(create_test_capture(SemanticEntity.CLASS, "MyClass"))
      .process(create_test_capture(SemanticEntity.INTERFACE, "IMyInterface"))
      .process(create_test_capture(SemanticEntity.ENUM, "MyEnum"))
      .process(create_test_capture(SemanticEntity.FUNCTION, "myFunction"))
      .process(create_test_capture(SemanticEntity.VARIABLE, "myVar"))
      .process(create_test_capture(SemanticEntity.CONSTANT, "MY_CONST"))
      .process(create_test_capture(SemanticEntity.TYPE, "MyType"))
      .process(create_test_capture(SemanticEntity.NAMESPACE, "MyNamespace"));

    const definitions = builder.build();
    expect(definitions).toHaveLength(8);

    // Verify each definition type
    const kinds = definitions.map(d => d.kind).sort();
    expect(kinds).toEqual([
      "class",
      "constant",
      "enum",
      "function",
      "interface",
      "namespace",
      "type",
      "variable",
    ]);
  });
});