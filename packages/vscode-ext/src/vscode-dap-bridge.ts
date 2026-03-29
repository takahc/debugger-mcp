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

  // VSCode handles launch/attach via startDebugging() in VscodeSessionFactory.
  // These are no-ops here because the session is already running by the time
  // the adapter is returned from createSession().
  async launch(_config: Record<string, unknown>): Promise<void> {}
  async attach(_config: Record<string, unknown>): Promise<void> {}

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

  /** Register a one-time handler that fires when the session terminates. */
  onTerminated(handler: () => void): void {
    this._terminatedHandlers.push(handler);
  }

  private _terminatedHandlers: Array<() => void> = [];

  /** Called by the extension when a stopped event arrives for this session. */
  onStopped(threadId: number): void {
    this._state = "paused";
    this.threadId = threadId;
    this.cachedFrames = [];
  }

  /** Called by the extension when the session terminates. */
  onTerminated_internal(): void {
    this._state = "terminated";
    for (const h of this._terminatedHandlers) h();
    this._terminatedHandlers = [];
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
 * Manages the mapping between MCP session IDs and VSCode debug sessions.
 */
export class VscodeSessionFactory {
  private adapters = new Map<string, VscodeDebugSessionAdapter>();

  /**
   * Create a deferred adapter whose underlying VSCode session is populated
   * when launch() or attach() is called on the adapter.
   */
  createDeferred(id: string, config: Record<string, unknown>): DeferredVscodeAdapter {
    const adapter = new DeferredVscodeAdapter(id, config, this);
    return adapter;
  }

  /** Called by DeferredVscodeAdapter after a VSCode session starts. */
  register(vscodeSessionId: string, adapter: VscodeDebugSessionAdapter): void {
    this.adapters.set(vscodeSessionId, adapter);
  }

  getByVscodeId(vscodeSessionId: string): VscodeDebugSessionAdapter | undefined {
    return this.adapters.get(vscodeSessionId);
  }

  removeByVscodeId(vscodeSessionId: string): void {
    this.adapters.delete(vscodeSessionId);
  }

  buildLaunchConfig(adapter: "python" | "node", config: Record<string, unknown>): vscode.DebugConfiguration {
    if (adapter === "python") {
      return {
        type: "debugpy", request: "launch", name: "Debugger MCP: Python",
        program: config["program"] as string,
        args: (config["args"] as string[] | undefined) ?? [],
        cwd: config["cwd"] as string | undefined,
        env: config["env"] as Record<string, string> | undefined,
        stopOnEntry: (config["stopOnEntry"] as boolean | undefined) ?? false,
        python: config["pythonPath"] as string | undefined,
      };
    }
    return {
      type: "node", request: "launch", name: "Debugger MCP: Node",
      program: config["program"] as string,
      args: (config["args"] as string[] | undefined) ?? [],
      cwd: config["cwd"] as string | undefined,
      env: config["env"] as Record<string, string> | undefined,
      stopOnEntry: (config["stopOnEntry"] as boolean | undefined) ?? false,
    };
  }

  buildAttachConfig(adapter: "python" | "node", config: Record<string, unknown>): vscode.DebugConfiguration {
    const host = (config["host"] as string | undefined) ?? "127.0.0.1";
    const port = config["port"] as number;
    if (adapter === "python") {
      return { type: "debugpy", request: "attach", name: "Debugger MCP: Attach Python", connect: { host, port } };
    }
    return { type: "node", request: "attach", name: "Debugger MCP: Attach Node", address: host, port };
  }
}

  getByVscodeId(vscodeSessionId: string): VscodeDebugSessionAdapter | undefined {
    return this.adapters.get(vscodeSessionId);
  }

  removeByVscodeId(vscodeSessionId: string): void {
    this.adapters.delete(vscodeSessionId);
  }

}

/**
 * A proxy IDebugSession that defers the actual VSCode session start until
 * launch() or attach() is called.  All debug commands are forwarded to
 * an inner VscodeDebugSessionAdapter once the session is live.
 */
export class DeferredVscodeAdapter implements IDebugSession {
  readonly id: string;
  private inner: VscodeDebugSessionAdapter | undefined;
  private _terminatedHandlers: Array<() => void> = [];

  constructor(
    id: string,
    private config: Record<string, unknown>,
    private factory: VscodeSessionFactory,
  ) {
    this.id = id;
  }

  private get live(): VscodeDebugSessionAdapter {
    if (!this.inner) throw new Error(`Session ${this.id} not yet started`);
    return this.inner;
  }

  private async startVscode(request: "launch" | "attach"): Promise<void> {
    const adapterType = this.config["adapter"] as "python" | "node";
    const debugConfig =
      request === "launch"
        ? this.factory.buildLaunchConfig(adapterType, this.config)
        : this.factory.buildAttachConfig(adapterType, this.config);

    const started = await vscode.debug.startDebugging(undefined, debugConfig);
    if (!started) throw new Error(`Failed to ${request} debug session`);

    const vsSession = vscode.debug.activeDebugSession;
    if (!vsSession) throw new Error("No active debug session after start");

    this.inner = new VscodeDebugSessionAdapter(this.id, vsSession);
    this.factory.register(vsSession.id, this.inner);

    // Forward registered terminated handlers
    for (const h of this._terminatedHandlers) this.inner.onTerminated(h);
    this._terminatedHandlers = [];
  }

  async launch(config: Record<string, unknown>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.startVscode("launch");
  }

  async attach(config: Record<string, unknown>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.startVscode("attach");
  }

  onTerminated(handler: () => void): void {
    if (this.inner) { this.inner.onTerminated(handler); }
    else { this._terminatedHandlers.push(handler); }
  }

  setBreakpoints(source: { path?: string }, lines: number[]) { return this.live.setBreakpoints(source, lines); }
  removeBreakpoints(source: { path?: string })               { return this.live.removeBreakpoints(source); }
  continue(threadId?: number)                                { return this.live.continue(threadId); }
  stepOver(threadId?: number)                                { return this.live.stepOver(threadId); }
  stepInto(threadId?: number)                                { return this.live.stepInto(threadId); }
  stepOut(threadId?: number)                                 { return this.live.stepOut(threadId); }
  getStackTrace(threadId?: number)                           { return this.live.getStackTrace(threadId); }
  getVariables(frameId: number)                              { return this.live.getVariables(frameId); }
  evaluate(expression: string, frameId?: number)             { return this.live.evaluate(expression, frameId); }
  getSource(sourceReference: number)                         { return this.live.getSource(sourceReference); }
  disconnect()                                               { return this.live.disconnect(); }

  snapshot(): SessionSnapshot {
    return this.inner?.snapshot() ?? {
      id: this.id, state: "idle", threadId: undefined, stackFrames: [],
    };
  }
}
