import { findExpectedTajweedChecks } from "../src/recitation/tajweed-rules";
import corpus from "../src/quran/verified-corpus.json";

export const config = { api: { bodyParser: false }, maxDuration: 60 };

type Ayah = { surah: number; ayah: number; text: string };
const ayahs = (corpus as unknown as { ayahs: Ayah[] }).ayahs;

type AnalysisRateWindow = { startedAt: number; count: number };
const analysisRateWindows = new Map<string, AnalysisRateWindow>();
const ANALYSIS_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ANALYSIS_REQUESTS_PER_WINDOW = 3;

function analysisClientIp(req: any) {
  const real = req.headers?.["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",").pop()?.trim() || "unknown";
  }
  return req.socket?.remoteAddress || "unknown";
}

function allowAnalysisRequest(req: any) {
  const now = Date.now();
  const ip = analysisClientIp(req);
  let state = analysisRateWindows.get(ip);
  if (!state || now - state.startedAt >= ANALYSIS_RATE_WINDOW_MS) {
    state = { startedAt: now, count: 0 };
    analysisRateWindows.set(ip, state);
  }
  if (state.count >= MAX_ANALYSIS_REQUESTS_PER_WINDOW) return false;
  state.count += 1;

  // Bound memory if many source addresses hit a warm serverless instance.
  if (analysisRateWindows.size > 2000) {
    for (const [key, value] of analysisRateWindows) {
      if (now - value.startedAt >= ANALYSIS_RATE_WINDOW_MS) analysisRateWindows.delete(key);
    }
  }
  return true;
}

function audioFileExtension(contentType: string) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4")) return "mp4";
  return "m4a";
}

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

async function readRawBody(req: AsyncIterable<Uint8Array | string>) {
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

async function transcribeAudio(
  audioBytes: Uint8Array,
  contentType: string,
  apiKey: string,
  model: "gpt-4o-mini-transcribe" | "gpt-4o-transcribe"
) {
  const normalizedType = contentType.split(";")[0].trim() || "audio/m4a";
  const form = new FormData();
  form.append(
    "file",
    new Blob([audioBytes.slice().buffer as ArrayBuffer], { type: normalizedType }),
    "recitation." + audioFileExtension(normalizedType)
  );
  form.append("model", model);
  form.append("language", "ar");
  form.append("prompt", "Quran recitation in Arabic. Transcribe only the words clearly heard; do not complete missing verses or guess inaudible words.");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey },
    body: form,
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) {
    const details = await response.text();
    console.error("AI4X transcription stage failed", model, response.status, details.slice(0, 300));
    throw new Error("TRANSCRIPTION_PROVIDER_FAILED");
  }
  const data = await response.json() as { text?: string };
  const transcript = (data.text || "").trim();
  if (!transcript) throw new Error("NO_TRANSCRIPTION_TEXT");
  return transcript;
}

