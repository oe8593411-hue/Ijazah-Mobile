# AI4X VPS connection

The recitation screen already opens a WebSocket at `/api/ai4x-stream`. That route is the trusted server-side bridge: it validates the app's MessagePack packets, enforces payload/session limits, and forwards the binary stream to one configured upstream. The app never receives the VPS credential.

## Connection path

```text
Ijazah Mushaf / Recitation screen
  -> wss://APP_HOST/api/ai4x-stream
  -> Vercel API bridge (this repository)
  -> wss://YOUR_VPS_HOST/ai4x
  -> AI4X-compatible acoustic service
```

The VPS endpoint must implement the existing QRC-compatible binary contract. It must accept MessagePack binary packets with these methods:

- `START_TILAWA_SESSION`
- `CHECK_TILAWA_AUDIO` (WAV, mono, PCM16, 16 kHz)
- `RESET_TILAWA_SESSION`

It must return MessagePack binary events understood by the recitation screen, including `QRC_CLIENT_CONNECTED`, `TILAWA_SESSION_STARTED`, `TILAWA_RESULT`, and `QRC_ERROR`. This bridge deliberately does not translate an arbitrary HTTP/FastAPI endpoint into a speech engine; the VPS service must actually implement the acoustic inference/provider protocol.

## Server environment variables

Set these in the hosting provider's server-side environment settings. Do not put the VPS token in an `EXPO_PUBLIC_*` variable or commit a real token.

```env
IJAZAH_AI4X_STREAM_ENABLED=false
IJAZAH_AI4X_VPS_WS_URL=wss://YOUR_VPS_HOST/ai4x
IJAZAH_AI4X_VPS_TOKEN=replace-with-a-long-random-secret
IJAZAH_ALLOWED_ORIGINS=https://YOUR_APP_HOST
```

When both `IJAZAH_AI4X_VPS_WS_URL` and `IJAZAH_AI4X_VPS_TOKEN` are present, the bridge uses the VPS and sends the token server-to-server as `Authorization: Bearer ...`. If neither is present, the legacy Nabr upstream can be selected with `NABR_API_KEY` and optional `NABR_WS_URL`. If only one VPS setting is supplied, the connection fails closed instead of falling back.

The VPS must use TLS (`wss://`) in production. The bridge adds `X-Ijazah-AI4X-Protocol: qrc-msgpack-v1` so the service can reject incompatible clients.

## App environment

For a web preview, set the public app variables at build time:

```env
EXPO_PUBLIC_IJAZAH_AI4X_REALTIME=true
EXPO_PUBLIC_IJAZAH_API_URL=https://YOUR_APP_HOST
```

The app still connects to its own `/api/ai4x-stream` route; it must not connect directly to the VPS. For a same-origin web deployment, `EXPO_PUBLIC_IJAZAH_API_URL` can be omitted.

## Safety gates before enabling

Keep `IJAZAH_AI4X_STREAM_ENABLED=false` until authenticated user sessions and durable per-user quotas are enforced. The current in-memory IP limiter is only a secondary guard and is not a replacement for authentication or durable quotas. The stream route's origin check is not authentication.

A successful socket connection only proves transport connectivity. It does not prove that the acoustic model is trained, calibrated, or accurate. The UI should only color words from validated provider results; do not create synthetic `TILAWA_RESULT` events for testing.
