import { describe, it, expect, beforeEach } from "vitest";
import { ReferenceRegistry } from "./reference";
import type {
  FilePath,
  ScopeId,
  SymbolName,
  FunctionCallReference,
} from "@ariadnejs/types";

function function_call(
  name: string,
  file_path: FilePath,
  start_line: number
): FunctionCallReference {
  return {
    kind: "function_call",
    name: name as SymbolName,
    scope_id: `module:${file_path}` as ScopeId,
    location: {
      file_path,
      start_line,
      start_column: 0,
      end_line: start_line,
      end_column: name.length,
    },
  };
}

describe("ReferenceRegistry", () => {
  let registry: ReferenceRegistry;
  const file1 = "file1.ts" as FilePath;
  const file2 = "file2.ts" as FilePath;

  beforeEach(() => {
    registry = new ReferenceRegistry();
  });

  describe("get_file_references", () => {
    it("returns references stored for a file", () => {
      const ref = function_call("foo", file1, 3);
      registry.update_file(file1, [ref]);

      expect(registry.get_file_references(file1)).toEqual([ref]);
    });

    it("returns an empty array for a file that was never indexed", () => {
      expect(registry.get_file_references(file1)).toEqual([]);
    });
  });

  describe("update_file", () => {
    it("overwrites the file's references rather than merging", () => {
      const first = function_call("foo", file1, 1);
      const second = function_call("bar", file1, 2);

      registry.update_file(file1, [first]);
      registry.update_file(file1, [second]);

      expect(registry.get_file_references(file1)).toEqual([second]);
    });

    it("stores each file's references independently", () => {
      const ref1 = function_call("foo", file1, 1);
      const ref2 = function_call("bar", file2, 1);

      registry.update_file(file1, [ref1]);
      registry.update_file(file2, [ref2]);

      expect(registry.get_file_references(file1)).toEqual([ref1]);
      expect(registry.get_file_references(file2)).toEqual([ref2]);
    });

    it("copies the input so later mutation of the source array does not leak in", () => {
      const ref1 = function_call("foo", file1, 1);
      const source = [ref1];

      registry.update_file(file1, source);
      source.push(function_call("bar", file1, 2));

      expect(registry.get_file_references(file1)).toEqual([ref1]);
    });
  });

  describe("remove_file", () => {
    it("drops the references stored for a file", () => {
      registry.update_file(file1, [function_call("foo", file1, 1)]);
      registry.remove_file(file1);

      expect(registry.get_file_references(file1)).toEqual([]);
    });

    it("is a no-op for a file that was never indexed", () => {
      expect(() => registry.remove_file(file1)).not.toThrow();
      expect(registry.get_file_references(file1)).toEqual([]);
    });
  });

  describe("clear", () => {
    it("removes references for every file", () => {
      registry.update_file(file1, [function_call("foo", file1, 1)]);
      registry.update_file(file2, [function_call("bar", file2, 1)]);

      registry.clear();

      expect(registry.get_file_references(file1)).toEqual([]);
      expect(registry.get_file_references(file2)).toEqual([]);
    });
  });
});
