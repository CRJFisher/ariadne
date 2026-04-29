/**
 * Tests for list_entrypoints tool.
 *
 * The `entry_points` filtering happens in core (`Project.get_call_graph()`
 * filters known false positives and tests via the bundled permanent
 * registry). These tests mock that filtered output: the mock's
 * `entry_points` array reflects what core would return *after* filtering.
 *
 * `show_suppressed` is a server-level config flag (CLI / env var), not a
 * per-call argument — passed through `ListEntrypointsConfig` to the
 * `list_entrypoints` function. When true, a second call to
 * `Project.get_classified_entry_points()` sources the suppressed bucket from
 * `known_false_positives`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  build_signature,
  build_suppressed_entries,
  format_classification_tag,
  format_suppressed_section,
  list_entrypoints,
  list_entrypoints_schema,
  sort_suppressed,
  type SuppressedClassification,
  type SuppressedEntryData,
} from "./list_entrypoints";
import type { Project, ClassifyOptions } from "@ariadnejs/core";
import type {
  CallGraph,
  CallReference,
  CallableNode,
  ClassifiedEntryPoint,
  ClassifiedEntryPoints,
  ConstructorDefinition,
  FunctionDefinition,
  FilePath,
  Location,
  MethodDefinition,
  ParameterDefinition,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import { module_scope } from "@ariadnejs/types";

type MockProject = Pick<Project, "get_call_graph" | "get_classified_entry_points">;

const EMPTY_CLASSIFIED: ClassifiedEntryPoints = {
  true_entry_points: [],
  known_false_positives: [],
};

// Test fixture builders. Each returns a fully-typed value so we never need
// `as any` in the assertions or mock setup. Helper functions live next to
// the only file that uses them; if a sibling test ever needs them, lift to
// the nearest common-ancestor test file (CLAUDE.md guidance).

function make_location(
  file_path: string,
  start_line: number,
  end_line: number,
  start_column = 0,
  end_column = 1
): Location {
  return {
    file_path: file_path as FilePath,
    start_line,
    start_column,
    end_line,
    end_column,
  };
}

function make_scope_id(file_path: string, start_line: number): ScopeId {
  return module_scope(make_location(file_path, start_line, start_line));
}

interface MakeFunctionDefinitionInput {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  parameters?: readonly ParameterDefinition[];
  return_type?: string;
}

function make_function_definition(
  input: MakeFunctionDefinitionInput
): FunctionDefinition {
  const { symbol_id, name, location, parameters = [], return_type } = input;
  return {
    kind: "function",
    symbol_id,
    name: name as SymbolName,
    defining_scope_id: make_scope_id(location.file_path, location.start_line),
    location,
    is_exported: false,
    body_scope_id: make_scope_id(location.file_path, location.start_line),
    signature: {
      parameters,
      return_type: return_type as SymbolName | undefined,
    },
  };
}

interface MakeMethodDefinitionInput {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  parameters?: readonly ParameterDefinition[];
  return_type?: string;
}

function make_method_definition(
  input: MakeMethodDefinitionInput
): MethodDefinition {
  const { symbol_id, name, location, parameters = [], return_type } = input;
  return {
    kind: "method",
    symbol_id,
    name: name as SymbolName,
    defining_scope_id: make_scope_id(location.file_path, location.start_line),
    location,
    parameters,
    return_type: return_type as SymbolName | undefined,
  };
}

interface MakeConstructorDefinitionInput {
  symbol_id: SymbolId;
  name?: string;
  location: Location;
  parameters?: readonly ParameterDefinition[];
}

function make_constructor_definition(
  input: MakeConstructorDefinitionInput
): ConstructorDefinition {
  const { symbol_id, name = "constructor", location, parameters = [] } = input;
  return {
    kind: "constructor",
    symbol_id,
    name: name as SymbolName,
    defining_scope_id: make_scope_id(location.file_path, location.start_line),
    location,
    parameters,
    body_scope_id: make_scope_id(location.file_path, location.start_line),
  };
}

interface MakeFunctionNodeInput {
  symbol_id: SymbolId;
  name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  is_test?: boolean;
  parameters?: readonly ParameterDefinition[];
  return_type?: string;
  enclosed_calls?: readonly CallReference[];
}

function make_function_node(input: MakeFunctionNodeInput): CallableNode {
  const {
    symbol_id,
    name,
    file_path,
    start_line,
    end_line,
    is_test = false,
    parameters = [],
    return_type = "void",
    enclosed_calls = [],
  } = input;
  const location = make_location(file_path, start_line, end_line);
  const definition = make_function_definition({
    symbol_id,
    name,
    location,
    parameters,
    return_type,
  });
  return {
    symbol_id,
    name: name as SymbolName,
    definition,
    location,
    enclosed_calls,
    is_test,
  };
}

interface MakeMethodNodeInput {
  symbol_id: SymbolId;
  name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  parameters?: readonly ParameterDefinition[];
  return_type?: string;
}

function make_method_node(input: MakeMethodNodeInput): CallableNode {
  const {
    symbol_id,
    name,
    file_path,
    start_line,
    end_line,
    parameters = [],
    return_type,
  } = input;
  const location = make_location(file_path, start_line, end_line);
  const definition = make_method_definition({
    symbol_id,
    name,
    location,
    parameters,
    return_type,
  });
  return {
    symbol_id,
    name: name as SymbolName,
    definition,
    location,
    enclosed_calls: [],
    is_test: false,
  };
}

interface MakeConstructorNodeInput {
  symbol_id: SymbolId;
  file_path: string;
  start_line: number;
  end_line: number;
  parameters?: readonly ParameterDefinition[];
}

function make_constructor_node(input: MakeConstructorNodeInput): CallableNode {
  const { symbol_id, file_path, start_line, end_line, parameters = [] } = input;
  const location = make_location(file_path, start_line, end_line);
  const definition = make_constructor_definition({
    symbol_id,
    location,
    parameters,
  });
  return {
    symbol_id,
    name: "constructor" as SymbolName,
    definition,
    location,
    enclosed_calls: [],
    is_test: false,
  };
}

function make_parameter(
  name: string,
  type: string | undefined,
  parent_location: Location
): ParameterDefinition {
  return {
    kind: "parameter",
    symbol_id: `parameter:${parent_location.file_path}:${parent_location.start_line}:0:0:0:${name}` as SymbolId,
    name: name as SymbolName,
    defining_scope_id: make_scope_id(parent_location.file_path, parent_location.start_line),
    location: parent_location,
    type: type as SymbolName | undefined,
  };
}

function make_resolved_call(
  caller_location: Location,
  callee_name: string,
  callee_id: SymbolId
): CallReference {
  return {
    name: callee_name as SymbolName,
    location: caller_location,
    scope_id: make_scope_id(caller_location.file_path, caller_location.start_line),
    call_type: "function",
    resolutions: [{ symbol_id: callee_id, confidence: "high" }],
  };
}

function make_unresolved_call(
  caller_location: Location,
  callee_name: string
): CallReference {
  return {
    name: callee_name as SymbolName,
    location: caller_location,
    scope_id: make_scope_id(caller_location.file_path, caller_location.start_line),
    call_type: "function",
    resolutions: [],
  };
}

describe("list_entrypoints_schema", () => {
  it("validates empty object", () => {
    const result = list_entrypoints_schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts extra properties (ignored)", () => {
    const result = list_entrypoints_schema.safeParse({ extra: "value" });
    expect(result.success).toBe(true);
  });

  it("accepts include_tests boolean", () => {
    expect(
      list_entrypoints_schema.safeParse({ include_tests: true }).success
    ).toBe(true);
    expect(
      list_entrypoints_schema.safeParse({ include_tests: false }).success
    ).toBe(true);
  });

  it("accepts files array", () => {
    const result = list_entrypoints_schema.safeParse({
      files: ["src/main.ts", "src/utils.ts"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts folders array", () => {
    const result = list_entrypoints_schema.safeParse({
      folders: ["src", "lib"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts combined files and folders", () => {
    const result = list_entrypoints_schema.safeParse({
      files: ["src/main.ts"],
      folders: ["lib"],
      include_tests: false,
    });
    expect(result.success).toBe(true);
  });

  it("does not accept show_suppressed on the per-call schema", () => {
    // `show_suppressed` is a server-level config flag, not a per-request
    // argument. Confirm the schema does not surface it: parsed output
    // should not carry `show_suppressed`. (Zod ignores unknown keys, so
    // safeParse still succeeds — what matters is that the parsed shape
    // omits the field.)
    const parsed = list_entrypoints_schema.parse({ show_suppressed: true });
    expect("show_suppressed" in parsed).toBe(false);
  });
});

describe("list_entrypoints", () => {
  let mock_project: MockProject;

  beforeEach(() => {
    mock_project = {
      get_call_graph: vi.fn(),
      get_classified_entry_points: vi.fn().mockReturnValue(EMPTY_CLASSIFIED),
    };
  });

  it("returns message when no entry points found", async () => {
    const mock_call_graph: CallGraph = {
      nodes: new Map(),
      entry_points: [],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project);

    expect(result).toBe(
      "No entry points found (all functions are called by other functions)"
    );
  });

  it("lists entry points with their tree sizes", async () => {
    const node_id = "function:test.ts:10:0:20:1:test_func" as SymbolId;
    const location = make_location("test.ts", 10, 20);
    const node: CallableNode = {
      symbol_id: node_id,
      name: "test_func" as SymbolName,
      definition: make_function_definition({
        symbol_id: node_id,
        name: "test_func",
        location,
        parameters: [make_parameter("x", "number", location)],
        return_type: "void",
      }),
      location,
      enclosed_calls: [],
      is_test: false,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[node_id, node]]),
      entry_points: [node_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project);

    expect(result).toContain("Entry Points (by call tree size):");
    expect(result).toContain("test_func(x: number): void");
    expect(result).toContain("Location: test.ts:10");
    expect(result).toContain("Ref: test.ts:10#test_func");
    expect(result).toContain("Total: 1 entry point");
  });

  it("includes Ref line for companion tool integration", async () => {
    const node_id = "function:src/handlers.ts:15:0:42:1:handle_request" as SymbolId;
    const location = make_location("src/handlers.ts", 15, 42);
    const node: CallableNode = {
      symbol_id: node_id,
      name: "handle_request" as SymbolName,
      definition: make_function_definition({
        symbol_id: node_id,
        name: "handle_request",
        location,
        parameters: [make_parameter("req", "Request", location)],
        return_type: "Promise<void>",
      }),
      location,
      enclosed_calls: [],
      is_test: false,
    };

    const mock_call_graph: CallGraph = {
      nodes: new Map([[node_id, node]]),
      entry_points: [node_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project);

    expect(result).toContain("Ref: src/handlers.ts:15#handle_request");
  });

  it("sorts entry points by tree size descending", async () => {
    const small_id = "function:test.ts:1:0:5:1:small_func" as SymbolId;
    const large_id = "function:test.ts:11:0:20:1:large_func" as SymbolId;
    const called_id = "function:test.ts:6:0:10:1:called_func" as SymbolId;

    const small_node = make_function_node({
      symbol_id: small_id,
      name: "small_func",
      file_path: "test.ts",
      start_line: 1,
      end_line: 5,
    });
    const called_node = make_function_node({
      symbol_id: called_id,
      name: "called_func",
      file_path: "test.ts",
      start_line: 6,
      end_line: 10,
    });
    const large_loc = make_location("test.ts", 11, 20);
    const large_node = make_function_node({
      symbol_id: large_id,
      name: "large_func",
      file_path: "test.ts",
      start_line: 11,
      end_line: 20,
      enclosed_calls: [make_resolved_call(large_loc, "called_func", called_id)],
    });

    const mock_call_graph: CallGraph = {
      nodes: new Map([
        [small_id, small_node],
        [large_id, large_node],
        [called_id, called_node],
      ]),
      entry_points: [small_id, large_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project);

    const large_index = result.indexOf("large_func");
    const small_index = result.indexOf("small_func");
    expect(large_index).toBeLessThan(small_index);
  });

  it("handles methods with parameters", async () => {
    const method_id = "method:class.ts:5:2:10:3:myMethod" as SymbolId;
    const method_loc = make_location("class.ts", 5, 10, 2, 3);
    const method_node = make_method_node({
      symbol_id: method_id,
      name: "myMethod",
      file_path: "class.ts",
      start_line: 5,
      end_line: 10,
      parameters: [
        make_parameter("self", "MyClass", method_loc),
        make_parameter("value", "string", method_loc),
      ],
      return_type: "boolean",
    });

    const mock_call_graph: CallGraph = {
      nodes: new Map([[method_id, method_node]]),
      entry_points: [method_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project);

    expect(result).toContain("myMethod(self: MyClass, value: string): boolean");
  });

  it("handles constructors", async () => {
    const ctor_id = "constructor:class.ts:2:2:4:3:constructor" as SymbolId;
    const ctor_loc = make_location("class.ts", 2, 4, 2, 3);
    const ctor_node = make_constructor_node({
      symbol_id: ctor_id,
      file_path: "class.ts",
      start_line: 2,
      end_line: 4,
      parameters: [make_parameter("value", "number", ctor_loc)],
    });

    const mock_call_graph: CallGraph = {
      nodes: new Map([[ctor_id, ctor_node]]),
      entry_points: [ctor_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project);

    expect(result).toContain("constructor(value: number)");
  });

  it("counts unresolved calls", async () => {
    const func_id = "function:test.ts:1:0:5:1:test_func" as SymbolId;
    const func_loc = make_location("test.ts", 1, 5);
    const func_node = make_function_node({
      symbol_id: func_id,
      name: "test_func",
      file_path: "test.ts",
      start_line: 1,
      end_line: 5,
      enclosed_calls: [make_unresolved_call(func_loc, "external_func")],
    });

    const mock_call_graph: CallGraph = {
      nodes: new Map([[func_id, func_node]]),
      entry_points: [func_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project);

    expect(result).toContain("+ 1 unresolved");
  });

  it("marks test functions with [TEST] indicator when core returns them", async () => {
    // Filtering happens in core: include_tests=true means core returns test
    // entries in `entry_points`. The MCP just renders what core gives it.
    const test_func_id = "function:math.test.ts:1:0:5:1:test_add" as SymbolId;
    const test_node = make_function_node({
      symbol_id: test_func_id,
      name: "test_add",
      file_path: "math.test.ts",
      start_line: 1,
      end_line: 5,
      is_test: true,
    });

    const mock_call_graph: CallGraph = {
      nodes: new Map([[test_func_id, test_node]]),
      entry_points: [test_func_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project, { include_tests: true });

    expect(result).toContain("[TEST]");
    expect(result).toContain("test_add(): void");
  });

  it("forwards include_tests=false to core and renders only what core returns", async () => {
    // Filtering is no longer the MCP's responsibility — core returns the
    // already-filtered list. The MCP must therefore *forward* include_tests
    // unchanged. We verify both the forwarding (spy) and the rendering.
    const prod_id = "function:app.ts:1:0:10:1:main" as SymbolId;
    const prod_node = make_function_node({
      symbol_id: prod_id,
      name: "main",
      file_path: "app.ts",
      start_line: 1,
      end_line: 10,
    });

    const mock_call_graph: CallGraph = {
      nodes: new Map([[prod_id, prod_node]]),
      entry_points: [prod_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project, { include_tests: false });

    expect(mock_project.get_call_graph).toHaveBeenCalledWith({
      include_tests: false,
    });
    expect(result).toContain("main(): void");
    expect(result).not.toContain("[TEST]");
    expect(result).toContain("Total: 1 entry point");
  });

  it("forwards include_tests=true to core (default include_tests is false)", async () => {
    // Default behavior: when caller omits include_tests, the MCP forwards
    // false. With include_tests: true, the MCP forwards true. The MCP itself
    // does not filter `is_test`.
    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map(),
      entry_points: [],
    });

    await list_entrypoints(mock_project);
    expect(mock_project.get_call_graph).toHaveBeenLastCalledWith({
      include_tests: false,
    });

    await list_entrypoints(mock_project, { include_tests: true });
    expect(mock_project.get_call_graph).toHaveBeenLastCalledWith({
      include_tests: true,
    });
  });

  it("renders test entries when core surfaces them under include_tests=true", async () => {
    // When include_tests is true, core surfaces test entry points. The MCP
    // renders them with the [TEST] tag and includes them in the total.
    const prod_id = "function:app.ts:1:0:10:1:main" as SymbolId;
    const test_id = "function:app.test.ts:1:0:5:1:test_main" as SymbolId;
    const prod_node = make_function_node({
      symbol_id: prod_id,
      name: "main",
      file_path: "app.ts",
      start_line: 1,
      end_line: 10,
    });
    const test_node = make_function_node({
      symbol_id: test_id,
      name: "test_main",
      file_path: "app.test.ts",
      start_line: 1,
      end_line: 5,
      is_test: true,
    });

    const mock_call_graph: CallGraph = {
      nodes: new Map([
        [prod_id, prod_node],
        [test_id, test_node],
      ]),
      entry_points: [prod_id, test_id],
    };
    vi.mocked(mock_project.get_call_graph).mockReturnValue(mock_call_graph);

    const result = await list_entrypoints(mock_project, { include_tests: true });

    expect(result).toContain("main(): void");
    expect(result).toContain("test_main(): void");
    expect(result).toContain("[TEST]");
    expect(result).toContain("Total: 2 entry points");
  });
});

describe("list_entrypoints — show_suppressed (server-level config)", () => {
  let mock_project: MockProject;

  beforeEach(() => {
    mock_project = {
      get_call_graph: vi.fn(),
      get_classified_entry_points: vi.fn(),
    };
  });

  it("does not call get_classified_entry_points when show_suppressed is false (default)", async () => {
    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map(),
      entry_points: [],
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue(
      EMPTY_CLASSIFIED
    );

    // Default config (when omitted) is { show_suppressed: false }.
    await list_entrypoints(mock_project, {});

    expect(mock_project.get_classified_entry_points).not.toHaveBeenCalled();
  });

  it("does not append a Suppressed section when show_suppressed is false", async () => {
    const id = "function:app.ts:1:0:5:1:main" as SymbolId;
    const node = make_function_node({
      symbol_id: id,
      name: "main",
      file_path: "app.ts",
      start_line: 1,
      end_line: 5,
    });
    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map([[id, node]]),
      entry_points: [id],
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue(
      EMPTY_CLASSIFIED
    );

    const result = await list_entrypoints(
      mock_project,
      {},
      { show_suppressed: false }
    );

    expect(result).not.toContain("Suppressed");
  });

  it("appends a Suppressed section when show_suppressed is true", async () => {
    const main_id = "function:app.py:1:0:5:1:main" as SymbolId;
    const dunder_id = "function:models.py:12:0:14:1:__str__" as SymbolId;

    const main_node = make_function_node({
      symbol_id: main_id,
      name: "main",
      file_path: "app.py",
      start_line: 1,
      end_line: 5,
    });
    const dunder_node = make_function_node({
      symbol_id: dunder_id,
      name: "__str__",
      file_path: "models.py",
      start_line: 12,
      end_line: 14,
    });

    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map([
        [main_id, main_node],
        [dunder_id, dunder_node],
      ]),
      entry_points: [main_id], // suppressed dunder is filtered out by core
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue({
      true_entry_points: [
        { symbol_id: main_id, classification: { kind: "true_entry_point" } },
      ],
      known_false_positives: [
        {
          symbol_id: dunder_id,
          classification: { kind: "dunder_protocol", protocol: "__str__" },
        },
      ],
    });

    const result = await list_entrypoints(
      mock_project,
      {},
      { show_suppressed: true }
    );

    // Default section unchanged
    expect(result).toContain("Entry Points (by call tree size):");
    expect(result).toContain("main(): void");
    expect(result).toContain("Total: 1 entry point");

    // Suppressed section present, delimited, and listing the dunder
    expect(result).toContain("Suppressed (known false positives):");
    expect(result).toContain("__str__(): void [dunder_protocol: __str__]");
    expect(result).toContain("Ref: models.py:12#__str__");
    expect(result).toContain("Total: 1 suppressed");
  });

  it("renders framework_invoked classification with [group_id: framework] tag", async () => {
    const main_id = "function:app.py:1:0:5:1:main" as SymbolId;
    const route_id = "function:routes.py:20:0:25:1:index_route" as SymbolId;

    const main_node = make_function_node({
      symbol_id: main_id,
      name: "main",
      file_path: "app.py",
      start_line: 1,
      end_line: 5,
    });
    const route_node = make_function_node({
      symbol_id: route_id,
      name: "index_route",
      file_path: "routes.py",
      start_line: 20,
      end_line: 25,
    });

    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map([
        [main_id, main_node],
        [route_id, route_node],
      ]),
      entry_points: [main_id],
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue({
      true_entry_points: [
        { symbol_id: main_id, classification: { kind: "true_entry_point" } },
      ],
      known_false_positives: [
        {
          symbol_id: route_id,
          classification: {
            kind: "framework_invoked",
            group_id: "flask-route-decorator",
            framework: "flask",
          },
        },
      ],
    });

    const result = await list_entrypoints(
      mock_project,
      {},
      { show_suppressed: true }
    );

    expect(result).toContain("Suppressed (known false positives):");
    expect(result).toContain("index_route(): void [flask-route-decorator: flask]");
    expect(result).toContain("Ref: routes.py:20#index_route");
  });

  it("renders mixed classification kinds in suppressed section", async () => {
    const main_id = "function:app.py:1:0:5:1:main" as SymbolId;
    const dunder_id = "function:models.py:30:0:32:1:__repr__" as SymbolId;
    const route_id = "function:routes.py:20:0:25:1:index_route" as SymbolId;
    const test_only_id = "function:test/util.py:40:0:45:1:helper" as SymbolId;
    const indirect_id = "function:events.py:50:0:55:1:callback" as SymbolId;

    const indirect_loc = make_location("events.py", 50, 55);

    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map([
        [main_id, make_function_node({ symbol_id: main_id, name: "main", file_path: "app.py", start_line: 1, end_line: 5 })],
        [dunder_id, make_function_node({ symbol_id: dunder_id, name: "__repr__", file_path: "models.py", start_line: 30, end_line: 32 })],
        [route_id, make_function_node({ symbol_id: route_id, name: "index_route", file_path: "routes.py", start_line: 20, end_line: 25 })],
        [test_only_id, make_function_node({ symbol_id: test_only_id, name: "helper", file_path: "test/util.py", start_line: 40, end_line: 45 })],
        [indirect_id, make_function_node({ symbol_id: indirect_id, name: "callback", file_path: "events.py", start_line: 50, end_line: 55 })],
      ]),
      entry_points: [main_id],
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue({
      true_entry_points: [
        { symbol_id: main_id, classification: { kind: "true_entry_point" } },
      ],
      known_false_positives: [
        {
          symbol_id: dunder_id,
          classification: { kind: "dunder_protocol", protocol: "__repr__" },
        },
        {
          symbol_id: route_id,
          classification: {
            kind: "framework_invoked",
            group_id: "flask-route-decorator",
            framework: "flask",
          },
        },
        {
          symbol_id: test_only_id,
          classification: { kind: "test_only" },
        },
        {
          symbol_id: indirect_id,
          classification: {
            kind: "indirect_only",
            via: { type: "function_reference", read_location: indirect_loc },
          },
        },
      ],
    });

    const result = await list_entrypoints(
      mock_project,
      {},
      { show_suppressed: true }
    );

    expect(result).toContain("Suppressed (known false positives):");
    expect(result).toContain("[dunder_protocol: __repr__]");
    expect(result).toContain("[flask-route-decorator: flask]");
    expect(result).toContain("[test_only]");
    expect(result).toContain("[indirect_only: function_reference]");
    expect(result).toContain("Total: 4 suppressed");
  });

  it("renders '(none)' under Suppressed when no false positives exist", async () => {
    const id = "function:app.py:1:0:5:1:main" as SymbolId;
    const node = make_function_node({
      symbol_id: id,
      name: "main",
      file_path: "app.py",
      start_line: 1,
      end_line: 5,
    });
    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map([[id, node]]),
      entry_points: [id],
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue({
      true_entry_points: [
        { symbol_id: id, classification: { kind: "true_entry_point" } },
      ],
      known_false_positives: [],
    });

    const result = await list_entrypoints(
      mock_project,
      {},
      { show_suppressed: true }
    );

    expect(result).toContain("Suppressed (known false positives):");
    expect(result).toContain("(none)");
  });

  it("forwards include_tests to get_classified_entry_points", async () => {
    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map(),
      entry_points: [],
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue(
      EMPTY_CLASSIFIED
    );

    await list_entrypoints(
      mock_project,
      { include_tests: true },
      { show_suppressed: true }
    );

    const call_arg = vi.mocked(mock_project.get_classified_entry_points).mock.calls[0][0];
    expect(call_arg).toEqual<ClassifyOptions>({ include_tests: true });
  });

  it("sorts suppressed entries deterministically by file_path, line, name", async () => {
    const a_id = "function:z.py:5:0:6:1:zzz" as SymbolId;
    const b_id = "function:a.py:10:0:11:1:aaa" as SymbolId;
    const c_id = "function:m.py:1:0:2:1:mmm" as SymbolId;

    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map([
        [a_id, make_function_node({ symbol_id: a_id, name: "zzz", file_path: "z.py", start_line: 5, end_line: 6 })],
        [b_id, make_function_node({ symbol_id: b_id, name: "aaa", file_path: "a.py", start_line: 10, end_line: 11 })],
        [c_id, make_function_node({ symbol_id: c_id, name: "mmm", file_path: "m.py", start_line: 1, end_line: 2 })],
      ]),
      entry_points: [],
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue({
      true_entry_points: [],
      known_false_positives: [
        { symbol_id: a_id, classification: { kind: "test_only" } },
        { symbol_id: b_id, classification: { kind: "test_only" } },
        { symbol_id: c_id, classification: { kind: "test_only" } },
      ],
    });

    const result = await list_entrypoints(
      mock_project,
      {},
      { show_suppressed: true }
    );

    const a_idx = result.indexOf("zzz()");
    const b_idx = result.indexOf("aaa()");
    const c_idx = result.indexOf("mmm()");

    // Alphabetical by file_path: a.py < m.py < z.py
    expect(b_idx).toBeLessThan(c_idx);
    expect(c_idx).toBeLessThan(a_idx);
  });

  it("skips suppressed entries whose node is not on the call graph", async () => {
    const ghost_id = "function:nowhere.py:0:0:0:0:ghost" as SymbolId;
    vi.mocked(mock_project.get_call_graph).mockReturnValue({
      nodes: new Map(), // empty — ghost is not present
      entry_points: [],
    });
    vi.mocked(mock_project.get_classified_entry_points).mockReturnValue({
      true_entry_points: [],
      known_false_positives: [
        { symbol_id: ghost_id, classification: { kind: "test_only" } },
      ],
    });

    const result = await list_entrypoints(
      mock_project,
      {},
      { show_suppressed: true }
    );

    expect(result).toContain("Suppressed (known false positives):");
    expect(result).toContain("(none)");
  });
});

describe("format_classification_tag", () => {
  it("formats framework_invoked with [group_id: framework]", () => {
    const tag = format_classification_tag({
      kind: "framework_invoked",
      group_id: "flask-route-decorator",
      framework: "flask",
    });
    expect(tag).toEqual("[flask-route-decorator: flask]");
  });

  it("formats dunder_protocol with [dunder_protocol: <protocol>]", () => {
    const tag = format_classification_tag({
      kind: "dunder_protocol",
      protocol: "__str__",
    });
    expect(tag).toEqual("[dunder_protocol: __str__]");
  });

  it("formats test_only as bare [test_only]", () => {
    const tag = format_classification_tag({ kind: "test_only" });
    expect(tag).toEqual("[test_only]");
  });

  it("formats indirect_only with [indirect_only: <via.type>] for function_reference", () => {
    const tag = format_classification_tag({
      kind: "indirect_only",
      via: { type: "function_reference", read_location: make_location("e.py", 1, 1) },
    });
    expect(tag).toEqual("[indirect_only: function_reference]");
  });

  it("formats indirect_only with [indirect_only: <via.type>] for collection_read", () => {
    const tag = format_classification_tag({
      kind: "indirect_only",
      via: {
        type: "collection_read",
        collection_id: "variable:foo.py:1:0:1:1:handlers" as SymbolId,
        read_location: make_location("foo.py", 1, 1),
      },
    });
    expect(tag).toEqual("[indirect_only: collection_read]");
  });
});

describe("sort_suppressed", () => {
  it("sorts by file_path, then start_line, then name", () => {
    const make_entry = (
      symbol_id: SymbolId,
      name: string,
      file_path: string,
      start_line: number,
      classification: SuppressedClassification = { kind: "test_only" }
    ): SuppressedEntryData => ({
      node: make_function_node({
        symbol_id,
        name,
        file_path,
        start_line,
        end_line: start_line + 1,
      }),
      classification,
    });

    const a = make_entry("function:z.py:5:0:6:1:zzz" as SymbolId, "zzz", "z.py", 5);
    const b = make_entry("function:a.py:10:0:11:1:aaa" as SymbolId, "aaa", "a.py", 10);
    const c = make_entry("function:a.py:5:0:6:1:bbb" as SymbolId, "bbb", "a.py", 5);

    const sorted = sort_suppressed([a, b, c]);

    // Expected order: a.py:5 (bbb), a.py:10 (aaa), z.py:5 (zzz)
    expect(sorted.map((e) => e.node.name)).toEqual(["bbb", "aaa", "zzz"]);
  });

  it("returns a new array (does not mutate input)", () => {
    const entries: SuppressedEntryData[] = [
      {
        node: make_function_node({
          symbol_id: "function:b.py:1:0:1:1:b" as SymbolId,
          name: "b",
          file_path: "b.py",
          start_line: 1,
          end_line: 1,
        }),
        classification: { kind: "test_only" },
      },
      {
        node: make_function_node({
          symbol_id: "function:a.py:1:0:1:1:a" as SymbolId,
          name: "a",
          file_path: "a.py",
          start_line: 1,
          end_line: 1,
        }),
        classification: { kind: "test_only" },
      },
    ];
    const original_first_name = entries[0].node.name;
    sort_suppressed(entries);
    // input order unchanged
    expect(entries[0].node.name).toEqual(original_first_name);
  });
});

describe("format_suppressed_section", () => {
  it("renders '(none)' for an empty list under the canonical header", () => {
    const text = format_suppressed_section([]);
    expect(text).toContain("Suppressed (known false positives):");
    expect(text).toContain("(none)");
    expect(text).not.toContain("Total: 0");
  });

  it("renders a single entry with signature, location, ref, and tag", () => {
    const node = make_function_node({
      symbol_id: "function:src/foo.py:12:0:14:1:__str__" as SymbolId,
      name: "__str__",
      file_path: "src/foo.py",
      start_line: 12,
      end_line: 14,
    });
    const text = format_suppressed_section([
      {
        node,
        classification: { kind: "dunder_protocol", protocol: "__str__" },
      },
    ]);
    expect(text).toContain("Suppressed (known false positives):");
    expect(text).toContain("__str__(): void [dunder_protocol: __str__]");
    expect(text).toContain("Location: src/foo.py:12");
    expect(text).toContain("Ref: src/foo.py:12#__str__");
    expect(text).toContain("Total: 1 suppressed");
  });

  it("includes a separator line above the header", () => {
    const text = format_suppressed_section([]);
    expect(text).toContain("=".repeat(60));
  });
});

describe("build_suppressed_entries", () => {
  it("attaches the call-graph node for each suppressed symbol", () => {
    const id = "function:foo.py:1:0:5:1:foo" as SymbolId;
    const node = make_function_node({
      symbol_id: id,
      name: "foo",
      file_path: "foo.py",
      start_line: 1,
      end_line: 5,
    });
    const call_graph: CallGraph = {
      nodes: new Map([[id, node]]),
      entry_points: [],
    };
    const known_false_positives: readonly ClassifiedEntryPoint[] = [
      { symbol_id: id, classification: { kind: "test_only" } },
    ];

    const entries = build_suppressed_entries(known_false_positives, call_graph);

    expect(entries).toEqual<SuppressedEntryData[]>([
      { node, classification: { kind: "test_only" } },
    ]);
  });

  it("skips suppressed entries whose node is missing from the call graph", () => {
    const id = "function:foo.py:1:0:5:1:foo" as SymbolId;
    const call_graph: CallGraph = {
      nodes: new Map(), // missing
      entry_points: [],
    };
    const entries = build_suppressed_entries(
      [{ symbol_id: id, classification: { kind: "test_only" } }],
      call_graph
    );

    expect(entries).toEqual<SuppressedEntryData[]>([]);
  });

  it("filters out 'true_entry_point' classifications defensively (should never appear by contract)", () => {
    const id = "function:foo.py:1:0:5:1:foo" as SymbolId;
    const node = make_function_node({
      symbol_id: id,
      name: "foo",
      file_path: "foo.py",
      start_line: 1,
      end_line: 5,
    });
    const call_graph: CallGraph = {
      nodes: new Map([[id, node]]),
      entry_points: [],
    };
    const entries = build_suppressed_entries(
      [{ symbol_id: id, classification: { kind: "true_entry_point" } }],
      call_graph
    );

    expect(entries).toEqual<SuppressedEntryData[]>([]);
  });

  it("returns entries sorted by (file_path, line, name)", () => {
    const a_id = "function:z.py:5:0:6:1:zzz" as SymbolId;
    const b_id = "function:a.py:1:0:2:1:aaa" as SymbolId;
    const a_node = make_function_node({
      symbol_id: a_id,
      name: "zzz",
      file_path: "z.py",
      start_line: 5,
      end_line: 6,
    });
    const b_node = make_function_node({
      symbol_id: b_id,
      name: "aaa",
      file_path: "a.py",
      start_line: 1,
      end_line: 2,
    });
    const call_graph: CallGraph = {
      nodes: new Map([
        [a_id, a_node],
        [b_id, b_node],
      ]),
      entry_points: [],
    };

    const entries = build_suppressed_entries(
      [
        { symbol_id: a_id, classification: { kind: "test_only" } },
        { symbol_id: b_id, classification: { kind: "test_only" } },
      ],
      call_graph
    );

    expect(entries.map((e) => e.node.name)).toEqual(["aaa", "zzz"]);
  });
});

describe("build_signature", () => {
  it("is exported for use by companion tools", () => {
    expect(typeof build_signature).toBe("function");
  });

  it("includes location for anonymous functions", () => {
    const location = make_location("/path/to/test.ts", 42, 50);
    const definition = make_function_definition({
      symbol_id: "function:/path/to/test.ts:42:0:50:1:<anonymous>" as SymbolId,
      name: "<anonymous>",
      location,
      return_type: "void",
    });

    const signature = build_signature(definition, {
      file_path: "/path/to/test.ts",
      start_line: 42,
    });

    expect(signature).toBe("<anonymous@test.ts:42>(): void");
  });

  it("keeps regular function names unchanged", () => {
    const location = make_location("/path/to/test.ts", 10, 20);
    const definition = make_function_definition({
      symbol_id: "function:/path/to/test.ts:10:0:20:1:myFunction" as SymbolId,
      name: "myFunction",
      location,
      parameters: [make_parameter("x", "number", location)],
      return_type: "string",
    });

    const signature = build_signature(definition, {
      file_path: "/path/to/test.ts",
      start_line: 10,
    });

    expect(signature).toBe("myFunction(x: number): string");
  });
});
