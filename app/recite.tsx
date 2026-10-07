import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Audio, RecordingPresets, useAudioRecorder, useAudioRecorderState } from "expo-audio";

export default function Recite() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [message, setMessage] = useState("جاهز للاستماع");
  const [analyzed, setAnalyzed] = useState(false);

  async function toggleRecording() {
    try {
      if (state.isRecording) {
        await recorder.stop();
        setMessage("تم التسجيل — جاهز للتحليل العميق");
        setAnalyzed(true);
        return;
      }
      const permission = await Audio.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMessage("يجب السماح بالميكروفون لبدء التلاوة");
        return;
      }
      setAnalyzed(false);
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
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>التلاوة الذكية</Text>
          <Text style={s.headerSub}>تحليل قرآني متعدد الطبقات</Text>
        </View>
        <View style={s.accurate}><Text style={s.accurateText}>دقيق</Text></View>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.content}>
        <View style={s.surahRow}>
          <View>
            <Text style={s.surah}>سُورَةُ الْفَاتِحَةِ</Text>
            <Text style={s.meta}>الآية ١ • رواية حفص</Text>
          </View>
          <View style={s.badge}><Text style={s.badgeText}>١</Text></View>
        </View>

        <View style={s.ayah}>
          <Text style={s.ayahText}>الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ</Text>
          <Text style={s.reference}>نص مرجعي موثّق — لا يتم توليده بواسطة الذكاء الاصطناعي</Text>
        </View>

        <View style={s.engine}>
          <Text style={s.engineTitle}>محرك إجازة للتلاوة</Text>
          <View style={s.metrics}>
            <Metric label="مطابقة الكلمات" value="جاهز" />
            <Metric label="التجويد" value="جاهز" />
            <Metric label="الثقة" value="مرتفع" />
          </View>
        </View>

        <Text style={s.sectionTitle}>منهج التحليل</Text>
        <View style={s.steps}>
          <Step n="١" title="مطابقة الآية" text="تحديد السورة والآية وموضع كل كلمة." />
          <Step n="٢" title="تحليل النطق" text="فحص الحروف والحركات عند توفر دليل صوتي كافٍ." />
          <Step n="٣" title="فحص التجويد" text="اختبار القواعد من السمات الصوتية القابلة للقياس." />
          <Step n="٤" title="درجة الثقة" text="لا يظهر التصحيح إذا كانت الأدلة غير كافية." />
        </View>

        <Pressable style={[s.record, state.isRecording && s.recording]} onPress={toggleRecording}>
          <Text style={s.recordIcon}>{state.isRecording ? "■" : "●"}</Text>
          <View>
            <Text style={s.recordTitle}>{state.isRecording ? "إيقاف التلاوة" : "ابدأ التلاوة"}</Text>
            <Text style={s.recordSub}>{state.isRecording ? "نستمع الآن" : "سجّل بصوت واضح وهادئ"}</Text>
          </View>
        </Pressable>

        <Text style={s.listening}>{message}</Text>
        {state.isRecording && (
          <Text style={s.timer}>{Math.floor((state.durationMillis || 0) / 1000)} ث</Text>
        )}

        {analyzed && (
          <View style={s.deep}>
            <Text style={s.deepTitle}>التحليل العميق</Text>
            <Text style={s.deepText}>تم تجهيز التسجيل للتحليل الآمن. في الإصدار الإنتاجي سيُرسل الصوت عبر جلسة قصيرة العمر إلى محرك القرآن والتجويد، ثم تُحفظ نتيجة التحليل فقط افتراضيًا.</Text>
          </View>
        )}

        <Text style={s.safe}>🔒 التسجيل خاص ومؤقت. لا تُحفظ الملفات الخام افتراضيًا بعد المعالجة.</Text>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <View style={s.step}>
      <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
      <View style={s.stepCopy}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepText}>{text}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:"#071A33"},
  header:{paddingTop:56,paddingHorizontal:18,paddingBottom:18,flexDirection:"row",alignItems:"center"},
  backButton:{width:42,height:42,alignItems:"center",justifyContent:"center"},
  back:{color:"white",fontSize:34,lineHeight:36},
  headerCenter:{flex:1,alignItems:"center"},
  headerTitle:{color:"white",fontSize:18,fontWeight:"800"},
  headerSub:{color:"#8EDFE7",fontSize:11,marginTop:3},
  accurate:{borderWidth:1,borderColor:"#22C7D8",borderRadius:12,paddingHorizontal:9,paddingVertical:6},
  accurateText:{color:"#8EDFE7",fontSize:10,fontWeight:"800"},
  body:{flex:1,backgroundColor:"#F7F9FC",borderTopLeftRadius:30,borderTopRightRadius:30},
  content:{padding:22,paddingBottom:38},
  surahRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  surah:{color:"#071A33",fontSize:20,fontWeight:"800"},
  meta:{color:"#8391A3",marginTop:5,fontSize:12},
  badge:{width:38,height:38,borderRadius:19,backgroundColor:"#DDF7FA",alignItems:"center",justifyContent:"center"},
  badgeText:{color:"#087E8B",fontWeight:"900",fontSize:16},
  ayah:{backgroundColor:"white",borderRadius:24,padding:22,marginTop:18},
  ayahText:{textAlign:"right",fontSize:25,lineHeight:48,color:"#152A42",fontWeight:"500"},
  reference:{marginTop:14,color:"#8291A2",fontSize:10,textAlign:"center"},
  engine:{backgroundColor:"#071A33",borderRadius:24,padding:18,marginTop:16},
  engineTitle:{color:"white",fontSize:15,fontWeight:"800",marginBottom:14},
  metrics:{flexDirection:"row",gap:8},
  metric:{flex:1,backgroundColor:"#102746",borderRadius:15,padding:10,alignItems:"center"},
  metricValue:{color:"#8EDFE7",fontSize:12,fontWeight:"800"},
  metricLabel:{color:"#A9B8C9",fontSize:9,textAlign:"center",marginTop:5},
  sectionTitle:{color:"#071A33",fontSize:17,fontWeight:"800",marginTop:22,marginBottom:10},
  steps:{backgroundColor:"white",borderRadius:22,padding:15},
  step:{flexDirection:"row",alignItems:"center",marginVertical:7},
  stepNum:{width:32,height:32,borderRadius:16,backgroundColor:"#E4F9FB",alignItems:"center",justifyContent:"center"},
  stepNumText:{color:"#087E8B",fontWeight:"900"},
  stepCopy:{flex:1,marginLeft:11},
  stepTitle:{color:"#152A42",fontWeight:"800",fontSize:13},
  stepText:{color:"#7B8B9E",fontSize:10,marginTop:2,lineHeight:16},
  record:{marginTop:18,backgroundColor:"#22C7D8",borderRadius:20,padding:15,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:13},
  recording:{backgroundColor:"#FF8A8A"},
  recordIcon:{fontSize:25,color:"#071A33"},
  recordTitle:{color:"#071A33",fontWeight:"900",fontSize:15},
  recordSub:{color:"#174C59",fontSize:10,marginTop:2},
  listening:{textAlign:"center",fontWeight:"800",color:"#071A33",marginTop:12},
  timer:{textAlign:"center",color:"#0B9AAA",marginTop:4},
  deep:{backgroundColor:"#E9F8FA",borderRadius:20,padding:17,marginTop:17,borderWidth:1,borderColor:"#B9EDF1"},
  deepTitle:{color:"#087E8B",fontWeight:"900",fontSize:14},
  deepText:{color:"#496476",fontSize:11,lineHeight:19,marginTop:7},
  safe:{textAlign:"center",color:"#8291A2",fontSize:10,lineHeight:17,marginTop:20}
});