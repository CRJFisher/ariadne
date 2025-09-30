/**
 * Comprehensive tests for DefinitionBuilder
 * Testing functional composition, non-null guarantees, natural ordering, and performance
 */

import { describe, it, expect } from "vitest";
import { DefinitionBuilder, process_captures } from "./definition_builder";
import type { ProcessingContext, RawCapture } from "../parse_and_query_code/scope_processor";
import type {
  Location,
  ScopeId,
  SymbolName,
  SymbolId,
  ClassDefinition,
  FunctionDefinition,
  MethodDefinition,
  PropertyDefinition,
  InterfaceDefinition,
  EnumDefinition,
  NamespaceDefinition,
  AnyDefinition
} from "@ariadnejs/types";

// ============================================================================
// Test Helpers
// ============================================================================

function create_test_location(line: number = 1, column: number = 0): Location {
  return {
    file_path: "test.ts" as any,
    line,
    column,
    end_line: line + 5,
    end_column: column + 10,
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
  entity: string,
  name: string = "testSymbol",
  location: Location = create_test_location()
): RawCapture {
  const mock_node = {
    text: name,
    startPosition: { row: location.line - 1, column: location.column },
    endPosition: { row: location.end_line - 1, column: location.end_column },
  };

  return {
    name: `definition.${entity}`,
    node: mock_node as any,
    text: name,
  };
}

function create_decorator_capture(
  name: string = "decorator",
  location: Location = create_test_location()
): RawCapture {
  const mock_node = {
    text: name,
    startPosition: { row: location.line - 1, column: location.column },
    endPosition: { row: location.end_line - 1, column: location.end_column },
  };

  return {
    name: `decorator.class`,
    node: mock_node as any,
    text: name,
  };
}

// ============================================================================
// Functional Composition Tests
// ============================================================================

describe("DefinitionBuilder - Functional Composition", () => {
  it("should chain process calls fluently", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    // Create class and method captures
    const class_loc = create_test_location(1, 0);
    const method_loc = create_test_location(2, 2);
    const property_loc = create_test_location(3, 2);

    const result = builder
      .process(create_test_capture("class", "TestClass", class_loc))
      .process(create_test_capture("method", "testMethod", method_loc))
      .process(create_test_capture("property", "testProp", property_loc));

    // Should return the same instance for chaining
    expect(result).toBe(builder);

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);
    expect(definitions[0].kind).toBe("class");

    const class_def = definitions[0] as ClassDefinition;
    expect(class_def.methods).toHaveLength(1);
    expect(class_def.properties).toHaveLength(1);
  });

  it("should compose multiple builders through reduce", () => {
    const context = create_test_context();
    const captures: RawCapture[] = [
      create_test_capture("class", "Class1", create_test_location(1)),
      create_test_capture("class", "Class2", create_test_location(10)),
      create_test_capture("function", "func1", create_test_location(20)),
      create_test_capture("interface", "IFace1", create_test_location(30)),
    ];

    const definitions = captures.reduce(
      (builder, capture) => builder.process(capture),
      new DefinitionBuilder(context)
    ).build();

    expect(definitions).toHaveLength(4);
    const kinds = definitions.map(d => d.kind).sort();
    expect(kinds).toEqual(["class", "class", "function", "interface"]);
  });

  it("should support functional pipeline with process_captures", () => {
    const context = create_test_context();
    const captures: RawCapture[] = [
      create_test_capture("class", "PipelineClass"),
      create_test_capture("function", "pipelineFunc"),
      create_test_capture("enum", "PipelineEnum"),
    ];

    const definitions = process_captures(captures, context);

    expect(definitions).toHaveLength(3);
    expect(definitions.find(d => d.name === "PipelineClass")).toBeDefined();
    expect(definitions.find(d => d.name === "pipelineFunc")).toBeDefined();
    expect(definitions.find(d => d.name === "PipelineEnum")).toBeDefined();
  });
});

// ============================================================================
// Non-null Guarantees Tests
// ============================================================================

