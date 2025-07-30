import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Project } from "@ariadnejs/core";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";
import { getSymbolContext, getSymbolContextSchema } from "./tools/get_symbol_context";
import { VERSION } from "./version";

export interface AriadneMCPServerOptions {
  projectPath?: string;
  transport?: "stdio";
}

export async function startServer(options: AriadneMCPServerOptions = {}): Promise<Server> {
  // Support PROJECT_PATH environment variable as per task 53
  const projectPath = options.projectPath || process.env.PROJECT_PATH || process.cwd();
  
  // Create the MCP server
  const server = new Server(
    {
      name: "ariadne-mcp",
      version: VERSION
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Initialize Ariadne project
  const project = new Project();

  // Register tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_symbol_context",
          description: "Get comprehensive information about any code symbol by name (function, class, variable, etc.)",
          inputSchema: {
            type: "object",
            properties: {
              symbol: {
                type: "string",
                description: "Name of the symbol to look up"
              },
              searchScope: {
                type: "string",
                enum: ["file", "project", "dependencies"],
                description: "Scope to search within (default: project)"
              },
              includeTests: {
                type: "boolean",
                description: "Whether to include test file references (default: false)"
              }
            },
            required: ["symbol"]
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
        case "get_symbol_context": {
          const validatedArgs = getSymbolContextSchema.parse(args);
          
          // Load all files in the project if needed
          // TODO: Implement smart file loading based on search scope
          // For now, load all files in the project
          await loadProjectFiles(project, projectPath);
          
          const result = await getSymbolContext(project, validatedArgs);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ]
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
  
  // Helper function to load all project files (Task 53)
  async function loadProjectFiles(project: Project, projectPath: string): Promise<void> {
    const loadedFiles = new Set<string>();
    let gitignorePatterns: string[] = [];
    
    // Try to read .gitignore
    try {
      const gitignorePath = path.join(projectPath, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      gitignorePatterns = gitignoreContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } catch {
      // .gitignore not found or unreadable, continue without it
    }
    
    function shouldIgnore(filePath: string): boolean {
      const relativePath = path.relative(projectPath, filePath);
      
      // Always ignore common directories
      const commonIgnores = [
        'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
        '.nyc_output', '.cache', 'tmp', 'temp', '.DS_Store'
      ];
      
      for (const ignore of commonIgnores) {
        if (relativePath.includes(ignore)) return true;
      }
      
      // Check gitignore patterns (simple implementation)
      for (const pattern of gitignorePatterns) {
        if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          if (relativePath.startsWith(prefix)) return true;
        } else if (relativePath === pattern || relativePath.includes('/' + pattern)) {
          return true;
        }
      }
      
      return false;
    }
    
    async function loadDirectory(dirPath: string): Promise<void> {
      if (shouldIgnore(dirPath)) return;
      
      let entries;
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch (error) {
        console.warn(`Cannot read directory ${dirPath}: ${error}`);
        return;
      }
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (shouldIgnore(fullPath)) continue;
        
        if (entry.isDirectory()) {
          await loadDirectory(fullPath);
        } else if (entry.isFile()) {
          // Load supported source files
          if (/\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|hpp|h)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
            if (!loadedFiles.has(fullPath)) {
              try {
                await loadFileIfNeeded(project, fullPath);
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
    await loadDirectory(projectPath);
    const duration = Date.now() - startTime;
    console.log(`Loaded ${loadedFiles.size} files in ${duration}ms`);
  }

  // Connect transport based on options
  if (options.transport === "stdio" || !options.transport) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  return server;
}