function alignWords(target: string, spoken: string, allowPrefix = false) {
  const expected = normalizeArabic(target).split(" ").filter(Boolean);
  const actual = normalizeArabic(spoken).split(" ").filter(Boolean);
  const n = expected.length, m = actual.length;
  // A flat typed array avoids thousands of row objects and bounds worst-case
  // memory use for unauthenticated audio-analysis requests.
  const columns = m + 1;
  const cells = (n + 1) * columns;
  const MAX_ALIGNMENT_CELLS = 8_000_000; // ~16 MB for Uint16Array, plus small arrays
  if (n > 10_000 || m > 10_000 || !Number.isSafeInteger(cells) || cells > MAX_ALIGNMENT_CELLS) {
    throw new Error("ALIGNMENT_TOO_LARGE");
  }
  const dp = new Uint16Array(cells);
  const at = (i: number, j: number) => i * columns + j;
  for (let i = 0; i <= n; i++) dp[at(i, 0)] = i;
  for (let j = 0; j <= m; j++) dp[at(0, j)] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    dp[at(i, j)] = expected[i - 1] === actual[j - 1]
      ? dp[at(i - 1, j - 1)]
      : Math.min(dp[at(i - 1, j - 1)] + 1, dp[at(i - 1, j)] + 1, dp[at(i, j - 1)] + 1);
  }
  let effectiveExpectedWords = n;
  if (allowPrefix && m > 0) {
    let bestDistance = dp[at(0, m)];
    effectiveExpectedWords = 0;
    for (let row = 1; row <= n; row++) {
      const distance = dp[at(row, m)];
      if (distance < bestDistance || (distance === bestDistance && row > effectiveExpectedWords)) {
        bestDistance = distance;
        effectiveExpectedWords = row;
      }
    }
  }
  const errors: { type: string; expected?: string; heard?: string; position: number }[] = [];
  const matchedExpectedIndexes: number[] = [];
  let i = effectiveExpectedWords, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1]) {
      matchedExpectedIndexes.push(i - 1);
      i--; j--;
      continue;
    }
    const diagonal = i > 0 && j > 0 ? dp[at(i - 1, j - 1)] + 1 : Infinity;
    const deletion = i > 0 ? dp[at(i - 1, j)] + 1 : Infinity;
    const insertion = j > 0 ? dp[at(i, j - 1)] + 1 : Infinity;
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
  matchedExpectedIndexes.reverse();
  return {
    expectedWords: effectiveExpectedWords,
    referenceWords: n,
    recognizedWords: m,
    editDistance: dp[at(effectiveExpectedWords, m)],
    totalErrors: errors.length,
    errors: errors.slice(0, 100),
    matchedExpectedIndexes
  };
}

function scoreAlignment(alignment: ReturnType<typeof alignWords>) {
  return Math.max(0, Math.round(100 * (
    1 - alignment.editDistance / Math.max(1, alignment.expectedWords, alignment.recognizedWords)
  )));
}

function sameAlignmentError(
  first: ReturnType<typeof alignWords>["errors"][number],
  second: ReturnType<typeof alignWords>["errors"][number]
) {
  return first.type === second.type
    && first.position === second.position
    && normalizeArabic(first.expected || "") === normalizeArabic(second.expected || "")
    && normalizeArabic(first.heard || "") === normalizeArabic(second.heard || "");
}

