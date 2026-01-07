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
import { list_functions } from "./tools/list_functions.js";

export interface AriadneMCPServerOptions {
  project_path?: string;
  transport?: "stdio";
}

export async function start_server(
  options: AriadneMCPServerOptions = {}
): Promise<Server> {
  // Support PROJECT_PATH environment variable
  const project_path =
    options.project_path || process.env.PROJECT_PATH || process.cwd();

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

  // Initialize Ariadne project
  const project = new Project();
  await project.initialize(project_path as FilePath);

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list_functions",
          description:
            "Lists all top-level (entry point) functions ordered by call tree complexity. Shows function signatures with parameters and return types, along with the total number of functions transitively called. Entry points are functions never called by other functions in the codebase - potential execution starting points.",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    try {
      switch (name) {
        case "list_functions": {
          // Load all project files before analysis
          await load_project_files(project, project_path);

          const result = await list_functions(project);

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
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
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
  const loaded_files = new Set<string>();
  let gitignore_patterns: string[] = [];

  // Try to read .gitignore
  try {
    const gitignore_path = path.join(project_path, ".gitignore");
    const gitignore_content = await fs.readFile(gitignore_path, "utf-8");
    gitignore_patterns = gitignore_content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    // .gitignore not found or unreadable, continue without it
  }

  function should_ignore(file_path: string): boolean {
    const relative_path = path.relative(project_path, file_path);

    // Always ignore common directories
    const common_ignores = [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
      ".nyc_output",
      ".cache",
      "tmp",
      "temp",
      ".DS_Store",
    ];

    for (const ignore of common_ignores) {
      if (relative_path.includes(ignore)) return true;
    }

    // Check gitignore patterns (simple implementation)
    for (const pattern of gitignore_patterns) {
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        if (relative_path.startsWith(prefix)) return true;
      } else if (
        relative_path === pattern ||
        relative_path.includes("/" + pattern)
      ) {
        return true;
      }
    }

    return false;
  }

  async function load_directory(dir_path: string): Promise<void> {
    if (should_ignore(dir_path)) return;

    let entries;
    try {
      entries = await fs.readdir(dir_path, { withFileTypes: true });
    } catch (error) {
      console.warn(`Cannot read directory ${dir_path}: ${error}`);
      return;
    }

    for (const entry of entries) {
      const full_path = path.join(dir_path, entry.name);

      if (should_ignore(full_path)) continue;

      if (entry.isDirectory()) {
        await load_directory(full_path);
      } else if (entry.isFile()) {
        // Load supported source files
        if (
          /\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|hpp|h)$/.test(entry.name) &&
          !entry.name.endsWith(".d.ts")
        ) {
          if (!loaded_files.has(full_path)) {
            try {
              await load_file_if_needed(project, full_path);
              loaded_files.add(full_path);
            } catch (error) {
              console.warn(`Skipping file ${full_path}: ${error}`);
            }
          }
        }
      }
    }
  }

  console.log(`Loading project files from: ${project_path}`);
  const start_time = Date.now();
  await load_directory(project_path);
  const duration = Date.now() - start_time;
  console.log(`Loaded ${loaded_files.size} files in ${duration}ms`);
}