describe("DefinitionBuilder - Non-null Guarantees", () => {
  it("should always return non-null arrays for empty builder", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);
    const definitions = builder.build();

    expect(definitions).toEqual([]);
    expect(definitions).not.toBeNull();
    expect(definitions).not.toBeUndefined();
  });

  it("should ensure all array fields are non-null in classes", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    builder.process(create_test_capture("class", "EmptyClass"));

    const definitions = builder.build();
    const class_def = definitions[0] as ClassDefinition;

    // All array fields must be non-null
    expect(class_def.methods).toEqual([]);
    expect(class_def.methods).not.toBeNull();
    expect(class_def.methods).not.toBeUndefined();

    expect(class_def.properties).toEqual([]);
    expect(class_def.properties).not.toBeNull();
    expect(class_def.properties).not.toBeUndefined();

    expect(class_def.decorators).toEqual([]);
    expect(class_def.decorators).not.toBeNull();
    expect(class_def.decorators).not.toBeUndefined();

    expect(class_def.extends).toEqual([]);
    expect(class_def.extends).not.toBeNull();
    expect(class_def.extends).not.toBeUndefined();
  });

  it("should ensure all array fields are non-null in functions", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    builder.process(create_test_capture("function", "emptyFunc"));

    const definitions = builder.build();
    const func_def = definitions[0] as FunctionDefinition;

    expect(func_def.signature.parameters).toEqual([]);
    expect(func_def.signature.parameters).not.toBeNull();
    expect(func_def.signature.parameters).not.toBeUndefined();
  });

  it("should ensure all array fields are non-null in interfaces", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    builder.process(create_test_capture("interface", "EmptyInterface"));

    const definitions = builder.build();
    const interface_def = definitions[0] as InterfaceDefinition;

    expect(interface_def.methods).toEqual([]);
    expect(interface_def.methods).not.toBeNull();
    expect(interface_def.methods).not.toBeUndefined();

    expect(interface_def.properties).toEqual([]);
    expect(interface_def.properties).not.toBeNull();
    expect(interface_def.properties).not.toBeUndefined();

    expect(interface_def.extends).toEqual([]);
    expect(interface_def.extends).not.toBeNull();
    expect(interface_def.extends).not.toBeUndefined();
  });

  it("should ensure all array fields are non-null in enums", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    builder.process(create_test_capture("enum", "EmptyEnum"));

    const definitions = builder.build();
    const enum_def = definitions[0] as EnumDefinition;

    expect(enum_def.members).toEqual([]);
    expect(enum_def.members).not.toBeNull();
    expect(enum_def.members).not.toBeUndefined();
  });
});

// ============================================================================
// Natural Ordering Tests
// ============================================================================

describe("DefinitionBuilder - Natural Ordering", () => {
  it("should handle method capture before class capture", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_loc = create_test_location(1, 0);
    const method_loc = create_test_location(2, 2);

    // Add method BEFORE class
    builder
      .process(create_test_capture("method", "myMethod", method_loc))
      .process(create_test_capture("class", "MyClass", class_loc));

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const class_def = definitions[0] as ClassDefinition;
    expect(class_def.kind).toBe("class");
    expect(class_def.name).toBe("MyClass");
    expect(class_def.methods).toHaveLength(1);
    expect(class_def.methods[0].name).toBe("myMethod");
  });

  it("should handle parameter capture before function capture", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const func_loc = create_test_location(1, 0);
    const param_loc = create_test_location(1, 20);

    // Add parameter BEFORE function
    builder
      .process(create_test_capture("parameter", "param1", param_loc))
      .process(create_test_capture("function", "myFunc", func_loc));

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const func_def = definitions[0] as FunctionDefinition;
    expect(func_def.kind).toBe("function");
    expect(func_def.name).toBe("myFunc");
    expect(func_def.signature.parameters).toHaveLength(1);
    expect(func_def.signature.parameters[0].name).toBe("param1");
  });

  it("should handle property capture before class capture", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_loc = create_test_location(1, 0);
    const prop_loc = create_test_location(2, 2);

    // Add property BEFORE class
    builder
      .process(create_test_capture("property", "myProp", prop_loc))
      .process(create_test_capture("class", "MyClass", class_loc));

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const class_def = definitions[0] as ClassDefinition;
    expect(class_def.kind).toBe("class");
    expect(class_def.properties).toHaveLength(1);
    expect(class_def.properties[0].name).toBe("myProp");
  });

  it("should handle captures in completely reversed order", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_loc = create_test_location(1, 0);
    const method_loc = create_test_location(3, 2);
    const param1_loc = create_test_location(3, 15);
    const param2_loc = create_test_location(3, 25);
    const prop_loc = create_test_location(2, 2);

    // Add everything in reverse order
    builder
      .process(create_test_capture("parameter", "param2", param2_loc))
      .process(create_test_capture("parameter", "param1", param1_loc))
      .process(create_test_capture("method", "myMethod", method_loc))
      .process(create_test_capture("property", "myProp", prop_loc))
      .process(create_test_capture("class", "MyClass", class_loc));

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const class_def = definitions[0] as ClassDefinition;
    expect(class_def.kind).toBe("class");
    expect(class_def.methods).toHaveLength(1);
    expect(class_def.properties).toHaveLength(1);
    expect(class_def.methods[0].parameters).toHaveLength(2);
  });
});

