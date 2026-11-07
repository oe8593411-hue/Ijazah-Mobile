from __future__ import annotations

import asyncio
import hmac
import os
from contextlib import suppress
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

app = FastAPI(title="Ijazah AI4X VPS Gateway", docs_url=None, redoc_url=None)
MAX_PACKET_BYTES = 24 * 1024
PROTOCOL = "qrc-msgpack-v1"


def _setting(name: str) -> str:
    return os.getenv(name, "").strip()


def _upstream_uri() -> str | None:
    base = _setting("NABR_WS_URL") or "wss://api.qurani.ai"
    key = _setting("NABR_API_KEY")
    if not key:
        return None
    parts = urlsplit(base)
    if parts.scheme != "wss" or not parts.netloc or parts.username or parts.password:
        return None
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update({"api_key": key, "lang": "ar", "audio_format": "wav"})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def _authorized(websocket: WebSocket) -> bool:
    expected = _setting("IJAZAH_AI4X_VPS_TOKEN")
    supplied = websocket.headers.get("authorization", "")
    if not expected or len(expected) < 32 or not supplied.startswith("Bearer "):
        return False
    return hmac.compare_digest(supplied[7:], expected)


@app.get("/healthz")
async def healthz():
    token_ready = len(_setting("IJAZAH_AI4X_VPS_TOKEN")) >= 32
    upstream_ready = _upstream_uri() is not None
    return JSONResponse({
        "service": "ijazah-ai4x-vps-gateway",
        "ready": token_ready and upstream_ready,
        "protocol": PROTOCOL,
    })


@app.websocket("/ai4x")
async def ai4x(websocket: WebSocket):
    if not _authorized(websocket):
        await websocket.close(code=4401, reason="Unauthorized")
        return
    if websocket.headers.get("x-ijazah-ai4x-protocol") != PROTOCOL:
        await websocket.close(code=4406, reason="Unsupported AI4X protocol")
        return

    upstream_uri = _upstream_uri()
    if upstream_uri is None:
        await websocket.close(code=1013, reason="Acoustic provider is not configured")
        return

    try:
        async with websockets.connect(
            upstream_uri,
            open_timeout=10,
            close_timeout=3,
            ping_interval=20,
            ping_timeout=20,
            max_size=MAX_PACKET_BYTES,
            max_queue=8,
        ) as upstream:
            await websocket.accept()

            async def app_to_provider():
                while True:
                    packet = await websocket.receive()
                    if packet["type"] == "websocket.disconnect":
                        return
                    payload = packet.get("bytes")
                    if payload is None or not 1 <= len(payload) <= MAX_PACKET_BYTES:
                        await websocket.close(code=1003, reason="Binary MessagePack packets required")
                        return
                    await upstream.send(payload)

            async def provider_to_app():
                async for message in upstream:
                    if not isinstance(message, bytes) or len(message) > MAX_PACKET_BYTES:
                        await websocket.close(code=1011, reason="Invalid acoustic provider response")
                        return
                    await websocket.send_bytes(message)

            tasks = {
                asyncio.create_task(app_to_provider()),
                asyncio.create_task(provider_to_app()),
            }
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            for task in pending:
                with suppress(asyncio.CancelledError):
                    await task
            for task in done:
                with suppress(WebSocketDisconnect, asyncio.CancelledError):
                    error = task.exception()
                    if error:
                        raise error
    except WebSocketDisconnect:
        return
    except Exception:
        # Do not expose provider URLs, credentials, or exception text to the app.
        with suppress(Exception):
            await websocket.close(code=1011, reason="AI4X acoustic upstream unavailable")
