import * as vscode from "vscode";
import type {
  IDebugSession,
  SessionState,
  SessionSnapshot,
  StackFrame,
  Variable,
  SourceContent,
} from "@debugger-mcp/core";
import type { DebugProtocol as DP } from "@vscode/debugprotocol";

/**
 * Adapts a vscode.DebugSession to the IDebugSession interface.
 * Uses vscode.debug.customRequest() instead of raw DAP sockets,
 * so VSCode handles all adapter lifecycle management.
 */
export class VscodeDebugSessionAdapter implements IDebugSession {
  readonly id: string;
  private _state: SessionState = "running";
  private cachedFrames: StackFrame[] = [];
  private threadId: number | undefined;

  constructor(id: string, private vsSession: vscode.DebugSession) {
    this.id = id;
  }

  private req<T>(command: string, args?: unknown): Thenable<T> {
    return this.vsSession.customRequest(command, args);
  }

  async setBreakpoints(source: { path?: string }, lines: number[]): Promise<DP.Breakpoint[]> {
    const r = await this.req<DP.SetBreakpointsResponse["body"]>("setBreakpoints", {
      source,
      breakpoints: lines.map((l) => ({ line: l })),
    });
    return r.breakpoints;
  }

  async removeBreakpoints(source: { path?: string }): Promise<void> {
    await this.req("setBreakpoints", { source, breakpoints: [] });
  }

  async continue(threadId?: number): Promise<void> {
    await this.req("continue", {
      threadId: threadId ?? this.threadId ?? 1,
      singleThread: false,
    });
    this._state = "running";
  }

  async stepOver(threadId?: number): Promise<void> {
    await this.req("next", { threadId: threadId ?? this.threadId ?? 1 });
  }

  async stepInto(threadId?: number): Promise<void> {
    await this.req("stepIn", { threadId: threadId ?? this.threadId ?? 1 });
  }

  async stepOut(threadId?: number): Promise<void> {
    await this.req("stepOut", { threadId: threadId ?? this.threadId ?? 1 });
  }

  async getStackTrace(threadId?: number): Promise<StackFrame[]> {
    const tid = threadId ?? this.threadId ?? 1;
    const r = await this.req<DP.StackTraceResponse["body"]>("stackTrace", {
      threadId: tid,
      startFrame: 0,
      levels: 20,
    });
    this.cachedFrames = r.stackFrames.map((f) => ({
      id: f.id,
      name: f.name,
      line: f.line,
      column: f.column,
      source: f.source ? { path: f.source.path, name: f.source.name } : undefined,
    }));
    return this.cachedFrames;
  }

  async getVariables(frameId: number): Promise<Variable[]> {
    const { scopes } = await this.req<DP.ScopesResponse["body"]>("scopes", { frameId });
    const all: Variable[] = [];
    for (const scope of scopes) {
      const { variables } = await this.req<DP.VariablesResponse["body"]>("variables", {
        variablesReference: scope.variablesReference,
      });
      all.push(
        ...variables.map((v) => ({
          name: v.name,
          value: v.value,
          type: v.type,
          variablesReference: v.variablesReference,
        })),
      );
    }
    return all;
  }

  async evaluate(expression: string, frameId?: number): Promise<string> {
    const r = await this.req<DP.EvaluateResponse["body"]>("evaluate", {
      expression,
      frameId: frameId ?? this.cachedFrames[0]?.id,
      context: "repl",
    });
    return r.result;
  }

  async getSource(sourceReference: number): Promise<SourceContent> {
    const r = await this.req<DP.SourceResponse["body"]>("source", { sourceReference });
    return { content: r.content, mimeType: r.mimeType };
  }

  async disconnect(): Promise<void> {
    await vscode.debug.stopDebugging(this.vsSession);
    this._state = "terminated";
  }

  /** Called by the extension when a stopped event arrives for this session. */
  onStopped(threadId: number): void {
    this._state = "paused";
    this.threadId = threadId;
    this.cachedFrames = [];
  }

