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
  cursor: "rgba(224,169,59,0.28)", danger: "#E5534B", dark: "#1B1C1F", unsure: "#8E98A6",
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
    .replace(/ٰ/g, "ا") // dagger alif is a real long "a": مَٰلِكِ matches what is said: مالك
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ـ/g, "")
    .replace(/[^ء-ي\s]/g, " ").replace(/\s+/g, " ").trim();
}

type WordState = "ok" | "unsure" | "bad" | "skipped";

// Letters that speech recognition often confuses: a mismatch on them costs half an error.
const CONFUSABLE: Record<string, string> = { "ة": "ه", "ظ": "ض", "ط": "ت", "ذ": "ز", "ث": "س", "ؤ": "و", "ئ": "ي" };
function letterCost(a: string, b: string) {
  if (a === b) return 0;
  if (CONFUSABLE[a] === b || CONFUSABLE[b] === a || (CONFUSABLE[a] && CONFUSABLE[a] === CONFUSABLE[b])) return 0.5;
  return 1;
}
function weightedDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + letterCost(a[i - 1], b[j - 1]));
    }
    prev = cur;
  }
  return prev[b.length];
}
// ---------- Results of the recognizer ----------

type Heard = { alts: string[]; isFinal: boolean };

// The recognizer's result list as plain data.
function readResults(list: any): Heard[] {
  const out: Heard[] = [];
  for (let i = 0; i < list.length; i++) {
    const alts: string[] = [];
    for (let j = 0; j < list[i].length; j++) {
      const t = list[i][j]?.transcript;
      if (t) alts.push(t);
    }
    out.push({ alts, isFinal: !!list[i].isFinal });
  }
  return out;
}

// ---------- Alignment of the heard words with the verified words ----------

// The recognizer may drop a word, add a filler, write two words as one, or one word as two.
// The alignment finds the most likely reading: a verified word that is not heard costs something,
// a heard word that matches nothing costs something, and the cheapest reading wins.
const MISS_COST = 0.2;  // a verified word that was not heard
const EXTRA_COST = 0.8; // a heard word that is not in the verified text
const JOIN_COST = 0.3;  // two heard words for one verified word, or one heard word for two

// 0.1 or less: ok. Up to 0.5: unsure (the recognizer may be at fault). Otherwise (0.7): a different word.
// It must cost less than a skipped word plus an extra word, or a wrong word would be read as a skip.
function wordCost(expected: string, heard: string) {
  if (expected === heard) return 0;
  if (Math.min(expected.length, heard.length) < 2) return 0.7;
  const ratio = weightedDistance(expected, heard) / Math.max(expected.length, heard.length);
  return ratio <= 0.2 ? 0.1 : ratio <= 0.4 ? 0.5 : 0.7;
}
function costState(cost: number): WordState {
  return cost <= 0.1 ? "ok" : cost <= 0.5 ? "unsure" : "bad";
}

// What has been read: per verified word a state (and what was heard for a wrong one), and the next word to read.
type Track = { text: string; cursor: number; states: (WordState | undefined)[]; heardAt: (string | undefined)[] };
type Cell = { state: WordState; heard?: string };

function emptyTrack(n: number): Track {
  return { text: "", cursor: 0, states: Array(n).fill(undefined), heardAt: Array(n).fill(undefined) };
}

