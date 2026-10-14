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

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
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
    return res.status(200).json({
      reference: { surah, ayah, riwaya: "حفص عن عاصم" },
      transcript,
      textAlignment: alignment,
      matchRate,
      confidence: "preliminary",
      analysisLevel: "speech_to_text_alignment",
      tajweed: { status: "not_evaluated", message: "لم يتم تحليل مخارج الحروف أو الصفات أو أحكام التجويد صوتيًا في هذه المرحلة." },
      disclaimer: "هذه مقارنة مبدئية لنص التعرّف الصوتي بالنص القرآني، وليست حكمًا نهائيًا على صحة التلاوة. قد يخطئ نموذج التعرّف في الحركات أو الكلمات القرآنية."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "AUDIO_TOO_LARGE") return res.status(413).json({ error: "audio_too_large", message: "التسجيل أكبر من الحد المسموح." });
    console.error("Recitation analysis failed", message);
    return res.status(500).json({ error: "analysis_failed", message: "حدث خطأ أثناء تحليل التسجيل." });
  }
}
