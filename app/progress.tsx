import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

const C={navy:"#071A33",cyan:"#35C7DE",bg:"#F4F8FC",ink:"#142A43",muted:"#788BA0",white:"#FFFFFF",line:"#E0EAF2"};

export default function Progress(){
 return <View style={s.root}>
  <StatusBar style="light"/>
  <View style={s.head}>
   <Pressable accessibilityRole="button" accessibilityLabel="العودة" onPress={()=>router.back()} style={s.backButton}><Text style={s.back}>‹</Text></Pressable>
   <View style={s.headCopy}><Text style={s.eyebrow}>IJAZAH · YOUR JOURNEY</Text><Text style={s.title}>رحلتك مع القرآن</Text><Text style={s.subtitle}>تقدّمك وإنجازاتك</Text></View>
   <View style={s.mark}><Text style={s.markText}>◔</Text></View>
  </View>
  <ScrollView contentContainerStyle={s.body}>
   <View style={s.hero}>
    <View style={s.heroIcon}><Text style={s.heroIconText}>✦</Text></View>
    <Text style={s.heroTitle}>كل رحلة عظيمة تبدأ بخطوة</Text>
    <Text style={s.heroText}>سنُظهر هنا ما أتممته فعلًا، من دون أرقام تقديرية أو إنجازات غير مسجلة.</Text>
    <View style={s.statsRow}>
     <View style={s.stat}><Text style={s.statNum}>—</Text><Text style={s.statLabel}>جلسات مكتملة</Text></View>
     <View style={s.statDivider}/>
     <View style={s.stat}><Text style={s.statNum}>—</Text><Text style={s.statLabel}>آيات تمت مراجعتها</Text></View>
     <View style={s.statDivider}/>
     <View style={s.stat}><Text style={s.statNum}>—</Text><Text style={s.statLabel}>أيام الاستمرار</Text></View>
    </View>
   </View>
   <View style={s.card}>
    <View style={s.cardHead}><View style={s.smallIcon}><Text style={s.smallIconText}>◎</Text></View><Text style={s.cardTitle}>ملخص التقدّم</Text></View>
    <Text style={s.emptyTitle}>لا توجد جلسات مكتملة بعد</Text>
    <Text style={s.cardText}>تسجيل الجلسات الدائم لم يُربط بعد؛ لذلك لن نعرض إحصائيات تخمينية على أنها بياناتك الحقيقية.</Text>
   </View>
   <View style={s.nextCard}>
    <Text style={s.nextEyebrow}>خطوتك التالية</Text>
    <Text style={s.nextTitle}>ابدأ جلسة تسميع أو مراجعة</Text>
    <Text style={s.nextText}>عندما تُحفظ الجلسات بصورة موثوقة، ستظهر نتائجك هنا تلقائيًا.</Text>
    <Pressable style={s.primary} onPress={()=>router.push("/recite")}><Text style={s.primaryText}>ابدأ التسميع ←</Text></Pressable>
    <Pressable style={s.secondary} onPress={()=>router.push("/smart-test")}><Text style={s.secondaryText}>إعداد اختبار الحفظ</Text></Pressable>
   </View>
   <Text style={s.footer}>إجازة · الدقة قبل الأرقام</Text>
  </ScrollView>
 </View>
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.bg},
 head:{paddingTop:55,paddingHorizontal:18,paddingBottom:24,backgroundColor:C.navy,flexDirection:"row",alignItems:"center",gap:12},
 backButton:{width:40,height:40,borderRadius:14,backgroundColor:"#173451",borderWidth:1,borderColor:"#294760",alignItems:"center",justifyContent:"center"},
 back:{color:C.white,fontSize:33,lineHeight:36},
 headCopy:{flex:1,alignItems:"flex-end"},
 eyebrow:{color:C.cyan,fontSize:8,fontWeight:"900",letterSpacing:1.1},
 title:{color:C.white,fontSize:21,fontWeight:"900",marginTop:5},
 subtitle:{color:"#A9C1D5",fontSize:10,marginTop:4},
 mark:{width:42,height:42,borderRadius:15,backgroundColor:"#12304D",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#294760"},
 markText:{color:C.cyan,fontSize:25},
 body:{padding:17,paddingTop:18,paddingBottom:40},
 hero:{backgroundColor:C.navy,borderRadius:25,padding:20,overflow:"hidden",borderWidth:1,borderColor:"#1B405E"},
 heroIcon:{width:45,height:45,borderRadius:15,backgroundColor:"#173B58",alignItems:"center",justifyContent:"center"},
 heroIconText:{color:C.cyan,fontSize:23},
 heroTitle:{color:C.white,fontSize:20,fontWeight:"900",textAlign:"right",marginTop:15},
 heroText:{color:"#B8C9D9",fontSize:11,lineHeight:19,textAlign:"right",marginTop:7},
 statsRow:{flexDirection:"row",alignItems:"center",marginTop:20,paddingTop:15,borderTopWidth:1,borderTopColor:"#294760"},
 stat:{flex:1,alignItems:"center",gap:6},
 statNum:{color:C.cyan,fontSize:21,fontWeight:"900"},
 statLabel:{color:"#B8C9D9",fontSize:9,textAlign:"center"},
 statDivider:{width:1,height:32,backgroundColor:"#294760"},
 card:{backgroundColor:C.white,borderRadius:21,padding:18,marginTop:14,borderWidth:1,borderColor:C.line},
 cardHead:{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:10},
 smallIcon:{width:34,height:34,borderRadius:12,backgroundColor:"#E5F8FC",alignItems:"center",justifyContent:"center"},
 smallIconText:{color:"#168DA5",fontSize:21},
 cardTitle:{color:C.ink,fontSize:14,fontWeight:"900"},
 emptyTitle:{color:C.ink,fontSize:15,fontWeight:"900",textAlign:"right",marginTop:16},
 cardText:{color:C.muted,fontSize:11,lineHeight:19,textAlign:"right",marginTop:7},
 nextCard:{backgroundColor:"#EAF7FC",borderWidth:1,borderColor:"#D5EDF5",borderRadius:22,padding:18,marginTop:14},
 nextEyebrow:{color:"#168DA5",fontSize:9,fontWeight:"900",textAlign:"right"},
 nextTitle:{color:C.ink,fontSize:17,fontWeight:"900",textAlign:"right",marginTop:7},
 nextText:{color:"#58788C",fontSize:11,lineHeight:18,textAlign:"right",marginTop:6},
 primary:{backgroundColor:C.navy,borderRadius:14,padding:14,alignItems:"center",marginTop:15},
 primaryText:{color:C.white,fontSize:12,fontWeight:"900"},
 secondary:{borderWidth:1,borderColor:"#C5E4EF",borderRadius:14,padding:13,alignItems:"center",marginTop:8},
 secondaryText:{color:C.navy,fontSize:11,fontWeight:"900"},
 footer:{color:C.muted,fontSize:9,textAlign:"center",marginTop:22}
});