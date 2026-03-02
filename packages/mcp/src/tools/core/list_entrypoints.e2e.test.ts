/**
 * End-to-end test for MCP server and list_entrypoints tool
 *
 * This test:
 * 1. Spawns the actual MCP server as a child process
 * 2. Connects to it as an MCP client via stdio
 * 3. Discovers available tools
 * 4. Calls list_entrypoints tool on packages/core codebase
 * 5. Validates the response format and content
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";

describe("MCP Server E2E - list_entrypoints tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  // Path to packages/core (the codebase we'll analyze)
  const PACKAGES_CORE_PATH = path.resolve(__dirname, "../../../../core");

  // Path to the built server executable (3 levels up from src/tools/core/)
  const SERVER_PATH = path.resolve(__dirname, "../../../dist/server.js");

  beforeAll(async () => {
    // Create MCP client with stdio transport
    // This will automatically spawn the server process
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "--no-watch"],
      env: {
        ...process.env,
        PROJECT_PATH: PACKAGES_CORE_PATH,
        ARIADNE_ANALYTICS: "",
        ARIADNE_ANALYTICS_DB: ":memory:",
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
    // The StdioClientTransport will spawn the server process automatically
    await client.connect(transport);

    // Give server time to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 60000); // 60s timeout for setup (packages/core is large)

  afterAll(async () => {
    // Clean shutdown - closing the client will also close the server process
    // that was spawned by StdioClientTransport
    if (client) {
      await client.close();
    }
  });

  it("should connect to server successfully", () => {
    expect(client).toBeDefined();
    expect(transport).toBeDefined();
  });

  it("should list available tools and find list_entrypoints with filtering parameters", async () => {
    const response = await client.listTools();

    expect(response).toBeDefined();
    expect(response.tools).toBeDefined();
    expect(Array.isArray(response.tools)).toBe(true);

    // Should have at least one tool
    expect(response.tools.length).toBeGreaterThan(0);

    // Should find list_entrypoints tool
    const list_entrypoints_tool = response.tools.find(
      (tool) => tool.name === "list_entrypoints"
    );

    expect(list_entrypoints_tool).toBeDefined();
    expect(list_entrypoints_tool?.name).toBe("list_entrypoints");
    expect(list_entrypoints_tool?.description).toContain("entry point");
    expect(list_entrypoints_tool?.description).toContain("[TEST]");
    expect(list_entrypoints_tool?.inputSchema).toBeDefined();
    expect(list_entrypoints_tool?.inputSchema.type).toBe("object");

    // Verify parameters are in schema
    const schema = list_entrypoints_tool?.inputSchema as any;
    expect(schema.properties).toBeDefined();
    expect(schema.properties.include_tests).toBeDefined();
    expect(schema.properties.include_tests.type).toBe("boolean");
    expect(schema.properties.files).toBeDefined();
    expect(schema.properties.files.type).toBe("array");
    expect(schema.properties.folders).toBeDefined();
    expect(schema.properties.folders.type).toBe("array");
  });

  it("should call list_entrypoints on packages/core and get valid response", async () => {
    // Call the tool (this will load all files in packages/core)
    const response = await client.callTool({
      name: "list_entrypoints",
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
    console.log("\n=== list_entrypoints Response ===");
    console.log(content.text);
    console.log("=== End Response ===\n");
  }, 120000); // 2 minute timeout (packages/core is large)

  it("should return entry points with correct format including Ref line", async () => {
    const response = await client.callTool({
      name: "list_entrypoints",
      arguments: {},
    });

    const text = (response.content as any[])[0].text as string;

    // Verify header
    expect(text).toContain("Entry Points");

    // Verify format contains function entries
    // Format: "- function_name(...): return_type -- N functions"
    const function_pattern = /^- \w+\([^)]*\):.*--\s+\d+\s+functions?/m;
    expect(text).toMatch(function_pattern);

    // Verify contains "Location:" with file path
    expect(text).toContain("Location:");
    expect(text).toContain("packages/core/");

    // Verify contains "Ref:" line for companion tool integration
    expect(text).toContain("Ref:");
    // Ref format: file_path:line#name
    expect(text).toMatch(/Ref:\s+\S+:\d+#\w+/);

    // Verify contains total count
    expect(text).toMatch(/Total:\s+\d+\s+entry points?/);
  }, 120000);

  it("should return entry points from packages/core codebase", async () => {
    const response = await client.callTool({
      name: "list_entrypoints",
      arguments: {},
    });

    const text = (response.content as any[])[0].text as string;

    // Should reference packages/core file paths
    expect(text).toContain("packages/core/");

    // Should have multiple entry points (packages/core has many)
    const total_match = text.match(/Total:\s+(\d+)\s+entry points?/);
    expect(total_match).toBeDefined();

    if (total_match) {
      const entry_point_count = parseInt(total_match[1], 10);
      expect(entry_point_count).toBeGreaterThan(0);
      console.log(`\nFound ${entry_point_count} entry points in packages/core`);
    }

    // Parse and verify at least one entry has a valid signature
    const lines = text.split("\n");
    const function_lines = lines.filter((line) => line.startsWith("- "));

    expect(function_lines.length).toBeGreaterThan(0);

    // First function should have proper format
    const first_func = function_lines[0];
    console.log(`\nFirst entry point: ${first_func}`);

    // Should have function name, params, return type, and count
    expect(first_func).toMatch(/- \w+\([^)]*\)/); // name and params
    expect(first_func).toMatch(/--\s+\d+/); // separator and count
  }, 120000);

  it("should mark test functions with [TEST] indicator", async () => {
    // packages/core has test files, so we should see [TEST] markers
    const response = await client.callTool({
      name: "list_entrypoints",
      arguments: {},
    });

    const text = (response.content as any[])[0].text as string;

    // Should contain [TEST] indicator for test entry points
    expect(text).toContain("[TEST]");

    // Count test vs non-test entry points
    const lines = text.split("\n");
    const test_entries = lines.filter((line) => line.includes("[TEST]"));
    const non_test_entries = lines.filter(
      (line) => line.startsWith("- ") && !line.includes("[TEST]")
    );

    console.log(`\nTest entry points: ${test_entries.length}`);
    console.log(`Non-test entry points: ${non_test_entries.length}`);

    // Should have both test and non-test entries
    expect(test_entries.length).toBeGreaterThan(0);
    expect(non_test_entries.length).toBeGreaterThan(0);
  }, 120000);

  it("should filter out test functions when include_tests is false", async () => {
    // First get results with tests included
    const with_tests_response = await client.callTool({
      name: "list_entrypoints",
      arguments: { include_tests: true },
    });
    const with_tests_text = (with_tests_response.content as any[])[0]
      .text as string;

    // Then get results without tests
    const without_tests_response = await client.callTool({
      name: "list_entrypoints",
      arguments: { include_tests: false },
    });
    const without_tests_text = (without_tests_response.content as any[])[0]
      .text as string;

    // Without tests should not contain [TEST] marker
    expect(without_tests_text).not.toContain("[TEST]");

    // Extract counts
    const with_tests_match = with_tests_text.match(
      /Total:\s+(\d+)\s+entry points?/
    );
    const without_tests_match = without_tests_text.match(
      /Total:\s+(\d+)\s+entry points?/
    );

    expect(with_tests_match).toBeDefined();
    expect(without_tests_match).toBeDefined();

    if (with_tests_match && without_tests_match) {
      const with_tests_count = parseInt(with_tests_match[1], 10);
      const without_tests_count = parseInt(without_tests_match[1], 10);

      // With tests should have more entry points than without
      expect(with_tests_count).toBeGreaterThan(without_tests_count);

      console.log(`\nWith tests: ${with_tests_count} entry points`);
      console.log(`Without tests: ${without_tests_count} entry points`);
      console.log(
        `Test entry points filtered: ${with_tests_count - without_tests_count}`
      );
    }
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
