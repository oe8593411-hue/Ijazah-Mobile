import corpus from "../src/quran/verified-corpus.json";

export const config = { api: { bodyParser: false }, maxDuration: 60 };

type Ayah = { surah: number; ayah: number; text: string };
const ayahs = (corpus as unknown as { ayahs: Ayah[] }).ayahs;

function normalizeArabic(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[^\u0621-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readRawBody(req: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of req) {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    total += bytes.byteLength;
    if (total > 20 * 1024 * 1024) throw new Error("AUDIO_TOO_LARGE");
    chunks.push(bytes);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return all;
}

function alignWords(target: string, spoken: string) {
  const expected = normalizeArabic(target).split(" ").filter(Boolean);
  const actual = normalizeArabic(spoken).split(" ").filter(Boolean);
  const n = expected.length, m = actual.length;
  const dp = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    dp[i][j] = expected[i - 1] === actual[j - 1]
      ? dp[i - 1][j - 1]
      : Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
  }
  const errors: { type: string; expected?: string; heard?: string; position: number }[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1]) { i--; j--; continue; }
    const diagonal = i > 0 && j > 0 ? dp[i - 1][j - 1] + 1 : Infinity;
    const deletion = i > 0 ? dp[i - 1][j] + 1 : Infinity;
    const insertion = j > 0 ? dp[i][j - 1] + 1 : Infinity;
    if (diagonal <= deletion && diagonal <= insertion) {
      errors.push({ type: "possible_substitution", expected: expected[i - 1], heard: actual[j - 1], position: i });
      i--; j--;
    } else if (deletion <= insertion) {
      errors.push({ type: "possible_omission", expected: expected[i - 1], position: i });
      i--;
    } else {
      errors.push({ type: "possible_addition", heard: actual[j - 1], position: i + 1 });
      j--;
    }
  }
  errors.reverse();
  return { expectedWords: n, recognizedWords: m, editDistance: dp[n][m], errors: errors.slice(0, 20) };
}

