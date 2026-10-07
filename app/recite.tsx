import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Audio, RecordingPresets, useAudioRecorder, useAudioRecorderState } from "expo-audio";

export default function Recite() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [message, setMessage] = useState("جاهز للاستماع");

  async function toggleRecording() {
    try {
      if (state.isRecording) {
        await recorder.stop();
        setMessage("تم التسجيل — جاهز للتحليل الآمن");
        return;
      }
      const permission = await Audio.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMessage("يجب السماح بالميكروفون لبدء التلاوة");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMessage("جاري الاستماع… اقرأ الآية بهدوء");
    } catch {
      setMessage("تعذر بدء التسجيل. حاول مرة أخرى.");
    }
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={s.top}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>‹</Text></Pressable>
        <Text style={s.topTitle}>التلاوة الذكية</Text>
        <View style={{ width: 30 }} />
      </View>
      <View style={s.body}>
        <Text style={s.surah}>سُورَةُ الْفَاتِحَةِ</Text>
        <Text style={s.meta}>الآية ١</Text>
        <View style={s.ayah}>
          <Text style={s.ayahText}>الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ</Text>
          <Text style={s.number}>١</Text>
        </View>
        <Text style={s.hint}>اقرأ الآية، ثم سيقارن المحرك الصوتي النطق بالنص القرآني الموثق قبل إصدار أي تصحيح.</Text>
        <Pressable style={[s.mic, state.isRecording && s.micActive]} onPress={toggleRecording}>
          <Text style={s.micIcon}>{state.isRecording ? "■" : "●"}</Text>
        </Pressable>
        <Text style={s.listening}>{message}</Text>
        {state.isRecording && <Text style={s.timer}>{Math.floor((state.durationMillis || 0) / 1000)} ث</Text>}
        <Text style={s.safe}>🔒 التسجيل خاص ومؤقت؛ لا تُحفظ الملفات الخام افتراضيًا بعد المعالجة.</Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root:{flex:1,backgroundColor:"#071A33"},top:{paddingTop:58,paddingHorizontal:20,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  back:{color:"white",fontSize:34},topTitle:{color:"white",fontSize:18,fontWeight:"800"},body:{flex:1,backgroundColor:"#F7F9FC",marginTop:25,borderTopLeftRadius:30,borderTopRightRadius:30,padding:25},
  surah:{textAlign:"center",color:"#071A33",fontSize:20,fontWeight:"800",marginTop:8},meta:{textAlign:"center",color:"#8391A3",marginTop:7},
  ayah:{backgroundColor:"white",borderRadius:24,padding:25,marginTop:28,flexDirection:"row",alignItems:"center",gap:12},ayahText:{flex:1,textAlign:"right",fontSize:25,lineHeight:48,color:"#152A42"},
  number:{width:35,height:35,borderRadius:18,backgroundColor:"#22C7D8",textAlign:"center",paddingTop:7,color:"#071A33",fontWeight:"800"},
  hint:{textAlign:"center",color:"#72849A",fontSize:13,lineHeight:22,marginTop:20},mic:{width:92,height:92,borderRadius:46,backgroundColor:"#22C7D8",alignSelf:"center",marginTop:30,alignItems:"center",justifyContent:"center"},
  micActive:{backgroundColor:"#FF6B6B"},micIcon:{fontSize:35,color:"#071A33"},listening:{textAlign:"center",fontWeight:"800",color:"#071A33",marginTop:13},timer:{textAlign:"center",color:"#22AFC0",marginTop:5},
  safe:{textAlign:"center",color:"#8291A2",fontSize:11,marginTop:24}
});