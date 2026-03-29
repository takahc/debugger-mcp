import { describe, it, expect } from "vitest";
import { DapFrameDecoder, encodeMessage } from "../dap/framing.js";
import { Readable } from "node:stream";

// ── Helper: collect all objects emitted by a Transform stream ──────────────
function collectObjects(stream: DapFrameDecoder): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const items: unknown[] = [];
    stream.on("data", (obj) => items.push(obj));
    stream.on("end", () => resolve(items));
    stream.on("error", reject);
  });
}

// ── Helper: push bytes into a decoder and collect results ──────────────────
async function decode(chunks: Buffer[]): Promise<unknown[]> {
  const dec = new DapFrameDecoder();
  const result = collectObjects(dec);
  for (const chunk of chunks) dec.write(chunk);
  dec.end();
  return result;
}

describe("encodeMessage", () => {
  it("produces a valid Content-Length framed buffer", () => {
    const payload = { seq: 1, type: "request", command: "initialize" };
    const buf = encodeMessage(payload);
    const str = buf.toString("utf8");
    const body = JSON.stringify(payload);
    expect(str).toContain(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`);
    expect(str.endsWith(body)).toBe(true);
  });

  it("handles UTF-8 multibyte characters correctly", () => {
    const payload = { text: "日本語テスト" };
    const buf = encodeMessage(payload);
    const body = JSON.stringify(payload);
    const expectedLen = Buffer.byteLength(body, "utf8");
    expect(buf.toString()).toContain(`Content-Length: ${expectedLen}`);
  });

  it("round-trips through the decoder", async () => {
    const original = { seq: 42, type: "response", success: true };
    const encoded = encodeMessage(original);
    const [decoded] = await decode([encoded]);
    expect(decoded).toEqual(original);
  });
});

describe("DapFrameDecoder", () => {
  it("decodes a single complete message in one chunk", async () => {
    const msg = { seq: 1, type: "event", event: "initialized" };
    const [decoded] = await decode([encodeMessage(msg)]);
    expect(decoded).toEqual(msg);
  });

  it("decodes multiple messages in a single chunk", async () => {
    const msg1 = { seq: 1, type: "request", command: "initialize" };
    const msg2 = { seq: 2, type: "response", success: true };
    const combined = Buffer.concat([encodeMessage(msg1), encodeMessage(msg2)]);
    const results = await decode([combined]);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(msg1);
    expect(results[1]).toEqual(msg2);
  });

  it("reassembles a message split across multiple chunks", async () => {
    const msg = { seq: 1, type: "event", event: "stopped", body: { threadId: 1 } };
    const full = encodeMessage(msg);
    // Split at arbitrary points
    const half = Math.floor(full.length / 2);
    const results = await decode([full.subarray(0, half), full.subarray(half)]);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(msg);
  });

  it("handles header split across two chunks", async () => {
    const msg = { seq: 5, type: "request", command: "launch" };
    const full = encodeMessage(msg);
    // Cut right in the middle of the Content-Length header
    const splitAt = 10;
    const results = await decode([full.subarray(0, splitAt), full.subarray(splitAt)]);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(msg);
  });

  it("handles body split across two chunks", async () => {
    const msg = { seq: 3, type: "event", event: "output", body: { output: "hello world" } };
    const full = encodeMessage(msg);
    // Header is done, body is split
    const headerEnd = full.indexOf("\r\n\r\n") + 4;
    const splitAt = headerEnd + 3;
    const results = await decode([full.subarray(0, splitAt), full.subarray(splitAt)]);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(msg);
  });

  it("handles many small 1-byte chunks", async () => {
    const msg = { seq: 99, type: "response", body: { result: "ok" } };
    const full = encodeMessage(msg);
    const singleBytes = Array.from({ length: full.length }, (_, i) =>
      full.subarray(i, i + 1),
    );
    const results = await decode(singleBytes);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(msg);
  });

  it("decodes 100 sequential messages correctly", async () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      seq: i + 1,
      type: "event",
      event: "output",
      body: { line: i },
    }));
    const combined = Buffer.concat(messages.map(encodeMessage));
    const results = await decode([combined]);
    expect(results).toHaveLength(100);
    results.forEach((r, i) => expect(r).toEqual(messages[i]));
  });

  it("silently skips malformed JSON bodies", async () => {
    // Craft a buffer with a valid header but corrupt JSON body
    const goodMsg = encodeMessage({ seq: 1, type: "event", event: "ok" });
    const badBody = Buffer.from("{ not: valid json ]");
    const badHeader = Buffer.from(
      `Content-Length: ${badBody.length}\r\n\r\n`,
      "ascii",
    );
    const combined = Buffer.concat([badHeader, badBody, goodMsg]);
    const results = await decode([combined]);
    // Only the good message should come through
    expect(results).toHaveLength(1);
    expect((results[0] as { event: string }).event).toBe("ok");
  });

  it("handles an empty payload (zero-length body) without hanging", async () => {
    const emptyBody = Buffer.from("{}");
    const header = Buffer.from(`Content-Length: ${emptyBody.length}\r\n\r\n`, "ascii");
    const results = await decode([Buffer.concat([header, emptyBody])]);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({});
  });
});
