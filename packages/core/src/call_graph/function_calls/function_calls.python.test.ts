/**
 * Tests for Python-specific function call detection
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import { FunctionCallContext } from "./function_calls";
// TODO: Re-enable after implementing tree-sitter query-based approach
// import { handle_python_comprehensions } from "./function_calls.python";
import { find_function_calls } from "./function_calls";
import { SourceCode, FilePath } from "@ariadnejs/types";

// TODO: Re-enable after implementing tree-sitter query-based approach
describe.skip("Python-specific Function Calls", () => {
  describe("Python comprehensions", () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it("should detect calls within list comprehensions", () => {
      const source = `
result = [process(x) for x in items]
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = handle_python_comprehensions(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("process");
      expect(calls[0].is_in_comprehension).toBe(true);
    });

    it("should detect calls in dictionary comprehensions", () => {
      const source = `
result = {key(x): value(x) for x in items}
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = handle_python_comprehensions(context);
      expect(calls).toHaveLength(2);
      expect(calls.map((c) => c.callee_name).sort()).toEqual(["key", "value"]);
      calls.forEach((call) => {
        expect(call.is_in_comprehension).toBe(true);
      });
    });

    it("should detect calls in set comprehensions", () => {
      const source = `
result = {transform(x) for x in items}
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = handle_python_comprehensions(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("transform");
      expect(calls[0].is_in_comprehension).toBe(true);
    });

    it("should detect calls in generator expressions", () => {
      const source = `
gen = (compute(x) for x in range(10))
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = handle_python_comprehensions(context);
      // Should find compute() and range()
      const computeCall = calls.find((c) => c.callee_name === "compute");
      expect(computeCall).toBeDefined();
      expect(computeCall?.is_in_comprehension).toBe(true);

      const rangeCall = calls.find((c) => c.callee_name === "range");
      expect(rangeCall).toBeDefined();
      expect(rangeCall?.is_in_comprehension).toBe(true);
    });

    it("should handle nested comprehensions", () => {
      const source = `
result = [[inner(y) for y in outer(x)] for x in items]
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = handle_python_comprehensions(context);

      const innerCall = calls.find((c) => c.callee_name === "inner");
      expect(innerCall).toBeDefined();
      expect(innerCall?.is_in_comprehension).toBe(true);

      const outerCall = calls.find((c) => c.callee_name === "outer");
      expect(outerCall).toBeDefined();
      expect(outerCall?.is_in_comprehension).toBe(true);
    });
  });

  describe("Integration with main processor", () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it("should properly detect comprehension and normal calls", () => {
      const source = `
def process_data():
    print("Processing")
    result = [transform(x) for x in get_items()]
    return result
`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      // Should find print (normal call)
      const printCall = calls.find((c) => c.callee_name === "print");
      expect(printCall).toBeDefined();
      expect(printCall?.is_in_comprehension).not.toBe(true);

      // Should find transform - look for the one with is_in_comprehension flag
      const transformCalls = calls.filter((c) => c.callee_name === "transform");
      expect(transformCalls.length).toBeGreaterThan(0);
      const transformInComp = transformCalls.find(
        (c) => c.is_in_comprehension === true
      );
      expect(transformInComp).toBeDefined();

      // Should find get_items - look for the one with is_in_comprehension flag
      const getItemsCalls = calls.filter((c) => c.callee_name === "get_items");
      expect(getItemsCalls.length).toBeGreaterThan(0);
      const getItemsInComp = getItemsCalls.find(
        (c) => c.is_in_comprehension === true
      );
      expect(getItemsInComp).toBeDefined();
    });
  });
});
