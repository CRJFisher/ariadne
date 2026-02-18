import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import * as fs from "fs/promises";
import { VERSION } from "./version";
import { Project } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";
import {
  list_entrypoints,
  list_entrypoints_schema,
} from "./tools/list_entrypoints.js";
import {
  show_call_graph_neighborhood,
  show_call_graph_neighborhood_schema,
} from "./tools/show_call_graph_neighborhood.js";
import { ProjectManager } from "./project_manager";
import { find_source_files, is_supported_file } from "./file_loading";
import { initialize_logger, log_info, log_warn } from "./logger";
import {
  init_analytics,
  record_session_client_info,
  record_tool_call,
} from "./analytics/analytics";

/**
 * Options for filtered file loading
 */
export interface FileLoadOptions {
  files?: string[];
  folders?: string[];
  project_path: string;
}

/**
 * Resolve a path to absolute, relative to project_path
 */
function resolve_to_absolute(path_input: string, project_path: string): string {
  if (path.isAbsolute(path_input)) {
    return path_input;
  }
  return path.resolve(project_path, path_input);
}

/**
 * Load files based on filtering options.
 * If no files or folders specified, loads all project files.
 */
export async function load_filtered_project_files(
  project: Project,
  options: FileLoadOptions
): Promise<void> {
  const { files = [], folders = [], project_path } = options;

  // If no filters specified, load entire project
  if (files.length === 0 && folders.length === 0) {
    await load_project_files(project, project_path);
    return;
  }

  const files_to_load = new Set<string>();

  // Add explicitly specified files
  for (const file_path of files) {
    const abs_path = resolve_to_absolute(file_path, project_path);
    if (is_supported_file(abs_path)) {
      files_to_load.add(abs_path);
    }
  }

  // Expand folders to files
  for (const folder_path of folders) {
    const abs_folder = resolve_to_absolute(folder_path, project_path);
    const folder_files = await find_source_files(abs_folder, project_path);
    for (const file of folder_files) {
      files_to_load.add(file);
    }
  }

  // Load each file
  log_info(`Loading ${files_to_load.size} filtered files...`);
  const start_time = Date.now();

  for (const file_path of files_to_load) {
    try {
      await load_file_if_needed(project, file_path);
    } catch (error) {
      log_warn(`Skipping file ${file_path}: ${error}`);
    }
  }

  const duration = Date.now() - start_time;
  log_info(`Loaded ${files_to_load.size} files in ${duration}ms`);
}

export interface AriadneMCPServerOptions {
  project_path?: string;
  transport?: "stdio";
  watch?: boolean;
}

