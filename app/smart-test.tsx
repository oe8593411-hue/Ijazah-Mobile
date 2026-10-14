import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

const C = { navy:"#071A33", cyan:"#35C7DE", bg:"#F4F8FC", ink:"#142A43", muted:"#788BA0", white:"#FFFFFF" };

type Preset={label:string;startSurah:number;startAyah:number;endSurah:number;endAyah:number;description:string};

const presets:Preset[]=[
 {label:"آيات محددة",startSurah:1,startAyah:1,endSurah:1,endAyah:7,description:"الفاتحة 1:1 → 1:7"},
 {label:"سورة كاملة",startSurah:1,startAyah:1,endSurah:1,endAyah:7,description:"سورة الفاتحة كاملة"},
 {label:"عدة سور",startSurah:1,startAyah:1,endSurah:3,endAyah:92,description:"من الفاتحة حتى آل عمران"},
 {label:"جزء كامل",startSurah:1,startAyah:1,endSurah:2,endAyah:141,description:"الجزء الأول"},
 {label:"عدة أجزاء",startSurah:1,startAyah:1,endSurah:5,endAyah:81,description:"نطاق موسع حتى المائدة 81"},
];

const difficulties = ["سهل","متوسط","صعب"];

export default function SmartTest(){
 const [range,setRange]=useState(0);
 const [difficulty,setDifficulty]=useState("متوسط");
 const [count,setCount]=useState(10);
 const selected=presets[range];

 return <View style={s.root}>
  <StatusBar style="light"/>
  <View style={s.header}>
   <Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable>
   <View style={{flex:1,alignItems:"center"}}><Text style={s.title}>الاختبار الذكي</Text><Text style={s.sub}>Premium • اختبار الحفظ التكيفي</Text></View>
   <View style={s.premium}><Text style={s.premiumText}>PREMIUM</Text></View>
  </View>
  <ScrollView style={s.body} contentContainerStyle={s.content}>
   <View style={s.hero}>
    <Text style={s.heroIcon}>🧠</Text><Text style={s.heroTitle}>اختبار يعرف أين تحتاج المراجعة</Text>
    <Text style={s.heroText}>النطاق الذي تختاره هنا يُرسل فعليًا إلى جلسة الاختبار، والأسئلة تُختار من القرآن الموثق فقط.</Text>
   </View>
   <Text style={s.section}>النطاق</Text>
   <View style={s.chips}>{presets.map((x,i)=><Pressable key={x.label} onPress={()=>setRange(i)} style={[s.chip,range===i&&s.chipActive]}><Text style={[s.chipText,range===i&&s.chipTextActive]}>{x.label}</Text></Pressable>)}</View>
   <View style={s.card}>
    <Text style={s.cardTitle}>النطاق المختار</Text>
    <View style={s.rangeRow}><Box value={`${selected.startSurah}:${selected.startAyah}`} label="البداية"/><Text style={s.arrow}>→</Text><Box value={`${selected.endSurah}:${selected.endAyah}`} label="النهاية"/></View>
    <Text style={s.selectedText}>{selected.description}</Text>
    <Text style={s.hint}>الأسئلة خارج هذا النطاق لن تدخل الجلسة.</Text>
   </View>
   <Text style={s.section}>مستوى الصعوبة</Text>
   <View style={s.segment}>{difficulties.map(x=><Pressable key={x} onPress={()=>setDifficulty(x)} style={[s.segmentItem,difficulty===x&&s.segmentActive]}><Text style={[s.segmentText,difficulty===x&&s.segmentTextActive]}>{x}</Text></Pressable>)}</View>
   <View style={s.card}>
    <View style={s.countRow}><View><Text style={s.cardTitle}>عدد الأسئلة</Text><Text style={s.hint}>الاختبار يتكيف أثناء الجلسة</Text></View><Text style={s.count}>{count}</Text></View>
    <View style={s.countButtons}><Pressable onPress={()=>setCount(Math.max(5,count-5))} style={s.countBtn}><Text style={s.countBtnText}>−</Text></Pressable><Pressable onPress={()=>setCount(Math.min(30,count+5))} style={s.countBtn}><Text style={s.countBtnText}>+</Text></Pressable></View>
   </View>
   <Text style={s.section}>أنواع الأسئلة</Text>
   {[
    ["▶","أكمل من بداية الآية"],["↗","أكمل الآيتين التاليتين"],["✦","ابدأ من موضع عشوائي"]
   ].map(([icon,label],i)=><View key={i} style={s.question}><View style={s.qIcon}><Text>{icon}</Text></View><View style={{flex:1}}><Text style={s.qTitle}>{label}</Text><Text style={s.qText}>لا تظهر الإجابة أثناء الاختبار، ولا تُحتسب نقطة ضعف دون تحليل موثوق.</Text></View></View>)}
   <View style={s.truth}><Text style={s.truthTitle}>🔐 قاعدة الدقة</Text><Text style={s.truthText}>لن تُسجَّل نقطة ضعف بسبب نتيجة غير مؤكدة. المرجع هو المصحف الموثق، وليس نصًا مولدًا بالذكاء الاصطناعي.</Text></View>
   <Pressable style={s.start} onPress={()=>router.push({pathname:"/smart-test-session",params:{count:String(count),difficulty, startSurah:String(selected.startSurah),startAyah:String(selected.startAyah),endSurah:String(selected.endSurah),endAyah:String(selected.endAyah)}})}>
    <Text style={s.startText}>ابدأ الاختبار</Text><Text style={s.startSub}>سيتم تجهيز الأسئلة داخل النطاق المحدد</Text>
   </Pressable>
  </ScrollView>
 </View>
}
function Box({value,label}:{value:string;label:string}){return <View style={s.box}><Text style={s.boxLabel}>{label}</Text><Text style={s.boxValue}>{value}</Text></View>}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.navy},header:{paddingTop:56,paddingHorizontal:18,paddingBottom:18,flexDirection:"row",alignItems:"center"},back:{color:C.white,fontSize:34},title:{color:C.white,fontSize:19,fontWeight:"900"},sub:{color:"#8EDFE7",fontSize:10,marginTop:3},premium:{borderRadius:9,borderWidth:1,borderColor:"#2B6474",paddingHorizontal:7,paddingVertical:5},premiumText:{color:"#B8F1F4",fontSize:8,fontWeight:"900"},body:{backgroundColor:C.bg,borderTopLeftRadius:30,borderTopRightRadius:30},content:{padding:20,paddingBottom:45},hero:{backgroundColor:C.navy,borderRadius:24,padding:20},heroIcon:{fontSize:28},heroTitle:{color:C.white,fontSize:19,fontWeight:"900",marginTop:10,textAlign:"right"},heroText:{color:"#B5C7D8",fontSize:11,lineHeight:18,marginTop:7,textAlign:"right"},section:{color:C.navy,fontSize:16,fontWeight:"900",marginTop:22,marginBottom:10,textAlign:"right"},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{backgroundColor:C.white,borderRadius:14,paddingHorizontal:13,paddingVertical:10},chipActive:{backgroundColor:"#DDF7FA",borderWidth:1,borderColor:C.cyan},chipText:{color:C.muted,fontSize:11,fontWeight:"700"},chipTextActive:{color:"#168DA5"},card:{backgroundColor:C.white,borderRadius:20,padding:17,marginTop:14},cardTitle:{color:C.ink,fontSize:14,fontWeight:"900"},rangeRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:13},box:{backgroundColor:"#F2F5F8",borderRadius:14,padding:12,width:"40%"},boxLabel:{color:C.muted,fontSize:9},boxValue:{color:C.navy,fontSize:18,fontWeight:"900",marginTop:3},arrow:{color:C.cyan,fontSize:20,fontWeight:"900"},selectedText:{color:C.ink,fontSize:11,fontWeight:"800",textAlign:"right",marginTop:10},hint:{color:C.muted,fontSize:9,lineHeight:16,marginTop:8},segment:{flexDirection:"row",backgroundColor:"#E8EDF2",padding:4,borderRadius:15},segmentItem:{flex:1,paddingVertical:10,alignItems:"center",borderRadius:11},segmentActive:{backgroundColor:C.white},segmentText:{color:C.muted,fontSize:11,fontWeight:"700"},segmentTextActive:{color:C.navy},countRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},count:{fontSize:27,fontWeight:"900",color:C.cyan},countButtons:{flexDirection:"row",gap:8,marginTop:12},countBtn:{width:38,height:34,borderRadius:10,backgroundColor:"#E5F8FC",alignItems:"center",justifyContent:"center"},countBtnText:{fontSize:20,color:"#168DA5"},question:{backgroundColor:C.white,borderRadius:18,padding:13,flexDirection:"row",alignItems:"center",marginBottom:8},qIcon:{width:38,height:38,borderRadius:12,backgroundColor:"#E5F8FC",alignItems:"center",justifyContent:"center",marginRight:12},qTitle:{color:C.ink,fontSize:12,fontWeight:"900"},qText:{color:C.muted,fontSize:9,marginTop:3,lineHeight:15},truth:{backgroundColor:"#FFF8E6",borderRadius:18,padding:15,marginTop:14,borderWidth:1,borderColor:"#F4DFA4"},truthTitle:{color:"#8A6514",fontSize:12,fontWeight:"900"},truthText:{color:"#766341",fontSize:10,lineHeight:17,marginTop:5},start:{backgroundColor:C.cyan,borderRadius:19,padding:16,alignItems:"center",marginTop:18},startText:{color:C.navy,fontSize:16,fontWeight:"900"},startSub:{color:"#174C59",fontSize:9,marginTop:3}
});