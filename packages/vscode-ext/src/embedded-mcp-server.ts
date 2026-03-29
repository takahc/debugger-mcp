import * as http from "node:http";
import * as vscode from "vscode";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TOOL_DEFINITIONS, ToolDispatcher } from "@debugger-mcp/core";
import type { IDebugSession, SessionFactory } from "@debugger-mcp/core";
import { VscodeSessionFactory, VscodeDebugSessionAdapter } from "./vscode-dap-bridge.js";
import { randomUUID } from "node:crypto";

/**
 * SessionFactory for the VSCode extension.
 *
 * Because VSCode must start the debug session before we can wrap it in an
 * IDebugSession, the actual vscode.debug.startDebugging() call happens inside
 * the adapter's launch()/attach() methods rather than in createSession().
 * createSession() just creates a placeholder that becomes fully live once
 * launch() or attach() is called.
 */
class VscodeMcpSessionFactory implements SessionFactory {
  constructor(private vscodeFactory: VscodeSessionFactory) {}

  async createSession(
    id: string,
    _adapter: "python" | "node",
    config: Record<string, unknown>,
  ): Promise<IDebugSession> {
    // Return a deferred adapter. launch()/attach() will call VSCode APIs.
    return this.vscodeFactory.createDeferred(id, config);
  }
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export class EmbeddedMcpServer {
  private httpServer?: http.Server;
  private mcpServer?: McpServer;
  readonly vscodeFactory = new VscodeSessionFactory();
  address = "";

  async start(port = 0): Promise<void> {
    const factory = new VscodeMcpSessionFactory(this.vscodeFactory);
    const dispatcher = new ToolDispatcher(factory);

    this.mcpServer = new McpServer({
      name: "debugger-mcp-vscode",
      version: "0.1.0",
    });

    for (const tool of TOOL_DEFINITIONS) {
      this.mcpServer.tool(
        tool.name,
        tool.description,
        tool.schema.shape,
        async (args) => dispatcher.dispatch(tool.name, args as Record<string, unknown>),
      );
    }

    this.httpServer = http.createServer(async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      res.on("close", () => transport.close());
      await this.mcpServer!.connect(transport);
      await transport.handleRequest(req, res, await readBody(req));
    });

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(port, "127.0.0.1", () => {
        const addr = this.httpServer!.address() as { port: number };
        this.address = `http://127.0.0.1:${addr.port}/mcp`;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer?.close(() => resolve());
    });
  }
}
