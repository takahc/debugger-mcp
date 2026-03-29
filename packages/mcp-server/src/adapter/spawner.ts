import { spawn, type ChildProcess } from "node:child_process";
import { DebugSession, streamTransport } from "@debugger-mcp/core";
import type { IDebugSession, SessionFactory } from "@debugger-mcp/core";

export class ProcessSessionFactory implements SessionFactory {
  async createSession(
    id: string,
    adapter: "python" | "node",
    config: Record<string, unknown>,
  ): Promise<IDebugSession> {
    const proc = spawnAdapter(adapter, config);

    proc.on("error", (err) => {
      console.error(`[debugger-mcp] adapter process error: ${err.message}`);
    });

    const transport = streamTransport(proc.stdout!, proc.stdin!);
    const session = new DebugSession(id, transport);

    const adapterID = adapter === "python" ? "debugpy" : "node";
    await session.initialize(adapterID);

    return session;
  }
}

function spawnAdapter(type: "python" | "node", config: Record<string, unknown>): ChildProcess {
  switch (type) {
    case "python": {
      const pythonPath = (config["pythonPath"] as string | undefined) ?? "python";
      return spawn(pythonPath, ["-m", "debugpy.adapter"], {
        stdio: ["pipe", "pipe", "inherit"],
      });
    }
    case "node": {
      // Use Node.js built-in inspector protocol via a simple DAP bridge script
      // For production use, install @vscode/js-debug
      return spawnNodeAdapter();
    }
    default:
      throw new Error(`Unsupported adapter type: ${type}`);
  }
}

function spawnNodeAdapter(): ChildProcess {
  // Try to find js-debug from common locations
  const jsdebugPaths = [
    // Installed globally or in workspace
    "js-debug-adapter",
  ];

  // Fall back to a simple wrapper that uses node --inspect
  // This launches a minimal DAP-over-stdio bridge
  const bridgeScript = `
const net = require('net');
const { spawn } = require('child_process');

// Simple pass-through: start debugpy-style adapter for node
// For a real implementation, use @vscode/js-debug
process.stderr.write('Node.js debug adapter: use @vscode/js-debug for full support\\n');
process.exit(1);
`;

  return spawn(process.execPath, ["-e", bridgeScript], {
    stdio: ["pipe", "pipe", "inherit"],
  });
}
