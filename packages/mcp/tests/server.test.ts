import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { startServer } from '../src/start_server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Ariadne MCP Server', () => {
  let server: Server;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ariadne-mcp-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Tool Registration', () => {
    it('should register go_to_definition and find_references tools', async () => {
      server = await startServer({ projectPath: testDir });
      
      // Mock the request handler to capture the response
      let toolsResponse: any;
      server.setRequestHandler(ListToolsRequestSchema, async () => {
        toolsResponse = await server.handleRequest({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {}
        });
        return toolsResponse;
      });

      const response = await server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      });

      expect(response).toHaveProperty('tools');
      expect(response.tools).toHaveLength(2);
      
      const toolNames = response.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('go_to_definition');
      expect(toolNames).toContain('find_references');
    });
  });

  describe('go_to_definition', () => {
    it('should find definition of a function', async () => {
      // Create a test file
      const testFile = path.join(testDir, 'test.js');
      const testContent = `
function myFunction() {
  return 42;
}

const result = myFunction();
`;
      await fs.writeFile(testFile, testContent);

      server = await startServer({ projectPath: testDir });

      const response = await server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "go_to_definition",
          arguments: {
            file_path: "test.js",
            position: { row: 5, column: 15 } // Position on 'myFunction' call
          }
        }
      });

      expect(response).toHaveProperty('content');
      expect(response.content).toHaveLength(1);
      
      const result = JSON.parse(response.content[0].text);
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('start');
      expect(result.start.row).toBe(1); // Function definition line
    });

    it('should return error for non-existent file', async () => {
      server = await startServer({ projectPath: testDir });

      const response = await server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "go_to_definition",
          arguments: {
            file_path: "non-existent.js",
            position: { row: 0, column: 0 }
          }
        }
      });

      expect(response).toHaveProperty('content');
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Failed to read file');
    });
  });

  describe('find_references', () => {
    it('should find all references to a function', async () => {
      // Create a test file
      const testFile = path.join(testDir, 'test.js');
      const testContent = `
function myFunction() {
  return 42;
}

const result1 = myFunction();
const result2 = myFunction();
myFunction();
`;
      await fs.writeFile(testFile, testContent);

      server = await startServer({ projectPath: testDir });

      const response = await server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "find_references",
          arguments: {
            file_path: "test.js",
            position: { row: 1, column: 9 } // Position on function definition
          }
        }
      });

      expect(response).toHaveProperty('content');
      expect(response.content).toHaveLength(1);
      
      const result = JSON.parse(response.content[0].text);
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('references');
      expect(result.count).toBeGreaterThan(0);
    });
  });
});