export async function start_server(
  options: AriadneMCPServerOptions = {}
): Promise<Server> {
  // Initialize logger first (reads DEBUG_LOG_FILE env var)
  initialize_logger();

  // Support PROJECT_PATH environment variable
  // Precedence: options.project_path (CLI) > PROJECT_PATH env > cwd
  const project_path =
    options.project_path || process.env.PROJECT_PATH || process.cwd();

  // Initialize analytics if enabled
  const analytics_enabled = process.env.ARIADNE_ANALYTICS === "1";
  if (analytics_enabled) {
    init_analytics(project_path);
  }

  // Create the MCP server
  const server = new Server(
    {
      name: "ariadne-mcp",
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Capture client info once MCP initialization completes
  if (analytics_enabled) {
    server.oninitialized = () => {
      const client = server.getClientVersion();
      if (client) {
        record_session_client_info(client.name, client.version);
      }
    };
  }

  // Initialize persistent project manager with file watching
  const project_manager = new ProjectManager();
  await project_manager.initialize({
    project_path,
    watch: options.watch ?? true, // Enable file watching by default
  });

  // Load all project files on startup
  await project_manager.load_all_files();

  log_info(
    `Ariadne MCP server initialized for: ${project_path}` +
      (project_manager.is_watching() ? " (watching for changes)" : "")
  );

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list_entrypoints",
          description:
            "Lists all entry point functions ordered by call tree complexity. Entry points are functions never called by other functions in the analyzed scope. Shows function signatures with parameters and return types, call tree size, and a reference ID (Ref) for use with other tools. Supports filtering by specific files or folders for scoped analysis. Test functions are marked with [TEST].",
          inputSchema: {
            type: "object",
            properties: {
              files: {
                type: "array",
                items: { type: "string" },
                description:
                  "Specific file paths to analyze (relative or absolute)",
              },
              folders: {
                type: "array",
                items: { type: "string" },
                description: "Folder paths to include recursively",
              },
              include_tests: {
                type: "boolean",
                description: "Include test functions in output (default: true)",
              },
            },
            required: [],
          },
        },
        {
          name: "show_call_graph_neighborhood",
          description:
            "Shows the call graph neighborhood around a callable. Displays callers (upstream, who calls this function) and callees (downstream, what this function calls) with configurable depth. Use the Ref output from list_entrypoints as the symbol_ref input, or construct it as file_path:line#name. Supports filtering by specific files or folders for scoped analysis.",
          inputSchema: {
            type: "object",
            properties: {
              symbol_ref: {
                type: "string",
                description:
                  "Callable reference in format 'file_path:line#name' (e.g., 'src/handlers.ts:15#handle_request')",
              },
              callers_depth: {
                type: ["number", "null"],
                description:
                  "Levels of callers to show (null = unlimited, default: 1)",
              },
              callees_depth: {
                type: ["number", "null"],
                description:
                  "Levels of callees to show (null = unlimited, default: 1)",
              },
              show_full_signature: {
                type: "boolean",
                description:
                  "Show full signature with params/return type (default: true) vs just name",
              },
              files: {
                type: "array",
                items: { type: "string" },
                description:
                  "Specific file paths to analyze (relative or absolute)",
              },
              folders: {
                type: "array",
                items: { type: "string" },
                description: "Folder paths to include recursively",
              },
            },
            required: ["symbol_ref"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name } = request.params;
    const tool_start = Date.now();
    const tool_args = request.params.arguments ?? {};

    try {
      switch (name) {
        case "list_entrypoints": {
          // Parse arguments using schema
          const args = list_entrypoints_schema.parse(tool_args);

          const has_filters =
            (args.files && args.files.length > 0) ||
            (args.folders && args.folders.length > 0);

          let target_project: Project;

          if (has_filters) {
            // For scoped analysis with filters, create a fresh project
            // with only the specified files. This is semantically different
            // from full analysis (entry points are relative to the scope).
            const scoped_project = new Project();
            await scoped_project.initialize(project_path as FilePath);
            await load_filtered_project_files(scoped_project, {
              files: args.files,
              folders: args.folders,
              project_path,
            });
            target_project = scoped_project;
          } else {
            // For unfiltered analysis, use the persistent project
            // which is kept up-to-date via file watching
            target_project = project_manager.get_project();
          }

          const result = await list_entrypoints(target_project, args);

          record_tool_call({
            tool_name: name,
            arguments: tool_args as Record<string, unknown>,
            duration_ms: Date.now() - tool_start,
            success: true,
            request_id: String(extra.requestId),
          });

          return {
            content: [
              {
                type: "text",
                text: result,
              },
            ],
          };
        }

        case "show_call_graph_neighborhood": {
          const args = show_call_graph_neighborhood_schema.parse(tool_args);

          const has_filters =
            (args.files && args.files.length > 0) ||
            (args.folders && args.folders.length > 0);

          let target_project: Project;

          if (has_filters) {
            // For scoped analysis with filters, create a fresh project
            // with only the specified files. The neighborhood will be
            // relative to this filtered scope.
            const scoped_project = new Project();
            await scoped_project.initialize(project_path as FilePath);
            await load_filtered_project_files(scoped_project, {
              files: args.files,
              folders: args.folders,
              project_path,
            });
            target_project = scoped_project;
          } else {
            // For unfiltered analysis, use the persistent project
            target_project = project_manager.get_project();
          }

          const result = await show_call_graph_neighborhood(
            target_project,
            args
          );

          record_tool_call({
            tool_name: name,
            arguments: tool_args as Record<string, unknown>,
            duration_ms: Date.now() - tool_start,
            success: true,
            request_id: String(extra.requestId),
          });

          return {
            content: [
              {
                type: "text",
                text: result,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);

      record_tool_call({
        tool_name: name,
        arguments: tool_args as Record<string, unknown>,
        duration_ms: Date.now() - tool_start,
        success: false,
        error_message,
        request_id: String(extra.requestId),
      });

      return {
        content: [
          {
            type: "text",
            text: `Error: ${error_message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect transport based on options
  if (options.transport === "stdio" || !options.transport) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  return server;
}

// Helper function to load a file if not already in the project
export async function load_file_if_needed(
  project: Project,
  file_path: string
): Promise<void> {
  try {
    const source_code = await fs.readFile(file_path, "utf-8");
    project.update_file(file_path as FilePath, source_code);
  } catch (error) {
    throw new Error(
      `Failed to read file ${file_path}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Helper function to load all project files
export async function load_project_files(
  project: Project,
  project_path: string
): Promise<void> {
  log_info(`Loading project files from: ${project_path}`);
  const start_time = Date.now();

  const files = await find_source_files(project_path, project_path);
  let loaded_count = 0;

  for (const file_path of files) {
    try {
      await load_file_if_needed(project, file_path);
      loaded_count++;
    } catch (error) {
      log_warn(`Skipping file ${file_path}: ${error}`);
    }
  }

  const duration = Date.now() - start_time;
  log_info(`Loaded ${loaded_count} files in ${duration}ms`);
}
