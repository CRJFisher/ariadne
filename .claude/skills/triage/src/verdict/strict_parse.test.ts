import { describe, expect, it } from "vitest";

import {
  assert_keys,
  describe as describe_value,
  expect_object,
  is_record,
  parse_non_empty_string,
} from "./strict_parse.js";

describe("is_record", () => {
  it("accepts plain objects", () => {
    expect(is_record({})).toEqual(true);
    expect(is_record({ a: 1 })).toEqual(true);
  });

  it("rejects null, arrays, primitives", () => {
    expect(is_record(null)).toEqual(false);
    expect(is_record(undefined)).toEqual(false);
    expect(is_record([])).toEqual(false);
    expect(is_record([1, 2])).toEqual(false);
    expect(is_record("x")).toEqual(false);
    expect(is_record(42)).toEqual(false);
    expect(is_record(true)).toEqual(false);
  });
});

describe("expect_object", () => {
  it("returns the input when shape is valid", () => {
    const obj = { a: 1 };
    expect(expect_object(obj, "ctx")).toEqual(obj);
  });

  it("throws with ctx prefix on non-object", () => {
    expect(() => expect_object(null, "ctx")).toThrow(/ctx: expected object, got null/);
    expect(() => expect_object([], "ctx")).toThrow(/ctx: expected object, got array/);
    expect(() => expect_object(42, "ctx")).toThrow(/ctx: expected object, got number/);
  });
});

describe("assert_keys", () => {
  it("accepts exact key set", () => {
    expect(() => assert_keys({ a: 1, b: 2 }, ["a", "b"], "ctx")).not.toThrow();
  });

  it("throws on missing field", () => {
    expect(() => assert_keys({ a: 1 }, ["a", "b"], "ctx")).toThrow(
      /ctx: missing required field 'b'/,
    );
  });

  it("throws on unexpected field", () => {
    expect(() => assert_keys({ a: 1, c: 3 }, ["a"], "ctx")).toThrow(
      /ctx: unexpected field 'c'/,
    );
  });

  it("treats __proto__ as a normal own-property and rejects it as unexpected", () => {
    const raw: unknown = JSON.parse("{\"a\":1,\"__proto__\":{\"polluted\":true}}");
    if (!is_record(raw)) throw new Error("setup failed");
    expect(() => assert_keys(raw, ["a"], "ctx")).toThrow(
      /ctx: unexpected field '__proto__'/,
    );
    // Confirm prototype was not actually polluted.
    expect(({} as Record<string, unknown>)["polluted"]).toEqual(undefined);
  });
});

describe("parse_non_empty_string", () => {
  it("returns the value when valid", () => {
    expect(parse_non_empty_string("x", "ctx")).toEqual("x");
  });

  it("throws on non-string", () => {
    expect(() => parse_non_empty_string(42, "ctx")).toThrow(
      /ctx: must be a string, got number/,
    );
  });

  it("throws on empty string", () => {
    expect(() => parse_non_empty_string("", "ctx")).toThrow(/ctx: must be non-empty/);
  });
});

describe("describe", () => {
  it("names common shapes", () => {
    expect(describe_value(null)).toEqual("null");
    expect(describe_value([])).toEqual("array");
    expect(describe_value(42)).toEqual("number");
    expect(describe_value("x")).toEqual("string");
    expect(describe_value({})).toEqual("object");
    expect(describe_value(true)).toEqual("boolean");
  });
});
