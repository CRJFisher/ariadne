import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION } from "./version";
import { ProjectManager } from "./project_manager";
import { initialize_logger, log_info } from "./logger";
import {
  init_analytics,
  is_analytics_enabled,
  record_session_client_info,
} from "./analytics/analytics";
import { register_tool_groups } from "./tools/tool_registry";
import { CORE_TOOL_GROUP } from "./tools/core/tool_group";

/**
 * All available tool groups. Adding a new group requires one import + one entry here.
 */
const ALL_TOOL_GROUPS = [CORE_TOOL_GROUP];

export interface AriadneMCPServerOptions {
  project_path?: string;
  transport?: "stdio";
  watch?: boolean;
  toolsets?: string[];
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

  // Initialize persistent project with file watching
  const project_manager = new ProjectManager();
  await project_manager.initialize({
    project_path,
    watch: options.watch ?? true,
  });
  await project_manager.load_all_files();

  log_info(
    `Ariadne MCP server initialized for: ${project_path}` +
      (project_manager.is_watching() ? " (watching for changes)" : "")
  );

  // Register tool groups (filtered by --toolsets if specified)
  register_tool_groups(ALL_TOOL_GROUPS, {
    mcp_server,
    project_manager,
    project_path,
    enabled_groups: options.toolsets ?? [],
  });

  // Connect transport
  if (options.transport === "stdio" || !options.transport) {
    const transport = new StdioServerTransport();
    await mcp_server.connect(transport);
  }

  return mcp_server;
}
