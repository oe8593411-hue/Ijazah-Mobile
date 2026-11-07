import { createServer } from "node:http";
import { decode as decodeMessagePack } from "@msgpack/msgpack";
import { SURAHS } from "../src/quran/surahs";

const WebSocket = require("ws") as any;
const WebSocketServer = WebSocket.Server;
export const config = { maxDuration: 240 };

type IpWindow = { startedAt: number; attempts: number; active: number };
type UpstreamConfig = { url: string; token: string; kind: "vps" | "nabr" };
const ipWindows = new Map<string, IpWindow>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP_PER_HOUR = 6;
const MAX_AUDIO_MESSAGES = 1200;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_SESSION_MS = 240_000;

function getUpstreamConfig(): UpstreamConfig | null {
  const vpsUrl = process.env.IJAZAH_AI4X_VPS_WS_URL?.trim();
  const vpsToken = process.env.IJAZAH_AI4X_VPS_TOKEN?.trim();

  // A partially configured VPS must fail closed instead of silently using another provider.
  if (vpsUrl || vpsToken) {
    if (!vpsUrl || !vpsToken) return null;
    try {
      const parsed = new URL(vpsUrl);
      if (parsed.protocol !== "wss:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "ws:")) return null;
      if (parsed.username || parsed.password) return null;
      return { url: parsed.toString(), token: vpsToken, kind: "vps" };
    } catch {
      return null;
    }
  }

  const nabrToken = process.env.NABR_API_KEY?.trim();
  if (!nabrToken) return null;
  const nabrUrl = process.env.NABR_WS_URL?.trim() || "wss://api.qurani.ai";
  try {
    const parsed = new URL(nabrUrl);
    if (parsed.protocol !== "wss:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "ws:")) return null;
    if (parsed.username || parsed.password) return null;
    return { url: parsed.toString(), token: nabrToken, kind: "nabr" };
  } catch {
    return null;
  }
}

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
    return false;
  } catch {
    return false;
  }
}

function allowedClientPacketMethod(data: any): string | null {
  try {
    const packet = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const message = decodeMessagePack(packet) as any;
    if (!message || typeof message !== "object" || Array.isArray(message)) return null;

    const hasOnlyKeys = (allowed: string[]) =>
      Object.keys(message).every((key) => allowed.includes(key));

    if (message.method === "RESET_TILAWA_SESSION") {
      return hasOnlyKeys(["method"]) && Object.keys(message).length === 1 ? "RESET_TILAWA_SESSION" : null;
    }

    if (message.method === "START_TILAWA_SESSION") {
      const integerInRange = (value: unknown, min: number, max: number) =>
        typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
      const chapter = SURAHS.find((item) => item.number === message.chapter_index);
      const valid = hasOnlyKeys(["method", "chapter_index", "verse_index", "word_index", "hafz_level", "tajweed_level"])
        && Object.keys(message).length === 6
        && !!chapter
        && integerInRange(message.verse_index, 1, chapter.ayahCount)
        && integerInRange(message.word_index, 1, 100)
        && integerInRange(message.hafz_level, 1, 5)
        && integerInRange(message.tajweed_level, 1, 5);
      return valid ? "START_TILAWA_SESSION" : null;
    }

    if (message.method !== "CHECK_TILAWA_AUDIO"
        || !hasOnlyKeys(["method", "audio", "client_sent_at_ms"])
        || !["method", "audio"].every((key) => Object.prototype.hasOwnProperty.call(message, key))
        || (message.client_sent_at_ms !== undefined
          && (!Number.isSafeInteger(message.client_sent_at_ms) || message.client_sent_at_ms <= 0))) return null;
    const audio = message.audio;
    if (!(audio instanceof Uint8Array) || audio.byteLength < 46 || audio.byteLength > 6500) return null;
    const wav = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
    if (
      wav.toString("ascii", 0, 4) !== "RIFF"
      || wav.toString("ascii", 8, 12) !== "WAVE"
      || wav.toString("ascii", 12, 16) !== "fmt "
      || wav.toString("ascii", 36, 40) !== "data"
    ) return null;
    const dataBytes = wav.readUInt32LE(40);
    return wav.readUInt32LE(4) === wav.byteLength - 8
      && wav.readUInt32LE(16) === 16
      && wav.readUInt16LE(20) === 1
      && wav.readUInt16LE(22) === 1
      && wav.readUInt32LE(24) === 16000
      && wav.readUInt32LE(28) === 32000
      && wav.readUInt16LE(32) === 2
      && wav.readUInt16LE(34) === 16
      && dataBytes > 0
      && dataBytes <= 6400
      && dataBytes % 2 === 0
      && dataBytes === wav.byteLength - 44 ? "CHECK_TILAWA_AUDIO" : null;
  } catch {
    return null;
  }
}

