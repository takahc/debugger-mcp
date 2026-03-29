import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DebugSession, streamTransport } from "@debugger-mcp/core";
import type { IDebugSession, SessionFactory } from "@debugger-mcp/core";

const require = createRequire(import.meta.url);

export class ProcessSessionFactory implements SessionFactory {
  async createSession(
    id: string,
    adapter: "python" | "node",
    config: Record<string, unknown>,
  ): Promise<IDebugSession> {
    const proc = spawnAdapter(adapter, config);

    proc.on("error", (e) => {
      console.error(`[debugger-mcp] adapter process error (${adapter}): ${e.message}`);
    });

    const transport = streamTransport(proc.stdout!, proc.stdin!);
    const session = new DebugSession(id, transport);

    const adapterID = adapter === "python" ? "debugpy" : "node";
    await session.initialize(adapterID);

    return session;
  }
}

// ── Adapter spawners ────────────────────────────────────────────────────────

function spawnAdapter(type: "python" | "node", config: Record<string, unknown>): ChildProcess {
  switch (type) {
    case "python": return spawnPythonAdapter(config);
    case "node":   return spawnNodeAdapter(config);
    default:       throw new Error(`Unsupported adapter type: ${type as string}`);
  }
}

function spawnPythonAdapter(config: Record<string, unknown>): ChildProcess {
  const pythonPath = (config["pythonPath"] as string | undefined) ?? findPython();
  return spawn(pythonPath, ["-m", "debugpy.adapter"], {
    stdio: ["pipe", "pipe", "inherit"],
  });
}

function findPython(): string {
  for (const candidate of ["python3", "python"]) {
    try {
      const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(
    "Python interpreter not found. Install Python and debugpy:\n" +
    "  pip install debugpy\n" +
    "Or pass pythonPath in the launch config.",
  );
}

function spawnNodeAdapter(config: Record<string, unknown>): ChildProcess {
  // Search for @vscode/js-debug DAP server in common install locations
  const jsDebugEntry = resolveJsDebug();
  if (jsDebugEntry) {
    return spawn(process.execPath, [jsDebugEntry, "0" /* port 0 = stdio mode */], {
      stdio: ["pipe", "pipe", "inherit"],
    });
  }

  // Fallback: direct stdio DAP server bundled in this package
  return spawnBuiltinNodeAdapter(config);
}

/** Try to resolve @vscode/js-debug from several well-known paths. */
function resolveJsDebug(): string | undefined {
  const candidates = [
    // Installed as a peer dependency or globally
    tryResolve("@vscode/js-debug/dist/src/dapDebugServer.js"),
    // VSCode extension installations (macOS / Linux)
    ...expandVscodeExtPaths("ms-vscode.js-debug", "dist/src/dapDebugServer.js"),
  ].filter((p): p is string => !!p && existsSync(p));

  return candidates[0];
}

function tryResolve(specifier: string): string | undefined {
  try {
    return require.resolve(specifier);
  } catch {
    return undefined;
  }
}

function expandVscodeExtPaths(extId: string, entry: string): string[] {
  const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
  const bases = [
    `${home}/.vscode/extensions`,
    `${home}/.vscode-server/extensions`,
    "/usr/share/code/resources/app/extensions",
  ];
  const results: string[] = [];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    try {
      const { readdirSync } = require("node:fs") as typeof import("node:fs");
      for (const dir of readdirSync(base)) {
        if (dir.startsWith(extId)) {
          results.push(`${base}/${dir}/${entry}`);
        }
      }
    } catch {
      // ignore filesystem errors
    }
  }
  return results;
}

/**
 * Minimal built-in Node.js DAP adapter.
 *
 * Writes an inline CDP→DAP bridge to a temp file and spawns it.
 * The bridge connects to Node.js via --inspect-brk on a random port.
 *
 * Requires Node.js 21+ (built-in WebSocket) or Node.js 18+ with
 * the `ws` package available globally.
 *
 * Limitations vs. @vscode/js-debug:
 *  - Source maps not supported (TypeScript must be compiled first)
 *  - Only local launch (no remote attach via this path)
 */
function spawnBuiltinNodeAdapter(_config: Record<string, unknown>): ChildProcess {
  const bridgeCode = buildNodeDapBridge();
  const tmpPath = join(tmpdir(), `debugger-mcp-bridge-${Date.now()}.mjs`);
  writeFileSync(tmpPath, bridgeCode, "utf8");

  const proc = spawn(process.execPath, [tmpPath], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env },
  });

  proc.on("exit", () => {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  });

  return proc;
}

