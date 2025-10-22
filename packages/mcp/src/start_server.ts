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
  projectPath?: string;
  transport?: "stdio";
}

export async function start_server(
  options: AriadneMCPServerOptions = {}
): Promise<Server> {
  // Support PROJECT_PATH environment variable
  const projectPath =
    options.projectPath || process.env.PROJECT_PATH || process.cwd();

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
  await project.initialize(projectPath as FilePath);

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
          await load_project_files(project, projectPath);

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
  filePath: string
): Promise<void> {
  try {
    const sourceCode = await fs.readFile(filePath, "utf-8");
    project.update_file(filePath as FilePath, sourceCode);
  } catch (error) {
    throw new Error(
      `Failed to read file ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Helper function to load all project files
export async function load_project_files(
  project: Project,
  projectPath: string
): Promise<void> {
  const loadedFiles = new Set<string>();
  let gitignorePatterns: string[] = [];

  // Try to read .gitignore
  try {
    const gitignorePath = path.join(projectPath, ".gitignore");
    const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
    gitignorePatterns = gitignoreContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    // .gitignore not found or unreadable, continue without it
  }

  function should_ignore(filePath: string): boolean {
    const relativePath = path.relative(projectPath, filePath);

    // Always ignore common directories
    const commonIgnores = [
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

    for (const ignore of commonIgnores) {
      if (relativePath.includes(ignore)) return true;
    }

    // Check gitignore patterns (simple implementation)
    for (const pattern of gitignorePatterns) {
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        if (relativePath.startsWith(prefix)) return true;
      } else if (
        relativePath === pattern ||
        relativePath.includes("/" + pattern)
      ) {
        return true;
      }
    }

    return false;
  }

  async function load_directory(dirPath: string): Promise<void> {
    if (should_ignore(dirPath)) return;

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      console.warn(`Cannot read directory ${dirPath}: ${error}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (should_ignore(fullPath)) continue;

      if (entry.isDirectory()) {
        await load_directory(fullPath);
      } else if (entry.isFile()) {
        // Load supported source files
        if (
          /\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|hpp|h)$/.test(entry.name) &&
          !entry.name.endsWith(".d.ts")
        ) {
          if (!loadedFiles.has(fullPath)) {
            try {
              await load_file_if_needed(project, fullPath);
              loadedFiles.add(fullPath);
            } catch (error) {
              console.warn(`Skipping file ${fullPath}: ${error}`);
            }
          }
        }
      }
    }
  }

  console.log(`Loading project files from: ${projectPath}`);
  const startTime = Date.now();
  await load_directory(projectPath);
  const duration = Date.now() - startTime;
  console.log(`Loaded ${loadedFiles.size} files in ${duration}ms`);
}