// ============================================================================
// Builder State Management Tests
// ============================================================================

describe("DefinitionBuilder - State Management", () => {
  it("should maintain separate state for multiple classes", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class1_loc = create_test_location(1, 0);
    const class2_loc = create_test_location(10, 0);
    const method1_loc = create_test_location(2, 2);
    const method2_loc = create_test_location(11, 2);

    builder
      .process(create_test_capture("class", "Class1", class1_loc))
      .process(create_test_capture("class", "Class2", class2_loc))
      .process(create_test_capture("method", "method1", method1_loc))
      .process(create_test_capture("method", "method2", method2_loc));

    const definitions = builder.build();
    expect(definitions).toHaveLength(2);

    const class1 = definitions.find(d => d.name === "Class1") as ClassDefinition;
    const class2 = definitions.find(d => d.name === "Class2") as ClassDefinition;

    expect(class1.methods).toHaveLength(1);
    expect(class1.methods[0].name).toBe("method1");

    expect(class2.methods).toHaveLength(1);
    expect(class2.methods[0].name).toBe("method2");
  });

  it("should handle duplicate captures by updating, not duplicating", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const loc = create_test_location(1, 0);

    // Process same class twice
    builder
      .process(create_test_capture("class", "MyClass", loc))
      .process(create_test_capture("class", "MyClass", loc));

    const definitions = builder.build();
    // Should only have one class, not two
    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe("MyClass");
  });

  it("should maintain builder state integrity across multiple build calls", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    builder.process(create_test_capture("class", "TestClass"));

    const first_build = builder.build();
    expect(first_build).toHaveLength(1);

    // Add more after first build
    builder.process(create_test_capture("function", "testFunc"));

    const second_build = builder.build();
    expect(second_build).toHaveLength(2);

    // Both definitions should be present
    expect(second_build.find(d => d.name === "TestClass")).toBeDefined();
    expect(second_build.find(d => d.name === "testFunc")).toBeDefined();
  });
});

// ============================================================================
// Complex Assembly Tests
// ============================================================================

