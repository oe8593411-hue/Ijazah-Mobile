import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";

const C={navy:"#071A33",navy2:"#102746",cyan:"#22C7D8",soft:"#E4F9FB",ink:"#152A42",muted:"#7B8B9E",surface:"#F7F9FC",white:"#FFFFFF"};

export default function Recite(){
 const params=useLocalSearchParams<{surah?:string;ayah?:string}>();
 const selectedSurah=Math.max(1,Math.min(114,Number(params.surah)||1));
 const selectedAyah=Math.max(1,Number(params.ayah)||1);
 const [referenceText,setReferenceText]=useState("جاري تحميل الآية الموثقة…");
 const [referenceLabel,setReferenceLabel]=useState("الآية");
 const [riwaya,setRiwaya]=useState("حفص عن عاصم");
 const riwayat=["حفص عن عاصم","شعبة عن عاصم","ورش عن نافع","قالون عن نافع","البزي عن ابن كثير","قنبل عن ابن كثير","الدوري عن أبي عمرو","السوسي عن أبي عمرو","هشام عن ابن عامر","ابن ذكوان عن ابن عامر","خلف عن حمزة","خلاد عن حمزة","أبو الحارث عن الكسائي","الدوري عن الكسائي","رويس عن يعقوب","روح عن يعقوب","إسحاق عن خلف العاشر","إدريس عن خلف العاشر","عبيد بن الصباح عن أبي جعفر","ابن وردان عن أبي جعفر"];

 useEffect(()=>{ import("../src/quran/verified-corpus.json").then((m)=>{
   const corpus=m.default as {ayahs:{surah:number;ayah:number;text:string}[]};
   const hit=corpus.ayahs.find(x=>x.surah===selectedSurah&&x.ayah===selectedAyah);
   if(hit){setReferenceText(hit.text);setReferenceLabel(`الآية ${hit.ayah}`);}
 }).catch(()=>setReferenceText("سيظهر النص بعد تجهيز نسخة المصحف داخل التطبيق.")); });
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
    setMessage("تم حفظ التسجيل مؤقتًا على الجهاز. محرك التحليل غير متصل؛ لن نعرض تصحيحًا أو درجة وهمية.");
    return;
   }
   const permission=await requestRecordingPermissionsAsync();
   if(!permission.granted){setMessage("يجب السماح بالميكروفون لبدء التلاوة");return;}
   setRecorded(false);
   setHeardText("");
   startLiveWords();
   await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
   await recorder.prepareToRecordAsync();
   recorder.record();
   setSessionStatus("recording");
   setMessage("جاري الاستماع… اقرأ الآية بهدوء");
  }catch(error){
   console.error("Ijazah recording error:",error);
   const detail=error instanceof Error?error.message:String(error??"خطأ غير معروف");
   setSessionStatus("idle");
   setMessage(`تعذر بدء التسجيل (${detail}). تأكد من إذن الميكروفون ثم أعد المحاولة.`);
  }
 }

 return <View style={s.root}>
  <StatusBar style="light"/>
  <View style={s.header}>
   <Pressable onPress={()=>router.back()} style={s.backButton}><Text style={s.back}>‹</Text></Pressable>
   <View style={s.headerCenter}><Text style={s.headerTitle}>التسميع</Text><Text style={s.headerSub}>محرك إجازة للتلاوة والتجويد</Text></View>
   <View style={s.securePill}><Text style={s.secureDot}>●</Text><Text style={s.secureText}>آمن</Text></View>
  </View>
  <ScrollView style={s.body} contentContainerStyle={s.content}>
   <View style={s.modeRow}>
    <Pressable onPress={()=>setMode("deep")} style={[s.mode,mode==="deep"&&s.modeActive]}><Text style={[s.modeText,mode==="deep"&&s.modeTextActive]}>تحليل عميق</Text></Pressable>
    <Pressable onPress={()=>setMode("live")} style={[s.mode,mode==="live"&&s.modeActive]}><Text style={[s.modeText,mode==="live"&&s.modeTextActive]}>مباشر</Text></Pressable>
   </View>

   <View style={s.surahRow}><View><Text style={s.surah}>موضع التسميع</Text><Text style={s.meta}>{`سورة رقم ${selectedSurah} • ${referenceLabel} • ${riwaya}`}</Text></View><View style={s.badge}><Text style={s.badgeText}>{selectedSurah}</Text></View></View>

   <Text style={s.riwayaTitle}>اختر الرواية من القراءات العشر</Text>
   <View style={s.riwayaList}>{riwayat.map((item)=><Pressable key={item} onPress={()=>setRiwaya(item)} style={[s.riwayaChip,riwaya===item&&s.riwayaChipActive]}><Text style={[s.riwayaChipText,riwaya===item&&s.riwayaChipTextActive]}>{item}</Text></Pressable>)}</View>

   <View style={s.mushafToolbar}>
    <View><Text style={s.mushafToolbarTitle}>المصحف أثناء التسميع</Text><Text style={s.mushafToolbarSub}>النص الموثّق — سورة {selectedSurah}</Text></View>
    <Pressable onPress={()=>setMushafVisible(v=>!v)} style={s.hideButton}><Text style={s.hideButtonText}>{mushafVisible?"إخفاء المصحف":"إظهار المصحف"}</Text></Pressable>
   </View>
   {mushafVisible&&<View style={s.ayah}>
    <View style={s.ayahTop}><Text style={s.referenceBadge}>مرجع موثّق</Text><Text style={s.ayahNumber}>{referenceLabel}</Text></View>
    {riwaya==="حفص عن عاصم"?<Text style={s.ayahText}>{referenceText}</Text>:<Text style={s.riwayaUnavailable}>لم نضف بعدُ قاعدة المصحف المحققة لهذه الرواية. لن نعرض نص حفص على أنه نص رواية أخرى، ولن نحلل التلاوة بهذه الرواية قبل توثيق نصها وقواعدها.</Text>}
    <Text style={s.reference}>{riwaya==="حفص عن عاصم"?"النص القرآني ثابت من قاعدة موثّقة ولا يتم توليده بالذكاء الاصطناعي.":"اختيار الرواية متاح للمعاينة، لكن التلاوة والتحليل الفعليين لهذه الرواية غير مفعّلين حتى إضافة مرجع موثوق."}</Text>
   </View>}
   <View style={s.liveWordsCard}>
    <Text style={s.liveWordsTitle}>{mushafVisible?"الكلمات التي يلتقطها الميكروفون":"التسميع دون عرض المصحف"}</Text>
    <Text style={s.liveWordsNote}>{speechMessage}</Text>
    {heardText.length>0?<Text style={s.heardText}>{heardText}</Text>:<Text style={s.heardPlaceholder}>{state.isRecording?"بانتظار التعرّف على الكلمات…":"ابدأ التسميع لتظهر الكلمات هنا إذا كان المتصفح يدعم التعرّف الصوتي."}</Text>}
   </View>

   <View style={s.liveCard}>
    <View style={s.liveHeader}><View><Text style={s.liveTitle}>مراقبة التلاوة</Text><Text style={s.liveSub}>{mode==="live"?"وضع مباشر — التسجيل الفعلي":"وضع التحليل العميق — بانتظار المحرك"}</Text></View><View style={s.pulse}><View style={s.pulseInner}/></View></View>
    <View style={s.wave}>{[10,18,28,16,34,22,40,25,14,31,20,37,16,27,12,24].map((h,i)=><View key={i} style={[s.bar,{height:h}]}/>)}</View>
    <View style={s.metrics}>
      <Metric label="التسجيل" value={state.isRecording?"يعمل":"جاهز"}/>
      <Metric label="التحليل الصوتي" value="غير متصل"/>
      <Metric label="الجلسة" value={sessionStatus==="recording"?"تسجيل":sessionStatus==="recorded"?"جاهزة":"—"}/>
      <Metric label="النتيجة" value="—"/>
    </View>
   </View>

   <View style={s.truth}><Text style={s.truthTitle}>⚠️ دقة قبل كل شيء</Text><Text style={s.truthText}>لن يعرض التطبيق تصحيحًا للكلمات أو التجويد قبل وصول التسجيل إلى محرك التحليل الحقيقي واجتياز بوابة الثقة. لا توجد نتائج وهمية.</Text></View>

   <Text style={s.sectionTitle}>خط أنابيب التحليل</Text>
   <View style={s.steps}>
    <Step n="١" title="مطابقة القرآن" text="تحديد السورة والآية والكلمات من المرجع الموثق."/>
    <Step n="٢" title="الصوت والنطق" text="فحص الحروف والحركات من الدليل الصوتي الفعلي."/>
    <Step n="٣" title="التجويد" text="تحليل القواعد من سمات صوتية قابلة للقياس."/>
    <Step n="٤" title="بوابة الثقة" text="النتيجة منخفضة الثقة لا تتحول إلى تصحيح مؤكد."/>
   </View>

   <Pressable style={[s.record,state.isRecording&&s.recording]} onPress={toggleRecording}>
    <Text style={s.recordIcon}>{state.isRecording?"■":"●"}</Text>
    <View><Text style={s.recordTitle}>{state.isRecording?"إيقاف التلاوة":"ابدأ التسميع"}</Text><Text style={s.recordSub}>{state.isRecording?"إجازة تستمع الآن":"تسجيل حقيقي من ميكروفون الجهاز"}</Text></View>
   </Pressable>

   <Text style={s.listening}>{message}</Text>
   {state.isRecording&&<Text style={s.timer}>{Math.floor((state.durationMillis||0)/1000)} ث</Text>}

   {recorded&&<View style={s.pending}><Text style={s.pendingTitle}>🎙️ التسجيل تم فعليًا</Text><Text style={s.pendingText}>التسجيل موجود محليًا. لن نسميه "تحليلًا" ولن نخترع نتيجة. الخطوة التالية هي رفعه بأمان إلى خادم التحليل بعد تفعيل المصادقة ومحرك الصوت.</Text></View>}

   <View style={s.security}><Text style={s.securityTitle}>🔒 الأمان أولًا</Text><Text style={s.securityText}>لا توجد مفاتيح قاعدة البيانات أو مزود الذكاء الاصطناعي داخل التطبيق. التخزين الإنتاجي للتسجيلات سيكون خاصًا وبصلاحيات قصيرة العمر.</Text></View>
  </ScrollView>
 </View>
}