async function runSpecializedTajweedEngine(audioBytes: Uint8Array, contentType: string, surah: number, ayah: number) {
  const engineUrl = process.env.IJAZAH_TAJWEED_ENGINE_URL;
  const engineToken = process.env.IJAZAH_TAJWEED_ENGINE_TOKEN;
  if (!engineUrl || !engineToken) {
    return {
      status: "not_configured",
      rulesEvaluated: [] as string[],
      findings: [] as unknown[],
      message: "محرك التجويد الصوتي المتخصص غير منشور أو غير موصول بعد؛ لن نستنتج أحكام التجويد من النص وحده."
    };
  }
  const form = new FormData();
  form.append("file", new Blob([audioBytes], { type: contentType || "audio/m4a" }), "recitation.m4a");
  form.append("surah", String(surah));
  form.append("ayah", String(ayah));
  form.append("riwaya", "hafs");
  const response = await fetch(engineUrl, {
    method: "POST",
    headers: { Authorization: "Bearer " + engineToken },
    body: form,
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) {
    console.error("Tajweed engine failed", response.status, (await response.text()).slice(0, 300));
    return {
      status: "unavailable",
      rulesEvaluated: [] as string[],
      findings: [] as unknown[],
      message: "تعذّر الوصول إلى محرك التجويد المتخصص؛ لم نصدر حكمًا في التجويد."
    };
  }
  const result = await response.json() as { status?: string; rulesEvaluated?: string[]; findings?: unknown[]; message?: string; confidence?: number };
  if (!Array.isArray(result.findings) || !Array.isArray(result.rulesEvaluated)) {
    return {
      status: "invalid_response",
      rulesEvaluated: [] as string[],
      findings: [] as unknown[],
      message: "استجابة محرك التجويد لم تجتز التحقق البنيوي."
    };
  }
  return {
    status: result.status || "preliminary",
    rulesEvaluated: result.rulesEvaluated,
    findings: result.findings,
    confidence: typeof result.confidence === "number" ? Math.max(0, Math.min(1, result.confidence)) : null,
    message: result.message || "نتائج تجويد آلية أولية؛ يلزم التحقق منها قبل اعتمادها."
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  // Keep public transcription spending disabled until app authentication and per-user rate limits are wired in.
  if (process.env.IJAZAH_ANALYSIS_ENABLED !== "true") {
    return res.status(503).json({ error: "analysis_not_enabled", message: "خدمة التحليل لم تُفعّل بعد؛ يجب إكمال المصادقة وحدود الاستخدام قبل فتحها للمستخدمين." });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "analysis_not_configured", message: "خادم التحليل يحتاج إلى ضبط مفتاح مزود الذكاء الاصطناعي." });
  const surah = Number(req.query.surah);
  const ayah = Number(req.query.ayah);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
    return res.status(400).json({ error: "invalid_reference" });
  }
  const target = ayahs.find(item => item.surah === surah && item.ayah === ayah);
  if (!target) return res.status(404).json({ error: "ayah_not_found" });
  try {
    const audioBytes = await readRawBody(req);
    if (audioBytes.byteLength < 1024) return res.status(400).json({ error: "audio_too_short", message: "التسجيل قصير جدًا للتحليل." });
    const audioBlob = new Blob([audioBytes], { type: req.headers["content-type"] || "audio/m4a" });
    const form = new FormData();
    form.append("file", audioBlob, "recitation.m4a");
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "ar");
    form.append("prompt", "Quran recitation in Arabic. Transcribe only the words clearly heard; do not complete missing verses or guess inaudible words.");
    const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: form
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("Transcription provider error", upstream.status, detail.slice(0, 500));
      return res.status(502).json({ error: "transcription_provider_failed", message: "تعذّر إكمال التعرّف على الصوت الآن." });
    }
    const transcriptData = await upstream.json() as { text?: string };
    const transcript = (transcriptData.text || "").trim();
    if (!transcript) return res.status(422).json({ error: "no_speech_detected", message: "لم نتمكن من تمييز كلمات واضحة في التسجيل." });
    const alignment = alignWords(target.text, transcript);
    const matchRate = Math.max(0, Math.round(100 * (1 - alignment.editDistance / Math.max(1, alignment.expectedWords, alignment.recognizedWords))));
    const contentGate = matchRate >= 80 ? "passed_preliminary" : "blocked_low_text_confidence";
    const tajweed = contentGate === "passed_preliminary"
      ? await runSpecializedTajweedEngine(audioBytes, req.headers["content-type"] || "audio/m4a", surah, ayah)
      : { status: "blocked_by_content_guard", rulesEvaluated: [] as string[], findings: [] as unknown[], message: "أوقفنا تقييم التجويد لأن تطابق الكلمات أقل من الحد الأولي؛ يجب التأكد من النص قبل تقييم الأحكام." };
    const engines = {
      speechRecognition: { status: transcript ? "completed_preliminary" : "failed", model: "gpt-4o-mini-transcribe" },
      quranAlignment: { status: "completed", matchRate, editDistance: alignment.editDistance },
      acousticTajweed: { status: tajweed.status, rulesEvaluated: tajweed.rulesEvaluated },
      confidenceGate: { status: contentGate }
    };
    return res.status(200).json({
      reference: { surah, ayah, riwaya: "حفص عن عاصم" },
      transcript,
      textAlignment: alignment,
      matchRate,
      confidence: "preliminary",
      analysisLevel: "speech_to_text_alignment",
      engines,
      tajweed,
      disclaimer: "معدل التطابق هو تطابق نصي تقريبي وليس درجة تجويد. لا تُعتمد النتائج الصوتية الآلية كإجازة أو بديل عن المعلّم؛ تعتمد دقتها على المحرك الصوتي والبيانات التي اختُبر عليها."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "AUDIO_TOO_LARGE") return res.status(413).json({ error: "audio_too_large", message: "التسجيل أكبر من الحد المسموح." });
    console.error("Recitation analysis failed", message);
    return res.status(500).json({ error: "analysis_failed", message: "حدث خطأ أثناء تحليل التسجيل." });
  }
}
