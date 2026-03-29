import * as vscode from "vscode";
import { EmbeddedMcpServer } from "./embedded-mcp-server.js";

let embeddedServer: EmbeddedMcpServer | undefined;
let statusBarItem: vscode.StatusBarItem;

export function activate(ctx: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "debuggerMcp.showAddress";
  ctx.subscriptions.push(statusBarItem);

  ctx.subscriptions.push(
    vscode.commands.registerCommand("debuggerMcp.start", () => startServer(ctx)),
    vscode.commands.registerCommand("debuggerMcp.stop", () => stopServer()),
    vscode.commands.registerCommand("debuggerMcp.showAddress", () => showAddress()),
  );

  // Auto-start if configured
  const config = vscode.workspace.getConfiguration("debuggerMcp");
  if (config.get<boolean>("autoStart", true)) {
    startServer(ctx);
  }

  // Track VSCode debug session events to update adapter state
  ctx.subscriptions.push(
    vscode.debug.onDidReceiveDebugSessionCustomEvent((e) => {
      if (e.event === "stopped" && embeddedServer) {
        const adapter = embeddedServer.vscodeFactory.getByVscodeId(e.session.id);
        if (adapter) {
          adapter.onStopped(e.body?.threadId ?? 1);
        }
      }
    }),
    vscode.debug.onDidTerminateDebugSession((session) => {
      if (embeddedServer) {
        const adapter = embeddedServer.vscodeFactory.getByVscodeId(session.id);
        if (adapter) {
          adapter.onTerminated_internal();
          embeddedServer.vscodeFactory.removeByVscodeId(session.id);
        }
      }
    }),
  );
}

export function deactivate(): Thenable<void> | undefined {
  return embeddedServer?.stop();
}

async function startServer(ctx: vscode.ExtensionContext): Promise<void> {
  if (embeddedServer) {
    vscode.window.showInformationMessage(`Debugger MCP is already running at ${embeddedServer.address}`);
    return;
  }

  try {
    const config = vscode.workspace.getConfiguration("debuggerMcp");
    const port = config.get<number>("port", 0);

    embeddedServer = new EmbeddedMcpServer();
    await embeddedServer.start(port);

    statusBarItem.text = "$(debug) MCP";
    statusBarItem.tooltip = `Debugger MCP server: ${embeddedServer.address}`;
    statusBarItem.show();

    // Save the address to workspace state so other tools can find it
    await ctx.workspaceState.update("debuggerMcp.address", embeddedServer.address);

    vscode.window.showInformationMessage(
      `Debugger MCP server started at ${embeddedServer.address}`,
      "Copy Address",
    ).then((choice) => {
      if (choice === "Copy Address" && embeddedServer) {
        vscode.env.clipboard.writeText(embeddedServer.address);
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    vscode.window.showErrorMessage(`Failed to start Debugger MCP: ${msg}`);
    embeddedServer = undefined;
  }
}

async function stopServer(): Promise<void> {
  if (!embeddedServer) {
    vscode.window.showInformationMessage("Debugger MCP server is not running.");
    return;
  }
  await embeddedServer.stop();
  embeddedServer = undefined;
  statusBarItem.hide();
  vscode.window.showInformationMessage("Debugger MCP server stopped.");
}

function showAddress(): void {
  if (!embeddedServer) {
    vscode.window.showInformationMessage("Debugger MCP server is not running.");
    return;
  }
  vscode.window.showInformationMessage(embeddedServer.address, "Copy").then((choice) => {
    if (choice === "Copy" && embeddedServer) {
      vscode.env.clipboard.writeText(embeddedServer.address);
    }
  });
}
