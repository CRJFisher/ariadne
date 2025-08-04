import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 1. Create an MCP server that communicates over stdin/stdout.
// No network configuration is needed.
const server = new McpServer({
  name: "poem-generator",
  version: "1.0.0",
});

// Optional: Add a log message to confirm the script is running.
// This will appear in the client's logs when it spawns the process.
console.error("STDIO poemGenerator server process started.");

// 2. Define the tool using the tool method
server.registerTool(
  "poemGenerator",
  z.object({
    topic: z.string().describe("The subject for the poem"),
  }),
  async ({ topic }) => {
    // Using console.error for logging ensures it goes to stderr and doesn't
    // interfere with the JSON-RPC messages on stdout.
    console.error(`Tool 'poemGenerator' called with topic: "${topic}"`);

    // For this test, we'll return a simple static poem
    // In a real implementation, you'd use the host LLM sampling feature
    const poem = `A poem about ${topic}:
Roses are red,
Violets are blue,
${topic} is wonderful,
And so are you!`;
    console.error(`Received poem from host LLM:\n${poem}`);

    return {
      content: [{ type: "text", text: poem }],
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Poem generator MCP server running on stdio");
}

main().catch(console.error);
