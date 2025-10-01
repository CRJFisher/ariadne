/**
 * Comprehensive tests for DefinitionBuilder
 * Testing functional composition, non-null guarantees, natural ordering, and performance
 */

import { describe, it, expect } from "vitest";
import { DefinitionBuilder } from "./definition_builder";
import type {
  ProcessingContext,
  CaptureNode,
  SemanticEntity,
  SemanticCategory,
} from "../scopes/scope_processor";
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
  AnyDefinition,
} from "@ariadnejs/types";

// ============================================================================
// Test Helpers
// ============================================================================

function create_test_location(line: number = 1, column: number = 0): Location {
  return {
    file_path: "test.ts" as any,
    start_line: line,
    start_column: column,
    end_line: line + 5,
    end_column: column + 10,
  };
}

function create_test_context(): ProcessingContext {
  const test_scope_id = "module:test.ts:1:0:100:0:<module>" as ScopeId;

  return {
    captures: [],
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
): CaptureNode {
  const mock_node = {
    text: name,
    startPosition: {
      row: location.start_line - 1,
      column: location.start_column,
    },
    endPosition: { row: location.end_line - 1, column: location.end_column },
  };

  return {
    name: `definition.${entity}`,
    node: mock_node as any,
    text: name as SymbolName,
    category: "definition" as SemanticCategory,
    entity: entity as SemanticEntity,
    location: location,
  };
}

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

    const result = builder.build();
    expect(result.classes.size).toBe(1);

    const class_def = result.classes.get(class_id)!;
    expect(class_def.methods).toHaveLength(2);
    expect(class_def.properties).toHaveLength(2);
    expect(class_def.extends).toEqual(["BaseClass"]);

    const method1 = class_def.methods.find((m) => m.name === "method1");
    expect(method1?.return_type).toBe("string");

    const method2 = class_def.methods.find((m) => m.name === "method2");
    expect(method2?.return_type).toBe("number");
  });

  it("should assemble class with inheritance chain", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_id = "class:test.ts:1:0:10:0:ChildClass" as SymbolId;
    builder.add_class({
      symbol_id: class_id,
      name: "ChildClass" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
      extends: ["ParentClass" as SymbolName],
    });

    const result = builder.build();
    const class_def = result.classes.get(class_id)!;

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

    const result = builder.build();
    const func_def = result.functions.get(func_id)!;

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

    const result = builder.build();
    const class_def = result.classes.get(class_id)!;
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

    const result = builder.build();
    const interface_def = result.interfaces.get(interface_id)!;

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

    const result = builder.build();
    const enum_def = result.enums.get(enum_id)!;

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

    const result = builder.build();
    const namespace_def = result.namespaces.get(namespace_id)!;

    expect(namespace_def.kind).toBe("namespace");
    expect(namespace_def.name).toBe("MyNamespace");
  });

  it("should assemble class with constructor and parameters", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const class_id = "class:test.ts:1:0:10:0:MyClass" as SymbolId;
    const constructor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

    builder.add_class({
      symbol_id: class_id,
      name: "MyClass" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
    });

    builder.add_constructor_to_class(class_id, {
      symbol_id: constructor_id,
      name: "constructor" as SymbolName,
      location: create_test_location(2, 2),
      scope_id: context.root_scope_id,
      availability: { scope: "public" },
      access_modifier: "public",
    });

    builder.add_parameter_to_callable(constructor_id, {
      symbol_id: "param:test.ts:2:15:2:20:name" as SymbolId,
      name: "name" as SymbolName,
      location: create_test_location(2, 15),
      scope_id: context.root_scope_id,
      type: "string" as SymbolName,
    });

    builder.add_parameter_to_callable(constructor_id, {
      symbol_id: "param:test.ts:2:22:2:27:age" as SymbolId,
      name: "age" as SymbolName,
      location: create_test_location(2, 22),
      scope_id: context.root_scope_id,
      type: "number" as SymbolName,
      optional: true,
    });

    const result = builder.build();
    const class_def = result.classes.get(class_id)!;

    expect(class_def.constructor).toBeDefined();
    expect(class_def.constructor).toHaveLength(1);

    const constructor_def = class_def.constructor![0];
    expect(constructor_def.kind).toBe("constructor");
    expect(constructor_def.parameters).toHaveLength(2);
    expect(constructor_def.parameters[0].name).toBe("name");
    expect(constructor_def.parameters[0].type).toBe("string");
    expect(constructor_def.parameters[1].name).toBe("age");
    expect(constructor_def.parameters[1].optional).toBe(true);
  });

  it("should support parameters for interface methods", () => {
    const context = create_test_context();
    const builder = new DefinitionBuilder(context);

    const interface_id = "interface:test.ts:1:0:5:0:IService" as SymbolId;
    const method_id = "method:test.ts:2:2:2:30:process" as SymbolId;

    builder.add_interface({
      symbol_id: interface_id,
      name: "IService" as SymbolName,
      location: create_test_location(1),
      scope_id: context.root_scope_id,
      availability: { scope: "file-export" },
    });

    builder.add_method_signature_to_interface(interface_id, {
      symbol_id: method_id,
      name: "process" as SymbolName,
      location: create_test_location(2, 2),
      scope_id: context.root_scope_id,
      return_type: "Promise<void>" as SymbolName,
    });

    builder.add_parameter_to_callable(method_id, {
      symbol_id: "param:test.ts:2:10:2:15:data" as SymbolId,
      name: "data" as SymbolName,
      location: create_test_location(2, 10),
      scope_id: context.root_scope_id,
      type: "string" as SymbolName,
    });

    const result = builder.build();
    const interface_def = result.interfaces.get(interface_id)!;

    expect(interface_def.methods).toHaveLength(1);
    const method_def = interface_def.methods[0];
    expect(method_def.name).toBe("process");
    expect(method_def.parameters).toHaveLength(1);
    expect(method_def.parameters[0].name).toBe("data");
    expect(method_def.parameters[0].type).toBe("string");
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
        import_kind: "default",
      })
      .add_type_alias({
        kind: "type_alias",
        symbol_id: "type:test:80:0:80:15:TestType" as SymbolId,
        name: "TestType" as SymbolName,
        location: create_test_location(80),
        scope_id: context.root_scope_id,
        availability: { scope: "file-export" },
      });

    const result = builder.build();

    // Check all types were created
    expect(result.classes.size).toBe(1);
    expect(result.functions.size).toBe(1);
    expect(result.interfaces.size).toBe(1);
    expect(result.enums.size).toBe(1);
    expect(result.namespaces.size).toBe(1);
    expect(result.variables.size).toBe(1);
    expect(result.imports.size).toBe(1);
    expect(result.types.size).toBe(2); // Interface creates a type alias + explicit type alias

    // Verify specific definitions exist
    expect(result.classes.get(class_id)).toBeDefined();
    expect(result.functions.get(func_id)).toBeDefined();
    expect(result.interfaces.get(interface_id)).toBeDefined();
    expect(result.enums.get(enum_id)).toBeDefined();
    expect(result.namespaces.get(namespace_id)).toBeDefined();
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

    const build_result = builder.build();
    expect(build_result.classes.size).toBe(1);

    const class_def = build_result.classes.get(class_id)!;
    expect(class_def.methods).toHaveLength(1);
    expect(class_def.properties).toHaveLength(1);
    expect(class_def.decorators).toHaveLength(1);
    expect(class_def.methods[0].parameters).toHaveLength(1);
  });
});
