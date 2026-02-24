import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  register_tool_groups,
  type ToolGroupDefinition,
} from "./tool_registry";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ProjectManager } from "../project_manager";
import type { Project } from "@ariadnejs/core";

import { record_tool_call } from "../analytics/analytics";
import { resolve_project } from "./resolve_project";

vi.mock("../analytics/analytics", () => ({
  record_tool_call: vi.fn(),
}));

vi.mock("./resolve_project", () => ({
  resolve_project: vi.fn(),
}));

function make_test_group(overrides?: Partial<ToolGroupDefinition>): ToolGroupDefinition {
  return {
    group_name: "test_group",
    description: "Test group",
    tools: [
      {
        name: "test_tool",
        description: "A test tool",
        input_schema: z.object({
          value: z.string().optional(),
        }),
        handler: vi.fn().mockResolvedValue("result text"),
      },
    ],
    ...overrides,
  };
}

describe("register_tool_groups", () => {
  let mock_server: McpServer;
  let mock_project_manager: ProjectManager;
  let mock_project: Project;
  let registered_tools: Map<string, { callback: (...args: unknown[]) => unknown }>;

  beforeEach(() => {
    vi.clearAllMocks();
    registered_tools = new Map();
    mock_project = {} as Project;
    mock_project_manager = {
      get_project: vi.fn().mockReturnValue(mock_project),
    } as unknown as ProjectManager;

    mock_server = {
      tool: vi.fn((_name: string, _desc: string, _schema: unknown, callback: unknown) => {
        registered_tools.set(_name, { callback: callback as (...args: unknown[]) => unknown });
      }),
    } as unknown as McpServer;

    vi.mocked(resolve_project).mockResolvedValue(mock_project);
  });

  it("should register all tools from all groups when enabled_groups is empty", () => {
    const group_a = make_test_group({ group_name: "a", tools: [
      { name: "tool_a", description: "A", input_schema: z.object({}), handler: vi.fn().mockResolvedValue("a") },
    ]});
    const group_b = make_test_group({ group_name: "b", tools: [
      { name: "tool_b", description: "B", input_schema: z.object({}), handler: vi.fn().mockResolvedValue("b") },
    ]});

    register_tool_groups([group_a, group_b], {
      mcp_server: mock_server,
      project_manager: mock_project_manager,
      project_path: "/project",
      enabled_groups: [],
    });

    expect(mock_server.tool).toHaveBeenCalledTimes(2);
    expect(registered_tools.has("tool_a")).toBe(true);
    expect(registered_tools.has("tool_b")).toBe(true);
  });

  it("should register only tools from enabled groups", () => {
    const group_a = make_test_group({ group_name: "a", tools: [
      { name: "tool_a", description: "A", input_schema: z.object({}), handler: vi.fn().mockResolvedValue("a") },
    ]});
    const group_b = make_test_group({ group_name: "b", tools: [
      { name: "tool_b", description: "B", input_schema: z.object({}), handler: vi.fn().mockResolvedValue("b") },
    ]});

    register_tool_groups([group_a, group_b], {
      mcp_server: mock_server,
      project_manager: mock_project_manager,
      project_path: "/project",
      enabled_groups: ["a"],
    });

    expect(mock_server.tool).toHaveBeenCalledTimes(1);
    expect(registered_tools.has("tool_a")).toBe(true);
    expect(registered_tools.has("tool_b")).toBe(false);
  });

  it("should call handler and record analytics on success", async () => {
    const group = make_test_group();

    register_tool_groups([group], {
      mcp_server: mock_server,
      project_manager: mock_project_manager,
      project_path: "/project",
      enabled_groups: [],
    });

    const { callback } = registered_tools.get("test_tool")!;
    const extra = { requestId: "req-1", _meta: { "claudecode/toolUseId": "tu-1" } };
    const result = await callback({ value: "hello" }, extra);

    expect(group.tools[0].handler).toHaveBeenCalledWith(mock_project, { value: "hello" });
    expect(record_tool_call).toHaveBeenCalledTimes(1);
    const success_call = vi.mocked(record_tool_call).mock.calls[0][0];
    expect(success_call).toEqual({
      tool_name: "test_tool",
      arguments: { value: "hello" },
      duration_ms: expect.any(Number),
      success: true,
      request_id: "req-1",
      tool_use_id: "tu-1",
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "result text" }],
    });
  });

  it("should record analytics on handler error", async () => {
    const group = make_test_group();
    vi.mocked(group.tools[0].handler).mockRejectedValue(new Error("boom"));

    register_tool_groups([group], {
      mcp_server: mock_server,
      project_manager: mock_project_manager,
      project_path: "/project",
      enabled_groups: [],
    });

    const { callback } = registered_tools.get("test_tool")!;
    const extra = { requestId: "req-2" };
    const result = await callback({}, extra);

    expect(record_tool_call).toHaveBeenCalledTimes(1);
    const error_call = vi.mocked(record_tool_call).mock.calls[0][0];
    expect(error_call).toEqual({
      tool_name: "test_tool",
      arguments: {},
      duration_ms: expect.any(Number),
      success: false,
      error_message: "boom",
      request_id: "req-2",
      tool_use_id: undefined,
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "Error: boom" }],
      isError: true,
    });
  });

  it("should call resolve_project with parsed args", async () => {
    const group = make_test_group({
      tools: [{
        name: "filtered_tool",
        description: "A tool with filters",
        input_schema: z.object({
          files: z.array(z.string()).optional(),
          folders: z.array(z.string()).optional(),
        }),
        handler: vi.fn().mockResolvedValue("filtered result"),
      }],
    });

    register_tool_groups([group], {
      mcp_server: mock_server,
      project_manager: mock_project_manager,
      project_path: "/project",
      enabled_groups: [],
    });

    const { callback } = registered_tools.get("filtered_tool")!;
    await callback({ files: ["src/main.ts"] }, { requestId: "req-3" });

    expect(resolve_project).toHaveBeenCalledWith(
      { files: ["src/main.ts"] },
      mock_project_manager,
      "/project",
    );
  });
});
