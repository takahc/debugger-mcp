import { z } from "zod";

export const DebugLaunchSchema = z.object({
  adapter: z.enum(["python", "node"]).describe("Debug adapter type"),
  program: z.string().describe("Absolute path to the program to debug"),
  args: z.array(z.string()).optional().describe("Program arguments"),
  cwd: z.string().optional().describe("Working directory"),
  env: z.record(z.string()).optional().describe("Environment variables"),
  stopOnEntry: z.boolean().optional().default(false).describe("Stop at first line"),
  pythonPath: z.string().optional().describe("Python interpreter path (Python only)"),
});

export const DebugAttachSchema = z.object({
  adapter: z.enum(["python", "node"]).describe("Debug adapter type"),
  host: z.string().default("127.0.0.1").describe("Debugger host"),
  port: z.number().int().min(1).max(65535).describe("Debugger port"),
});

export const SetBreakpointSchema = z.object({
  sessionId: z.string().describe("Session ID from debug_launch or debug_attach"),
  file: z.string().describe("Absolute path to the source file"),
  line: z.number().int().min(1).describe("Line number (1-based)"),
});

export const RemoveBreakpointSchema = z.object({
  sessionId: z.string(),
  file: z.string().describe("Remove all breakpoints in this file"),
});

export const SessionOnlySchema = z.object({
  sessionId: z.string(),
});

export const StepSchema = z.object({
  sessionId: z.string(),
  threadId: z.number().int().optional().describe("Thread ID (defaults to stopped thread)"),
});

export const GetVariablesSchema = z.object({
  sessionId: z.string(),
  frameId: z.number().int().describe("Stack frame ID from debug_get_stack_trace"),
});

export const EvaluateSchema = z.object({
  sessionId: z.string(),
  expression: z.string().describe("Expression to evaluate"),
  frameId: z.number().int().optional().describe("Stack frame context"),
});

export const GetSourceSchema = z.object({
  sessionId: z.string(),
  sourceReference: z
    .number()
    .int()
    .describe("sourceReference from a stack frame without a local path"),
});

export const TOOL_DEFINITIONS = [
  {
    name: "debug_launch" as const,
    description: "Launch a program under a debugger and start a debug session",
    schema: DebugLaunchSchema,
  },
  {
    name: "debug_attach" as const,
    description: "Attach to an already-running debugger process",
    schema: DebugAttachSchema,
  },
  {
    name: "debug_set_breakpoint" as const,
    description: "Set a breakpoint at a specific file and line",
    schema: SetBreakpointSchema,
  },
  {
    name: "debug_remove_breakpoint" as const,
    description: "Remove all breakpoints in a file",
    schema: RemoveBreakpointSchema,
  },
  {
    name: "debug_continue" as const,
    description: "Resume execution until the next breakpoint or program end",
    schema: StepSchema,
  },
  {
    name: "debug_step_over" as const,
    description: "Execute the current line and pause at the next line (step over function calls)",
    schema: StepSchema,
  },
  {
    name: "debug_step_into" as const,
    description: "Step into a function call on the current line",
    schema: StepSchema,
  },
  {
    name: "debug_step_out" as const,
    description: "Run until the current function returns",
    schema: StepSchema,
  },
  {
    name: "debug_get_stack_trace" as const,
    description: "Get the current call stack (use when paused at a breakpoint)",
    schema: StepSchema,
  },
  {
    name: "debug_get_variables" as const,
    description: "Get all variables in scope at a specific stack frame",
    schema: GetVariablesSchema,
  },
  {
    name: "debug_evaluate" as const,
    description: "Evaluate an expression in the current debug context",
    schema: EvaluateSchema,
  },
  {
    name: "debug_get_source" as const,
    description: "Retrieve source code for a frame that has no local file path",
    schema: GetSourceSchema,
  },
  {
    name: "debug_stop" as const,
    description: "Terminate the debug session",
    schema: SessionOnlySchema,
  },
  {
    name: "debug_list_sessions" as const,
    description: "List all active debug sessions and their current state",
    schema: z.object({}),
  },
] as const;
