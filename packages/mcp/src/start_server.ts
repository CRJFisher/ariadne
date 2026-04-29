import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FileSystemStorage, resolve_cache_dir, initialize_logger, log_info } from "@ariadnejs/core";
import { VERSION } from "./version";
import { ProjectManager } from "./project_manager";
import {
  close_analytics,
  init_analytics,
  is_analytics_enabled,
  record_session_client_info,
} from "./analytics/analytics";
import { register_tool_groups } from "./tools/tool_registry";
import { create_core_tool_group } from "./tools/core/tool_group";

export interface AriadneMCPServerOptions {
  project_path?: string;
  transport?: "stdio";
  watch?: boolean;
  toolsets?: string[];
  /**
   * Server-level config for `list_entrypoints`: when true, every tool
   * invocation appends a "Suppressed" section with the registry-classified
   * known false positives. Set via CLI (`--show-suppressed`) or env var
   * (`ARIADNE_SHOW_SUPPRESSED=1`); defaults to false.
   */
  show_suppressed?: boolean;
}

export async function start_server(
  options: AriadneMCPServerOptions = {}
): Promise<McpServer> {
  initialize_logger();

  // Precedence: CLI > PROJECT_PATH env > cwd
  const project_path =
    options.project_path || process.env.PROJECT_PATH || process.cwd();

  // Initialize analytics if enabled
  const analytics_enabled = is_analytics_enabled();
  if (analytics_enabled) {
    init_analytics(project_path);
    process.on("exit", close_analytics);
  }

  // Create McpServer (high-level API)
  const mcp_server = new McpServer(
    { name: "ariadne-mcp", version: VERSION },
    { capabilities: { tools: {} } },
  );

  // Capture client info once MCP initialization completes
  if (analytics_enabled) {
    mcp_server.server.oninitialized = () => {
      const client = mcp_server.server.getClientVersion();
      if (client) {
        record_session_client_info(client.name, client.version);
      }
    };
  }

  // Resolve cache directory for persistence
  const cache_dir = resolve_cache_dir(project_path);
  const storage = cache_dir ? new FileSystemStorage(cache_dir) : undefined;
  if (cache_dir) {
    log_info(`Cache directory: ${cache_dir}`);
  }

  // Initialize persistent project with file watching and optional persistence
  const project_manager = new ProjectManager();
  await project_manager.initialize({
    project_path,
    watch: options.watch ?? true,
    storage,
  });
  await project_manager.load_all_files();

  log_info(
    `Ariadne MCP server initialized for: ${project_path}` +
      (project_manager.is_watching() ? " (watching for changes)" : ""),
  );

  // Build tool groups with server-level config baked in.
  const core_tool_group = create_core_tool_group({
    list_entrypoints: { show_suppressed: options.show_suppressed ?? false },
  });
  const all_tool_groups = [core_tool_group];

  // Register tool groups (filtered by --toolsets if specified)
  register_tool_groups(all_tool_groups, {
    mcp_server,
    project_manager,
    project_path,
    enabled_groups: options.toolsets ?? [],
    storage,
  });

  // Connect transport
  if (options.transport === "stdio" || !options.transport) {
    const transport = new StdioServerTransport();
    await mcp_server.connect(transport);
  }

  return mcp_server;
}
