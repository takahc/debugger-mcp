import { EventEmitter } from "node:events";
import type { DebugProtocol as DP } from "@vscode/debugprotocol";
import { DapClient, type IDapTransport } from "./client.js";
import type {
  IDebugSession,
  SessionState,
  SessionSnapshot,
  StackFrame,
  Variable,
  SourceContent,
} from "./types.js";

export class DebugSession extends EventEmitter implements IDebugSession {
  readonly id: string;
  private client: DapClient;
  private state: SessionState = "idle";
  private threadId: number | undefined;
  private cachedFrames: StackFrame[] = [];
  private capabilities: DP.Capabilities = {};

  constructor(id: string, transport: IDapTransport) {
    super();
    this.id = id;
    this.client = new DapClient(transport);
    this.wireEvents();
  }

  private wireEvents(): void {
    this.client.on("event:stopped", (body: DP.StoppedEvent["body"]) => {
      this.state = "paused";
      this.threadId = body.threadId;
      this.cachedFrames = [];
      this.emit("stateChange", this.state, body);
    });
    this.client.on("event:continued", () => {
      this.state = "running";
      this.emit("stateChange", this.state);
    });
    const terminate = () => {
      if (this.state === "terminated") return;
      this.state = "terminated";
      this.emit("stateChange", this.state);
      this.emit("terminated");
    };
    this.client.on("event:terminated", terminate);
    this.client.on("event:output", (body: DP.OutputEvent["body"]) => {
      this.emit("output", body);
    });
    this.client.on("close", terminate);
  }

  /** Register a one-time handler that fires when the session ends. */
  onTerminated(handler: () => void): void {
    this.once("terminated", handler);
  }

  async initialize(adapterID: string): Promise<void> {
    // Wait for `initialized` event which arrives asynchronously after the response
    const initializedPromise = new Promise<void>((resolve) => {
      this.client.once("event:initialized", () => resolve());
    });

    this.capabilities = await this.client.sendRequest<
      DP.InitializeRequestArguments,
      DP.Capabilities
    >("initialize", {
      adapterID,
      clientID: "debugger-mcp",
      clientName: "Debugger MCP",
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsRunInTerminalRequest: false,
    });

    await initializedPromise;
    this.state = "initializing";
  }

  async launch(args: Record<string, unknown>): Promise<void> {
    await this.client.sendRequest("launch", args);
    this.state = "launched";
    await this.client.sendRequest("configurationDone", {});
    this.state = "running";
  }

  async attach(args: Record<string, unknown>): Promise<void> {
    await this.client.sendRequest("attach", args);
    this.state = "launched";
    await this.client.sendRequest("configurationDone", {});
    this.state = "running";
  }

  async setBreakpoints(source: { path?: string }, lines: number[]): Promise<DP.Breakpoint[]> {
    const r = await this.client.sendRequest<
      DP.SetBreakpointsArguments,
      DP.SetBreakpointsResponse["body"]
    >("setBreakpoints", {
      source,
      breakpoints: lines.map((l) => ({ line: l })),
    });
    return r.breakpoints;
  }

  async removeBreakpoints(source: { path?: string }): Promise<void> {
    await this.client.sendRequest("setBreakpoints", { source, breakpoints: [] });
  }

  async continue(threadId?: number): Promise<void> {
    await this.client.sendRequest("continue", {
      threadId: threadId ?? this.threadId ?? 1,
      singleThread: false,
    });
  }

  async stepOver(threadId?: number): Promise<void> {
    await this.client.sendRequest("next", {
      threadId: threadId ?? this.threadId ?? 1,
    });
  }

  async stepInto(threadId?: number): Promise<void> {
    await this.client.sendRequest("stepIn", {
      threadId: threadId ?? this.threadId ?? 1,
    });
  }

  async stepOut(threadId?: number): Promise<void> {
    await this.client.sendRequest("stepOut", {
      threadId: threadId ?? this.threadId ?? 1,
    });
  }

  async getStackTrace(threadId?: number): Promise<StackFrame[]> {
    const tid = threadId ?? this.threadId ?? 1;
    const r = await this.client.sendRequest<
      DP.StackTraceArguments,
      DP.StackTraceResponse["body"]
    >("stackTrace", { threadId: tid, startFrame: 0, levels: 20 });
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
    const scopeResp = await this.client.sendRequest<
      DP.ScopesArguments,
      DP.ScopesResponse["body"]
    >("scopes", { frameId });

    const all: Variable[] = [];
    for (const scope of scopeResp.scopes) {
      const varResp = await this.client.sendRequest<
        DP.VariablesArguments,
        DP.VariablesResponse["body"]
      >("variables", { variablesReference: scope.variablesReference });
      all.push(
        ...varResp.variables.map((v) => ({
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
    const r = await this.client.sendRequest<
      DP.EvaluateArguments,
      DP.EvaluateResponse["body"]
    >("evaluate", {
      expression,
      frameId: frameId ?? this.cachedFrames[0]?.id,
      context: "repl",
    });
    return r.result;
  }

  async getSource(sourceReference: number): Promise<SourceContent> {
    const r = await this.client.sendRequest<
      DP.SourceArguments,
      DP.SourceResponse["body"]
    >("source", { sourceReference });
    return { content: r.content, mimeType: r.mimeType };
  }

  async disconnect(): Promise<void> {
    await this.client
      .sendRequest("disconnect", { restart: false, terminateDebuggee: true })
      .catch(() => undefined);
    this.state = "terminated";
    this.client.dispose();
  }

  snapshot(): SessionSnapshot {
    return {
      id: this.id,
      state: this.state,
      threadId: this.threadId,
      stackFrames: [...this.cachedFrames],
    };
  }
}
