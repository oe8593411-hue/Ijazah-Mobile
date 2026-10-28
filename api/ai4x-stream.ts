import { createServer } from "node:http";

const WebSocket = require("ws") as any;
const WebSocketServer = WebSocket.Server;
export const config = { maxDuration: 240 };

type IpWindow = { startedAt: number; attempts: number; active: number };
const ipWindows = new Map<string, IpWindow>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP_PER_HOUR = 6;
const MAX_AUDIO_MESSAGES = 1200;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_SESSION_MS = 240_000;

function clientIp(req: any) {
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",").pop()?.trim() || "unknown";
  }
  return req.socket?.remoteAddress || "unknown";
}

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return false;
  const configured = (process.env.IJAZAH_ALLOWED_ORIGINS || "")
    .split(",").map((value: string) => value.trim()).filter(Boolean);
  if (configured.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (process.env.NODE_ENV !== "production"
        && ["localhost", "127.0.0.1"].includes(parsed.hostname)) return true;
    return parsed.protocol === "https:"
      && parsed.hostname === "ijazah-mobile-preview-git-feature-mushaf-f-d2f978-profit-guard2.vercel.app";
  } catch {
    return false;
  }
}

function getWindow(ip: string): IpWindow {
  const now = Date.now();
  let state = ipWindows.get(ip);
  if (!state || now - state.startedAt >= WINDOW_MS) {
    state = { startedAt: now, attempts: 0, active: 0 };
    ipWindows.set(ip, state);
  }
  return state;
}

const server = createServer((_req, res) => {
  res.statusCode = 426;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("WebSocket upgrade required");
});

const wss = new WebSocketServer({
  server,
  maxPayload: 24 * 1024,
  verifyClient: (info: any, done: (accepted: boolean, code?: number, message?: string) => void) => {
    if (process.env.IJAZAH_AI4X_STREAM_ENABLED !== "true" || !process.env.NABR_API_KEY) {
      done(false, 503, "AI4X realtime is not configured");
      return;
    }
    if (!isAllowedOrigin(info.origin)) {
      done(false, 403, "Origin not allowed");
      return;
    }
    const state = getWindow(clientIp(info.req));
    if (state.active >= 1 || state.attempts >= MAX_ATTEMPTS_PER_IP_PER_HOUR) {
      done(false, 429, "AI4X session limit reached");
      return;
    }
    done(true);
  }
});

wss.on("connection", (client: any, req: any) => {
  const ip = clientIp(req);
  const state = getWindow(ip);
  if (state.active >= 1 || state.attempts >= MAX_ATTEMPTS_PER_IP_PER_HOUR) {
    client.close(1013, "Session limit reached");
    return;
  }
  state.attempts += 1;
  state.active += 1;
  let released = false;
  let audioMessages = 0;
  let totalBytes = 0;
  const release = () => {
    if (released) return;
    released = true;
    state.active = Math.max(0, state.active - 1);
  };

  const target = new URL(process.env.NABR_WS_URL || "wss://api.qurani.ai");
  target.searchParams.set("api_key", process.env.NABR_API_KEY || "");
  target.searchParams.set("lang", "ar");
  target.searchParams.set("audio_format", "wav");
  const upstream = new WebSocket(target.toString(), {
    handshakeTimeout: 10_000,
    maxPayload: 24 * 1024
  });

  const lifetime = setTimeout(() => {
    try { client.close(1000, "Session time limit reached"); } catch {}
    try { upstream.close(); } catch {}
    release();
  }, MAX_SESSION_MS);

  client.on("message", (data: any, isBinary: boolean) => {
    if (!isBinary) {
      client.close(1008, "Binary MessagePack required");
      return;
    }
    const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    audioMessages += 1;
    totalBytes += size;
    if (audioMessages > MAX_AUDIO_MESSAGES || totalBytes > MAX_AUDIO_BYTES) {
      client.close(1009, "AI4X session audio limit reached");
      try { upstream.close(); } catch {}
      release();
      return;
    }
    if (upstream.readyState !== WebSocket.OPEN) {
      client.close(1011, "Audio engine not ready");
      try { upstream.close(); } catch {}
      release();
      return;
    }
    upstream.send(data, { binary: true });
  });

  upstream.on("message", (data: any, isBinary: boolean) => {
    if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
  });
  upstream.on("error", (error: any) => {
    console.error("AI4X acoustic provider connection failed", error?.message || "unknown error");
    try { client.close(1011, "Audio engine unavailable"); } catch {}
    release();
  });
  upstream.on("close", () => {
    if (client.readyState === WebSocket.OPEN) client.close(1011, "Audio engine closed");
    release();
  });
  client.on("error", () => {
    try { upstream.close(); } catch {}
    release();
  });
  client.on("close", () => {
    clearTimeout(lifetime);
    try { upstream.close(); } catch {}
    release();
  });
});

export default server;