// Aligns the heard words with the verified words from `from` on. It may skip verified words (at a cost),
// and it may ignore heard words. Returns the cells of the verified words it covers, and the new cursor.
function alignFrom(expected: string[], from: number, heard: string[]) {
  const W = Math.min(expected.length - from, 90);
  const m = heard.length;
  const INF = 1e9;
  const D: number[][] = Array.from({ length: m + 1 }, () => Array(W + 1).fill(INF));
  const B: string[][] = Array.from({ length: m + 1 }, () => Array(W + 1).fill(""));
  D[0][0] = 0;
  for (let j = 1; j <= W; j++) { D[0][j] = D[0][j - 1] + MISS_COST; B[0][j] = "D"; }
  for (let i = 1; i <= m; i++) {
    D[i][0] = D[i - 1][0] + EXTRA_COST; B[i][0] = "I";
    for (let j = 1; j <= W; j++) {
      const e = expected[from + j - 1];
      let best = D[i - 1][j - 1] + wordCost(e, heard[i - 1]);
      let op = "S";
      const tryOp = (cost: number, name: string) => { if (cost < best) { best = cost; op = name; } };
      tryOp(D[i][j - 1] + MISS_COST, "D");
      tryOp(D[i - 1][j] + EXTRA_COST, "I");
      if (i >= 2) tryOp(D[i - 2][j - 1] + wordCost(e, heard[i - 2] + heard[i - 1]) + JOIN_COST, "M");
      if (j >= 2) tryOp(D[i - 1][j - 2] + wordCost(expected[from + j - 2] + e, heard[i - 1]) + JOIN_COST, "P");
      D[i][j] = best;
      B[i][j] = op;
    }
  }
  let jEnd = 0;
  for (let j = 1; j <= W; j++) if (D[m][j] < D[m][jEnd]) jEnd = j;

  // Walk back from the best end: what each verified word was.
  const cells: (Cell | undefined)[] = Array(jEnd).fill(undefined);
  const missed: boolean[] = Array(jEnd).fill(false);
  let i = m, j = jEnd;
  while (i > 0 || j > 0) {
    const op = i === 0 ? "D" : j === 0 ? "I" : B[i][j];
    if (op === "S") {
      cells[j - 1] = { state: costState(wordCost(expected[from + j - 1], heard[i - 1])), heard: heard[i - 1] };
      i--; j--;
    } else if (op === "D") {
      missed[j - 1] = true;
      j--;
    } else if (op === "I") {
      i--;
    } else if (op === "M") {
      const joined = heard[i - 2] + " " + heard[i - 1];
      cells[j - 1] = { state: costState(wordCost(expected[from + j - 1], heard[i - 2] + heard[i - 1])), heard: joined };
      i -= 2; j--;
    } else {
      const c = costState(wordCost(expected[from + j - 2] + expected[from + j - 1], heard[i - 1]));
      cells[j - 2] = { state: c, heard: heard[i - 1] };
      cells[j - 1] = cells[j - 2];
      i--; j -= 2;
    }
  }
  // A verified word missed on its own is unsure (the recognizer may have dropped it); two in a row are skipped.
  for (let c = 0; c < jEnd; c++) {
    if (!missed[c]) continue;
    const run = (c > 0 && missed[c - 1]) || (c + 1 < jEnd && missed[c + 1]);
    cells[c] = { state: run ? "skipped" : "unsure" };
  }
  return { cursor: from + jEnd, cells, cost: D[m][jEnd] };
}

// What the recognizer has said in one session. Its results are cumulative: the first `done` of them are final
// and already read into the track; the rest are still changing.
type Speech = { from: number; done: number; results: Heard[] };

function startSpeech(track: Track): Speech {
  return { from: track.cursor, done: 0, results: [] };
}

// Reads one final result into the track, with the guess that fits it best from where the reading stands.
function readFinal(expected: string[], track: Track, alts: string[]): Track {
  let best: { r: ReturnType<typeof alignFrom>; } | null = null;
  for (const alt of alts) {
    const words = normalizeArabic(alt).split(" ").filter(Boolean);
    if (!words.length) continue;
    const r = alignFrom(expected, track.cursor, words);
    if (!best || r.cost < best.r.cost) best = { r };
  }
  return best ? applyAlignment(track, track.cursor, best.r) : track;
}

// The words still changing: each of the newest results keeps the guess that fits the session best.
function pendingWords(expected: string[], speech: Speech) {
  const pending = speech.results.slice(speech.done);
  const choice = pending.map(() => 0);
  const wordsOf = (k: number, c: number) => normalizeArabic(pending[k].alts[c] ?? "").split(" ").filter(Boolean);
  const joint = () => pending.flatMap((_, k) => wordsOf(k, choice[k]));
  let best = alignFrom(expected, speech.from, joint()).cost;
  for (let k = Math.max(0, pending.length - 3); k < pending.length; k++) {
    for (let c = 1; c < pending[k].alts.length; c++) {
      const keep = choice[k];
      choice[k] = c;
      const cost = alignFrom(expected, speech.from, joint()).cost;
      if (cost < best) best = cost; else choice[k] = keep;
    }
  }
  return joint();
}

