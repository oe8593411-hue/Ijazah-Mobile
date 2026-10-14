import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

const lessons = [
  { title: "أحكام النون الساكنة والتنوين", summary: "الإظهار، والإدغام، والإقلاب، والإخفاء.", detail: "تختلف طريقة النطق بحسب الحرف الذي يأتي بعد النون الساكنة أو التنوين. تعلّم الحروف والأمثلة مع معلّم متقن، ولا تعتمد على هذه البطاقة وحدها للتصحيح." },
  { title: "أحكام الميم الساكنة", summary: "الإخفاء الشفوي، والإدغام الشفوي، والإظهار الشفوي.", detail: "تُراعى صفة الميم ومخرجها عند اتصالها بالحرف التالي، مع الانتباه إلى الغنة في مواضعها." },
  { title: "المدود", summary: "المد الطبيعي والمدود الفرعية.", detail: "مقدار المد يتبع نوعه والرواية والطريق المعتمد. لا تعرض هذه المعاينة مقادير آلية أو أحكامًا مخصصة لرواية لم تُوثق بعد." },
  { title: "القلقلة", summary: "حروفها: ق، ط، ب، ج، د.", detail: "تظهر القلقلة عند سكون أحد حروفها، وتحتاج إلى أداء واضح من غير مبالغة أو توليد حركة زائدة." },
  { title: "الغنة", summary: "صفة صوتية تظهر في مواضع مخصوصة، ومنها النون والميم المشددتان.", detail: "تُدرّب الأذن على الغنة بالسماع من قارئ متقن والتلقي المباشر؛ ولا يقيّم التطبيق أداءك آليًا في هذه النسخة." },
];

export default function TajweedGuide() {
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>‹</Text></Pressable>
        <View style={s.headCopy}><Text style={s.title}>دليل التجويد</Text><Text style={s.subtitle}>مراجعة تعليمية • ليست نتيجة تصحيح آلي</Text></View>
        <Text style={s.mark}>✦</Text>
      </View>
      <ScrollView style={s.body} contentContainerStyle={s.content}>
        <View style={s.notice}><Text style={s.noticeTitle}>📚 تعلّم بالتلقي</Text><Text style={s.noticeText}>هذا ملخص تعليمي للمراجعة. أحكام التجويد تُؤخذ بالمشافهة من معلّم متقن، ومحرك التصحيح الصوتي في التطبيق غير متصل بعد.</Text></View>
        {lessons.map((lesson, i) => (
          <View key={lesson.title} style={s.card}>
            <View style={s.cardHead}><View style={s.num}><Text style={s.numText}>{i + 1}</Text></View><Text style={s.cardTitle}>{lesson.title}</Text></View>
            <Text style={s.summary}>{lesson.summary}</Text>
            <Text style={s.detail}>{lesson.detail}</Text>
          </View>
        ))}
        <Pressable style={s.button} onPress={() => router.push("/recite")}><Text style={s.buttonText}>انتقل إلى شاشة التسميع</Text></Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:"#071A33"},
  header:{paddingTop:56,paddingHorizontal:20,paddingBottom:18,flexDirection:"row",alignItems:"center",gap:14},
  back:{color:"#FFFFFF",fontSize:34,width:30},
  headCopy:{flex:1,alignItems:"center"},
  title:{color:"#FFFFFF",fontSize:19,fontWeight:"900"},
  subtitle:{color:"#8EDFE7",fontSize:9,marginTop:4},
  mark:{color:"#35C7DE",fontSize:24},
  body:{backgroundColor:"#F4F8FC",borderTopLeftRadius:28,borderTopRightRadius:28},
  content:{padding:18,paddingBottom:40},
  notice:{backgroundColor:"#E5F8FC",borderRadius:18,padding:16,borderWidth:1,borderColor:"#D5EDF5",marginBottom:12},
  noticeTitle:{color:"#168DA5",fontSize:13,fontWeight:"900",textAlign:"right"},
  noticeText:{color:"#52707D",fontSize:11,lineHeight:19,marginTop:6,textAlign:"right"},
  card:{backgroundColor:"#FFFFFF",borderRadius:19,padding:17,marginBottom:11},
  cardHead:{flexDirection:"row",alignItems:"center",gap:10},
  num:{width:32,height:32,borderRadius:11,backgroundColor:"#E5F8FC",alignItems:"center",justifyContent:"center"},
  numText:{color:"#168DA5",fontWeight:"900"},
  cardTitle:{flex:1,color:"#071A33",fontSize:14,fontWeight:"900",textAlign:"right"},
  summary:{color:"#168DA5",fontSize:12,fontWeight:"800",textAlign:"right",marginTop:12},
  detail:{color:"#6D7E90",fontSize:11,lineHeight:19,textAlign:"right",marginTop:7},
  button:{backgroundColor:"#35C7DE",borderRadius:16,padding:16,alignItems:"center",marginTop:5},
  buttonText:{color:"#071A33",fontSize:14,fontWeight:"900"}
});
