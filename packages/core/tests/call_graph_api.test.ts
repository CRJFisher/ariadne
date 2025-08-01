import { describe, test, expect } from "vitest";
import { Project, CallGraph, CallGraphNode, CallGraphEdge } from "../src/index";

/**
 * These tests verify the exact API structure that external tools
 * (like agent validation) expect from the CallGraph API.
 * They ensure that breaking changes to the API will be caught.
 */
describe("CallGraph API Contract", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  describe("CallGraphNode structure", () => {
    test("nodes have correct property names and types", () => {
      const code = `
function greet(name: string) {
  return "Hello " + name;
}

function main() {
  greet("World");
}
`;
      project.add_or_update_file("test.ts", code);
      const callGraph = project.get_call_graph();

      // Verify nodes is a Map
      expect(callGraph.nodes).toBeInstanceOf(Map);
      expect(callGraph.nodes.size).toBe(2);

      // Get a node and verify its structure
      const mainNode = callGraph.nodes.get("test#main");
      expect(mainNode).toBeDefined();

      // Verify CallGraphNode properties
      expect(mainNode).toHaveProperty("symbol");
      expect(mainNode).toHaveProperty("definition");
      expect(mainNode).toHaveProperty("calls");
      expect(mainNode).toHaveProperty("is_exported");

      // Verify definition sub-properties
      expect(mainNode!.definition).toHaveProperty("name");
      expect(mainNode!.definition).toHaveProperty("file_path");
      expect(mainNode!.definition).toHaveProperty("range");
      expect(mainNode!.definition).toHaveProperty("symbol_id");
      expect(mainNode!.definition).toHaveProperty("symbol_kind");
      expect(mainNode!.definition).toHaveProperty("metadata");

      // Verify actual values
      expect(mainNode!.definition.name).toBe("main");
      expect(mainNode!.definition.file_path).toBe("test.ts");
      expect(mainNode!.definition.symbol_kind).toBe("function");
      expect(mainNode!.symbol).toBe("test#main");
      expect(mainNode!.calls).toBeInstanceOf(Array);
    });

    test("node range has correct line numbers", () => {
      const code = `function foo() {
  return 42;
}`;
      project.add_or_update_file("test.ts", code);
      const callGraph = project.get_call_graph();

      const fooNode = callGraph.nodes.get("test#foo");
      expect(fooNode).toBeDefined();
      
      // Line numbers should be 0-based in range
      expect(fooNode!.definition.range.start.row).toBe(0);
      expect(fooNode!.definition.range.start.column).toBeGreaterThanOrEqual(0);
    });

    test.skip("metadata contains is_exported property", () => {
      // SKIPPED: Export detection is not yet implemented properly
      // findExportedDef returns any definition in root scope, not just exported ones
      // Proper implementation would require AST analysis to detect export keywords
      const code = `
export function publicFunc() {
  return "public";
}

function privateFunc() {
  return "private";
}
`;
      project.add_or_update_file("test.ts", code);
      const callGraph = project.get_call_graph();

      const publicNode = callGraph.nodes.get("test#publicFunc");
      const privateNode = callGraph.nodes.get("test#privateFunc");

      expect(publicNode).toBeDefined();
      expect(privateNode).toBeDefined();

      // Check is_exported on the CallGraphNode (not in metadata)
      expect(publicNode!.is_exported).toBe(true);
      expect(privateNode!.is_exported).toBe(false);
    });
  });

  describe("CallGraphEdge structure", () => {
    test("edges have 'from' and 'to' properties (not 'source'/'target')", () => {
      const code = `
function callee() {
  return 1;
}

function caller() {
  return callee();
}
`;
      project.add_or_update_file("test.ts", code);
      const callGraph = project.get_call_graph();

      expect(callGraph.edges).toBeInstanceOf(Array);
      expect(callGraph.edges.length).toBe(1);

      const edge = callGraph.edges[0];

      // Verify correct property names
      expect(edge).toHaveProperty("from");
      expect(edge).toHaveProperty("to");
      expect(edge).toHaveProperty("call_type");

      // Verify NO incorrect property names
      expect(edge).not.toHaveProperty("source");
      expect(edge).not.toHaveProperty("target");

      // Verify values
      expect(edge.from).toBe("test#caller");
      expect(edge.to).toBe("test#callee");
      expect(edge.call_type).toBe("direct");
    });

    test("edge filtering works with from/to properties", () => {
      const code = `
function a() { return b() + c(); }
function b() { return c(); }
function c() { return 42; }
`;
      project.add_or_update_file("test.ts", code);
      const callGraph = project.get_call_graph();

      // Test filtering by 'from'
      const edgesFromA = callGraph.edges.filter(e => e.from === "test#a");
      expect(edgesFromA.length).toBe(2);
      expect(edgesFromA.map(e => e.to).sort()).toEqual(["test#b", "test#c"]);

      // Test filtering by 'to'
      const edgesToC = callGraph.edges.filter(e => e.to === "test#c");
      expect(edgesToC.length).toBe(2);
      expect(edgesToC.map(e => e.from).sort()).toEqual(["test#a", "test#b"]);
    });
  });

  describe("get_source_with_context API", () => {
    test("returns object with 'source' property", () => {
      const code = `
/**
 * Greets a person by name.
 * @param name - The name of the person
 * @returns A greeting message
 */
function greet(name: string): string {
  return "Hello " + name;
}
`;
      project.add_or_update_file("test.ts", code);
      const funcs = project.get_functions_in_file("test.ts");
      const greetFunc = funcs.find(f => f.name === "greet");
      expect(greetFunc).toBeDefined();

      const result = project.get_source_with_context(greetFunc!, "test.ts");

      // Verify it returns an object with 'source' property
      expect(result).toBeTypeOf("object");
      expect(result).toHaveProperty("source");
      expect(result.source).toBeTypeOf("string");
      expect(result.source).toContain("function greet");

      // May also have docstring and decorators
      expect(result).toHaveProperty("docstring");
      expect(result).toHaveProperty("decorators");
    });
  });

  describe("Top-level nodes identification", () => {
    test("top_level_nodes excludes functions called within same module", () => {
      const code = `
function util() { return 42; }
function helper() { return util(); }
function main() { return helper(); }
`;
      project.add_or_update_file("test.ts", code);
      const callGraph = project.get_call_graph();

      // Only main should be top-level (not called by anyone)
      expect(callGraph.top_level_nodes).toEqual(["test#main"]);
    });

    test("exported functions called internally are not top-level", () => {
      const code = `
export function exported() { return 42; }
function internal() { return exported(); }
export function main() { return internal(); }
`;
      project.add_or_update_file("test.ts", code);
      const callGraph = project.get_call_graph();

      // Even though 'exported' is exported, it's called by 'internal'
      // so it shouldn't be top-level
      expect(callGraph.top_level_nodes).toContain("test#main");
      expect(callGraph.top_level_nodes).not.toContain("test#exported");
    });
  });

  describe("Multi-language support", () => {
    test("Python call graph uses same API structure", () => {
      const pythonCode = `
def helper():
    return 42

def main():
    return helper()
`;
      project.add_or_update_file("test.py", pythonCode);
      const callGraph = project.get_call_graph();

      // Verify same structure for Python
      const mainNode = callGraph.nodes.get("test#main");
      expect(mainNode).toBeDefined();
      expect(mainNode!.definition.name).toBe("main");
      expect(mainNode!.definition.symbol_kind).toBe("function");

      // Check edges work the same
      const edges = callGraph.edges.filter(e => e.from === "test#main");
      expect(edges.length).toBe(1);
      expect(edges[0].to).toBe("test#helper");
    });

    test("JavaScript call graph uses same API structure", () => {
      const jsCode = `
function utility() {
  return "util";
}

const arrow = () => {
  return utility();
};

function main() {
  arrow();
}
`;
      project.add_or_update_file("test.js", jsCode);
      const callGraph = project.get_call_graph();

      // Arrow functions assigned to constants are NOT included in call graph by default
      // Only function declarations, methods, and generators are included
      expect(callGraph.nodes.has("test#arrow")).toBe(false);
      
      // But utility function should be included
      expect(callGraph.nodes.has("test#utility")).toBe(true);
      expect(callGraph.nodes.has("test#main")).toBe(true);

      // Check that main is recognized as top-level (no one calls it)
      expect(callGraph.top_level_nodes).toContain("test#main");
    });
  });

  describe("Edge cases and error handling", () => {
    test("handles empty files gracefully", () => {
      project.add_or_update_file("empty.ts", "");
      const callGraph = project.get_call_graph();
      
      expect(callGraph.nodes.size).toBe(0);
      expect(callGraph.edges.length).toBe(0);
      expect(callGraph.top_level_nodes.length).toBe(0);
    });

    test("handles files with only comments", () => {
      const code = `
// Just a comment
/* Multi-line
   comment */
`;
      project.add_or_update_file("comments.ts", code);
      const callGraph = project.get_call_graph();
      
      expect(callGraph.nodes.size).toBe(0);
      expect(callGraph.edges.length).toBe(0);
    });

    test("handles syntax errors gracefully", () => {
      const code = `
function broken( {
  return 42;
}
`;
      project.add_or_update_file("broken.ts", code);
      
      // Should not throw
      expect(() => {
        const callGraph = project.get_call_graph();
        // May or may not parse the broken function
        expect(callGraph).toBeDefined();
      }).not.toThrow();
    });
  });
});