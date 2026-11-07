import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { decode as decodeMessagePack, encode as encodeMessagePack } from "@msgpack/msgpack";
import { router, useLocalSearchParams } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { SURAHS } from "../src/quran/surahs";
import MUSHAF_PAGES from "../src/quran/mushaf-pages.json";
import { normalizeArabic, type WordState, readResults, type Track, emptyTrack, type Speech, startSpeech, takeSpeech, endSpeech } from "../src/recitation/matching";

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

// Lines are filled like a mushaf: spare width goes into tatweels (kashida), which stretch letters instead of opening gaps.
const TATWEEL = "ـ";
const CONNECTS_LEFT = /[بتثجحخسشصضطظعغفقكلمنهيئ]/u;
const HARAKA = /[ً-ٰٟۖ-ۭ]/u;
const LETTER = /\p{L}/u;
const ALEF = /[اأإآٱ]/u;

// Places inside a word where a tatweel can sit: after a letter that joins the next one, past its harakat.
function joinPoints(text: string): number[] {
  const chars = Array.from(text);
  const points: number[] = [];
  chars.forEach((c, i) => {
    if (!CONNECTS_LEFT.test(c)) return;
    let j = i + 1;
    while (j < chars.length && HARAKA.test(chars[j])) j++;
    if (j >= chars.length || !LETTER.test(chars[j]) || chars[j] === "ء") return;
    if (c === "ل" && ALEF.test(chars[j])) return; // lam-alef stays one ligature
    points.push(j);
  });
  return points;
}

