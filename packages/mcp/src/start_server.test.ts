import { describe, it, expect, vi, beforeEach } from "vitest";

import { start_server } from "./start_server";
import { ProjectManager } from "./project_manager";
import { register_tool_groups } from "./tools/tool_registry";
import { is_analytics_enabled, init_analytics } from "./analytics/analytics";

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    server: { oninitialized: null, getClientVersion: vi.fn() },
    connect: vi.fn(),
  })),
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

vi.mock("./project_manager", () => ({
  ProjectManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    load_all_files: vi.fn(),
    is_watching: vi.fn().mockReturnValue(false),
  })),
}));

vi.mock("./logger", () => ({
  initialize_logger: vi.fn(),
  log_info: vi.fn(),
}));

vi.mock("./analytics/analytics", () => ({
  is_analytics_enabled: vi.fn().mockReturnValue(false),
  init_analytics: vi.fn(),
  record_session_client_info: vi.fn(),
}));

vi.mock("./tools/tool_registry", () => ({
  register_tool_groups: vi.fn(),
}));

vi.mock("./tools/core/tool_group", () => ({
  CORE_TOOL_GROUP: { group_name: "core", description: "Core tools", tools: [] },
}));

describe("start_server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize project manager with given path and watch setting", async () => {
    await start_server({ project_path: "/test/path", watch: false });

    const pm_instance = vi.mocked(ProjectManager).mock.results[0].value;
    expect(pm_instance.initialize).toHaveBeenCalledWith({
      project_path: "/test/path",
      watch: false,
    });
    expect(pm_instance.load_all_files).toHaveBeenCalled();
  });

  it("should default watch to true when not specified", async () => {
    await start_server({ project_path: "/test/path" });

    const pm_instance = vi.mocked(ProjectManager).mock.results[0].value;
    expect(pm_instance.initialize).toHaveBeenCalledWith({
      project_path: "/test/path",
      watch: true,
    });
  });

  it("should pass toolsets to register_tool_groups as enabled_groups", async () => {
    await start_server({ project_path: "/test/path", toolsets: ["core"] });

    expect(register_tool_groups).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ enabled_groups: ["core"] }),
    );
  });

  it("should default enabled_groups to empty array when no toolsets specified", async () => {
    await start_server({ project_path: "/test/path" });

    expect(register_tool_groups).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ enabled_groups: [] }),
    );
  });

  it("should initialize analytics when enabled", async () => {
    vi.mocked(is_analytics_enabled).mockReturnValue(true);

    await start_server({ project_path: "/analytics/path" });

    expect(init_analytics).toHaveBeenCalledWith("/analytics/path");
  });

  it("should not initialize analytics when disabled", async () => {
    vi.mocked(is_analytics_enabled).mockReturnValue(false);

    await start_server({ project_path: "/test/path" });

    expect(init_analytics).not.toHaveBeenCalled();
  });

  it("should return McpServer instance", async () => {
    const result = await start_server({ project_path: "/test/path" });

    expect(result).toBeDefined();
    expect(result.connect).toBeDefined();
  });
});
