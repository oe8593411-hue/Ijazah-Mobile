export default function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  return res.status(200).json({
    service: "ijazah-ai4x",
    api: "available",
    transcriptionConfigured: Boolean(process.env.OPENAI_API_KEY),
    analysisEnabled: process.env.IJAZAH_ANALYSIS_ENABLED === "true",
    acousticTajweedEngineConfigured: Boolean(process.env.IJAZAH_TAJWEED_ENGINE_URL && process.env.IJAZAH_TAJWEED_ENGINE_TOKEN),
    status: process.env.IJAZAH_ANALYSIS_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY)
      ? "configured_for_transcription"
      : "setup_required",
    note: "Text alignment is not a tajweed grade. Acoustic tajweed findings require the separately configured specialist engine."
  });
}
