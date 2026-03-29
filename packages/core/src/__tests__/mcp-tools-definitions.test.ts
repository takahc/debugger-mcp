import { describe, it, expect } from "vitest";
import { TOOL_DEFINITIONS } from "../tools/definitions.js";
import { z } from "zod";

describe("TOOL_DEFINITIONS", () => {
  it("defines exactly 13 tools", () => {
    expect(TOOL_DEFINITIONS).toHaveLength(13);
  });

  it("all tools have unique names", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("all tool names start with 'debug_'", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name.startsWith("debug_")).toBe(true);
    }
  });

  it("all tools have a non-empty description", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("all tools have a Zod schema with a .shape property", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.schema).toBeDefined();
      expect(typeof tool.schema.shape).toBe("object");
    }
  });

  it("debug_launch schema requires adapter and program", () => {
    const launch = TOOL_DEFINITIONS.find((t) => t.name === "debug_launch")!;
    const result = launch.schema.safeParse({});
    expect(result.success).toBe(false);

    const valid = launch.schema.safeParse({ adapter: "python", program: "/tmp/t.py" });
    expect(valid.success).toBe(true);
  });

  it("debug_launch adapter accepts only 'python' | 'node'", () => {
    const launch = TOOL_DEFINITIONS.find((t) => t.name === "debug_launch")!;
    expect(launch.schema.safeParse({ adapter: "go", program: "/tmp/t.go" }).success).toBe(false);
    expect(launch.schema.safeParse({ adapter: "python", program: "/tmp/t.py" }).success).toBe(true);
    expect(launch.schema.safeParse({ adapter: "node", program: "/tmp/t.js" }).success).toBe(true);
  });

  it("debug_attach schema requires adapter and port", () => {
    const attach = TOOL_DEFINITIONS.find((t) => t.name === "debug_attach")!;
    expect(attach.schema.safeParse({ adapter: "python" }).success).toBe(false); // missing port
    expect(attach.schema.safeParse({ adapter: "python", port: 5678 }).success).toBe(true);
  });

  it("debug_attach port must be within valid range", () => {
    const attach = TOOL_DEFINITIONS.find((t) => t.name === "debug_attach")!;
    expect(attach.schema.safeParse({ adapter: "python", port: 0 }).success).toBe(false);
    expect(attach.schema.safeParse({ adapter: "python", port: 65535 }).success).toBe(true);
    expect(attach.schema.safeParse({ adapter: "python", port: 65536 }).success).toBe(false);
  });

  it("debug_set_breakpoint line must be at least 1", () => {
    const bp = TOOL_DEFINITIONS.find((t) => t.name === "debug_set_breakpoint")!;
    expect(bp.schema.safeParse({ sessionId: "s", file: "/f.py", line: 0 }).success).toBe(false);
    expect(bp.schema.safeParse({ sessionId: "s", file: "/f.py", line: 1 }).success).toBe(true);
  });

  it("schemas with optional fields accept missing values", () => {
    const launch = TOOL_DEFINITIONS.find((t) => t.name === "debug_launch")!;
    const result = launch.schema.safeParse({ adapter: "node", program: "/tmp/t.js" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toBeUndefined();
      expect(result.data.env).toBeUndefined();
      expect(result.data.stopOnEntry).toBe(false); // default
    }
  });

  it("debug_evaluate requires sessionId and expression", () => {
    const ev = TOOL_DEFINITIONS.find((t) => t.name === "debug_evaluate")!;
    expect(ev.schema.safeParse({ sessionId: "s" }).success).toBe(false);
    expect(ev.schema.safeParse({ sessionId: "s", expression: "x + 1" }).success).toBe(true);
  });

  it("tools requiring sessionId reject when it's missing", () => {
    const sessionTools = TOOL_DEFINITIONS.filter((t) =>
      "sessionId" in t.schema.shape,
    );
    // All session-scoped tools should fail without sessionId
    for (const tool of sessionTools) {
      const result = tool.schema.safeParse({});
      expect(result.success).toBe(false);
    }
  });
});
