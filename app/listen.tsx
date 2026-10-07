import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

const reciters = ["محمود خليل الحصري","عبد الباسط عبد الصمد","مشاري العفاسي","ماهر المعيقلي","محمد صديق المنشاوي"];
export default function Listen(){
 const [selected,setSelected]=useState(reciters[0]);
 const player=useAudioPlayer(null); const status=useAudioPlayerStatus(player);
 return <View style={s.root}>
  <View style={s.head}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>الاستماع</Text><View style={{width:28}}/></View>
  <ScrollView contentContainerStyle={s.body}>
   <Text style={s.label}>القارئ</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{reciters.map(r=><Pressable key={r} onPress={()=>setSelected(r)} style={[s.chip,selected===r&&s.active]}><Text style={[s.chipText,selected===r&&s.activeText]}>{r}</Text></Pressable>)}</ScrollView>
   <View style={s.ayah}><Text style={s.surah}>سُورَةُ الْفَاتِحَةِ</Text><Text style={s.text}>الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ</Text><Text style={s.num}>١</Text></View>
   <Text style={s.note}>اخترنا بنية تشغيل تدعم عدة قرّاء، وسنربط كل صوت بمصدر مرخّص قبل الإصدار.</Text>
   <View style={s.controls}><Pressable style={s.play} onPress={()=>status.playing?player.pause():player.play()}><Text style={s.playText}>{status.playing?"Ⅱ":"▶"}</Text></Pressable><Text style={s.time}>{Math.floor(status.currentTime||0)} ث / {Math.floor(status.duration||0)} ث</Text></View>
  </ScrollView>
 </View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:"#F7F9FC"},head:{paddingTop:58,paddingHorizontal:20,paddingBottom:18,backgroundColor:"#071A33",flexDirection:"row",justifyContent:"space-between",alignItems:"center"},back:{color:"#fff",fontSize:34},title:{color:"#fff",fontSize:19,fontWeight:"800"},body:{padding:20},label:{textAlign:"right",fontWeight:"800",color:"#071A33",fontSize:17},chips:{gap:9,paddingVertical:15},chip:{paddingHorizontal:15,paddingVertical:10,borderRadius:18,backgroundColor:"#fff"},active:{backgroundColor:"#22C7D8"},chipText:{color:"#4F6277",fontSize:12},activeText:{color:"#071A33",fontWeight:"800"},ayah:{backgroundColor:"#fff",borderRadius:25,padding:25,marginTop:12},surah:{textAlign:"center",color:"#0797A8",fontWeight:"800"},text:{textAlign:"center",color:"#142A43",fontSize:25,lineHeight:48,marginTop:18},num:{textAlign:"center",color:"#8391A3",marginTop:10},note:{textAlign:"right",color:"#8090A1",fontSize:12,lineHeight:20,marginTop:16},controls:{backgroundColor:"#fff",borderRadius:22,padding:20,alignItems:"center",marginTop:20},play:{width:68,height:68,borderRadius:34,backgroundColor:"#22C7D8",alignItems:"center",justifyContent:"center"},playText:{fontSize:25,color:"#071A33"},time:{marginTop:10,color:"#718399"}});