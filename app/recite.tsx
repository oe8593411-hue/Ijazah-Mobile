import { Fragment, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { getSelectedRiwayah, setSelectedRiwayah } from "../src/quran/riwayah";
import { SURAHS } from "../src/quran/surahs";
import { findExpectedTajweedChecks } from "../src/recitation/tajweed-rules";

const C={paper:"#FBF7EE",ink:"#1B2A3A",muted:"#8A8576",line:"#E7E0CF",navy:"#071A33",cyan:"#35C7DE",cyanDark:"#168DA5",ok:"#1E8E4E",bad:"#D93A3A",missed:"#E08A00",mask:"#E4DDCB",cursor:"#FFE9A6",white:"#FFFFFF"};
const QURAN_FONT=Platform.select({ios:"Geeza Pro",android:"serif",default:"'Amiri','Scheherazade New','Traditional Arabic',serif"});
// Tajweed rule colours are only shown as *candidate positions* taken from the verified text,
// never as a judgement on the recitation. Madd is skipped because it marks almost every word.
const RULE_COLORS:Record<string,string>={ghunnah:"#1F9D55",qalqalah:"#2F6FDE",ikhfa:"#B8458A",idgham:"#7A56C9",iqlab:"#0E9AA7",izhar:"#8C7A3A"};

function normalizeArabicForCompare(value:string){
 return value.normalize("NFC").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ـ/g,"").replace(/[^\u0621-\u064A\s]/g," ").replace(/\s+/g," ").trim();
}
function compareRecognizedWords(expectedText:string, spokenText:string){
 const expected=normalizeArabicForCompare(expectedText).split(" ").filter(Boolean);
 const actual=normalizeArabicForCompare(spokenText).split(" ").filter(Boolean);
 const dp=Array.from({length:expected.length+1},()=>Array<number>(actual.length+1).fill(0));
 for(let i=0;i<=expected.length;i++)dp[i][0]=i;
 for(let j=0;j<=actual.length;j++)dp[0][j]=j;
 for(let i=1;i<=expected.length;i++)for(let j=1;j<=actual.length;j++)dp[i][j]=expected[i-1]===actual[j-1]?dp[i-1][j-1]:Math.min(dp[i-1][j-1]+1,dp[i-1][j]+1,dp[i][j-1]+1);
 const errors:{type:string;expected?:string;heard?:string}[]=[];
 let i=expected.length,j=actual.length;
 while(i>0||j>0){
  if(i>0&&j>0&&expected[i-1]===actual[j-1]){i--;j--;continue;}
  const sub=i>0&&j>0?dp[i-1][j-1]+1:Infinity,del=i>0?dp[i-1][j]+1:Infinity,ins=j>0?dp[i][j-1]+1:Infinity;
  if(sub<=del&&sub<=ins){errors.push({type:"possible_substitution",expected:expected[i-1],heard:actual[j-1]});i--;j--;}
  else if(del<=ins){errors.push({type:"possible_omission",expected:expected[i-1]});i--;}
  else{errors.push({type:"possible_addition",heard:actual[j-1]});j--;}
 }
 const distance=dp[expected.length][actual.length];
 return {matchRate:Math.max(0,Math.round(100*(1-distance/Math.max(1,expected.length,actual.length)))),textAlignment:{expectedWords:expected.length,recognizedWords:actual.length,editDistance:distance,errors:errors.reverse().slice(0,20)}};
}