describe("DefinitionBuilder - Complex Assembly", () => {
  it("should assemble class with multiple methods and properties", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_loc = create_test_location(1, 0);

    builder.add_class({
      symbol_id: "class:test.ts:1:0:20:0:ComplexClass" as SymbolId,
      name: "ComplexClass" as SymbolName,
      location: class_loc,
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
      extends: ["BaseClass" as SymbolName],
      abstract: false,
    });

    const class_id = "class:test.ts:1:0:20:0:ComplexClass" as SymbolId;

    // Add multiple methods
    builder.add_method_to_class(class_id, {
      symbol_id: "method:test.ts:3:2:5:3:method1" as SymbolId,
      name: "method1" as SymbolName,
      location: create_test_location(3, 2),
      scope_id: context.root_scope_id,
      availability: { scope: "public" },
      return_type: "string" as SymbolName,
      access_modifier: "public",
      async: true,
    });

    builder.add_method_to_class(class_id, {
      symbol_id: "method:test.ts:7:2:9:3:method2" as SymbolId,
      name: "method2" as SymbolName,
      location: create_test_location(7, 2),
      scope_id: context.root_scope_id,
      availability: { scope: "public" },
      return_type: "number" as SymbolName,
      access_modifier: "private",
      static: true,
    });

    // Add multiple properties
    builder.add_property_to_class(class_id, {
      symbol_id: "property:test.ts:2:2:2:15:prop1" as SymbolId,
      name: "prop1" as SymbolName,
      location: create_test_location(2, 2),
      scope_id: context.root_scope_id,
      availability: { scope: "public" },
      type: "string" as SymbolName,
      access_modifier: "public",
      readonly: true,
    });

    builder.add_property_to_class(class_id, {
      symbol_id: "property:test.ts:10:2:10:20:prop2" as SymbolId,
      name: "prop2" as SymbolName,
      location: create_test_location(10, 2),
      scope_id: context.root_scope_id,
      availability: { scope: "file-private" },
      type: "boolean" as SymbolName,
      access_modifier: "private",
      static: true,
    });

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const class_def = definitions[0] as ClassDefinition;
    expect(class_def.methods).toHaveLength(2);
    expect(class_def.properties).toHaveLength(2);
    expect(class_def.extends).toEqual(["BaseClass"]);

    const method1 = class_def.methods.find(m => m.name === "method1");
    expect(method1?.return_type).toBe("string");

    const method2 = class_def.methods.find(m => m.name === "method2");
    expect(method2?.return_type).toBe("number");
  });

  it("should assemble class with inheritance chain", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    builder.add_class({
      symbol_id: "class:test.ts:1:0:10:0:ChildClass" as SymbolId,
      name: "ChildClass" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
      extends: ["ParentClass" as SymbolName],
    });

    const definitions = builder.build();
    const class_def = definitions[0] as ClassDefinition;

    expect(class_def.extends).toEqual(["ParentClass"]);
  });

  it("should assemble function with multiple parameters", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const func_id = "function:test.ts:1:0:5:0:complexFunc" as SymbolId;

    builder.add_function({
      symbol_id: func_id,
      name: "complexFunc" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
    });

    // Add multiple parameters
    builder.add_parameter_to_callable(func_id, {
      symbol_id: "param:test.ts:1:15:1:20:param1" as SymbolId,
      name: "param1" as SymbolName,
      location: create_test_location(1, 15),
      scope_id: context.root_scope_id,
      type: "string" as SymbolName,
      optional: false,
    });

    builder.add_parameter_to_callable(func_id, {
      symbol_id: "param:test.ts:1:22:1:30:param2" as SymbolId,
      name: "param2" as SymbolName,
      location: create_test_location(1, 22),
      scope_id: context.root_scope_id,
      type: "number" as SymbolName,
      optional: true,
      default_value: "42",
    });

    builder.add_parameter_to_callable(func_id, {
      symbol_id: "param:test.ts:1:32:1:40:param3" as SymbolId,
      name: "param3" as SymbolName,
      location: create_test_location(1, 32),
      scope_id: context.root_scope_id,
      type: "boolean" as SymbolName,
      default_value: "false",
    });

    const definitions = builder.build();
    const func_def = definitions[0] as FunctionDefinition;

    expect(func_def.signature.parameters).toHaveLength(3);

    const param1 = func_def.signature.parameters[0];
    expect(param1.name).toBe("param1");
    expect(param1.type).toBe("string");

    const param2 = func_def.signature.parameters[1];
    expect(param2.name).toBe("param2");
    expect(param2.default_value).toBe("42");
  });

  it("should assemble method with decorators", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_id = "class:test.ts:1:0:10:0:DecoratedClass" as SymbolId;
    const method_id = "method:test.ts:3:2:5:3:decoratedMethod" as SymbolId;

    builder.add_class({
      symbol_id: class_id,
      name: "DecoratedClass" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
    });

    builder.add_method_to_class(class_id, {
      symbol_id: method_id,
      name: "decoratedMethod" as SymbolName,
      location: create_test_location(3, 2),
      scope_id: context.root_scope_id,
      availability: { scope: "public" },
    });

    // Add decorators to method
    builder.add_decorator_to_target(method_id, {
      name: "Override" as SymbolName,
      location: create_test_location(2, 2),
      arguments: [],
    });

    builder.add_decorator_to_target(method_id, {
      name: "Deprecated" as SymbolName,
      location: create_test_location(2, 12),
      arguments: ["Use newMethod instead"],
    });

    const definitions = builder.build();
    const class_def = definitions[0] as ClassDefinition;
    const method = class_def.methods[0];

    expect(method.decorators).toHaveLength(2);
    expect(method.decorators).toContain("Override");
    expect(method.decorators).toContain("Deprecated");
  });

  it("should assemble interface with method signatures and properties", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const interface_id = "interface:test.ts:1:0:10:0:IComplex" as SymbolId;

    builder.add_interface({
      symbol_id: interface_id,
      name: "IComplex" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
      extends: ["IBase" as SymbolName],
    });

    // Add method signatures
    builder.add_method_signature_to_interface(interface_id, {
      symbol_id: "method:test.ts:2:2:2:20:method1" as SymbolId,
      name: "method1" as SymbolName,
      location: create_test_location(2, 2),
      scope_id: context.root_scope_id,
      return_type: "void" as SymbolName,
      optional: false,
    });

    // Add property signatures
    builder.add_property_signature_to_interface(interface_id, {
      symbol_id: "property:test.ts:3:2:3:15:prop1" as SymbolId,
      name: "prop1" as SymbolName,
      location: create_test_location(3, 2),
      type: "string" as SymbolName,
      optional: true,
      readonly: true,
    });

    const definitions = builder.build();
    const interface_def = definitions[0] as InterfaceDefinition;

    expect(interface_def.extends).toEqual(["IBase"]);
    expect(interface_def.methods).toHaveLength(1);
    expect(interface_def.properties).toHaveLength(1);
  });

  it("should assemble enum with members", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const enum_id = "enum:test.ts:1:0:5:0:Status" as SymbolId;

    builder.add_enum({
      symbol_id: enum_id,
      name: "Status" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
      is_const: true,
    });

    // Add enum members
    builder.add_enum_member(enum_id, {
      symbol_id: "enum:test.ts:2:2:2:10:Active" as SymbolId,
      name: "Active" as SymbolName,
      location: create_test_location(2, 2),
      value: 1,
    });

    builder.add_enum_member(enum_id, {
      symbol_id: "enum:test.ts:3:2:3:12:Inactive" as SymbolId,
      name: "Inactive" as SymbolName,
      location: create_test_location(3, 2),
      value: 2,
    });

    builder.add_enum_member(enum_id, {
      symbol_id: "enum:test.ts:4:2:4:11:Pending" as SymbolId,
      name: "Pending" as SymbolName,
      location: create_test_location(4, 2),
      value: 3,
    });

    const definitions = builder.build();
    const enum_def = definitions[0] as EnumDefinition;

    expect(enum_def.is_const).toBe(true);
    expect(enum_def.members).toHaveLength(3);
    expect(enum_def.members[0].value).toBe(1);
    expect(enum_def.members[1].value).toBe(2);
    expect(enum_def.members[2].value).toBe(3);
  });

  it("should assemble namespace with exported symbols", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const namespace_id = "namespace:test.ts:1:0:10:0:MyNamespace" as SymbolId;

    builder.add_namespace({
      symbol_id: namespace_id,
      name: "MyNamespace" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
    });

    const definitions = builder.build();
    const namespace_def = definitions[0] as NamespaceDefinition;

    expect(namespace_def.kind).toBe("namespace");
    expect(namespace_def.name).toBe("MyNamespace");
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("DefinitionBuilder - Edge Cases", () => {
  it("should handle empty class with no members", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    builder.process(create_test_capture("class", "EmptyClass"));

    const definitions = builder.build();
    const class_def = definitions[0] as ClassDefinition;

    expect(class_def.methods).toEqual([]);
    expect(class_def.properties).toEqual([]);
    expect(class_def.constructor).toBeUndefined();
  });

  it("should ignore non-definition captures", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const reference_capture: RawCapture = {
      name: "reference.call",
      node: {} as any,
      text: "someCall",
    };

    const scope_capture: RawCapture = {
      name: "scope.block",
      node: {} as any,
      text: "",
    };

    builder
      .process(reference_capture)
      .process(scope_capture)
      .process(create_test_capture("class", "ValidClass"));

    const definitions = builder.build();
    // Should only have the class, not the references or scopes
    expect(definitions).toHaveLength(1);
    expect(definitions[0].kind).toBe("class");
  });

  it("should handle deeply nested structures", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_loc = create_test_location(1, 0);
    const method_loc = create_test_location(3, 2);
    const param_loc = create_test_location(3, 15);

    // Create nested structure
    builder
      .process(create_test_capture("class", "NestedClass", class_loc))
      .process(create_test_capture("method", "nestedMethod", method_loc))
      .process(create_test_capture("parameter", "nestedParam", param_loc));

    const definitions = builder.build();
    const class_def = definitions[0] as ClassDefinition;

    expect(class_def.methods).toHaveLength(1);
    expect(class_def.methods[0].parameters).toHaveLength(1);
    expect(class_def.methods[0].parameters[0].name).toBe("nestedParam");
  });

  it("should handle captures with missing or invalid data gracefully", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const invalid_capture: RawCapture = {
      name: "definition.unknown_type",
      node: {
        text: "",
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
      } as any,
      text: "",
    };

    builder.process(invalid_capture);

    const definitions = builder.build();
    // Should handle gracefully and return empty
    expect(definitions).toEqual([]);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe("DefinitionBuilder - Performance", () => {
  it("should handle 1000 captures in less than 100ms", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    // Generate 1000 captures
    const captures: RawCapture[] = [];
    for (let i = 0; i < 100; i++) {
      // 100 classes
      captures.push(create_test_capture("class", `Class${i}`, create_test_location(i * 10)));

      // 5 methods per class
      for (let j = 0; j < 5; j++) {
        captures.push(create_test_capture("method", `method${j}`, create_test_location(i * 10 + j + 1, 2)));
      }

      // 4 properties per class
      for (let k = 0; k < 4; k++) {
        captures.push(create_test_capture("property", `prop${k}`, create_test_location(i * 10 + k + 6, 2)));
      }
    }

    const start = Date.now();

    // Process all captures
    for (const capture of captures) {
      builder.process(capture);
    }

    const definitions = builder.build();
    const end = Date.now();

    const duration = end - start;
    expect(duration).toBeLessThan(100);

    // Verify correctness
    expect(definitions).toHaveLength(100); // 100 classes
  });

  it("should efficiently handle large batches using reduce", () => {
    const context = create_test_context();

    // Generate 500 mixed captures
    const captures: RawCapture[] = [];
    for (let i = 0; i < 100; i++) {
      captures.push(create_test_capture("class", `Class${i}`));
      captures.push(create_test_capture("function", `func${i}`));
      captures.push(create_test_capture("interface", `IFace${i}`));
      captures.push(create_test_capture("enum", `Enum${i}`));
      captures.push(create_test_capture("variable", `var${i}`));
    }

    const start = Date.now();

    const definitions = captures.reduce(
      (builder, capture) => builder.process(capture),
      new DefinitionBuilder(context)
    ).build();

    const end = Date.now();
    const duration = end - start;

    expect(duration).toBeLessThan(100);
    expect(definitions).toHaveLength(500);
  });

  it("should efficiently process captures using process_captures pipeline", () => {
    const context = create_test_context();

    // Generate 1000 captures
    const captures: RawCapture[] = [];
    for (let i = 0; i < 200; i++) {
      captures.push(create_test_capture("class", `Class${i}`));
      captures.push(create_test_capture("function", `func${i}`));
      captures.push(create_test_capture("interface", `IFace${i}`));
      captures.push(create_test_capture("variable", `var${i}`));
      captures.push(create_test_capture("enum", `Enum${i}`));
    }

    const start = Date.now();
    const definitions = process_captures(captures, context);
    const end = Date.now();

    const duration = end - start;
    expect(duration).toBeLessThan(100);
    expect(definitions).toHaveLength(1000);
  });
});

