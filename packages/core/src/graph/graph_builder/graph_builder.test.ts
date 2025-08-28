/**
 * Graph Builder Tests
 *
 * Tests for the graph builder orchestration module.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  build_project_graph,
  update_graph_for_file,
  analyze_file,
  query_graph,
  GraphBuilderConfig,
  ProjectGraph,
  FileAnalysisResult,
} from "./graph_builder";
import {
  create_memory_storage,
  MemoryStorage,
} from "../../storage/memory_storage";
import { StorageInterface, StoredFile } from "../../storage/storage_interface";
import { Language } from "@ariadnejs/types";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";

/**
 * Helper to create a test file
 */
function create_test_file(
  file_path: string,
  source_code: string,
  language: Language
): StoredFile {
  // Create parser for the language
  const parser = new Parser();

  switch (language) {
    case "javascript":
      parser.setLanguage(JavaScript);
      break;
    case "typescript":
      parser.setLanguage(TypeScript.typescript);
      break;
    case "python":
      parser.setLanguage(Python);
      break;
    case "rust":
      parser.setLanguage(Rust);
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  const tree = parser.parse(source_code);

  return {
    file_path,
    source_code,
    language,
    tree,
    last_modified: Date.now(),
  };
}

/**
 * Helper to create a test configuration
 */
async function create_test_config(): Promise<GraphBuilderConfig> {
  const storage = create_memory_storage();
  await storage.initialize();

  const languages = new Map<string, Language>([
    ["javascript", "javascript"],
    ["typescript", "typescript"],
    ["python", "python"],
    ["rust", "rust"],
  ]);

  return {
    storage,
    languages,
  };
}

describe("Graph Builder", () => {
  let config: GraphBuilderConfig;

  beforeEach(async () => {
    config = await create_test_config();
  });

  describe("File Analysis", () => {
    test("should analyze a simple JavaScript file", async () => {
      const file = create_test_file(
        "test.js",
        `
        function greet(name) {
          console.log('Hello ' + name);
        }
        
        greet('World');
        `,
        "javascript"
      );

      // Store the file
      await config.storage.update_file(file);

      // Analyze the file
      const context = {
        storage: config.storage,
        languages: config.languages,
        file_analyses: new Map(),
        module_graph: { modules: new Map(), edges: [] },
        class_hierarchy: { classes: new Map(), inheritance_edges: [] },
      };

      const result = await analyze_file(file, context as any);

      expect(result.file_path).toBe("test.js");
      expect(result.function_calls.length).toBeGreaterThan(0);
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);

      // Should have a function node for 'greet'
      const greet_node = result.nodes.find((n) => n.name === "greet");
      expect(greet_node).toBeDefined();
      expect(greet_node?.type).toBe("function");

      // Should have a module node
      const module_node = result.nodes.find((n) => n.type === "module");
      expect(module_node).toBeDefined();
    });

    test("should analyze a TypeScript file with classes", async () => {
      const file = create_test_file(
        "test.ts",
        `
        class Person {
          name: string;
          
          constructor(name: string) {
            this.name = name;
          }
          
          greet() {
            console.log('Hello, I am ' + this.name);
          }
        }
        
        const person = new Person('Alice');
        person.greet();
        `,
        "typescript"
      );

      await config.storage.update_file(file);

      const context = {
        storage: config.storage,
        languages: config.languages,
        file_analyses: new Map(),
        module_graph: { modules: new Map(), edges: [] },
        class_hierarchy: { classes: new Map(), inheritance_edges: [] },
      };

      const result = await analyze_file(file, context as any);

      // Should have class node
      const class_node = result.nodes.find(
        (n) => n.type === "class" && n.name === "Person"
      );
      expect(class_node).toBeDefined();

      // Should have method nodes
      const method_nodes = result.nodes.filter((n) => n.type === "method");
      expect(method_nodes.length).toBeGreaterThan(0);

      // Should have constructor calls
      expect(result.constructor_calls.length).toBeGreaterThan(0);

      // Should have method calls
      expect(result.method_calls.length).toBeGreaterThan(0);
    });

    test("should detect imports and exports", async () => {
      const file = create_test_file(
        "module.js",
        `
        import { helper } from './helper';
        
        export function process(data) {
          return helper(data);
        }
        
        export default process;
        `,
        "javascript"
      );

      await config.storage.update_file(file);

      const context = {
        storage: config.storage,
        languages: config.languages,
        file_analyses: new Map(),
        module_graph: { modules: new Map(), edges: [] },
        class_hierarchy: { classes: new Map(), inheritance_edges: [] },
      };

      const result = await analyze_file(file, context as any);

      // Should detect imports
      expect(result.imports.length).toBeGreaterThan(0);
      const import_info = result.imports.find(
        (i) => i.module_path === "./helper"
      );
      expect(import_info).toBeDefined();

      // Should detect exports
      expect(result.exports.length).toBeGreaterThan(0);
      const export_info = result.exports.find(
        (e) => e.exported_name === "process"
      );
      expect(export_info).toBeDefined();

      // Should have import/export edges
      const import_edges = result.edges.filter((e) => e.type === "imports");
      const export_edges = result.edges.filter((e) => e.type === "exports");
      expect(import_edges.length).toBeGreaterThan(0);
      expect(export_edges.length).toBeGreaterThan(0);
    });
  });

  describe("Project Graph Building", () => {
    test("should build graph for multiple files", async () => {
      // Create multiple related files
      const file1 = create_test_file(
        "main.js",
        `
        import { helper } from './helper';
        
        function main() {
          helper('test');
        }
        
        main();
        `,
        "javascript"
      );

      const file2 = create_test_file(
        "helper.js",
        `
        export function helper(data) {
          console.log(data);
        }
        `,
        "javascript"
      );

      // Store files
      await config.storage.update_file(file1);
      await config.storage.update_file(file2);

      // Build project graph
      const graph = await build_project_graph(config);

      expect(graph.nodes.size).toBeGreaterThan(0);
      expect(graph.edges.size).toBeGreaterThan(0);

      // Should have nodes for both files
      const main_module = graph.nodes.get("module:main.js");
      const helper_module = graph.nodes.get("module:helper.js");
      expect(main_module).toBeDefined();
      expect(helper_module).toBeDefined();

      // Should have import edge between modules
      const import_edge = Array.from(graph.edges.values()).find(
        (e) => e.type === "imports" && e.source === "module:main.js"
      );
      expect(import_edge).toBeDefined();

      // Should have metadata
      expect(graph.metadata.file_count).toBe(2);
      expect(graph.metadata.node_count).toBe(graph.nodes.size);
      expect(graph.metadata.edge_count).toBe(graph.edges.size);
    });

    test("should handle multi-language projects", async () => {
      const js_file = create_test_file(
        "app.js",
        "function jsFunction() { return 42; }",
        "javascript"
      );

      const py_file = create_test_file(
        "script.py",
        "def py_function():\n    return 42",
        "python"
      );

      const rs_file = create_test_file(
        "lib.rs",
        "fn rs_function() -> i32 { 42 }",
        "rust"
      );

      await config.storage.update_file(js_file);
      await config.storage.update_file(py_file);
      await config.storage.update_file(rs_file);

      const graph = await build_project_graph(config);

      // Should have nodes for all languages
      expect(graph.nodes.size).toBeGreaterThan(0);

      // Should have module nodes for each file
      expect(graph.nodes.get("module:app.js")).toBeDefined();
      expect(graph.nodes.get("module:script.py")).toBeDefined();
      expect(graph.nodes.get("module:lib.rs")).toBeDefined();

      // Should track different language metadata
      const js_module = graph.nodes.get("module:app.js");
      expect(js_module?.metadata.language).toBe("javascript");

      const py_module = graph.nodes.get("module:script.py");
      expect(py_module?.metadata.language).toBe("python");

      const rs_module = graph.nodes.get("module:lib.rs");
      expect(rs_module?.metadata.language).toBe("rust");
    });
  });

  describe("Incremental Updates", () => {
    test("should update graph when file changes", async () => {
      const initial_code = `
        function oldFunction() {
          console.log('old');
        }
      `;

      const file = create_test_file("test.js", initial_code, "javascript");
      await config.storage.update_file(file);

      // Build initial graph
      const initial_graph = await build_project_graph(config);
      const initial_node_count = initial_graph.nodes.size;

      // Update file with new code
      const updated_code = `
        function newFunction() {
          console.log('new');
        }
        
        function anotherFunction() {
          newFunction();
        }
      `;

      const updated_file = create_test_file(
        "test.js",
        updated_code,
        "javascript"
      );
      await config.storage.update_file(updated_file);

      // Update graph incrementally
      const updated_graph = await update_graph_for_file(
        "test.js",
        config,
        initial_graph
      );

      // Should have different nodes
      expect(updated_graph.nodes.size).not.toBe(initial_node_count);

      // Should have new function nodes
      const new_func = Array.from(updated_graph.nodes.values()).find(
        (n) => n.name === "newFunction"
      );
      expect(new_func).toBeDefined();

      // Should not have old function node
      const old_func = Array.from(updated_graph.nodes.values()).find(
        (n) => n.name === "oldFunction"
      );
      expect(old_func).toBeUndefined();

      // Should have updated metadata
      expect(updated_graph.metadata.last_update).toBeDefined();
    });

    test("should handle file deletion", async () => {
      const file = create_test_file(
        "to-delete.js",
        "function toDelete() {}",
        "javascript"
      );
      await config.storage.update_file(file);

      const graph = await build_project_graph(config);
      const initial_node_count = graph.nodes.size;

      // Remove file from storage
      await config.storage.remove_file("to-delete.js");

      // Update graph
      const updated_graph = await update_graph_for_file(
        "to-delete.js",
        config,
        graph
      );

      // Should have fewer nodes
      expect(updated_graph.nodes.size).toBeLessThan(initial_node_count);

      // Should not have nodes from deleted file
      const deleted_nodes = Array.from(updated_graph.nodes.values()).filter(
        (n) => n.file_path === "to-delete.js"
      );
      expect(deleted_nodes.length).toBe(0);
    });
  });

  describe("Graph Queries", () => {
    test("should query nodes by type", async () => {
      const file = create_test_file(
        "mixed.js",
        `
        function func1() {}
        function func2() {}
        class MyClass {
          method1() {}
        }
        `,
        "javascript"
      );

      await config.storage.update_file(file);
      const graph = await build_project_graph(config);

      // Query for functions
      const function_query = query_graph(graph, { node_type: "function" });
      expect(function_query.nodes.length).toBeGreaterThanOrEqual(2);

      // Query for classes
      const class_query = query_graph(graph, { node_type: "class" });
      expect(class_query.nodes.length).toBeGreaterThanOrEqual(1);

      // Query for methods
      const method_query = query_graph(graph, { node_type: "method" });
      expect(method_query.nodes.length).toBeGreaterThanOrEqual(1);
    });

    test("should query edges by type", async () => {
      const file = create_test_file(
        "calls.js",
        `
        import { external } from './external';
        
        function caller() {
          callee();
        }
        
        function callee() {}
        
        export { caller };
        `,
        "javascript"
      );

      await config.storage.update_file(file);
      const graph = await build_project_graph(config);

      // Query for call edges
      const call_query = query_graph(graph, { edge_type: "calls" });
      expect(call_query.edges.length).toBeGreaterThan(0);

      // Query for import edges
      const import_query = query_graph(graph, { edge_type: "imports" });
      expect(import_query.edges.length).toBeGreaterThan(0);

      // Query for export edges
      const export_query = query_graph(graph, { edge_type: "exports" });
      expect(export_query.edges.length).toBeGreaterThan(0);
    });

    test("should query by file path", async () => {
      const file1 = create_test_file(
        "file1.js",
        "function f1() {}",
        "javascript"
      );
      const file2 = create_test_file(
        "file2.js",
        "function f2() {}",
        "javascript"
      );

      await config.storage.update_file(file1);
      await config.storage.update_file(file2);

      const graph = await build_project_graph(config);

      // Query nodes from file1
      const file1_query = query_graph(graph, { file_path: "file1.js" });
      const file1_nodes = file1_query.nodes.filter(
        (n) => n.file_path === "file1.js"
      );
      expect(file1_nodes.length).toBeGreaterThan(0);

      // Should not include nodes from file2
      const file2_nodes = file1_query.nodes.filter(
        (n) => n.file_path === "file2.js"
      );
      expect(file2_nodes.length).toBe(0);
    });

    test("should query by name pattern", async () => {
      const file = create_test_file(
        "patterns.js",
        `
        function handleRequest() {}
        function handleResponse() {}
        function processData() {}
        `,
        "javascript"
      );

      await config.storage.update_file(file);
      const graph = await build_project_graph(config);

      // Query for functions starting with 'handle'
      const handle_query = query_graph(graph, {
        name_pattern: /^handle/,
      });

      const handle_functions = handle_query.nodes.filter(
        (n) => n.type === "function" && n.name.startsWith("handle")
      );
      expect(handle_functions.length).toBe(2);

      // Should not include 'processData'
      const process_func = handle_query.nodes.find(
        (n) => n.name === "processData"
      );
      expect(process_func).toBeUndefined();
    });
  });
});
