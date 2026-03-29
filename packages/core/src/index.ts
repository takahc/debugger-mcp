// DAP
export { DapClient, streamTransport } from "./dap/client.js";
export type { IDapTransport } from "./dap/client.js";
export { DapFrameDecoder, encodeMessage } from "./dap/framing.js";
export { DebugSession } from "./dap/session.js";
export type {
  IDebugSession,
  SessionState,
  SessionSnapshot,
  StackFrame,
  Variable,
  SourceContent,
  DapMessage,
  DapRequest,
  DapResponse,
  DapEvent,
} from "./dap/types.js";

// MCP Tools
export { TOOL_DEFINITIONS } from "./tools/definitions.js";
export { ToolDispatcher } from "./tools/handlers.js";
export type { SessionFactory, McpToolResult } from "./tools/handlers.js";
