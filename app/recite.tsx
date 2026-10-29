import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { SURAHS } from "../src/quran/surahs";

const C = {
  bg: "#FFFFFF", ink: "#0F2233", muted: "#7B8794", line: "#EEF1F4",
  teal: "#0FA3B1", tealSoft: "#E3F6F8", tealInk: "#0B7F8B",
  ok: "#12A150", bad: "#E0413B", skipped: "#E08A00", mask: "#EEF2F5",
  cursor: "#FFF3C4", danger: "#F05A4F", white: "#FFFFFF",
};
const QURAN_FONT = Platform.select({
  ios: "Geeza Pro",
  android: "serif",
  default: "'Amiri', 'Scheherazade New', 'Traditional Arabic', serif",
});

// ---------- Arabic matching helpers ----------

function normalizeArabic(value: string) {
  return value.normalize("NFC")
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ـ/g, "")
    .replace(/[^ء-ي\s]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j], row[j - 1]) + 1;
      prev = tmp;
    }
  }
  return row[b.length];
}

// Speech-to-text is noisy: a heard word counts as the expected one when it is
// identical, or within one (short) / two (long) letters of it.
function sameWord(expected: string, heard: string) {
  if (expected === heard) return true;
  if (Math.min(expected.length, heard.length) < 4) return false;
  return levenshtein(expected, heard) <= (Math.max(expected.length, heard.length) > 6 ? 2 : 1);
}

type WordState = "ok" | "bad" | "skipped";

// Follows the recitation word by word along the verified text.
// match -> ok; a word found 1-3 positions ahead -> the words in between were skipped;
// anything else -> wrong word. While still speaking, the last interim word is held back.
function trackRecitation(expected: string[], spoken: string, final: boolean) {
  const heard = normalizeArabic(spoken).split(" ").filter(Boolean);
  const states: (WordState | undefined)[] = Array(expected.length).fill(undefined);
  const heardAt: (string | undefined)[] = Array(expected.length).fill(undefined);
  let p = 0;
  for (let idx = 0; idx < heard.length && p < expected.length; idx++) {
    const h = heard[idx];
    if (sameWord(expected[p], h)) { states[p] = "ok"; p++; continue; }
    let found = -1;
    for (let k = 1; k <= 3 && p + k < expected.length; k++) {
      if (sameWord(expected[p + k], h)) { found = k; break; }
    }
    if (found > 0) {
      for (let k = 0; k < found; k++) states[p + k] = "skipped";
      states[p + found] = "ok";
      p += found + 1;
      continue;
    }
    if (!final && idx === heard.length - 1) break;
    states[p] = "bad"; heardAt[p] = h; p++;
  }
  return { states, heardAt, cursor: p };
}

// ---------- Screen ----------

