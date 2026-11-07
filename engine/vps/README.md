# AI4X VPS gateway

This is the deployable VPS-side WebSocket gateway for Ijazah. It authenticates the Vercel bridge, then relays the existing binary MessagePack audio protocol to the configured acoustic provider and returns its binary events unchanged.

**Important:** this is a secure transport adapter, not a newly trained speech-recognition or tajweed model. Recognition results still come from the configured upstream acoustic provider. The existing local CTC alignment and tajweed code remains separately gated until reviewed model weights and calibration data are supplied.

## Deploy on Ubuntu VPS

1. Install Docker Engine and the Docker Compose plugin.
2. Copy this directory to the VPS.
3. Create `.env` from `.env.example`; set a random token of at least 32 characters and the upstream provider key. Keep `.env` private.
4. Put this service behind a TLS reverse proxy (Caddy/Nginx) and expose only HTTPS/WSS publicly.
5. Start it:

```bash
docker build -t ijazah-ai4x-vps .
docker run -d --name ijazah-ai4x-vps --restart unless-stopped \
  --env-file .env -p 127.0.0.1:8080:8080 ijazah-ai4x-vps
```

The reverse proxy should route `/ai4x` WebSocket upgrades to `127.0.0.1:8080` and `/healthz` to the same service. Do not expose port 8080 directly to the public internet.

## Vercel bridge settings

Set these server-side in the Vercel project:

- `IJAZAH_AI4X_STREAM_ENABLED=false` until app authentication and durable per-user quotas are implemented.
- `IJAZAH_AI4X_VPS_WS_URL=wss://YOUR_VPS_DOMAIN/ai4x`
- `IJAZAH_AI4X_VPS_TOKEN` to the exact same secret as the VPS.
- `IJAZAH_ALLOWED_ORIGINS` to the exact web app origin(s).

The public app build also needs `EXPO_PUBLIC_IJAZAH_AI4X_REALTIME=true` and, for native builds, `EXPO_PUBLIC_IJAZAH_API_URL` set to the app API origin. Do not put the VPS token in any `EXPO_PUBLIC_*` variable.

## Checks

- VPS liveness: `GET https://YOUR_VPS_DOMAIN/healthz`
- App bridge readiness: `GET https://YOUR_APP_DOMAIN/api/ai4x-stream?health=1`

A ready response checks configuration and transport prerequisites only. It does not certify recognition accuracy. Do not enable public sessions until the app has authenticated users and durable per-user quotas.
