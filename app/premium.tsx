import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

const C={navy:"#071A33",navy2:"#102746",cyan:"#35C7DE",bg:"#F4F8FC",ink:"#142A43",muted:"#788BA0",white:"#FFFFFF",gold:"#F5D27A"};

const features=[
 {icon:"🎯",title:"اختبار حفظ مخصص",desc:"حدد السورة أو نطاق الآيات وابدأ اختبارًا يناسب هدفك."},
 {icon:"🧠",title:"مراجعة نقاط الضعف",desc:"التصميم جاهز لعرض المواضع التي تحتاج مراجعة؛ حفظ النتائج الدائم سيُفعّل بعد ربط التخزين الآمن."},
 {icon:"🎲",title:"مواضع عشوائية",desc:"واجهة اختيار مواضع للاختبار من النطاق المحدد، دون الادعاء بأن اختيارًا عشوائيًا موثوقًا قد تم التحقق منه بعد."},
 {icon:"🎙️",title:"تحليل التلاوة المتقدم",desc:"ميزة قيد التطوير؛ لا تظهر درجات تصحيح آلي قبل توصيل محرك حقيقي واجتياز اختبارات الدقة."},
];

export default function Premium(){
 return <View style={s.root}>
  <StatusBar style="light"/>
  <View style={s.header}>
   <Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable>
   <View style={{flex:1,alignItems:"center"}}><Text style={s.headerTitle}>إجازة بريميوم</Text><Text style={s.headerSub}>تجربة أكثر تخصيصًا لحفظ القرآن</Text></View>
   <Text style={s.crown}>♛</Text>
  </View>
  <ScrollView contentContainerStyle={s.content}>
   <View style={s.hero}>
    <View style={s.heroLabel}><Text style={s.labelText}>IJAZAH PREMIUM</Text><Text style={s.spark}>✦</Text></View>
    <Text style={s.heroTitle}>رحلتك مع القرآن، بخطة تناسبك</Text>
    <Text style={s.heroText}>أدوات متقدمة للحفظ والمراجعة، مع توضيح صريح لما هو متاح وما لا يزال قيد التطوير.</Text>
    <View style={s.priceBox}><Text style={s.price}>قريبًا</Text><Text style={s.priceSub}>سيُعلن السعر بعد تجهيز الاشتراك الرسمي</Text></View>
   </View>
   <Text style={s.section}>مزايا بريميوم</Text>
   {features.map(f=><View key={f.title} style={s.feature}><Text style={s.featureIcon}>{f.icon}</Text><View style={{flex:1}}><Text style={s.featureTitle}>{f.title}</Text><Text style={s.featureDesc}>{f.desc}</Text></View></View>)}
   <View style={s.statusCard}><Text style={s.statusTitle}>🔒 الدفع الآمن قيد التجهيز</Text><Text style={s.statusText}>لم يتم تفعيل أي عملية دفع أو اشتراك وهمي. سنربط بوابة دفع موثوقة ونختبرها قبل تحصيل أي مبلغ.</Text></View>
   <Pressable style={s.primary} onPress={()=>router.push("/ijazah-pay")}><Text style={s.primaryText}>استكشف إجازة باي ←</Text></Pressable>
   <Pressable style={s.primary} onPress={()=>router.push("/smart-test")}><Text style={s.primaryText}>جرّب إعداد اختبار الحفظ ←</Text></Pressable>
   <Pressable style={s.secondary} onPress={()=>router.push("/recite")}><Text style={s.secondaryText}>الانتقال إلى التسميع</Text></Pressable>
   <Text style={s.foot}>تنبيه: اختيار بريميوم لا يعني أن تحليل التجويد أو حفظ نقاط الضعف أصبحا متصلين بالكامل حتى الآن.</Text>
  </ScrollView>
 </View>
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.bg},header:{paddingTop:56,paddingHorizontal:20,paddingBottom:18,backgroundColor:C.navy,flexDirection:"row",alignItems:"center",gap:12},back:{color:C.white,fontSize:34,width:28},headerTitle:{color:C.white,fontSize:19,fontWeight:"900"},headerSub:{color:"#9FB6CC",fontSize:10,marginTop:4},crown:{fontSize:26,color:C.gold},
 content:{padding:18,paddingBottom:42},hero:{backgroundColor:C.navy,borderRadius:26,padding:22,borderWidth:1,borderColor:"#1A4A65"},heroLabel:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},labelText:{color:C.cyan,fontSize:11,fontWeight:"900",letterSpacing:1},spark:{color:C.gold,fontSize:27},heroTitle:{color:C.white,fontSize:24,fontWeight:"900",textAlign:"right",marginTop:20,lineHeight:35},heroText:{color:"#B8C9D9",fontSize:12,lineHeight:21,textAlign:"right",marginTop:9},priceBox:{marginTop:19,padding:15,borderRadius:16,backgroundColor:"#173654",alignItems:"center"},price:{color:C.gold,fontSize:23,fontWeight:"900"},priceSub:{color:"#B8C9D9",fontSize:10,marginTop:4},
 section:{fontSize:18,color:C.navy,fontWeight:"900",textAlign:"right",marginTop:25,marginBottom:12},feature:{backgroundColor:C.white,borderRadius:18,padding:15,marginBottom:10,flexDirection:"row",alignItems:"flex-start",gap:13},featureIcon:{fontSize:24,width:34,textAlign:"center"},featureTitle:{color:C.navy,fontSize:14,fontWeight:"900",textAlign:"right"},featureDesc:{color:C.muted,fontSize:11,lineHeight:19,textAlign:"right",marginTop:5},
 statusCard:{backgroundColor:"#FFF8E6",borderWidth:1,borderColor:"#F3DCA0",borderRadius:17,padding:15,marginTop:5},statusTitle:{color:"#805D11",fontSize:13,fontWeight:"900",textAlign:"right"},statusText:{color:"#806F4C",fontSize:11,lineHeight:19,textAlign:"right",marginTop:6},
 primary:{backgroundColor:C.cyan,borderRadius:16,padding:16,alignItems:"center",marginTop:17},primaryText:{color:C.navy,fontWeight:"900",fontSize:14},secondary:{borderWidth:1,borderColor:"#D6E0E9",borderRadius:16,padding:15,alignItems:"center",marginTop:9},secondaryText:{color:C.navy,fontWeight:"800",fontSize:13},foot:{color:"#8794A3",fontSize:10,lineHeight:17,textAlign:"center",marginTop:15}
});