function levenshtein(a:string,b:string){
 const row=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){
  let prev=row[0];row[0]=i;
  for(let j=1;j<=b.length;j++){const tmp=row[j];row[j]=a[i-1]===b[j-1]?prev:Math.min(prev,row[j],row[j-1])+1;prev=tmp;}
 }
 return row[b.length];
}
// Speech-to-text is noisy, so a heard word counts as the expected one when it is identical
// or within one (short word) / two (long word) letters of it.
function sameWord(expected:string,heard:string){
 if(expected===heard)return true;
 if(Math.min(expected.length,heard.length)<4)return false;
 return levenshtein(expected,heard)<=(Math.max(expected.length,heard.length)>6?2:1);
}
type WordState="ok"|"bad"|"missed";
// Walks the recognised words along the verified text, like a follow-along reader:
// match -> ok, a skipped word found 1-3 words ahead -> missed, otherwise -> bad.
function trackRecitation(expected:string[],spoken:string,final:boolean){
 const heard=normalizeArabicForCompare(spoken).split(" ").filter(Boolean);
 const states:(WordState|undefined)[]=Array(expected.length).fill(undefined);
 const heardAt:(string|undefined)[]=Array(expected.length).fill(undefined);
 let p=0;
 for(let idx=0;idx<heard.length&&p<expected.length;idx++){
  const h=heard[idx];
  if(sameWord(expected[p],h)){states[p]="ok";p++;continue;}
  let found=-1;
  for(let k=1;k<=3&&p+k<expected.length;k++){if(sameWord(expected[p+k],h)){found=k;break;}}
  if(found>0){for(let k=0;k<found;k++)states[p+k]="missed";states[p+found]="ok";p+=found+1;continue;}
  // The last interim word may still be half-recognised while the user is speaking.
  if(!final&&idx===heard.length-1)break;
  states[p]="bad";heardAt[p]=h;p++;
 }
 return {states,heardAt,cursor:p};
}

