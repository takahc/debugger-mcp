export type { DebugProtocol } from "@vscode/debugprotocol";

// ---- Wire-level message shapes ----------------------------------------

export interface DapMessage {
  seq: number;
  type: "request" | "response" | "event";
}

export interface DapRequest extends DapMessage {
  type: "request";
  command: string;
  arguments?: unknown;
}

export interface DapResponse extends DapMessage {
  type: "response";
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: unknown;
}

export interface DapEvent extends DapMessage {
  type: "event";
  event: string;
  body?: unknown;
}

export interface PendingRequest {
  command: string;
  resolve: (response: DapResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---- Session state ----------------------------------------------------

export type SessionState =
  | "idle"
  | "initializing"
  | "launched"
  | "running"
  | "paused"
  | "terminated";

export interface StackFrame {
  id: number;
  name: string;
  line: number;
  column: number;
  source?: { path?: string; name?: string };
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

export interface SourceContent {
  content: string;
  mimeType?: string;
}

export interface SessionSnapshot {
  id: string;
  state: SessionState;
  threadId: number | undefined;
  stackFrames: StackFrame[];
}

// ---- Abstract session interface (shared between core and vscode-ext) --

export interface IDebugSession {
  readonly id: string;
  setBreakpoints(source: { path?: string }, lines: number[]): Promise<unknown>;
  removeBreakpoints(source: { path?: string }): Promise<void>;
  continue(threadId?: number): Promise<void>;
  stepOver(threadId?: number): Promise<void>;
  stepInto(threadId?: number): Promise<void>;
  stepOut(threadId?: number): Promise<void>;
  getStackTrace(threadId?: number): Promise<StackFrame[]>;
  getVariables(frameId: number): Promise<Variable[]>;
  evaluate(expression: string, frameId?: number): Promise<string>;
  getSource(sourceReference: number): Promise<SourceContent>;
  disconnect(): Promise<void>;
  snapshot(): SessionSnapshot;
}
