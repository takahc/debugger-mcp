import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOOL_DEFINITIONS, ToolDispatcher } from "@debugger-mcp/core";
import { ProcessSessionFactory } from "./adapter/spawner.js";

export function createServer(): McpServer {
  const dispatcher = new ToolDispatcher(new ProcessSessionFactory());

  const server = new McpServer({
    name: "debugger-mcp",
    version: "0.1.0",
  });

  for (const tool of TOOL_DEFINITIONS) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      async (args: Record<string, unknown>) => dispatcher.dispatch(tool.name, args),
    );
  }

  return server;
}