export default function Recite(){
 const params=useLocalSearchParams<{surah?:string;ayah?:string;scope?:string}>();
 const selectedSurah=Math.max(1,Math.min(114,Number(params.surah)||1));
 const selectedAyah=Math.max(1,Number(params.ayah)||1);
 const fullSurahMode=params.scope==="surah";
 const surahName=SURAHS.find(x=>x.number===selectedSurah)?.nameAr||"";
 const [referenceText,setReferenceText]=useState("جاري تحميل الآية الموثقة…");
 const [referenceLabel,setReferenceLabel]=useState("الآية");
 const [refReady,setRefReady]=useState(false);
 const [riwaya,setRiwayaState]=useState(getSelectedRiwayah());
 const riwayat=["حفص عن عاصم","شعبة عن عاصم","قالون عن نافع","ورش عن نافع","البزي عن ابن كثير","قنبل عن ابن كثير","الدوري عن أبي عمرو","السوسي عن أبي عمرو","هشام عن ابن عامر","ابن ذكوان عن ابن عامر","خلف عن حمزة","خلاد عن حمزة","أبو الحارث عن الكسائي","الدوري عن الكسائي","ابن وردان عن أبي جعفر","ابن جمّاز عن أبي جعفر","رويس عن يعقوب","روح عن يعقوب","إسحاق عن خلف العاشر","إدريس عن خلف العاشر"];
 const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
 const state=useAudioRecorderState(recorder);
 const [message,setMessage]=useState("اضغط على الميكروفون وابدأ التسميع");
 const [recorded,setRecorded]=useState(false);
 const [mode,setMode]=useState<"live"|"deep">("deep");
 const [sessionStatus,setSessionStatus]=useState<"idle"|"recording"|"recorded"|"processing">("idle");
 const [mushafVisible,setMushafVisible]=useState(true);
 const [panelOpen,setPanelOpen]=useState(false);
 const [showTajweedColors,setShowTajweedColors]=useState(false);
 const [heardText,setHeardText]=useState("");
 const [speechMessage,setSpeechMessage]=useState("الكلمات المباشرة تعمل في متصفح يدعم التعرّف الصوتي؛ وعلى الجوال تظهر النتيجة بعد إيقاف التسجيل.");
 const [speechRecognition,setSpeechRecognition]=useState<any>(null);
 const [analysis,setAnalysis]=useState<any>(null);
 const [analysisBusy,setAnalysisBusy]=useState(false);

 const setRiwaya=(value:string)=>{setSelectedRiwayah(value);setRiwayaState(value);setMessage(value==="حفص عن عاصم"?"تم اختيار حفص عن عاصم؛ النص الموثق والتسجيل والتحليل النصي المبدئي متاحون.":`تم اختيار ${value}. الاختيار محفوظ أثناء التنقل داخل التطبيق، لكن نص المصحف والتحليل لهذه الرواية غير مفعّلين قبل توثيق مصدرها.`);};

 useEffect(()=>{ import("../src/quran/verified-corpus.json").then((m)=>{
   const corpus=m.default as {ayahs:{surah:number;ayah:number;text:string}[]};
   if(fullSurahMode){
    const hits=corpus.ayahs.filter(x=>x.surah===selectedSurah);
    if(hits.length){setReferenceText(hits.map(x=>x.text+` ﴿${x.ayah}﴾`).join(" "));setReferenceLabel(`السورة كاملة • ${hits.length} آيات`);setRefReady(true);}
   }else{
    const hit=corpus.ayahs.find(x=>x.surah===selectedSurah&&x.ayah===selectedAyah);
    if(hit){setReferenceText(hit.text);setReferenceLabel(`الآية ${hit.ayah}`);setRefReady(true);}
   }
 }).catch(()=>setReferenceText("سيظهر النص بعد تجهيز نسخة المصحف داخل التطبيق.")); },[fullSurahMode,selectedSurah,selectedAyah]);

 const tokens=useMemo(()=>referenceText.split(/\s+/u).filter(Boolean),[referenceText]);
 const wordInfo=useMemo(()=>tokens.map(text=>{
  const marker=/^﴿.*﴾$/u.test(text);
  return {text,marker,norm:marker?"":normalizeArabicForCompare(text).replace(/ /g,"")};
 }),[tokens]);
 const expectedIdx=useMemo(()=>refReady&&riwaya==="حفص عن عاصم"?wordInfo.map((w,i)=>(!w.marker&&w.norm?i:-1)).filter(i=>i>=0):[],[wordInfo,refReady,riwaya]);
 const ruleByToken=useMemo(()=>{
  const map:Record<number,string>={};
  if(!refReady||fullSurahMode)return map;
  for(const check of findExpectedTajweedChecks(referenceText)){
   if(check.ruleId==="madd"||!RULE_COLORS[check.ruleId])continue;
   if(map[check.wordIndex-1]===undefined)map[check.wordIndex-1]=check.ruleId;
  }
  return map;
 },[referenceText,refReady,fullSurahMode]);

 const spoken=analysis?.transcript||heardText;
 const tracked=useMemo(()=>{
  if(!expectedIdx.length||!spoken)return null;
  return trackRecitation(expectedIdx.map(i=>wordInfo[i].norm),spoken,!state.isRecording);
 },[expectedIdx,wordInfo,spoken,state.isRecording]);
 const stateByToken:Record<number,{state:WordState;heard?:string}>={};
 let cursorToken=-1;
 if(tracked){
  expectedIdx.forEach((tokenIndex,k)=>{const st=tracked.states[k];if(st)stateByToken[tokenIndex]={state:st,heard:tracked.heardAt[k]};});
  if(tracked.cursor<expectedIdx.length)cursorToken=expectedIdx[tracked.cursor];
 }
 const counts={ok:0,bad:0,missed:0};
 Object.values(stateByToken).forEach(v=>{counts[v.state]++;});

 function startLiveWords(){
  const browser = globalThis as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
  const SpeechRecognitionClass = browser.SpeechRecognition || browser.webkitSpeechRecognition;
  if(!SpeechRecognitionClass){
   setSpeechMessage("التعرّف المباشر على الكلمات غير مدعوم في هذا المتصفح/الجهاز؛ ستظهر الكلمات بعد إيقاف التسجيل عبر خادم التحليل.");
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
    setSpeechMessage("الكلمات الظاهرة تعرّفٌ صوتي مبدئي وقد يخطئ؛ ليست حكمًا على التجويد.");
   };
   recognition.onerror = () => setSpeechMessage("توقف التعرّف على الكلمات أو لم يحصل على إذن الميكروفون. التسجيل الصوتي منفصل عنه.");
   recognition.onend = () => setSpeechRecognition(null);
   recognition.start();
   setSpeechRecognition(recognition);
   setSpeechMessage("جارٍ التقاط الكلمات؛ قد تظهر أخطاء في نص التعرّف.");
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
  setMessage("جارٍ تحويل التسجيل إلى نص ومقارنته بالآية المرجعية…");
  try{
   const audioResponse=await fetch(uri);
   if(!audioResponse.ok) throw new Error("تعذر قراءة ملف التسجيل");
   const audioBlob=await audioResponse.blob();
   const response=await fetch(baseUrl+"/api/analyze-recitation?surah="+selectedSurah+"&scope="+(fullSurahMode?"surah":"ayah")+"&ayah="+selectedAyah+"&riwaya=hafs",{method:"POST",headers:{"Content-Type":audioBlob.type||"audio/m4a"},body:audioBlob});
   const result=await response.json();
   if(!response.ok) throw new Error(result?.message||"تعذر إكمال التحليل");
   setAnalysis(result); setSessionStatus("recorded");
   setMessage("اكتملت المقارنة النصية المبدئية. هذا ليس حكمًا على التجويد أو صحة الأداء الصوتي.");
  }catch(error){
   const detail=error instanceof Error?error.message:"خطأ غير معروف";
   // Safe local fallback: compare only browser-recognized words with the verified reference.
   // This is explicitly preliminary and never presented as tajweed analysis.
   if(!fullSurahMode && heardText.trim() && referenceText && !referenceText.startsWith("جاري تحميل")){
    const local=compareRecognizedWords(referenceText,heardText);
    setAnalysis({
     transcript:heardText.trim(),
     matchRate:local.matchRate,
     textAlignment:local.textAlignment,
     confidence:"low",
     analysisLevel:"browser_speech_to_text_alignment",
     engines:{
      speechRecognition:{status:"completed_preliminary",model:"browser-speech-recognition"},
      quranAlignment:{status:"completed",matchRate:local.matchRate,editDistance:local.textAlignment.editDistance},
      acousticTajweed:{status:"not_configured",rulesEvaluated:[]},
      confidenceGate:{status:"blocked_low_text_confidence"}
     },
     tajweed:{status:"not_configured",findings:[],rulesEvaluated:[],message:"هذه مقارنة نصية محلية أولية من تعرّف المتصفح؛ محرك التجويد الصوتي المتخصص غير موصول."},
     disclaimer:"النسبة تقريبية وتعتمد على دقة التعرّف الصوتي في المتصفح؛ لا تقيس مخارج الحروف أو أحكام التجويد."
    });
    setMessage("تعذّر خادم التحليل؛ عُرضت مقارنة محلية مبدئية من كلمات المتصفح فقط، دون حكم على التجويد.");
   }else{
    setMessage("تعذر إكمال التحليل: "+detail+". لم نعرض نتيجة مخمّنة.");
   }
   setSessionStatus("recorded");
  }finally{setAnalysisBusy(false);}
 }

 function resetSession(){
  stopLiveWords();
  setHeardText("");setAnalysis(null);setRecorded(false);setSessionStatus("idle");
  setMessage("اضغط على الميكروفون وابدأ التسميع");
 }

 async function toggleRecording(){
  try{
   if(riwaya !== "حفص عن عاصم"){
    setMessage("التسجيل والتحليل لهذه الرواية غير مفعّلين بعد؛ نحتاج أولًا إلى نص موثّق ومحرك تحليل مختبَر لها.");
    return;
   }
   if(state.isRecording){
    stopLiveWords();
    await recorder.stop();
    setRecorded(true);
    setSessionStatus("recorded");
    if(fullSurahMode && mode!=="deep"){
     setAnalysis(null);
     setMessage("تم تسجيل السورة كاملة. اختر التحليل العميق لمقارنة التسجيل بآيات السورة وتحديد مواضع الاختلاف النصي.");
    }else if(mode==="deep"){
     setMessage("انتهى التسجيل. جارٍ تجهيز المقارنة النصية المبدئية إن كان خادم التحليل متاحًا.");
     const audioUri=recorder.uri;
     void analyzeRecording(audioUri ?? undefined);
    }else{
     setAnalysis(null);
     setMessage("انتهى التسجيل. الوضع المباشر يعرض تعرّف المتصفح على الكلمات فقط؛ لا يصدر حكمًا على صحة التلاوة أو التجويد. اختر التحليل العميق للمقارنة النصية بعد التسجيل.");
    }
    return;
   }
   const permission=await requestRecordingPermissionsAsync();
   if(!permission.granted){setMessage("يجب السماح بالميكروفون لبدء التلاوة");return;}
   setRecorded(false);
   setAnalysis(null);
   setPanelOpen(false);
   setHeardText("");
   await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
   await recorder.prepareToRecordAsync();
   recorder.record();
   startLiveWords();
   setSessionStatus("recording");
   setMessage("جاري الاستماع… اقرأ بهدوء");
  }catch(error){
   console.error("Ijazah recording error:",error);
   const detail=error instanceof Error?error.message:String(error??"خطأ غير معروف");
   setSessionStatus("idle");
   setMessage(`تعذر بدء التسجيل (${detail}). تأكد من إذن الميكروفون ثم أعد المحاولة.`);
  }
 }

 const seconds=Math.floor((state.durationMillis||0)/1000);
 const timerText=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
 const hafs=riwaya==="حفص عن عاصم";

 return <View style={s.root}>
  <StatusBar style="dark"/>
  <View style={s.header}>
   <Pressable onPress={()=>router.back()} style={s.backButton}><Text style={s.back}>‹</Text></Pressable>
   <View style={s.headerCenter}>
    <Text style={s.headerTitle}>{surahName?`سورة ${surahName}`:"التسميع"}</Text>
    <Text style={s.headerSub}>{state.isRecording?`● ${timerText}`:`${referenceLabel} • ${riwaya}`}</Text>
   </View>
   <View style={s.headerSpacer}/>
  </View>

  <ScrollView style={s.body} contentContainerStyle={s.content}>
   {hafs?<Text style={s.mushaf}>
    {tokens.map((token,i)=>{
     const info=wordInfo[i];
     const result=stateByToken[i];
     const masked=!mushafVisible&&!info.marker&&refReady&&!result;
     const ruleColor=showTajweedColors&&!result?RULE_COLORS[ruleByToken[i]]:undefined;
     const style:any=[s.word];
     if(info.marker)style.push(s.marker);
     else if(masked)style.push(s.masked);
     else if(result?.state==="ok")style.push({color:C.ok});
     else if(result?.state==="bad")style.push({color:C.bad});
     else if(result?.state==="missed")style.push({color:C.missed});
     else if(ruleColor)style.push({color:ruleColor});
     if(i===cursorToken&&state.isRecording&&mushafVisible)style.push(s.cursor);
     const shown=!mushafVisible&&result?.state==="bad"&&result.heard?result.heard:token;
     return <Fragment key={i}><Text style={style}>{shown}</Text><Text> </Text></Fragment>;
    })}
   </Text>:<Text style={s.unavailable}>لم نضف بعدُ قاعدة المصحف المحققة لهذه الرواية. لن نعرض نص حفص على أنه نص رواية أخرى، ولن نحلل التلاوة بهذه الرواية قبل توثيق نصها وقواعدها.</Text>}

   {hafs&&<Text style={s.sourceNote}>النص القرآني ثابت من قاعدة موثّقة ولا يتم توليده بالذكاء الاصطناعي.</Text>}

   {analysisBusy&&<View style={s.pending}><Text style={s.pendingTitle}>جارٍ تحليل التسجيل</Text><Text style={s.pendingText}>نحوّل الصوت إلى كلمات ثم نقارنها بالنص المرجعي. تحليل التجويد الصوتي يحتاج محركًا متخصصًا منفصلًا.</Text></View>}

   {recorded&&!analysis&&!analysisBusy&&!tracked&&<View style={s.pending}><Text style={s.pendingTitle}>🎙️ التسجيل تم فعليًا</Text><Text style={s.pendingText}>إذا لم يظهر تحليل، فتحقق من نشر خادم التحليل وضبط عنوانه. لن نخترع نتيجة أو تصحيحًا غير محسوب.</Text></View>}

   {analysis&&<View style={s.analysisCard}>
    <Text style={s.analysisTitle}>{analysis.reference?.scope==="surah"?"نتيجة المقارنة النصية المبدئية للسورة كاملة":"نتيجة المقارنة النصية المبدئية"}</Text>
    <View style={s.statsRow}>
     <Stat label="تطابق نصي" value={analysis.matchRate+"%"} color={C.cyanDark}/>
     <Stat label="صحيحة" value={String(counts.ok)} color={C.ok}/>
     <Stat label="احتمال خطأ" value={String(counts.bad)} color={C.bad}/>
     <Stat label="متروكة" value={String(counts.missed)} color={C.missed}/>
    </View>
    {(analysis.textAlignment?.errors||[]).length>0?(analysis.textAlignment.errors.slice(0,8).map((item:any,index:number)=><Text key={index} style={s.analysisError}>{item.type==="possible_omission"?"احتمال إسقاط":item.type==="possible_addition"?"احتمال زيادة":"احتمال اختلاف"}{typeof item.ayah==="number"?" • الآية "+item.ayah+(typeof item.wordIndex==="number"?"، الكلمة "+item.wordIndex:""):""}: {item.expected?("المتوقع «"+item.expected+"»"):""} {item.heard?("، المسموع «"+item.heard+"»"):""}</Text>)):<Text style={s.analysisError}>لم تظهر اختلافات نصية واضحة، لكن هذا لا يثبت صحة التجويد.</Text>}
    {(analysis.tajweed?.findings||[]).slice(0,8).map((item:any,index:number)=><Text key={"tajweed-"+index} style={s.analysisError}>{typeof item==="string"?item:(item.ruleId||"حكم")+": "+(item.evidence||"")}</Text>)}
    <Text style={s.engineLine}>محرك التجويد: {analysis.engines?.acousticTajweed?.status==="not_configured"?"المحرك المتخصص غير موصول":analysis.engines?.acousticTajweed?.status==="blocked_by_content_guard"?"متوقف لحماية دقة النص":analysis.engines?.acousticTajweed?.status==="unavailable"?"الخدمة غير متاحة":analysis.engines?.acousticTajweed?.status==="invalid_response"?"استجابة غير صالحة":"نتيجة صوتية أولية"} • بوابة الثقة: {analysis.engines?.confidenceGate?.status==="passed_preliminary"?"اجتازت الحد النصي الأولي فقط":"أوقفت تقييم التجويد"}</Text>
    <Text style={s.analysisDisclaimer}>{analysis.tajweed?.message||analysis.disclaimer}</Text>
   </View>}

   {!analysis&&tracked&&<View style={s.liveStats}><Text style={[s.liveStat,{color:C.ok}]}>✓ {counts.ok}</Text><Text style={[s.liveStat,{color:C.bad}]}>✗ {counts.bad}</Text><Text style={[s.liveStat,{color:C.missed}]}>↷ {counts.missed}</Text></View>}
  </ScrollView>

  {panelOpen&&<View style={s.panel}>
   <ScrollView style={s.panelScroll} contentContainerStyle={s.panelContent}>
    <Text style={s.panelTitle}>وضع التحليل</Text>
    <View style={s.modeRow}>
     <Pressable onPress={()=>setMode("deep")} style={[s.mode,mode==="deep"&&s.modeActive]}><Text style={[s.modeText,mode==="deep"&&s.modeTextActive]}>تحليل عميق</Text></Pressable>
     <Pressable onPress={()=>setMode("live")} style={[s.mode,mode==="live"&&s.modeActive]}><Text style={[s.modeText,mode==="live"&&s.modeTextActive]}>مباشر</Text></Pressable>
    </View>
    <Pressable onPress={()=>setShowTajweedColors(v=>!v)} style={s.switchRow}>
     <Text style={s.switchLabel}>ألوان مواضع التجويد (مواضع مرشحة من النص، وليست تقييمًا للتلاوة)</Text>
     <View style={[s.switchTrack,showTajweedColors&&s.switchTrackOn]}><View style={[s.switchKnob,showTajweedColors&&s.switchKnobOn]}/></View>
    </Pressable>
    <Pressable onPress={resetSession} style={s.resetButton}><Text style={s.resetText}>بدء جلسة جديدة</Text></Pressable>
    <Text style={s.panelTitle}>الرواية</Text>
    <View style={s.riwayaList}>{riwayat.map((item)=><Pressable key={item} onPress={()=>setRiwaya(item)} style={[s.riwayaChip,riwaya===item&&s.riwayaChipActive]}><Text style={[s.riwayaChipText,riwaya===item&&s.riwayaChipTextActive]}>{item}</Text></Pressable>)}</View>
   </ScrollView>
  </View>}

  <View style={s.footer}>
   <Text style={s.listening} numberOfLines={2}>{message}</Text>
   {state.isRecording&&!speechRecognition&&<Text style={s.speechNote} numberOfLines={2}>{speechMessage}</Text>}
   <View style={s.bar}>
    <Pressable onPress={()=>setMushafVisible(v=>!v)} style={s.sideButton}>
     <Text style={s.sideIcon}>{mushafVisible?"🙈":"👁"}</Text>
     <Text style={s.sideLabel}>{mushafVisible?"إخفاء المصحف":"إظهار المصحف"}</Text>
    </Pressable>
    <Pressable onPress={toggleRecording} disabled={analysisBusy} style={[s.mic,state.isRecording&&s.micOn,analysisBusy&&s.micDisabled]}>
     {state.isRecording?<View style={s.stopSquare}/>:<Text style={s.micIcon}>🎙️</Text>}
    </Pressable>
    <Pressable onPress={()=>setPanelOpen(v=>!v)} style={s.sideButton}>
     <Text style={s.sideIcon}>⚙️</Text>
     <Text style={s.sideLabel}>{sessionStatus==="processing"?"جارٍ التحليل":"الإعدادات"}</Text>
    </Pressable>
   </View>
  </View>
 </View>
}

