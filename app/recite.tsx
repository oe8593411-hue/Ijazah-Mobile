import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { getSelectedRiwayah, setSelectedRiwayah } from "../src/quran/riwayah";
import { usePreferences } from "../src/preferences";

const C={navy:"#071A33",navy2:"#102B49",cyan:"#35C7DE",soft:"#E5F8FC",ink:"#142A43",muted:"#788BA0",surface:"#F4F8FC",white:"#FFFFFF"};

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

export default function Recite(){
 const params=useLocalSearchParams<{surah?:string;ayah?:string;scope?:string}>();
 const selectedSurah=Math.max(1,Math.min(114,Number(params.surah)||1));
 const selectedAyah=Math.max(1,Number(params.ayah)||1);
 const fullSurahMode=params.scope==="surah";
 const { dark, setDark } = usePreferences();
 const [activeAyah, setActiveAyah] = useState(selectedAyah);
 const [hideAyahs, setHideAyahs] = useState(false);
 const [continuousMode, setContinuousMode] = useState(false);
 const [referenceText,setReferenceText]=useState("جاري تحميل الآية الموثقة…");
 const [referenceLabel,setReferenceLabel]=useState("الآية");
 const [riwaya,setRiwayaState]=useState(getSelectedRiwayah());
 const setRiwaya=(value:string)=>{setSelectedRiwayah(value);setRiwayaState(value);setMessage(value==="حفص عن عاصم"?"تم اختيار حفص عن عاصم؛ النص الموثق والتسجيل والتحليل النصي المبدئي متاحون.":`تم اختيار ${value}. الاختيار محفوظ أثناء التنقل داخل التطبيق، لكن نص المصحف والتحليل لهذه الرواية غير مفعّلين قبل توثيق مصدرها.`);};
 const riwayat=["حفص عن عاصم","شعبة عن عاصم","قالون عن نافع","ورش عن نافع","البزي عن ابن كثير","قنبل عن ابن كثير","الدوري عن أبي عمرو","السوسي عن أبي عمرو","هشام عن ابن عامر","ابن ذكوان عن ابن عامر","خلف عن حمزة","خلاد عن حمزة","أبو الحارث عن الكسائي","الدوري عن الكسائي","ابن وردان عن أبي جعفر","ابن جمّاز عن أبي جعفر","رويس عن يعقوب","روح عن يعقوب","إسحاق عن خلف العاشر","إدريس عن خلف العاشر"];

 useEffect(()=>{ let alive=true; import("../src/quran/verified-corpus.json").then((m)=>{ const corpus=m.default as {ayahs:{surah:number;ayah:number;text:string}[]}; let hits=corpus.ayahs.filter(x=>x.surah===selectedSurah); if(!fullSurahMode){if(continuousMode)hits=hits.filter(x=>x.ayah>=activeAyah&&x.ayah<activeAyah+10);else hits=hits.filter(x=>x.ayah===activeAyah);} if(hits.length&&alive){setReferenceText(hits.map(x=>x.text+(continuousMode||fullSurahMode?" ﴿"+x.ayah+"﴾":"")).join(" "));setReferenceLabel(fullSurahMode?"السورة كاملة • "+hits.length+" آيات":continuousMode?"مقطع متصل من الآية "+activeAyah:"الآية "+activeAyah);} }).catch(()=>{if(alive)setReferenceText("تعذر تحميل النص الموثق.");}); return ()=>{alive=false;}; },[selectedSurah,activeAyah,fullSurahMode,continuousMode]);
 const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
 const state=useAudioRecorderState(recorder);
 const [message,setMessage]=useState("جاهز للتسجيل");
 const [recorded,setRecorded]=useState(false);
 const [mode,setMode]=useState<"live"|"deep">("live");
 const [sessionStatus,setSessionStatus]=useState<"idle"|"recording"|"recorded"|"processing">("idle");
 const [mushafVisible,setMushafVisible]=useState(true);
 const [heardText,setHeardText]=useState("");
 const [speechMessage,setSpeechMessage]=useState("التعرّف المباشر على الكلمات يعمل في متصفح يدعمه فقط، ولا يُعدّ تصحيحًا للتلاوة.");
 const [speechRecognition,setSpeechRecognition]=useState<any>(null);
 const [analysis,setAnalysis]=useState<any>(null);
 const [analysisBusy,setAnalysisBusy]=useState(false);

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
  setMessage("جارٍ إرسال التسجيل لتحويله إلى نص ومقارنته بالآية المرجعية…");
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
   setHeardText("");
   await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
   await recorder.prepareToRecordAsync();
   recorder.record();
   startLiveWords();
   setSessionStatus("recording");
   setMessage("جاري الاستماع… اقرأ الآية بهدوء");
  }catch(error){
   console.error("Ijazah recording error:",error);
   const detail=error instanceof Error?error.message:String(error??"خطأ غير معروف");
   setSessionStatus("idle");
   setMessage(`تعذر بدء التسجيل (${detail}). تأكد من إذن الميكروفون ثم أعد المحاولة.`);
  }
 }

 return <View style={[s.root,{backgroundColor:dark?"#061321":"#071A33"}]}>
  <StatusBar style="light"/>
  <View style={s.header}><Pressable onPress={()=>router.back()} style={s.backButton}><Text style={s.back}>‹</Text></Pressable><View style={s.headerCenter}><Text style={s.headerTitle}>التسميع</Text><Text style={s.headerSub}>المصحف أمامك • حفص عن عاصم</Text></View><Pressable onPress={()=>setDark(!dark)} style={s.themeButton}><Text style={s.themeText}>{dark?"☀":"☾"}</Text></Pressable></View>
  <View style={[s.workspace,{backgroundColor:dark?"#0A1D30":"#EAF2F7"}]}>
   <View style={s.surahTop}><View style={{flex:1}}><Text style={[s.surahTitle,{color:dark?"#F5F8FC":"#10253D"}]}>{referenceLabel}</Text><Text style={[s.surahMeta,{color:dark?"#9EB4C9":"#687D91"}]}>سورة رقم {selectedSurah} · {riwaya}</Text></View><Pressable onPress={()=>setContinuousMode(v=>!v)} style={[s.continuousToggle,continuousMode&&s.continuousActive]}><Text style={[s.continuousText,continuousMode&&s.continuousTextActive]}>{continuousMode?"قراءة متصلة ✓":"قراءة متصلة"}</Text></Pressable></View>
   <View style={[s.ayahPicker,{backgroundColor:dark?"#10283F":"#FFFFFF",borderColor:dark?"#244762":"#D8E4ED"}]}><Text style={[s.pickerLabel,{color:dark?"#B5C9DA":"#60758A"}]}>اختار الآية اللي هتبدأ منها</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ayahChoices}>{Array.from({length:selectedSurah===1?7:selectedSurah===2?286:300},(_,i)=>i+1).map(n=><Pressable key={n} onPress={()=>{setActiveAyah(n);setContinuousMode(false);setAnalysis(null);setHeardText("");}} style={[s.ayahChoice,activeAyah===n&&s.ayahChoiceActive]}><Text style={[s.ayahChoiceText,activeAyah===n&&s.ayahChoiceTextActive]}>{n}</Text></Pressable>)}</ScrollView></View>
   <ScrollView style={s.mushafScroll} contentContainerStyle={s.mushafScrollContent}><View style={[s.mushafPage,{backgroundColor:dark?"#102238":"#FFFEF8",borderColor:dark?"#2D506B":"#D5C7A7"}]}><View style={s.pageOrnament}><Text style={[s.pageSurah,{color:dark?"#D5B86C":"#8A713E"}]}>۞  المصحف الشريف  ۞</Text></View>{riwaya==="حفص عن عاصم"?<Text style={[s.mushafText,{color:dark?"#F5F5F1":"#171A1D"}]}>{hideAyahs?renderRevealedWords(referenceText,heardText):renderAlignedWords(referenceText,heardText)}</Text>:<Text style={s.riwayaUnavailable}>النص والتحليل لهذه الرواية غير مفعّلين قبل توثيق مصدرها.</Text>}<Text style={[s.pageFooter,{color:dark?"#9EB4C9":"#7B6D51"}]}>{referenceLabel} • Tanzil Uthmani 1.1</Text></View></ScrollView>
   {heardText.length>0&&<View style={[s.recognitionStrip,{backgroundColor:dark?"#10283F":"#FFFFFF",borderColor:dark?"#244762":"#D8E4ED"}]}><Text style={[s.recognitionTitle,{color:dark?"#EAF4FC":"#16334C"}]}>ما التقطه الميكروفون</Text><Text style={[s.recognitionText,{color:dark?"#B9CDDF":"#52697D"}]}>{heardText}</Text><Text style={s.confidenceNote}>التعرّف الصوتي مبدئي؛ الكلمات غير المؤكدة ليست أخطاء مؤكدة.</Text></View>}
   <View style={[s.bottomDock,{backgroundColor:dark?"#07182A":"#FFFFFF",borderColor:dark?"#203B53":"#D7E4ED"}]}><Pressable onPress={()=>setHideAyahs(v=>!v)} style={[s.hideAyahButton,hideAyahs&&s.hideAyahActive]}><Text style={[s.hideAyahText,hideAyahs&&s.hideAyahTextActive]}>{hideAyahs?"إظهار الآيات":"إخفاء الآيات"} ◉</Text></Pressable><View style={s.micColumn}><Pressable onPress={toggleRecording} style={[s.micButton,state.isRecording&&s.micButtonRecording]}><Text style={s.micGlyph}>{state.isRecording?"■":"🎙"}</Text></Pressable><Text style={[s.micCaption,{color:dark?"#C7D7E5":"#38546A"}]}>{state.isRecording?"جارٍ الاستماع…":"ابدأ التسميع"}</Text></View><Pressable onPress={()=>{if(state.isRecording)void toggleRecording();else{setAnalysis(null);setHeardText("");setMessage("تم مسح الجلسة الحالية.");setSessionStatus("idle");}}} style={s.cancelButton}><Text style={s.cancelText}>{state.isRecording?"إيقاف":"إعادة"}</Text></Pressable></View>
   <Text style={[s.listeningMessage,{color:dark?"#AFC5D8":"#647A8E"}]}>{message}</Text>{state.isRecording&&<Text style={s.timer}>{Math.floor((state.durationMillis||0)/1000)} ث</Text>}
   {analysisBusy&&<View style={s.notice}><Text style={s.noticeTitle}>جارٍ تحليل التسجيل</Text><Text style={s.noticeText}>نقارن النص المسموع بالمرجع؛ لا نصدر حكمًا على التجويد من دون محرك متخصص.</Text></View>}
   {analysis&&<View style={s.notice}><Text style={s.noticeTitle}>نتيجة المقارنة النصية المبدئية</Text><Text style={s.noticeText}>التطابق التقريبي: {analysis.matchRate}% — لا يمثل درجة التجويد أو صحة الأداء.</Text>{(analysis.textAlignment?.errors||[]).slice(0,5).map((item:any,i:number)=><Text key={i} style={s.errorLine}>موضع يحتاج مراجعة: {item.expected||item.heard||"كلمة غير مؤكدة"}</Text>)}</View>}
  </View>
 </View>
}
function renderAlignedWords(expected:string,heard:string){const expectedWords=expected.split(/\s+/).filter(Boolean);const heardWords=normalizeArabicForCompare(heard).split(" ").filter(Boolean);return expectedWords.map((word,index)=>{const matched=heardWords.includes(normalizeArabicForCompare(word));return <Text key={index} style={{color:matched?"#18A86B":undefined}}>{word} </Text>;});}
function renderRevealedWords(expected:string,heard:string){const expectedWords=expected.split(/\s+/).filter(Boolean);const heardWords=normalizeArabicForCompare(heard).split(" ").filter(Boolean);let cursor=0;return expectedWords.map((word,index)=>{const pos=heardWords.indexOf(normalizeArabicForCompare(word),cursor);const matched=pos>=0;if(matched)cursor=pos+1;return <Text key={index} style={{color:matched?"#18A86B":"#8CA0B3"}}>{matched?word:"ــــــــــ"} </Text>;});}
const s=StyleSheet.create({root:{flex:1},header:{paddingTop:48,paddingHorizontal:16,paddingBottom:14,flexDirection:"row",alignItems:"center"},backButton:{width:40,height:40,alignItems:"center",justifyContent:"center"},back:{color:"white",fontSize:34},headerCenter:{flex:1,alignItems:"center"},headerTitle:{color:"white",fontSize:19,fontWeight:"900"},headerSub:{color:"#8EDFE7",fontSize:10,marginTop:4},themeButton:{width:40,height:40,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:"#163653"},themeText:{color:"#D8F5F7",fontSize:20},workspace:{flex:1,borderTopLeftRadius:26,borderTopRightRadius:26,paddingTop:12},surahTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:15,paddingBottom:10,gap:8},surahTitle:{fontSize:17,fontWeight:"900",textAlign:"right"},surahMeta:{fontSize:10,marginTop:4,textAlign:"right"},continuousToggle:{paddingHorizontal:10,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:"#35C7DE"},continuousActive:{backgroundColor:"#D9F8ED",borderColor:"#20B77B"},continuousText:{fontSize:10,fontWeight:"800",color:"#35C7DE"},continuousTextActive:{color:"#087C56"},ayahPicker:{marginHorizontal:12,borderWidth:1,borderRadius:15,padding:9},pickerLabel:{fontSize:10,fontWeight:"700",textAlign:"right",marginBottom:7},ayahChoices:{gap:7,flexDirection:"row-reverse"},ayahChoice:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:"#D9E5EE",alignItems:"center",justifyContent:"center"},ayahChoiceActive:{backgroundColor:"#25BDE0",borderColor:"#25BDE0"},ayahChoiceText:{fontSize:11,color:"#6D8193",fontWeight:"700"},ayahChoiceTextActive:{color:"#06233A",fontWeight:"900"},mushafScroll:{flex:1,marginTop:10},mushafScrollContent:{paddingHorizontal:12,paddingBottom:10,flexGrow:1},mushafPage:{flexGrow:1,minHeight:300,borderWidth:1.5,borderRadius:12,paddingHorizontal:17,paddingVertical:14,justifyContent:"space-between"},pageOrnament:{borderBottomWidth:1,borderColor:"#D9C99D",paddingBottom:9,marginBottom:12,alignItems:"center"},pageSurah:{fontSize:13,fontWeight:"800"},mushafText:{fontSize:23,lineHeight:47,textAlign:"justify",writingDirection:"rtl",fontWeight:"500"},pageFooter:{textAlign:"center",fontSize:9,marginTop:14},riwayaUnavailable:{color:"#A77A20",fontSize:14,lineHeight:28,textAlign:"right"},recognitionStrip:{marginHorizontal:12,marginBottom:7,padding:9,borderRadius:13,borderWidth:1},recognitionTitle:{fontSize:10,fontWeight:"900",textAlign:"right"},recognitionText:{fontSize:13,lineHeight:22,textAlign:"right",marginTop:4},confidenceNote:{fontSize:9,color:"#C07C35",textAlign:"right",marginTop:4},bottomDock:{minHeight:104,marginHorizontal:10,marginBottom:4,paddingHorizontal:10,paddingVertical:8,borderRadius:20,borderWidth:1,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},hideAyahButton:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:6,paddingVertical:12,borderRadius:14,borderWidth:1,borderColor:"#2E526D"},hideAyahActive:{backgroundColor:"#D9F8ED",borderColor:"#24B77A"},hideAyahText:{fontSize:10,fontWeight:"800",color:"#8FA7BC"},hideAyahTextActive:{color:"#087C56"},micColumn:{alignItems:"center",justifyContent:"center",width:80},micButton:{width:64,height:64,borderRadius:32,alignItems:"center",justifyContent:"center",backgroundColor:"#19D58B",borderWidth:4,borderColor:"#0A6D58"},micButtonRecording:{backgroundColor:"#FF7777",borderColor:"#A63B46"},micGlyph:{fontSize:26,color:"#FFFFFF"},micCaption:{fontSize:9,fontWeight:"800",marginTop:3},cancelButton:{flex:1,alignItems:"center",justifyContent:"center",paddingVertical:12,borderRadius:14,borderWidth:1,borderColor:"#2E526D"},cancelText:{color:"#8FA7BC",fontSize:11,fontWeight:"800"},listeningMessage:{textAlign:"center",fontSize:10,paddingHorizontal:14,paddingVertical:5},timer:{textAlign:"center",color:"#19D58B",fontWeight:"800",paddingBottom:3},notice:{marginHorizontal:12,marginBottom:7,padding:12,borderRadius:14,backgroundColor:"#102A43",borderWidth:1,borderColor:"#2E526D"},noticeTitle:{color:"#9FE8ED",fontSize:12,fontWeight:"900",textAlign:"right"},noticeText:{color:"#C5D5E2",fontSize:10,lineHeight:18,textAlign:"right",marginTop:5},errorLine:{color:"#FF8B8B",fontSize:10,textAlign:"right",marginTop:5}});