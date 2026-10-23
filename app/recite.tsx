import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { getSelectedRiwayah, setSelectedRiwayah } from "../src/quran/riwayah";
import { usePreferences } from "../src/preferences";
import { SURAHS } from "../src/quran/surahs";

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
 const [continuousMode, setContinuousMode] = useState(true);
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
 const [surahPickerVisible,setSurahPickerVisible]=useState(false);
 const [ayahPickerVisible,setAyahPickerVisible]=useState(false);
 const [heardText,setHeardText]=useState("");
 const [speechMessage,setSpeechMessage]=useState("التعرّف المباشر على الكلمات يعمل في متصفح يدعمه فقط، ولا يُعدّ تصحيحًا للتلاوة.");
 const [speechRecognition,setSpeechRecognition]=useState<any>(null);
 const [analysis,setAnalysis]=useState<any>(null);
 const [analysisBusy,setAnalysisBusy]=useState(false);

 function navigateAyah(next:number){const max=SURAHS.find(x=>x.number===selectedSurah)?.ayahCount||1;const safe=Math.max(1,Math.min(max,next));setActiveAyah(safe);setHeardText("");setAnalysis(null);setHideAyahs(false);router.replace({pathname:"/recite",params:{surah:String(selectedSurah),ayah:String(safe),scope:"ayah"}});}

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

 return <View style={[s.root,{backgroundColor:dark?"#061321":"#EAF2F7"}]}><StatusBar style={dark?"light":"dark"}/><View style={s.minimalHeader}><Pressable onPress={()=>router.back()} style={s.smallAction}><Text style={[s.headerActionText,{color:dark?"#E8F4FC":"#18334B"}]}>‹</Text></Pressable><Pressable onPress={()=>setSurahPickerVisible(true)} style={{flex:1,alignItems:"center"}}><Text style={[s.surahTitle,{color:dark?"#F5F8FC":"#10253D"}]}>{SURAHS.find(x=>x.number===selectedSurah)?.nameAr||"المصحف الشريف"}　⌄</Text><Text style={[s.surahMeta,{color:dark?"#9EB4C9":"#687D91"}]}>حفص عن عاصم · {referenceLabel}</Text></Pressable><Pressable onPress={()=>setDark(!dark)} style={s.smallAction}><Text style={[s.headerActionText,{color:dark?"#E8F4FC":"#18334B"}]}>{dark?"☼":"☾"}</Text></Pressable></View><View style={[s.pageFrame,{backgroundColor:dark?"#0B1A2B":"#FDFBF4",borderColor:dark?"#28445A":"#D6C69F"}]}><View style={s.pageTopLine}><Text style={[s.pageSurah,{color:dark?"#D5B86C":"#8A713E"}]}>۞  المصحف الشريف  ۞</Text></View><ScrollView style={s.pageTextArea} contentContainerStyle={s.pageTextContent} showsVerticalScrollIndicator>{riwaya==="حفص عن عاصم"?<Text style={[s.mushafText,{color:dark?"#F5F5F1":"#171A1D"}]}>{hideAyahs?renderRevealedWords(referenceText,heardText):renderAlignedWords(referenceText,heardText)}</Text>:<Text style={s.riwayaUnavailable}>النص والتحليل لهذه الرواية غير مفعّلين قبل توثيق مصدرها.</Text>}</ScrollView><View style={s.pageBottomLine}><Text style={[s.pageFooter,{color:dark?"#9EB4C9":"#7B6D51"}]}>نص موثّق · Tanzil Uthmani 1.1</Text></View></View><View style={s.focusControls}><View style={s.navigationRow}><Pressable onPress={()=>navigateAyah(activeAyah-1)} style={s.navButton}><Text style={s.navButtonText}>الآية السابقة</Text></Pressable><Pressable onPress={()=>setAyahPickerVisible(true)} style={s.navButton}><Text style={s.navButtonText}>اختيار الآية {activeAyah} ⌄</Text></Pressable><Pressable onPress={()=>navigateAyah(activeAyah+1)} style={s.navButton}><Text style={s.navButtonText}>التالية</Text></Pressable></View><Pressable onPress={()=>setHideAyahs(v=>!v)} style={[s.hideButton,hideAyahs&&s.hideButtonOn]}><Text style={[s.hideButtonText,hideAyahs&&s.hideButtonTextOn]}>{hideAyahs?"إظهار الآيات":"إخفاء الآيات"}</Text></Pressable><Pressable onPress={toggleRecording} style={[s.bigMic,state.isRecording&&s.bigMicOn]}><Text style={s.bigMicGlyph}>{state.isRecording?"■":"🎙"}</Text></Pressable><Text style={[s.focusStatus,{color:dark?"#AFC5D8":"#647A8E"}]}>{state.isRecording?"جارٍ الاستماع — اقرأ من المصحف":"ابدأ التسميع من الصفحة"}</Text>{heardText.length>0&&<Text numberOfLines={2} style={[s.liveTranscript,{color:dark?"#9EDFC7":"#147A5A"}]}>{heardText}</Text>}{analysisBusy&&<Text style={s.analysisStatus}>جارٍ مراجعة التسجيل…</Text>}{analysis&&<View style={{maxHeight:92,width:"100%",alignItems:"center"}}><Text style={s.analysisStatus}>انتهت المقارنة النصية المبدئية؛ غير المؤكد ليس خطأً مؤكدًا.</Text>{(analysis?.textAlignment?.errors||[]).filter((item:any)=>typeof item.ayah==="number").slice(0,3).map((item:any,index:number)=><Text key={index} numberOfLines={1} style={s.analysisStatus}>سورة {SURAHS.find(x=>x.number===item.surah)?.nameAr||item.surah} · آية {item.ayah} · {item.type==="possible_omission"?"كلمة محتملة السقوط":item.type==="possible_addition"?"كلمة زائدة محتملة":"اختلاف نصي محتمل"}</Text>)}</View>}</View>