export default function Recite() {
  const params = useLocalSearchParams<{ surah?: string; ayah?: string; scope?: string }>();
  const surahNumber = Math.max(1, Math.min(114, Number(params.surah) || 1));
  const startAyah = Math.max(1, Number(params.ayah) || 1);
  const fullSurah = params.scope === "surah";
  const surahName = SURAHS.find(x => x.number === surahNumber)?.nameAr || "";

  const [referenceText, setReferenceText] = useState("");
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [heardText, setHeardText] = useState("");
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef<any>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const recording = state.isRecording;

  // Web only: load the Amiri Quran font so the mushaf looks like a mushaf.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("amiri-font")) return;
    const link = document.createElement("link");
    link.id = "amiri-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // Load the verified Hafs text (surah or single ayah).
  useEffect(() => {
    import("../src/quran/verified-corpus.json").then((m) => {
      const corpus = m.default as { ayahs: { surah: number; ayah: number; text: string }[] };
      const hits = fullSurah
        ? corpus.ayahs.filter(x => x.surah === surahNumber)
        : corpus.ayahs.filter(x => x.surah === surahNumber && x.ayah === startAyah);
      if (hits.length) {
        setReferenceText(hits.map(x => x.text + (fullSurah ? ` ﴿${x.ayah}﴾` : "")).join(" "));
        setReady(true);
      }
    }).catch(() => setNotice("تعذّر تحميل المصحف داخل التطبيق."));
  }, [fullSurah, surahNumber, startAyah]);

  const tokens = useMemo(() => referenceText.split(/\s+/u).filter(Boolean), [referenceText]);
  const wordInfo = useMemo(() => tokens.map(text => {
    const marker = /^﴿\d+﴾$/u.test(text);
    return {
      text,
      marker,
      num: marker ? text.replace(/[﴿﴾]/g, "") : "",
      norm: marker ? "" : normalizeArabic(text).replace(/ /g, ""),
    };
  }), [tokens]);
  const expectedIdx = useMemo(
    () => wordInfo.map((w, i) => (!w.marker && w.norm ? i : -1)).filter(i => i >= 0),
    [wordInfo]
  );

  const tracked = useMemo(() => {
    if (!expectedIdx.length || !heardText) return null;
    return trackRecitation(expectedIdx.map(i => wordInfo[i].norm), heardText, finished);
  }, [expectedIdx, wordInfo, heardText, finished]);

  const byToken: Record<number, { state: WordState; heard?: string }> = {};
  let cursorToken = -1;
  if (tracked) {
    expectedIdx.forEach((tokenIndex, k) => {
      const st = tracked.states[k];
      if (st) byToken[tokenIndex] = { state: st, heard: tracked.heardAt[k] };
    });
    if (tracked.cursor < expectedIdx.length) cursorToken = expectedIdx[tracked.cursor];
  }
  const counts = { ok: 0, bad: 0, skipped: 0 };
  Object.values(byToken).forEach(v => { counts[v.state]++; });
  const notReached = expectedIdx.length - counts.ok - counts.bad - counts.skipped;
  const needReview = expectedIdx
    .filter(i => byToken[i] && byToken[i].state !== "ok")
    .slice(0, 8);

  // ---------- Live word recognition (browser) ----------

  function startListening() {
    const g = globalThis as any;
    const Cls = g.SpeechRecognition || g.webkitSpeechRecognition;
    if (!Cls) {
      setNotice("التسميع يسجّل صوتك، لكن عرض الكلمات أثناء القراءة متاح حاليًا في متصفح Chrome.");
      return;
    }
    try {
      const r = new Cls();
      r.lang = "ar-SA";
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e: any) => {
        let t = "";
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0]?.transcript || "";
        setHeardText(t.trim());
      };
      r.onerror = () => setNotice("تعذّر التعرّف على الصوت. تأكد من إذن الميكروفون.");
      r.start();
      recognitionRef.current = r;
    } catch {
      setNotice("تعذّر تشغيل التعرّف على الصوت في هذا المتصفح.");
    }
  }

  function stopListening() {
    try { recognitionRef.current?.stop?.(); } catch {}
    recognitionRef.current = null;
  }

  async function toggle() {
    try {
      if (recording) {
        stopListening();
        await recorder.stop();
        setFinished(true);
        setNotice("");
        return;
      }
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { setNotice("اسمح بالميكروفون عشان تبدأ التسميع."); return; }
      setFinished(false);
      setHeardText("");
      setNotice("");
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startListening();
    } catch {
      setNotice("تعذّر بدء التسميع. تأكد من إذن الميكروفون وحاول مرة أخرى.");
    }
  }

  function restart() {
    stopListening();
    setHeardText("");
    setFinished(false);
    setNotice("");
  }

  const seconds = Math.floor((state.durationMillis || 0) / 1000);
  const timer = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  const restartDisabled = recording || (!finished && !heardText);

  let status = "اضغط الميكروفون وابدأ التسميع";
  if (recording) status = "جارٍ الاستماع… اضغط للإنهاء";
  else if (finished) status = "انتهى التسميع";

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backButton}><Text style={s.back}>›</Text></Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{surahName ? `سورة ${surahName}` : "التسميع"}</Text>
          <Text style={s.headerSub}>{recording ? `● ${timer}` : "رواية حفص عن عاصم"}</Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.content}>
        {ready ? (
          <Text style={s.mushaf}>
            {tokens.map((token, i) => {
              const info = wordInfo[i];
              if (info.marker) {
                return <Fragment key={i}><Text style={s.ayahMark}>{` ${info.num} `}</Text><Text> </Text></Fragment>;
              }
              const result = byToken[i];
              const isCursor = i === cursorToken && recording && !hidden;
              const style: any[] = [s.word];
              if (hidden && !result) style.push(s.masked);
              else if (result?.state === "ok") style.push({ color: C.ok });
              else if (result?.state === "bad") style.push({ color: C.bad });
              else if (result?.state === "skipped") style.push({ color: C.skipped });
              if (isCursor) style.push(s.cursor);
              // With the mushaf hidden, show what the reader actually said for wrong words.
              const shown = hidden && result?.state === "bad" && result.heard ? result.heard : token;
              return <Fragment key={i}><Text style={style}>{shown}</Text><Text> </Text></Fragment>;
            })}
          </Text>
        ) : (
          <Text style={s.loading}>جارٍ تحميل المصحف…</Text>
        )}

        {finished && (
          <View style={s.summary}>
            <Text style={s.summaryTitle}>ملخص التسميع</Text>
            <View style={s.statsRow}>
              <Stat label="صحيحة" value={counts.ok} color={C.ok} />
              <Stat label="خطأ" value={counts.bad} color={C.bad} />
              <Stat label="متخطّاة" value={counts.skipped} color={C.skipped} />
              <Stat label="لم تُقرأ" value={notReached} color={C.muted} />
            </View>
            {needReview.length > 0 && <Text style={s.reviewTitle}>كلمات تحتاج مراجعة</Text>}
            {needReview.map((i) => {
              const r = byToken[i];
              const label = r.state === "skipped" ? "متخطّاة" : "خطأ";
              const heardPart = r.state === "bad" && r.heard ? `  — سمعنا «${r.heard}»` : "";
              return <Text key={i} style={s.reviewRow}>{label}: {wordInfo[i].text}{heardPart}</Text>;
            })}
            <Text style={s.disclaimer}>
              هذا تعرّف تقريبي على الكلمات، وليس حكمًا على التجويد. راجع مع معلّمك للتأكد.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {!!notice && <Text style={s.notice}>{notice}</Text>}
        <Text style={s.status}>{status}</Text>
        <View style={s.dock}>
          <Pressable onPress={() => setHidden(v => !v)} style={s.dockSide}>
            <Text style={s.dockIcon}>{hidden ? "👁" : "🙈"}</Text>
            <Text style={s.dockLabel}>{hidden ? "إظهار المصحف" : "إخفاء المصحف"}</Text>
          </Pressable>

          <Pressable onPress={toggle} disabled={!ready} style={[s.mic, recording && s.micOn, !ready && s.micDisabled]}>
            {recording ? <View style={s.stopSquare} /> : <Text style={s.micIcon}>🎙️</Text>}
          </Pressable>

          <Pressable onPress={restart} disabled={restartDisabled} style={[s.dockSide, restartDisabled && s.micDisabled]}>
            <Text style={s.dockIcon}>↻</Text>
            <Text style={s.dockLabel}>إعادة</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: 52, paddingHorizontal: 12, paddingBottom: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.line },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  back: { color: C.ink, fontSize: 34, lineHeight: 36 },
  headerSpacer: { width: 42 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: C.ink, fontSize: 20, fontWeight: "700", fontFamily: QURAN_FONT },
  headerSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  body: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 250 },
  mushaf: { writingDirection: "rtl", textAlign: "justify", fontFamily: QURAN_FONT, fontSize: 32, lineHeight: 72, color: C.ink },
  word: { color: C.ink },
  ayahMark: { color: C.tealInk, backgroundColor: C.tealSoft, fontSize: 17, lineHeight: 30, borderRadius: 14, overflow: "hidden" },
  masked: { color: "transparent", backgroundColor: C.mask, borderRadius: 6 },
  cursor: { backgroundColor: C.cursor, borderRadius: 6 },
  loading: { textAlign: "center", color: C.muted, marginTop: 40 },
  summary: { backgroundColor: C.white, borderRadius: 22, padding: 18, marginTop: 22, borderWidth: 1, borderColor: C.line, shadowColor: "#0F2233", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  summaryTitle: { color: C.ink, fontSize: 16, fontWeight: "800", textAlign: "right" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: "#F6F8FA", borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 3 },
  reviewTitle: { color: C.ink, fontWeight: "700", fontSize: 13, textAlign: "right", marginTop: 16 },
  reviewRow: { color: "#8A5A00", fontSize: 13, lineHeight: 22, textAlign: "right", marginTop: 4 },
  disclaimer: { color: C.muted, fontSize: 10, lineHeight: 17, textAlign: "right", marginTop: 14 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 10, paddingBottom: 28, paddingHorizontal: 18, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
  notice: { textAlign: "center", color: "#8A5A00", fontSize: 11, lineHeight: 17, marginBottom: 6 },
  status: { textAlign: "center", fontWeight: "600", color: C.ink, fontSize: 13 },
  dock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, backgroundColor: "#F6F8FA", borderRadius: 40, paddingHorizontal: 14, paddingVertical: 8 },
  dockSide: { width: 96, alignItems: "center", gap: 2 },
  dockIcon: { fontSize: 20 },
  dockLabel: { color: C.muted, fontSize: 11, fontWeight: "600" },
  mic: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.teal, alignItems: "center", justifyContent: "center", shadowColor: C.teal, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  micOn: { backgroundColor: C.danger, shadowColor: C.danger },
  micDisabled: { opacity: 0.45 },
  micIcon: { fontSize: 34 },
  stopSquare: { width: 26, height: 26, borderRadius: 6, backgroundColor: C.white },
});
