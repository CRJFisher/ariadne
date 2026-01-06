/**
 * Tests for scope utilities
 */

import { describe, it, expect } from "vitest";
import type { Location, FilePath } from "./common";
import {
  scope_string,
  scope_from_string,
  global_scope,
  module_scope,
  function_scope,
  class_scope,
  block_scope,
  parameter_scope,
  local_scope,
} from "./scopes";

const test_location: Location = {
  file_path: "test.ts" as FilePath,
  start_line: 1,
  start_column: 0,
  end_line: 5,
  end_column: 10,
};

describe("Scope ID Creation", () => {
  it("should create a global scope", () => {
    const scope = global_scope(test_location);
    expect(scope).toContain("global");
  });

  it("should create a module scope", () => {
    const scope = module_scope(test_location);
    expect(scope).toContain("module");
  });

  it("should create a function scope", () => {
    const scope = function_scope(test_location);
    expect(scope).toContain("function");
  });

  it("should create a class scope", () => {
    const scope = class_scope(test_location);
    expect(scope).toContain("class");
  });

  it("should create a block scope", () => {
    const scope = block_scope(test_location);
    expect(scope).toContain("block");
  });

  it("should create a parameter scope", () => {
    const scope = parameter_scope(test_location);
    expect(scope).toContain("parameter");
  });

  it("should create a local scope", () => {
    const scope = local_scope(test_location);
    expect(scope).toContain("local");
  });
});

describe("scope_string and scope_from_string", () => {
  it("should roundtrip scope location", () => {
    const scope_loc = {
      type: "function" as const,
      file_path: test_location.file_path,
      start_line: test_location.start_line,
      start_column: test_location.start_column,
      end_line: test_location.end_line,
      end_column: test_location.end_column,
      name: "test_func",
    };

    const scope_id = scope_string(scope_loc);
    const parsed = scope_from_string(scope_id);

    expect(parsed.type).toBe(scope_loc.type);
    expect(parsed.file_path).toBe(scope_loc.file_path);
  });
});
