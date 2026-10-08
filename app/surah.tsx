import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SURAHS } from "../src/quran/surahs";

const C={navy:"#071A33",cyan:"#22C7D8",bg:"#F6F8FB",ink:"#152A42",muted:"#7B8B9E",white:"#FFFFFF"};

type Ayah={surah:number;ayah:number;text:string};
type Corpus={source:string;edition:string;riwayah:string;script:string;version:string;sha256:string;ayahs:Ayah[]};

export default function SurahScreen(){
 const params=useLocalSearchParams<{number?:string}>();
 const number=Math.max(1,Math.min(114,Number(params.number)||1));
 const surah=SURAHS.find(x=>x.number===number) ?? SURAHS[0];
 const [corpus,setCorpus]=useState<Corpus|null>(null);
 const [error,setError]=useState("");
 
 useMemo(()=>{
   let active=true;
   import("../src/quran/verified-corpus.json").then((m)=>{
     if(active) setCorpus(m.default as Corpus);
   }).catch(()=>{ if(active) setError("لم يتم تجهيز نسخة المصحف داخل التطبيق بعد."); });
   return ()=>{active=false};
 },[]);

 const ayahs=corpus?.ayahs.filter(x=>x.surah===number) ?? [];
 return <View style={s.root}>
  <View style={s.header}>
   <Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable>
   <View style={s.headerCenter}><Text style={s.title}>سُورَةُ {surah.nameAr}</Text><Text style={s.meta}>حفص • رسم عثماني • {surah.ayahCount} آية</Text></View>
   <View style={s.badge}><Text style={s.badgeText}>{number}</Text></View>
  </View>
  <ScrollView style={s.body} contentContainerStyle={s.content}>
   <View style={s.source}><Text style={s.sourceTitle}>📖 مصدر المصحف</Text><Text style={s.sourceText}>Tanzil Uthmani 1.1 • Hafs • النص لا يتم توليده بالذكاء الاصطناعي.</Text></View>
   {!corpus && !error && <View style={s.loading}><Text style={s.loadingText}>جاري تجهيز النص الموثق…</Text></View>}
   {error && <View style={s.loading}><Text style={s.error}>{error}</Text></View>}
   {ayahs.map((a)=><View key={a.ayah} style={s.ayah}>
      <View style={s.ayahNo}><Text style={s.ayahNoText}>{a.ayah}</Text></View>
      <Text style={s.ayahText}>{a.text}</Text>
      <Pressable style={s.recite} onPress={()=>router.push({pathname:"/recite",params:{surah:String(number),ayah:String(a.ayah)}})}>
       <Text style={s.reciteText}>🎙️ سمّع من هذه الآية</Text>
      </Pressable>
   </View>)}
  </ScrollView>
 </View>
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.navy},header:{paddingTop:56,paddingHorizontal:18,paddingBottom:18,flexDirection:"row",alignItems:"center"},back:{width:42,height:42,alignItems:"center",justifyContent:"center"},backText:{color:C.white,fontSize:34},headerCenter:{flex:1,alignItems:"center"},title:{color:C.white,fontSize:18,fontWeight:"900"},meta:{color:"#8EDFE7",fontSize:9,marginTop:4},badge:{width:38,height:38,borderRadius:13,backgroundColor:"#173451",alignItems:"center",justifyContent:"center"},badgeText:{color:"#B8F1F4",fontWeight:"900"},body:{backgroundColor:C.bg,borderTopLeftRadius:30,borderTopRightRadius:30},content:{padding:18,paddingBottom:45},source:{backgroundColor:"#E9F8FA",borderRadius:18,padding:14,borderWidth:1,borderColor:"#BDEDF1"},sourceTitle:{color:"#087E8B",fontWeight:"900",fontSize:12,textAlign:"right"},sourceText:{color:"#52707D",fontSize:10,lineHeight:17,marginTop:4,textAlign:"right"},loading:{backgroundColor:C.white,borderRadius:18,padding:22,marginTop:12,alignItems:"center"},loadingText:{color:C.muted,fontSize:11},error:{color:"#9A4B4B",fontSize:11,textAlign:"center"},ayah:{backgroundColor:C.white,borderRadius:20,padding:17,marginTop:12},ayahNo:{alignSelf:"flex-end",width:32,height:32,borderRadius:16,backgroundColor:"#E9F8FA",alignItems:"center",justifyContent:"center"},ayahNoText:{color:"#087E8B",fontWeight:"900",fontSize:11},ayahText:{color:C.ink,fontSize:25,lineHeight:48,textAlign:"right",marginTop:8},recite:{marginTop:12,backgroundColor:"#F1FCFD",borderRadius:13,padding:10,alignItems:"center"},reciteText:{color:"#087E8B",fontWeight:"800",fontSize:10}
});