<Modal visible={surahPickerVisible} animationType="slide" transparent onRequestClose={()=>setSurahPickerVisible(false)}><View style={s.modalShade}><View style={[s.pickerPanel,{backgroundColor:dark?"#0B1A2B":"#FFFFFF"}]}><Text style={[s.pickerTitle,{color:dark?"#F5F8FC":"#10253D"}]}>اختيار السورة</Text><ScrollView>{SURAHS.map(item=><Pressable key={item.number} onPress={()=>{setSurahPickerVisible(false);setActiveAyah(1);setHideAyahs(false);setHeardText("");router.replace({pathname:"/recite",params:{surah:String(item.number),ayah:"1",scope:"ayah"}});}} style={[s.pickerItem,{borderBottomColor:dark?"#263D50":"#E6EDF3"}]}><Text style={[s.pickerItemText,{color:dark?"#F5F8FC":"#18334B"}]}>{item.number}. {item.nameAr}</Text><Text style={s.pickerCount}>{item.ayahCount} آية</Text></Pressable>)}</ScrollView><Pressable onPress={()=>setSurahPickerVisible(false)} style={s.closePicker}><Text style={s.closePickerText}>إلغاء</Text></Pressable></View></View></Modal><Modal visible={ayahPickerVisible} animationType="fade" transparent onRequestClose={()=>setAyahPickerVisible(false)}><View style={s.modalShade}><View style={[s.ayahPanel,{backgroundColor:dark?"#0B1A2B":"#FFFFFF"}]}><Text style={[s.pickerTitle,{color:dark?"#F5F8FC":"#10253D"}]}>اختيار آية البداية</Text><ScrollView contentContainerStyle={s.ayahGrid}>{Array.from({length:SURAHS.find(x=>x.number===selectedSurah)?.ayahCount||1},(_,i)=>i+1).map(n=><Pressable key={n} onPress={()=>{setActiveAyah(n);setAyahPickerVisible(false);setHideAyahs(false);setHeardText("");router.replace({pathname:"/recite",params:{surah:String(selectedSurah),ayah:String(n),scope:"ayah"}});}} style={[s.ayahChip,n===activeAyah&&s.ayahChipActive]}><Text style={[s.ayahChipText,n===activeAyah&&s.ayahChipTextActive]}>{n}</Text></Pressable>)}</ScrollView><Pressable onPress={()=>setAyahPickerVisible(false)} style={s.closePicker}><Text style={s.closePickerText}>إلغاء</Text></Pressable></View></View></Modal></View>;
}
function renderAlignedWords(expected:string,heard:string){const expectedWords=expected.split(/\s+/).filter(Boolean);const heardWords=normalizeArabicForCompare(heard).split(" ").filter(Boolean);let cursor=0;return expectedWords.map((word,index)=>{const normalized=normalizeArabicForCompare(word);const pos=heardWords.indexOf(normalized,cursor);const matched=pos>=0;if(matched)cursor=pos+1;return <Text key={index} style={{color:matched?"#18A86B":undefined}}>{word} </Text>;});}
function renderRevealedWords(expected:string,heard:string){const expectedWords=expected.split(/\s+/).filter(Boolean);const heardWords=normalizeArabicForCompare(heard).split(" ").filter(Boolean);let cursor=0;return expectedWords.map((word,index)=>{const normalized=normalizeArabicForCompare(word);const pos=heardWords.indexOf(normalized,cursor);const matched=pos>=0;if(matched)cursor=pos+1;return <Text key={index} style={{color:matched?"#18A86B":"#8CA0B3"}}>{matched?word:"ــــــــــ"} </Text>;});}
const s=StyleSheet.create({root:{flex:1,paddingHorizontal:12,paddingTop:8,paddingBottom:8},minimalHeader:{height:50,flexDirection:"row",alignItems:"center",marginBottom:7},smallAction:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(100,150,180,0.12)"},headerActionText:{fontSize:23,fontWeight:"700"},surahTitle:{fontSize:17,fontWeight:"900",textAlign:"center"},surahMeta:{fontSize:10,marginTop:3,textAlign:"center"},pageFrame:{flex:1,borderWidth:1.5,borderRadius:10,paddingHorizontal:15,paddingVertical:11,justifyContent:"space-between",overflow:"hidden"},pageTopLine:{alignItems:"center",borderBottomWidth:1,borderColor:"#D9C99D",paddingBottom:8,marginBottom:8},pageSurah:{fontSize:12,fontWeight:"800",textAlign:"center"},pageTextArea:{flex:1,overflow:"hidden"},pageTextContent:{flexGrow:1,justifyContent:"center",paddingVertical:8},mushafText:{fontSize:22,lineHeight:43,textAlign:"justify",writingDirection:"rtl",fontWeight:"500"},pageBottomLine:{alignItems:"center",borderTopWidth:1,borderColor:"#D9C99D",paddingTop:7,marginTop:7},pageFooter:{textAlign:"center",fontSize:8},riwayaUnavailable:{color:"#A77A20",fontSize:14,lineHeight:28,textAlign:"right"},focusControls:{paddingTop:7,paddingBottom:3,alignItems:"center",justifyContent:"center"},navigationRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",width:"100%",gap:5,marginBottom:7},navButton:{flex:1,borderRadius:10,paddingVertical:8,paddingHorizontal:4,backgroundColor:"rgba(64,142,168,0.12)",alignItems:"center"},navButtonText:{fontSize:10,fontWeight:"800",color:"#2587A0"},modalShade:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",justifyContent:"center",padding:18},pickerPanel:{maxHeight:"86%",borderRadius:20,padding:16},ayahPanel:{maxHeight:"75%",borderRadius:20,padding:16},pickerTitle:{fontSize:18,fontWeight:"900",textAlign:"center",marginBottom:12},pickerItem:{minHeight:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,paddingHorizontal:6},pickerItemText:{fontSize:15,fontWeight:"700"},pickerCount:{fontSize:11,color:"#8293A4"},closePicker:{alignItems:"center",padding:12,marginTop:6,backgroundColor:"#E5F8FC",borderRadius:12},closePickerText:{fontSize:13,fontWeight:"800",color:"#167B95"},ayahGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"center",gap:8},ayahChip:{width:42,height:42,borderRadius:12,borderWidth:1,borderColor:"#B8CAD7",alignItems:"center",justifyContent:"center"},ayahChipActive:{backgroundColor:"#18B978",borderColor:"#087D61"},ayahChipText:{fontSize:13,fontWeight:"700",color:"#234"},ayahChipTextActive:{color:"#FFFFFF"},hideButton:{alignSelf:"stretch",marginHorizontal:8,marginBottom:9,paddingVertical:10,borderRadius:13,borderWidth:1,borderColor:"#2A7186",alignItems:"center"},hideButtonOn:{backgroundColor:"#D9F8ED",borderColor:"#24B77A"},hideButtonText:{fontSize:12,fontWeight:"800",color:"#35AFC5"},hideButtonTextOn:{color:"#087C56"},bigMic:{width:72,height:72,borderRadius:36,alignItems:"center",justifyContent:"center",backgroundColor:"#18D68A",borderWidth:4,borderColor:"#087D61"},bigMicOn:{backgroundColor:"#FF7777",borderColor:"#A63B46"},bigMicGlyph:{fontSize:28,color:"#FFFFFF"},focusStatus:{fontSize:10,textAlign:"center",marginTop:7},liveTranscript:{fontSize:11,textAlign:"center",marginTop:4,maxWidth:"95%"},analysisStatus:{fontSize:9,color:"#C07C35",textAlign:"center",marginTop:4}});