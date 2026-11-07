import { createServer } from "node:http";
import { decode as decodeMessagePack } from "@msgpack/msgpack";
import { SURAHS } from "../src/quran/surahs";

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
    return false;
  } catch {
    return false;
  }
}

function isAllowedClientPacket(data: any): boolean {
  try {
    const packet = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const message = decodeMessagePack(packet) as any;
    if (!message || typeof message !== "object" || Array.isArray(message)) return false;

    const hasOnlyKeys = (allowed: string[]) =>
      Object.keys(message).every((key) => allowed.includes(key));

    if (message.method === "RESET_TILAWA_SESSION") {
      return hasOnlyKeys(["method"]) && Object.keys(message).length === 1;
    }

    if (message.method === "START_TILAWA_SESSION") {
      const integerInRange = (value: unknown, min: number, max: number) =>
        typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
      const chapter = SURAHS.find((item) => item.number === message.chapter_index);
      return hasOnlyKeys(["method", "chapter_index", "verse_index", "word_index", "hafz_level", "tajweed_level"])
        && Object.keys(message).length === 6
        && !!chapter
        && integerInRange(message.verse_index, 1, chapter.ayahCount)
        && integerInRange(message.word_index, 1, 100)
        && integerInRange(message.hafz_level, 1, 5)
        && integerInRange(message.tajweed_level, 1, 5);
    }

    if (message.method !== "CHECK_TILAWA_AUDIO"
        || !hasOnlyKeys(["method", "audio", "client_sent_at_ms"])
        || !["method", "audio"].every((key) => Object.prototype.hasOwnProperty.call(message, key))
        || (message.client_sent_at_ms !== undefined
          && (!Number.isSafeInteger(message.client_sent_at_ms) || message.client_sent_at_ms <= 0))) return false;
    const audio = message.audio;
    if (!(audio instanceof Uint8Array) || audio.byteLength < 46 || audio.byteLength > 6500) return false;
    const wav = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
    if (
      wav.toString("ascii", 0, 4) !== "RIFF"
      || wav.toString("ascii", 8, 12) !== "WAVE"
      || wav.toString("ascii", 12, 16) !== "fmt "
      || wav.toString("ascii", 36, 40) !== "data"
    ) return false;
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
      && dataBytes === wav.byteLength - 44;
  } catch {
    return false;
  }
}

function getWindow(ip: string): IpWindow {
  const now = Date.now();
  let state = ipWindows.get(ip);
  if (!state) {
    state = { startedAt: now, attempts: 0, active: 0 };
    ipWindows.set(ip, state);
  } else if (now - state.startedAt >= WINDOW_MS) {
    // Reset the hourly attempt counter without erasing live connections.
    state.startedAt = now;
    state.attempts = 0;
  }

  // Keep the per-instance map bounded under a stream of distinct source IPs.
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

const server = createServer((_req, res) => {
  res.statusCode = 426;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("WebSocket upgrade required");
});

// Origin checks reduce cross-site socket abuse but are not user authentication.
// Keep IJAZAH_AI4X_STREAM_ENABLED unset until app sign-in and durable per-user quotas
// are enforced; this in-memory IP limiter is only a secondary per-instance guard.
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
    if (!isBinary || !isAllowedClientPacket(data)) {
      client.close(1008, "Invalid AI4X message");
      try { upstream.close(); } catch {}
      release();
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
