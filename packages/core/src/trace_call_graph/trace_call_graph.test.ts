import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { trace_call_graph } from "./trace_call_graph";
import { Project } from "../project/project";
import { DefinitionRegistry } from "../resolve_references/registries/definition";
import { ResolutionRegistry } from "../resolve_references/resolution_registry";
import {
  function_symbol,
  method_symbol,
  class_symbol,
  interface_symbol,
  anonymous_function_symbol,
} from "@ariadnejs/types";
import type {
  CallGraph,
  Language,
  FunctionDefinition,
  ClassDefinition,
  InterfaceDefinition,
  MethodDefinition,
  FilePath,
  ScopeId,
  SymbolName,
} from "@ariadnejs/types";

describe("trace_call_graph", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;
  const file1 = "test.ts" as FilePath;
  const languages: ReadonlyMap<FilePath, Language> = new Map<FilePath, Language>([
    ["test.ts" as FilePath, "typescript"],
    ["test.py" as FilePath, "python"],
    ["widget.ts" as FilePath, "typescript"],
    ["widget.test.ts" as FilePath, "typescript"],
  ]);
  const root_scope = `scope:${file1}:module` as ScopeId;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
  });

  describe("interface method filtering", () => {
    it("excludes interface method signatures from call graph nodes", () => {
      // Create an interface with method signatures (no body_scope_id)
      const interface_id = interface_symbol("MyInterface" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      });

      const method_id = method_symbol("doSomething" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 30,
      });

      // Interface method signature - NO body_scope_id
      const interface_method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "doSomething" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 30,
        },
        parameters: [],
        // body_scope_id is intentionally undefined - interface methods have no body
      };

      const interface_def: InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "MyInterface" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 1,
        },
        is_exported: true,
        extends: [],
        methods: [interface_method],
        properties: [],
      };

      definitions.update_file(file1, [interface_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // Interface method should NOT be in the call graph nodes
      expect(call_graph.nodes.has(method_id)).toBe(false);
      expect(call_graph.nodes.size).toBe(0);

      // Interface method should NOT be an entry point
      expect(call_graph.entry_points).not.toContain(method_id);
      expect(call_graph.entry_points.length).toBe(0);
    });

    it("includes class methods with a body scope as entry points", () => {
      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 1,
      });

      const method_id = method_symbol("doSomething" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 5,
        end_column: 3,
      });

      const method_body_scope = `scope:${file1}:method:doSomething:2:2` as ScopeId;

      // Class method WITH body_scope_id
      const class_method: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "doSomething" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 5,
          end_column: 3,
        },
        parameters: [],
        body_scope_id: method_body_scope, // Has a body
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 1,
        },
        is_exported: true,
        extends: [],
        methods: [class_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(file1, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // Class method WITH body should be in the call graph nodes
      expect(call_graph.nodes.has(method_id)).toBe(true);
      expect(call_graph.nodes.size).toBe(1);

      // Class method with no callers should be an entry point
      expect(call_graph.entry_points).toContain(method_id);
      expect(call_graph.entry_points.length).toBe(1);
    });

    it("includes uncalled functions as entry points", () => {
      const func_id = function_symbol("myFunction" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const func_body_scope = `scope:${file1}:function:myFunction:1:0` as ScopeId;

      const func_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "myFunction" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
        body_scope_id: func_body_scope,
      };

      definitions.update_file(file1, [func_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // Function should be in the call graph nodes
      expect(call_graph.nodes.has(func_id)).toBe(true);

      // Function with no callers should be an entry point
      expect(call_graph.entry_points).toContain(func_id);
    });

    it("distinguishes interface methods from class methods", () => {
      // Interface with method signature (no body)
      const interface_id = interface_symbol("Processor" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      const interface_method_id = method_symbol("process" as SymbolName, {
        file_path: file1,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 20,
      });

      const interface_method: MethodDefinition = {
        kind: "method",
        symbol_id: interface_method_id,
        name: "process" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 2,
          start_column: 2,
          end_line: 2,
          end_column: 20,
        },
        parameters: [],
        // No body_scope_id - interface method
      };

      const interface_def: InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "Processor" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        extends: [],
        methods: [interface_method],
        properties: [],
      };

      // Class implementing the interface (has body)
      const class_id = class_symbol("MyProcessor" as SymbolName, {
        file_path: file1,
        start_line: 10,
        start_column: 0,
        end_line: 20,
        end_column: 1,
      });

      const class_method_id = method_symbol("process" as SymbolName, {
        file_path: file1,
        start_line: 11,
        start_column: 2,
        end_line: 15,
        end_column: 3,
      });

      const class_method_body_scope = `scope:${file1}:method:process:11:2` as ScopeId;

      const class_method: MethodDefinition = {
        kind: "method",
        symbol_id: class_method_id,
        name: "process" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 11,
          start_column: 2,
          end_line: 15,
          end_column: 3,
        },
        parameters: [],
        body_scope_id: class_method_body_scope, // Has implementation
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyProcessor" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 10,
          start_column: 0,
          end_line: 20,
          end_column: 1,
        },
        is_exported: true,
        extends: ["Processor" as SymbolName],
        methods: [class_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(file1, [interface_def, class_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // Only the class method (with body) should be in nodes
      expect(call_graph.nodes.has(interface_method_id)).toBe(false);
      expect(call_graph.nodes.has(class_method_id)).toBe(true);
      expect(call_graph.nodes.size).toBe(1);

      // Only the class method should be an entry point
      expect(call_graph.entry_points).not.toContain(interface_method_id);
      expect(call_graph.entry_points).toContain(class_method_id);
      expect(call_graph.entry_points.length).toBe(1);
    });
  });

  describe("anonymous function suppression", () => {
    it("excludes anonymous functions from entry points (IIFEs, forEach callbacks)", () => {
      const anon_id = anonymous_function_symbol({
        file_path: file1,
        start_line: 5,
        start_column: 20,
        end_line: 7,
        end_column: 3,
      });

      const anon_body_scope = `scope:${file1}:function:<anonymous>:5:20` as ScopeId;

      const anon_def: FunctionDefinition = {
        kind: "function",
        symbol_id: anon_id,
        name: "<anonymous>" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 5,
          start_column: 20,
          end_line: 7,
          end_column: 3,
        },
        is_exported: false,
        signature: { parameters: [] },
        body_scope_id: anon_body_scope,
      };

      definitions.update_file(file1, [anon_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      expect(call_graph.nodes.has(anon_id)).toBe(true);
      expect(call_graph.entry_points).not.toContain(anon_id);
      expect(call_graph.entry_points.length).toBe(0);
    });

    it("excludes anonymous functions even when a named function is also present", () => {
      const named_id = function_symbol("doWork" as SymbolName, {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 4,
        end_column: 1,
      });

      const named_body_scope = `scope:${file1}:function:doWork:1:0` as ScopeId;

      const named_def: FunctionDefinition = {
        kind: "function",
        symbol_id: named_id,
        name: "doWork" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 4,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
        body_scope_id: named_body_scope,
      };

      const anon_id = anonymous_function_symbol({
        file_path: file1,
        start_line: 5,
        start_column: 20,
        end_line: 7,
        end_column: 3,
      });

      const anon_body_scope = `scope:${file1}:function:<anonymous>:5:20` as ScopeId;

      const anon_def: FunctionDefinition = {
        kind: "function",
        symbol_id: anon_id,
        name: "<anonymous>" as SymbolName,
        defining_scope_id: root_scope,
        location: {
          file_path: file1,
          start_line: 5,
          start_column: 20,
          end_line: 7,
          end_column: 3,
        },
        is_exported: false,
        signature: { parameters: [] },
        body_scope_id: anon_body_scope,
      };

      definitions.update_file(file1, [named_def, anon_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      expect(call_graph.entry_points).toContain(named_id);
      expect(call_graph.entry_points).not.toContain(anon_id);
      expect(call_graph.entry_points.length).toBe(1);
    });
  });

  describe("test-file suppression", () => {
    const test_file = "widget.test.ts" as FilePath;
    const test_scope = `scope:${test_file}:module` as ScopeId;

    function test_file_function(): FunctionDefinition {
      const location = {
        file_path: test_file,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      };
      return {
        kind: "function",
        symbol_id: function_symbol("renders_widget" as SymbolName, location),
        name: "renders_widget" as SymbolName,
        defining_scope_id: test_scope,
        location,
        is_exported: false,
        signature: { parameters: [] },
        body_scope_id:
          `scope:${test_file}:function:renders_widget:1:0` as ScopeId,
      };
    }

    it("marks callables in test files with is_test true", () => {
      const def = test_file_function();
      definitions.update_file(test_file, [def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      expect(call_graph.nodes.get(def.symbol_id)?.is_test).toBe(true);
    });

    it("marks callables in source files with is_test false", () => {
      const src_file = "widget.ts" as FilePath;
      const location = {
        file_path: src_file,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      };
      const def: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("render_widget" as SymbolName, location),
        name: "render_widget" as SymbolName,
        defining_scope_id: `scope:${src_file}:module` as ScopeId,
        location,
        is_exported: true,
        signature: { parameters: [] },
        body_scope_id:
          `scope:${src_file}:function:render_widget:1:0` as ScopeId,
      };
      definitions.update_file(src_file, [def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      expect(call_graph.nodes.get(def.symbol_id)?.is_test).toBe(false);
    });

    it("excludes test-file callables from entry points by default", () => {
      const def = test_file_function();
      definitions.update_file(test_file, [def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      expect(call_graph.nodes.has(def.symbol_id)).toBe(true);
      expect(call_graph.entry_points).not.toContain(def.symbol_id);
      expect(call_graph.entry_points.length).toBe(0);
    });

    it("includes test-file callables as entry points when include_tests is set", () => {
      const def = test_file_function();
      definitions.update_file(test_file, [def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages, {
        include_tests: true,
      });

      expect(call_graph.entry_points).toContain(def.symbol_id);
      expect(call_graph.entry_points.length).toBe(1);
    });
  });

  describe("candidate-set invariance over a complete corpus", () => {
    // Indexing a test file contributes its call edges and zero candidates. That
    // invariance is why scope belongs at candidacy (`include_tests`) and never
    // at discovery: dropping the file at discovery would delete the edge too.
    let temp_dir: string;

    beforeEach(async () => {
      temp_dir = await mkdtemp(join(tmpdir(), "ariadne-candidate-set-"));
    });

    afterEach(async () => {
      await rm(temp_dir, { recursive: true, force: true });
    });

    async function project_with_test_caller(): Promise<Project> {
      const widget = join(temp_dir, "widget.ts");
      const widget_test = join(temp_dir, "widget.test.ts");
      const widget_source = "export function render_widget() {\n  return 1;\n}\n";
      const test_source = [
        "import { render_widget } from \"./widget\";",
        "",
        "export function test_fn() {",
        "  return render_widget();",
        "}",
        "",
      ].join("\n");
      await writeFile(widget, widget_source, "utf8");
      await writeFile(widget_test, test_source, "utf8");

      const project = new Project();
      await project.initialize(temp_dir as FilePath);
      project.update_file(widget as FilePath, widget_source);
      project.update_file(widget_test as FilePath, test_source);
      return project;
    }

    function entry_point_names(call_graph: CallGraph): string[] {
      return call_graph.entry_points
        .map((id) => call_graph.nodes.get(id)?.name as string)
        .sort();
    }

    /**
     * The names `caller_name`'s calls resolve to. A bare import is enough to
     * keep a symbol out of the entry-point set, so the entry-point assertions
     * below cannot by themselves tell an edge from an import — this reads the
     * edge.
     */
    function resolved_call_targets(call_graph: CallGraph, caller_name: string): string[] {
      const caller = [...call_graph.nodes.values()].find((n) => n.name === caller_name);
      if (caller === undefined) {
        throw new Error(`expected a call-graph node named ${caller_name}`);
      }
      const targets = new Set(
        caller.enclosed_calls
          .flatMap((c) => c.resolutions.map((r) => r.symbol_id))
          .map((symbol_id) => call_graph.nodes.get(symbol_id)?.name as string)
          .filter((n) => n !== undefined),
      );
      return [...targets].sort();
    }

    it("yields no entry points when a test file is the only caller", async () => {
      const project = await project_with_test_caller();

      const call_graph = trace_call_graph(
        project.definitions,
        project.resolutions,
        project.get_languages(),
        { include_tests: false },
      );

      expect(entry_point_names(call_graph)).toEqual([]);
    });

    it("yields only the test callable itself when include_tests is set", async () => {
      const project = await project_with_test_caller();

      const call_graph = trace_call_graph(
        project.definitions,
        project.resolutions,
        project.get_languages(),
        { include_tests: true },
      );

      expect(entry_point_names(call_graph)).toEqual(["test_fn"]);
    });

    it("carries the test file's call edge into the graph", async () => {
      const project = await project_with_test_caller();

      const call_graph = trace_call_graph(
        project.definitions,
        project.resolutions,
        project.get_languages(),
        { include_tests: true },
      );

      expect(resolved_call_targets(call_graph, "test_fn")).toEqual(["render_widget"]);
    });
  });

  describe("language identity comes from the threaded map", () => {
    function python_function(file_path: FilePath): FunctionDefinition {
      const location = {
        file_path,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 0,
      };
      return {
        kind: "function",
        symbol_id: function_symbol("helper" as SymbolName, location),
        name: "helper" as SymbolName,
        defining_scope_id: `scope:${file_path}:module` as ScopeId,
        location,
        is_exported: false,
        signature: { parameters: [] },
        body_scope_id: `scope:${file_path}:function:helper:1:0` as ScopeId,
      };
    }

    it("applies Python test-file conventions to a Python file (no silent typescript default)", () => {
      const py_test_file = "helpers_test.py" as FilePath;
      const def = python_function(py_test_file);
      definitions.update_file(py_test_file, [def]);
      const py_languages = new Map<FilePath, Language>([
        [py_test_file, "python"],
      ]);

      const call_graph = trace_call_graph(definitions, resolutions, py_languages);

      expect(call_graph.nodes.get(def.symbol_id)?.is_test).toBe(true);
    });

    it("follows the map when it disagrees with the path (language is threaded, not re-derived)", () => {
      // A .py-suffixed path registered as typescript: Python test-file
      // conventions must NOT apply, proving the path plays no part.
      const py_test_file = "helpers_test.py" as FilePath;
      const def = python_function(py_test_file);
      definitions.update_file(py_test_file, [def]);
      const disagreeing = new Map<FilePath, Language>([
        [py_test_file, "typescript"],
      ]);

      const call_graph = trace_call_graph(definitions, resolutions, disagreeing);

      expect(call_graph.nodes.get(def.symbol_id)?.is_test).toBe(false);
    });

    it("throws when a callable's file has no recorded language", () => {
      const orphan_file = "orphan.py" as FilePath;
      const def = python_function(orphan_file);
      definitions.update_file(orphan_file, [def]);

      expect(() =>
        trace_call_graph(definitions, resolutions, new Map())
      ).toThrow(
        "No language recorded for orphan.py — every callable definition must come from a parsed file"
      );
    });
  });

  describe("Python dunder methods (raw trace_call_graph; classification happens in enrich_call_graph)", () => {
    const python_file = "test.py" as FilePath;
    const python_scope = `scope:${python_file}:module` as ScopeId;

    it("includes framework-invoked dunder methods in raw entry points (classifier filters later)", () => {
      // Create __str__ method (framework-invoked, should be filtered)
      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: python_file,
        start_line: 1,
        start_column: 0,
        end_line: 20,
        end_column: 0,
      });

      const str_method_id = method_symbol("__str__" as SymbolName, {
        file_path: python_file,
        start_line: 2,
        start_column: 4,
        end_line: 4,
        end_column: 0,
      });

      const str_method: MethodDefinition = {
        kind: "method",
        symbol_id: str_method_id,
        name: "__str__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 2,
          start_column: 4,
          end_line: 4,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__str__:2:4` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 1,
          start_column: 0,
          end_line: 20,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [str_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(python_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // __str__ should be in nodes (it has a body)
      expect(call_graph.nodes.has(str_method_id)).toBe(true);

      // The dunder filter is enforced by enrich_call_graph (via the
      // py-dunder-protocol permanent registry rule), not by trace_call_graph;
      // the raw call graph surfaces all uncalled callables.
      expect(call_graph.entry_points).toContain(str_method_id);
      expect(call_graph.entry_points.length).toBe(1);
    });

    it("includes __init__ in entry points (resolver tracks it via constructor calls)", () => {
      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: python_file,
        start_line: 1,
        start_column: 0,
        end_line: 20,
        end_column: 0,
      });

      const init_method_id = method_symbol("__init__" as SymbolName, {
        file_path: python_file,
        start_line: 2,
        start_column: 4,
        end_line: 5,
        end_column: 0,
      });

      const init_method: MethodDefinition = {
        kind: "method",
        symbol_id: init_method_id,
        name: "__init__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 2,
          start_column: 4,
          end_line: 5,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__init__:2:4` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 1,
          start_column: 0,
          end_line: 20,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [init_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(python_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // __init__ should be in nodes
      expect(call_graph.nodes.has(init_method_id)).toBe(true);

      // __init__ SHOULD be an entry point (traceable via constructor calls)
      expect(call_graph.entry_points).toContain(init_method_id);
    });

    it("includes __call__ in entry points (resolver tracks it via callable-instance calls)", () => {
      const class_id = class_symbol("Callable" as SymbolName, {
        file_path: python_file,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const call_method_id = method_symbol("__call__" as SymbolName, {
        file_path: python_file,
        start_line: 2,
        start_column: 4,
        end_line: 5,
        end_column: 0,
      });

      const call_method: MethodDefinition = {
        kind: "method",
        symbol_id: call_method_id,
        name: "__call__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 2,
          start_column: 4,
          end_line: 5,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__call__:2:4` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Callable" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [call_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(python_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // __call__ should be in nodes
      expect(call_graph.nodes.has(call_method_id)).toBe(true);

      // __call__ SHOULD be an entry point (traceable via instance() calls)
      expect(call_graph.entry_points).toContain(call_method_id);
    });

    it("includes multiple framework-invoked dunder methods in raw entry points", () => {
      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: python_file,
        start_line: 1,
        start_column: 0,
        end_line: 30,
        end_column: 0,
      });

      // __repr__ - framework-invoked
      const repr_method_id = method_symbol("__repr__" as SymbolName, {
        file_path: python_file,
        start_line: 2,
        start_column: 4,
        end_line: 4,
        end_column: 0,
      });

      const repr_method: MethodDefinition = {
        kind: "method",
        symbol_id: repr_method_id,
        name: "__repr__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 2,
          start_column: 4,
          end_line: 4,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__repr__:2:4` as ScopeId,
      };

      // __eq__ - framework-invoked
      const eq_method_id = method_symbol("__eq__" as SymbolName, {
        file_path: python_file,
        start_line: 5,
        start_column: 4,
        end_line: 7,
        end_column: 0,
      });

      const eq_method: MethodDefinition = {
        kind: "method",
        symbol_id: eq_method_id,
        name: "__eq__" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 5,
          start_column: 4,
          end_line: 7,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:__eq__:5:4` as ScopeId,
      };

      // Regular method - should remain
      const process_method_id = method_symbol("process" as SymbolName, {
        file_path: python_file,
        start_line: 8,
        start_column: 4,
        end_line: 10,
        end_column: 0,
      });

      const process_method: MethodDefinition = {
        kind: "method",
        symbol_id: process_method_id,
        name: "process" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 8,
          start_column: 4,
          end_line: 10,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${python_file}:method:process:8:4` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: python_scope,
        location: {
          file_path: python_file,
          start_line: 1,
          start_column: 0,
          end_line: 30,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [repr_method, eq_method, process_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(python_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // All methods should be in nodes
      expect(call_graph.nodes.has(repr_method_id)).toBe(true);
      expect(call_graph.nodes.has(eq_method_id)).toBe(true);
      expect(call_graph.nodes.has(process_method_id)).toBe(true);

      // trace_call_graph returns all uncalled callables; the dunder filter is
      // applied later by enrich_call_graph against the py-dunder-protocol
      // permanent registry rule.
      expect(call_graph.entry_points).toContain(repr_method_id);
      expect(call_graph.entry_points).toContain(eq_method_id);
      expect(call_graph.entry_points).toContain(process_method_id);
      expect(call_graph.entry_points.length).toBe(3);
    });

    it("does not classify TypeScript dunder-named methods (Python-only rule)", () => {
      // TypeScript doesn't have dunder method convention
      const ts_file = "test.ts" as FilePath;
      const ts_scope = `scope:${ts_file}:module` as ScopeId;

      const class_id = class_symbol("MyClass" as SymbolName, {
        file_path: ts_file,
        start_line: 1,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      // Hypothetical __str__ in TypeScript (unusual but valid)
      const str_method_id = method_symbol("__str__" as SymbolName, {
        file_path: ts_file,
        start_line: 2,
        start_column: 2,
        end_line: 4,
        end_column: 0,
      });

      const str_method: MethodDefinition = {
        kind: "method",
        symbol_id: str_method_id,
        name: "__str__" as SymbolName,
        defining_scope_id: ts_scope,
        location: {
          file_path: ts_file,
          start_line: 2,
          start_column: 2,
          end_line: 4,
          end_column: 0,
        },
        parameters: [],
        body_scope_id: `scope:${ts_file}:method:__str__:2:2` as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: ts_scope,
        location: {
          file_path: ts_file,
          start_line: 1,
          start_column: 0,
          end_line: 10,
          end_column: 0,
        },
        is_exported: false,
        extends: [],
        methods: [str_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(ts_file, [class_def]);

      const call_graph = trace_call_graph(definitions, resolutions, languages);

      // In TypeScript, __str__ should remain an entry point (not filtered)
      expect(call_graph.nodes.has(str_method_id)).toBe(true);
      expect(call_graph.entry_points).toContain(str_method_id);
    });
  });
});
