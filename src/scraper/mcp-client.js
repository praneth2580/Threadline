/**
 * mcp-client.js
 *
 * Official MCP Client layer: Connects to a standard MCP Server (e.g. puppeteer/chrome)
 * using the `@modelcontextprotocol/sdk`.
 *
 * It communicates with the MCP server to dispatch tools (navigate, evaluate)
 * allowing the scraper to run without directly bundling Playwright in the backend process.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// You can change the target server in .env (e.g., using official puppeteer MCP server)
const MCP_SERVER_CMD = process.env.MCP_SERVER_CMD || "npx";
const MCP_SERVER_ARGS = process.env.MCP_SERVER_ARGS ? process.env.MCP_SERVER_ARGS.split(" ") : ["-y", "@modelcontextprotocol/server-puppeteer"];

/**
 * Creates and initializes an MCP Client connected to the target MCP browser server.
 * @returns {Promise<{ client: Client, transport: StdioClientTransport }>}
 */
export async function getMcpClient() {
  const transport = new StdioClientTransport({
    command: MCP_SERVER_CMD,
    args: MCP_SERVER_ARGS,
  });

  const client = new Client(
    { name: "threadline-scraper", version: "1.0.0" },
    { capabilities: {} }
  );

  console.log(`[mcp-client] Connecting to MCP Server: ${MCP_SERVER_CMD} ${MCP_SERVER_ARGS.join(" ")}`);
  await client.connect(transport);
  console.log("[mcp-client] Connection established.");

  return { client, transport };
}

/**
 * Helper to gracefully close the MCP client.
 */
export async function closeMcpClient(client, transport) {
  try {
    await transport.close();
  } catch (err) {
    console.warn(`[mcp-client] Error closing transport: ${err.message}`);
  }
}

/**
 * Navigate to a specific URL using the MCP server's browser tool.
 */
export async function mcpNavigate(client, url) {
  console.log(`[mcp-client] Navigating to ${url}`);
  try {
    const result = await client.callTool({
      name: "puppeteer_navigate",
      arguments: { url }
    });
    return result;
  } catch (err) {
    throw new Error(`MCP Navigation failed: ${err.message}`);
  }
}

/**
 * Execute JavaScript on the current page using the MCP server.
 */
export async function mcpEvaluate(client, script) {
  console.log(`[mcp-client] Evaluating script...`);
  try {
    const result = await client.callTool({
      name: "puppeteer_evaluate",
      arguments: { script }
    });
    
    // Attempt to extract the text output from the standard MCP result array format
    if (result && result.content && result.content.length > 0) {
      if (result.content[0].type === "text") {
        return result.content[0].text;
      }
    }
  } catch (err) {
    throw new Error(`MCP Evaluation failed: ${err.message}`);
  }
  return "";
}

/**
 * Ask the MCP server to hover an element on the page.
 */
export async function mcpHover(client, selector) {
  try {
    await client.callTool({
      name: "puppeteer_hover",
      arguments: { selector }
    });
  } catch (err) {
    console.warn(`[mcp-client] Hover failed: ${err.message}`);
  }
}

/**
 * Ask the MCP server to click an element on the page.
 */
export async function mcpClick(client, selector) {
  try {
    await client.callTool({
      name: "puppeteer_click",
      arguments: { selector }
    });
  } catch (err) {
    console.warn(`[mcp-client] Click failed: ${err.message}`);
  }
}