function stretchWord(text: string, count: number): string {
  const points = joinPoints(text);
  if (!points.length || count <= 0) return text;
  const at = new Map<number, number>();
  points.forEach((p, k) => at.set(p, Math.floor(count / points.length) + (k < count % points.length ? 1 : 0)));
  return Array.from(text).map((c, i) => TATWEEL.repeat(at.get(i) ?? 0) + c).join("");
}
// The basmala is shown above each surah, as in the mushaf, except At-Tawbah, which has none.
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

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

  useEffect(() => () => { stopListening(); stopAI4XRealtime(); }, []);

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
  const [nabrStatus, setNabrStatus] = useState<"idle" | "connecting" | "recording" | "unavailable" | "complete">("idle");
  const [nabrFeedback, setNabrFeedback] = useState<any>(null);
  const nabrFeedbackRef = useRef<any>(null);
  const nabrSocketRef = useRef<any>(null);
  const nabrStreamRef = useRef<any>(null);
  const nabrContextRef = useRef<any>(null);
  const nabrProcessorRef = useRef<any>(null);
  const nabrSourceRef = useRef<any>(null);
  const nabrMuteRef = useRef<any>(null);
  const nabrPendingSamplesRef = useRef<number[]>([]);
  const nabrSessionStartedRef = useRef(false);
  const nabrStartSentRef = useRef(false);

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
  // The width the column really has once laid out, so the lines fill exactly what is shown.
  const [colWidth, setColWidth] = useState(0);
  const fitWidth = colWidth || columnWidth;

  // Measure each word with the mushaf font (web canvas) so the lines really fill the column.
  const [wordWidths, setWordWidths] = useState<number[] | null>(null);
  const [tatWidth, setTatWidth] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !wordInfo.length) return;
    let cancelled = false;
    const measure = () => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx || cancelled) return;
      ctx.font = `30px 'Amiri Quran', 'Amiri', serif`;
      setWordWidths(wordInfo.map(w => (w.marker ? 26 : ctx.measureText(w.text).width)));
      setTatWidth(ctx.measureText(TATWEEL).width);
    };
    const fonts = (document as any).fonts;
    if (fonts?.load) fonts.load(`30px 'Amiri Quran'`).then(measure, measure);
    else measure();
    return () => { cancelled = true; };
  }, [wordInfo]);

  // Most surahs open with the basmala inside verse 1. It is shown once, as the header, and the verses flow after it.
  const BASMALA_NORM = ["بسم", "الله", "الرحمان", "الرحيم"];
  const hasBasmala = surahNumber !== 1 && surahNumber !== 9 && BASMALA_NORM.every((n, k) => wordInfo[k]?.norm === n);
  const headerEnd = surahNumber === 1 ? wordInfo.findIndex(w => w.marker) + 1 : hasBasmala ? BASMALA_NORM.length : 0;
  const showBasmala = surahNumber !== 9;

  // Break the surah into lines that fill the column, like a mushaf page. A new Madinah page always starts a new line.
  const { rows: lines, pageAt } = useMemo(() => {
    const gap = 8; // 4px margin on each side of a word
    const rows: number[][] = [];
    const pageAt: Record<number, number> = {}; // line index -> the mushaf page that line starts
    let cur: number[] = [];
    let used = 0;
    let curPage = 0;
    wordInfo.forEach((w, i) => {
      if (i < headerEnd) return;
      const page = pageOfAyah(surahNumber, ayahOfToken[i]);
      const width = wordWidths ? wordWidths[i] : w.marker ? 26 : Math.max(1, w.norm.length) * 15;
      const wd = width + gap;
      const newPage = page !== curPage;
      if (cur.length && (newPage || used + wd > fitWidth)) { rows.push(cur); cur = []; used = 0; }
      if (newPage) { pageAt[rows.length] = page; curPage = page; }
      cur.push(i);
      used += wd;
    });
    if (cur.length) rows.push(cur);
    return { rows, pageAt };
  }, [wordInfo, wordWidths, fitWidth, headerEnd, ayahOfToken, surahNumber]);

  // Spare width in each line becomes tatweels. A line that would need more than 30% of its words' width is left
  // centred at normal size instead (like the last line of a page), so no word is stretched out of shape.
  const stretched = useMemo(() => {
    const words = new Map<number, string>();
    const centred = new Set<number>();
    if (!wordWidths || !tatWidth) return { words, centred };
    lines.forEach((line, li) => {
      const used = line.reduce((sum, i) => sum + wordWidths[i] + 8, 0);
      const spare = fitWidth - used;
      if (spare <= 0) return;
      const cands = line.filter(i => !wordInfo[i].marker && joinPoints(wordInfo[i].text).length > 0);
      const capacity = cands.reduce((sum, i) => sum + wordWidths[i], 0) * 0.3;
      if (spare > capacity) { centred.add(li); return; }
      let left = Math.floor(spare / tatWidth);
      const count = new Map<number, number>();
      while (left > 0 && cands.length) {
        for (const i of cands) {
          if (left <= 0) break;
          count.set(i, (count.get(i) ?? 0) + 1);
          left--;
        }
      }
      count.forEach((n, i) => words.set(i, stretchWord(wordInfo[i].text, n)));
    });
    return { words, centred };
  }, [lines, wordWidths, tatWidth, fitWidth, wordInfo]);

  const tracked = useMemo(() => (view && readable.length ? view : null), [view, readable]);

  const byToken: Record<number, { state: WordState; heard?: string }> = {};
  let cursorToken = -1;
  if (tracked && (process.env.EXPO_PUBLIC_IJAZAH_AI4X_REALTIME !== "true" || nabrFeedback)) {
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

  // One word of the verses (or of the header), colored by what the reader has said so far.
  const renderWord = (i: number) => {
    const info = wordInfo[i];
    if (info.marker) return <AyahMark key={i} num={info.num} />;
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
    const shown = hidden && result?.state === "bad" && result.heard ? result.heard : (stretched.words.get(i) ?? info.text);
    return <Text key={i} style={style}>{shown}</Text>;
  };

 function mergeNabrFeedback(previous:any,next:any){
  if(!next||next.event!=="TILAWA_RESULT"||![6,8].includes(Number(next.exit_code)))return previous;
  const fields=["correct_words","skipped_words","tajweed_mistakes","letter_mistakes"];
  const merged:any={...(previous||{}),...next};
  for(const field of fields){
   const map=new Map<string,any>();
   for(const item of [...(previous?.[field]||[]),...(next?.[field]||[])]){
    if(!item||typeof item!=="object")continue;
    const key=[item.chapter,item.verse,item.word,item.letter??"",item.errorCode??"",item.message??""].join(":");
    map.set(key,item);
   }
   merged[field]=Array.from(map.values()).slice(-1200);
  }
  return merged;
 }


 function applyNabrFeedback(feedback:any){
  const keyed=new Map<string,WordState>();
  const add=(items:any[],state:WordState)=>{
   for(const item of items||[]){
    if(!item||Number(item.chapter)!==surahNumber||!Number.isInteger(Number(item.verse)))continue;
    const word=Number(item.word);
    if(!Number.isInteger(word)||word<1)continue;
    keyed.set([surahNumber,Number(item.verse),word].join(":"),state);
   }
  };
  add(feedback?.correct_words||[],"ok");
  add(feedback?.skipped_words||[],"skipped");
  add(feedback?.letter_mistakes||[],"bad");
  const next=emptyTrack(readable.length);
  const counters=new Map<number,number>();
  let cursor=0;
  for(let i=0;i<readable.length;i++){
   const verse=ayahOfToken[readable[i]];
   const word=(counters.get(verse)||0)+1;
   counters.set(verse,word);
   const state=keyed.get([surahNumber,verse,word].join(":"));
   if(state){next.states[i]=state;cursor=i+1;}
  }
  next.cursor=cursor;
  trackRef.current=next;
  peakRef.current=cursor;
  setView(next);
 }

 function pcmToWav(samples:Int16Array){
  const buffer=new ArrayBuffer(44+samples.length*2);
  const view=new DataView(buffer);
  const write=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  write(0,"RIFF");view.setUint32(4,36+samples.length*2,true);write(8,"WAVE");write(12,"fmt ");
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  write(36,"data");view.setUint32(40,samples.length*2,true);
  new Int16Array(buffer,44,samples.length).set(samples);
  return new Uint8Array(buffer);
 }

 function stopAI4XRealtime(){
  const socket=nabrSocketRef.current;
  const shouldReset=nabrStartSentRef.current;
  nabrSessionStartedRef.current=false;
  try{nabrProcessorRef.current?.disconnect?.();}catch{}
  try{nabrSourceRef.current?.disconnect?.();}catch{}
  try{nabrMuteRef.current?.disconnect?.();}catch{}
  try{nabrStreamRef.current?.getTracks?.().forEach((track:any)=>track.stop());}catch{}
  try{void nabrContextRef.current?.close?.();}catch{}
  nabrProcessorRef.current=null;nabrSourceRef.current=null;nabrMuteRef.current=null;nabrContextRef.current=null;nabrStreamRef.current=null;
  nabrPendingSamplesRef.current=[];
  if(socket){
   try{
    if(socket.readyState===1&&shouldReset){
     socket.send(encodeMessagePack({method:"RESET_TILAWA_SESSION"}));
    }
   }catch{}
   try{setTimeout(()=>{try{socket.close();}catch{}},350);}catch{}
  }
  nabrStartSentRef.current=false;
  nabrSocketRef.current=null;
  setNabrStatus(previous=>previous==="unavailable"?"unavailable":nabrFeedbackRef.current?"complete":"idle");
 }

 async function startAI4XRealtime():Promise<boolean>{
  if(process.env.EXPO_PUBLIC_IJAZAH_AI4X_REALTIME!=="true")return false;
  const root=globalThis as any;
  const mediaDevices=root.navigator?.mediaDevices;
  const AudioContextClass=root.AudioContext||root.webkitAudioContext;
  const WebSocketClass=root.WebSocket;
  if(!mediaDevices?.getUserMedia||!AudioContextClass||!WebSocketClass){
   setNabrStatus("unavailable");return false;
  }
  setNabrStatus("connecting");
  let resolved=false;
  let timeout:any=null;
  let resolveStart:(value:boolean)=>void=()=>{};
  const started=new Promise<boolean>(resolve=>{resolveStart=resolve;});
  const finishStart=(value:boolean)=>{if(!resolved){resolved=true;if(timeout)clearTimeout(timeout);resolveStart(value);}};
  try{
   nabrFeedbackRef.current=null;
   setNabrFeedback(null);
   const stream=await mediaDevices.getUserMedia({
    audio:{channelCount:1,sampleRate:16000,echoCancellation:false,noiseSuppression:false,autoGainControl:false}
   });
   nabrStreamRef.current=stream;
   const context=new AudioContextClass({sampleRate:16000});
   nabrContextRef.current=context;
   const source=context.createMediaStreamSource(stream);
   const processor=context.createScriptProcessor(4096,1,1);
   const mute=context.createGain();mute.gain.value=0;
   nabrSourceRef.current=source;nabrProcessorRef.current=processor;nabrMuteRef.current=mute;
   processor.onaudioprocess=(event:any)=>{
    const socket=nabrSocketRef.current;
    if(!nabrSessionStartedRef.current||!socket||socket.readyState!==1)return;
    const input=event.inputBuffer.getChannelData(0);
    const ratio=context.sampleRate/16000;
    const outputLength=Math.floor(input.length/ratio);
    const pending=nabrPendingSamplesRef.current;
    for(let i=0;i<outputLength;i++){
     const position=i*ratio;const left=Math.floor(position);const right=Math.min(input.length-1,left+1);
     const fraction=position-left;
     const sample=Math.max(-1,Math.min(1,input[left]*(1-fraction)+input[right]*fraction));
     pending.push(Math.round(sample<0?sample*0x8000:sample*0x7fff));
    }
    while(pending.length>=3200){
     const frame=Int16Array.from(pending.splice(0,3200));
     try{
      socket.send(encodeMessagePack({method:"CHECK_TILAWA_AUDIO",audio:pcmToWav(frame),client_sent_at_ms:Date.now()}));
     }catch{
      nabrSessionStartedRef.current=false;
      setNabrStatus("unavailable");
     }
    }
   };
   source.connect(processor);processor.connect(mute);mute.connect(context.destination);

   const configuredBase=(process.env.EXPO_PUBLIC_IJAZAH_API_URL||root.location?.origin||"").replace(/\/$/,"");
   if(!configuredBase)throw new Error("NO_API_ORIGIN");
   const socketUrl=new URL("/api/ai4x-stream",configuredBase);
   socketUrl.protocol=socketUrl.protocol==="https:"?"wss:":"ws:";
   const socket=new WebSocketClass(socketUrl.toString());
   nabrSocketRef.current=socket;
   socket.binaryType="arraybuffer";
   timeout=setTimeout(()=>{finishStart(false);setNabrStatus("unavailable");try{socket.close();}catch{}},15000);
   socket.onmessage=(event:any)=>{
    try{
     const packet=event.data instanceof ArrayBuffer
      ? new Uint8Array(event.data)
      : event.data instanceof Blob
       ? new Uint8Array([])
       : event.data;
     const message=decodeMessagePack(packet as Uint8Array) as any;
     if(message?.event==="QRC_CLIENT_CONNECTED"&&!nabrStartSentRef.current){
      nabrStartSentRef.current=true;
      socket.send(encodeMessagePack({
       method:"START_TILAWA_SESSION",
       chapter_index:surahNumber,
       verse_index:Math.max(1,startAyah),
       word_index:1,
       hafz_level:1,
       tajweed_level:1
      }));
     }else if(message?.event==="TILAWA_SESSION_STARTED"){
      if(message.exit_code===6){
       nabrSessionStartedRef.current=true;
       setNabrStatus("recording");
       finishStart(true);
      }else{
       setNabrStatus("unavailable");finishStart(false);
      }
     }else if(message?.event==="TILAWA_RESULT"){
      const merged=mergeNabrFeedback(nabrFeedbackRef.current,message);
      nabrFeedbackRef.current=merged;
      setNabrFeedback(merged);
      applyNabrFeedback(merged);
      setNabrStatus("recording");
     }else if(message?.event==="QRC_ERROR"){
      nabrSessionStartedRef.current=false;
      setNabrStatus("unavailable");
      finishStart(false);
     }
    }catch{
     setNabrStatus("unavailable");finishStart(false);
    }
   };
   socket.onerror=()=>{setNabrStatus("unavailable");finishStart(false);};
   socket.onclose=()=>{if(!nabrSessionStartedRef.current){setNabrStatus(previous=>previous==="complete"?previous:"unavailable");finishStart(false);}};
   await context.resume?.();
   const didStart=await started;
   if(!didStart){
    stopAI4XRealtime();
    setNabrStatus("unavailable");
    return false;
   }
   return true;
  }catch{
   stopAI4XRealtime();setNabrStatus("unavailable");return false;
  }
 }


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
        stopAI4XRealtime();
        await recorder.stop();
        setFinished(true);
        setNotice(process.env.EXPO_PUBLIC_IJAZAH_AI4X_REALTIME === "true" && !nabrFeedbackRef.current
          ? "لم تصل نتيجة صوتية موثوقة من AI4X؛ لم نعتمد تصحيحًا."
          : "");
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
      nabrFeedbackRef.current = null;
      setNabrFeedback(null);
      setNabrStatus("idle");
      const specialistStarted = await startAI4XRealtime();
      if (!specialistStarted) startListening();
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
    stopAI4XRealtime();
    clearReading();
    setView(null);
    setNabrFeedback(null);
    nabrFeedbackRef.current = null;
    setNabrStatus("idle");
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
          <View style={s.column} onLayout={e => setColWidth(e.nativeEvent.layout.width)}>
            {showBasmala && (surahNumber === 1 || hasBasmala ? (
              <View style={[s.line, s.header, { justifyContent: "center" }]}>
                {wordInfo.slice(0, headerEnd).map((_, i) => renderWord(i))}
              </View>
            ) : (
              <Text style={s.basmala}>{BASMALA}</Text>
            ))}
            {lines.map((line, li) => (
              <View key={li}>
                {pageAt[li] !== undefined && <PageMark num={pageAt[li]} />}
                <View style={[s.line, stretched.centred.has(li) ? { justifyContent: "center" } : null]}>
                  {line.map(renderWord)}
                </View>
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
        {process.env.EXPO_PUBLIC_IJAZAH_AI4X_REALTIME === "true" && nabrStatus !== "idle" && (
          <Text style={s.notice}>{nabrStatus === "connecting" ? "AI4X: جارٍ الاتصال بالمحرك الصوتي" : nabrStatus === "recording" ? "AI4X: تحليل صوتي مباشر" : nabrStatus === "complete" ? "AI4X: انتهى التحليل" : "AI4X: المحرك غير متاح"}</Text>
        )}
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

// The ayah number inside a gold ring, the way the mushaf marks the end of a verse.
// The Madinah mushaf page of an ayah: the last page whose start is at or before it.
function pageOfAyah(surah: number, ayah: number): number {
  let page = 1;
  for (let p = 0; p < MUSHAF_PAGES.pages.length; p++) {
    const [ps, pa] = MUSHAF_PAGES.pages[p];
    if (ps > surah || (ps === surah && pa > ayah)) break;
    page = p + 1;
  }
  return page;
}

// Divider at the start of a mushaf page, with its number.
function PageMark({ num }: { num: number }) {
  return (
    <View style={s.pageMark}>
      <Text style={s.pageNum}>{`صفحة ${num}`}</Text>
    </View>
  );
}

function AyahMark({ num }: { num: string }) {
  return (
    <View style={s.ayahMark}>
      <View style={s.ayahRing}>
        <Text style={s.ayahNum}>{num}</Text>
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
  ayahMark: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: C.gold, backgroundColor: C.goldSoft, alignItems: "center", justifyContent: "center", marginHorizontal: 4 },
  pageMark: { alignItems: "center", marginTop: 18, marginBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line },
  pageNum: { color: C.gold, fontSize: 12, fontWeight: "700" },
  ayahRing: { width: 18, height: 18, borderRadius: 9, borderWidth: 0.8, borderColor: C.gold, alignItems: "center", justifyContent: "center" },
  ayahNum: { color: C.gold, fontSize: 10, fontWeight: "700", textAlign: "center" },
  header: { width: "100%", marginBottom: 14 },
  basmala: { width: "100%", color: C.ink, fontFamily: QURAN_FONT, fontSize: 30, lineHeight: 46, textAlign: "center", writingDirection: "rtl", marginBottom: 14 },
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
