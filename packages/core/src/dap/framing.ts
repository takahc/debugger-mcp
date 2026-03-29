import { Transform, type TransformCallback } from "node:stream";

export function encodeMessage(payload: object): Buffer {
  const body = JSON.stringify(payload);
  const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, "ascii"), Buffer.from(body, "utf8")]);
}

export class DapFrameDecoder extends Transform {
  private buf = Buffer.alloc(0);

  constructor() {
    super({ objectMode: true, readableObjectMode: true });
  }

  _transform(chunk: Buffer, _enc: string, done: TransformCallback): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    this.drain();
    done();
  }

  private drain(): void {
    while (true) {
      const sep = this.buf.indexOf("\r\n\r\n");
      if (sep === -1) return;

      const header = this.buf.subarray(0, sep).toString("ascii");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        this.buf = this.buf.subarray(1);
        continue;
      }
      const length = parseInt(match[1]!, 10);
      const bodyStart = sep + 4;

      if (this.buf.length < bodyStart + length) return;

      const body = this.buf.subarray(bodyStart, bodyStart + length).toString("utf8");
      this.buf = this.buf.subarray(bodyStart + length);

      try {
        this.push(JSON.parse(body));
      } catch {
        // Skip malformed JSON
      }
    }
  }
}