// Writes an alignment onto the track, from the word where it starts.
function applyAlignment(track: Track, from: number, r: { cursor: number; cells: (Cell | undefined)[] }): Track {
  const next: Track = { text: track.text, cursor: r.cursor, states: track.states.slice(), heardAt: track.heardAt.slice() };
  r.cells.forEach((c, k) => {
    if (!c) return;
    next.states[from + k] = c.state;
    next.heardAt[from + k] = c.state === "bad" ? c.heard : undefined;
  });
  return next;
}

// What the session shows now: the track with the words still changing on top. The newest word of a result
// still being said waits until it settles.
function viewOf(expected: string[], track: Track, speech: Speech): Track {
  const words = pendingWords(expected, speech);
  let r = alignFrom(expected, speech.from, words);
  const last = speech.results[speech.results.length - 1];
  if (last && !last.isFinal && words.length) {
    const newest = words[words.length - 1];
    const settled = r.cells.some(c => c && c.state === "ok" && c.heard !== undefined && c.heard.split(" ").pop() === newest);
    if (!settled) r = alignFrom(expected, speech.from, words.slice(0, -1));
  }
  return applyAlignment(track, speech.from, r);
}

// One event of a recognizer session: final results are read into the track, and the view is what is shown now.
function takeSpeech(expected: string[], track: Track, speech: Speech, results: Heard[]) {
  let t = track;
  let done = speech.done;
  while (done < results.length && results[done].isFinal) {
    t = readFinal(expected, t, results[done].alts);
    done++;
  }
  const next: Speech = { from: t.cursor, done, results };
  return { track: t, speech: next, view: viewOf(expected, t, next) };
}