function Stat({label,value,color}:{label:string;value:string;color:string}){return <View style={s.stat}><Text style={[s.statValue,{color}]}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.paper},
 header:{paddingTop:52,paddingHorizontal:14,paddingBottom:10,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:C.line,backgroundColor:C.paper},
 backButton:{width:42,height:42,alignItems:"center",justifyContent:"center"},
 back:{color:C.ink,fontSize:34,lineHeight:36},
 headerSpacer:{width:42},
 headerCenter:{flex:1,alignItems:"center"},
 headerTitle:{color:C.ink,fontSize:19,fontWeight:"800"},
 headerSub:{color:C.muted,fontSize:11,marginTop:3},
 body:{flex:1},
 content:{paddingHorizontal:22,paddingTop:22,paddingBottom:190},
 mushaf:{writingDirection:"rtl",textAlign:"justify",fontFamily:QURAN_FONT,fontSize:30,lineHeight:64,color:C.ink},
 word:{color:C.ink},
 marker:{color:C.muted,fontSize:22},
 masked:{color:"transparent",backgroundColor:C.mask},
 cursor:{backgroundColor:C.cursor},
 unavailable:{textAlign:"right",fontSize:15,lineHeight:28,color:"#8A6514",fontWeight:"700"},
 sourceNote:{marginTop:18,color:C.muted,fontSize:10,textAlign:"center",lineHeight:16},
 pending:{backgroundColor:"#E5F8FC",borderRadius:20,padding:17,marginTop:17,borderWidth:1,borderColor:"#B9EDF1"},
 pendingTitle:{color:C.cyanDark,fontWeight:"900",fontSize:14,textAlign:"right"},
 pendingText:{color:"#496476",fontSize:11,lineHeight:19,marginTop:7,textAlign:"right"},
 analysisCard:{backgroundColor:C.white,borderRadius:22,padding:17,marginTop:20,borderWidth:1,borderColor:"#B8E8EF"},
 analysisTitle:{color:C.navy,fontSize:15,fontWeight:"900",textAlign:"right"},
 statsRow:{flexDirection:"row",gap:8,marginTop:12},
 stat:{flex:1,backgroundColor:"#F4F8FC",borderRadius:14,paddingVertical:10,alignItems:"center"},
 statValue:{fontSize:17,fontWeight:"900"},
 statLabel:{color:C.muted,fontSize:10,marginTop:3},
 analysisError:{color:"#875D18",fontSize:12,lineHeight:21,textAlign:"right",marginTop:6},
 engineLine:{color:"#466276",fontSize:11,lineHeight:19,textAlign:"right",marginTop:12},
 analysisDisclaimer:{color:C.muted,fontSize:10,lineHeight:18,textAlign:"right",marginTop:10},
 liveStats:{flexDirection:"row",justifyContent:"center",gap:22,marginTop:18},
 liveStat:{fontSize:16,fontWeight:"900"},
 panel:{position:"absolute",left:12,right:12,bottom:150,maxHeight:"58%",backgroundColor:C.white,borderRadius:24,borderWidth:1,borderColor:C.line,shadowColor:"#000",shadowOpacity:0.12,shadowRadius:18,shadowOffset:{width:0,height:6},elevation:8},
 panelScroll:{flexGrow:0},
 panelContent:{padding:16},
 panelTitle:{color:C.navy,fontSize:13,fontWeight:"900",textAlign:"right",marginTop:6,marginBottom:9},
 modeRow:{flexDirection:"row",backgroundColor:"#E9EEF4",borderRadius:15,padding:4},
 mode:{flex:1,paddingVertical:9,alignItems:"center",borderRadius:11},
 modeActive:{backgroundColor:C.white},
 modeText:{color:"#788BA0",fontSize:12,fontWeight:"700"},
 modeTextActive:{color:C.navy},
 switchRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginTop:14},
 switchLabel:{flex:1,color:"#466276",fontSize:11,lineHeight:18,textAlign:"right"},
 switchTrack:{width:44,height:26,borderRadius:13,backgroundColor:"#CBD5DF",padding:3,justifyContent:"center"},
 switchTrackOn:{backgroundColor:C.cyan},
 switchKnob:{width:20,height:20,borderRadius:10,backgroundColor:C.white},
 switchKnobOn:{alignSelf:"flex-end"},
 resetButton:{marginTop:14,backgroundColor:"#F1F8FC",borderRadius:14,paddingVertical:11,alignItems:"center",borderWidth:1,borderColor:"#CFE7EE"},
 resetText:{color:C.cyanDark,fontWeight:"800",fontSize:12},
 riwayaList:{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:4},
 riwayaChip:{backgroundColor:C.paper,borderRadius:12,paddingHorizontal:10,paddingVertical:9,borderWidth:1,borderColor:C.line},
 riwayaChipActive:{backgroundColor:"#E5F8FC",borderColor:C.cyan},
 riwayaChipText:{fontSize:10,color:C.muted,fontWeight:"700"},
 riwayaChipTextActive:{color:C.cyanDark,fontWeight:"900"},
 footer:{position:"absolute",left:0,right:0,bottom:0,backgroundColor:C.paper,borderTopWidth:1,borderTopColor:C.line,paddingTop:10,paddingBottom:26,paddingHorizontal:18},
 listening:{textAlign:"center",fontWeight:"700",color:C.ink,fontSize:12,lineHeight:18},
 speechNote:{textAlign:"center",color:C.muted,fontSize:10,lineHeight:15,marginTop:3},
 bar:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:10},
 sideButton:{width:92,alignItems:"center",gap:4},
 sideIcon:{fontSize:22},
 sideLabel:{color:C.muted,fontSize:10,fontWeight:"700"},
 mic:{width:78,height:78,borderRadius:39,backgroundColor:C.cyan,alignItems:"center",justifyContent:"center",shadowColor:C.cyan,shadowOpacity:0.45,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:7},
 micOn:{backgroundColor:"#FF6B6B",shadowColor:"#FF6B6B"},
 micDisabled:{opacity:0.5},
 micIcon:{fontSize:32},
 stopSquare:{width:26,height:26,borderRadius:6,backgroundColor:C.white}
});
