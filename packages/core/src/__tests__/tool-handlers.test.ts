import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolDispatcher, type SessionFactory } from "../tools/handlers.js";
import type { IDebugSession, SessionSnapshot, StackFrame, Variable, SourceContent } from "../dap/types.js";

// ── Mock session ───────────────────────────────────────────────────────────

function createMockSession(id: string): IDebugSession & { _state: string } {
  return {
    id,
    _state: "running",
    setBreakpoints: vi.fn().mockResolvedValue([
      { id: 1, verified: true, line: 10 },
    ]),
    removeBreakpoints: vi.fn().mockResolvedValue(undefined),
    continue: vi.fn().mockResolvedValue(undefined),
    stepOver: vi.fn().mockResolvedValue(undefined),
    stepInto: vi.fn().mockResolvedValue(undefined),
    stepOut: vi.fn().mockResolvedValue(undefined),
    getStackTrace: vi.fn().mockResolvedValue([
      { id: 1, name: "main", line: 10, column: 1, source: { path: "/tmp/test.py" } },
    ] satisfies StackFrame[]),
    getVariables: vi.fn().mockResolvedValue([
      { name: "x", value: "42", type: "int", variablesReference: 0 },
    ] satisfies Variable[]),
    evaluate: vi.fn().mockResolvedValue("42"),
    getSource: vi.fn().mockResolvedValue({
      content: "def main():\n    pass\n",
    } satisfies SourceContent),
    disconnect: vi.fn().mockResolvedValue(undefined),
    snapshot(): SessionSnapshot {
      return {
        id: this.id,
        state: this._state as "running",
        threadId: 1,
        stackFrames: [],
      };
    },
    launch: vi.fn().mockResolvedValue(undefined),
    attach: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Mock factory ───────────────────────────────────────────────────────────

function createMockFactory(session: IDebugSession): SessionFactory {
  return {
    async createSession(_id, _adapter, _config) {
      // Return session with the given id overridden
      return { ...session, id: _id };
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseResult(result: { content: [{ text: string }] }): unknown {
  return JSON.parse(result.content[0]!.text);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ToolDispatcher", () => {
  let mockSession: ReturnType<typeof createMockSession>;
  let dispatcher: ToolDispatcher;

  beforeEach(() => {
    mockSession = createMockSession("mock-session");
    const factory: SessionFactory = {
      async createSession(id, _adapter, _config) {
        return { ...mockSession, id };
      },
    };
    dispatcher = new ToolDispatcher(factory);
  });

  // ── debug_launch ───────────────────────────────────────────────────────

  describe("debug_launch", () => {
    it("returns a sessionId and status", async () => {
      const result = await dispatcher.dispatch("debug_launch", {
        adapter: "python",
        program: "/tmp/test.py",
        stopOnEntry: false,
      });
      const data = parseResult(result) as { sessionId: string; status: string };
      expect(data.sessionId).toBeTruthy();
      expect(data.status).toBe("launched");
    });

    it("generates a unique sessionId each time", async () => {
      const r1 = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/a.py" });
      const r2 = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/b.py" });
      const d1 = parseResult(r1) as { sessionId: string };
      const d2 = parseResult(r2) as { sessionId: string };
      expect(d1.sessionId).not.toBe(d2.sessionId);
    });
  });

  // ── set/remove breakpoints ────────────────────────────────────────────

  describe("debug_set_breakpoint", () => {
    it("calls setBreakpoints with correct file and line", async () => {
      const launchResult = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(launchResult) as { sessionId: string };

      const result = await dispatcher.dispatch("debug_set_breakpoint", {
        sessionId,
        file: "/tmp/t.py",
        line: 10,
      });

      expect(result.isError).toBeFalsy();
      const data = parseResult(result) as { breakpoints: unknown[] };
      expect(data.breakpoints).toBeDefined();
    });

    it("returns error for unknown sessionId", async () => {
      const result = await dispatcher.dispatch("debug_set_breakpoint", {
        sessionId: "does-not-exist",
        file: "/tmp/t.py",
        line: 5,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("does-not-exist");
    });
  });

  describe("debug_remove_breakpoint", () => {
    it("calls removeBreakpoints and returns removed: true", async () => {
      const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(r) as { sessionId: string };

      const result = await dispatcher.dispatch("debug_remove_breakpoint", {
        sessionId,
        file: "/tmp/t.py",
      });
      expect(parseResult(result)).toEqual({ removed: true });
    });
  });

  // ── step commands ──────────────────────────────────────────────────────

  for (const [toolName, expectedStatus] of [
    ["debug_continue", "running"],
    ["debug_step_over", "stepping"],
    ["debug_step_into", "stepping"],
    ["debug_step_out", "stepping"],
  ] as const) {
    describe(toolName, () => {
      it(`returns status '${expectedStatus}'`, async () => {
        const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
        const { sessionId } = parseResult(r) as { sessionId: string };
        const result = await dispatcher.dispatch(toolName, { sessionId });
        expect((parseResult(result) as { status: string }).status).toBe(expectedStatus);
      });

      it("passes optional threadId through", async () => {
        const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
        const { sessionId } = parseResult(r) as { sessionId: string };
        const result = await dispatcher.dispatch(toolName, { sessionId, threadId: 3 });
        expect(result.isError).toBeFalsy();
      });
    });
  }

  // ── debug_get_stack_trace ──────────────────────────────────────────────

  describe("debug_get_stack_trace", () => {
    it("returns stack frames", async () => {
      const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(r) as { sessionId: string };
      const result = await dispatcher.dispatch("debug_get_stack_trace", { sessionId });
      const data = parseResult(result) as { stackFrames: StackFrame[] };
      expect(Array.isArray(data.stackFrames)).toBe(true);
    });
  });

  // ── debug_get_variables ────────────────────────────────────────────────

  describe("debug_get_variables", () => {
    it("returns variables for given frameId", async () => {
      const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(r) as { sessionId: string };
      const result = await dispatcher.dispatch("debug_get_variables", { sessionId, frameId: 1 });
      const data = parseResult(result) as { variables: Variable[] };
      expect(Array.isArray(data.variables)).toBe(true);
    });
  });

  // ── debug_evaluate ─────────────────────────────────────────────────────

  describe("debug_evaluate", () => {
    it("returns evaluation result", async () => {
      const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(r) as { sessionId: string };
      const result = await dispatcher.dispatch("debug_evaluate", { sessionId, expression: "x + 1" });
      const data = parseResult(result) as { result: string };
      expect(data.result).toBe("42");
    });
  });

  // ── debug_get_source ───────────────────────────────────────────────────

  describe("debug_get_source", () => {
    it("returns source content", async () => {
      const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(r) as { sessionId: string };
      const result = await dispatcher.dispatch("debug_get_source", { sessionId, sourceReference: 42 });
      const data = parseResult(result) as { content: string };
      expect(typeof data.content).toBe("string");
    });
  });

  // ── debug_stop ─────────────────────────────────────────────────────────

  describe("debug_stop", () => {
    it("terminates the session and returns status terminated", async () => {
      const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(r) as { sessionId: string };

      const result = await dispatcher.dispatch("debug_stop", { sessionId });
      expect((parseResult(result) as { status: string }).status).toBe("terminated");
    });

    it("subsequent calls with same sessionId return error", async () => {
      const r = await dispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(r) as { sessionId: string };

      await dispatcher.dispatch("debug_stop", { sessionId });
      const result2 = await dispatcher.dispatch("debug_stop", { sessionId });
      expect(result2.isError).toBe(true);
    });
  });

  // ── unknown tool ───────────────────────────────────────────────────────

  describe("unknown tool", () => {
    it("returns an error result", async () => {
      const result = await dispatcher.dispatch("debug_fly_to_moon", {});
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("debug_fly_to_moon");
    });
  });

  // ── error propagation ──────────────────────────────────────────────────

  describe("error propagation", () => {
    it("returns isError when session method throws", async () => {
      const failFactory: SessionFactory = {
        async createSession(id) {
          return {
            ...mockSession,
            id,
            getVariables: vi.fn().mockRejectedValue(new Error("DAP timeout")),
          };
        },
      };
      const failDispatcher = new ToolDispatcher(failFactory);

      const r = await failDispatcher.dispatch("debug_launch", { adapter: "python", program: "/tmp/t.py" });
      const { sessionId } = parseResult(r) as { sessionId: string };

      const result = await failDispatcher.dispatch("debug_get_variables", { sessionId, frameId: 1 });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("DAP timeout");
    });
  });
});
