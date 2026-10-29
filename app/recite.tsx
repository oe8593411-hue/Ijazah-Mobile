import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { SURAHS } from "../src/quran/surahs";

const C = {
  bg: "#1F2023", bar: "#17181B", card: "#26292F", line: "#2E3136",
  ink: "#F4EFE3", muted: "#9AA0A6", gold: "#E0A93B", goldSoft: "rgba(224,169,59,0.16)",
  ok: "#5FD38A", bad: "#FF6B6B", skipped: "#F5B041", mask: "#34373E",
  cursor: "rgba(224,169,59,0.28)", danger: "#E5534B", dark: "#1B1C1F",
};
const QURAN_FONT = Platform.select({
  ios: "Geeza Pro",
  android: "serif",
  default: "'Amiri Quran', 'Amiri', 'Scheherazade New', serif",
});
const COLUMN_MAX = 540;

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
  const surahName = SURAHS.find(x => x.number === surahNumber)?.nameAr || "";
  const { width: screenWidth } = useWindowDimensions();

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

  // Web only: load the Amiri Quran font (SIL OFL) for the mushaf text.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("amiri-quran-font")) return;
    const link = document.createElement("link");
    link.id = "amiri-quran-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Amiri:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // Load the verified Hafs text for the whole surah; the chosen ayah is only the starting point.
  useEffect(() => {
    import("../src/quran/verified-corpus.json").then((m) => {
      const corpus = m.default as { ayahs: { surah: number; ayah: number; text: string }[] };
      const hits = corpus.ayahs.filter(x => x.surah === surahNumber);
      if (hits.length) {
        setReferenceText(hits.map(x => x.text + ` ﴿${x.ayah}﴾`).join(" "));
        setReady(true);
      }
    }).catch(() => setNotice("تعذّر تحميل المصحف داخل التطبيق."));
    setFinished(false);
    setHeardText("");
  }, [surahNumber]);

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

  // Which ayah each token belongs to (a marker closes its ayah), and where reading starts.
  const ayahOfToken = useMemo(() => {
    let cur = 1;
    return wordInfo.map(w => {
      const v = cur;
      if (w.marker) cur = Number(w.num) + 1;
      return v;
    });
  }, [wordInfo]);
  const startPos = useMemo(() => {
    const k = expectedIdx.findIndex(i => ayahOfToken[i] >= startAyah);
    return k < 0 ? 0 : k;
  }, [expectedIdx, ayahOfToken, startAyah]);
  const readable = useMemo(() => expectedIdx.slice(startPos), [expectedIdx, startPos]);

  const columnWidth = Math.min(screenWidth, COLUMN_MAX) - 40;

  // Mushaf-style lines: break the text into lines of about the same length, and center
  // each line in the column, like the traditional mushaf page layout.
  const lines = useMemo(() => {
    const capacity = Math.max(12, Math.floor(columnWidth / 17)); // letters per line
    const out: number[][] = [];
    let cur: number[] = [];
    let len = 0;
    wordInfo.forEach((w, i) => {
      const l = w.marker ? 3 : Math.max(1, w.norm.length);
      if (cur.length && len + l > capacity) { out.push(cur); cur = []; len = 0; }
      cur.push(i);
      len += l + 1;
    });
    if (cur.length) out.push(cur);
    return out;
  }, [wordInfo, columnWidth]);

  const tracked = useMemo(() => {
    if (!readable.length || !heardText) return null;
    return trackRecitation(readable.map(i => wordInfo[i].norm), heardText, finished);
  }, [readable, wordInfo, heardText, finished]);

  const byToken: Record<number, { state: WordState; heard?: string }> = {};
  let cursorToken = -1;
  if (tracked) {
    tracked.states.forEach((st, k) => {
      if (st) byToken[readable[k]] = { state: st, heard: tracked.heardAt[k] };
    });
    if (tracked.cursor < readable.length) cursorToken = readable[tracked.cursor];
  }
  const counts = { ok: 0, bad: 0, skipped: 0 };
  Object.values(byToken).forEach(v => { counts[v.state]++; });
  const notReached = readable.length - counts.ok - counts.bad - counts.skipped;
  const needReview = readable
    .filter(i => byToken[i] && byToken[i].state !== "ok")
    .slice(0, 8);
  const progress = readable.length && tracked ? Math.min(1, tracked.cursor / readable.length) : 0;

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

  function goSurah(n: number) {
    stopListening();
    router.replace({ pathname: "/recite", params: { surah: String(n), ayah: "1", scope: "surah" } });
  }

  const seconds = Math.floor((state.durationMillis || 0) / 1000);
  const timer = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  const restartDisabled = recording || (!finished && !heardText);

  let status = "اضغط الميكروفون وابدأ التسميع";
  if (recording) status = "جارٍ الاستماع… اضغط للإنهاء";
  else if (finished) status = "انتهى التسميع";

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.backButton}><Text style={s.back}>›</Text></Pressable>
        <View style={s.titleBlock}>
          <Text style={s.title} numberOfLines={1}>{surahName ? `سورة ${surahName}` : "التسميع"}</Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {recording ? `● ${timer}` : startAyah > 1 ? `تبدأ من الآية ${startAyah} • حفص عن عاصم` : "السورة كاملة • حفص عن عاصم"}
          </Text>
        </View>
        <View style={s.segment}>
          <Pressable onPress={() => setHidden(false)} style={[s.segItem, !hidden && s.segActive]}>
            <Text style={[s.segText, !hidden && s.segTextActive]}>الآيات</Text>
          </Pressable>
          <Pressable onPress={() => setHidden(true)} style={[s.segItem, hidden && s.segActive]}>
            <Text style={[s.segText, hidden && s.segTextActive]}>مخفية</Text>
          </Pressable>
        </View>
      </View>
      <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>

      <ScrollView style={s.body} contentContainerStyle={s.content}>
        {ready ? (
          <View style={s.column}>
            {lines.map((line, li) => (
              <View key={li} style={s.line}>
                {line.map((i) => {
                  const info = wordInfo[i];
                  if (info.marker) return <Text key={i} style={s.ayahMark}>{` ${info.num} `}</Text>;
                  const result = byToken[i];
                  const isCursor = i === cursorToken && recording && !hidden;
                  const style: any[] = [s.word];
                  if (hidden && !result) style.push(s.masked);
                  else if (result?.state === "ok") style.push({ color: C.ok });
                  else if (result?.state === "bad") style.push({ color: C.bad });
                  else if (result?.state === "skipped") style.push({ color: C.skipped });
                  if (isCursor) style.push(s.cursor);
                  // With the verses hidden, show what the reader actually said for wrong words.
                  const shown = hidden && result?.state === "bad" && result.heard ? result.heard : info.text;
                  return <Text key={i} style={style}>{shown}</Text>;
                })}
              </View>
            ))}
          </View>
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
            <View style={s.navRow}>
              {surahNumber > 1 && (
                <Pressable onPress={() => goSurah(surahNumber - 1)} style={s.navButton}>
                  <Text style={s.navText}>› السورة السابقة</Text>
                </Pressable>
              )}
              {surahNumber < 114 && (
                <Pressable onPress={() => goSurah(surahNumber + 1)} style={s.navButton}>
                  <Text style={s.navText}>السورة التالية ‹</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {!!notice && <Text style={s.notice}>{notice}</Text>}
        <Text style={s.status}>{status}</Text>
        <View style={s.dock}>
          <Pressable onPress={restart} disabled={restartDisabled} style={[s.dockSide, restartDisabled && s.disabled]}>
            <Text style={s.dockIcon}>↻</Text>
            <Text style={s.dockLabel}>إعادة</Text>
          </Pressable>

          <Pressable onPress={toggle} disabled={!ready} style={[s.mic, recording && s.micOn, !ready && s.disabled]}>
            {recording ? <View style={s.stopSquare} /> : <Text style={s.micIcon}>🎙️</Text>}
          </Pressable>

          <Pressable onPress={() => setHidden(v => !v)} style={s.dockSide}>
            <Text style={s.dockIcon}>{hidden ? "👁" : "🙈"}</Text>
            <Text style={s.dockLabel}>{hidden ? "إظهار الآيات" : "إخفاء الآيات"}</Text>
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
  topBar: { paddingTop: 52, paddingHorizontal: 12, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bar },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  back: { color: C.gold, fontSize: 34, lineHeight: 36 },
  titleBlock: { flex: 1, alignItems: "flex-start" },
  title: { color: C.ink, fontSize: 17, fontWeight: "700" },
  subtitle: { color: C.muted, fontSize: 11, marginTop: 2 },
  segment: { flexDirection: "row", backgroundColor: C.card, borderRadius: 20, padding: 3, borderWidth: 1, borderColor: C.line },
  segItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  segActive: { backgroundColor: C.gold },
  segText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  segTextActive: { color: C.dark },
  progressTrack: { height: 3, backgroundColor: C.line },
  progressFill: { height: 3, backgroundColor: C.gold },
  body: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 250, alignItems: "center" },
  column: { width: "100%", maxWidth: COLUMN_MAX },
  line: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", flexWrap: "nowrap", marginBottom: 0 },
  word: { color: C.ink, fontFamily: QURAN_FONT, fontSize: 30, lineHeight: 46, marginHorizontal: 4, writingDirection: "rtl" },
  ayahMark: { color: C.gold, backgroundColor: C.goldSoft, fontFamily: QURAN_FONT, fontSize: 16, lineHeight: 34, borderRadius: 16, overflow: "hidden" },
  masked: { color: "transparent", backgroundColor: C.mask, borderRadius: 6 },
  cursor: { backgroundColor: C.cursor, borderRadius: 6 },
  loading: { textAlign: "center", color: C.muted, marginTop: 40 },
  summary: { width: "100%", maxWidth: COLUMN_MAX, backgroundColor: C.card, borderRadius: 20, padding: 18, marginTop: 24, borderWidth: 1, borderColor: C.line },
  summaryTitle: { color: C.gold, fontSize: 16, fontWeight: "800", textAlign: "right" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.bar, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 3 },
  reviewTitle: { color: C.ink, fontWeight: "700", fontSize: 13, textAlign: "right", marginTop: 16 },
  reviewRow: { color: C.skipped, fontSize: 13, lineHeight: 22, textAlign: "right", marginTop: 4 },
  disclaimer: { color: C.muted, fontSize: 10, lineHeight: 17, textAlign: "right", marginTop: 14 },
  navRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  navButton: { flex: 1, backgroundColor: C.bar, borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: C.gold },
  navText: { color: C.gold, fontWeight: "700", fontSize: 13 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 10, paddingBottom: 28, paddingHorizontal: 18, backgroundColor: C.bar, borderTopWidth: 1, borderTopColor: C.line },
  notice: { textAlign: "center", color: C.gold, fontSize: 11, lineHeight: 17, marginBottom: 6 },
  status: { textAlign: "center", fontWeight: "600", color: C.ink, fontSize: 13 },
  dock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, backgroundColor: C.card, borderRadius: 40, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line },
  dockSide: { width: 96, alignItems: "center", gap: 2 },
  dockIcon: { fontSize: 20, color: C.ink },
  dockLabel: { color: C.muted, fontSize: 11, fontWeight: "600" },
  mic: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.gold, alignItems: "center", justifyContent: "center", shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  micOn: { backgroundColor: C.danger, shadowColor: C.danger },
  disabled: { opacity: 0.4 },
  micIcon: { fontSize: 34 },
  stopSquare: { width: 26, height: 26, borderRadius: 6, backgroundColor: "#FFFFFF" },
});
