import { EventEmitter } from "node:events";
import { DapFrameDecoder, encodeMessage } from "./framing.js";
import type { DapRequest, DapResponse, DapEvent, DapMessage, PendingRequest } from "./types.js";

export interface IDapTransport {
  send(data: Buffer): void;
  onMessage(handler: (msg: unknown) => void): void;
  onClose(handler: () => void): void;
}

const REQUEST_TIMEOUT_MS = 30_000;

export class DapClient extends EventEmitter {
  private seq = 1;
  private pending = new Map<number, PendingRequest>();

  constructor(private transport: IDapTransport) {
    super();
    transport.onMessage((raw) => this.handleMessage(raw));
    transport.onClose(() => this.emit("close"));
  }

  sendRequest<TArgs, TBody>(command: string, args?: TArgs): Promise<TBody> {
    return new Promise((resolve, reject) => {
      const seq = this.seq++;
      const msg: DapRequest = { seq, type: "request", command, arguments: args };

      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`DAP request timed out: ${command} (seq ${seq})`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(seq, {
        command,
        resolve: (r: DapResponse) => {
          clearTimeout(timer);
          if (r.success) resolve(r.body as TBody);
          else reject(new Error(r.message ?? `DAP error: ${command}`));
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
        timer,
      });

      this.transport.send(encodeMessage(msg));
    });
  }

  private handleMessage(raw: unknown): void {
    const msg = raw as DapMessage;
    if (msg.type === "response") {
      const r = msg as DapResponse;
      const pending = this.pending.get(r.request_seq);
      if (pending) {
        this.pending.delete(r.request_seq);
        pending.resolve(r);
      }
    } else if (msg.type === "event") {
      const e = msg as DapEvent;
      this.emit(`event:${e.event}`, e.body);
      this.emit("event", e);
    }
  }

  dispose(): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("DapClient disposed"));
    }
    this.pending.clear();
  }
}

export function streamTransport(
  readable: NodeJS.ReadableStream,
  writable: NodeJS.WritableStream,
): IDapTransport {
  const decoder = new DapFrameDecoder();
  readable.pipe(decoder);
  return {
    send(data) {
      writable.write(data);
    },
    onMessage(handler) {
      decoder.on("data", handler);
    },
    onClose(handler) {
      readable.on("close", handler);
      readable.on("end", handler);
    },
  };
}
