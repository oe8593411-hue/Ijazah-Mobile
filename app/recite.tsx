import { useEffect, useRef, useState } from "react";
import { decode as decodeMessagePack, encode as encodeMessagePack } from "@msgpack/msgpack";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { getSelectedRiwayah, setSelectedRiwayah } from "../src/quran/riwayah";
import { usePreferences } from "../src/preferences";
import { SURAHS } from "../src/quran/surahs";

const C={navy:"#071A33",navy2:"#102B49",cyan:"#35C7DE",soft:"#E5F8FC",ink:"#142A43",muted:"#788BA0",surface:"#F4F8FC",white:"#FFFFFF"};

function normalizeArabicForCompare(value:string){
 return value.normalize("NFC").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ـ/g,"").replace(/[^\u0621-\u064A\s]/g," ").replace(/\s+/g," ").trim();
}
function compareRecognizedWords(expectedText:string, spokenText:string, allowPrefix=false){
 const expected=normalizeArabicForCompare(expectedText).split(" ").filter(Boolean);
 const actual=normalizeArabicForCompare(spokenText).split(" ").filter(Boolean);
 const maxCells=2_000_000;
 const errors:{type:string;expected?:string;heard?:string}[]=[];
 const matchedExpectedIndexes:number[]=[];
 let effectiveExpectedWords=expected.length;
 let distance=0;

 if(expected.length*actual.length>maxCells){
  // Use a linear, conservative fallback for long sessions so live UI updates
  // never allocate a huge quadratic matrix on a phone.
  let i=0,j=0;
  while(i<expected.length&&j<actual.length){
   if(expected[i]===actual[j]){
    matchedExpectedIndexes.push(i);i++;j++;continue;
   }
   if(i+1<expected.length&&expected[i+1]===actual[j]){
    errors.push({type:"possible_omission",expected:expected[i]});i++;continue;
   }
   if(j+1<actual.length&&expected[i]===actual[j+1]){
    errors.push({type:"possible_addition",heard:actual[j]});j++;continue;
   }
   errors.push({type:"possible_substitution",expected:expected[i],heard:actual[j]});
   i++;j++;
  }
  if(!allowPrefix){
   while(i<expected.length){errors.push({type:"possible_omission",expected:expected[i]});i++;}
  }else{
   effectiveExpectedWords=i;
  }
  while(j<actual.length){errors.push({type:"possible_addition",heard:actual[j]});j++;}
  distance=errors.length;
 }else{
  const dp=Array.from({length:expected.length+1},()=>new Uint16Array(actual.length+1));
  for(let i=0;i<=expected.length;i++)dp[i][0]=i;
  for(let j=0;j<=actual.length;j++)dp[0][j]=j;
  for(let i=1;i<=expected.length;i++)for(let j=1;j<=actual.length;j++){
   dp[i][j]=expected[i-1]===actual[j-1]?dp[i-1][j-1]:Math.min(dp[i-1][j-1]+1,dp[i-1][j]+1,dp[i][j-1]+1);
  }
  if(allowPrefix&&actual.length>0){
   let bestDistance=dp[0][actual.length];
   effectiveExpectedWords=0;
   for(let row=1;row<=expected.length;row++){
    const candidate=dp[row][actual.length];
    if(candidate<bestDistance||(candidate===bestDistance&&row>effectiveExpectedWords)){
     bestDistance=candidate;effectiveExpectedWords=row;
    }
   }
  }
  distance=dp[effectiveExpectedWords][actual.length];
  let i=effectiveExpectedWords,j=actual.length;
  while(i>0||j>0){
   if(i>0&&j>0&&expected[i-1]===actual[j-1]){
    matchedExpectedIndexes.push(i-1);i--;j--;continue;
   }
   const sub=i>0&&j>0?dp[i-1][j-1]+1:Infinity;
   const del=i>0?dp[i-1][j]+1:Infinity;
   const ins=j>0?dp[i][j-1]+1:Infinity;
   if(sub<=del&&sub<=ins){errors.push({type:"possible_substitution",expected:expected[i-1],heard:actual[j-1]});i--;j--;}
   else if(del<=ins){errors.push({type:"possible_omission",expected:expected[i-1]});i--;}
   else{errors.push({type:"possible_addition",heard:actual[j-1]});j--;}
  }
 }
 matchedExpectedIndexes.reverse();
 const score= Math.max(0,Math.round(100*(1-distance/Math.max(1,effectiveExpectedWords,actual.length))));
 return {
  matchRate:score,
  matchedExpectedIndexes,
  textAlignment:{
   expectedWords:effectiveExpectedWords,
   referenceWords:expected.length,
   recognizedWords:actual.length,
   editDistance:distance,
   errors:errors.reverse().slice(0,20)
  }
 };
}
export default function Recite(){
 const params=useLocalSearchParams<{surah?:string;ayah?:string;scope?:string}>();
 const selectedSurah=Math.max(1,Math.min(114,Number(params.surah)||1));
 const selectedAyah=Math.max(1,Number(params.ayah)||1);
 const fullSurahMode=params.scope==="surah";
 const { dark, setDark } = usePreferences();
 const pageAudioPlayer = useAudioPlayer(null);
 const pageAudioStatus = useAudioPlayerStatus(pageAudioPlayer);
 const [pageAudioRange,setPageAudioRange] = useState<{start:number;end:number;current:number}|null>(null);
 const [activeAyah, setActiveAyah] = useState(selectedAyah);
 const [continuousMode, setContinuousMode] = useState(true);
 const [referenceText,setReferenceText]=useState("جاري تحميل الآية الموثقة…");
 const [referenceLabel,setReferenceLabel]=useState("الآية");
 const [riwaya,setRiwayaState]=useState(getSelectedRiwayah());
 const setRiwaya=(value:string)=>{setSelectedRiwayah(value);setRiwayaState(value);setMessage(value==="حفص عن عاصم"?"تم اختيار حفص عن عاصم؛ النص الموثق والتسجيل والتحليل النصي المبدئي متاحون.":`تم اختيار ${value}. الاختيار محفوظ أثناء التنقل داخل التطبيق، لكن نص المصحف والتحليل لهذه الرواية غير مفعّلين قبل توثيق مصدرها.`);};
 const riwayat=["حفص عن عاصم","شعبة عن عاصم","قالون عن نافع","ورش عن نافع","البزي عن ابن كثير","قنبل عن ابن كثير","الدوري عن أبي عمرو","السوسي عن أبي عمرو","هشام عن ابن عامر","ابن ذكوان عن ابن عامر","خلف عن حمزة","خلاد عن حمزة","أبو الحارث عن الكسائي","الدوري عن الكسائي","ابن وردان عن أبي جعفر","ابن جمّاز عن أبي جعفر","رويس عن يعقوب","روح عن يعقوب","إسحاق عن خلف العاشر","إدريس عن خلف العاشر"];

 useEffect(()=>{ let alive=true; import("../src/quran/verified-corpus.json").then((m)=>{ const corpus=m.default as {ayahs:{surah:number;ayah:number;text:string}[]}; let hits=corpus.ayahs.filter(x=>x.surah===selectedSurah); if(!fullSurahMode){if(continuousMode)hits=hits.filter(x=>x.ayah>=activeAyah);else hits=hits.filter(x=>x.ayah===activeAyah);} if(hits.length&&alive){setReferenceText(hits.map(x=>x.text+(continuousMode||fullSurahMode?" ﴿"+x.ayah+"﴾":"")).join(" "));setReferenceLabel(fullSurahMode?"السورة كاملة • "+hits.length+" آيات":continuousMode?"تلاوة متصلة من الآية "+activeAyah+" حتى نهاية السورة":"الآية "+activeAyah);} }).catch(()=>{if(alive)setReferenceText("تعذر تحميل النص الموثق.");}); return ()=>{alive=false;}; },[selectedSurah,activeAyah,fullSurahMode,continuousMode]);
 const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
 const state=useAudioRecorderState(recorder);
 const [message,setMessage]=useState("جاهز للتسجيل");
 useEffect(()=>{if(!pageAudioStatus.didJustFinish||!pageAudioRange)return; if(pageAudioRange.current>=pageAudioRange.end){setPageAudioRange(null);setMessage("انتهى سماع مقطع الصفحة.");return;} const next=pageAudioRange.current+1; setPageAudioRange({...pageAudioRange,current:next}); const globalAyah=SURAHS.slice(0,selectedSurah-1).reduce((sum,item)=>sum+item.ayahCount,0)+next; void pageAudioPlayer.replace({uri:"https://cdn.islamic.network/quran/audio/128/ar.alafasy/"+globalAyah+".mp3"}).then(()=>pageAudioPlayer.play()).catch(()=>{setPageAudioRange(null);setMessage("تعذر تحميل الآية التالية في تسجيل الصفحة. تحقق من الإنترنت.");});},[pageAudioStatus.didJustFinish,pageAudioRange,selectedSurah,pageAudioPlayer]);
 async function togglePageAudio(){
  if(pageAudioRange){pageAudioPlayer.pause();setPageAudioRange(null);setMessage("تم إيقاف سماع الصفحة.");return;}
  if(state.isRecording){setMessage("أوقف التسميع أولًا قبل تشغيل صوت الصفحة.");return;}
  if(riwaya!=="حفص عن عاصم"){setMessage("تسجيل الصفحة متاح حاليًا مع النص الموثّق لحفص عن عاصم فقط.");return;}
  const max=SURAHS.find(item=>item.number===selectedSurah)?.ayahCount||1;
  const start=Math.min(max,Math.max(1,activeAyah));
  const end=fullSurahMode?max:Math.min(max,continuousMode?start+9:start);
  const globalAyah=SURAHS.slice(0,selectedSurah-1).reduce((sum,item)=>sum+item.ayahCount,0)+start;
  setPageAudioRange({start,end,current:start});setMessage("جارٍ تشغيل "+(end-start+1)+" آية من سورة "+(SURAHS.find(item=>item.number===selectedSurah)?.nameAr||"المصحف")+" بصوت مشاري العفاسي.");
  try{await pageAudioPlayer.replace({uri:"https://cdn.islamic.network/quran/audio/128/ar.alafasy/"+globalAyah+".mp3"});pageAudioPlayer.play();}
  catch{setPageAudioRange(null);setMessage("تعذر تحميل التسجيل. تحقق من الاتصال بالإنترنت ثم حاول مرة أخرى.");}
 }
 const [recorded,setRecorded]=useState(false);
 const [sessionStatus,setSessionStatus]=useState<"idle"|"recording"|"recorded"|"processing">("idle");
 const [mushafVisible,setMushafVisible]=useState(true);
 const [surahPickerVisible,setSurahPickerVisible]=useState(false);
 const [ayahPickerVisible,setAyahPickerVisible]=useState(false);
 const [heardText,setHeardText]=useState("");
 const [speechMessage,setSpeechMessage]=useState("التعرّف المباشر على الكلمات يعمل في متصفح يدعمه فقط، ولا يُعدّ تصحيحًا للتلاوة.");
 const [speechRecognition,setSpeechRecognition]=useState<any>(null);
 const [analysis,setAnalysis]=useState<any>(null);
 const [analysisBusy,setAnalysisBusy]=useState(false);
 const [nabrStatus,setNabrStatus]=useState<"idle"|"connecting"|"ready"|"recording"|"unavailable"|"complete">("idle");
 const [nabrFeedback,setNabrFeedback]=useState<any>(null);
 const nabrSocketRef=useRef<any>(null);
 const nabrStreamRef=useRef<any>(null);
 const nabrContextRef=useRef<any>(null);
 const nabrProcessorRef=useRef<any>(null);
 const nabrSourceRef=useRef<any>(null);
 const nabrMuteRef=useRef<any>(null);
 const nabrPendingSamplesRef=useRef<number[]>([]);
 const nabrSessionStartedRef=useRef(false);
 const nabrStartSentRef=useRef(false);

 useEffect(()=>()=>{stopLiveWords();stopAI4XRealtime();},[]);
 function navigateAyah(next:number){const max=SURAHS.find(x=>x.number===selectedSurah)?.ayahCount||1;const safe=Math.max(1,Math.min(max,next));setActiveAyah(safe);setHeardText("");setAnalysis(null);router.replace({pathname:"/recite",params:{surah:String(selectedSurah),ayah:String(safe),scope:"ayah"}});}

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
  setNabrStatus(previous=>previous==="unavailable"?"unavailable":nabrFeedback?"complete":"idle");
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
       chapter_index:selectedSurah,
       verse_index:Math.max(1,activeAyah),
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
      setNabrFeedback((previous:any)=>mergeNabrFeedback(previous,message));
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

 function startLiveWords(){
  const browser = globalThis as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
  const SpeechRecognitionClass = browser.SpeechRecognition || browser.webkitSpeechRecognition;
  if(!SpeechRecognitionClass){
   setSpeechMessage("التعرّف المباشر على الكلمات غير مدعوم في هذا المتصفح/الجهاز. التسجيل الصوتي وحده لا يستطيع تحديد الكلمات المنطوقة.");
   return;
  }
  try{
   const recognition = new SpeechRecognitionClass();
   recognition.lang = "ar-SA";
   recognition.continuous = true;
   recognition.interimResults = true;
   recognition.onresult = (event:any) => {
    let combined = "";
    for(let i=0;i<event.results.length;i++) combined += event.results[i][0]?.transcript || "";
    setHeardText(combined.trim());
    setSpeechMessage("الكلمات الظاهرة تعرّفٌ صوتي مبدئي وقد يخطئ؛ ليست مطابقة للمصحف ولا حكمًا على التجويد.");
   };
   recognition.onerror = () => setSpeechMessage("توقف التعرّف على الكلمات أو لم يحصل على إذن الميكروفون. التسجيل الصوتي منفصل عنه.");
   recognition.onend = () => setSpeechRecognition(null);
   recognition.start();
   setSpeechRecognition(recognition);
   setSpeechMessage("جارٍ التقاط الكلمات من المتصفح؛ قد تظهر أخطاء في نص التعرّف.");
  }catch{
   setSpeechMessage("تعذر تشغيل التعرّف المباشر في هذا المتصفح. يمكنك متابعة التسجيل دون عرض كلمات غير مؤكدة.");
  }
 }

 function stopLiveWords(){
  try{ speechRecognition?.stop?.(); }catch{}
  setSpeechRecognition(null);
 }

 async function analyzeRecording(uri:string|undefined){
  if(!uri){setMessage("التسجيل تم، لكن لم يُرجع الجهاز مسار الملف لتحليله.");return;}
  const baseUrl=(process.env.EXPO_PUBLIC_IJAZAH_API_URL||"https://ijazah-mobile-preview-profit-guard2.vercel.app").replace(/\/$/,"");
  if(!baseUrl){setMessage("التسجيل محفوظ محليًا. يلزم نشر خادم التحليل وضبط EXPO_PUBLIC_IJAZAH_API_URL.");return;}
  setAnalysisBusy(true); setAnalysis(null); setSessionStatus("processing");
  setMessage("جارٍ تحليل التسجيل ومقارنة الكلمات من موضع البداية الصحيح…");
  try{
   const audioResponse=await fetch(uri);
   if(!audioResponse.ok) throw new Error("تعذر قراءة ملف التسجيل");
   const audioBlob=await audioResponse.blob();
   const analysisScope=fullSurahMode?"surah":continuousMode?"range":"ayah";
   const analysisAyah=activeAyah;
   const response=await fetch(baseUrl+"/api/analyze-recitation?surah="+selectedSurah+"&scope="+analysisScope+"&ayah="+analysisAyah+"&startAyah="+analysisAyah+"&riwaya=hafs",{method:"POST",headers:{"Content-Type":audioBlob.type||"audio/m4a"},body:audioBlob});
   const result=await response.json();
   if(!response.ok) throw new Error(result?.message||"تعذر إكمال التحليل");
   setAnalysis(result); setSessionStatus("recorded");
   const gate=result?.ai4x?.stages?.confidenceGate?.status;
   setMessage(gate==="passed_consensus_no_mismatch"
     ? "اكتمل تحقق AI4X؛ لم تظهر اختلافات نصية."
     : gate==="passed_consensus_with_mismatches"
       ? "اكتمل تحقق AI4X؛ ظهرت مواضع لفظية تستحق المراجعة."
       : "لم يصل AI4X إلى اتفاق كافٍ؛ لم نعتمد أخطاء غير مؤكدة.");
  }catch(error){
   const detail=error instanceof Error?error.message:"خطأ غير معروف";
   // Safe local fallback: compare only browser-recognized words with the verified reference.
   // This is explicitly preliminary and never presented as tajweed analysis.
   if(!fullSurahMode && heardText.trim() && referenceText && !referenceText.startsWith("جاري تحميل")){
    const local=compareRecognizedWords(referenceText,heardText,continuousMode);
    setAnalysis({
     transcript:heardText.trim(),
     matchRate:local.matchRate,
     textAlignment:{...local.textAlignment,errors:local.matchRate>=85?local.textAlignment.errors:[]},
     confidence:local.matchRate>=85?"preliminary":"low",
     analysisLevel:"browser_speech_to_text_alignment",
     engines:{
      speechRecognition:{status:"completed_preliminary",model:"browser-speech-recognition"},
      quranAlignment:{status:"completed",matchRate:local.matchRate,editDistance:local.textAlignment.editDistance},
      acousticTajweed:{status:"not_configured",rulesEvaluated:[]},
      confidenceGate:{status:local.matchRate>=85?"passed_preliminary":"blocked_low_text_confidence"}
     },
     tajweed:{status:"not_configured",findings:[],rulesEvaluated:[],message:"هذه مقارنة نصية محلية أولية من تعرّف المتصفح؛ محرك التجويد الصوتي المتخصص غير موصول."},
     disclaimer:"النسبة تقريبية وتعتمد على دقة التعرّف الصوتي في المتصفح؛ لا تقيس مخارج الحروف أو أحكام التجويد."
    });
    setMessage("تعذر إكمال التحليل الآن. أعد المحاولة وتأكد من الاتصال بالإنترنت.");
   }else{
    setMessage("تعذر إكمال التحليل: "+detail+". لم نعرض نتيجة مخمّنة.");
   }
   setSessionStatus("recorded");
  }finally{setAnalysisBusy(false);}
 }

 async function toggleRecording(){
  try{
   if(riwaya !== "حفص عن عاصم"){
    setMessage("التسجيل والتحليل لهذه الرواية غير مفعّلين بعد؛ نحتاج أولًا إلى نص موثّق ومحرك تحليل مختبَر لها.");
    return;
   }
   if(state.isRecording){
    stopLiveWords();
    stopAI4XRealtime();
    await recorder.stop();
    setRecorded(true);
    setSessionStatus("recorded");
    setMessage("انتهى التسجيل. جارٍ التحقق من الكلمات عبر AI4X…");
    const audioUri=recorder.uri;
    void analyzeRecording(audioUri ?? undefined);
    return;
   }
   const permission=await requestRecordingPermissionsAsync();
   if(!permission.granted){setMessage("يجب السماح بالميكروفون لبدء التلاوة");return;}
   setRecorded(false);
   setHeardText("");
   await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
   await recorder.prepareToRecordAsync();
   recorder.record();
   setSessionStatus("recording");
   const specialistStarted=await startAI4XRealtime();
   if(!specialistStarted)startLiveWords();
   setMessage("جاري الاستماع… اقرأ الآية بهدوء");
  }catch(error){
   console.error("Ijazah recording error:",error);
   const detail=error instanceof Error?error.message:String(error??"خطأ غير معروف");
   setSessionStatus("idle");
   setMessage(`تعذر بدء التسجيل (${detail}). تأكد من إذن الميكروفون ثم أعد المحاولة.`);
  }
 }

 return <View style={[s.root,{backgroundColor:dark?"#061321":"#EAF2F7"}]}><StatusBar style={dark?"light":"dark"}/><View style={s.minimalHeader}><Pressable onPress={()=>router.back()} style={s.smallAction}><Text style={[s.headerActionText,{color:dark?"#E8F4FC":"#18334B"}]}>‹</Text></Pressable><Pressable onPress={()=>setSurahPickerVisible(true)} style={{flex:1,alignItems:"center"}}><Text style={[s.surahTitle,{color:dark?"#F5F8FC":"#10253D"}]}>{SURAHS.find(x=>x.number===selectedSurah)?.nameAr||"المصحف الشريف"}　⌄</Text><Text style={[s.surahMeta,{color:dark?"#9EB4C9":"#687D91"}]}>حفص عن عاصم · {referenceLabel}</Text></Pressable><Pressable onPress={()=>setDark(!dark)} style={s.smallAction}><Text style={[s.headerActionText,{color:dark?"#E8F4FC":"#18334B"}]}>{dark?"☼":"☾"}</Text></Pressable></View><View style={s.pageToolbar}><Pressable disabled style={[s.toolbarButton,{opacity:0.48}]}><Text style={s.toolbarButtonText}>تفسير الصفحة</Text></Pressable><Pressable onPress={togglePageAudio} style={s.toolbarButton}><Text style={s.toolbarButtonText}>{pageAudioRange?"Ⅱ إيقاف السماع":"▶ سماع الصفحة"}</Text></Pressable><Pressable onPress={()=>setDark(!dark)} style={s.toolbarButton}><Text style={s.toolbarButtonText}>{dark?"☀ الوضع الفاتح":"☾ الوضع الداكن"}</Text></Pressable></View><View style={[s.pageFrame,{backgroundColor:dark?"#0B1A2B":"#FDFBF4",borderColor:dark?"#28445A":"#D6C69F"}]}><View style={s.pageTopLine}><Text style={[s.pageSurah,{color:dark?"#D5B86C":"#8A713E"}]}>۞  المصحف الشريف  ۞</Text></View><ScrollView style={s.pageTextArea} contentContainerStyle={s.pageTextContent} showsVerticalScrollIndicator>{riwaya==="حفص عن عاصم"?<><Text style={[s.mushafText,{color:dark?"#F5F5F1":"#171A1D"}]}>{renderAlignedWords(referenceText,heardText,continuousMode,nabrFeedback,selectedSurah,fullSurahMode?1:activeAyah)}</Text>{continuousMode&&<View style={s.surahEndNav}><Text style={[s.surahEndTitle,{color:dark?"#D5B86C":"#8A713E"}]}>نهاية سورة {SURAHS.find(x=>x.number===selectedSurah)?.nameAr}</Text><View style={s.surahEndButtons}>{selectedSurah>1&&<Pressable onPress={()=>{pageAudioPlayer.pause();setPageAudioRange(null);setHeardText("");router.replace({pathname:"/recite",params:{surah:String(selectedSurah-1),ayah:"1",scope:"ayah"}});}} style={s.surahEndButton}><Text style={s.surahEndButtonText}>‹ السورة السابقة</Text></Pressable>}<Pressable disabled={selectedSurah>=114} onPress={()=>{pageAudioPlayer.pause();setPageAudioRange(null);setHeardText("");router.replace({pathname:"/recite",params:{surah:String(selectedSurah+1),ayah:"1",scope:"ayah"}});}} style={[s.surahEndButton,selectedSurah>=114&&{opacity:0.4}]}><Text style={s.surahEndButtonText}>السورة التالية ›</Text></Pressable></View></View>}</>:<Text style={s.riwayaUnavailable}>النص والتحليل لهذه الرواية غير مفعّلين قبل توثيق مصدرها.</Text>}</ScrollView><View style={s.pageBottomLine}><Text style={[s.pageFooter,{color:dark?"#9EB4C9":"#7B6D51"}]}>نص موثّق · Tanzil Uthmani 1.1</Text></View></View><View style={s.focusControls}><View style={s.navigationRow}><Pressable onPress={()=>navigateAyah(activeAyah-1)} style={s.navButton}><Text style={s.navButtonText}>الآية السابقة</Text></Pressable><Pressable onPress={()=>setAyahPickerVisible(true)} style={s.navButton}><Text style={s.navButtonText}>اختيار الآية {activeAyah} ⌄</Text></Pressable><Pressable onPress={()=>navigateAyah(activeAyah+1)} style={s.navButton}><Text style={s.navButtonText}>التالية</Text></Pressable></View><Pressable onPress={toggleRecording} style={[s.bigMic,state.isRecording&&s.bigMicOn]}><Text style={s.bigMicGlyph}>{state.isRecording?"■":"🎙"}</Text></Pressable><Text style={[s.focusStatus,{color:dark?"#AFC5D8":"#647A8E"}]}>{state.isRecording?"جارٍ الاستماع — اقرأ من المصحف":"ابدأ التسميع من الصفحة"}</Text>{heardText.length>0&&<Text numberOfLines={2} style={[s.liveTranscript,{color:dark?"#9EDFC7":"#147A5A"}]}>{heardText}</Text>}{analysisBusy&&<Text style={s.analysisStatus}>جارٍ مراجعة التسجيل…</Text>}{process.env.EXPO_PUBLIC_IJAZAH_AI4X_REALTIME==="true"&&nabrStatus!=="idle"&&<Text style={s.analysisStatus}>{nabrStatus==="recording"?"AI4X: تحليل صوتي مباشر":nabrStatus==="connecting"?"AI4X: جارٍ الاتصال بمحرك التلاوة":nabrStatus==="complete"?"AI4X: انتهى التحليل الصوتي":""}</Text>}{nabrFeedback&&<View style={{maxHeight:86,width:"100%",alignItems:"center"}}>{[...(nabrFeedback.tajweed_mistakes||[]).map((x:any)=>({...x,kind:"تجويد"})),...(nabrFeedback.letter_mistakes||[]).map((x:any)=>({...x,kind:"نطق"})),...(nabrFeedback.skipped_words||[]).map((x:any)=>({...x,kind:"كلمة"}))].slice(-3).map((item:any,index:number)=><Text key={index} numberOfLines={1} style={s.analysisStatus}>{item.kind} · آية {item.verse} · كلمة {item.word}{item.message?" · "+item.message:""}</Text>)}</View>}{analysis&&<View style={{maxHeight:92,width:"100%",alignItems:"center"}}><Text style={s.analysisStatus}>{analysis?.ai4x?.stages?.confidenceGate?.status==="passed_consensus_no_mismatch"?"AI4X: تطابق النص في المحركين.":analysis?.ai4x?.stages?.confidenceGate?.status==="passed_consensus_with_mismatches"?"AI4X: اختلافات لفظية اتفق عليها المحركان.":analysis?.ai4x?"AI4X: النتيجة غير مؤكدة؛ لم نعرض أخطاء منفردة.":"تعذر إجراء تحليل موثوق."}</Text>{(analysis?.textAlignment?.errors||[]).filter((item:any)=>typeof item.ayah==="number").slice(0,3).map((item:any,index:number)=><Text key={index} numberOfLines={1} style={s.analysisStatus}>سورة {SURAHS.find(x=>x.number===item.surah)?.nameAr||item.surah} · آية {item.ayah} · {item.type==="possible_omission"?"كلمة محتملة السقوط":item.type==="possible_addition"?"كلمة زائدة محتملة":"اختلاف نصي محتمل"}</Text>)}</View>}</View>
<Modal visible={surahPickerVisible} animationType="slide" transparent onRequestClose={()=>setSurahPickerVisible(false)}><View style={s.modalShade}><View style={[s.pickerPanel,{backgroundColor:dark?"#0B1A2B":"#FFFFFF"}]}><Text style={[s.pickerTitle,{color:dark?"#F5F8FC":"#10253D"}]}>اختيار السورة</Text><ScrollView>{SURAHS.map(item=><Pressable key={item.number} onPress={()=>{setSurahPickerVisible(false);setActiveAyah(1);setHeardText("");router.replace({pathname:"/recite",params:{surah:String(item.number),ayah:"1",scope:"ayah"}});}} style={[s.pickerItem,{borderBottomColor:dark?"#263D50":"#E6EDF3"}]}><Text style={[s.pickerItemText,{color:dark?"#F5F8FC":"#18334B"}]}>{item.number}. {item.nameAr}</Text><Text style={s.pickerCount}>{item.ayahCount} آية</Text></Pressable>)}</ScrollView><Pressable onPress={()=>setSurahPickerVisible(false)} style={s.closePicker}><Text style={s.closePickerText}>إلغاء</Text></Pressable></View></View></Modal><Modal visible={ayahPickerVisible} animationType="fade" transparent onRequestClose={()=>setAyahPickerVisible(false)}><View style={s.modalShade}><View style={[s.ayahPanel,{backgroundColor:dark?"#0B1A2B":"#FFFFFF"}]}><Text style={[s.pickerTitle,{color:dark?"#F5F8FC":"#10253D"}]}>اختيار آية البداية</Text><ScrollView contentContainerStyle={s.ayahGrid}>{Array.from({length:SURAHS.find(x=>x.number===selectedSurah)?.ayahCount||1},(_,i)=>i+1).map(n=><Pressable key={n} onPress={()=>{setActiveAyah(n);setAyahPickerVisible(false);setHeardText("");router.replace({pathname:"/recite",params:{surah:String(selectedSurah),ayah:String(n),scope:"ayah"}});}} style={[s.ayahChip,n===activeAyah&&s.ayahChipActive]}><Text style={[s.ayahChipText,n===activeAyah&&s.ayahChipTextActive]}>{n}</Text></Pressable>)}</ScrollView><Pressable onPress={()=>setAyahPickerVisible(false)} style={s.closePicker}><Text style={s.closePickerText}>إلغاء</Text></Pressable></View></View></Modal></View>;
}
function renderAlignedWords(expected:string,heard:string,allowPrefix=false,nabr:any=null,selectedSurah=1,startAyah=1){
 const expectedWords=expected.split(/\s+/).filter(Boolean);
 const heardWords=normalizeArabicForCompare(heard).split(" ").filter(Boolean);
 const hasAcousticEvidence=!!nabr&&[...(nabr.correct_words||[]),...(nabr.skipped_words||[]),...(nabr.tajweed_mistakes||[]),...(nabr.letter_mistakes||[])].length>0;
 const correct=new Set<string>(),wrong=new Set<string>();
 const key=(item:any)=>[item.chapter,item.verse,item.word].join(":");
 for(const item of nabr?.correct_words||[])if(item&&item.chapter===selectedSurah)correct.add(key(item));
 for(const item of nabr?.skipped_words||[])if(item&&item.chapter===selectedSurah)wrong.add(key(item));
 for(const item of [...(nabr?.tajweed_mistakes||[]),...(nabr?.letter_mistakes||[])])if(item&&item.chapter===selectedSurah)wrong.add(key(item));
 if(!hasAcousticEvidence&&!heardWords.length)return expectedWords.map((word,index)=><Text key={index}>{word} </Text>);
 const comparison=heardWords.length?compareRecognizedWords(expected,heard,allowPrefix):null;
 const matched=new Set(comparison?.matchedExpectedIndexes||[]);
 if(!hasAcousticEvidence&&comparison&&comparison.matchRate<85)return expectedWords.map((word,index)=><Text key={index}>{word} </Text>);
 let currentAyah=startAyah,wordIndex=0;
 return expectedWords.map((word,index)=>{
  const marker=word.match(/^﴿(\d+)﴾$/u);
  if(marker){currentAyah=Number(marker[1])+1;wordIndex=0;return <Text key={index} style={{color:"#B89B5A"}}>{word} </Text>;}
  const thisWord=wordIndex++;
  const wordKey=[selectedSurah,currentAyah,thisWord+1].join(":");
  const color=hasAcousticEvidence
   ? wrong.has(wordKey)?"#DC4D4D":correct.has(wordKey)?"#18A86B":undefined
   : matched.has(index)?"#18A86B":undefined;
  return <Text key={index} style={{color}}>{word} </Text>;
 });
}
const s=StyleSheet.create({root:{flex:1,paddingHorizontal:12,paddingTop:8,paddingBottom:8},minimalHeader:{height:50,flexDirection:"row",alignItems:"center",marginBottom:5},pageToolbar:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:7,marginBottom:8},toolbarButton:{flex:1,minHeight:38,paddingHorizontal:5,paddingVertical:8,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(53,199,222,0.15)",borderWidth:1,borderColor:"rgba(53,199,222,0.45)"},toolbarButtonText:{fontSize:10,fontWeight:"800",color:"#2587A0",textAlign:"center"},smallAction:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(100,150,180,0.12)"},headerActionText:{fontSize:23,fontWeight:"700"},surahTitle:{fontSize:17,fontWeight:"900",textAlign:"center"},surahMeta:{fontSize:10,marginTop:3,textAlign:"center"},pageFrame:{flex:1,borderWidth:1.5,borderRadius:10,paddingHorizontal:15,paddingVertical:11,justifyContent:"space-between",overflow:"hidden"},pageTopLine:{alignItems:"center",borderBottomWidth:1,borderColor:"#D9C99D",paddingBottom:8,marginBottom:8},pageSurah:{fontSize:12,fontWeight:"800",textAlign:"center"},pageTextArea:{flex:1,overflow:"hidden"},pageTextContent:{flexGrow:1,justifyContent:"center",paddingVertical:8},surahEndNav:{marginTop:28,paddingTop:18,borderTopWidth:1,borderTopColor:"#D9C99D",alignItems:"center",gap:12},surahEndTitle:{fontSize:13,fontWeight:"900",textAlign:"center"},surahEndButtons:{flexDirection:"row",width:"100%",gap:10,justifyContent:"space-between"},surahEndButton:{flex:1,minHeight:44,paddingHorizontal:8,paddingVertical:12,borderRadius:12,backgroundColor:"rgba(53,199,222,0.16)",borderWidth:1,borderColor:"rgba(53,199,222,0.45)",alignItems:"center",justifyContent:"center"},surahEndButtonText:{fontSize:12,fontWeight:"900",color:"#2587A0",textAlign:"center"},mushafText:{fontSize:22,lineHeight:43,textAlign:"justify",writingDirection:"rtl",fontWeight:"500"},pageBottomLine:{alignItems:"center",borderTopWidth:1,borderColor:"#D9C99D",paddingTop:7,marginTop:7},pageFooter:{textAlign:"center",fontSize:8},riwayaUnavailable:{color:"#A77A20",fontSize:14,lineHeight:28,textAlign:"right"},focusControls:{paddingTop:7,paddingBottom:3,alignItems:"center",justifyContent:"center"},navigationRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",width:"100%",gap:5,marginBottom:7},navButton:{flex:1,borderRadius:10,paddingVertical:8,paddingHorizontal:4,backgroundColor:"rgba(64,142,168,0.12)",alignItems:"center"},navButtonText:{fontSize:10,fontWeight:"800",color:"#2587A0"},modalShade:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",justifyContent:"center",padding:18},pickerPanel:{maxHeight:"86%",borderRadius:20,padding:16},ayahPanel:{maxHeight:"75%",borderRadius:20,padding:16},pickerTitle:{fontSize:18,fontWeight:"900",textAlign:"center",marginBottom:12},pickerItem:{minHeight:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,paddingHorizontal:6},pickerItemText:{fontSize:15,fontWeight:"700"},pickerCount:{fontSize:11,color:"#8293A4"},closePicker:{alignItems:"center",padding:12,marginTop:6,backgroundColor:"#E5F8FC",borderRadius:12},closePickerText:{fontSize:13,fontWeight:"800",color:"#167B95"},ayahGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"center",gap:8},ayahChip:{width:42,height:42,borderRadius:12,borderWidth:1,borderColor:"#B8CAD7",alignItems:"center",justifyContent:"center"},ayahChipActive:{backgroundColor:"#18B978",borderColor:"#087D61"},ayahChipText:{fontSize:13,fontWeight:"700",color:"#234"},ayahChipTextActive:{color:"#FFFFFF"},bigMic:{width:72,height:72,borderRadius:36,alignItems:"center",justifyContent:"center",backgroundColor:"#18D68A",borderWidth:4,borderColor:"#087D61"},bigMicOn:{backgroundColor:"#FF7777",borderColor:"#A63B46"},bigMicGlyph:{fontSize:28,color:"#FFFFFF"},focusStatus:{fontSize:10,textAlign:"center",marginTop:7},liveTranscript:{fontSize:11,textAlign:"center",marginTop:4,maxWidth:"95%"},analysisStatus:{fontSize:9,color:"#C07C35",textAlign:"center",marginTop:4}});