function getWindow(ip: string): IpWindow {
  const now = Date.now();
  let state = ipWindows.get(ip);
  if (!state) {
    state = { startedAt: now, attempts: 0, active: 0 };
    ipWindows.set(ip, state);
  } else if (now - state.startedAt >= WINDOW_MS) {
    state.startedAt = now;
    state.attempts = 0;
  }

  if (ipWindows.size > 2000) {
    for (const [key, value] of ipWindows) {
      if (key !== ip && value.active === 0 && now - value.startedAt >= WINDOW_MS) {
        ipWindows.delete(key);
      }
    }
    if (ipWindows.size > 2000) {
      for (const [key, value] of ipWindows) {
        if (ipWindows.size <= 2000) break;
        if (key !== ip && value.active === 0) ipWindows.delete(key);
      }
    }
  }
  return state;
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && (requestUrl.pathname.endsWith("/health") || requestUrl.searchParams.get("health") === "1")) {
    const upstream = getUpstreamConfig();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({
      service: "ijazah-ai4x-stream",
      enabled: process.env.IJAZAH_AI4X_STREAM_ENABLED === "true",
      upstream: upstream?.kind || "not_configured",
      ready: process.env.IJAZAH_AI4X_STREAM_ENABLED === "true" && !!upstream
    }));
    return;
  }
  res.statusCode = 426;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("WebSocket upgrade required");
});

// Origin checks are not user authentication. Keep this disabled until app sign-in
// and durable per-user quotas are enforced; the in-memory IP limiter is secondary only.
const wss = new WebSocketServer({
  server,
  maxPayload: 24 * 1024,
  verifyClient: (info: any, done: (accepted: boolean, code?: number, message?: string) => void) => {
    if (process.env.IJAZAH_AI4X_STREAM_ENABLED !== "true" || !getUpstreamConfig()) {
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
  const upstreamConfig = getUpstreamConfig();
  if (!upstreamConfig) {
    client.close(1011, "AI4X upstream is not configured");
    return;
  }
  state.attempts += 1;
  state.active += 1;
  let released = false;
  let startSent = false;
  let audioMessages = 0;
  let totalBytes = 0;
  const release = () => {
    if (released) return;
    released = true;
    state.active = Math.max(0, state.active - 1);
  };

  const target = new URL(upstreamConfig.url);
  const headers: Record<string, string> = {};
  if (upstreamConfig.kind === "nabr") {
    target.searchParams.set("api_key", upstreamConfig.token);
    target.searchParams.set("lang", "ar");
    target.searchParams.set("audio_format", "wav");
  } else {
    // The VPS accepts the same MessagePack QRC-compatible event contract.
    // Its credential stays on this server-to-server hop and never reaches the app.
    headers.Authorization = "Bearer " + upstreamConfig.token;
    headers["X-Ijazah-AI4X-Protocol"] = "qrc-msgpack-v1";
  }
  const upstream = new WebSocket(target.toString(), {
    headers,
    handshakeTimeout: 10_000,
    maxPayload: 24 * 1024
  });

  const lifetime = setTimeout(() => {
    try { client.close(1000, "Session time limit reached"); } catch {}
    try { upstream.close(); } catch {}
    release();
  }, MAX_SESSION_MS);

  client.on("message", (data: any, isBinary: boolean) => {
    const method = isBinary ? allowedClientPacketMethod(data) : null;
    if (!method || (method === "START_TILAWA_SESSION" && startSent)
        || (method === "CHECK_TILAWA_AUDIO" && !startSent)) {
      client.close(1008, "Invalid AI4X message sequence");
      try { upstream.close(); } catch {}
      release();
      return;
    }
    if (method === "START_TILAWA_SESSION") startSent = true;
    if (method === "RESET_TILAWA_SESSION") startSent = false;
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
    console.error("AI4X acoustic upstream connection failed", error?.message || "unknown error");
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
