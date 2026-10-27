# AI4X engine setup

AI4X combines four stages: Arabic recitation recognition, alignment against the verified Hafs corpus, acoustic tajweed/letter feedback, and a confidence gate that suppresses uncorroborated word errors.

## Existing post-recording engine

The server analysis route uses two independent transcription models and only releases specific word differences when both transcriptions agree with each other and the reference. It remains disabled unless `IJAZAH_ANALYSIS_ENABLED=true`, so the public endpoint cannot silently spend on model calls.

## Optional live acoustic engine

The live provider adapter uses Nabr from Qurani.ai for word positions, skipped words, tajweed mistakes, and phonetic mistakes. It requires a provider subscription/API key.

Set these variables only in Vercel's server-side environment (never prefix the provider key with `EXPO_PUBLIC_`):

- `NABR_API_KEY`: the Nabr subscription key.
- `IJAZAH_AI4X_STREAM_ENABLED=true`: enables the WebSocket proxy. It is disabled by default.
- `IJAZAH_ALLOWED_ORIGINS`: comma-separated exact origins allowed to connect, including the app's HTTPS origin.
- `EXPO_PUBLIC_IJAZAH_AI4X_REALTIME=true`: build-time flag that makes the web app attempt live streaming.

The proxy keeps the Nabr key server-side, checks origin, limits session duration/audio bytes, and applies per-IP in-memory connection limits. Those in-memory limits are per server instance rather than a durable global limiter. Before enabling provider calls for unrestricted public traffic, add authenticated user sessions and a shared/durable rate limiter, then configure the variables above. The app falls back to the existing post-recording path if the live engine is unavailable.

## Costs and privacy

Nabr requires a subscription, and the OpenAI verification stage may incur separate usage fees. Do not enable either paid path until the account owner approves the provider and spending. Recitation audio is sensitive personal data; show a clear consent notice and document retention/processing practices before a public launch.