  /** Called by the extension when the session terminates. */
  onTerminated(): void {
    this._state = "terminated";
  }

  snapshot(): SessionSnapshot {
    return {
      id: this.id,
      state: this._state,
      threadId: this.threadId,
      stackFrames: [...this.cachedFrames],
    };
  }
}

/**
 * SessionFactory for the VSCode extension.
 * When debug_launch is called, it starts a VSCode debug session using
 * vscode.debug.startDebugging(), then wraps it in VscodeDebugSessionAdapter.
 */
export class VscodeSessionFactory {
  private adapters = new Map<string, VscodeDebugSessionAdapter>();

  async createAndLaunch(
    id: string,
    config: Record<string, unknown>,
  ): Promise<VscodeDebugSessionAdapter> {
    const adapter = config["adapter"] as "python" | "node";
    const launchConfig: vscode.DebugConfiguration = this.buildLaunchConfig(adapter, config);

    const started = await vscode.debug.startDebugging(undefined, launchConfig);
    if (!started) throw new Error("Failed to start debug session");

    const vsSession = vscode.debug.activeDebugSession;
    if (!vsSession) throw new Error("No active debug session after start");

    const sessionAdapter = new VscodeDebugSessionAdapter(id, vsSession);
    this.adapters.set(vsSession.id, sessionAdapter);

    return sessionAdapter;
  }

  async createAndAttach(
    id: string,
    config: Record<string, unknown>,
  ): Promise<VscodeDebugSessionAdapter> {
    const adapter = config["adapter"] as "python" | "node";
    const attachConfig: vscode.DebugConfiguration = this.buildAttachConfig(adapter, config);

    const started = await vscode.debug.startDebugging(undefined, attachConfig);
    if (!started) throw new Error("Failed to attach to debug session");

    const vsSession = vscode.debug.activeDebugSession;
    if (!vsSession) throw new Error("No active debug session after attach");

    const sessionAdapter = new VscodeDebugSessionAdapter(id, vsSession);
    this.adapters.set(vsSession.id, sessionAdapter);

    return sessionAdapter;
  }

  getByVscodeId(vscodeSessionId: string): VscodeDebugSessionAdapter | undefined {
    return this.adapters.get(vscodeSessionId);
  }

  removeByVscodeId(vscodeSessionId: string): void {
    this.adapters.delete(vscodeSessionId);
  }

  private buildLaunchConfig(
    adapter: "python" | "node",
    config: Record<string, unknown>,
  ): vscode.DebugConfiguration {
    if (adapter === "python") {
      return {
        type: "debugpy",
        request: "launch",
        name: "Debugger MCP: Python",
        program: config["program"] as string,
        args: (config["args"] as string[] | undefined) ?? [],
        cwd: config["cwd"] as string | undefined,
        env: config["env"] as Record<string, string> | undefined,
        stopOnEntry: (config["stopOnEntry"] as boolean | undefined) ?? false,
        python: config["pythonPath"] as string | undefined,
      };
    } else {
      return {
        type: "node",
        request: "launch",
        name: "Debugger MCP: Node",
        program: config["program"] as string,
        args: (config["args"] as string[] | undefined) ?? [],
        cwd: config["cwd"] as string | undefined,
        env: config["env"] as Record<string, string> | undefined,
        stopOnEntry: (config["stopOnEntry"] as boolean | undefined) ?? false,
      };
    }
  }

  private buildAttachConfig(
    adapter: "python" | "node",
    config: Record<string, unknown>,
  ): vscode.DebugConfiguration {
    const host = (config["host"] as string | undefined) ?? "127.0.0.1";
    const port = config["port"] as number;

    if (adapter === "python") {
      return {
        type: "debugpy",
        request: "attach",
        name: "Debugger MCP: Attach Python",
        connect: { host, port },
      };
    } else {
      return {
        type: "node",
        request: "attach",
        name: "Debugger MCP: Attach Node",
        address: host,
        port,
      };
    }
  }
}
