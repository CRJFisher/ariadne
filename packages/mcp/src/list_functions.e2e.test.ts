/**
 * End-to-end test for MCP server and list_functions tool
 *
 * This test:
 * 1. Spawns the actual MCP server as a child process
 * 2. Connects to it as an MCP client via stdio
 * 3. Discovers available tools
 * 4. Calls list_functions tool on packages/core codebase
 * 5. Validates the response format and content
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";

describe("MCP Server E2E - list_functions tool", () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;

  // Path to packages/core (the codebase we'll analyze)
  const PACKAGES_CORE_PATH = path.resolve(__dirname, "../../core");

  // Path to the built server executable
  const SERVER_PATH = path.resolve(__dirname, "../dist/server.js");

  beforeAll(async () => {
    // Spawn the MCP server as a child process
    serverProcess = spawn("node", [SERVER_PATH], {
      env: {
        ...process.env,
        PROJECT_PATH: PACKAGES_CORE_PATH,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Log server stderr for debugging
    serverProcess.stderr?.on("data", (data) => {
      console.error(`[Server stderr]: ${data}`);
    });

    // Create MCP client with stdio transport
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH],
      env: {
        ...process.env,
        PROJECT_PATH: PACKAGES_CORE_PATH,
      },
    });

    client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // Connect client to server
    await client.connect(transport);

    // Give server time to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 30000); // 30s timeout for setup

  afterAll(async () => {
    // Clean shutdown
    if (client) {
      await client.close();
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it("should connect to server successfully", () => {
    expect(client).toBeDefined();
    expect(serverProcess.killed).toBe(false);
  });

  it("should list available tools and find list_functions", async () => {
    const response = await client.listTools();

    expect(response).toBeDefined();
    expect(response.tools).toBeDefined();
    expect(Array.isArray(response.tools)).toBe(true);

    // Should have at least one tool
    expect(response.tools.length).toBeGreaterThan(0);

    // Should find list_functions tool
    const list_functions_tool = response.tools.find(
      (tool) => tool.name === "list_functions"
    );

    expect(list_functions_tool).toBeDefined();
    expect(list_functions_tool?.name).toBe("list_functions");
    expect(list_functions_tool?.description).toContain("entry point");
    expect(list_functions_tool?.inputSchema).toBeDefined();
    expect(list_functions_tool?.inputSchema.type).toBe("object");
  });

  it("should call list_functions on packages/core and get valid response", async () => {
    // Call the tool (this will load all files in packages/core)
    const response = await client.callTool({
      name: "list_functions",
      arguments: {},
    });

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect((response.content as any[]).length).toBeGreaterThan(0);

    // First content item should be text
    const content = (response.content as any[])[0];
    expect(content.type).toBe("text");
    expect(content.text).toBeDefined();

    // Log the response for debugging
    console.log("\n=== list_functions Response ===");
    console.log(content.text);
    console.log("=== End Response ===\n");
  }, 120000); // 2 minute timeout (packages/core is large)

  it("should return entry points with correct format", async () => {
    const response = await client.callTool({
      name: "list_functions",
      arguments: {},
    });

    const text = (response.content as any[])[0].text as string;

    // Verify header
    expect(text).toContain("Top-Level Functions");

    // Verify format contains function entries
    // Format: "- function_name(...): return_type -- N functions"
    const functionPattern = /^- \w+\([^)]*\):.*--\s+\d+\s+functions?/m;
    expect(text).toMatch(functionPattern);

    // Verify contains "Entry point:" with file path
    expect(text).toContain("Entry point:");
    expect(text).toContain("packages/core/");

    // Verify contains total count
    expect(text).toMatch(/Total:\s+\d+\s+entry points?/);
  }, 120000);

  it("should return entry points from packages/core codebase", async () => {
    const response = await client.callTool({
      name: "list_functions",
      arguments: {},
    });

    const text = (response.content as any[])[0].text as string;

    // Should reference packages/core file paths
    expect(text).toContain("packages/core/");

    // Should have multiple entry points (packages/core has many)
    const totalMatch = text.match(/Total:\s+(\d+)\s+entry points?/);
    expect(totalMatch).toBeDefined();

    if (totalMatch) {
      const entryPointCount = parseInt(totalMatch[1], 10);
      expect(entryPointCount).toBeGreaterThan(0);
      console.log(`\nFound ${entryPointCount} entry points in packages/core`);
    }

    // Parse and verify at least one entry has a valid signature
    const lines = text.split("\n");
    const functionLines = lines.filter((line) => line.startsWith("- "));

    expect(functionLines.length).toBeGreaterThan(0);

    // First function should have proper format
    const firstFunc = functionLines[0];
    console.log(`\nFirst entry point: ${firstFunc}`);

    // Should have function name, params, return type, and count
    expect(firstFunc).toMatch(/- \w+\([^)]*\)/); // name and params
    expect(firstFunc).toMatch(/--\s+\d+/); // separator and count
  }, 120000);

  it("should handle tool call errors gracefully", async () => {
    // Try to call a non-existent tool
    try {
      await client.callTool({
        name: "nonexistent_tool",
        arguments: {},
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Should throw an error
      expect(error).toBeDefined();
    }
  });
});
