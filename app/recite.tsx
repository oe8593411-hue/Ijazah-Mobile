import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Audio, RecordingPresets, useAudioRecorder, useAudioRecorderState } from "expo-audio";

const C={navy:"#071A33",navy2:"#102746",cyan:"#22C7D8",soft:"#E4F9FB",ink:"#152A42",muted:"#7B8B9E",surface:"#F7F9FC",white:"#FFFFFF"};

export default function Recite(){
 const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
 const state=useAudioRecorderState(recorder);
 const [message,setMessage]=useState("جاهز للاستماع");
 const [analyzed,setAnalyzed]=useState(false);
 const [mode,setMode]=useState<"live"|"deep">("live");
 async function toggleRecording(){
  try{
   if(state.isRecording){await recorder.stop();setMessage("تم التسجيل — التحليل الآمن جاهز");setAnalyzed(true);return;}
   const permission=await Audio.requestRecordingPermissionsAsync();
   if(!permission.granted){setMessage("يجب السماح بالميكروفون لبدء التلاوة");return;}
   setAnalyzed(false);await recorder.prepareToRecordAsync();recorder.record();setMessage("جاري الاستماع… اقرأ الآية بهدوء");
  }catch{setMessage("تعذر بدء التسجيل. حاول مرة أخرى.");}
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
   <View style={s.surahRow}><View><Text style={s.surah}>سُورَةُ الْفَاتِحَةِ</Text><Text style={s.meta}>الآية ١ • رواية حفص</Text></View><View style={s.badge}><Text style={s.badgeText}>١</Text></View></View>
   <View style={s.ayah}>
    <View style={s.ayahTop}><Text style={s.referenceBadge}>مرجع موثّق</Text><Text style={s.ayahNumber}>١</Text></View>
    <Text style={s.ayahText}>الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ</Text>
    <Text style={s.reference}>النص القرآني ثابت من قاعدة موثّقة ولا يتم توليده بالذكاء الاصطناعي.</Text>
   </View>
   <View style={s.liveCard}>
    <View style={s.liveHeader}><View><Text style={s.liveTitle}>مراقبة التلاوة</Text><Text style={s.liveSub}>{mode==="live"?"مطابقة مباشرة أثناء القراءة":"تحليل متعدد الطبقات بعد التسجيل"}</Text></View><View style={s.pulse}><View style={s.pulseInner}/></View></View>
    <View style={s.wave}>{[10,18,28,16,34,22,40,25,14,31,20,37,16,27,12,24].map((h,i)=><View key={i} style={[s.bar,{height:h}]}/>)}</View>
    <View style={s.metrics}><Metric label="مطابقة الكلمات" value="جاهز"/><Metric label="التجويد" value="جاهز"/><Metric label="الثقة" value="—"/></View>
   </View>
   <Text style={s.sectionTitle}>كيف نحلل التلاوة؟</Text>
   <View style={s.steps}>
    <Step n="١" title="مطابقة القرآن" text="تحديد السورة والآية والكلمات من المرجع الموثق."/>
    <Step n="٢" title="الصوت والنطق" text="فحص الحروف والحركات عندما تتوفر أدلة صوتية كافية."/>
    <Step n="٣" title="التجويد" text="تحليل القواعد من سمات صوتية قابلة للقياس، وليس تخمينًا لغويًا."/>
    <Step n="٤" title="بوابة الثقة" text="النتيجة منخفضة الثقة لا تتحول إلى تصحيح مؤكد."/>
   </View>
   <Pressable style={[s.record,state.isRecording&&s.recording]} onPress={toggleRecording}><Text style={s.recordIcon}>{state.isRecording?"■":"●"}</Text><View><Text style={s.recordTitle}>{state.isRecording?"إيقاف التلاوة":"ابدأ التسميع"}</Text><Text style={s.recordSub}>{state.isRecording?"إجازة تستمع الآن":"اضغط وابدأ القراءة"}</Text></View></Pressable>
   <Text style={s.listening}>{message}</Text>
   {state.isRecording&&<Text style={s.timer}>{Math.floor((state.durationMillis||0)/1000)} ث</Text>}
   {analyzed&&<View style={s.deep}><Text style={s.deepTitle}>🔐 جلسة التحليل الآمنة</Text><Text style={s.deepText}>تم إنهاء التسجيل. في خط أنابيب الإنتاج، يُرفع الصوت عبر صلاحية قصيرة العمر إلى محرك التحليل، ثم تُحفظ نتيجة التحليل فقط افتراضيًا.</Text></View>}
   <View style={s.security}><Text style={s.securityTitle}>🔒 خصوصية التلاوة أولًا</Text><Text style={s.securityText}>الصوت خاص، والوصول إليه مؤقت، ومفاتيح قاعدة البيانات والذكاء الاصطناعي لا توجد داخل التطبيق.</Text></View>
  </ScrollView>
 </View>
}
function Metric({label,value}:{label:string;value:string}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function Step({n,title,text}:{n:string;title:string;text:string}){return <View style={s.step}><View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View><View style={s.stepCopy}><Text style={s.stepTitle}>{title}</Text><Text style={s.stepText}>{text}</Text></View></View>}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.navy},header:{paddingTop:56,paddingHorizontal:18,paddingBottom:18,flexDirection:"row",alignItems:"center"},backButton:{width:42,height:42,alignItems:"center",justifyContent:"center"},back:{color:"white",fontSize:34,lineHeight:36},headerCenter:{flex:1,alignItems:"center"},headerTitle:{color:"white",fontSize:19,fontWeight:"800"},headerSub:{color:"#8EDFE7",fontSize:10,marginTop:3},securePill:{borderWidth:1,borderColor:"#2B6474",borderRadius:14,paddingHorizontal:9,paddingVertical:7,flexDirection:"row",alignItems:"center",gap:4},secureDot:{color:C.cyan,fontSize:8},secureText:{color:"#B8F1F4",fontSize:10,fontWeight:"800"},body:{flex:1,backgroundColor:C.surface,borderTopLeftRadius:30,borderTopRightRadius:30},content:{padding:22,paddingBottom:40},modeRow:{flexDirection:"row",backgroundColor:"#E9EEF4",borderRadius:15,padding:4,marginBottom:18},mode:{flex:1,paddingVertical:9,alignItems:"center",borderRadius:11},modeActive:{backgroundColor:C.white},modeText:{color:C.muted,fontSize:11,fontWeight:"700"},modeTextActive:{color:C.navy},surahRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},surah:{color:C.navy,fontSize:20,fontWeight:"800"},meta:{color:"#8391A3",marginTop:5,fontSize:12},badge:{width:38,height:38,borderRadius:19,backgroundColor:"#DDF7FA",alignItems:"center",justifyContent:"center"},badgeText:{color:"#087E8B",fontWeight:"900",fontSize:16},ayah:{backgroundColor:C.white,borderRadius:24,padding:21,marginTop:18},ayahTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},referenceBadge:{backgroundColor:C.soft,color:"#087E8B",paddingHorizontal:9,paddingVertical:5,borderRadius:9,fontSize:9,fontWeight:"800"},ayahNumber:{color:"#9AA8B7",fontSize:12},ayahText:{textAlign:"right",fontSize:25,lineHeight:48,color:C.ink,fontWeight:"500",marginTop:8},reference:{marginTop:12,color:"#8291A2",fontSize:10,textAlign:"center",lineHeight:16},liveCard:{backgroundColor:C.navy,borderRadius:24,padding:18,marginTop:16},liveHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},liveTitle:{color:C.white,fontSize:15,fontWeight:"800"},liveSub:{color:"#8FA4B9",fontSize:9,marginTop:4},pulse:{width:30,height:30,borderRadius:15,backgroundColor:"#153554",alignItems:"center",justifyContent:"center"},pulseInner:{width:10,height:10,borderRadius:5,backgroundColor:C.cyan},wave:{height:54,marginTop:18,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5},bar:{width:4,borderRadius:3,backgroundColor:"#5BD7E1",opacity:0.8},metrics:{flexDirection:"row",gap:8,marginTop:10},metric:{flex:1,backgroundColor:C.navy2,borderRadius:15,padding:10,alignItems:"center"},metricValue:{color:"#8EDFE7",fontSize:12,fontWeight:"800"},metricLabel:{color:"#A9B8C9",fontSize:9,textAlign:"center",marginTop:5},sectionTitle:{color:C.navy,fontSize:17,fontWeight:"800",marginTop:22,marginBottom:10},steps:{backgroundColor:C.white,borderRadius:22,padding:15},step:{flexDirection:"row",alignItems:"center",marginVertical:7},stepNum:{width:32,height:32,borderRadius:16,backgroundColor:C.soft,alignItems:"center",justifyContent:"center"},stepNumText:{color:"#087E8B",fontWeight:"900"},stepCopy:{flex:1,marginLeft:11},stepTitle:{color:C.ink,fontWeight:"800",fontSize:13},stepText:{color:C.muted,fontSize:10,marginTop:2,lineHeight:16},record:{marginTop:18,backgroundColor:C.cyan,borderRadius:20,padding:15,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:13},recording:{backgroundColor:"#FF8A8A"},recordIcon:{fontSize:25,color:C.navy},recordTitle:{color:C.navy,fontWeight:"900",fontSize:15},recordSub:{color:"#174C59",fontSize:10,marginTop:2},listening:{textAlign:"center",fontWeight:"800",color:C.navy,marginTop:12},timer:{textAlign:"center",color:"#0B9AAA",marginTop:4},deep:{backgroundColor:"#E9F8FA",borderRadius:20,padding:17,marginTop:17,borderWidth:1,borderColor:"#B9EDF1"},deepTitle:{color:"#087E8B",fontWeight:"900",fontSize:14},deepText:{color:"#496476",fontSize:11,lineHeight:19,marginTop:7},security:{backgroundColor:"#EEF2F6",borderRadius:18,padding:15,marginTop:16},securityTitle:{color:C.navy,fontWeight:"900",fontSize:12},securityText:{color:"#66798C",fontSize:10,lineHeight:17,marginTop:5}
});