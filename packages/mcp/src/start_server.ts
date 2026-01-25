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

/**
 * Options for filtered file loading
 */
export interface FileLoadOptions {
  files?: string[];
  folders?: string[];
  project_path: string;
}

/**
 * Supported source file extensions regex
 */
const SUPPORTED_EXTENSIONS = /\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|hpp|h)$/;

/**
 * Check if a file has a supported source extension
 */
function is_supported_file(file_path: string): boolean {
  return (
    SUPPORTED_EXTENSIONS.test(file_path) && !file_path.endsWith(".d.ts")
  );
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
 * Find all supported source files in a folder recursively
 */
async function find_source_files_in_folder(
  folder_path: string
): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir_path: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir_path, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full_path = path.join(dir_path, entry.name);

      // Skip common ignored directories
      if (
        entry.isDirectory() &&
        !["node_modules", ".git", "dist", "build", ".next", "coverage"].includes(
          entry.name
        )
      ) {
        await walk(full_path);
      } else if (entry.isFile() && is_supported_file(entry.name)) {
        files.push(full_path);
      }
    }
  }

  await walk(folder_path);
  return files;
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
    const folder_files = await find_source_files_in_folder(abs_folder);
    for (const file of folder_files) {
      files_to_load.add(file);
    }
  }

  // Load each file
  console.log(`Loading ${files_to_load.size} filtered files...`);
  const start_time = Date.now();

  for (const file_path of files_to_load) {
    try {
      await load_file_if_needed(project, file_path);
    } catch (error) {
      console.warn(`Skipping file ${file_path}: ${error}`);
    }
  }

  const duration = Date.now() - start_time;
  console.log(`Loaded ${files_to_load.size} files in ${duration}ms`);
}

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
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    try {
      switch (name) {
        case "list_entrypoints": {
          // Parse arguments using schema
          const args = list_entrypoints_schema.parse(
            request.params.arguments ?? {}
          );

          // Create fresh project for scoped analysis
          const scoped_project = new Project();
          await scoped_project.initialize(project_path as FilePath);

          // Load files based on filtering options
          await load_filtered_project_files(scoped_project, {
            files: args.files,
            folders: args.folders,
            project_path,
          });

          const result = await list_entrypoints(scoped_project, args);

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
