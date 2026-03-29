import { describe, it, expect, vi, beforeEach } from "vitest";
import { DapClient, type IDapTransport } from "../dap/client.js";
import { encodeMessage } from "../dap/framing.js";
import type { DapResponse, DapEvent } from "../dap/types.js";

// ── Mock transport ─────────────────────────────────────────────────────────

interface MockTransport extends IDapTransport {
  sentBuffers: Buffer[];
  _triggerMessage(msg: unknown): void;
  _triggerClose(): void;
}

function createMockTransport(): MockTransport {
  let messageHandler: ((msg: unknown) => void) | undefined;
  let closeHandler: (() => void) | undefined;

  const transport: MockTransport = {
    sentBuffers: [],
    send(data) { this.sentBuffers.push(data); },
    onMessage(handler) { messageHandler = handler; },
    onClose(handler) { closeHandler = handler; },
    _triggerMessage(msg) { messageHandler?.(msg); },
    _triggerClose() { closeHandler?.(); },
  };
  return transport;
}

function parseSent(transport: MockTransport, index = 0): Record<string, unknown> {
  const buf = transport.sentBuffers[index]!;
  const headerEnd = buf.indexOf("\r\n\r\n") + 4;
  return JSON.parse(buf.subarray(headerEnd).toString("utf8"));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("DapClient", () => {
  let transport: MockTransport;
  let client: DapClient;

  beforeEach(() => {
    transport = createMockTransport();
    client = new DapClient(transport);
  });

  it("sends a request with correct seq and type", async () => {
    const promise = client.sendRequest("initialize", { adapterID: "test" });
    const sent = parseSent(transport);
    expect(sent["type"]).toBe("request");
    expect(sent["command"]).toBe("initialize");
    expect(typeof sent["seq"]).toBe("number");
    expect(sent["arguments"]).toEqual({ adapterID: "test" });

    // Resolve the promise by simulating a response
    transport._triggerMessage({
      seq: 100,
      type: "response",
      request_seq: sent["seq"],
      success: true,
      command: "initialize",
      body: { supportsConfigurationDoneRequest: true },
    } satisfies DapResponse);

    const result = await promise;
    expect(result).toEqual({ supportsConfigurationDoneRequest: true });
  });

  it("increments seq for each request", async () => {
    const p1 = client.sendRequest("initialize", {});
    const p2 = client.sendRequest("launch", {});

    const seq1 = parseSent(transport, 0)["seq"] as number;
    const seq2 = parseSent(transport, 1)["seq"] as number;
    expect(seq2).toBe(seq1 + 1);

    // Resolve both
    transport._triggerMessage({ seq: 1, type: "response", request_seq: seq1, success: true, command: "initialize", body: {} });
    transport._triggerMessage({ seq: 2, type: "response", request_seq: seq2, success: true, command: "launch", body: {} });
    await Promise.all([p1, p2]);
  });

  it("rejects on unsuccessful response", async () => {
    const promise = client.sendRequest("launch", {});
    const seq = (parseSent(transport, 0)["seq"]) as number;

    transport._triggerMessage({
      seq: 1,
      type: "response",
      request_seq: seq,
      success: false,
      command: "launch",
      message: "program not found",
    } satisfies DapResponse);

    await expect(promise).rejects.toThrow("program not found");
  });

  it("emits typed event for incoming events", () => {
    const handler = vi.fn();
    client.on("event:stopped", handler);

    transport._triggerMessage({
      seq: 5,
      type: "event",
      event: "stopped",
      body: { reason: "breakpoint", threadId: 1 },
    } satisfies DapEvent);

    expect(handler).toHaveBeenCalledWith({ reason: "breakpoint", threadId: 1 });
  });

  it("emits generic 'event' for all events", () => {
    const handler = vi.fn();
    client.on("event", handler);

    const eventMsg: DapEvent = { seq: 6, type: "event", event: "output", body: { output: "hello" } };
    transport._triggerMessage(eventMsg);

    expect(handler).toHaveBeenCalledWith(eventMsg);
  });

  it("emits 'close' when transport closes", () => {
    const handler = vi.fn();
    client.on("close", handler);
    transport._triggerClose();
    expect(handler).toHaveBeenCalled();
  });

  it("ignores responses with unknown request_seq", () => {
    // Should not throw
    expect(() => {
      transport._triggerMessage({
        seq: 99,
        type: "response",
        request_seq: 9999,
        success: true,
        command: "unknown",
        body: {},
      });
    }).not.toThrow();
  });

  it("handles concurrent requests resolved in any order", async () => {
    const p1 = client.sendRequest<unknown, string>("cmdA", {});
    const p2 = client.sendRequest<unknown, string>("cmdB", {});
    const p3 = client.sendRequest<unknown, string>("cmdC", {});

    const seq1 = (parseSent(transport, 0)["seq"]) as number;
    const seq2 = (parseSent(transport, 1)["seq"]) as number;
    const seq3 = (parseSent(transport, 2)["seq"]) as number;

    // Resolve out of order: 3, 1, 2
    transport._triggerMessage({ seq: 10, type: "response", request_seq: seq3, success: true, command: "cmdC", body: "C" });
    transport._triggerMessage({ seq: 11, type: "response", request_seq: seq1, success: true, command: "cmdA", body: "A" });
    transport._triggerMessage({ seq: 12, type: "response", request_seq: seq2, success: true, command: "cmdB", body: "B" });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe("A");
    expect(r2).toBe("B");
    expect(r3).toBe("C");
  });

  it("dispose() rejects all pending requests", async () => {
    const p1 = client.sendRequest("longRunning", {});
    const p2 = client.sendRequest("anotherLong", {});

    client.dispose();

    await expect(p1).rejects.toThrow("disposed");
    await expect(p2).rejects.toThrow("disposed");
  });

  it("sends a request with no arguments when args are omitted", async () => {
    const promise = client.sendRequest("configurationDone");
    const sent = parseSent(transport);
    expect(sent["arguments"]).toBeUndefined();

    const seq = sent["seq"] as number;
    transport._triggerMessage({ seq: 1, type: "response", request_seq: seq, success: true, command: "configurationDone", body: {} });
    await promise;
  });
});
