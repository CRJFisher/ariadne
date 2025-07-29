import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Project } from "@ariadnejs/core";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";

export interface AriadneMCPServerOptions {
  projectPath?: string;
  transport?: "stdio";
}

export async function startServer(options: AriadneMCPServerOptions = {}): Promise<Server> {
  const projectPath = options.projectPath || process.cwd();
  
  // Create the MCP server
  const server = new Server(
    {
      name: "ariadne-mcp",
      version: "0.5.12"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Initialize Ariadne project
  const project = new Project();

  // Define schemas for our tools
  const positionSchema = z.object({
    row: z.number().describe("0-indexed line number"),
    column: z.number().describe("0-indexed column number")
  });

  const goToDefinitionSchema = z.object({
    file_path: z.string().describe("Path to the file"),
    position: positionSchema.describe("Position in the file")
  });

  const findReferencesSchema = z.object({
    file_path: z.string().describe("Path to the file"),
    position: positionSchema.describe("Position in the file")
  });

  // Register tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "go_to_definition",
          description: "Find the definition of a symbol at a specific location in a file",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "Path to the file"
              },
              position: {
                type: "object",
                properties: {
                  row: {
                    type: "number",
                    description: "0-indexed line number"
                  },
                  column: {
                    type: "number",
                    description: "0-indexed column number"
                  }
                },
                required: ["row", "column"]
              }
            },
            required: ["file_path", "position"]
          }
        },
        {
          name: "find_references",
          description: "Find all references to a symbol at a specific location across all files",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "Path to the file"
              },
              position: {
                type: "object",
                properties: {
                  row: {
                    type: "number",
                    description: "0-indexed line number"
                  },
                  column: {
                    type: "number",
                    description: "0-indexed column number"
                  }
                },
                required: ["row", "column"]
              }
            },
            required: ["file_path", "position"]
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "go_to_definition": {
          const validatedArgs = goToDefinitionSchema.parse(args);
          const absolutePath = path.resolve(projectPath, validatedArgs.file_path);
          
          // Load file into project if not already loaded
          await loadFileIfNeeded(project, absolutePath);
          
          const definition = project.go_to_definition(absolutePath, validatedArgs.position);
          
          if (definition) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    file: definition.file,
                    start: definition.start,
                    end: definition.end
                  }, null, 2)
                }
              ]
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: "No definition found at the specified location"
                }
              ]
            };
          }
        }

        case "find_references": {
          const validatedArgs = findReferencesSchema.parse(args);
          const absolutePath = path.resolve(projectPath, validatedArgs.file_path);
          
          // Load file into project if not already loaded
          await loadFileIfNeeded(project, absolutePath);
          
          const references = project.find_references(absolutePath, validatedArgs.position);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  count: references.length,
                  references: references.map(ref => ({
                    file: ref.file,
                    start: ref.start,
                    end: ref.end
                  }))
                }, null, 2)
              }
            ]
          ];
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  // Helper function to load a file if not already in the project
  async function loadFileIfNeeded(project: Project, filePath: string): Promise<void> {
    try {
      const sourceCode = await fs.readFile(filePath, "utf-8");
      project.add_or_update_file(filePath, sourceCode);
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Connect transport based on options
  if (options.transport === "stdio" || !options.transport) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  return server;
}