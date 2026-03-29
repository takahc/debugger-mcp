import { randomUUID } from "node:crypto";
import type { IDebugSession, SessionSnapshot } from "../dap/types.js";

export interface SessionFactory {
  createSession(
    id: string,
    adapter: "python" | "node",
    config: Record<string, unknown>,
  ): Promise<IDebugSession>;
}

export type McpToolResult = {
  content: [{ type: "text"; text: string }];
  isError?: boolean;
};

function ok(data: unknown): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(msg: string): McpToolResult {
  return { isError: true, content: [{ type: "text", text: msg }] };
}

export class ToolDispatcher {
  private sessions = new Map<string, IDebugSession>();

  constructor(private factory: SessionFactory) {}

  async dispatch(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    try {
      switch (name) {
        case "debug_launch":            return await this.launch(args);
        case "debug_attach":            return await this.attach(args);
        case "debug_set_breakpoint":    return await this.setBreakpoint(args);
        case "debug_remove_breakpoint": return await this.removeBreakpoint(args);
        case "debug_continue":          return await this.step("continue", args);
        case "debug_step_over":         return await this.step("stepOver", args);
        case "debug_step_into":         return await this.step("stepInto", args);
        case "debug_step_out":          return await this.step("stepOut", args);
        case "debug_get_stack_trace":   return await this.getStackTrace(args);
        case "debug_get_variables":     return await this.getVariables(args);
        case "debug_evaluate":          return await this.evaluate(args);
        case "debug_get_source":        return await this.getSource(args);
        case "debug_stop":              return await this.stop(args);
        case "debug_list_sessions":     return this.listSessions();
        default:                        return err(`Unknown tool: ${name}`);
      }
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  }

  private getSession(sessionId: string): IDebugSession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`No active session: ${sessionId}`);
    return s;
  }

  private registerSession(session: IDebugSession): void {
    this.sessions.set(session.id, session);
    session.onTerminated(() => this.sessions.delete(session.id));
  }

  private async launch(args: Record<string, unknown>): Promise<McpToolResult> {
    const id = randomUUID();
    const adapter = args["adapter"] as "python" | "node";
    const session = await this.factory.createSession(id, adapter, args);
    this.registerSession(session);
    await session.launch(args);
    return ok({
      sessionId: id,
      status: "launched",
      message: "Session started. Set breakpoints with debug_set_breakpoint, then use debug_continue.",
    });
  }

  private async attach(args: Record<string, unknown>): Promise<McpToolResult> {
    const id = randomUUID();
    const adapter = args["adapter"] as "python" | "node";
    const session = await this.factory.createSession(id, adapter, args);
    this.registerSession(session);
    await session.attach(args);
    return ok({ sessionId: id, status: "attached" });
  }

  private async setBreakpoint(args: Record<string, unknown>): Promise<McpToolResult> {
    const s = this.getSession(args["sessionId"] as string);
    const bps = await s.setBreakpoints(
      { path: args["file"] as string },
      [args["line"] as number],
    );
    return ok({ breakpoints: bps });
  }

  private async removeBreakpoint(args: Record<string, unknown>): Promise<McpToolResult> {
    await this.getSession(args["sessionId"] as string)
      .removeBreakpoints({ path: args["file"] as string });
    return ok({ removed: true });
  }

  private async step(
    method: "continue" | "stepOver" | "stepInto" | "stepOut",
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    await this.getSession(args["sessionId"] as string)[method](
      args["threadId"] as number | undefined,
    );
    return ok({ status: method === "continue" ? "running" : "stepping" });
  }

  private async getStackTrace(args: Record<string, unknown>): Promise<McpToolResult> {
    const frames = await this.getSession(args["sessionId"] as string)
      .getStackTrace(args["threadId"] as number | undefined);
    return ok({ stackFrames: frames });
  }

  private async getVariables(args: Record<string, unknown>): Promise<McpToolResult> {
    const vars = await this.getSession(args["sessionId"] as string)
      .getVariables(args["frameId"] as number);
    return ok({ variables: vars });
  }

  private async evaluate(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.getSession(args["sessionId"] as string)
      .evaluate(args["expression"] as string, args["frameId"] as number | undefined);
    return ok({ result });
  }

  private async getSource(args: Record<string, unknown>): Promise<McpToolResult> {
    const src = await this.getSession(args["sessionId"] as string)
      .getSource(args["sourceReference"] as number);
    return ok(src);
  }

  private async stop(args: Record<string, unknown>): Promise<McpToolResult> {
    const sid = args["sessionId"] as string;
    const s = this.getSession(sid);
    await s.disconnect();
    this.sessions.delete(sid);
    return ok({ status: "terminated" });
  }

  listSessions(): McpToolResult {
    const sessions: SessionSnapshot[] = [...this.sessions.values()].map((s) => s.snapshot());
    return ok({ sessions });
  }
}