// The session has ended: whatever it still holds is read as it is.
function endSpeech(expected: string[], track: Track, speech: Speech): Track {
  let t = track;
  for (let k = speech.done; k < speech.results.length; k++) t = readFinal(expected, t, speech.results[k].alts);
  return t;
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
  const [view, setView] = useState<Track | null>(null); // what is shown: the words read so far
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef<any>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const recording = state.isRecording;

  // Live recognition state: the recognizer's event handlers read these without re-subscribing.
  const expectedRef = useRef<string[]>([]);
  const trackRef = useRef<Track>(emptyTrack(0));                // what has been read, kept across pauses
  const peakRef = useRef(0);                                    // the furthest word reached: the shown place never steps back
  const sessionRef = useRef<{ id: number; speech: Speech } | null>(null); // the recognizer session that is running
  const sessionCountRef = useRef(0);
  const openRef = useRef(false);                               // a session has started and not ended yet
  const listeningRef = useRef(false);
  const idleRestartsRef = useRef(0);

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
    setView(null);
    clearReading();
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

  useEffect(() => {
    expectedRef.current = readable.map(i => wordInfo[i].norm);
  }, [readable, wordInfo]);

  const columnWidth = Math.min(screenWidth, COLUMN_MAX) - 40;

  // Measure each word with the mushaf font (web canvas) so the lines really fill the column.
  const [wordWidths, setWordWidths] = useState<number[] | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !wordInfo.length) return;
    let cancelled = false;
    const measure = () => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx || cancelled) return;
      ctx.font = `30px 'Amiri Quran', 'Amiri', serif`;
      setWordWidths(wordInfo.map(w => (w.marker ? 26 : ctx.measureText(w.text).width)));
    };
    const fonts = (document as any).fonts;
    if (fonts?.load) fonts.load(`30px 'Amiri Quran'`).then(measure, measure);
    else measure();
    return () => { cancelled = true; };
  }, [wordInfo]);

  // Break the surah into lines that fill the column, like a mushaf page.
  const lines = useMemo(() => {
    const gap = 8; // 4px margin on each side of a word
    const out: number[][] = [];
    let cur: number[] = [];
    let used = 0;
    wordInfo.forEach((w, i) => {
      const width = wordWidths ? wordWidths[i] : w.marker ? 26 : Math.max(1, w.norm.length) * 15;
      const wd = width + gap;
      if (cur.length && used + wd > columnWidth) { out.push(cur); cur = []; used = 0; }
      cur.push(i);
      used += wd;
    });
    if (cur.length) out.push(cur);
    return out;
  }, [wordInfo, wordWidths, columnWidth]);

  const tracked = useMemo(() => (view && readable.length ? view : null), [view, readable]);

  const byToken: Record<number, { state: WordState; heard?: string }> = {};
  let cursorToken = -1;
  if (tracked) {
    tracked.states.forEach((st, k) => {
      if (st) byToken[readable[k]] = { state: st, heard: tracked.heardAt[k] };
    });
    if (tracked.cursor < readable.length) cursorToken = readable[tracked.cursor];
  }
  const counts = { ok: 0, unsure: 0, bad: 0, skipped: 0 };
  Object.values(byToken).forEach(v => { counts[v.state]++; });
  const notReached = readable.length - counts.ok - counts.unsure - counts.bad - counts.skipped;
  const needReview = readable
    .filter(i => byToken[i] && (byToken[i].state === "bad" || byToken[i].state === "skipped"))
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
    listeningRef.current = true;
    // Chrome ends continuous recognition after pauses. While listening, a new session starts as soon as
    // the old one has ended, and the reading carries on from the same place.
    const launch = () => {
      try {
        const r = new Cls();
        r.lang = "ar-SA";
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 3;
        const id = ++sessionCountRef.current;
        sessionRef.current = { id, speech: startSpeech(trackRef.current) };
        openRef.current = true;
        r.onresult = (e: any) => {
          const session = sessionRef.current;
          if (!session || session.id !== id) return; // a session that was dropped
          const n = takeSpeech(expectedRef.current, trackRef.current, session.speech, readResults(e.results));
          trackRef.current = n.track;
          session.speech = n.speech;
          idleRestartsRef.current = 0;
          const cursor = Math.max(n.view.cursor, peakRef.current);
          peakRef.current = cursor;
          setView(cursor === n.view.cursor ? n.view : { ...n.view, cursor });
        };
        r.onerror = (e: any) => {
          if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
            listeningRef.current = false;
            setNotice("تعذّر التعرّف على الصوت. تأكد من إذن الميكروفون.");
          }
        };
        r.onend = () => {
          openRef.current = false;
          const session = sessionRef.current;
          if (session && session.id === id) {
            // What the session still held is read as it is, even when the page has stopped listening.
            trackRef.current = endSpeech(expectedRef.current, trackRef.current, session.speech);
            sessionRef.current = null;
            const cursor = Math.max(trackRef.current.cursor, peakRef.current);
            peakRef.current = cursor;
            setView(cursor === trackRef.current.cursor ? trackRef.current : { ...trackRef.current, cursor });
          }
          if (!listeningRef.current) return;
          // Stop if the recognizer keeps ending without hearing anything (no permission, no microphone).
          idleRestartsRef.current += 1;
          if (idleRestartsRef.current > 20) {
            listeningRef.current = false;
            setNotice("توقّف التعرّف على الصوت. اضغط الميكروفون تاني.");
            return;
          }
          setTimeout(() => { if (listeningRef.current && !openRef.current) launch(); }, 100);
        };
        r.start();
        recognitionRef.current = r;
      } catch {
        openRef.current = false;
        sessionRef.current = null;
        listeningRef.current = false;
        setNotice("تعذّر تشغيل التعرّف على الصوت في هذا المتصفح.");
      }
    };
    // If the previous session has not ended yet, its onend starts the next one.
    if (!openRef.current) launch();
  }

  function stopListening() {
    listeningRef.current = false;
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
      // A paused recitation picks up where it stopped; a finished one starts over.
      if (trackRef.current.cursor >= expectedRef.current.length) clearReading();
      setFinished(false);
      peakRef.current = trackRef.current.cursor;
      setView(trackRef.current);
      setNotice("");
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startListening();
    } catch {
      setNotice("تعذّر بدء التسميع. تأكد من إذن الميكروفون وحاول مرة أخرى.");
    }
  }

  function clearReading() {
    trackRef.current = emptyTrack(expectedRef.current.length);
    peakRef.current = 0;
    sessionRef.current = null; // whatever the old recognizer still sends is dropped
  }

  function restart() {
    stopListening();
    clearReading();
    setView(null);
    setFinished(false);
    setNotice("");
  }

  function openSurahs() {
    stopListening();
    router.push({ pathname: "/surahs", params: { current: String(surahNumber) } });
  }

  function goSurah(n: number) {
    stopListening();
    router.replace({ pathname: "/recite", params: { surah: String(n), ayah: "1", scope: "surah" } });
  }

  const seconds = Math.floor((state.durationMillis || 0) / 1000);
  const timer = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  const restartDisabled = recording || (!finished && !(view && view.cursor > 0));

  let status = startAyah > 1 ? `ابدأ من الآية ${startAyah} • اضغط الميكروفون` : "اضغط الميكروفون وابدأ التسميع";
  const done = readable.length > 0 && trackRef.current.cursor >= readable.length;
  if (recording) status = `● ${timer} • جارٍ الاستماع… اضغط للإيقاف المؤقت`;
  else if (finished) status = done ? "انتهى التسميع" : "متوقّف مؤقتًا • اضغط الميكروفون للمتابعة";

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.backButton}><Text style={s.back}>›</Text></Pressable>
        <View style={s.titleBlock}>
          <Text style={s.title} numberOfLines={1}>{surahName ? `سورة ${surahName}` : "التسميع"}</Text>
          <Text style={s.subtitle}>حفص عن عاصم</Text>
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
                  else if (result?.state === "unsure") style.push({ color: C.unsure });
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
              <Stat label="خطأ محتمل" value={counts.bad} color={C.bad} />
              <Stat label="غير متأكد" value={counts.unsure} color={C.unsure} />
              <Stat label="متخطّاة" value={counts.skipped} color={C.skipped} />
              <Stat label="لم تُقرأ" value={notReached} color={C.muted} />
            </View>
            {needReview.length > 0 && <Text style={s.reviewTitle}>كلمات تحتاج مراجعة</Text>}
            {needReview.map((i) => {
              const r = byToken[i];
              const label = r.state === "skipped" ? "متخطّاة" : "خطأ محتمل";
              const heardPart = r.state === "bad" && r.heard ? `  — سمعنا «${r.heard}»` : "";
              return <Text key={i} style={s.reviewRow}>{label}: {wordInfo[i].text}{heardPart}</Text>;
            })}
            <Text style={s.disclaimer}>
              الأحمر خطأ محتمل، والرمادي غير متأكد ولا يُحسب خطأ. هذا تعرّف تقريبي على الكلمات، وليس حكمًا على التجويد. راجع مع معلّمك للتأكد.
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
          <View style={s.dockEnd}>
            <Pressable onPress={restart} disabled={restartDisabled} style={[s.dockSide, restartDisabled && s.disabled]}>
              <Text style={s.dockIcon}>↻</Text>
              <Text style={s.dockLabel}>إعادة</Text>
            </Pressable>
          </View>

          <Pressable onPress={toggle} disabled={!ready} style={[s.mic, recording && s.micOn, !ready && s.disabled]}>
            {recording ? <View style={s.stopSquare} /> : <Text style={s.micIcon}>🎙️</Text>}
          </Pressable>

          <View style={[s.dockEnd, { justifyContent: "flex-end" }]}>
            <Pressable onPress={openSurahs} disabled={recording} style={[s.dockSide, recording && s.disabled]}>
              <Text style={s.dockIcon}>📖</Text>
              <Text style={s.dockLabel}>السورة</Text>
            </Pressable>
            <Pressable onPress={() => setHidden(v => !v)} style={s.dockSide}>
              <Text style={s.dockIcon}>{hidden ? "👁" : "🙈"}</Text>
              <Text style={s.dockLabel}>{hidden ? "إظهار" : "إخفاء"}</Text>
            </Pressable>
          </View>
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
  topBar: { paddingTop: Platform.OS === "web" ? 8 : 52, paddingHorizontal: 12, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bar },
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
  line: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap", marginBottom: 0 },
  word: { color: C.ink, fontFamily: QURAN_FONT, fontSize: 30, lineHeight: 46, marginHorizontal: 4, writingDirection: "rtl" },
  ayahMark: { color: C.gold, backgroundColor: C.goldSoft, fontFamily: QURAN_FONT, fontSize: 14, lineHeight: 26, marginHorizontal: 4, borderRadius: 13, overflow: "hidden" },
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
  dockSide: { alignItems: "center", gap: 2, paddingHorizontal: 6 },
  dockEnd: { flex: 1, flexDirection: "row", alignItems: "center" },
  dockIcon: { fontSize: 20, color: C.ink },
  dockLabel: { color: C.muted, fontSize: 11, fontWeight: "600" },
  mic: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.gold, alignItems: "center", justifyContent: "center", shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  micOn: { backgroundColor: C.danger, shadowColor: C.danger },
  disabled: { opacity: 0.4 },
  micIcon: { fontSize: 34 },
  stopSquare: { width: 26, height: 26, borderRadius: 6, backgroundColor: "#FFFFFF" },
});
