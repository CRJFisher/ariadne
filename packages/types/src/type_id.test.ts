/**
 * Tests for type ID utilities
 */

import { describe, it, expect } from "vitest";
import type { TypeId, FilePath, SymbolName } from "./index";
import type { Location } from "./common";
import {
  defined_type_id,
  primitive_type_id,
  builtin_type_id,
  generic_type_id,
  union_type_id,
  intersection_type_id,
  tuple_type_id,
  array_type_id,
  literal_type_id,
  function_type_id,
  object_type_id,
  parse_type_id,
  is_defined_type,
  is_composite_type,
  type_id_to_string,
  TypeCategory,
  ANY_TYPE,
  UNKNOWN_TYPE,
  NEVER_TYPE,
  VOID_TYPE,
} from "./type_id";

describe("Type ID Constants", () => {
  it("should export ANY_TYPE", () => {
    expect(ANY_TYPE).toBe("type:any");
  });

  it("should export UNKNOWN_TYPE", () => {
    expect(UNKNOWN_TYPE).toBe("type:unknown");
  });

  it("should export NEVER_TYPE", () => {
    expect(NEVER_TYPE).toBe("type:never");
  });

  it("should export VOID_TYPE", () => {
    expect(VOID_TYPE).toBe("type:void");
  });
});

describe("Type ID Factories", () => {
  const test_location: Location = {
    file_path: "test.ts" as FilePath,
    start_line: 1,
    start_column: 0,
    end_line: 1,
    end_column: 10,
  };

  it("should create a defined type ID", () => {
    const type_id = defined_type_id(
      TypeCategory.CLASS,
      "TestClass" as SymbolName,
      test_location
    );
    expect(type_id).toContain("type:class:TestClass");
  });

  it("should create a primitive type ID", () => {
    const type_id = primitive_type_id("string");
    expect(type_id).toBe("type:primitive:string");
  });

  it("should create a builtin type ID", () => {
    const type_id = builtin_type_id("Array");
    expect(type_id).toContain("builtin:Array");
  });

  it("should create a generic type ID", () => {
    const base = "type:Array" as TypeId;
    const type_id = generic_type_id(base, ["type:string" as TypeId]);
    expect(type_id).toContain("generic:");
  });

  it("should create a union type ID", () => {
    const type_id = union_type_id([
      "type:string" as TypeId,
      "type:number" as TypeId,
    ]);
    expect(type_id).toContain("union:");
  });

  it("should create an intersection type ID", () => {
    const type_id = intersection_type_id([
      "type:A" as TypeId,
      "type:B" as TypeId,
    ]);
    expect(type_id).toContain("intersection:");
  });

  it("should create a tuple type ID", () => {
    const type_id = tuple_type_id([
      "type:string" as TypeId,
      "type:number" as TypeId,
    ]);
    expect(type_id).toContain("tuple:");
  });

  it("should create an array type ID", () => {
    const type_id = array_type_id("type:string" as TypeId);
    expect(type_id).toContain("array:");
  });

  it("should create a literal type ID", () => {
    const type_id = literal_type_id("string", "hello");
    expect(type_id).toContain("literal:");
  });

  it("should create a function type ID", () => {
    const type_id = function_type_id(
      ["type:string" as TypeId],
      "type:void" as TypeId
    );
    expect(type_id).toContain("function:");
  });

  it("should create an object type ID", () => {
    const props = new Map<string, TypeId>();
    props.set("name", "type:string" as TypeId);
    const type_id = object_type_id(props);
    expect(type_id).toContain("object:");
  });
});

describe("Type ID Utilities", () => {
  it("should parse a type ID", () => {
    const type_id = "type:string" as TypeId;
    const parsed = parse_type_id(type_id);
    expect(parsed).toBeDefined();
  });

  it("should check if a type is defined", () => {
    expect(is_defined_type("type:string" as TypeId)).toBe(false);
    expect(is_defined_type(ANY_TYPE)).toBe(false);
  });

  it("should check if a type is composite", () => {
    const union = union_type_id([
      "type:string" as TypeId,
      "type:number" as TypeId,
    ]);
    expect(is_composite_type(union)).toBe(true);
    expect(is_composite_type("type:string" as TypeId)).toBe(false);
  });

  it("should convert type ID to string", () => {
    const str = type_id_to_string("type:string" as TypeId);
    expect(typeof str).toBe("string");
  });
});