function Metric({label,value}:{label:string;value:string}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function Step({n,title,text}:{n:string;title:string;text:string}){return <View style={s.step}><View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View><View style={s.stepCopy}><Text style={s.stepTitle}>{title}</Text><Text style={s.stepText}>{text}</Text></View></View>}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.navy},header:{paddingTop:56,paddingHorizontal:18,paddingBottom:18,flexDirection:"row",alignItems:"center"},backButton:{width:42,height:42,alignItems:"center",justifyContent:"center"},back:{color:"white",fontSize:34,lineHeight:36},headerCenter:{flex:1,alignItems:"center"},headerTitle:{color:"white",fontSize:19,fontWeight:"800"},headerSub:{color:"#8EDFE7",fontSize:10,marginTop:3},securePill:{borderWidth:1,borderColor:"#2B6474",borderRadius:14,paddingHorizontal:9,paddingVertical:7,flexDirection:"row",alignItems:"center",gap:4},secureDot:{color:C.cyan,fontSize:8},secureText:{color:"#B8F1F4",fontSize:10,fontWeight:"800"},body:{flex:1,backgroundColor:C.surface,borderTopLeftRadius:30,borderTopRightRadius:30},content:{padding:22,paddingBottom:40},modeRow:{flexDirection:"row",backgroundColor:"#E9EEF4",borderRadius:15,padding:4,marginBottom:18},riwayaTitle:{color:C.navy,fontSize:14,fontWeight:"900",marginTop:18,marginBottom:9,textAlign:"right"},riwayaList:{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:4},riwayaChip:{backgroundColor:C.white,borderRadius:12,paddingHorizontal:10,paddingVertical:9,borderWidth:1,borderColor:"#E4EAF0"},riwayaChipActive:{backgroundColor:C.soft,borderColor:C.cyan},riwayaChipText:{fontSize:10,color:C.muted,fontWeight:"700"},riwayaChipTextActive:{color:"#087E8B",fontWeight:"900"},riwayaUnavailable:{textAlign:"right",fontSize:15,lineHeight:28,color:"#8A6514",fontWeight:"700",marginTop:12},mode:{flex:1,paddingVertical:9,alignItems:"center",borderRadius:11},modeActive:{backgroundColor:C.white},modeText:{color:C.muted,fontSize:11,fontWeight:"700"},modeTextActive:{color:C.navy},surahRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},surah:{color:C.navy,fontSize:20,fontWeight:"800"},meta:{color:"#8391A3",marginTop:5,fontSize:12},badge:{width:38,height:38,borderRadius:19,backgroundColor:"#DDF7FA",alignItems:"center",justifyContent:"center"},badgeText:{color:"#087E8B",fontWeight:"900",fontSize:16},ayah:{backgroundColor:C.white,borderRadius:24,padding:21,marginTop:18},ayahTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},referenceBadge:{backgroundColor:C.soft,color:"#087E8B",paddingHorizontal:9,paddingVertical:5,borderRadius:9,fontSize:9,fontWeight:"800"},ayahNumber:{color:"#9AA8B7",fontSize:12},ayahText:{textAlign:"right",fontSize:25,lineHeight:48,color:C.ink,fontWeight:"500",marginTop:8},reference:{marginTop:12,color:"#8291A2",fontSize:10,textAlign:"center",lineHeight:16},liveCard:{backgroundColor:C.navy,borderRadius:24,padding:18,marginTop:16},liveHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},liveTitle:{color:C.white,fontSize:15,fontWeight:"800"},liveSub:{color:"#8FA4B9",fontSize:9,marginTop:4},pulse:{width:30,height:30,borderRadius:15,backgroundColor:"#153554",alignItems:"center",justifyContent:"center"},pulseInner:{width:10,height:10,borderRadius:5,backgroundColor:C.cyan},wave:{height:54,marginTop:18,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5},bar:{width:4,borderRadius:3,backgroundColor:"#5BD7E1",opacity:0.8},metrics:{flexDirection:"row",gap:8,marginTop:10},metric:{flex:1,backgroundColor:C.navy2,borderRadius:15,padding:10,alignItems:"center"},metricValue:{color:"#8EDFE7",fontSize:11,fontWeight:"800"},metricLabel:{color:"#A9B8C9",fontSize:9,textAlign:"center",marginTop:5},truth:{backgroundColor:"#FFF8E6",borderRadius:18,padding:15,marginTop:16,borderWidth:1,borderColor:"#F4DFA4"},truthTitle:{color:"#8A6514",fontWeight:"900",fontSize:12},truthText:{color:"#766341",fontSize:10,lineHeight:17,marginTop:5},sectionTitle:{color:C.navy,fontSize:17,fontWeight:"800",marginTop:22,marginBottom:10},steps:{backgroundColor:C.white,borderRadius:22,padding:15},step:{flexDirection:"row",alignItems:"center",marginVertical:7},stepNum:{width:32,height:32,borderRadius:16,backgroundColor:C.soft,alignItems:"center",justifyContent:"center"},stepNumText:{color:"#087E8B",fontWeight:"900"},stepCopy:{flex:1,marginLeft:11},stepTitle:{color:C.ink,fontWeight:"800",fontSize:13},stepText:{color:C.muted,fontSize:10,marginTop:2,lineHeight:16},record:{marginTop:18,backgroundColor:C.cyan,borderRadius:20,padding:15,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:13},recording:{backgroundColor:"#FF8A8A"},recordIcon:{fontSize:25,color:C.navy},recordTitle:{color:C.navy,fontWeight:"900",fontSize:15},recordSub:{color:"#174C59",fontSize:10,marginTop:2},listening:{textAlign:"center",fontWeight:"800",color:C.navy,marginTop:12},timer:{textAlign:"center",color:"#0B9AAA",marginTop:4},pending:{backgroundColor:"#E9F8FA",borderRadius:20,padding:17,marginTop:17,borderWidth:1,borderColor:"#B9EDF1"},pendingTitle:{color:"#087E8B",fontWeight:"900",fontSize:14},pendingText:{color:"#496476",fontSize:11,lineHeight:19,marginTop:7},security:{backgroundColor:"#EEF2F6",borderRadius:18,padding:15,marginTop:16},securityTitle:{color:C.navy,fontWeight:"900",fontSize:12},securityText:{color:"#66798C",fontSize:10,lineHeight:17,marginTop:5}
});