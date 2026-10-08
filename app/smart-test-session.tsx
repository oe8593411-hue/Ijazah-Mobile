import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { buildSmartTest, SmartTestQuestion } from "../src/memory/test";

type Ayah={surah:number;ayah:number;text:string};
type Corpus={ayahs:Ayah[]};

export default function SmartTestSession(){
 const params=useLocalSearchParams<{count?:string;difficulty?:string}>();
 const count=Math.max(5,Math.min(30,Number(params.count)||10));
 const difficulty=(params.difficulty==="سهل"?"easy":params.difficulty==="صعب"?"hard":"medium") as "easy"|"medium"|"hard";
 const [corpus,setCorpus]=useState<Corpus|null>(null);
 const [index,setIndex]=useState(0);
 const [started,setStarted]=useState(false);
 const [done,setDone]=useState(false);

 useEffect(()=>{import("../src/quran/verified-corpus.json").then(m=>setCorpus(m.default as Corpus));},[]);

 const questions=useMemo<SmartTestQuestion[]>(()=>{
   if(!corpus) return [];
   const candidates=corpus.ayahs.map(a=>({surah:a.surah,ayah:a.ayah,wordCount:a.text.trim().split(/\s+/).length}));
   return buildSmartTest(candidates,count,difficulty);
 },[corpus,count,difficulty]);

 const q=questions[index];
 const ayah=corpus?.ayahs.find(a=>a.surah===q?.surah&&a.ayah===q?.ayah);

 function next(){
   if(index+1>=questions.length){setDone(true);return;}
   setIndex(x=>x+1);
 }
 if(!corpus) return <View style={s.root}><Text style={s.loading}>جاري تجهيز الاختبار من المصحف الموثق…</Text></View>;
 if(done) return <View style={s.root}><StatusBar style="light"/><View style={s.done}><Text style={s.doneIcon}>🏆</Text><Text style={s.doneTitle}>انتهى الاختبار</Text><Text style={s.doneText}>تمت مراجعة {questions.length} مواضع. لم يتم احتساب أي ضعف صوتي؛ لأن محرك التحليل الحقيقي لم يُوصل بعد.</Text><Pressable style={s.primary} onPress={()=>router.replace("/smart-test")}><Text style={s.primaryText}>اختبار جديد</Text></Pressable></View></View>;

 return <View style={s.root}>
  <StatusBar style="light"/>
  <View style={s.header}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable><View style={{flex:1,alignItems:"center"}}><Text style={s.title}>الاختبار الذكي</Text><Text style={s.meta}>سؤال {index+1} من {questions.length}</Text></View><Text style={s.counter}>{Math.round(((index+1)/questions.length)*100)}%</Text></View>
  <ScrollView style={s.body} contentContainerStyle={s.content}>
   <View style={s.progress}><View style={[s.progressFill,{width:`${((index+1)/questions.length)*100}%`} as any]}/></View>
   <View style={s.card}>
    <Text style={s.type}>{q?.type==="continue"?"أكمل من موضع الضعف":"سؤال حفظ عشوائي"}</Text>
    <Text style={s.location}>سورة {q?.surah} • الآية {q?.ayah}</Text>
    <Text style={s.prompt}>{q?.type==="random_start"?"ابدأ من موضع عشوائي وأكمل بثبات":"اقرأ الموضع من حفظك دون إظهار النص."}</Text>
    <View style={s.hidden}><Text style={s.hiddenTitle}>🔐 النص المرجعي محفوظ داخليًا</Text><Text style={s.hiddenText}>لن نعرض الإجابة أثناء السؤال.</Text></View>
   </View>
   <View style={s.recordCard}>
    <Text style={s.mic}>🎙️</Text><Text style={s.recordTitle}>جاهز للتسميع</Text><Text style={s.recordText}>سيتم ربط هذه الخطوة بمحرك التلاوة الحقيقي، ثم تُحتسب النتيجة فقط عند وجود ثقة كافية.</Text>
    <Pressable style={s.secondary} onPress={()=>router.push({pathname:"/recite",params:{surah:String(q?.surah),ayah:String(q?.ayah)}})}><Text style={s.secondaryText}>🎙️ افتح التسميع</Text></Pressable>
   </View>
   {started && <View style={s.note}><Text style={s.noteText}>تم تسجيل إجابة الجلسة كـ«محاولة» فقط. لا توجد نتيجة وهمية.</Text></View>}
   <Pressable style={s.primary} onPress={()=>{setStarted(true);next();}}><Text style={s.primaryText}>{index+1===questions.length?"إنهاء الاختبار":"التالي"}</Text></Pressable>
  </ScrollView>
 </View>
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:"#071A33"},header:{paddingTop:56,paddingHorizontal:18,paddingBottom:18,flexDirection:"row",alignItems:"center"},back:{color:"#fff",fontSize:34},title:{color:"#fff",fontSize:18,fontWeight:"900"},meta:{color:"#8EDFE7",fontSize:10,marginTop:3},counter:{color:"#B8F1F4",fontWeight:"900",fontSize:11},body:{backgroundColor:"#F6F8FB",borderTopLeftRadius:30,borderTopRightRadius:30},content:{padding:20,paddingBottom:45},progress:{height:7,backgroundColor:"#E0E7ED",borderRadius:7,overflow:"hidden"},progressFill:{height:7,backgroundColor:"#22C7D8",borderRadius:7},card:{backgroundColor:"#fff",borderRadius:24,padding:20,marginTop:16},type:{color:"#087E8B",fontSize:11,fontWeight:"900",textAlign:"right"},location:{color:"#071A33",fontSize:14,fontWeight:"900",textAlign:"right",marginTop:7},prompt:{color:"#152A42",fontSize:21,fontWeight:"900",lineHeight:32,textAlign:"right",marginTop:20},hidden:{backgroundColor:"#F1FCFD",borderRadius:16,padding:13,marginTop:20},hiddenTitle:{color:"#087E8B",fontSize:11,fontWeight:"900",textAlign:"right"},hiddenText:{color:"#6F8795",fontSize:10,textAlign:"right",marginTop:4},recordCard:{backgroundColor:"#fff",borderRadius:24,padding:20,marginTop:12,alignItems:"center"},mic:{fontSize:34},recordTitle:{color:"#071A33",fontSize:17,fontWeight:"900",marginTop:8},recordText:{color:"#7B8B9E",fontSize:10,lineHeight:17,textAlign:"center",marginTop:6},secondary:{marginTop:15,borderRadius:15,backgroundColor:"#E9F8FA",paddingVertical:13,paddingHorizontal:22},secondaryText:{color:"#087E8B",fontWeight:"900"},primary:{backgroundColor:"#22C7D8",borderRadius:18,padding:16,alignItems:"center",marginTop:16},primaryText:{color:"#071A33",fontSize:15,fontWeight:"900"},note:{backgroundColor:"#FFF8E6",borderRadius:15,padding:12,marginTop:12},noteText:{color:"#766341",fontSize:10,textAlign:"center"},loading:{color:"#fff",textAlign:"center",marginTop:160,fontSize:14},done:{flex:1,alignItems:"center",justifyContent:"center",padding:28},doneIcon:{fontSize:54},doneTitle:{color:"#fff",fontSize:25,fontWeight:"900",marginTop:15},doneText:{color:"#B5C7D8",fontSize:12,lineHeight:20,textAlign:"center",marginTop:10},});