/**
 * Inline CDP-to-DAP bridge that runs as a child process communicating over
 * stdio with the MCP server's DAP client, and over a WebSocket with Node.js
 * --inspect.
 *
 * Supports: initialize, launch, setBreakpoints, configurationDone, continue,
 * next, stepIn, stepOut, stackTrace, scopes, variables, evaluate, disconnect.
 */
function buildNodeDapBridge(): string {
  // Self-contained ESM module written to a temp file.
  // Uses globalThis.WebSocket (Node 21+) to talk to the V8 inspector.
  return `
import net from "node:net";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

// ── DAP framing ────────────────────────────────────────────────────────────

let outSeq = 1;
function send(msg) {
  const body = JSON.stringify(msg);
  process.stdout.write("Content-Length: " + body.length + "\\r\\n\\r\\n" + body);
}
function response(req, body = {}) {
  send({ seq: outSeq++, type: "response", request_seq: req.seq,
         success: true, command: req.command, body });
}
function event(name, body = {}) {
  send({ seq: outSeq++, type: "event", event: name, body });
}

// ── DAP message reader ─────────────────────────────────────────────────────

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => {
  buf += chunk;
  while (true) {
    const m = buf.match(/Content-Length: (\\d+)\\r\\n\\r\\n/);
    if (!m) break;
    const len = parseInt(m[1], 10);
    const start = buf.indexOf("\\r\\n\\r\\n") + 4;
    if (buf.length < start + len) break;
    const msg = JSON.parse(buf.slice(start, start + len));
    buf = buf.slice(start + len);
    handleDap(msg);
  }
});

// ── State ──────────────────────────────────────────────────────────────────

let cdp; // CDP WebSocket connection
let pendingCdp = new Map();
let cdpId = 1;
let scriptMap = new Map(); // scriptId -> url
let breakpoints = new Map(); // file -> [{ id, line }]
let pausedCallFrames = [];
let launchConfig = null;

// ── CDP helper ────────────────────────────────────────────────────────────

function cdpSend(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = cdpId++;
    pendingCdp.set(id, { resolve, reject });
    cdp.send(JSON.stringify({ id, method, params }));
  });
}

// ── Launch Node.js with --inspect-brk ────────────────────────────────────

async function launchNodeProcess(config) {
  // Node.js 21+ ships WebSocket natively; fall back to the 'ws' npm package.
  const WS = globalThis.WebSocket ?? (await import("ws").then(m => m.default).catch(() => null));
  if (!WS) {
    send({ seq: outSeq++, type: "response", request_seq: config._seq,
           success: false, command: "launch",
           message: "WebSocket not available. Upgrade to Node.js 21+ or run: npm install -g ws" });
    return;
  }

  const inspectPort = 9229 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath,
    ["--inspect-brk=" + inspectPort, config.program, ...(config.args || [])],
    { cwd: config.cwd || process.cwd(), env: { ...process.env, ...config.env },
      stdio: "ignore" });

  child.on("exit", () => event("terminated", {}));

  // Wait for the inspector to be ready
  await new Promise(r => setTimeout(r, 500));

  // Get the WebSocket URL from /json
  const wsUrl = await new Promise((resolve, reject) => {
    const req = net.createConnection({ port: inspectPort, host: "127.0.0.1" });
    let data = "";
    req.on("connect", () => req.write("GET /json HTTP/1.1\\r\\nHost: 127.0.0.1\\r\\n\\r\\n"));
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      const json = data.slice(data.indexOf("["));
      const ws = JSON.parse(json)[0].webSocketDebuggerUrl;
      resolve(ws);
    });
    req.on("error", reject);
    setTimeout(() => reject(new Error("inspector not ready")), 3000);
  });

  cdp = new WS(wsUrl);
  cdp.on("message", raw => {
    const msg = JSON.parse(raw);
    if (msg.id !== undefined) {
      const pending = pendingCdp.get(msg.id);
      if (pending) {
        pendingCdp.delete(msg.id);
        if (msg.error) pending.reject(new Error(msg.error.message));
        else pending.resolve(msg.result);
      }
    } else {
      handleCdpEvent(msg.method, msg.params);
    }
  });

  await new Promise(r => cdp.on("open", r));

  await cdpSend("Debugger.enable");
  await cdpSend("Runtime.enable");

  cdp.on("close", () => event("terminated", {}));
}

function handleCdpEvent(method, params) {
  if (method === "Debugger.scriptParsed") {
    scriptMap.set(params.scriptId, params.url);
  } else if (method === "Debugger.paused") {
    pausedCallFrames = params.callFrames;
    const frame = params.callFrames[0];
    const loc = frame?.location;
    event("stopped", {
      reason: params.reason === "Break" ? "step" : params.reason,
      threadId: 1,
      allThreadsStopped: true,
    });
  } else if (method === "Debugger.resumed") {
    event("continued", { threadId: 1 });
  }
}

// ── DAP handler ───────────────────────────────────────────────────────────

async function handleDap(req) {
  const { command, arguments: args = {} } = req;
  try {
    switch (command) {
      case "initialize":
        response(req, { supportsConfigurationDoneRequest: true,
                        supportsEvaluateForHovers: true });
        event("initialized");
        break;
      case "launch":
        launchConfig = { ...args, _seq: req.seq };
        await launchNodeProcess(launchConfig);
        response(req);
        break;
      case "attach":
        // TODO: attach to running process
        response(req);
        break;
      case "configurationDone":
        response(req);
        // Resume from --inspect-brk initial pause
        await cdpSend("Debugger.resume");
        break;
      case "setBreakpoints": {
        const src = args.source?.path;
        const result = [];
        // Remove old breakpoints for this file
        const old = breakpoints.get(src) || [];
        for (const bp of old) await cdpSend("Debugger.removeBreakpoint", { breakpointId: bp.cdpId });
        breakpoints.set(src, []);
        for (const bp of args.breakpoints || []) {
          try {
            const r = await cdpSend("Debugger.setBreakpointByUrl", {
              lineNumber: bp.line - 1,
              url: "file://" + src,
            });
            breakpoints.get(src).push({ line: bp.line, cdpId: r.breakpointId });
            result.push({ verified: true, line: bp.line });
          } catch {
            result.push({ verified: false, line: bp.line });
          }
        }
        response(req, { breakpoints: result });
        break;
      }
      case "continue":
        await cdpSend("Debugger.resume");
        response(req, { allThreadsContinued: true });
        break;
      case "next":
        await cdpSend("Debugger.stepOver");
        response(req);
        break;
      case "stepIn":
        await cdpSend("Debugger.stepInto");
        response(req);
        break;
      case "stepOut":
        await cdpSend("Debugger.stepOut");
        response(req);
        break;
      case "stackTrace": {
        const frames = pausedCallFrames.map((f, i) => ({
          id: i,
          name: f.functionName || "(anonymous)",
          line: f.location.lineNumber + 1,
          column: f.location.columnNumber,
          source: { path: scriptMap.get(f.location.scriptId)?.replace("file://", "") },
        }));
        response(req, { stackFrames: frames, totalFrames: frames.length });
        break;
      }
      case "scopes":
        response(req, { scopes: [{ name: "Local", variablesReference: args.frameId + 1, expensive: false }] });
        break;
      case "variables": {
        const frameIdx = (args.variablesReference - 1);
        const frame = pausedCallFrames[frameIdx];
        if (!frame) { response(req, { variables: [] }); break; }
        const scope = frame.scopeChain[0];
        if (!scope) { response(req, { variables: [] }); break; }
        const props = await cdpSend("Runtime.getProperties", {
          objectId: scope.object.objectId,
          ownProperties: true,
        });
        const vars = props.result
          .filter(p => p.enumerable)
          .map(p => ({
            name: p.name,
            value: p.value ? (p.value.description || String(p.value.value)) : "undefined",
            type: p.value?.type,
            variablesReference: 0,
          }));
        response(req, { variables: vars });
        break;
      }
      case "evaluate": {
        const frameId = args.frameId ?? 0;
        const frame = pausedCallFrames[frameId];
        const callFrameId = frame?.callFrameId;
        const r = callFrameId
          ? await cdpSend("Debugger.evaluateOnCallFrame", { callFrameId, expression: args.expression })
          : await cdpSend("Runtime.evaluate", { expression: args.expression });
        const rv = r.result;
        response(req, { result: rv.description || String(rv.value), variablesReference: 0 });
        break;
      }
      case "disconnect":
        if (cdp) cdp.close();
        response(req);
        process.exit(0);
        break;
      default:
        response(req);
    }
  } catch (e) {
    send({ seq: outSeq++, type: "response", request_seq: req.seq,
           success: false, command, message: e.message });
  }
}
`;
}
