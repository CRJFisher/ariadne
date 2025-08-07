import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 1. Create an MCP server that communicates over stdin/stdout.
// No network configuration is needed.
const mcpServer = new McpServer({
  name: "poem-generator",
  version: "1.0.0",
});

// Optional: Add a log message to confirm the script is running.
// This will appear in the client's logs when it spawns the process.
console.error("STDIO poemGenerator server process started.");

// 2. Define the tool using the tool method
mcpServer.registerTool(
  "poemGenerator",
  {
    description: "Generates a poem about a given topic",
    inputSchema: {
      topic: z.string().describe("The subject for the poem"),
    },
  },
  async ({ topic }) => {
    // Using console.error for logging ensures it goes to stderr and doesn't
    // interfere with the JSON-RPC messages on stdout.
    console.error(`Tool 'poemGenerator' called with topic: "${topic}"`);

    // Use the mcpServer's server.createMessage method for LLM sampling
    const llmResponse = await mcpServer.server.createMessage({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Write a four-line poem about ${topic}.`,
            },
          },
        ],
        maxTokens: 200,
        // You can also request specific models or parameters
        // model: "claude-3-5-sonnet-20240620", 
      });

    const poem = llmResponse.content.type === "text" ? llmResponse.content.text : "Unable to generate poem";
    console.error(`Received poem from host LLM:\n${poem}`);

    return {
      content: [{ type: "text", text: poem }],
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("Poem generator MCP server running on stdio");
}

main().catch(console.error);