// ============================================================================
// Public API Tests
// ============================================================================

describe("DefinitionBuilder - Public API", () => {
  it("should support all definition types through public API", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    // Test all public methods
    const class_id = "class:test:1:0:10:0:TestClass" as SymbolId;
    const func_id = "function:test:20:0:25:0:testFunc" as SymbolId;
    const interface_id = "interface:test:30:0:35:0:ITest" as SymbolId;
    const enum_id = "enum:test:40:0:45:0:TestEnum" as SymbolId;
    const namespace_id = "namespace:test:50:0:55:0:TestNS" as SymbolId;

    builder
      .add_class({
        symbol_id: class_id,
        name: "TestClass" as SymbolName,
        location: create_test_location(1),
        scope_id: context.root_scope_id,
        availability: { scope: "file-export" },
      })
      .add_function({
        symbol_id: func_id,
        name: "testFunc" as SymbolName,
        location: create_test_location(20),
        scope_id: context.root_scope_id,
        availability: { scope: "file-export" },
      })
      .add_interface({
        symbol_id: interface_id,
        name: "ITest" as SymbolName,
        location: create_test_location(30),
        scope_id: context.root_scope_id,
        availability: { scope: "file-export" },
      })
      .add_enum({
        symbol_id: enum_id,
        name: "TestEnum" as SymbolName,
        location: create_test_location(40),
        scope_id: context.root_scope_id,
        availability: { scope: "file-export" },
      })
      .add_namespace({
        symbol_id: namespace_id,
        name: "TestNS" as SymbolName,
        location: create_test_location(50),
        scope_id: context.root_scope_id,
        availability: { scope: "file-export" },
      })
      .add_variable({
        kind: "variable",
        symbol_id: "variable:test:60:0:60:10:testVar" as SymbolId,
        name: "testVar" as SymbolName,
        location: create_test_location(60),
        scope_id: context.root_scope_id,
        availability: { scope: "file-private" },
      })
      .add_import({
        symbol_id: "import:test:70:0:70:20:React" as SymbolId,
        name: "React" as SymbolName,
        location: create_test_location(70),
        scope_id: context.root_scope_id,
        availability: { scope: "file-private" },
        import_path: "react" as any,
        is_default: true,
      })
      .add_type({
        kind: "type_alias",
        symbol_id: "type:test:80:0:80:15:TestType" as SymbolId,
        name: "TestType" as SymbolName,
        location: create_test_location(80),
        scope_id: context.root_scope_id,
        availability: { scope: "file-export" },
      });

    const definitions = builder.build();
    expect(definitions).toHaveLength(8);

    const kinds = definitions.map(d => d.kind).sort();
    expect(kinds).toEqual([
      "class",
      "enum",
      "function",
      "import",
      "interface",
      "namespace",
      "type_alias",
      "variable",
    ]);
  });

  it("should properly chain all builder methods", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_id = "class:test:1:0:10:0:Chain" as SymbolId;
    const method_id = "method:test:2:2:4:3:chainMethod" as SymbolId;

    const result = builder
      .add_class({
        symbol_id: class_id,
        name: "Chain" as SymbolName,
        location: create_test_location(1),
        scope_id: context.root_scope_id,
        availability: { scope: "file-export" },
      })
      .add_method_to_class(class_id, {
        symbol_id: method_id,
        name: "chainMethod" as SymbolName,
        location: create_test_location(2, 2),
        scope_id: context.root_scope_id,
        availability: { scope: "public" },
      })
      .add_property_to_class(class_id, {
        symbol_id: "property:test:5:2:5:15:chainProp" as SymbolId,
        name: "chainProp" as SymbolName,
        location: create_test_location(5, 2),
        scope_id: context.root_scope_id,
        availability: { scope: "public" },
      })
      .add_parameter_to_callable(method_id, {
        symbol_id: "param:test:2:15:2:20:arg1" as SymbolId,
        name: "arg1" as SymbolName,
        location: create_test_location(2, 15),
        scope_id: context.root_scope_id,
        type: "string" as SymbolName,
      })
      .add_decorator_to_target(class_id, {
        name: "Entity" as SymbolName,
        location: create_test_location(0, 0),
      });

    // All methods should return the builder for chaining
    expect(result).toBe(builder);

    const definitions = builder.build();
    expect(definitions).toHaveLength(1);

    const class_def = definitions[0] as ClassDefinition;
    expect(class_def.methods).toHaveLength(1);
    expect(class_def.properties).toHaveLength(1);
    expect(class_def.decorators).toHaveLength(1);
    expect(class_def.methods[0].parameters).toHaveLength(1);
  });
});