async function runSpecializedTajweedEngine(audioBytes: Uint8Array, contentType: string, surah: number, ayah: number, referenceText: string, expectedChecks: ReturnType<typeof findExpectedTajweedChecks>) {
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
  const normalizedContentType = contentType.split(";")[0].trim() || "audio/m4a";
  form.append("file", new Blob([audioBytes.slice().buffer as ArrayBuffer], { type: normalizedContentType }), "recitation." + audioFileExtension(normalizedContentType));
  form.append("surah", String(surah));
  form.append("ayah", String(ayah));
  form.append("riwaya", "hafs");
  form.append("referenceText", referenceText);
  form.append("expectedRuleChecks", JSON.stringify(expectedChecks));
  form.append("responseContract", "Return only acoustically-supported findings. Each finding must include ruleId, confidence from 0 to 1, evidence, and optional startMs/endMs. Never infer a pronunciation error from text alone. Do not return findings when confidence is below 0.8.");
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
  // Fail closed: only accept findings linked to a rule candidate from the verified
  // reference, with strong confidence and explicit acoustic evidence.
  const findings = result.findings.filter((item): item is Record<string, unknown> => {
    if (!item || typeof item !== "object") return false;
    const finding = item as Record<string, unknown>;
    // A valid rule name alone is not evidence. Require a concrete candidate
    // location from the verified reference and bind the finding to that location.
    const candidate = expectedChecks.find(check =>
      check.ruleId === finding.ruleId
      && check.wordIndex === finding.wordIndex
      && (typeof finding.context !== "string" || check.context === finding.context)
    );
    return Boolean(candidate)
      && typeof finding.ruleId === "string"
      && Number.isInteger(finding.wordIndex)
      && typeof finding.confidence === "number"
      && Number.isFinite(finding.confidence)
      && finding.confidence >= 0.8
      && typeof finding.evidence === "string"
      && finding.evidence.trim().length >= 8
      && (finding.startMs === undefined || (typeof finding.startMs === "number" && Number.isFinite(finding.startMs) && finding.startMs >= 0))
      && (finding.endMs === undefined || (typeof finding.endMs === "number" && Number.isFinite(finding.endMs) && finding.endMs >= 0))
      && !(typeof finding.startMs === "number" && typeof finding.endMs === "number" && finding.endMs < finding.startMs);
  }).slice(0, 20);
  const evaluatedRules = [...new Set(result.rulesEvaluated.filter((ruleId): ruleId is string =>
    typeof ruleId === "string" && expectedChecks.some(check => check.ruleId === ruleId)
  ))];
  return {
    status: findings.length > 0 ? "preliminary_findings" : "completed_no_confirmed_findings",
    rulesEvaluated: evaluatedRules,
    findings,
    confidence: typeof result.confidence === "number" ? Math.max(0, Math.min(1, result.confidence)) : null,
    message: findings.length > 0
      ? "اقتراحات صوتية أولية اجتازت حد الثقة البنيوي؛ يلزم تأكيد معلّم التجويد."
      : "لم تظهر نتيجة صوتية مؤكدة اجتازت بوابة الثقة؛ لا يعني ذلك خلو التلاوة من الأخطاء."
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
  if (!allowAnalysisRequest(req)) {
    res.setHeader("Retry-After", "900");
    return res.status(429).json({ error: "analysis_rate_limited", message: "تم الوصول إلى حد التحليل المؤقت؛ حاول مرة أخرى بعد قليل." });
  }
  const requestedRiwaya = String(req.query.riwaya || "");
  // Fail closed: only the verified Hafs corpus is currently supported.
  // Never compare another riwayah against Hafs text.
  if (requestedRiwaya !== "hafs") {
    return res.status(409).json({
      error: "riwayah_not_verified",
      message: "هذه الرواية غير مفعّلة للتحليل؛ لا يجوز مقارنتها بنص حفص."
    });
  }
  const surah = Number(req.query.surah);
  const scope = String(req.query.scope || "ayah");
  const ayah = Number(req.query.ayah);
  const startAyah = Number(req.query.startAyah ?? req.query.ayah);
  const isValidSurah = Number.isInteger(surah) && surah >= 1 && surah <= 114;
  const isValidAyah = Number.isInteger(ayah) && ayah >= 1;
  const isValidStartAyah = Number.isInteger(startAyah) && startAyah >= 1;
  if (!isValidSurah || !["ayah", "surah", "range"].includes(scope)
      || (scope === "ayah" && !isValidAyah)
      || (scope === "range" && !isValidStartAyah)) {
    return res.status(400).json({ error: "invalid_reference" });
  }
  const surahAyahs = ayahs.filter(item => item.surah === surah);
  const rangeAyahs = scope === "range"
    ? surahAyahs.filter(item => item.ayah >= startAyah)
    : surahAyahs;
  const target = scope === "surah"
    ? { surah, ayah: 0, text: surahAyahs.map(item => item.text).join(" ") }
    : scope === "range"
      ? { surah, ayah: startAyah, text: rangeAyahs.map(item => item.text).join(" ") }
      : surahAyahs.find(item => item.ayah === ayah);
  if (!target || !target.text) return res.status(404).json({ error: scope === "ayah" ? "ayah_not_found" : "surah_or_range_not_found" });
  const expectedAyahs = scope === "range" ? rangeAyahs : scope === "surah" ? surahAyahs : [target as Ayah];
  const expectedWordLocations = expectedAyahs.flatMap(item =>
    normalizeArabic(item.text).split(" ").filter(Boolean).map((_, index) => ({ surah: item.surah, ayah: item.ayah, wordIndex: index + 1 }))
  );
  try {
    const audioBytes = await readRawBody(req);
    if (audioBytes.byteLength < 1024) return res.status(400).json({ error: "audio_too_short", message: "التسجيل قصير جدًا للتحليل." });
    const contentType = String(req.headers["content-type"] || "audio/m4a").split(";")[0].trim() || "audio/m4a";

    // AI1: two different speech-to-text models inspect the same recording.
    // AI4: no specific word error is released unless the independent model agrees.
    const [primaryResult, verifierResult] = await Promise.allSettled([
      transcribeAudio(audioBytes, contentType, apiKey, "gpt-4o-mini-transcribe"),
      transcribeAudio(audioBytes, contentType, apiKey, "gpt-4o-transcribe")
    ]);
    if (primaryResult.status !== "fulfilled") {
      return res.status(502).json({
        error: "transcription_provider_failed",
        message: "تعذّر إكمال التعرّف على الصوت الآن."
      });
    }

    const transcript = primaryResult.value;
    const alignment = alignWords(target.text, transcript, scope === "range");
    const primaryMatchRate = scoreAlignment(alignment);
    let verifierTranscript: string | null = null;
    let verifierAlignment: ReturnType<typeof alignWords> | null = null;
    let verifierMatchRate: number | null = null;
    let transcriptAgreementRate: number | null = null;
    let verificationStatus: "completed" | "unavailable" = "unavailable";
    let contentGate = "verification_unavailable";
    let contentGateReason = "تعذّر التحقق المتقاطع؛ لم نعرض أخطاء كلمات غير مؤكدة.";
    let confirmedErrors: ReturnType<typeof alignWords>["errors"] = [];
    let confirmedMatchedIndexes: number[] = [];

    if (verifierResult.status === "fulfilled") {
      verifierTranscript = verifierResult.value;
      verifierAlignment = alignWords(target.text, verifierTranscript, scope === "range");
      verifierMatchRate = scoreAlignment(verifierAlignment);
      verificationStatus = "completed";

      const transcriptComparison = alignWords(transcript, verifierTranscript);
      transcriptAgreementRate = scoreAlignment(transcriptComparison);
      const consensusErrors = alignment.errors.filter(first =>
        verifierAlignment!.errors.some(second => sameAlignmentError(first, second))
      );
      const allCandidatesCorroborated =
        alignment.totalErrors <= alignment.errors.length
        && verifierAlignment.totalErrors <= verifierAlignment.errors.length
        && consensusErrors.length === alignment.totalErrors
        && consensusErrors.length === verifierAlignment.totalErrors;
      const bothTranscriptsPlausible = primaryMatchRate >= 85 && verifierMatchRate >= 85;

      if (!bothTranscriptsPlausible) {
        contentGate = "blocked_low_text_confidence";
        contentGateReason = "تطابق إحدى النتيجتين مع النص المرجعي منخفض؛ لم نعتمد مواضع أخطاء.";
      } else if (transcriptAgreementRate < 90) {
        contentGate = "review_required";
        contentGateReason = "اختلف محركا التعرف على الكلمات؛ نحتاج إلى تسجيل أوضح قبل تحديد الأخطاء.";
      } else if (!allCandidatesCorroborated) {
        contentGate = "review_required";
        contentGateReason = "لم يتفق المحركان على كل مواضع الاختلاف؛ لم نعتمد أي خطأ منفرد.";
      } else {
        confirmedErrors = consensusErrors;
        const verifierMatched = new Set(verifierAlignment.matchedExpectedIndexes);
        confirmedMatchedIndexes = alignment.matchedExpectedIndexes.filter(index => verifierMatched.has(index));
        if (consensusErrors.length === 0) {
          contentGate = "passed_consensus_no_mismatch";
          contentGateReason = "تطابقت نتيجتا التعرف مع النص المرجعي ولم تظهر اختلافات نصية مؤكدة.";
        } else {
          contentGate = "passed_consensus_with_mismatches";
          contentGateReason = "اتفق محركا التعرف على مواضع اختلاف نصية مرشحة للمراجعة.";
        }
      }
    }

    const matchRate = verifierMatchRate === null
      ? primaryMatchRate
      : Math.min(primaryMatchRate, verifierMatchRate);
    const expectedRuleChecks = scope === "ayah" ? findExpectedTajweedChecks(target.text) : [];
    const canReleaseResults = contentGate === "passed_consensus_no_mismatch"
      || contentGate === "passed_consensus_with_mismatches";
    const locatedErrors = contentGate === "passed_consensus_with_mismatches"
      ? confirmedErrors.slice(0, 20).map(error => {
          const locationIndex = Math.max(0, Math.min(expectedWordLocations.length - 1, (error.position || 1) - 1));
          const location = expectedWordLocations[locationIndex];
          return location ? { ...error, surah: location.surah, ayah: location.ayah, wordIndex: location.wordIndex } : error;
        })
      : [];
    const tajweed = scope !== "ayah"
      ? { status: "not_configured", rulesEvaluated: [] as string[], findings: [] as unknown[], message: "اكتملت مقارنة الكلمات المتصلة. محرك التجويد الصوتي متعدد الآيات غير مهيأ؛ لم نصدر حكمًا في التجويد." }
      : contentGate === "passed_consensus_no_mismatch"
        ? await runSpecializedTajweedEngine(audioBytes, contentType, surah, ayah, target.text, expectedRuleChecks)
        : { status: "blocked_by_confidence_gate", rulesEvaluated: [] as string[], findings: [] as unknown[], message: "لم نُصدر حكمًا صوتيًا لأن التحقق المتقاطع لم يكتمل بثقة كافية." };
    const engines = {
      speechRecognition: {
        status: "completed",
        model: "gpt-4o-mini-transcribe",
        verificationModel: "gpt-4o-transcribe"
      },
      quranAlignment: { status: "completed", matchRate, editDistance: alignment.editDistance },
      acousticTajweed: { status: tajweed.status, rulesEvaluated: tajweed.rulesEvaluated },
      confidenceGate: { status: contentGate, canReleaseResults }
    };
    return res.status(200).json({
      reference: {
        surah,
        ...(scope === "ayah" ? { ayah } : scope === "range"
          ? { scope: "range", startAyah, ayahCount: rangeAyahs.length }
          : { scope: "surah", ayahCount: surahAyahs.length }),
        riwaya: "حفص عن عاصم"
      },
      transcript,
      textAlignment: {
        ...alignment,
        errors: locatedErrors,
        matchedExpectedIndexes: canReleaseResults ? confirmedMatchedIndexes : []
      },
      matchRate,
      confidence: canReleaseResults ? "corroborated" : "needs_review",
      ai4x: {
        version: "1.0",
        stages: {
          audioRecognition: {
            status: "completed",
            primaryModel: "gpt-4o-mini-transcribe",
            verifierModel: "gpt-4o-transcribe",
            verifierStatus: verificationStatus
          },
          quranAlignment: {
            status: "completed",
            primaryMatchRate,
            verifierMatchRate,
            conservativeMatchRate: matchRate,
            transcriptAgreementRate
          },
          acousticTajweed: {
            status: tajweed.status,
            checkedRules: tajweed.rulesEvaluated.length,
            findingCount: Array.isArray(tajweed.findings) ? tajweed.findings.length : 0
          },
          confidenceGate: {
            status: contentGate,
            reason: contentGateReason,
            canReleaseResults,
            corroboratedErrorCount: locatedErrors.length
          }
        }
      },
      analysisLevel: scope === "surah" ? "full_surah_speech_to_text_alignment"
        : scope === "range" ? "continuous_surah_range_speech_to_text_alignment"
        : "speech_to_text_alignment",
      engines,
      tajweed,
      expectedRuleChecks,
      disclaimer: "معدل التطابق هو تطابق نصي تقريبي وليس درجة تجويد. لا تُعتمد النتائج الصوتية الآلية كإجازة أو بديل عن المعلّم؛ تعتمد دقتها على المحرك الصوتي والبيانات التي اختُبر عليها."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "AUDIO_TOO_LARGE") return res.status(413).json({ error: "audio_too_large", message: "التسجيل أكبر من الحد المسموح." });
    if (message === "ALIGNMENT_TOO_LARGE") return res.status(422).json({ error: "analysis_range_too_large", message: "نطاق التسميع كبير للتحليل دفعة واحدة. اختر نطاقًا أقصر ثم أعد التحليل." });
    console.error("Recitation analysis failed", message);
    return res.status(500).json({ error: "analysis_failed", message: "حدث خطأ أثناء تحليل التسجيل." });
  }
}
